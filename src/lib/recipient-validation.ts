// Nodemailer's parser is also used by email.ts. Keeping the same parser here
// means the client and server agree on display names and quoted commas.
import addressParser from 'nodemailer/lib/addressparser';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type RecipientLabel = 'Para' | 'Cc' | 'Cco';

function splitRecipientList(value: string): string[] | null {
  const entries: string[] = [];
  let start = 0;
  let quoted = false;
  let escaped = false;
  let angleDepth = 0;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\' && quoted) {
      escaped = true;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (!quoted && char === '<') {
      angleDepth += 1;
      continue;
    }
    if (!quoted && char === '>') {
      angleDepth -= 1;
      if (angleDepth < 0) return null;
      continue;
    }
    if (!quoted && angleDepth === 0 && (char === ',' || char === ';')) {
      entries.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }

  if (quoted || escaped || angleDepth !== 0) return null;
  entries.push(value.slice(start).trim());
  return entries;
}

function isValidRecipient(entry: string): boolean {
  if (!entry || /[\r\n\u0000-\u001f\u007f]/.test(entry)) return false;

  let parsed: Array<{ address?: string; name?: string }>;
  try {
    parsed = addressParser(entry, { flatten: true });
  } catch {
    return false;
  }
  if (parsed.length !== 1) return false;

  const mailbox = parsed[0]?.address?.trim() ?? '';
  if (!EMAIL_RE.test(mailbox)) return false;

  // A display name must have one complete angle-address pair. The parser is
  // intentionally permissive, so reject trailing/missing structure here.
  const hasAngleAddress = entry.includes('<') || entry.includes('>');
  if (hasAngleAddress && !/^.+<[^<>]+>$/.test(entry)) return false;
  if (!hasAngleAddress && (entry.includes('<') || entry.includes('>') || entry.includes('"'))) return false;
  return true;
}

export function validateRecipientList(label: RecipientLabel, value: string): string | null {
  if (!value.trim()) return null;

  const entries = splitRecipientList(value);
  const invalid = entries === null ? '' : entries.find((entry) => !isValidRecipient(entry));

  return invalid === undefined
    ? null
    : `${label} contiene un correo inválido${invalid ? `: ${invalid}` : '.'}`;
}

export function validateRecipientFields(fields: {
  to?: string;
  cc?: string;
  bcc?: string;
}): string | null {
  return (
    validateRecipientList('Para', fields.to ?? '') ??
    validateRecipientList('Cc', fields.cc ?? '') ??
    validateRecipientList('Cco', fields.bcc ?? '')
  );
}
