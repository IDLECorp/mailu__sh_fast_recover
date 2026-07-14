import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSessionPassword } from '$lib/server/auth';
import { appendToDrafts } from '$lib/server/imap';
import { buildMime } from '$lib/email';

export const POST: RequestHandler = async ({ locals, request }) => {
  const sid = locals.sessionId;
  const password = sid ? await getSessionPassword(sid) : null;
  if (!locals.user || !password) return json({ ok: false, error: 'No autorizado' }, { status: 401 });

  const { to, subject, text } = await request.json();
  if (!to && !subject && !text) return json({ ok: false, error: 'Borrador vacío' });

  const raw = buildMime(locals.user.email, {
    to: to || '(sin destinatario)',
    subject: subject || '(sin asunto)',
    text: text || '(sin contenido)'
  });

  try {
    await appendToDrafts({ user: locals.user.email, pass: password }, raw);
    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
};
