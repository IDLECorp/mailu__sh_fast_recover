import { simpleParser, type AddressObject, type EmailAddress } from 'mailparser';
import { describe, expect, it } from 'vitest';
import { buildMime } from './email';

function addressValues(
  value: AddressObject | AddressObject[] | undefined,
): EmailAddress[] | undefined {
  if (!value) return undefined;
  return (Array.isArray(value) ? value : [value]).flatMap((address) => address.value);
}

describe('buildMime address headers', () => {
  it('buildMime emits structured From To Cc and Bcc headers without whole-field encoded words', () => {
    const raw = buildMime('Sender <sender@example.com>', {
      to: 'Alice <alice@example.com>; bob@example.com',
      cc: 'Carol <carol@example.com>, dave@example.com',
      bcc: 'hidden@example.com',
      subject: 'Status',
      text: 'Body',
    });

    expect(raw).toContain('From: Sender <sender@example.com>');
    expect(raw).toContain('To: Alice <alice@example.com>, bob@example.com');
    expect(raw).toContain('Cc: Carol <carol@example.com>, dave@example.com');
    expect(raw).toContain('Bcc: hidden@example.com');
    expect(raw).not.toMatch(/^(From|To|Cc|Bcc): =\?/m);
  });

  it('buildMime round-trips multiple To and Cc addresses through simpleParser', async () => {
    const raw = buildMime('sender@example.com', {
      to: 'Álice <alice@example.com>, bob@example.com',
      cc: 'Carol <carol@example.com>; dave@example.com',
      subject: 'Status',
      text: 'Body',
    });

    const parsed = await simpleParser(raw);

    expect(addressValues(parsed.to)).toEqual([
      { name: 'Álice', address: 'alice@example.com' },
      { name: '', address: 'bob@example.com' },
    ]);
    expect(addressValues(parsed.cc)).toEqual([
      { name: 'Carol', address: 'carol@example.com' },
      { name: '', address: 'dave@example.com' },
    ]);
    expect(raw).toMatch(/To: =\?UTF-8\?[QB]\?.+\?= <alice@example\.com>, bob@example\.com/);
  });

  it('buildMime preserves Unicode subject decoding while leaving bare addresses parseable', async () => {
    const raw = buildMime('sistemas@shfastrecover.com', {
      to: 'destino@example.com',
      subject: 'Actualización técnica',
      text: 'Body',
    });

    const parsed = await simpleParser(raw);

    expect(parsed.subject).toBe('Actualización técnica');
    expect(addressValues(parsed.from)).toEqual([
      { name: '', address: 'sistemas@shfastrecover.com' },
    ]);
    expect(addressValues(parsed.to)).toEqual([{ name: '', address: 'destino@example.com' }]);
    expect(raw).toContain('Subject: =?UTF-8?');
    expect(raw).toContain('From: sistemas@shfastrecover.com');
    expect(raw).toContain('To: destino@example.com');
  });

  it('rejects CR/LF injection in structured address headers', () => {
    expect(() =>
      buildMime('sender@example.com', {
        to: 'victim@example.com\r\nBcc: attacker@example.com',
        subject: 'Status',
        text: 'Body',
      }),
    ).toThrow(/header/i);
  });

  it('omits To for a recipientless draft instead of emitting an invalid placeholder', async () => {
    const raw = buildMime('sender@example.com', {
      to: '',
      subject: 'Draft',
      text: 'Body',
    });

    expect(raw).not.toMatch(/^To:/m);
    expect((await simpleParser(raw)).to).toBeUndefined();
  });

  it('buildMime parses a plain-first alternative into both text and styled HTML', async () => {
    const html =
      '<ol><li><span style="color: #123456; background-color: #abcdef"><em><s><u>Styled body</u></s></em></span></li></ol>';
    const raw = buildMime('sender@example.com', {
      to: 'recipient@example.com',
      subject: 'Styled alternative',
      text: 'Plain fallback',
      html,
    });

    const parsed = await simpleParser(raw);

    expect(raw.indexOf('Content-Type: text/plain')).toBeLessThan(
      raw.indexOf('Content-Type: text/html'),
    );
    expect(parsed.text?.trim()).toBe('Plain fallback');
    expect(parsed.html).toContain('Styled body');
    expect(parsed.html).toContain('color: #123456');
    expect(parsed.html).toContain('background-color: #abcdef');
  });

  it('buildMime parses rich HTML and one attachment without leaking attachment data', async () => {
    const attachmentContent = Buffer.from('private-attachment-bytes');
    const attachmentName = 'private-evidence.txt';
    const raw = buildMime(
      'sender@example.com',
      {
        to: 'recipient@example.com',
        subject: 'Rich attachment',
        text: 'Readable plain body',
        html: '<p style="color: #123456"><em>Readable rich body</em></p>',
      },
      [{ filename: attachmentName, contentType: 'text/plain', content: attachmentContent }],
    );

    const parsed = await simpleParser(raw);

    expect(parsed.text?.trim()).toBe('Readable plain body');
    expect(parsed.html).toContain('Readable rich body');
    expect(parsed.attachments).toHaveLength(1);
    expect(parsed.attachments[0].filename).toBe(attachmentName);
    expect(parsed.attachments[0].content).toEqual(attachmentContent);
    expect(parsed.text).not.toContain(attachmentName);
    expect(parsed.text).not.toContain(attachmentContent.toString());
    expect(parsed.html).not.toContain(attachmentName);
    expect(parsed.html).not.toContain(attachmentContent.toString());
  });

  it('buildMime retains plain-only and attachment-free HTML body behavior', async () => {
    const plain = await simpleParser(
      buildMime('sender@example.com', {
        to: 'recipient@example.com',
        subject: 'Plain only',
        text: 'Plain body',
      }),
    );
    const html = await simpleParser(
      buildMime('sender@example.com', {
        to: 'recipient@example.com',
        subject: 'HTML only',
        text: 'HTML fallback',
        html: '<p><strong>HTML body</strong></p>',
      }),
    );

    expect(plain.text?.trim()).toBe('Plain body');
    expect(plain.html).toBe(false);
    expect(html.text?.trim()).toBe('HTML fallback');
    expect(html.html).toContain('<strong>HTML body</strong>');
    expect(html.attachments).toHaveLength(0);
  });
});
