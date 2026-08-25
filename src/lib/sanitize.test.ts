import { describe, expect, it } from 'vitest';

import { buildReplyHeaders, buildReplySubject, extractEmail, rewriteCidImages } from './sanitize';

describe('email helpers', () => {
  it('extracts an address from a display-name value and trims bare addresses', () => {
    expect(extractEmail('Jane Doe <jane@example.com>')).toBe('jane@example.com');
    expect(extractEmail('  jane@example.com  ')).toBe('jane@example.com');
  });

  it('adds a reply prefix only when one is not already present', () => {
    expect(buildReplySubject('Status update')).toBe('Re: Status update');
    expect(buildReplySubject('RE: Status update')).toBe('RE: Status update');
  });

  it('rewrites CID image sources with encoded attachment parameters', () => {
    expect(rewriteCidImages('<img src="cid:<logo@example.com>">', 42, 'Shared/Inbox')).toBe(
      '<img src="/api/attachment?uid=42&mailbox=Shared%2FInbox&cid=logo%40example.com">',
    );
  });

  it('quotes each reply header line', () => {
    expect(buildReplyHeaders('From: Jane\nSent: Monday')).toBe('> From: Jane\n> Sent: Monday');
  });
});
