import { describe, expect, it } from 'vitest';
import { parseStyleAttribute, serializeComposedStyle } from './compose-format';
import { sanitizeComposedEmailHtml } from './sanitize';

describe('rich-text compose pipeline', () => {
  it('removes active content and canonicalizes allowed formatting and links', () => {
    const sanitized = sanitizeComposedEmailHtml(
      '<div onclick="alert(1)" style="position: fixed; color: rgb(0, 106, 47); margin-left: 999px">' +
        '<script>alert(1)</script>' +
        '<a href="javascript:alert(1)" target="_self">unsafe</a>' +
        '<a href="https://example.com/path" target="_self" rel="bad">safe</a>' +
        '<img src="x" onerror="alert(1)">' +
        '</div>',
    );

    expect(sanitized).not.toMatch(/script|onclick|javascript:|onerror|<img|position:/i);
    expect(sanitized).toContain('style="color: #006a2f; margin-left: 120px"');
    expect(sanitized).toContain('unsafe');
    expect(sanitized).toContain(
      '<a href="https://example.com/path" target="_blank" rel="noopener noreferrer">safe</a>',
    );
  });

  it('is idempotent after sanitization and normalization', () => {
    const input =
      '<DIV STYLE="padding-left: 200px; color: #ABC">' +
      '<A REL="bad" TARGET="_self" HREF="mailto:o\'brien@urbaterra.ec">Hello</A>' +
      '</DIV>';
    const once = sanitizeComposedEmailHtml(input);

    expect(sanitizeComposedEmailHtml(once)).toBe(once);
    expect(once).toContain('style="color: #aabbcc; padding-left: 120px"');
    expect(once).toContain('href="mailto:o%27brien@urbaterra.ec"');
  });

  it('bounds style values and clamps indentation before canonical serialization', () => {
    const overlongColor = `#${'a'.repeat(64)}`;
    const parsed = parseStyleAttribute(
      `color: ${overlongColor}; margin-left: -10px; padding-left: 8em; ` +
        'font-size: 17px; background-color: rgb(255, 0, 128)',
    );

    expect(parsed).toEqual({
      backgroundColor: '#ff0080',
      marginLeft: '0px',
      paddingLeft: '120px',
    });
    expect(serializeComposedStyle(parsed)).toBe(
      'background-color: #ff0080; margin-left: 0px; padding-left: 120px',
    );
  });

  it('preserves supported rich styles and ordered-list formatting', () => {
    const sanitized = sanitizeComposedEmailHtml(
      '<ol><li><em><s><u><span style="color: #123456; background-color: #abcdef">Styled</span></u></s></em></li></ol>',
    );

    expect(sanitized).toContain('<ol>');
    expect(sanitized).toContain('<li>');
    expect(sanitized).toContain('<em>');
    expect(sanitized).toContain('<s>');
    expect(sanitized).toContain('<u>');
    expect(sanitized).toContain('style="color: #123456; background-color: #abcdef"');
  });

  // [Fast Mail] Garantía de regresión para el riesgo CRÍTICO del cliente:
  // el formato aplicado desde la toolbar (Squire RTE) debe sobrevivir al
  // saneador de envío (servidor). Cada caso usa la salida real que Squire
  // emite para esa acción. Si alguno de estos se rompe, el usuario pierde
  // negrita/tamaño/fuente/color al enviar.
  const RICH_FORMAT_CASES: Array<[string, string, (out: string) => boolean]> = [
    ['negrita <b>', '<div><b>hola</b></div>', (o) => o.includes('<b>hola</b>')],
    ['negrita <strong>', '<div><strong>hola</strong></div>', (o) => o.includes('<strong>hola</strong>')],
    ['cursiva <i>', '<div><i>hola</i></div>', (o) => o.includes('<i>hola</i>')],
    ['cursiva <em>', '<div><em>hola</em></div>', (o) => o.includes('<em>hola</em>')],
    ['subrayado <u>', '<div><u>hola</u></div>', (o) => o.includes('<u>hola</u>')],
    ['tachado <s>', '<div><s>hola</s></div>', (o) => o.includes('<s>hola</s>')],
    ['tamaño de fuente', '<div><span style="font-size: 14px">hola</span></div>', (o) => o.includes('font-size: 14px')],
    ['familia de fuente', '<div><span style="font-family: Arial, Helvetica, sans-serif">hola</span></div>', (o) => o.includes('font-family: Arial, Helvetica, sans-serif')],
    ['color de texto', '<div><span style="color: #cc0000">hola</span></div>', (o) => o.includes('color: #cc0000')],
    ['color de fondo', '<div><span style="background-color: #ffd966">hola</span></div>', (o) => o.includes('background-color: #ffd966')],
    ['alineación', '<div style="text-align: center">hola</div>', (o) => o.includes('text-align: center')],
    ['lista ordenada', '<ol><li>uno</li><li>dos</li></ol>', (o) => o.includes('<ol>') && o.includes('<li>uno</li>')],
    ['lista de viñetas', '<ul><li>a</li></ul>', (o) => o.includes('<ul>') && o.includes('<li>a</li>')],
    ['sangría', '<div style="margin-left: 40px">hola</div>', (o) => o.includes('margin-left: 40px')],
    ['enlace', '<a href="https://ejemplo.com">x</a>', (o) => o.includes('href="https://ejemplo.com"')],
    ['combinado', '<div style="text-align: right"><b><span style="color: #006a2f; font-size: 18px">Importante</span></b></div>', (o) => o.includes('<b>') && o.includes('color: #006a2f') && o.includes('font-size: 18px') && o.includes('text-align: right')],
  ];

  for (const [name, input, assert] of RICH_FORMAT_CASES) {
    it(`conserva al enviar: ${name}`, () => {
      const out = sanitizeComposedEmailHtml(input);
      expect(assert(out), `input=${input}\noutput=${out}`).toBe(true);
    });
  }
});
