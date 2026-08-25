// Normalizador de DOM compartido para el compositor de correo enriquecido.
//
// Dado un `Element` raíz (el `contenteditable` en el cliente, o el `<body>`
// que devuelve DOMPurify en el servidor), deja su subárbol dentro del
// contrato de `compose-format.ts`. Es DOM puro y funciona igual en el
// navegador y en jsdom. Ver diseño §2.2, §3.2, §4.3.
//
// Requisito no negociable: `normalizeComposedDom` debe ser IDEMPOTENTE.
// normalize(normalize(x)) === normalize(x). De esto dependen (a) la
// convergencia del `$effect` del editor, (b) CA-19, y (c) que el servidor
// no altere lo que el cliente ya normalizó. [R1 — riesgo alto]
//
// [R3 — riesgo alto] SSR-safe: toda creación de nodos usa
// `root.ownerDocument!.createElement(...)`, NUNCA `document.createElement`
// a secas — bare `document` no existe en Node y solo rompe en producción.

import {
  ATTRS_BY_TAG,
  COMPOSED_EMAIL_TAGS,
  LEGACY_TAGS_TO_CONVERT,
  normalizeHref,
  parseStyleAttribute,
  serializeComposedStyle,
  type ComposedTag,
} from './compose-format';

export interface NormalizeOptions {
  /** true solo en el cliente: convierte <font>/<strike> y spans de decoración. */
  convertLegacyTags?: boolean;
}

const ALLOWED_TAG_SET = new Set<string>(COMPOSED_EMAIL_TAGS as readonly string[]);

export function escapeHtml(value: string): string {
  // SEC-010 (05-security.md): también escapar `'` y el backtick. Hoy ningún
  // sink que usa `escapeHtml` interpola dentro de un atributo entre comillas
  // simples, así que no era explotable — pero la función se documenta como
  // guarda de un sink `innerHTML`, y si algún consumidor futuro la reutiliza
  // en ese contexto debe seguir siendo segura sin que nadie tenga que
  // recordarlo.
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
    .replaceAll('`', '&#96;');
}

export function hasMeaningfulText(value: string): boolean {
  return value.replace(/[​ ]/g, ' ').trim().length > 0;
}

/** Movida verbatim desde RichTextEditor.svelte:29-47. */
export function plainTextToHtml(value: string): string {
  if (!hasMeaningfulText(value)) return '';
  const escaped = escapeHtml(value);
  return escaped
    .split('\n')
    .map((line) => {
      const preservedSpaces = line.replace(/ +/g, (spaces, index) => {
        const isSingleInterWordSpace =
          spaces.length === 1 && index > 0 && index + spaces.length < line.length;
        return isSingleInterWordSpace ? spaces : '&nbsp;'.repeat(spaces.length);
      });
      return `<div>${preservedSpaces || '<br>'}</div>`;
    })
    .join('');
}

/** Elimina todos los nodos de comentario dentro de `root` (inclusive de sí mismo, si lo fuera). */
function removeComments(root: Element): void {
  // Recorrido manual en vez de `createTreeWalker(root, NodeFilter.SHOW_COMMENT)`:
  // `NodeFilter` es un global de `window` que no existe en el contexto donde
  // corre DOMPurify en el servidor (el body devuelto por `RETURN_DOM` no
  // adjunta sus globals de `window` al `global` de Node). Comment.COMMENT_NODE
  // (nodeType 8) es un valor estable del DOM sin depender de ningún global.
  const COMMENT_NODE = 8;
  const comments: ChildNode[] = [];

  const collect = (node: Node): void => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === COMMENT_NODE) comments.push(child);
      else if (child.nodeType === 1) collect(child);
    }
  };
  collect(root);

  for (const comment of comments) comment.remove();
}

/** Reemplaza `old` por un nuevo elemento `tagName`, moviendo (no recreando) los hijos. */
function replaceElementPreservingChildren(old: Element, tagName: string, style?: string): Element {
  const doc = old.ownerDocument!;
  const next = doc.createElement(tagName);
  if (style) next.setAttribute('style', style);
  while (old.firstChild) next.appendChild(old.firstChild);
  old.replaceWith(next);
  return next;
}

/** Quita `el` del árbol, dejando sus hijos en su lugar (conserva el texto). */
function unwrap(el: Element): void {
  const parent = el.parentNode;
  if (!parent) return;
  while (el.firstChild) parent.insertBefore(el.firstChild, el);
  parent.removeChild(el);
}

/**
 * Paso 2a: <font> → <span> con `style` reconstruido desde color/face/size.
 * `size="7"` es el centinela del motor de fontSize (§4.2.1): ese caso se
 * reescribe directamente a `<span style="font-size: ...">` por el propio
 * comando `dispatch({kind:'fontSize'})` antes de que este paso se ejecute
 * sobre contenido "en vivo"; aquí solo puede llegar vía contenido pegado o
 * ya persistido, y sin un valor de tamaño en `FONT_SIZES` no hay forma
 * confiable de traducir `size="7"` — se descarta, como cualquier otro size.
 */
function convertFontTag(el: Element): void {
  const color = el.getAttribute('color');
  const face = el.getAttribute('face');

  const declarations: string[] = [];
  if (color) {
    const normalized = parseStyleAttribute(`color: ${color}`);
    if (normalized.color) declarations.push(`color: ${normalized.color}`);
  }
  if (face) {
    const normalized = parseStyleAttribute(`font-family: ${face}`);
    if (normalized.fontFamily) declarations.push(`font-family: ${normalized.fontFamily}`);
  }

  const style = declarations.join('; ');
  if (!style) {
    unwrap(el);
    return;
  }

  replaceElementPreservingChildren(el, 'span', style);
}

/** Paso 2c: <span style="text-decoration: ..."> con única declaración → <u>/<s>. */
function convertDecorationSpan(el: Element): void {
  const raw = el.getAttribute('style');
  if (!raw) return;
  const declarations = raw
    .split(';')
    .map((d) => d.trim())
    .filter(Boolean);
  if (declarations.length !== 1) return;

  const parsed = parseStyleAttribute(raw);
  if (parsed.textDecoration === 'underline' && Object.keys(parsed).length === 1) {
    replaceElementPreservingChildren(el, 'u');
  } else if (parsed.textDecoration === 'line-through' && Object.keys(parsed).length === 1) {
    replaceElementPreservingChildren(el, 's');
  }
}

/** Paso 2: conversión de etiquetas heredadas (solo cliente). */
function convertLegacyTagsStep(root: Element): void {
  let fontEl = root.querySelector('font');
  while (fontEl) {
    convertFontTag(fontEl);
    fontEl = root.querySelector('font');
  }

  let strikeEl = root.querySelector('strike');
  while (strikeEl) {
    replaceElementPreservingChildren(strikeEl, 's');
    strikeEl = root.querySelector('strike');
  }

  const spans = Array.from(root.querySelectorAll('span'));
  for (const span of spans) {
    convertDecorationSpan(span);
  }
}

/** Paso 3: etiquetas fuera del allow-list → unwrap conservando hijos. */
function stripDisallowedTags(root: Element): void {
  // Recorremos de adentro hacia afuera para no perder referencias al mutar.
  const all = Array.from(root.querySelectorAll('*'));
  for (let i = all.length - 1; i >= 0; i--) {
    const el = all[i];
    const tag = el.tagName.toLowerCase();
    if (!ALLOWED_TAG_SET.has(tag)) unwrap(el);
  }
}

/** Paso 4: atributos permitidos por etiqueta. */
function stripDisallowedAttributes(root: Element): void {
  const all = root.querySelectorAll('*');
  for (const el of Array.from(all)) {
    const tag = el.tagName.toLowerCase() as ComposedTag;
    const allowed = ATTRS_BY_TAG[tag] ?? ATTRS_BY_TAG['*'];
    // [R4] Iterar sobre una COPIA de getAttributeNames(): mutar la colección
    // viva mientras se recorre salta atributos.
    const names = [...el.getAttributeNames()];
    for (const name of names) {
      if (!allowed.includes(name)) el.removeAttribute(name);
    }
  }
}

/** Paso 5: reconstruir `style` desde valores validados. */
function rebuildStyles(root: Element): void {
  const all = root.querySelectorAll('*');
  for (const el of Array.from(all)) {
    const raw = el.getAttribute('style');
    const parsed = parseStyleAttribute(raw);
    const rebuilt = serializeComposedStyle(parsed);
    if (!rebuilt) {
      if (el.hasAttribute('style')) el.removeAttribute('style');
      continue;
    }
    if (raw !== rebuilt) el.setAttribute('style', rebuilt);
  }
}

/** Paso 6: reglas de `<a>` — href válido o unwrap. */
function fixAnchors(root: Element): void {
  const anchors = root.querySelectorAll('a');
  for (const a of Array.from(anchors)) {
    const href = normalizeHref(a.getAttribute('href'));
    if (href === null) {
      unwrap(a);
      continue;
    }
    a.setAttribute('href', href);
    // SEC-009 (05-security.md): quitar `target`/`rel` antes de volver a
    // fijarlos. `setAttribute` conserva la posición de un atributo YA
    // presente y añade uno nuevo al final; combinado con el reordenamiento
    // que hace DOMPurify al re-añadir atributos, el orden emitido variaba
    // según el HTML de entrada (32/46 permutaciones probadas violaban CA-19).
    // Forzar remove+set garantiza que el orden emitido sea siempre
    // `href, target, rel`, restaurando sanitize(sanitize(x)) === sanitize(x).
    a.removeAttribute('target');
    a.removeAttribute('rel');
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener noreferrer');
  }
}

/** Paso 7: aplanar <a> anidados, dejando el más externo. */
function flattenNestedAnchors(root: Element): void {
  const anchors = Array.from(root.querySelectorAll('a a'));
  for (const inner of anchors) {
    unwrap(inner);
  }
}

/**
 * Deja el subárbol de `root` dentro del contrato de compose-format.
 * Muta en el lugar. DEBE ser idempotente.
 * Devuelve true si modificó algo (usado para no tocar el DOM cuando no hace falta).
 */
export function normalizeComposedDom(root: Element, opts?: NormalizeOptions): boolean {
  const before = root.innerHTML;

  removeComments(root);
  if (opts?.convertLegacyTags) convertLegacyTagsStep(root);
  stripDisallowedTags(root);
  stripDisallowedAttributes(root);
  rebuildStyles(root);
  fixAnchors(root);
  flattenNestedAnchors(root);

  return root.innerHTML !== before;
}
