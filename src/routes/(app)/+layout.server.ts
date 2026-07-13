import type { LayoutServerLoad } from './$types';
import { getSessionUser, getSessionPassword } from '$lib/server/auth';
import { listMailboxes, mailboxLabel, type MailboxInfo } from '$lib/server/imap';
import { error } from '@sveltejs/kit';

export const load: LayoutServerLoad = async ({ locals, cookies, url }) => {
  const sid = locals.sessionId;
  const user = getSessionUser(sid);
  if (!user) throw error(401, 'No autorizado');
  void cookies;
  void url;

  let mailboxList: Array<MailboxInfo & { label: string }> = [];
  const password = sid ? getSessionPassword(sid) : null;
  if (password) {
    try {
      const boxes = await listMailboxes({ user: user.email, pass: password });
      mailboxList = boxes
        .filter((b) => b.path.toLowerCase() !== 'archive')
        .map((b) => ({ ...b, label: mailboxLabel(b.specialUse, b.path) }));
    } catch (e) {
      console.error('(app) layout load mailboxes', (e as Error).message);
    }
  }

  return { user, mailboxes: mailboxList };
};