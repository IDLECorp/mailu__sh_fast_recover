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
});
