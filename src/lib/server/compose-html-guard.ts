// SEC-012 (05-security.md, ADENDA — re-revisión tras la remediación): la cota
// de bytes de SEC-004 (512 KB) no protege frente a DoS por profundidad de
// anidamiento. El coste de `sanitizeComposedEmailHtml()` (isomorphic-dompurify
// / jsdom, medido en ~94% del coste total, el normalizador propio es solo
// ~6%) crece con la PROFUNDIDAD del árbol, no con el tamaño en bytes:
//   - 494 KB de HTML plano (< la cota de 512 KB, pasa sin 413) bloqueó el
//     event loop 13-14 s.
//   - 43 KB con anidamiento profundidad ~4000 hizo `RangeError: Maximum call
//     stack size exceeded` en 2,5 s.
//
// Este guard corre ANTES de invocar el sanitizador, en UN solo pase O(n)
// sobre el string crudo (índices de `<`/`>` con `indexOf`, SIN parsear ni
// construir ningún DOM), así que su propio coste es barato incluso para
// entradas hostiles.
//
// Es la ÚNICA fuente de verdad de estos límites: los 4 call sites servidor
// (`api/compose/draft`, `api/compose/send`, y las acciones `send`/`draft` de
// `(app)/compose/+page.server.ts`) deben usar `guardComposedHtml` en vez de
// declarar su propia cota de tamaño.
//
// Vive en `lib/server/` (no en `compose-format.ts`) porque es exclusivamente
// lógica de servidor: los 4 llamadores son rutas `+server.ts`/
// `+page.server.ts`, que nunca se bundlean para el cliente.

/**
 * Tamaño máximo del HTML crudo antes de sanitizar. Ningún borrador o envío
 * legítimo del compositor se acerca a 64 KB (medido: 100 KB benignos ≈ 12,9 s
 * de coste base sin este guard; con el guard, ni siquiera llega a sanitizar).
 */
export const MAX_COMPOSED_HTML_BYTES = 64 * 1024;

/**
 * Profundidad máxima de anidamiento de etiquetas. Un correo compuesto real,
 * incluida una cadena larga de citas (`<blockquote>` anidados), no supera
 * ~10-15 niveles en la práctica — el contrato del compositor (§4.1 spec)
 * solo permite `div, p, br, strong, b, em, i, span, u, s, ul, ol, li,
 * blockquote, a`, y ninguna combinación legítima de esas etiquetas genera
 * anidamiento profundo. 100 deja un margen generoso (6-10× lo real) sin
 * abrir la puerta a un árbol adversarial: el caso medido que revienta la
 * pila usa profundidad 4000, muy por encima de este límite.
 */
export const MAX_HTML_NESTING_DEPTH = 100;

/**
 * Número máximo de etiquetas (aperturas + cierres) en el documento. Acota
 * el trabajo total de DOMPurify/jsdom independientemente de la
 * profundidad — un anidamiento "ancho mas no profundo" (muchos hermanos en
 * el mismo nivel) también amplifica el coste de parseo/saneo. Un correo
 * compuesto legítimo, incluso largo (varias páginas de texto formateado),
 * no se acerca a 10 000 etiquetas.
 */
export const MAX_HTML_TAG_COUNT = 10_000;

export type ComposedHtmlGuardReason = 'too_large' | 'too_deep' | 'too_many_tags';

export interface ComposedHtmlGuardResult {
  ok: boolean;
  reason?: ComposedHtmlGuardReason;
}

interface HtmlStructureMeasurement {
  maxDepth: number;
  tagCount: number;
}

const HTML_VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

const HTML_TAG_NAME_RE = /^\s*(\/?)\s*([A-Za-z][A-Za-z0-9:-]*)(?=[\s/]|$)/;

/**
 * Pase único O(n) sobre el string crudo, SIN parsear ni construir ningún
 * DOM: solo localiza pares `<...>` con `indexOf` (cada iteración avanza el
 * cursor de lectura, así que el trabajo total sobre toda la cadena es
 * lineal). La pila solo permite cerrar la apertura vigente; un cierre
 * desconocido o fuera de orden no reduce la profundidad. Los elementos void
 * de HTML no se apilan y el slash final de un elemento no-void se ignora,
 * igual que en el parser HTML. No pretende reemplazar al parser: favorece una
 * cota conservadora para HTML malformado antes de dejar que DOMPurify/jsdom
 * construyan el DOM real.
 */
function measureHtmlStructure(raw: string): HtmlStructureMeasurement {
  const openTags: string[] = [];
  let maxDepth = 0;
  let tagCount = 0;
  let i = 0;
  const len = raw.length;

  while (i < len) {
    const lt = raw.indexOf('<', i);
    if (lt === -1) break;
    const gt = raw.indexOf('>', lt + 1);
    if (gt === -1) break; // cola sin cerrar: se ignora, ya quedará acotada por otra cota

    const body = raw.slice(lt + 1, gt);
    i = gt + 1;

    if (!body || body.startsWith('!') || body.startsWith('?')) continue; // comentarios/doctype/PI

    // HTML parsers can reconsume the second bracket as a real opening tag.
    // Reject the malformed sequence rather than undercounting its nesting.
    if (/^\s*</.test(body)) {
      maxDepth = MAX_HTML_NESTING_DEPTH + 1;
      break;
    }

    tagCount++;
    const tag = HTML_TAG_NAME_RE.exec(body);
    if (tag) {
      const isClosing = tag[1] === '/';
      const tagName = tag[2].toLowerCase();

      if (isClosing) {
        if (openTags.at(-1) === tagName) openTags.pop();
      } else if (!HTML_VOID_ELEMENTS.has(tagName)) {
        openTags.push(tagName);
        if (openTags.length > maxDepth) maxDepth = openTags.length;
      }
    }

    // Corte temprano: ya se superó cualquier cota razonable, no hace falta
    // seguir escaneando el resto de una entrada potencialmente enorme.
    if (maxDepth > MAX_HTML_NESTING_DEPTH || tagCount > MAX_HTML_TAG_COUNT) break;
  }

  return { maxDepth, tagCount };
}

/**
 * Valida tamaño Y estructura del HTML crudo ANTES de sanitizar. Debe
 * llamarse en los 4 call sites servidor con el `html` tal como llega del
 * cliente, antes de `sanitizeComposedEmailHtml`/`safeSanitizeComposedEmailHtml`.
 */
export function guardComposedHtml(raw: string): ComposedHtmlGuardResult {
  if (Buffer.byteLength(raw, 'utf8') > MAX_COMPOSED_HTML_BYTES) {
    return { ok: false, reason: 'too_large' };
  }
  const { maxDepth, tagCount } = measureHtmlStructure(raw);
  if (maxDepth > MAX_HTML_NESTING_DEPTH) return { ok: false, reason: 'too_deep' };
  if (tagCount > MAX_HTML_TAG_COUNT) return { ok: false, reason: 'too_many_tags' };
  return { ok: true };
}

/** HTTP status recomendado por motivo de rechazo (413 para tamaño, 400 para estructura). */
export const COMPOSED_HTML_GUARD_STATUS: Readonly<Record<ComposedHtmlGuardReason, number>> = {
  too_large: 413,
  too_deep: 400,
  too_many_tags: 400,
};

/** Mensaje de error en español, consistente con el resto de la ruta. */
export const COMPOSED_HTML_GUARD_MESSAGES: Readonly<Record<ComposedHtmlGuardReason, string>> = {
  too_large: 'Contenido HTML demasiado grande',
  too_deep: 'Contenido HTML con anidamiento excesivo',
  too_many_tags: 'Contenido HTML con demasiadas etiquetas',
};
