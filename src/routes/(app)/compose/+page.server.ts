import { fail, error, redirect } from '@sveltejs/kit';
void redirect;
import type { Actions, PageServerLoad } from './$types';
import { getSessionPassword } from '$lib/server/auth';
import { sendMail } from '$lib/server/smtp';
import { fetchMessage, appendToDrafts, deleteMessage, type ImapCreds } from '$lib/server/imap';
import { rateLimitByKey } from '$lib/server/rate-limit';
import { buildMime, type AttachmentBytes } from '$lib/email';
import { escapeHtml } from '$lib/compose-html';
import { safeSanitizeComposedEmailHtml } from '$lib/sanitize';
import {
  guardComposedHtml,
  COMPOSED_HTML_GUARD_STATUS,
  COMPOSED_HTML_GUARD_MESSAGES,
} from '$lib/server/compose-html-guard';
import { validateRecipientFields } from '$lib/recipient-validation';

const MAX_SIZE = 10 * 1024 * 1024;

export const load: PageServerLoad = async ({ locals, url }) => {
  const sid = locals.sessionId;
  const password = sid ? await getSessionPassword(sid) : null;
  if (!locals.user || !password) throw error(401, 'No autorizado');
  const replyUidParam = url.searchParams.get('reply');
  const forwardUidParam = url.searchParams.get('forward');
  const draftUidParam = url.searchParams.get('draft');
  const mailbox = url.searchParams.get('mailbox') ?? 'INBOX';
  const creds: ImapCreds = { user: locals.user.email, pass: password };

  let prefill: {
    to?: string;
    subject?: string;
    cc?: string;
    bcc?: string;
    body?: string;
    text?: string;
    html?: string;
    forwardedFrom?: string;
    isDraft?: boolean;
  } = {};

  let draftUid: number | null = null;
  let draftMailbox: string | null = null;

  if (replyUidParam) {
    const replyUid = Number(replyUidParam);
    const original = await fetchMessage(creds, mailbox, replyUid).catch(() => null);
    if (original) {
      const ts = original.date.toLocaleString('es-EC');
      prefill = {
        to: original.from,
        subject: original.subject.startsWith('Re:') ? original.subject : `Re: ${original.subject}`,
        body: `\n\n---------- Mensaje original ----------\nDe: ${original.from}\nPara: ${original.to}\nFecha: ${ts}\nAsunto: ${original.subject}\n\n${original.text.split('\n').map((l) => `> ${l}`).join('\n')}`
      };
    }
  } else if (forwardUidParam) {
    const fwdUid = Number(forwardUidParam);
    const original = await fetchMessage(creds, mailbox, fwdUid).catch(() => null);
    if (original) {
      const safeOriginalHtml = original.html
        ? (() => {
            const guard = guardComposedHtml(original.html!);
            if (!guard.ok) return '';
            const sanitized = safeSanitizeComposedEmailHtml(original.html!);
            return sanitized.ok ? sanitized.html : '';
          })()
        : '';
      const forwardHeader = `<div>---------- Mensaje reenviado ----------<br>De: ${escapeHtml(original.from)}<br>Para: ${escapeHtml(original.to)}<br>Asunto: ${escapeHtml(original.subject)}</div>`;
      prefill = {
        to: '',
        subject: original.subject.startsWith('Fwd:') ? original.subject : `Fwd: ${original.subject}`,
        body: `\n\n---------- Mensaje reenviado ----------\nDe: ${original.from}\nPara: ${original.to}\nAsunto: ${original.subject}\n\n${original.text}`,
        html: safeOriginalHtml ? `${forwardHeader}${safeOriginalHtml}` : undefined,
        forwardedFrom: original.from
      };
    }
  } else if (draftUidParam) {
    const dUid = Number(draftUidParam);
    const original = await fetchMessage(creds, mailbox, dUid).catch(() => null);
    if (original) {
      prefill = {
        to: original.to || '',
        cc: original.cc || '',
        bcc: original.bcc || '',
        subject: original.subject || '',
        text: original.text || '',
        html: original.html ?? undefined,
        isDraft: true
      };
      draftUid = dUid;
      draftMailbox = mailbox;
    }
  }

  return { user: locals.user, prefill, draftUid, draftMailbox };
};

export const actions: Actions = {
  send: async ({ locals, request, getClientAddress }) => {
    const sid = locals.sessionId;
    const password = sid ? await getSessionPassword(sid) : null;
    if (!locals.user || !password) throw error(401, 'No autorizado');

    try {
      rateLimitByKey('send', `${getClientAddress()}:${locals.user.email}`, { max: 30, windowS: 60 });
    } catch {
      return fail(429, { error: 'Límite de envíos alcanzado (30/min)' });
    }

    const form = await request.formData();
    const to = String(form.get('to') ?? '').trim();
    const subject = String(form.get('subject') ?? '').trim();
    const text = String(form.get('text') ?? '').trim();
    const cc = String(form.get('cc') ?? '').trim() || undefined;
    const bcc = String(form.get('bcc') ?? '').trim() || undefined;
    const rawHtml = String(form.get('html') ?? '').trim();
    const recipientError = validateRecipientFields({ to, cc, bcc });
    if (recipientError) return fail(400, { error: recipientError, to, subject, text });
    if (rawHtml) {
      const guard = guardComposedHtml(rawHtml);
      if (!guard.ok) return fail(COMPOSED_HTML_GUARD_STATUS[guard.reason!], { error: COMPOSED_HTML_GUARD_MESSAGES[guard.reason!] });
    }
    let html: string | undefined;
    if (rawHtml) {
      const sanitized = safeSanitizeComposedEmailHtml(rawHtml);
      if (!sanitized.ok) return fail(400, { error: 'No se pudo procesar el contenido HTML' });
      html = sanitized.html.trim() || undefined;
    }
    if (!to || !subject || !text) return fail(400, { error: 'Faltan campos', to, subject, text });
    if (to.length > 1024 || subject.length > 200) return fail(400, { error: 'Campos demasiado largos' });
    const crlfField = [
      ['El asunto contiene caracteres no permitidos', subject],
      ['El destinatario contiene caracteres no permitidos', to],
      ['El campo Cc contiene caracteres no permitidos', cc],
      ['El campo Cco contiene caracteres no permitidos', bcc],
    ].find(([, value]) => value?.includes('\r') || value?.includes('\n'));
    if (crlfField) return fail(400, { error: crlfField[0] });
    const attachments: AttachmentBytes[] = [];
    const files = form.getAll('attachment') as File[];
    const draftUidRaw = form.get('draftUid');
    const draftMailboxRaw = form.get('draftMailbox');
    for (const file of files) {
      if (!file || file.size === 0) continue;
      if (file.size > MAX_SIZE) return fail(413, { error: `Adjunto ${file.name} demasiado grande (máx 10 MB)` });
      const content = Buffer.from(await file.arrayBuffer());
      attachments.push({ filename: file.name, contentType: file.type || 'application/octet-stream', content });
    }

    try {
      await sendMail({ user: locals.user.email, pass: password }, locals.user.email, { to, subject, text, html, cc, bcc, attachments });
      if (draftUidRaw && draftMailboxRaw) {
        await deleteMessage({ user: locals.user.email, pass: password }, String(draftMailboxRaw), Number(draftUidRaw)).catch(() => {});
      }
      return { ok: true };
    } catch (e) {
      console.error('send fail', (e as Error).message);
      return fail(500, { error: 'No se pudo enviar el correo. Intentá de nuevo.' });
    }
  },

  draft: async ({ locals, request }) => {
    const sid = locals.sessionId;
    const password = sid ? await getSessionPassword(sid) : null;
    if (!locals.user || !password) throw error(401, 'No autorizado');
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return fail(400, { error: 'El cuerpo del borrador no es válido.' });
    }
    const to = String(form.get('to') ?? '').trim();
    const subject = String(form.get('subject') ?? '').trim();
    const text = String(form.get('text') ?? '').trim();
    const cc = String(form.get('cc') ?? '').trim() || undefined;
    const bcc = String(form.get('bcc') ?? '').trim() || undefined;
    const rawHtml = String(form.get('html') ?? '').trim();
    if (rawHtml) {
      const guard = guardComposedHtml(rawHtml);
      if (!guard.ok)
        return fail(COMPOSED_HTML_GUARD_STATUS[guard.reason!], {
          error: COMPOSED_HTML_GUARD_MESSAGES[guard.reason!],
        });
    }
    const recipientError = validateRecipientFields({ to, cc, bcc });
    if (recipientError) return fail(400, { error: recipientError, to, subject, text });
    let html: string | undefined;
    if (rawHtml) {
      const sanitized = safeSanitizeComposedEmailHtml(rawHtml);
      if (!sanitized.ok) return fail(400, { error: 'No se pudo procesar el contenido HTML' });
      html = sanitized.html.trim() || undefined;
    }
    if (!to && !cc && !bcc && !subject && !text && !html) return { ok: false, error: 'Borrador vacío' };
    let raw: string;
    try {
      raw = buildMime(locals.user.email, { to: to || '(sin destinatario)', cc, bcc, subject: subject || '(sin asunto)', text: text || '(sin contenido)', html });
    } catch {
      return fail(400, { error: 'Los datos del borrador no son válidos.' });
    }
    try {
      await appendToDrafts({ user: locals.user.email, pass: password }, raw);
      return { ok: true };
    } catch (e) {
      return fail(500, { error: 'No se pudo guardar el borrador.' });
    }
  }
};

export const _load_redirect = () => {
  throw redirect(303, '/inbox');
};
