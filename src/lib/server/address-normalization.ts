import { createRequire } from 'node:module';

interface AddressPart {
  address?: string;
  name?: string;
}

interface AddressObject {
  text?: string;
  value?: AddressPart[];
}

interface Libmime {
  decodeWords(value: string): string;
}

interface DecodeContext {
  charset: string;
  encoding: 'Q' | 'B';
}

interface DecodedFragment {
  value: string;
  context: DecodeContext | undefined;
  fromLegacyContext: boolean;
}

type AddressParser = (value: string, options: { flatten: true }) => AddressPart[];

const require = createRequire(import.meta.url);
const addressParser = require('nodemailer/lib/addressparser') as AddressParser;
const libmime = require('libmime') as Libmime;

export function normalizeAddressValue(value: unknown): string {
  if (!value) return '';

  if (typeof value === 'string') return normalizeAddressString(value);

  const source = collectAddressParts(value);

  if (source) return normalizeAddressParts(source);

  const text = isRecord(value) && typeof value.text === 'string' ? value.text : undefined;
  return typeof text === 'string' ? normalizeAddressString(text) : '';
}

function normalizeAddressString(value: string): string {
  const unfolded = value.replace(/(?:\r?\n|\r)[ \t]+/g, ' ').trim();
  if (!unfolded) return '';
  const parsed = addressParser(unfolded, { flatten: true });
  if (isOrphanLegacyQSequence(unfolded, parsed)) {
    return normalizeAddressParts(parsed, { charset: 'UTF-8', encoding: 'Q' });
  }
  return parseAndFormat(libmime.decodeWords(unfolded));
}

function collectAddressParts(value: unknown): AddressPart[] | null {
  if (isAddressObject(value)) return value.value?.filter(isAddressPart) ?? [];
  if (!Array.isArray(value)) return null;

  const parts: AddressPart[] = [];
  let recognized = false;
  for (const entry of value) {
    if (isAddressObject(entry)) {
      recognized = true;
      parts.push(...(entry.value?.filter(isAddressPart) ?? []));
    } else if (isAddressPart(entry)) {
      recognized = true;
      parts.push(entry);
    }
  }
  return recognized || value.length === 0 ? parts : null;
}

function isAddressObject(value: unknown): value is AddressObject {
  return isRecord(value) && Array.isArray(value.value);
}

function isAddressPart(value: unknown): value is AddressPart {
  if (!isRecord(value) || (!('address' in value) && !('name' in value))) return false;
  return (
    (value.address === undefined || typeof value.address === 'string') &&
    (value.name === undefined || typeof value.name === 'string')
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isOrphanLegacyQSequence(value: string, parts: AddressPart[]): boolean {
  if (!/^\s*,\s*=20/i.test(value)) return false;
  const hasEncodedMailbox = parts.some(({ address = '' }) =>
    /^=20[^\s<>@]+@[^\s<>@]+$/i.test(address),
  );
  const hasResidualTail = parts.some(
    ({ name = '', address = '' }) => !address && /^(?:=20|=)+$/i.test(name.replace(/\s/g, '')),
  );
  return hasEncodedMailbox && hasResidualTail;
}

function normalizeAddressParts(parts: AddressPart[], initialContext?: DecodeContext): string {
  if (!parts.length) return '';

  let context = initialContext;
  const serialized = parts
    .map((part) => {
      const decodedName = decodeLegacyFragment(part?.name ?? '', context);
      context = decodedName.context;
      const decodedAddress = decodeLegacyFragment(part?.address ?? '', context);
      context = decodedAddress.context;
      const name = cleanLegacyResidual(decodedName);
      const address = cleanLegacyResidual(decodedAddress);
      return serializeAddressPart(name, address);
    })
    .filter(Boolean)
    .join(', ');

  return parseAndFormat(serialized);
}

function decodeLegacyFragment(value: string, context: DecodeContext | undefined): DecodedFragment {
  const unfolded = value.replace(/(?:\r?\n|\r)[ \t]+/g, ' ');
  if (!unfolded) return { value: '', context, fromLegacyContext: false };

  const start = unfolded.match(/=\?([^?\s]+)\?([QB])\?/i);
  const hasEnd = /\?=/.test(unfolded);

  if (start && !hasEnd) {
    const next = {
      charset: start[1],
      encoding: start[2].toUpperCase() as 'Q' | 'B',
    };
    return {
      value: libmime.decodeWords(`${unfolded}?=`),
      context: next,
      fromLegacyContext: true,
    };
  }

  if (!start && context) {
    return {
      value: libmime.decodeWords(
        `=?${context.charset}?${context.encoding}?${unfolded}${hasEnd ? '' : '?='}`,
      ),
      context: hasEnd ? undefined : context,
      fromLegacyContext: true,
    };
  }

  return {
    value: libmime.decodeWords(unfolded),
    context: hasEnd ? undefined : context,
    fromLegacyContext: false,
  };
}

function cleanLegacyResidual(fragment: DecodedFragment): string {
  const value = fragment.value.trim();
  if (fragment.fromLegacyContext && value && /^[=\s]+$/.test(value)) return '';
  return value;
}

function serializeAddressPart(name: string, address: string): string {
  if (!address) return name;
  if (!name) return address;
  const safeName = /[()<>@,;:\\"\[\]]/.test(name) ? `"${name.replace(/(["\\])/g, '\\$1')}"` : name;
  return `${safeName} <${address}>`;
}

function parseAndFormat(value: string): string {
  const parsed = addressParser(value, { flatten: true });
  if (!parsed.length) return value.trim();
  return parsed
    .map(({ name = '', address = '' }) => {
      const cleanName = libmime.decodeWords(name).trim();
      const cleanAddress = libmime.decodeWords(address).trim();
      if (!cleanAddress && looksLikeMailbox(cleanName)) return cleanName;
      if (cleanName === cleanAddress) return cleanAddress;
      if (cleanName && cleanAddress) return `${cleanName} <${cleanAddress}>`;
      return cleanAddress || cleanName;
    })
    .filter(Boolean)
    .join(', ');
}

function looksLikeMailbox(value: string): boolean {
  return /^[^\s<>@]+@[^\s<>@]+$/.test(value);
}
