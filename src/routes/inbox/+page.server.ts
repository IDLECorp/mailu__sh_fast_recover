import { error } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getSessionPassword } from '$lib/server/auth';
import { listInbox, markSeen, deleteMessage } from '$lib/server/imap';

export const load: PageServerLoad = async ({ locals, url, cookies }) => {
  const sid = locals.sessionId;
  const user = locals.user;
  if (!user || !sid) throw error(401, 'No autenticado');
  const password = getSessionPassword(sid);
  if (!password) throw error(401, 'Sesión expirada');
  const cookieStore = cookies.get('mail_pw') ?? '';

  const page = Number(url.searchParams.get('page') ?? '1') || 1;
  void cookieStore;
  const result = await listInbox({ user: user.email, pass: password }, page);
  return { ...result, email: user.email };
};

export const actions: Actions = {
  markRead: async ({ locals, request, url }) => {
    const sid = locals.sessionId;
    const user = locals.user;
    const password = sid ? getSessionPassword(sid) : null;
    if (!user || !password) throw error(401, 'No autenticado');
    const data = await request.formData();
    const uid = Number(data.get('uid'));
    if (!uid) return { ok: false };
    await markSeen({ user: user.email, pass: password }, uid);
    return { ok: true };
  },
  delete: async ({ locals, request }) => {
    const sid = locals.sessionId;
    const user = locals.user;
    const password = sid ? getSessionPassword(sid) : null;
    if (!user || !password) throw error(401, 'No autenticado');
    const data = await request.formData();
    const uid = Number(data.get('uid'));
    if (!uid) return { ok: false };
    await deleteMessage({ user: user.email, pass: password }, uid);
    return { ok: true };
  }
};