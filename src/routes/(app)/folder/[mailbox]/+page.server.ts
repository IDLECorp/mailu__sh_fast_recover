import { error } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getSessionPassword } from '$lib/server/auth';
import { listFolder, markSeen, deleteMessage, mailboxLabel, purgeTrash, type ImapCreds } from '$lib/server/imap';

export const load: PageServerLoad = async ({ locals, url, params }) => {
  const sid = locals.sessionId;
  const password = sid ? await getSessionPassword(sid) : null;
  if (!locals.user || !password) throw error(401, 'No autorizado');
  const mailbox = decodeURIComponent(params.mailbox);
  if (!mailbox) throw error(400, ' Carpeta inválida');
  const creds: ImapCreds = { user: locals.user.email, pass: password };
  const page = Number(url.searchParams.get('page') ?? '1') || 1;
  const result = await listFolder(creds, mailbox, page);
  return { ...result, mailbox, mailboxLabel: mailboxLabel(null, mailbox), email: locals.user.email };
};

export const actions: Actions = {
  markRead: async ({ locals, request, params }) => {
    const sid = locals.sessionId;
    const password = sid ? await getSessionPassword(sid) : null;
    if (!locals.user || !password) throw error(401, 'No autorizado');
    const mailbox = decodeURIComponent(params.mailbox);
    const data = await request.formData();
    const uid = Number(data.get('uid'));
    if (!uid) return { ok: false };
    await markSeen({ user: locals.user.email, pass: password }, mailbox, uid);
    return { ok: true };
  },
  delete: async ({ locals, request, params }) => {
    const sid = locals.sessionId;
    const password = sid ? await getSessionPassword(sid) : null;
    if (!locals.user || !password) throw error(401, 'No autorizado');
    const mailbox = decodeURIComponent(params.mailbox);
    const data = await request.formData();
    const uid = Number(data.get('uid'));
    if (!uid) return { ok: false };
    await deleteMessage({ user: locals.user.email, pass: password }, mailbox, uid);
    return { ok: true };
  },
  purge: async ({ locals, params }) => {
    const sid = locals.sessionId;
    const password = sid ? await getSessionPassword(sid) : null;
    if (!locals.user || !password) throw error(401, 'No autorizado');
    const mailbox = decodeURIComponent(params.mailbox);
    if (mailbox !== 'Trash') return { ok: false, error: 'Sólo se puede vaciar la papelera' };
    const count = await purgeTrash({ user: locals.user.email, pass: password });
    return { ok: true, count };
  }
};