import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSessionPassword } from '$lib/server/auth';
import { sendMail, sanitizeAttachmentName, SmtpRejectedError } from '$lib/server/smtp';
import { rateLimitByKey } from '$lib/server/rate-limit';
import type { AttachmentBytes } from '$lib/email';
import { safeSanitizeComposedEmailHtml } from '$lib/sanitize';
import {
  guardComposedHtml,
  COMPOSED_HTML_GUARD_STATUS,
  COMPOSED_HTML_GUARD_MESSAGES,
} from '$lib/server/compose-html-guard';

const MAX_SIZE = 10 * 1024 * 1024;
// SEC: limite de adjunto de la app (10 MB). El cuerpo solo llega a este
// chequeo si el server lo deja pasar. Con @sveltejs/adapter-node, el limite
// REAL de tamaño de cuerpo lo impone la env BODY_SIZE_LIMIT: el server de
// Node la lee en build/index.js -> get_raw_body y aborta el stream si se
// excede. Si BODY_SIZE_LIMIT < MAX_SIZE, el server corta la conexion mientras
// el cliente todavia esta subiendo y el cliente recibe "Connection reset by
// peer" (RST) en vez de un 413 limpio. Por eso BODY_SIZE_LIMIT debe ser
// >= MAX_SIZE + overhead del multipart; en INFRA se configura como 12M
// (docker-compose.prod.yml). En produccion con adapter-node el valor efectivo
// es BODY_SIZE_LIMIT (no existe bodySizeLimit por ruta en SvelteKit 2).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PRIORITIES = new Set(['low', 'normal', 'high']);
const CRLF_RE = /[\r\n]/;

function parseRecipients(value: string): string[] {
  return value
    .split(/[;,]/)
    .map((email) => email.trim())
    .filter(Boolean);
}

function validateRecipients(label: string, value: string): string | null {
  const invalid = parseRecipients(value).find((email) => !EMAIL_RE.test(email));
  return invalid ? `${label} contiene un correo inválido: ${invalid}` : null;
}

export const POST: RequestHandler = async ({ locals, request, getClientAddress }) => {
  const sid = locals.sessionId;
  const password = sid ? await getSessionPassword(sid) : null;
  if (!locals.user || !password)
    return json({ ok: false, error: 'No autorizado' }, { status: 401 });

  try {
    rateLimitByKey('send', `${getClientAddress()}:${locals.user.email}`, { max: 30, windowS: 60 });
  } catch {
    return json({ ok: false, error: 'Límite de envíos alcanzado (30/min)' }, { status: 429 });
  }

  const form = await request.formData();
  const to = String(form.get('to') ?? '').trim();
  const subject = String(form.get('subject') ?? '').trim();
  const text = String(form.get('text') ?? '').trim();
  const rawHtml = String(form.get('html') ?? '').trim();
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
  let html: string | undefined;
  if (rawHtml) {
    const sanitized = safeSanitizeComposedEmailHtml(rawHtml);
    if (!sanitized.ok)
      return json({ ok: false, error: 'No se pudo procesar el contenido HTML' }, { status: 400 });
    html = sanitized.html.trim() || undefined;
  }
  const cc = String(form.get('cc') ?? '').trim() || undefined;
  const bcc = String(form.get('bcc') ?? '').trim() || undefined;
  const priorityRaw = String(form.get('priority') ?? 'normal').trim();
  const priority = PRIORITIES.has(priorityRaw)
    ? (priorityRaw as 'low' | 'normal' | 'high')
    : 'normal';
  // Bug 6: cualquier valor distinto de low/normal/high ya cae a 'normal'
  // (sin crashear). Validado arriba.

  // Bug 1: inyección de cabeceras / CRLF. Nodemailer lanza "Invalid header
  // value" si subject o destinatarios traen \r\n; lo bloqueamos antes de enviar.
  const crlfError =
    (subject && CRLF_RE.test(subject) ? 'El asunto contiene caracteres no permitidos' : null) ??
    (to && CRLF_RE.test(to) ? 'El destinatario contiene caracteres no permitidos' : null) ??
    (cc && CRLF_RE.test(cc) ? 'El campo Cc contiene caracteres no permitidos' : null) ??
    (bcc && CRLF_RE.test(bcc) ? 'El campo Cco contiene caracteres no permitidos' : null);
  if (crlfError) return json({ ok: false, error: crlfError }, { status: 400 });

  if (!to || !subject || !text) return json({ ok: false, error: 'Faltan campos' }, { status: 400 });
  if (to.length > 1024 || subject.length > 200)
    return json({ ok: false, error: 'Campos demasiado largos' }, { status: 400 });
  const recipientError =
    validateRecipients('Para', to) ??
    validateRecipients('Cc', cc ?? '') ??
    validateRecipients('Cco', bcc ?? '');
  if (recipientError) return json({ ok: false, error: recipientError }, { status: 400 });

  const attachments: AttachmentBytes[] = [];
  const files = form.getAll('attachment') as File[];
  for (const file of files) {
    if (!file) continue; // archivos nulos no aportan nada
    const cleanName = sanitizeAttachmentName(file.name);
    if (file.size > MAX_SIZE)
      return json(
        { ok: false, error: `Adjunto ${cleanName} demasiado grande (máx 10 MB)` },
        { status: 413 },
      );
    // Bug 5: un adjunto de 0 bytes se envía igual (no se pierde en silencio).
    // Bug 4: saneamos el nombre (basename, sin /, \ ni ..) antes de usarlo.
    const content = Buffer.from(await file.arrayBuffer());
    attachments.push({
      filename: cleanName,
      contentType: file.type || 'application/octet-stream',
      content,
    });
  }

  try {
    await sendMail({ user: locals.user.email, pass: password }, locals.user.email, {
      to,
      subject,
      text,
      html,
      cc,
      bcc,
      priority,
      attachments,
    });
    return json({ ok: true });
  } catch (e) {
    // Bug 3: si el SMTP rechazó el adjunto por extensión prohibida, devolvemos
    // 400 limpio en español. En cualquier error NUNCA devolvemos ok:true.
    if (e instanceof SmtpRejectedError) {
      return json({ ok: false, error: e.message }, { status: e.status });
    }
    return json(
      { ok: false, error: `No se pudo enviar: ${(e as Error).message}` },
      { status: 500 },
    );
  }
};
