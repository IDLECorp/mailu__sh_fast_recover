import { describe, expect, it } from 'vitest';
import { validateRecipientFields } from './recipient-validation';

describe('recipient validation for compose flows', () => {
  for (const flow of ['Redactar', 'Responder', 'Reenviar']) {
    it(`${flow} accepts valid To, Cc and Bcc lists`, () => {
      expect(
        validateRecipientFields({
          to: 'cuenta@dominio.com; segunda@otro.net',
          cc: 'copia@dominio.org, otra@dominio.co',
          bcc: 'oculta@dominio.com',
        }),
      ).toBeNull();
    });

    it(`${flow} rejects a recipient without a TLD in To, Cc or Bcc`, () => {
      expect(validateRecipientFields({ to: 'cuenta@dominio' })).toMatch(/Para/);
      expect(validateRecipientFields({ to: 'ok@dominio.com', cc: 'cuenta@dominio' })).toMatch(/Cc/);
      expect(validateRecipientFields({ to: 'ok@dominio.com', bcc: 'cuenta@dominio' })).toMatch(/Cco/);
    });

    it(`${flow} rejects invalid list elements instead of silently skipping them`, () => {
      expect(validateRecipientFields({ to: 'ok@dominio.com, ,otro@dominio.com' })).toMatch(/Para/);
      expect(validateRecipientFields({ to: 'ok@dominio.com;cuenta@dominio' })).toMatch(/Para/);
    });
  }

  it('rejects CRLF in recipient values', () => {
    expect(validateRecipientFields({ to: 'ok@dominio.com\r\nBcc: atacante@dominio.com' })).toMatch(/Para/);
  });

  it('accepts display names and commas inside quoted names', () => {
    expect(
      validateRecipientFields({
        to: 'Alice <alice@example.com>, "Doe, Bob" <bob@example.net>',
        cc: 'Carol <carol@example.org>; plain@example.co',
        bcc: '"Team, QA" <qa@example.dev>',
      }),
    ).toBeNull();
  });

  it('rejects malformed display names, empty entries, and header injection', () => {
    expect(validateRecipientFields({ to: 'Alice <alice@example.com> garbage' })).toMatch(/Para/);
    expect(validateRecipientFields({ to: 'Alice <alice@example.com>, ; bob@example.com' })).toMatch(/Para/);
    expect(validateRecipientFields({ cc: 'Alice <alice@example.com>\r\nBcc: evil@example.com' })).toMatch(/Cc/);
    expect(validateRecipientFields({ bcc: '"Unclosed <evil@example.com>' })).toMatch(/Cco/);
  });

  it('applies the TLD rule to display names in every recipient field', () => {
    expect(validateRecipientFields({ to: 'Alice <alice@example>' })).toMatch(/Para/);
    expect(validateRecipientFields({ to: 'ok@example.com', cc: 'Bob <bob@example>' })).toMatch(/Cc/);
    expect(validateRecipientFields({ to: 'ok@example.com', bcc: 'Eve <eve@example>' })).toMatch(/Cco/);
  });
});
