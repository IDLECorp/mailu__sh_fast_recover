import nodemailer from 'nodemailer';
import { env } from '$env/dynamic/private';
import { appendToSent } from '$lib/server/imap';
import type { ImapCreds } from '$lib/server/imap';
import { buildMime, type SendMailInput as MimeInput, type AttachmentBytes } from '$lib/email';

export interface SmtpCreds {
  user: string;
  pass: string;
}

const HOST = env.MAILU_SMTP_PORT ? (env.MAILU_SMTP_HOST ?? 'mailu-smtp-1') : 'mailu-smtp-1';
const PORT = Number(env.MAILU_SMTP_PORT ?? 587);
const SECURE = PORT === 465;

export function smtpTransport(creds: SmtpCreds): nodemailer.Transporter {
  return nodemailer.createTransport({
    host: HOST,
    port: PORT,
    secure: SECURE,
    requireTLS: !SECURE,
    auth: { user: creds.user, pass: creds.pass },
    tls: { rejectUnauthorized: false },
  });
}

export interface SendMailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
  cc?: string;
  bcc?: string;
  replyTo?: string;
  attachments?: AttachmentBytes[];
  priority?: 'low' | 'normal' | 'high';
}

export async function sendMail(
  creds: ImapCreds,
  from: string,
  input: SendMailInput,
): Promise<{ messageId: string }> {
  const transport = smtpTransport(creds);
  try {
    const info = await transport.sendMail({
      from,
      to: input.to,
      cc: input.cc,
      bcc: input.bcc,
      subject: input.subject,
      text: input.text,
      html: input.html,
      replyTo: input.replyTo,
      priority: input.priority === 'high' ? 'high' : input.priority === 'low' ? 'low' : 'normal',
      attachments: (input.attachments ?? []).map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      })),
    });

    const mime: MimeInput = {
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
      cc: input.cc,
      bcc: input.bcc,
      replyTo: input.replyTo,
      priority: input.priority,
    };
    const raw = buildMime(from, mime, input.attachments ?? []);
    try {
      await appendToSent(creds, raw);
    } catch (e) {
      console.error('smtp: appendToSent failed', (e as Error).message);
    }

    return { messageId: info.messageId };
  } finally {
    transport.close();
  }
}
