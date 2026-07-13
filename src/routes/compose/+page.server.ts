import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';
import { getSessionPassword } from '$lib/server/auth';
import { sendMail } from '$lib/server/smtp';
import { rateLimitByKey } from '$lib/server/rate-limit';

export const actions: Actions = {
  default: async ({ locals, request, getClientAddress }) => {
    const sid = locals.sessionId;
    const user = locals.user;
    const password = sid ? getSessionPassword(sid) : null;
    if (!user || !password) return fail(401, { error: 'No autenticado' });

    try {
      rateLimitByKey('send', `${getClientAddress()}:${user.email}`, { max: 30, windowS: 60 });
    } catch {
      return fail(429, { error: 'Límite de envíos alcanzado (30/min)' });
    }

    const data = await request.formData();
    const to = String(data.get('to') ?? '').trim();
    const subject = String(data.get('subject') ?? '').trim();
    const text = String(data.get('text') ?? '').trim();
    const html = String(data.get('html') ?? '').trim();

    if (!to || !subject || !text) return fail(400, { error: 'Faltan campos', to, subject, text });
    if (to.length > 1024 || subject.length > 200) return fail(400, { error: 'Campos demasiado largos', to, subject, text });

    await sendMail({ user: user.email, pass: password }, user.email, { to, subject, text, html: html || undefined });
    return { ok: true };
  }
};