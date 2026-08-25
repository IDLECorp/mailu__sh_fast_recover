// Firma por defecto del compositor de correo (Fase 2).
//
// Responsabilidad (diseño §2.4, §7): derivar el nombre visible, generar el
// bloque HTML de firma y su equivalente en texto plano, detectar si un HTML
// ya contiene una firma nuestra, y quitarla. Puro salvo `removeSignatureFromHtml`,
// que necesita un DOM y por eso está marcada como browser-only.
//
// `buildSignatureHtml` construye el `style` con `serializeComposedStyle()`
// (nunca strings a mano), así que todos los valores caen dentro de los
// conjuntos cerrados de `compose-format.ts` y la firma sobrevive
// `sanitizeComposedEmailHtml()` sin perder nada (diseño §7.2, §7.4).

import { serializeComposedStyle, type ComposedStyle } from './compose-format';
import { escapeHtml } from './compose-html';

export interface SignatureIdentity {
  readonly email: string;
  readonly domain: string;
}

export interface SignatureParts {
  readonly html: string;
  readonly text: string;
}

/**
 * Local-part → nombre, title-case POR PALABRA.
 *
 * Contradicción interna del spec resuelta aquí (C4, diseño §14.1): RF-20a
 * pide "la misma normalización ya usada en `+layout.svelte:30-33`" (que
 * capitaliza solo la primera letra del string completo → "Juan perez"), pero
 * CA-21 exige el nombre "titlecased". Se elige title-case por palabra
 * (`Juan Perez`) porque satisface el criterio de aceptación verificable y
 * porque "Juan perez" se lee como un defecto en una firma de correo.
 * `(app)/+layout.svelte` NO se modifica (fuera de alcance): quedan dos
 * derivaciones distintas conviviendo a propósito; deuda menor anotada.
 */
export function deriveDisplayName(email: string): string {
  const local = (email.split('@')[0] ?? '').trim();
  return local
    .replace(/[._-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ─── Estilos del envoltorio y de los hijos (diseño §7.2) ───────────────────
// Todos los hex vienen de la tabla "Tokens de marca convertidos a sRGB" de
// `state.md`, NO recalculados. La familia de marca de `FONT_FAMILIES`
// (`Montserrat Variable, Montserrat, Arial, Helvetica, sans-serif`, diseño
// §12.6) es una ampliación deliberada del conjunto cerrado para que la firma
// de marca no pierda su tipografía al pasar por el sanitizador. El nombre
// registrado por @fontsource-variable va primero para que el preview del
// compositor muestre la marca real.

const WRAPPER_STYLE: ComposedStyle = {
  fontFamily: 'Montserrat Variable, Montserrat, Arial, Helvetica, sans-serif',
  fontSize: '12px',
  color: '#4b6b62', // --muted-foreground
  marginLeft: '0px',
};

const NAME_STYLE: ComposedStyle = {
  fontSize: '14px',
  fontWeight: 'bold',
  color: '#007fc5', // shfast --primary (oklch(0.55 0.18 230)) converted to sRGB
};

const DOMAIN_STYLE: ComposedStyle = {
  color: '#008d9c', // --ring
};

/**
 * Huella re-derivable (diseño §7.4): el `style` canónico del envoltorio,
 * generado con el MISMO serializador que usa `sanitizeComposedEmailHtml()`
 * para reconstruir `style`. Por eso sobrevive una vuelta completa por el
 * servidor byte a byte, no "por suerte".
 */
export const SIGNATURE_WRAPPER_STYLE = serializeComposedStyle(WRAPPER_STYLE);

/**
 * Bloque HTML de firma, ya escapado y con `style` canónico (diseño §7.2).
 * Un único `<div>` envoltorio con hijos `<div>` por línea. Sin variables CSS,
 * sin `oklch()`, sin imágenes remotas, sin degradados, sin `@font-face`
 * obligatorio — solo estilos inline con hex literales.
 *
 * Escapado obligatorio: aunque el servidor re-sanitiza, en el CLIENTE este
 * HTML entra al `contenteditable` vía asignación de `innerHTML` — un sink de
 * XSS activo en la página del webmail. El escapado aquí no es redundante.
 */
export function buildSignatureHtml(identity: SignatureIdentity): string {
  const name = escapeHtml(deriveDisplayName(identity.email));
  const email = escapeHtml(identity.email);
  const domain = escapeHtml(identity.domain);

  return (
    `<div style="${SIGNATURE_WRAPPER_STYLE}">` +
    `<div>&nbsp;</div>` +
    `<div>--&nbsp;</div>` +
    `<div style="${serializeComposedStyle(NAME_STYLE)}">${name}</div>` +
    `<div>${email}</div>` +
    `<div style="${serializeComposedStyle(DOMAIN_STYLE)}">${domain}</div>` +
    `</div>`
  );
}

/**
 * Equivalente text/plain (RF-25, diseño §7.3). En la práctica casi nunca se
 * usa para enviar: como la firma se inserta en el DOM del editor, `text` sale
 * de `editor.innerText`, que ya contiene estas mismas líneas. Queda exportada
 * para (a) QA manual, (b) el escenario hipotético de firma server-side, que
 * este diseño no implementa.
 */
export function buildSignatureText(identity: SignatureIdentity): string {
  return `\n-- \n${deriveDisplayName(identity.email)}\n${identity.email}\n${identity.domain}`;
}

export function buildSignature(identity: SignatureIdentity): SignatureParts {
  return { html: buildSignatureHtml(identity), text: buildSignatureText(identity) };
}

/** ¿Este HTML ya trae una firma nuestra? (idempotencia, capa 1 de diseño §7.4) */
export function containsSignature(html: string): boolean {
  return html.includes(`style="${SIGNATURE_WRAPPER_STYLE}"`);
}

/**
 * Browser-only: quita el bloque de firma de un string de HTML usando un
 * `<div>` desconectado (nunca se adjunta al documento). No-op si no encuentra
 * el envoltorio — degradación segura si el usuario editó la firma a mano
 * (diseño §7.5): nunca borra contenido que no reconoce como suyo.
 */
export function removeSignatureFromHtml(html: string): string {
  if (typeof document === 'undefined') return html;
  const container = document.createElement('div');
  container.innerHTML = html;
  const wrapper = container.querySelector(`div[style="${SIGNATURE_WRAPPER_STYLE}"]`);
  if (!wrapper) return html;
  wrapper.remove();
  return container.innerHTML;
}
