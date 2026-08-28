import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSessionPassword } from '$lib/server/auth';
import { appendToDrafts } from '$lib/server/imap';
import { buildMime } from '$lib/email';
import { safeSanitizeComposedEmailHtml } from '$lib/sanitize';
import { rateLimitByKey } from '$lib/server/rate-limit';
import {
  guardComposedHtml,
  COMPOSED_HTML_GUARD_STATUS,
  COMPOSED_HTML_GUARD_MESSAGES,
} from '$lib/server/compose-html-guard';
import { validateRecipientFields } from '$lib/recipient-validation';
import { parseDraftRequest } from '$lib/server/draft-request';

// SEC: con @sveltejs/adapter-node el limite REAL de cuerpo lo impone la env
// El limite de cuerpo efectivo en produccion es BODY_SIZE_LIMIT (12M en INFRA),
// no un export por ruta (SvelteKit 2 no lo soporta). Se mantiene alineado con
// /api/compose/send para no romper el autosave de borradores con adjuntos grandes.

export const POST: RequestHandler = async ({ locals, request, getClientAddress }) => {
  const sid = locals.sessionId;
  const password = sid ? await getSessionPassword(sid) : null;
  if (!locals.user || !password)
    return json({ ok: false, error: 'No autorizado' }, { status: 401 });

  // SEC-004: el autosave de borradores dispara con mucha más frecuencia que
  // un envío deliberado (varias veces por minuto mientras el usuario
  // escribe), así que reusar el presupuesto de `send` (30/min) rompería el
  // uso normal. 60/min por identidad (IP:usuario) sigue siendo un límite
  // real — acota el costo de sanitización en el peor caso a ~60 llamadas/min
  // por usuario — sin interferir con el autosave típico (debounce de varios
  // segundos entre guardados).
  try {
    rateLimitByKey('draft', `${getClientAddress()}:${locals.user.email}`, {
      max: 60,
      windowS: 60,
    });
  } catch {
    return json({ ok: false, error: 'Demasiados guardados de borrador (60/min)' }, { status: 429 });
  }

  const payload = await parseDraftRequest(request);
  if (!payload) return json({ ok: false, error: 'El cuerpo del borrador no es válido.' }, { status: 400 });

  const { to, cc, bcc, subject, text } = payload;
  const rawHtml = payload.html;
  const recipientError = validateRecipientFields({ to, cc, bcc });
  if (recipientError) return json({ ok: false, error: recipientError }, { status: 400 });
  if (rawHtml) {
    // SEC-012: tamaño Y estructura, antes de sanitizar.
    const guard = guardComposedHtml(rawHtml);
    if (!guard.ok) {
      return json(
        { ok: false, error: COMPOSED_HTML_GUARD_MESSAGES[guard.reason!] },
        { status: COMPOSED_HTML_GUARD_STATUS[guard.reason!] },
      );
    }
  }
  if (!to && !cc && !bcc && !subject && !text && !rawHtml)
    return json({ ok: false, error: 'Borrador vacío' });
  let html: string | undefined;
  if (rawHtml) {
    const sanitized = safeSanitizeComposedEmailHtml(rawHtml);
    if (!sanitized.ok)
      return json({ ok: false, error: 'No se pudo procesar el contenido HTML' }, { status: 400 });
    html = sanitized.html.trim() || undefined;
  }

  let raw: string;
  try {
    raw = buildMime(locals.user.email, {
      to,
      cc: cc || undefined,
      bcc: bcc || undefined,
      subject: subject || '(sin asunto)',
      text: text || '(sin contenido)',
      html,
    });
  } catch {
    return json({ ok: false, error: 'Los datos del borrador no son válidos.' }, { status: 400 });
  }

  try {
    await appendToDrafts({ user: locals.user.email, pass: password }, raw);
    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
};
