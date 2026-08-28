import { simpleParser } from 'mailparser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizeAddressValue } from './address-normalization';
import { PurgeTrashError, purgeTrash } from './imap';

const imapClientMock = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));

vi.mock('imapflow', () => ({
  ImapFlow: class {
    constructor() {
      Object.assign(this, imapClientMock.current ?? {});
    }
  },
}));

function createImapMock({
  initialCount = 2,
  remainingUids = [],
  uids = [11, 12],
  failedUid,
  hasUidPlus = true,
}: {
  initialCount?: number;
  remainingUids?: number[];
  uids?: number[] | false;
  failedUid?: number;
  hasUidPlus?: boolean;
} = {}) {
  const flagsAdd = vi.fn(async (uid: string) => {
    if (Number(uid) === failedUid) throw new Error('store failed');
    return true;
  });
  const search = vi
    .fn()
    .mockResolvedValueOnce(uids)
    .mockResolvedValueOnce(remainingUids);
  const client = {
    capabilities: new Map(hasUidPlus ? [['UIDPLUS', true]] : []),
    connect: vi.fn(),
    logout: vi.fn().mockResolvedValue(undefined),
    getMailboxLock: vi.fn().mockResolvedValue({ release: vi.fn() }),
    status: vi
      .fn()
      .mockResolvedValueOnce({ messages: initialCount })
      .mockResolvedValue({ messages: remainingUids.length }),
    search,
    messageFlagsAdd: flagsAdd,
    exec: vi.fn().mockResolvedValue({}),
    messageDelete: vi.fn(),
  };
  imapClientMock.current = client;
  return client;
}

beforeEach(() => {
  imapClientMock.current = null;
});

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

  it('normalizes Bcc from parsed draft headers', async () => {
    const parsed = await simpleParser('Bcc: hidden@example.com\r\n\r\nDraft');

    expect(normalizeAddressValue(parsed.bcc)).toBe('hidden@example.com');
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

describe('purgeTrash', () => {
  it('marks each Trash UID once, expunges once, and returns the original count', async () => {
    const client = createImapMock();

    await expect(purgeTrash({ user: 'user@example.com', pass: 'secret' })).resolves.toBe(2);

    expect(client.messageFlagsAdd).toHaveBeenCalledTimes(2);
    expect(client.messageFlagsAdd).toHaveBeenNthCalledWith(1, '11', ['\\Deleted'], { uid: true });
    expect(client.messageFlagsAdd).toHaveBeenNthCalledWith(2, '12', ['\\Deleted'], { uid: true });
    expect(client.exec).toHaveBeenCalledTimes(1);
    expect(client.exec).toHaveBeenCalledWith('UID EXPUNGE', [
      { type: 'SEQUENCE', value: '11,12' },
    ]);
    expect(client.messageDelete).not.toHaveBeenCalled();
  });

  it('rejects with a safe error when a UID fails or messages remain', async () => {
    const client = createImapMock({ failedUid: 12, remainingUids: [12] });

    const result = purgeTrash({ user: 'user@example.com', pass: 'secret' });

    await expect(result).rejects.toBeInstanceOf(PurgeTrashError);
    await expect(result).rejects.toMatchObject({ failedUids: [12], remainingUids: [12] });
    await expect(result).rejects.not.toHaveProperty('message', 'store failed');
    expect(client.messageFlagsAdd).toHaveBeenCalledTimes(2);
    expect(client.exec).toHaveBeenCalledTimes(1);
  });

  it('does not perform an unsafe expunge without UIDPLUS', async () => {
    const client = createImapMock({ hasUidPlus: false });

    await expect(purgeTrash({ user: 'user@example.com', pass: 'secret' })).rejects.toBeInstanceOf(
      PurgeTrashError,
    );

    expect(client.messageFlagsAdd).not.toHaveBeenCalled();
    expect(client.exec).not.toHaveBeenCalled();
  });
});
