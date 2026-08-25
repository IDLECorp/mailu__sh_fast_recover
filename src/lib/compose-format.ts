// Contrato compartido de formato para el compositor de correo enriquecido.
//
// Este módulo es la ÚNICA fuente de verdad de qué etiquetas, valores CSS,
// colores y esquemas de URL son legales en un correo compuesto, y de cómo se
// serializa canónicamente un `style`. Lo importan tanto el editor cliente
// (`RichTextEditor.svelte`, bundle cliente) como el sanitizador servidor
// (`sanitize.ts`).
//
// Regla dura de higiene de bundle: CERO `import` en este archivo. Solo
// constantes y funciones puras sobre `string`. Así ninguna dependencia
// server-only (isomorphic-dompurify, jsdom) llega al bundle cliente por
// transitividad. Ver diseño §2.1.

// ─── Etiquetas (spec §4.1) ─────────────────────────────────────────────────
export const COMPOSED_EMAIL_TAGS = [
  'div',
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'span',
  'u',
  's',
  'ul',
  'ol',
  'li',
  'blockquote',
  'a',
] as const;
export type ComposedTag = (typeof COMPOSED_EMAIL_TAGS)[number];

/** Etiquetas que el navegador puede emitir y que se convierten en el cliente. */
export const LEGACY_TAGS_TO_CONVERT = ['font', 'strike'] as const;

/**
 * Atributos permitidos por etiqueta. DOMPurify no segmenta por tag: esto lo
 * hace el normalizador.
 *
 * SEC-011 (05-security.md): declarado sobre `Object.create(null)` en vez de
 * un literal `{}`. Un literal hereda de `Object.prototype`, así que
 * `ATTRS_BY_TAG['constructor']` devolvería `Object` (truthy) en vez de
 * `undefined` — el `??` no dispararía y el llamador terminaría llamando
 * `.includes` sobre `Object`, un `TypeError`. Hoy es inalcanzable (el tag ya
 * se filtra contra el allow-list antes), pero un objeto sin prototipo no
 * depende de que esa garantía externa se mantenga para siempre.
 */
export const ATTRS_BY_TAG: Readonly<Record<string, readonly string[]>> = Object.assign(
  Object.create(null) as Record<string, readonly string[]>,
  {
    '*': ['style'],
    a: ['style', 'href', 'target', 'rel'],
  },
);

// ─── Tamaños de letra (spec §4.2) ──────────────────────────────────────────
export const FONT_SIZES = ['12px', '14px', '16px', '18px', '24px'] as const;
export type FontSize = (typeof FONT_SIZES)[number];
export const FONT_SIZE_LABELS: Readonly<Record<FontSize, string>> = {
  '12px': '12',
  '14px': '14',
  '16px': '16',
  '18px': '18',
  '24px': '24',
};

// ─── Familias tipográficas ──────────────────────────────────────────────────
// Valores EXACTOS emitidos y aceptados. Cada uno con fallback genérico (RNF-02).
export const FONT_FAMILIES = [
  'inherit',
  // Marca (ver diseño §12.6). El nombre registrado por @fontsource-variable es
  // 'Montserrat Variable'; sin él primero, la opción caía a Arial y era
  // indistinguible de la opción Arial en el compositor. Se conserva
  // 'Montserrat' para destinatarios con la fuente instalada localmente.
  'Montserrat Variable, Montserrat, Arial, Helvetica, sans-serif',
  'Arial, Helvetica, sans-serif',
  'Georgia, serif',
  "'Courier New', monospace",
] as const;
export type FontFamily = (typeof FONT_FAMILIES)[number];
export const FONT_FAMILY_LABELS: Readonly<Record<FontFamily, string>> = {
  inherit: 'Predeterminada',
  'Montserrat Variable, Montserrat, Arial, Helvetica, sans-serif': 'Montserrat',
  'Arial, Helvetica, sans-serif': 'Arial',
  'Georgia, serif': 'Georgia',
  "'Courier New', monospace": 'Courier New',
};

// ─── Paleta de color ────────────────────────────────────────────────────────
export interface PaletteColor {
  readonly hex: string;
  readonly label: string;
}

/** Matriz compartida por color de texto y resaltado, ordenada por tonos. */
export const COMPOSE_COLOR_PALETTE: readonly PaletteColor[] = [
  { hex: '#000000', label: 'Negro' },
  { hex: '#434343', label: 'Gris carbón' },
  { hex: '#666666', label: 'Gris oscuro' },
  { hex: '#999999', label: 'Gris medio' },
  { hex: '#cccccc', label: 'Gris claro' },
  { hex: '#ffffff', label: 'Blanco' },
  { hex: '#5b0f00', label: 'Rojo muy oscuro' },
  { hex: '#660000', label: 'Bordó oscuro' },
  { hex: '#783f04', label: 'Naranja muy oscuro' },
  { hex: '#7f6000', label: 'Amarillo muy oscuro' },
  { hex: '#274e13', label: 'Verde muy oscuro' },
  { hex: '#0c343d', label: 'Cian muy oscuro' },
  { hex: '#073763', label: 'Azul muy oscuro' },
  { hex: '#20124d', label: 'Violeta muy oscuro' },
  { hex: '#4c1130', label: 'Magenta muy oscuro' },
  { hex: '#741b47', label: 'Rosa muy oscuro' },
  { hex: '#134f5c', label: 'Turquesa oscuro' },
  { hex: '#006a2f', label: 'Verde Urbaterra' },
  { hex: '#cc0000', label: 'Rojo' },
  { hex: '#e69138', label: 'Naranja' },
  { hex: '#f1c232', label: 'Amarillo' },
  { hex: '#6aa84f', label: 'Verde' },
  { hex: '#3d85c6', label: 'Azul' },
  { hex: '#674ea7', label: 'Violeta' },
  { hex: '#e06666', label: 'Rojo suave' },
  { hex: '#f6b26b', label: 'Naranja suave' },
  { hex: '#ffd966', label: 'Amarillo suave' },
  { hex: '#93c47d', label: 'Verde suave' },
  { hex: '#6fa8dc', label: 'Azul suave' },
  { hex: '#8e7cc3', label: 'Violeta suave' },
  { hex: '#f4cccc', label: 'Rojo pálido' },
  { hex: '#fce5cd', label: 'Naranja pálido' },
  { hex: '#fff2cc', label: 'Amarillo pálido' },
  { hex: '#d9ead3', label: 'Verde pálido' },
  { hex: '#cfe2f3', label: 'Azul pálido' },
  { hex: '#d9d2e9', label: 'Violeta pálido' },
] as const;

// ─── Alineación y sangría ───────────────────────────────────────────────────
export const ALIGNMENTS = ['left', 'center', 'right', 'justify'] as const;
export type Alignment = (typeof ALIGNMENTS)[number];

export const INDENT_STEP_PX = 40;
export const INDENT_MAX_PX = 120; // 3 niveles (spec §4.2)
export const INDENT_MAX_EM = 8; // solo para validar entrada heredada

// ─── Enlaces (spec §4.3) ────────────────────────────────────────────────────
export const ALLOWED_LINK_SCHEMES = ['http:', 'https:', 'mailto:'] as const;
export const LINK_TARGET = '_blank';
export const LINK_REL = 'noopener noreferrer';

// ─── Estilo compuesto ───────────────────────────────────────────────────────
export interface ComposedStyle {
  textAlign?: Alignment;
  fontFamily?: FontFamily;
  fontSize?: FontSize;
  fontWeight?: 'bold' | 'normal';
  textDecoration?: 'underline' | 'line-through' | 'none';
  color?: string; // '#rrggbb' minúsculas
  backgroundColor?: string; // '#rrggbb' minúsculas
  marginLeft?: string; // '<n>px', 0 ≤ n ≤ 120
  paddingLeft?: string; // '<n>px', 0 ≤ n ≤ 120
}

// ─── Validadores por propiedad ──────────────────────────────────────────────

export function normalizeAlignment(raw: string): Alignment | undefined {
  const value = raw.trim().toLowerCase();
  return (ALIGNMENTS as readonly string[]).includes(value) ? (value as Alignment) : undefined;
}

export function normalizeFontSize(raw: string): FontSize | undefined {
  const value = raw.trim().toLowerCase();
  return (FONT_SIZES as readonly string[]).includes(value) ? (value as FontSize) : undefined;
}

/**
 * Alias de migración: borradores/ correos guardados con el stack anterior de
 * la marca ('Montserrat, …') siguen siendo válidos y se reescriben al valor
 * canónico actual en la próxima normalización. La clave está en forma
 * normalizada (minúsculas, sin comillas, espacios colapsados).
 */
const LEGACY_FONT_FAMILY_ALIASES: Readonly<Record<string, FontFamily>> = {
  'montserrat, arial, helvetica, sans-serif':
    'Montserrat Variable, Montserrat, Arial, Helvetica, sans-serif',
};

/** Insensible a comillas (simples/dobles) y a mayúsculas/minúsculas. */
export function normalizeFontFamily(raw: string): FontFamily | undefined {
  const normalize = (value: string) =>
    value.trim().toLowerCase().replace(/['"]/g, '').replace(/\s+/g, ' ');
  const target = normalize(raw);
  for (const candidate of FONT_FAMILIES) {
    if (normalize(candidate) === target) return candidate;
  }
  return LEGACY_FONT_FAMILY_ALIASES[target];
}

/** Mapea 700→bold, 400→normal; acepta también los literales 'bold'/'normal'. */
export function normalizeFontWeight(raw: string): 'bold' | 'normal' | undefined {
  const value = raw.trim().toLowerCase();
  if (value === 'bold' || value === '700') return 'bold';
  if (value === 'normal' || value === '400') return 'normal';
  return undefined;
}

export function normalizeTextDecoration(
  raw: string,
): 'underline' | 'line-through' | 'none' | undefined {
  const value = raw.trim().toLowerCase();
  if (value === 'underline' || value === 'line-through' || value === 'none') return value;
  return undefined;
}

/**
 * `normalizeColor` — reglas exactas (spec §4.2 / diseño §3.1):
 * 1. Recortar y bajar a minúsculas.
 * 2. Rechazar si contiene `url(`, `expression(`, `calc(`, `var(`, `\`, o cualquier
 *    carácter fuera de `[0-9a-f#(),.%\s]` (más `r`/`g` para permitir la
 *    forma `rgb(...)` de la regla 5 — el charset literal de diseño §3.1
 *    omite esas dos letras, lo cual haría rechazar TODO `rgb()` en el paso 2
 *    antes de llegar al paso 5 que existe explícitamente para convertirlo;
 *    ver nota de implementación más abajo).
 * 3. `^#([0-9a-f]{3})$` → expandir a 6 dígitos.
 * 4. `^#([0-9a-f]{6})$` → aceptar.
 * 5. `^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$` con cada
 *    componente ≤ 255 → convertir a `#rrggbb`.
 * 6. Cualquier otra cosa → `undefined`.
 *
 * NOTA DE IMPLEMENTACIÓN (judgment call de sdd-apply, T-01): el diseño
 * declara literalmente el charset `[0-9a-f#(),.%\s]` para el paso 2, pero
 * ese charset no incluye `r` ni `g`, lo que rechazaría cualquier valor
 * `rgb(...)` — precisamente el valor que `execCommand('foreColor', ...)`
 * con `styleWithCSS` emite (diseño §4.2 tabla, C6) y que la regla 5 existe
 * para convertir a hex. Verificado con un script en scratchpad: con el
 * charset literal, `normalizeColor('rgb(0, 106, 47)')` siempre devuelve
 * `undefined`, lo que rompería RF-08 (color) por completo. Se amplía el
 * charset con `rg` (ninguna de las dos aparece en `url(`/`expression(`/
 * `calc(`/`var(`, que ya se rechazan por sub-string antes de este chequeo,
 * así que no se abre ninguna superficie nueva) para que la regla 5 sea
 * alcanzable, que es la intención inequívoca del resto de la sección.
 */
export function normalizeColor(raw: string): string | undefined {
  const value = raw.trim().toLowerCase();

  if (
    value.includes('url(') ||
    value.includes('expression(') ||
    value.includes('calc(') ||
    value.includes('var(') ||
    value.includes('\\') ||
    /[^0-9a-fgr#(),.%\s]/.test(value)
  ) {
    return undefined;
  }

  const shortHex = value.match(/^#([0-9a-f]{3})$/);
  if (shortHex) {
    const [r, g, b] = shortHex[1].split('');
    return `#${r}${r}${g}${g}${b}${b}`;
  }

  if (/^#([0-9a-f]{6})$/.test(value)) return value;

  const rgb = value.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/);
  if (rgb) {
    const components = [rgb[1], rgb[2], rgb[3]].map((n) => Number.parseInt(n, 10));
    if (components.every((n) => n <= 255)) {
      return `#${components.map((n) => n.toString(16).padStart(2, '0')).join('')}`;
    }
  }

  return undefined;
}

/**
 * Recorta a [0, INDENT_MAX_PX]. Acepta entrada en `px` o `em` heredada
 * (validada contra INDENT_MAX_EM), y siempre emite `'<n>px'`.
 * La conversión em→px usa la equivalencia declarada por spec §4.2
 * ("0–120px o 0–8em" describen el mismo rango máximo en dos unidades):
 * INDENT_MAX_PX / INDENT_MAX_EM px por em.
 */
export function normalizeIndent(raw: string): string | undefined {
  const value = raw.trim().toLowerCase();
  // SEC-003 (05-security.md): la forma original `(-?\d*\.?\d+)` es ambigua —
  // `\d*` y `\d+` compiten por los mismos dígitos, lo que produce backtracking
  // O(N²) ante una cadena larga de dígitos seguida de un sufijo que no casa.
  // Medido: 250k dígitos = 71s de event loop bloqueado. La forma de abajo tiene
  // un único camino de parseo (entero-con-decimal-opcional O decimal-puro),
  // sin ambigüedad, y es lineal. `RichTextEditor.svelte` ya usa esta forma.
  const pxMatch = value.match(/^(-?(?:\d+(?:\.\d+)?|\.\d+))px$/);
  const emMatch = value.match(/^(-?(?:\d+(?:\.\d+)?|\.\d+))em$/);

  let px: number | undefined;
  if (pxMatch) {
    px = Number.parseFloat(pxMatch[1]);
  } else if (emMatch) {
    const em = Number.parseFloat(emMatch[1]);
    px = em * (INDENT_MAX_PX / INDENT_MAX_EM);
  } else {
    return undefined;
  }

  if (Number.isNaN(px)) return undefined;
  const clamped = Math.max(0, Math.min(INDENT_MAX_PX, px));
  return `${Math.round(clamped)}px`;
}

// ─── Parseo y serialización canónica de `style` ────────────────────────────

const STYLE_PROP_TO_FIELD: Readonly<Record<string, keyof ComposedStyle>> = {
  'text-align': 'textAlign',
  'font-family': 'fontFamily',
  'font-size': 'fontSize',
  'font-weight': 'fontWeight',
  'text-decoration': 'textDecoration',
  color: 'color',
  'background-color': 'backgroundColor',
  'margin-left': 'marginLeft',
  'padding-left': 'paddingLeft',
};

// SEC-003 (05-security.md): cota dura de longitud por valor de declaración
// CSS, aplicada ANTES de que cualquier regex de `normalize*` la vea. Ningún
// valor legítimo del contrato (hex, rgb(), nombre de familia, "<n>px/em")
// supera ~40 caracteres; 64 deja margen sin abrir la puerta a entradas
// adversariales de miles/millones de dígitos que, incluso con una regex ya
// desambiguada, siguen costando tiempo proporcional a su longitud.
const MAX_STYLE_VALUE_LENGTH = 64;

/** Parser propio del atributo `style` crudo. NO usa CSSOM (ver diseño §6.3). */
export function parseStyleAttribute(raw: string | null | undefined): ComposedStyle {
  const style: ComposedStyle = {};
  if (!raw) return style;

  for (const declaration of raw.split(';')) {
    const colonIndex = declaration.indexOf(':');
    if (colonIndex === -1) continue;
    const prop = declaration.slice(0, colonIndex).trim().toLowerCase();
    const rawValue = declaration.slice(colonIndex + 1).trim();
    if (!prop || !rawValue) continue;
    if (rawValue.length > MAX_STYLE_VALUE_LENGTH) continue;

    switch (prop) {
      case 'text-align': {
        const v = normalizeAlignment(rawValue);
        if (v) style.textAlign = v;
        break;
      }
      case 'font-family': {
        const v = normalizeFontFamily(rawValue);
        if (v) style.fontFamily = v;
        break;
      }
      case 'font-size': {
        const v = normalizeFontSize(rawValue);
        if (v) style.fontSize = v;
        break;
      }
      case 'font-weight': {
        const v = normalizeFontWeight(rawValue);
        if (v) style.fontWeight = v;
        break;
      }
      case 'text-decoration': {
        const v = normalizeTextDecoration(rawValue);
        if (v) style.textDecoration = v;
        break;
      }
      case 'color': {
        const v = normalizeColor(rawValue);
        if (v) style.color = v;
        break;
      }
      case 'background-color': {
        const v = normalizeColor(rawValue);
        if (v) style.backgroundColor = v;
        break;
      }
      case 'margin-left': {
        const v = normalizeIndent(rawValue);
        if (v) style.marginLeft = v;
        break;
      }
      case 'padding-left': {
        const v = normalizeIndent(rawValue);
        if (v) style.paddingLeft = v;
        break;
      }
      default:
        // Propiedad desconocida: se ignora esa declaración, las demás se conservan.
        break;
    }
  }

  return style;
}

/**
 * Orden canónico fijo (para que cliente y servidor produzcan el mismo byte):
 * text-align; font-family; font-size; font-weight; text-decoration; color;
 * background-color; margin-left; padding-left
 * Separador '; ', formato 'prop: value', sin ';' final.
 * Devuelve '' si no queda ninguna declaración válida.
 */
export function serializeComposedStyle(style: ComposedStyle): string {
  const declarations: string[] = [];
  if (style.textAlign) declarations.push(`text-align: ${style.textAlign}`);
  if (style.fontFamily) declarations.push(`font-family: ${style.fontFamily}`);
  if (style.fontSize) declarations.push(`font-size: ${style.fontSize}`);
  if (style.fontWeight) declarations.push(`font-weight: ${style.fontWeight}`);
  if (style.textDecoration) declarations.push(`text-decoration: ${style.textDecoration}`);
  if (style.color) declarations.push(`color: ${style.color}`);
  if (style.backgroundColor) declarations.push(`background-color: ${style.backgroundColor}`);
  if (style.marginLeft) declarations.push(`margin-left: ${style.marginLeft}`);
  if (style.paddingLeft) declarations.push(`padding-left: ${style.paddingLeft}`);
  return declarations.join('; ');
}

// ─── Política de href ───────────────────────────────────────────────────────

// SEC-002 (05-security.md): caracteres que, aunque `new URL()` los acepte
// dentro de un componente de la URL (típicamente la query o el fragmento),
// sobreviven intactos en el string original devuelto y no son escapados por
// la serialización `innerHTML` de ningún navegador (`&` y `"` sí lo son;
// espacio, `<`, `>` y el backtick NO). Sin este filtro, un `href` podía
// llevar munición para reabrir un atributo cuando el HTML compuesto pasa
// luego por una re-escritura de string ajena (ver SEC-001). Se rechaza el
// enlace completo (desenvuelto por el llamador, texto conservado) en vez de
// percent-codificar, para no reintroducir una transformación no reversible
// sobre el string que rompería CA-07/CA-19 (§3.1 del diseño: "devuelve el
// original recortado"). Deviación documentada en 04-tasks.md.
//
// SEC-013 (05-security.md, ADENDA): el apóstrofo NO va en este charset de
// rechazo. Es válido en la parte local de un correo (RFC 5321, p.ej.
// `o'brien@urbaterra.ec`) y en query/paths de URL legítimas; rechazarlo
// entero rompía un caso de uso real. Se maneja aparte, por
// percent-codificación (ver más abajo), que sí es reversible y segura.
const UNSAFE_HREF_CHARS = /[\s<>"`]/;

/**
 * Valida el esquema; devuelve el string ORIGINAL recortado (NO
 * `new URL().toString()`, que normaliza y rompería CA-07/CA-19), o `null`.
 */
export function normalizeHref(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const hasControlChars = trimmed.split('').some((ch) => {
    const code = ch.charCodeAt(0);
    return code <= 0x1f || code === 0x7f;
  });
  if (hasControlChars) return null;
  if (UNSAFE_HREF_CHARS.test(trimmed)) return null;

  try {
    const parsed = new URL(trimmed);
    if (!(ALLOWED_LINK_SCHEMES as readonly string[]).includes(parsed.protocol)) return null;
    // SEC-013: percent-codificar el apóstrofo literal DESPUÉS de validar el
    // esquema, en vez de rechazarlo. `%27` es la codificación correcta y
    // reversible, mantiene el resto del string byte a byte (CA-07/CA-19) y
    // es inerte como munición de escape de atributo — a diferencia del `'`
    // crudo, no puede cerrar un atributo `href='...'` entrecomillado con
    // comilla simple.
    return trimmed.replace(/'/g, '%27');
  } catch {
    return null;
  }
}

/**
 * Conveniencia de UI: agrega https:// o mailto: si falta.
 * Devuelve null si no hay forma de validarlo.
 */
export function normalizeUserLinkInput(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const direct = normalizeHref(trimmed);
  if (direct) return direct;

  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return normalizeHref(`mailto:${trimmed}`);
  }

  if (!/\s/.test(trimmed) && trimmed.includes('.')) {
    return normalizeHref(`https://${trimmed}`);
  }

  return null;
}
