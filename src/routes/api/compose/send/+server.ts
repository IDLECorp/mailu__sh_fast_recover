import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSessionPassword } from '$lib/server/auth';
import { sendMail } from '$lib/server/smtp';
import { rateLimitByKey } from '$lib/server/rate-limit';
import type { AttachmentBytes } from '$lib/email';

const MAX_SIZE = 10 * 1024 * 1024;

export const POST: RequestHandler = async ({ locals, request, getClientAddress }) => {
  const sid = locals.sessionId;
  const password = sid ? await getSessionPassword(sid) : null;
  if (!locals.user || !password) return json({ ok: false, error: 'No autorizado' }, { status: 401 });

  try {
    rateLimitByKey('send', `${getClientAddress()}:${locals.user.email}`, { max: 30, windowS: 60 });
  } catch {
    return json({ ok: false, error: 'Límite de envíos alcanzado (30/min)' }, { status: 429 });
  }

  const form = await request.formData();
  const to = String(form.get('to') ?? '').trim();
  const subject = String(form.get('subject') ?? '').trim();
  const text = String(form.get('text') ?? '').trim();
  const cc = String(form.get('cc') ?? '').trim() || undefined;

  if (!to || !subject || !text) return json({ ok: false, error: 'Faltan campos' }, { status: 400 });
  if (to.length > 1024 || subject.length > 200) return json({ ok: false, error: 'Campos demasiado largos' }, { status: 400 });

  const attachments: AttachmentBytes[] = [];
  const files = form.getAll('attachment') as File[];
  for (const file of files) {
    if (!file || file.size === 0) continue;
    if (file.size > MAX_SIZE) return json({ ok: false, error: `Adjunto ${file.name} demasiado grande (máx 10 MB)` }, { status: 413 });
    const content = Buffer.from(await file.arrayBuffer());
    attachments.push({ filename: file.name, contentType: file.type || 'application/octet-stream', content });
  }

  try {
    await sendMail({ user: locals.user.email, pass: password }, locals.user.email, {
      to, subject, text, cc, attachments
    });
    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: `No se pudo enviar: ${(e as Error).message}` }, { status: 500 });
  }
};
