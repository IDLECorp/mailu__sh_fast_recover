import nodemailer from 'nodemailer';
import { env } from '$env/dynamic/private';

export interface SmtpCreds {
  user: string;
  pass: string;
}

const HOST = env.MAILU_SMTP_HOST ?? 'mailu-smtp-1';
const PORT = Number(env.MAILU_SMTP_PORT ?? 587);
const SECURE = PORT === 465;

export function smtpTransport(creds: SmtpCreds): nodemailer.Transporter {
  return nodemailer.createTransport({
    host: HOST,
    port: PORT,
    secure: SECURE,
    requireTLS: !SECURE,
    auth: { user: creds.user, pass: creds.pass },
    tls: { rejectUnauthorized: false }
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
}

export async function sendMail(creds: SmtpCreds, from: string, input: SendMailInput): Promise<{ messageId: string }> {
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
      replyTo: input.replyTo
    });
    return { messageId: info.messageId };
  } finally {
    transport.close();
  }
}