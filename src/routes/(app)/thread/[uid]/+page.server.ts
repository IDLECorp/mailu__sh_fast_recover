import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getSessionPassword } from '$lib/server/auth';
import { fetchMessage, type ImapCreds } from '$lib/server/imap';

export const load: PageServerLoad = async ({ locals, params, url }) => {
  const sid = locals.sessionId;
  const password = sid ? await getSessionPassword(sid) : null;
  if (!locals.user || !password) throw error(401, 'No autorizado');
  const uid = Number(params.uid);
  if (!uid) throw error(400, 'UID inválido');
  const mailbox = url.searchParams.get('mailbox') ?? 'INBOX';
  const creds: ImapCreds = { user: locals.user.email, pass: password };
  const detail = await fetchMessage(creds, mailbox, uid);
  if (!detail) throw error(404, 'Mensaje no encontrado');
  return { detail, mailbox, uid, user: locals.user };
};