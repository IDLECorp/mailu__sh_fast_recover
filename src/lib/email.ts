import { createHmac } from 'node:crypto';
import { createRequire } from 'node:module';

interface ParsedAddress {
  address?: string;
  name?: string;
}

type AddressParser = (value: string, options: { flatten: true }) => ParsedAddress[];

const addressParser = createRequire(import.meta.url)(
  'nodemailer/lib/addressparser',
) as AddressParser;

function boundary(): string {
  return '----=_FastMail_' + randomToken(24);
}

function randomToken(n: number): string {
  const bytes = new Uint8Array(n);
  (globalThis.crypto ?? (require('node:crypto') as typeof import('node:crypto'))).getRandomValues(
    bytes,
  );
  return Buffer.from(bytes).toString('hex');
}

function qpEncode(input: string): string {
  const bytes = Buffer.from(input, 'utf8');
  const out: string[] = [];
  let lineLen = 0;
  let prevWasspace = false;
  for (const b of bytes) {
    let chunk: string;
    if (b === 0x20) {
      chunk = ' ';
      prevWasspace = true;
    } else if (b === 0x09) {
      chunk = '\t';
      prevWasspace = false;
    } else if ((b >= 33 && b <= 60) || (b >= 62 && b <= 126)) {
      chunk = String.fromCharCode(b);
      prevWasspace = false;
    } else {
      chunk = '=' + b.toString(16).toUpperCase().padStart(2, '0');
      prevWasspace = false;
    }
    lineLen += chunk.length;
    if (chunk === ' ' && (lineLen >= 75 || prevWasspace)) {
      chunk = '=20';
      lineLen += 2;
    }
    if (chunk === '\t' && lineLen >= 73) {
      chunk = '=09';
      lineLen += 2;
    }
    if (lineLen >= 76) {
      out.push('=\r\n');
      lineLen = chunk.length;
    }
    out.push(chunk);
  }
  return out.join('');
}

function encodeHeader(input: string): string {
  if (!input) return input;
  assertSafeHeader(input);
  if (/^[\x20-\x7e]*$/.test(input)) return input;
  if (input.length <= 40) return `=?UTF-8?Q?${qpEncode(input)}?=`;
  return `=?UTF-8?B?${Buffer.from(input, 'utf8').toString('base64')}?=`;
}

function encodeFilename(input: string): string {
  assertSafeHeader(input);
  if (/^[\x20-\x7e]*$/.test(input)) return `=?UTF-8?Q?${qpEncode(input)}?=`;
  return encodeHeader(input);
}

function assertSafeHeader(value: string): void {
  if (/[\r\n]/.test(value)) throw new Error('Invalid header value');
}

function encodeAddressList(value: string): string {
  assertSafeHeader(value);
  const parsed = addressParser(value, { flatten: true });
  if (!parsed.length) throw new Error('Invalid address header');

  return parsed
    .map(({ address = '', name = '' }) => {
      const mailbox = address.trim();
      const displayName = name.trim();
      if (!isValidMailbox(mailbox)) throw new Error('Invalid address header');
      if (!displayName) return mailbox;
      return `${encodeDisplayName(displayName)} <${mailbox}>`;
    })
    .join(', ');
}

function isValidMailbox(value: string): boolean {
  if (!value || /[\s<>\r\n]/.test(value)) return false;
  const at = value.lastIndexOf('@');
  return (
    at > 0 &&
    at < value.length - 1 &&
    !value.slice(0, at).startsWith('.') &&
    !value.slice(0, at).endsWith('.')
  );
}

function encodeDisplayName(value: string): string {
  if (/[^\x20-\x7e]/.test(value)) return encodeHeader(value);
  if (/[()<>@,;:\\"\[\]]/.test(value)) return `"${value.replace(/(["\\])/g, '\\$1')}"`;
  return value;
}

export interface SendMailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
  cc?: string;
  bcc?: string;
  replyTo?: string;
  priority?: 'low' | 'normal' | 'high';
}

export interface AttachmentBytes {
  filename: string;
  contentType: string;
  content: Buffer;
}

export function buildMime(
  from: string,
  input: SendMailInput,
  attachments: AttachmentBytes[] = [],
): string {
  const headers: string[] = [];
  headers.push(`From: ${encodeAddressList(from)}`);
  if (input.to) headers.push(`To: ${encodeAddressList(input.to)}`);
  if (input.cc) headers.push(`Cc: ${encodeAddressList(input.cc)}`);
  if (input.bcc) headers.push(`Bcc: ${encodeAddressList(input.bcc)}`);
  headers.push(`Subject: ${encodeHeader(input.subject) ?? ''}`);
  if (input.priority === 'high') {
    headers.push('X-Priority: 1 (Highest)');
    headers.push('Importance: high');
  } else if (input.priority === 'low') {
    headers.push('X-Priority: 5 (Lowest)');
    headers.push('Importance: low');
  }
  headers.push(`Date: ${new Date().toUTCString()}`);
  headers.push('MIME-Version: 1.0');
  const msgId = `${randomToken(24)}@fastmail.local`;
  headers.push(`Message-ID: <${msgId}>`);
  if (input.replyTo) headers.push(`Reply-To: ${encodeAddressList(input.replyTo)}`);

  const CRLF = '\r\n';
  const needsMultipart = !!input.html || attachments.length > 0;
  const needsAlternative = !!input.html;
  const needsMixed = needsAlternative || attachments.length > 0;

  let body: string;

  if (!needsMultipart) {
    headers.push('Content-Type: text/plain; charset=utf-8');
    headers.push('Content-Transfer-Encoding: quoted-printable');
    body = qpEncode(input.text);
  } else {
    const mixBoundary = needsMixed ? boundary() : '';
    const altBoundary = needsAlternative ? boundary() : '';
    if (attachments.length > 0)
      headers.push(`Content-Type: multipart/mixed; boundary="${mixBoundary}"`);
    else if (needsAlternative)
      headers.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`);
    else if (input.html) headers.push('Content-Type: text/html; charset=utf-8');

    const lines: string[] = [];
    if (attachments.length > 0) {
      if (needsAlternative) {
        lines.push(
          `--${mixBoundary}${CRLF}Content-Type: multipart/alternative; boundary="${altBoundary}"${CRLF}${CRLF}`,
        );
      } else if (input.html) {
        lines.push(
          `--${mixBoundary}${CRLF}Content-Type: multipart/alternative; boundary="${altBoundary}"${CRLF}${CRLF}`,
        );
      } else {
        lines.push(
          `--${mixBoundary}${CRLF}Content-Type: text/plain; charset=utf-8${CRLF}Content-Transfer-Encoding: quoted-printable${CRLF}${CRLF}${qpEncode(input.text)}${CRLF}`,
        );
      }
      if (needsAlternative || input.html) {
        lines.push(
          `--${altBoundary}${CRLF}Content-Type: text/plain; charset=utf-8${CRLF}Content-Transfer-Encoding: quoted-printable${CRLF}${CRLF}${qpEncode(input.text)}${CRLF}`,
        );
        if (input.html) {
          lines.push(
            `--${altBoundary}${CRLF}Content-Type: text/html; charset=utf-8${CRLF}Content-Transfer-Encoding: quoted-printable${CRLF}${CRLF}${qpEncode(input.html)}${CRLF}`,
          );
        }
        lines.push(`--${altBoundary}--${CRLF}`);
      }
      for (const a of attachments) {
        const b64 = a.content.toString('base64');
        const wrapped = b64.replace(/(.{76})/g, `$1${CRLF}`).replace(/\s+$/, '');
        lines.push(
          `--${mixBoundary}${CRLF}Content-Type: ${a.contentType}; name="${encodeFilename(a.filename) ?? a.filename}"${CRLF}` +
            `Content-Transfer-Encoding: base64${CRLF}` +
            `Content-Disposition: attachment; filename="${encodeFilename(a.filename) ?? a.filename}"${CRLF}${CRLF}` +
            wrapped +
            CRLF,
        );
      }
      lines.push(`--${mixBoundary}--${CRLF}`);
    } else if (input.html) {
      lines.push(
        `--${altBoundary}${CRLF}Content-Type: text/plain; charset=utf-8${CRLF}Content-Transfer-Encoding: quoted-printable${CRLF}${CRLF}${qpEncode(input.text)}${CRLF}`,
      );
      lines.push(
        `--${altBoundary}${CRLF}Content-Type: text/html; charset=utf-8${CRLF}Content-Transfer-Encoding: quoted-printable${CRLF}${CRLF}${qpEncode(input.html)}${CRLF}`,
      );
      lines.push(`--${altBoundary}--${CRLF}`);
    }
    body = lines.join('');
  }

  return headers.join(CRLF) + CRLF + CRLF + body;
}

export function nonceOrToken(): string {
  return createHmac('sha256', Math.random().toString()).digest('hex').slice(0, 16);
}
