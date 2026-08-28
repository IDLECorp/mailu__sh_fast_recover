import { describe, expect, it } from 'vitest';
import { parseDraftRequest } from './draft-request';
import { validateRecipientFields } from '../recipient-validation';

describe('compose draft request parsing', () => {
  it('preserves forward recipients, copies, subject, and content from FormData', async () => {
    const form = new FormData();
    form.set('to', 'destinatario@example.com');
    form.set('cc', 'copia@example.com');
    form.set('bcc', 'oculta@example.com');
    form.set('subject', 'Fwd: Mensaje original');
    form.set('text', 'Contenido reenviado');
    form.set('html', '');

    await expect(
      parseDraftRequest(new Request('http://localhost/api/compose/draft', { method: 'POST', body: form })),
    ).resolves.toEqual({
      to: 'destinatario@example.com',
      cc: 'copia@example.com',
      bcc: 'oculta@example.com',
      subject: 'Fwd: Mensaje original',
      text: 'Contenido reenviado',
      html: '',
    });
  });

  it('returns null instead of throwing for malformed JSON', async () => {
    await expect(
      parseDraftRequest(
        new Request('http://localhost/api/compose/draft', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{invalid',
        }),
      ),
    ).resolves.toBeNull();
  });

  it('validates draft recipients with the same rules as send', () => {
    expect(validateRecipientFields({ to: 'Alice <alice@example.com>' })).toBeNull();
    expect(validateRecipientFields({ to: 'Alice <alice@example>' })).toMatch(/Para/);
    expect(validateRecipientFields({ to: 'ok@example.com', cc: 'bad@example' })).toMatch(/Cc/);
    expect(validateRecipientFields({ to: 'ok@example.com', bcc: 'bad@example' })).toMatch(/Cco/);
  });

  it('accepts JSON while preserving HTML and blind-copy recipients', async () => {
    await expect(
      parseDraftRequest(
        new Request('http://localhost/api/compose/draft', {
          method: 'POST',
          headers: { 'content-type': 'application/json; charset=utf-8' },
          body: JSON.stringify({
            to: 'destinatario@example.com',
            cc: '',
            bcc: 'oculta@example.com',
            subject: 'Borrador',
            text: 'Texto',
            html: '<div><strong>Texto</strong></div>',
          }),
        }),
      ),
    ).resolves.toMatchObject({
      bcc: 'oculta@example.com',
      html: '<div><strong>Texto</strong></div>',
    });
  });

  it('returns null for malformed FormData instead of propagating a parser error', async () => {
    await expect(
      parseDraftRequest(
        new Request('http://localhost/api/compose/draft', {
          method: 'POST',
          headers: { 'content-type': 'multipart/form-data; boundary=broken' },
          body: '--broken\r\nnot a valid multipart body',
        }),
      ),
    ).resolves.toBeNull();
  });
});
