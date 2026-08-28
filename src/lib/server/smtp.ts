import path from 'node:path';
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

/**
 * Nombre de archivo seguro para adjuntos: toma solo el basename y elimina
 * cualquier separador de ruta (`/` o `\`) y las secuencias `..` (path
 * traversal). Defensa en profundidad: se aplica tanto en el endpoint de envío
 * como aquí, antes de pasar el nombre a nodemailer y al MIME.
 */
export function sanitizeAttachmentName(name: string): string {
  const base = path.basename(name || '');
  const cleaned = base.split(/[\\/]/).pop() ?? base;
  const safe = cleaned.replace(/\.{2,}/g, '').replace(/[\\/]/g, '');
  return safe || 'adjunto';
}

/** Error de SMTP que debe mapearse a una respuesta 4xx limpia en el endpoint. */
export class SmtpRejectedError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'SmtpRejectedError';
    this.status = status;
  }
}

function isForbiddenAttachmentError(e: unknown): boolean {
  const err = e as { message?: string; response?: string };
  const text = `${err?.message ?? ''} ${err?.response ?? ''}`.toLowerCase();
  return /forbidden/.test(text) && /attachment/.test(text);
}

export async function sendMail(
  creds: ImapCreds,
  from: string,
  input: SendMailInput,
): Promise<{ messageId: string }> {
  const transport = smtpTransport(creds);

  // Defensa en profundidad: sanea los nombres de adjunto aquí también,
  // no confiamos solo en el endpoint.
  const safeAttachments = (input.attachments ?? []).map((a) => ({
    ...a,
    filename: sanitizeAttachmentName(a.filename),
  }));

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
      attachments: safeAttachments.map((a) => ({
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
    const raw = buildMime(from, mime, safeAttachments);
    try {
      await appendToSent(creds, raw);
    } catch (e) {
      console.error('smtp: appendToSent failed', (e as Error).message);
    }

    return { messageId: info.messageId };
  } catch (e) {
    // Bug 3: Mailu rechaza ciertas extensiones (.exe/.bin) con
    // "554 5.7.1 Forbidden attachment extension". En vez de propagarlo como
    // 500, lo convertimos en un error 4xx limpio en español.
    if (isForbiddenAttachmentError(e)) {
      const name = safeAttachments[0]?.filename;
      throw new SmtpRejectedError(
        name
          ? `El archivo ${name} no está permitido por seguridad`
          : 'Uno de los archivos adjuntos no está permitido por seguridad',
        400,
      );
    }
    throw e;
  } finally {
    transport.close();
  }
}
