import { sanitize } from 'isomorphic-dompurify';
import { COMPOSED_EMAIL_TAGS } from './compose-format';
import { normalizeComposedDom } from './compose-html';

const ALLOWED_TAGS = [
  'a',
  'abbr',
  'address',
  'area',
  'article',
  'aside',
  'audio',
  'b',
  'bdi',
  'bdo',
  'blockquote',
  'br',
  'button',
  'canvas',
  'caption',
  'cite',
  'code',
  'col',
  'colgroup',
  'data',
  'datalist',
  'dd',
  'del',
  'details',
  'dfn',
  'dialog',
  'div',
  'dl',
  'dt',
  'em',
  'embed',
  'fieldset',
  'figcaption',
  'figure',
  'footer',
  'form',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hgroup',
  'hr',
  'i',
  'iframe',
  'img',
  'input',
  'ins',
  'kbd',
  'label',
  'legend',
  'li',
  'main',
  'map',
  'mark',
  'menu',
  'meter',
  'nav',
  'ol',
  'optgroup',
  'option',
  'output',
  'p',
  'picture',
  'pre',
  'progress',
  'q',
  'rp',
  'rt',
  'ruby',
  's',
  'samp',
  'section',
  'select',
  'small',
  'source',
  'span',
  'strong',
  'sub',
  'summary',
  'sup',
  'table',
  'tbody',
  'td',
  'template',
  'textarea',
  'tfoot',
  'th',
  'thead',
  'time',
  'tr',
  'track',
  'u',
  'ul',
  'var',
  'video',
  'wbr',
];

const DISALLOWED_ATTR = [
  'onerror',
  'onload',
  'onclick',
  'onmouseover',
  'onfocus',
  'onblur',
  'javascript:',
];

export function sanitizeEmailHtml(html: string): string {
  if (!html) return '';
  const cleaned = sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: [
      'href',
      'src',
      'alt',
      'title',
      'style',
      'target',
      'rel',
      'width',
      'height',
      'class',
      'id',
      'colspan',
      'rowspan',
      'cite',
      'datetime',
      'start',
      'type',
      'value',
      'selected',
      'disabled',
      'checked',
    ],
    FORBID_ATTR: DISALLOWED_ATTR,
    FORBID_TAGS: ['script', 'object', 'form'],
    ALLOW_DATA_ATTR: false,
    ALLOWED_URI_REGEXP: /^(?:https?|mailto|cid|data:image\/(png|gif|jpeg|webp|svg))/i,
  });
  // SEC-001 (05-security.md): NO post-procesar `cleaned` con una regex sobre el
  // string ya serializado. Un `replace(/target=["']?_blank["']?/gi, ...)` aquí
  // coincide con la subcadena `target=_blank` dentro de CUALQUIER valor de
  // atributo (`alt`, `title`, `value`, `class`, `href`…), inyecta una comilla
  // en mitad de ese valor y el resto se re-parsea como atributos nuevos —
  // incluidos manejadores `onfocus`/`onerror`/`ontoggle`. Confirmado explotable
  // (0-click) por sdd-security. DOMPurify ya elimina `target`/`rel` de todo
  // `<a>` con esta configuración, así que la regex no protegía nada real.
  return cleaned;
}

/**
 * Configuración de DOMPurify para el compositor (diseño §6.1).
 * `RETURN_DOM: true` deja el paso 3 hacer la reconstrucción de `style` y las
 * reglas por etiqueta con el MISMO normalizador que usa el cliente
 * (`normalizeComposedDom`), en vez de un post-proceso de regex sobre el
 * string — eso es lo que convierte CA-19 (paridad byte a byte) en una
 * propiedad estructural (diseño §1, §6.3).
 */
// Nota de tipado: los arrays NO llevan `as const` — el `Config` de DOMPurify
// declara `ALLOWED_TAGS`/`ALLOWED_ATTR`/`FORBID_TAGS` como `string[]`
// mutables; un tuple `readonly` no es asignable ahí.
const COMPOSED_CONFIG = {
  ALLOWED_TAGS: [...COMPOSED_EMAIL_TAGS] as string[],
  ALLOWED_ATTR: ['style', 'href', 'target', 'rel'],
  FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'img', 'font', 'strike'],
  FORBID_ATTR: [...DISALLOWED_ATTR],
  ALLOW_DATA_ATTR: false,
  ALLOWED_URI_REGEXP: /^(?:https?:|mailto:)/i,
  RETURN_DOM: true,
};

export function sanitizeComposedEmailHtml(html: string): string {
  if (!html) return '';

  // [R2] `RETURN_DOM: true` cambia el tipo de retorno real a `HTMLBodyElement`
  // (verificado en runtime, diseño §14.2 R2); el tipado de `isomorphic-dompurify`
  // no lo estrecha automáticamente para esta sobrecarga.
  const body = sanitize(html, COMPOSED_CONFIG) as unknown as HTMLElement;

  // Mismo normalizador que corre en el cliente (sin convertLegacyTags: aquí
  // DOMPurify ya quitó font/strike vía FORBID_TAGS, no hay nada que convertir).
  normalizeComposedDom(body);

  const cleaned = body.innerHTML;

  const plain = (body.textContent ?? '').replace(/[\u00A0\u200B]/g, ' ').trim();
  return plain ? cleaned : '';
}

export type SafeSanitizeResult = { ok: true; html: string } | { ok: false };

/**
 * SEC-012 (05-security.md, ADENDA): envoltorio de `sanitizeComposedEmailHtml`
 * que convierte un `RangeError` (desbordamiento de pila de
 * DOMPurify/jsdom ante un árbol adversarial) en un resultado controlado en
 * vez de dejarlo propagarse como un 500 sin controlar. El guard de
 * estructura (`guardComposedHtml`, `src/lib/server/compose-html-guard.ts`)
 * ya rechaza la inmensa mayoría de esos árboles ANTES de llegar aquí, pero
 * esta captura es la última línea de defensa por si un caso adversarial
 * distinto a los medidos se cuela por debajo del límite de profundidad.
 * Todos los call sites servidor deben usar esta función, no
 * `sanitizeComposedEmailHtml` directamente.
 */
export function safeSanitizeComposedEmailHtml(html: string): SafeSanitizeResult {
  try {
    return { ok: true, html: sanitizeComposedEmailHtml(html) };
  } catch (e) {
    if (e instanceof RangeError) return { ok: false };
    throw e;
  }
}

export function extractEmail(email: string): string {
  const m = email.match(/<([^>]+)>/);
  return (m?.[1] ?? email).trim();
}

export function buildReplySubject(subject: string): string {
  if (/^re:/i.test(subject)) return subject;
  return `Re: ${subject ?? ''}`;
}

/** Fast Mail (TARGET-only): reescribe referencias `cid:` de los correos
 * leídos por URLs del endpoint `/api/attachment`, codificando los parámetros.
 * Usado por `thread/[uid]/+page.server.ts` al renderizar HTML recibido. */
export function rewriteCidImages(html: string, uid: number | string, mailbox: string): string {
  if (!html) return html;
  const safeMailbox = encodeURIComponent(mailbox);
  const safeUid = encodeURIComponent(String(uid));
  return html.replace(/cid:([^"')\s]+)/g, (_m, cid: string) => {
    const safeCid = encodeURIComponent(cid.replace(/^<|>$/g, ''));
    return `/api/attachment?uid=${safeUid}&mailbox=${safeMailbox}&cid=${safeCid}`;
  });
}

export function buildReplyHeaders(headerBlock: string): string {
  return headerBlock
    .split('\n')
    .map((l) => `> ${l}`)
    .join('\n');
}
