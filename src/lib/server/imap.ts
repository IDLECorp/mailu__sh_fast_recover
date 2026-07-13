import { ImapFlow } from 'imapflow';
import { env } from '$env/dynamic/private';

export interface ImapCreds {
  user: string;
  pass: string;
}

export interface MessageSummary {
  uid: number;
  flags: string[];
  subject: string;
  from: string;
  to: string;
  date: Date;
  size: number;
  seen: boolean;
}

const HOST = env.MAILU_IMAP_HOST ?? 'mailu-imap-1';
const PORT = Number(env.MAILU_IMAP_PORT ?? 143);
const SECURE = PORT === 993;

export function imapClient(creds: ImapCreds): ImapFlow {
  return new ImapFlow({
    host: HOST,
    port: PORT,
    secure: SECURE,
    tls: SECURE ? {} : { rejectUnauthorized: false },
    auth: { user: creds.user, pass: creds.pass },
    logger: false,
    emitLogs: false
  });
}

export async function verifyCredentials(creds: ImapCreds): Promise<boolean> {
  const client = imapClient(creds);
  try {
    await client.connect();
    return true;
  } catch {
    return false;
  } finally {
    if (client.usable) await client.logout().catch(() => undefined);
  }
}

const INBOX_PAGE = 40;

export async function listInbox(creds: ImapCreds, page = 1): Promise<{ messages: MessageSummary[]; total: number; page: number; pages: number }> {
  const client = imapClient(creds);
  await client.connect();
  try {
    const lock = await client.getMailboxLock('INBOX');
    try {
      const status = await client.status('INBOX', { messages: true });
      const total = status.messages ?? 0;
      const pages = Math.max(1, Math.ceil(total / INBOX_PAGE));
      const p = Math.min(Math.max(1, page), pages);
      const from = total - (p - 1) * INBOX_PAGE;
      const to = Math.max(1, from - INBOX_PAGE + 1);
      const messages: MessageSummary[] = [];
      if (total > 0) {
        for await (const msg of client.fetch(`${to}:${from}`, {
          uid: true,
          flags: true,
          envelope: true,
          size: true,
          internalDate: true
        })) {
          const env = msg.envelope ?? {};
          const flags = Array.from((msg.flags as Iterable<string> | undefined) ?? []);
          const dateRaw = msg.internalDate;
          const date = dateRaw instanceof Date ? dateRaw : new Date(dateRaw ?? Date.now());
          const subject = String(env.subject ?? '(sin asunto)');
          messages.push({
            uid: msg.uid as number,
            flags,
            subject,
            from: formatAddr(env.from?.[0]),
            to: formatAddr(env.to?.[0]),
            date,
            size: msg.size ?? 0,
            seen: flags.includes('\\Seen')
          });
        }
      }
      messages.sort((a, b) => b.uid - a.uid);
      return { messages, total, page: p, pages };
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => undefined);
  }
}

function formatAddr(a: { address?: string; name?: string } | undefined): string {
  if (!a) return '';
  if (a.name) return `${a.name} <${a.address ?? ''}>`;
  return a.address ?? '';
}

export async function fetchMessage(creds: ImapCreds, uid: number): Promise<{ raw: string; subject: string; from: string; date: Date } | null> {
  const client = imapClient(creds);
  await client.connect();
  try {
    const lock = await client.getMailboxLock('INBOX');
    try {
      const msg = await client.fetchOne(String(uid), { uid: true, envelope: true, source: true }, { uid: true });
      if (!msg) return null;
      const env = msg.envelope ?? {};
      const dateRaw = msg.internalDate;
      const date = dateRaw instanceof Date ? dateRaw : new Date(dateRaw ?? Date.now());
      return {
        raw: msg.source?.toString('utf8') ?? '',
        subject: String(env.subject ?? '(sin asunto)'),
        from: formatAddr(env.from?.[0]),
        date
      };
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => undefined);
  }
}

export async function markSeen(creds: ImapCreds, uid: number): Promise<void> {
  const client = imapClient(creds);
  await client.connect();
  try {
    const lock = await client.getMailboxLock('INBOX');
    try {
      await client.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true });
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => undefined);
  }
}

export async function deleteMessage(creds: ImapCreds, uid: number): Promise<void> {
  const client = imapClient(creds);
  await client.connect();
  try {
    const lock = await client.getMailboxLock('INBOX');
    try {
      await client.messageDelete(String(uid), { uid: true });
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => undefined);
  }
}