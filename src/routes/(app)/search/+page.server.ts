import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getSessionPassword } from '$lib/server/auth';
import { searchMessages, type ImapCreds } from '$lib/server/imap';

export const load: PageServerLoad = async ({ locals, url }) => {
  const sid = locals.sessionId;
  const password = sid ? await getSessionPassword(sid) : null;
  if (!locals.user || !password) throw error(401, 'No autorizado');

  const q = url.searchParams.get('q') ?? '';
  const scope = url.searchParams.get('scope') ?? 'all';
  const mailbox = url.searchParams.get('mailbox') ?? 'INBOX';

  if (!q.trim()) return { query: '', scope, hits: [] as Awaited<ReturnType<typeof searchMessages>>, email: locals.user.email };

  const creds: ImapCreds = { user: locals.user.email, pass: password };
  const criteria: Parameters<typeof searchMessages>[1] = { mailbox };
  if (scope === 'from') criteria.from = q;
  else if (scope === 'subject') criteria.subject = q;
  else if (scope === 'body') criteria.body = q;
  else {
    // all: run multiple searches and merge (imapflow doesn't OR in simple criteria)
    const [byFrom, bySubj, byBody] = await Promise.all([
      searchMessages(creds, { ...criteria, from: q }).catch(() => []),
      searchMessages(creds, { ...criteria, subject: q }).catch(() => []),
      searchMessages(creds, { ...criteria, body: q }).catch(() => [])
    ]);
    const merged = new Map<number, typeof byFrom[number]>();
    for (const arr of [byFrom, bySubj, byBody]) for (const h of arr) merged.set(h.uid, h);
    const hits = Array.from(merged.values()).sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 100);
    return { query: q, scope, hits, email: locals.user.email };
  }

  const hits = await searchMessages(creds, criteria);
  return { query: q, scope, hits, email: locals.user.email };
};