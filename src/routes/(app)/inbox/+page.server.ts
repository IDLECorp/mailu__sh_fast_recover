import { error } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getSessionPassword } from '$lib/server/auth';
import { listFolder, markSeen, deleteMessage, type ImapCreds } from '$lib/server/imap';

const MAILBOX = 'INBOX';

export const load: PageServerLoad = async ({ locals, url }) => {
  const sid = locals.sessionId;
  const password = sid ? await getSessionPassword(sid) : null;
  if (!locals.user || !password) throw error(401, 'No autorizado');
  const creds: ImapCreds = { user: locals.user.email, pass: password };
  const page = Number(url.searchParams.get('page') ?? '1') || 1;
  const result = await listFolder(creds, MAILBOX, page);
  return { ...result, mailbox: MAILBOX, mailboxLabel: 'Bandeja', email: locals.user.email };
};

export const actions: Actions = {
  markRead: async ({ locals, request }) => {
    const sid = locals.sessionId;
    const password = sid ? await getSessionPassword(sid) : null;
    if (!locals.user || !password) throw error(401, 'No autorizado');
    const data = await request.formData();
    const uid = Number(data.get('uid'));
    if (!uid) return { ok: false };
    await markSeen({ user: locals.user.email, pass: password }, MAILBOX, uid);
    return { ok: true };
  },
  delete: async ({ locals, request }) => {
    const sid = locals.sessionId;
    const password = sid ? await getSessionPassword(sid) : null;
    if (!locals.user || !password) throw error(401, 'No autorizado');
    const data = await request.formData();
    const uid = Number(data.get('uid'));
    if (!uid) return { ok: false };
    await deleteMessage({ user: locals.user.email, pass: password }, MAILBOX, uid);
    return { ok: true };
  }
};