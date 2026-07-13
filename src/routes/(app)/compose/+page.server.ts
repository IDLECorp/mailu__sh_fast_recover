import { fail, error, redirect } from '@sveltejs/kit';
void redirect;
import type { Actions, PageServerLoad } from './$types';
import { getSessionPassword } from '$lib/server/auth';
import { sendMail } from '$lib/server/smtp';
import { fetchMessage, appendToDrafts, type ImapCreds } from '$lib/server/imap';
import { rateLimitByKey } from '$lib/server/rate-limit';
import { buildMime, type AttachmentBytes } from '$lib/email';

const MAX_SIZE = 10 * 1024 * 1024;

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
        body: `\n\n---------- Mensaje original ----------\nDe: ${original.from}\nPara: ${original.to}\nFecha: ${ts}\nAsunto: ${original.subject}\n\n${original.text.split('\n').map((l) => `> ${l}`).join('\n')}`
      };
    }
  } else if (forwardUidParam) {
    const fwdUid = Number(forwardUidParam);
    const original = await fetchMessage(creds, mailbox, fwdUid).catch(() => null);
    if (original) {
      prefill = {
        to: '',
        subject: original.subject.startsWith('Fwd:') ? original.subject : `Fwd: ${original.subject}`,
        body: `\n\n---------- Mensaje reenviado ----------\nDe: ${original.from}\nPara: ${original.to}\nAsunto: ${original.subject}\n\n${original.text}`,
        forwardedFrom: original.from
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
      rateLimitByKey('send', `${getClientAddress()}:${locals.user.email}`, { max: 30, windowS: 60 });
    } catch {
      return fail(429, { error: 'Límite de envíos alcanzado (30/min)' });
    }

    const form = await request.formData();
    const to = String(form.get('to') ?? '').trim();
    const subject = String(form.get('subject') ?? '').trim();
    const text = String(form.get('text') ?? '').trim();
    const cc = String(form.get('cc') ?? '').trim() || undefined;
    const html = String(form.get('html') ?? '').trim() || undefined;

    if (!to || !subject || !text) return fail(400, { error: 'Faltan campos', to, subject, text });
    if (to.length > 1024 || subject.length > 200) return fail(400, { error: 'Campos demasiado largos' });

    const attachments: AttachmentBytes[] = [];
    const files = form.getAll('attachment') as File[];
    for (const file of files) {
      if (!file || file.size === 0) continue;
      if (file.size > MAX_SIZE) return fail(413, { error: `Adjunto ${file.name} demasiado grande (máx 10 MB)` });
      const content = Buffer.from(await file.arrayBuffer());
      attachments.push({ filename: file.name, contentType: file.type || 'application/octet-stream', content });
    }

    try {
      await sendMail({ user: locals.user.email, pass: password }, locals.user.email, { to, subject, text, html, cc, attachments });
      return { ok: true };
    } catch (e) {
      console.error('send fail', (e as Error).message);
      return fail(500, { error: `No se pudo enviar: ${(e as Error).message}` });
    }
  },

  draft: async ({ locals, request }) => {
    const sid = locals.sessionId;
    const password = sid ? await getSessionPassword(sid) : null;
    if (!locals.user || !password) throw error(401, 'No autorizado');
    const form = await request.formData();
    const to = String(form.get('to') ?? '').trim();
    const subject = String(form.get('subject') ?? '').trim();
    const text = String(form.get('text') ?? '').trim();
    if (!to && !subject && !text) return { ok: false, error: 'Borrador vacío' };
    const raw = buildMime(locals.user.email, { to: to || '(sin destinatario)', subject: subject || '(sin asunto)', text });
    try {
      await appendToDrafts({ user: locals.user.email, pass: password }, raw);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }
};

export const _load_redirect = () => {
  throw redirect(303, '/inbox');
};