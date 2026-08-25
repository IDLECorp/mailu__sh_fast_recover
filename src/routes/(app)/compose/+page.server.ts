import { fail, error, redirect } from '@sveltejs/kit';
void redirect;
import type { Actions, PageServerLoad } from './$types';
import { getSessionPassword } from '$lib/server/auth';
import { sendMail } from '$lib/server/smtp';
import { fetchMessage, appendToDrafts, type ImapCreds } from '$lib/server/imap';
import { rateLimitByKey } from '$lib/server/rate-limit';
import { buildMime, type AttachmentBytes } from '$lib/email';
import { safeSanitizeComposedEmailHtml } from '$lib/sanitize';
import {
  guardComposedHtml,
  COMPOSED_HTML_GUARD_STATUS,
  COMPOSED_HTML_GUARD_MESSAGES,
} from '$lib/server/compose-html-guard';

const MAX_SIZE = 10 * 1024 * 1024;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PRIORITIES = new Set(['low', 'normal', 'high']);

function parseRecipients(value: string): string[] {
  return value
    .split(/[;,]/)
    .map((email) => email.trim())
    .filter(Boolean);
}

function validateRecipients(label: string, value: string): string | null {
  const recipients = parseRecipients(value);
  const invalid = recipients.find((email) => !EMAIL_RE.test(email));
  return invalid ? `${label} contiene un correo inválido: ${invalid}` : null;
}

export const load: PageServerLoad = async ({ locals, url }) => {
  const sid = locals.sessionId;
  const password = sid ? await getSessionPassword(sid) : null;
  if (!locals.user || !password) throw error(401, 'No autorizado');
  const replyUidParam = url.searchParams.get('reply');
  const forwardUidParam = url.searchParams.get('forward');
  const mailbox = url.searchParams.get('mailbox') ?? 'INBOX';
  const creds: ImapCreds = { user: locals.user.email, pass: password };

  let prefill: {
    to?: string;
    subject?: string;
    cc?: string;
    body?: string;
    forwardedFrom?: string;
  } = {};

  if (replyUidParam) {
    const replyUid = Number(replyUidParam);
    const original = await fetchMessage(creds, mailbox, replyUid).catch(() => null);
    if (original) {
      const ts = original.date.toLocaleString('es-EC');
      prefill = {
        to: original.from,
        subject: original.subject.startsWith('Re:') ? original.subject : `Re: ${original.subject}`,
        body: `\n\n---------- Mensaje original ----------\nDe: ${original.from}\nPara: ${original.to}\nFecha: ${ts}\nAsunto: ${original.subject}\n\n${original.text
          .split('\n')
          .map((l) => `> ${l}`)
          .join('\n')}`,
      };
    }
  } else if (forwardUidParam) {
    const fwdUid = Number(forwardUidParam);
    const original = await fetchMessage(creds, mailbox, fwdUid).catch(() => null);
    if (original) {
      prefill = {
        to: '',
        subject: original.subject.startsWith('Fwd:')
          ? original.subject
          : `Fwd: ${original.subject}`,
        body: `\n\n---------- Mensaje reenviado ----------\nDe: ${original.from}\nPara: ${original.to}\nAsunto: ${original.subject}\n\n${original.text}`,
        forwardedFrom: original.from,
      };
    }
  }

  return { user: locals.user, prefill };
};

export const actions: Actions = {
  send: async ({ locals, request, getClientAddress }) => {
    const sid = locals.sessionId;
    const password = sid ? await getSessionPassword(sid) : null;
    if (!locals.user || !password) throw error(401, 'No autorizado');

    try {
      rateLimitByKey('send', `${getClientAddress()}:${locals.user.email}`, {
        max: 30,
        windowS: 60,
      });
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
    if (rawHtml) {
      // SEC-012: tamaño Y estructura, antes de sanitizar.
      const guard = guardComposedHtml(rawHtml);
      if (!guard.ok) {
        return fail(COMPOSED_HTML_GUARD_STATUS[guard.reason!], {
          error: COMPOSED_HTML_GUARD_MESSAGES[guard.reason!],
        });
      }
    }
    let html: string | undefined;
    if (rawHtml) {
      const sanitized = safeSanitizeComposedEmailHtml(rawHtml);
      if (!sanitized.ok) return fail(400, { error: 'No se pudo procesar el contenido HTML' });
      html = sanitized.html.trim() || undefined;
    }
    const priorityRaw = String(form.get('priority') ?? 'normal').trim();
    const priority = PRIORITIES.has(priorityRaw)
      ? (priorityRaw as 'low' | 'normal' | 'high')
      : 'normal';

    if (!to || !subject || !text) return fail(400, { error: 'Faltan campos', to, subject, text });
    if (to.length > 1024 || subject.length > 200)
      return fail(400, { error: 'Campos demasiado largos' });
    const recipientError =
      validateRecipients('Para', to) ??
      validateRecipients('Cc', cc ?? '') ??
      validateRecipients('Cco', bcc ?? '');
    if (recipientError) return fail(400, { error: recipientError, to, subject, text });

    const attachments: AttachmentBytes[] = [];
    const files = form.getAll('attachment') as File[];
    for (const file of files) {
      if (!file || file.size === 0) continue;
      if (file.size > MAX_SIZE)
        return fail(413, { error: `Adjunto ${file.name} demasiado grande (máx 10 MB)` });
      const content = Buffer.from(await file.arrayBuffer());
      attachments.push({
        filename: file.name,
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
      return { ok: true };
    } catch (e) {
      console.error('send fail', (e as Error).message);
      return fail(500, { error: `No se pudo enviar: ${(e as Error).message}` });
    }
  },

  draft: async ({ locals, request, getClientAddress }) => {
    const sid = locals.sessionId;
    const password = sid ? await getSessionPassword(sid) : null;
    if (!locals.user || !password) throw error(401, 'No autorizado');

    // SEC-012: esta acción (botón "Guardar borrador") no tenía NINGÚN rate
    // limit — a diferencia de `/api/compose/draft` (60/min por identidad) y
    // de la acción `send` de este mismo archivo (30/min). Mismo presupuesto
    // que el endpoint API equivalente.
    try {
      rateLimitByKey('draft', `${getClientAddress()}:${locals.user.email}`, {
        max: 60,
        windowS: 60,
      });
    } catch {
      return fail(429, { error: 'Demasiados guardados de borrador (60/min)' });
    }

    const form = await request.formData();
    const to = String(form.get('to') ?? '').trim();
    const cc = String(form.get('cc') ?? '').trim() || undefined;
    const bcc = String(form.get('bcc') ?? '').trim() || undefined;
    const subject = String(form.get('subject') ?? '').trim();
    const text = String(form.get('text') ?? '').trim();
    const rawHtml = String(form.get('html') ?? '').trim();
    if (rawHtml) {
      // SEC-012: tamaño Y estructura, antes de sanitizar.
      const guard = guardComposedHtml(rawHtml);
      if (!guard.ok) {
        return fail(COMPOSED_HTML_GUARD_STATUS[guard.reason!], {
          error: COMPOSED_HTML_GUARD_MESSAGES[guard.reason!],
        });
      }
    }
    let html: string | undefined;
    if (rawHtml) {
      const sanitized = safeSanitizeComposedEmailHtml(rawHtml);
      if (!sanitized.ok) return fail(400, { error: 'No se pudo procesar el contenido HTML' });
      html = sanitized.html.trim() || undefined;
    }
    if (!to && !subject && !text) return { ok: false, error: 'Borrador vacío' };
    const raw = buildMime(locals.user.email, {
      to: to || '(sin destinatario)',
      subject: subject || '(sin asunto)',
      text,
      html,
      cc,
      bcc,
    });
    try {
      await appendToDrafts({ user: locals.user.email, pass: password }, raw);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  },
};

export const _load_redirect = () => {
  throw redirect(303, '/inbox');
};
