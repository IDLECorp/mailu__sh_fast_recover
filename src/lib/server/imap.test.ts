import { simpleParser } from 'mailparser';
import { describe, expect, it } from 'vitest';
import { normalizeAddressValue } from './address-normalization';

describe('legacy address normalization', () => {
  function expectCleanRecipients(actual: string, expected: string): void {
    expect(actual).toBe(expected);
    expect(actual).not.toContain('=20');
    expect(actual).not.toContain('=?');
    expect(actual.split(',').every((recipient) => recipient.trim().length > 0)).toBe(true);
  }

  it('decodes a legacy Q-encoded Sent sender before list presentation', () => {
    expect(
      normalizeAddressValue([
        {
          name: '=?UTF-8?Q?sistemas@shfastrecover.com?=',
          address: 'sistemas@shfastrecover.com',
        },
      ]),
    ).toBe('sistemas@shfastrecover.com');
  });

  it('recovers legacy split Q-encoded To and Cc address lists', async () => {
    const parsed = await simpleParser(
      'To: =?UTF-8?Q?Alice=20<alice@example.com>,=20Bob=20<bob@example.com>?=\r\n' +
        'Cc: =?UTF-8?Q?Carol=20<carol@example.com>,=20dave@example.com?=\r\n\r\nBody',
    );

    expect(normalizeAddressValue(parsed.to)).toBe(
      'Alice <alice@example.com>, Bob <bob@example.com>',
    );
    expect(normalizeAddressValue(parsed.cc)).toBe('Carol <carol@example.com>, dave@example.com');
  });

  it('decodes B-encoded and folded display names', () => {
    expect(
      normalizeAddressValue('=?UTF-8?B?Sm9zw6k=?=\r\n =?UTF-8?B?IFDDqXJleg==?= <jose@example.com>'),
    ).toBe('José Pérez <jose@example.com>');
  });

  it('preserves valid mixed named and bare address lists', () => {
    expect(
      normalizeAddressValue([
        { name: 'Alice', address: 'alice@example.com' },
        { name: '', address: 'bob@example.com' },
      ]),
    ).toBe('Alice <alice@example.com>, bob@example.com');
  });

  it('returns empty strings for null or absent address values', () => {
    expect(normalizeAddressValue(null)).toBe('');
    expect(normalizeAddressValue(undefined)).toBe('');
    expect(normalizeAddressValue([])).toBe('');
  });

  it('recovers the exact orphan legacy Cc screenshot fragment', () => {
    expectCleanRecipients(
      normalizeAddressValue(',=20acabrera@vimcoretechnologies.com, =20=20='),
      'acabrera@vimcoretechnologies.com',
    );
  });

  it('decodes every unterminated legacy Cc continuation from Mailparser values', () => {
    const mailparserCc = {
      value: [
        { name: '', address: '=?UTF-8?Q?first@example.com' },
        { name: '', address: '=20acabrera@vimcoretechnologies.com' },
        { name: '=20=20=', address: '' },
      ],
    };

    expectCleanRecipients(
      normalizeAddressValue(mailparserCc),
      'first@example.com, acabrera@vimcoretechnologies.com',
    );
  });

  it('recovers malformed Cc continuations from IMAP envelope arrays', () => {
    const envelopeCc = [
      { name: '', address: '=?UTF-8?Q?first@example.com' },
      { name: '', address: '=20acabrera@vimcoretechnologies.com' },
      { name: '=20=20=', address: '' },
    ];

    expectCleanRecipients(
      normalizeAddressValue(envelopeCc),
      'first@example.com, acabrera@vimcoretechnologies.com',
    );
  });

  it('flattens repeated Cc AddressObjects before legacy normalization', () => {
    const repeatedCc = [
      { value: [{ name: 'Primary', address: 'primary@example.com' }] },
      {
        value: [
          { name: '', address: '=?UTF-8?Q?first@example.com' },
          { name: '', address: '=20acabrera@vimcoretechnologies.com' },
          { name: '=20=20=', address: '' },
        ],
      },
    ];

    expectCleanRecipients(
      normalizeAddressValue(repeatedCc),
      'Primary <primary@example.com>, first@example.com, acabrera@vimcoretechnologies.com',
    );
  });

  it('decodes every B-encoded continuation while its malformed context remains active', () => {
    expectCleanRecipients(
      normalizeAddressValue([
        { name: '', address: '=?UTF-8?B?Zmlyc3RAZXhhbXBsZS5jb20' },
        { name: '', address: 'c2Vjb25kQGV4YW1wbGUuY29t' },
        { name: '', address: 'dGhpcmRAZXhhbXBsZS5jb20=?=' },
      ]),
      'first@example.com, second@example.com, third@example.com',
    );
  });

  it('preserves legal equals signs in mailbox local parts outside legacy context', () => {
    expect(normalizeAddressValue('billing=20code@example.com')).toBe('billing=20code@example.com');
    expect(normalizeAddressValue([{ name: '', address: 'billing=20code@example.com' }])).toBe(
      'billing=20code@example.com',
    );
  });
});
