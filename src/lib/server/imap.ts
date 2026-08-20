import { ImapFlow } from 'imapflow';
import { simpleParser, type ParsedMail } from 'mailparser';
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
  hasAttachments: boolean;
}

export interface MailboxInfo {
  path: string;
  specialUse: string | null;
  messages: number;
  unseen: number;
}

export interface MessageDetail {
  uid: number;
  subject: string;
  from: string;
  to: string;
  cc: string;
  date: Date;
  text: string;
  html: string | null;
  attachments: Attachment[];
  inReplyTo: string | null;
  messageId: string | null;
}

export interface Attachment {
  filename: string;
  contentType: string;
  size: number;
  contentId: string | null;
  inline: boolean;
  content: Buffer;
}

const HOST = env.MAILU_IMAP_HOST ?? 'mailu-imap-1';
const PORT = Number(env.MAILU_IMAP_PORT ?? 143);
const SECURE = PORT === 993;

export function imapClient(creds: ImapCreds): ImapFlow {
  return new ImapFlow({
    host: HOST,
    port: PORT,
    secure: SECURE,
    tls: { rejectUnauthorized: false },
    doSTARTTLS: false,
    auth: { user: creds.user, pass: creds.pass },
    logger: false,
    emitLogs: false
  });
}

export async function verifyCredentials(creds: ImapCreds): Promise<boolean> {
  const r = await verifyCredentialsFull(creds);
  return r.ok;
}

export interface CredentialCheck {
  ok: boolean;
  needPwChange: boolean;
  reason?: string;
}

export async function verifyCredentialsFull(creds: ImapCreds): Promise<CredentialCheck> {
  const client = imapClient(creds);
  let imapOk = false;
  try {
    await client.connect();
    imapOk = true;
  } catch (e) {
    console.error('imap verifyCredentials failed:', (e as Error)?.message ?? e, 'host=', HOST, 'port=', PORT);
    return { ok: false, needPwChange: false, reason: 'imap_failed' };
  } finally {
    if (client.usable) await client.logout().catch(() => undefined);
  }
  // SMTP verify to detect password-temporary block
  try {
    const smtpHost = env.MAILU_SMTP_HOST ?? 'mailu-front-1';
    const smtpPort = Number(env.MAILU_SMTP_PORT ?? 465);
    const secure = smtpPort === 465;
    const nodemailer = (await import('nodemailer')).default;
    const t = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure,
      requireTLS: !secure,
      auth: { user: creds.user, pass: creds.pass },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 5000,
      greetingTimeout: 5000
    });
    try {
      await t.verify();
      return { ok: true, needPwChange: false };
    } catch (e) {
      const msg = (e as Error).message ?? '';
      if (/535|Authentication|auth/i.test(msg)) {
        return { ok: true, needPwChange: true, reason: 'smtp_auth_rejected' };
      }
      // SMTP server down/unreachable, allow login without send anyway
      console.error('smtp verify non-auth error', msg);
      return { ok: true, needPwChange: false };
    } finally {
      t.close();
    }
  } catch {
    return { ok: imapOk, needPwChange: false };
  }
}

const PAGE_SIZE = 40;
const SPECIAL_USE_NAMES: Record<string, string> = {
  '\\Inbox': 'Bandeja',
  '\\Sent': 'Enviados',
  '\\Drafts': 'Borradores',
  '\\Trash': 'Papelera',
  '\\Junk': 'Spam',
  '\\Archive': 'Archivo'
};

export function mailboxLabel(specialUse: string | null, path: string): string {
  if (specialUse && SPECIAL_USE_NAMES[specialUse]) return SPECIAL_USE_NAMES[specialUse];
  return path;
}

export async function listMailboxes(creds: ImapCreds): Promise<MailboxInfo[]> {
  const client = imapClient(creds);
  await client.connect();
  try {
    const lock = await client.getMailboxLock('INBOX');
    let mailboxes: Awaited<ReturnType<typeof client.list>>;
    try {
      mailboxes = await client.list();
    } finally {
      lock.release();
    }
    const out: MailboxInfo[] = [];
    for (const m of mailboxes ?? []) {
      let messages = 0;
      let unseen = 0;
      try {
        const status = await client.status(m.path, { messages: true, unseen: true });
        messages = status.messages ?? 0;
        unseen = status.unseen ?? 0;
      } catch {
        // some mailboxes may not be selectable
      }
      out.push({ path: m.path, specialUse: m.specialUse ?? null, messages, unseen });
    }
    return out;
  } finally {
    await client.logout().catch(() => undefined);
  }
}

function formatAddr(a: { address?: string; name?: string } | undefined): string {
  if (!a) return '';
  if (a.name) return `${a.name} <${a.address ?? ''}>`;
  return a.address ?? '';
}

function formatAddrList(list: { address?: string; name?: string }[] | undefined): string {
  if (!list || !list.length) return '';
  return list.map(formatAddr).join(', ');
}

export async function listFolder(creds: ImapCreds, mailbox: string, page = 1): Promise<{ messages: MessageSummary[]; total: number; page: number; pages: number }> {
  const client = imapClient(creds);
  await client.connect();
  try {
    const lock = await client.getMailboxLock(mailbox);
    try {
      const status = await client.status(mailbox, { messages: true });
      const total = status.messages ?? 0;
      const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
      const p = Math.min(Math.max(1, page), pages);
      const from = total - (p - 1) * PAGE_SIZE;
      const to = Math.max(1, from - PAGE_SIZE + 1);
      const messages: MessageSummary[] = [];
      if (total > 0) {
        for await (const msg of client.fetch(`${to}:${from}`, {
          uid: true,
          flags: true,
          envelope: true,
          size: true,
          internalDate: true,
          bodyStructure: true
        })) {
          const env = msg.envelope ?? {};
          const flags = Array.from((msg.flags as Iterable<string> | undefined) ?? []);
          const dateRaw = msg.internalDate;
          const date = dateRaw instanceof Date ? dateRaw : new Date(dateRaw ?? Date.now());
          const subject = String(env.subject ?? '(sin asunto)');
          const hasAttachments = (msg.bodyStructure as { childNodes?: unknown[] } | null)?.childNodes?.some(
            (c) => (c as { disposition?: string })?.disposition === 'attachment'
          ) ?? false;
          messages.push({
            uid: msg.uid as number,
            flags,
            subject,
            from: formatAddr(env.from?.[0]),
            to: formatAddrList(env.to),
            date,
            size: msg.size ?? 0,
            seen: flags.includes('\\Seen'),
            hasAttachments
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

export async function fetchMessage(creds: ImapCreds, mailbox: string, uid: number): Promise<MessageDetail | null> {
  const client = imapClient(creds);
  await client.connect();
  try {
    const lock = await client.getMailboxLock(mailbox);
    try {
      const msg = await client.fetchOne(
        String(uid),
        { uid: true, envelope: true, source: true, internalDate: true, flags: true },
        { uid: true }
      );
      if (!msg) return null;
      const env = msg.envelope ?? {};
      const dateRaw = msg.internalDate;
      const date = dateRaw instanceof Date ? dateRaw : new Date(dateRaw ?? Date.now());
      const sourceBuf = (msg.source as Buffer | undefined) ?? Buffer.alloc(0);

      let parsed: ParsedMail;
      try {
        parsed = await simpleParser(sourceBuf);
      } catch (e) {
        console.error('imap fetchMessage parse error', (e as Error)?.message);
        return null;
      }

      const text =
        typeof parsed.text === 'string' && parsed.text.trim().length > 0
          ? parsed.text
          : typeof parsed.html === 'string'
            ? stripHtml(parsed.html)
            : '';
      const html = typeof parsed.html === 'string' ? parsed.html : null;
      const attachments: Attachment[] = (parsed.attachments ?? []).map((a) => ({
        filename: a.filename || 'adjunto',
        contentType: a.contentType || 'application/octet-stream',
        size: a.size ?? a.content.length,
        contentId: a.cid ?? null,
        inline: (a.contentDisposition ?? '').toLowerCase() === 'inline',
        content: a.content
      }));

      const detail: MessageDetail = {
        uid: msg.uid as number,
        subject: String(env.subject ?? parsed.subject ?? '(sin asunto)'),
        from: addressValue(parsed.from) || formatAddr(env.from?.[0]) || '',
        to: addressValue(parsed.to) || formatAddrList(env.to) || '',
        cc: addressValue(parsed.cc) || formatAddrList(env.cc) || '',
        date,
        text,
        html,
        attachments,
        inReplyTo: env.inReplyTo ?? null,
        messageId: env.messageId ?? null
      };

      const flags = Array.from((msg.flags as Iterable<string> | undefined) ?? []);
      if (!flags.includes('\\Seen')) {
        try {
          await client.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true });
        } catch {
          // ignore
        }
      }

      return detail;
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => undefined);
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<head[\s\S]*?<\/head>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>(?=)/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function addressValue(v: unknown): string {
  if (!v) return '';
  if (Array.isArray(v)) {
    return (v as { text?: string }[]).map((x) => x?.text ?? '').filter(Boolean).join(', ');
  }
  return (v as { text?: string })?.text ?? '';
}

export async function fetchAttachment(
  creds: ImapCreds,
  mailbox: string,
  uid: number,
  filename: string,
  cid?: string | null
): Promise<Attachment | null> {
  const detail = await fetchMessage(creds, mailbox, uid);
  if (!detail) return null;
  if (cid) {
    const target = cid.startsWith('<') ? cid : `<${cid}>`;
    return (
      detail.attachments.find((a) => a.contentId === target || a.contentId === cid) ?? null
    );
  }
  return detail.attachments.find((a) => a.filename === filename) ?? null;
}

export async function markSeen(creds: ImapCreds, mailbox: string, uid: number): Promise<void> {
  const client = imapClient(creds);
  await client.connect();
  try {
    const lock = await client.getMailboxLock(mailbox);
    try {
      await client.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true });
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => undefined);
  }
}

export async function deleteMessage(creds: ImapCreds, mailbox: string, uid: number): Promise<void> {
  const client = imapClient(creds);
  await client.connect();
  try {
    const lock = await client.getMailboxLock(mailbox);
    try {
      await client.messageMove(String(uid), 'Trash', { uid: true }).catch(async () => {
        await client.messageFlagsAdd(String(uid), ['\\Deleted'], { uid: true });
      });
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => undefined);
  }
}

export async function moveMessage(creds: ImapCreds, from: string, uid: number, to: string): Promise<void> {
  const client = imapClient(creds);
  await client.connect();
  try {
    const lock = await client.getMailboxLock(from);
    try {
      await client.messageMove(String(uid), to, { uid: true });
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => undefined);
  }
}

export async function appendToSent(creds: ImapCreds, rawMessage: string): Promise<void> {
  const client = imapClient(creds);
  await client.connect();
  try {
    await client.append('Sent', rawMessage, ['\\Seen']);
  } finally {
    await client.logout().catch(() => undefined);
  }
}

export async function appendToDrafts(creds: ImapCreds, rawMessage: string): Promise<void> {
  const client = imapClient(creds);
  await client.connect();
  try {
    await client.append('Drafts', rawMessage, ['\\Draft']);
  } finally {
    await client.logout().catch(() => undefined);
  }
}

export interface SearchQuery {
  mailbox?: string;
  from?: string;
  to?: string;
  subject?: string;
  body?: string;
  since?: Date | null;
  seen?: boolean | null;
}

export async function searchMessages(creds: ImapCreds, q: SearchQuery): Promise<SearchHit[]> {
  const client = imapClient(creds);
  await client.connect();
  try {
    const mailbox = q.mailbox || 'INBOX';
    const lock = await client.getMailboxLock(mailbox);
    try {
      const criteria: Record<string, string | Date | boolean> = {};
      if (q.from) criteria.from = q.from;
      if (q.to) criteria.to = q.to;
      if (q.subject) criteria.subject = q.subject;
      if (q.body) criteria.body = q.body;
      if (q.since) criteria.since = q.since;
      if (q.seen === true) criteria.seen = true;
      if (q.seen === false) criteria.unseen = true;
      const searchArgs = (Object.keys(criteria).length ? criteria : 'ALL') as unknown as Parameters<typeof client.search>[0];
      const uids = await client.search(searchArgs, { uid: true });
      if (!uids || !uids.length) return [];
      const map = new Map<number, SearchHit>();
      for await (const msg of client.fetch(uids as number[], { uid: true, envelope: true, internalDate: true, flags: true, size: true })) {
        const env = msg.envelope ?? {};
        const flags = Array.from((msg.flags as Iterable<string> | undefined) ?? []);
        const dateRaw = msg.internalDate;
        const date = dateRaw instanceof Date ? dateRaw : new Date(dateRaw ?? Date.now());
        map.set(msg.uid as number, {
          uid: msg.uid as number,
          mailbox,
          subject: String(env.subject ?? '(sin asunto)'),
          from: formatAddr(env.from?.[0]),
          to: formatAddrList(env.to),
          date,
          size: msg.size ?? 0,
          seen: flags.includes('\\Seen')
        });
      }
      return Array.from(map.values()).sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 100);
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => undefined);
  }
}

export interface SearchHit {
  uid: number;
  mailbox: string;
  subject: string;
  from: string;
  to: string;
  date: Date;
  size: number;
  seen: boolean;
}

export async function purgeTrash(creds: ImapCreds): Promise<number> {
  const client = imapClient(creds);
  await client.connect();
  try {
    const lock = await client.getMailboxLock('Trash');
    try {
      const count = (await client.status('Trash', { messages: true })).messages ?? 0;
      if (count > 0) {
        const uids = ((await client.search({ all: true } as never, { uid: true })) as number[] | false) || [];
      if (uids.length) await uidlist_expunge(client, uids);
        await uidlist_expunge(client, uids);
      }
      return count;
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => undefined);
  }
}

async function uidlist_expunge(client: ImapFlow, uids: number[]): Promise<void> {
  for (const uid of uids) {
    try {
      await client.messageDelete(String(uid), { uid: true });
    } catch {
      // skip
    }
  }
}

export const FOLDER_ICONS = ['inbox', 'send', 'file-edit', 'trash-2', 'archive', 'alert-octagon'] as const;