import { describe, expect, it } from 'vitest';
import {
  guardComposedHtml,
  MAX_COMPOSED_HTML_BYTES,
  MAX_HTML_NESTING_DEPTH,
  MAX_HTML_TAG_COUNT,
} from './compose-html-guard';

describe('guardComposedHtml', () => {
  it('accepts repeated void elements without increasing nesting depth', () => {
    const html = '<br><IMG alt="x"><hr/><input disabled>'.repeat(MAX_HTML_NESTING_DEPTH + 1);

    expect(guardComposedHtml(html)).toEqual({ ok: true });
  });

  it('does not let mismatched closing tags evade the depth limit', () => {
    const html = '<div></span>'.repeat(MAX_HTML_NESTING_DEPTH) + '<div>';

    expect(guardComposedHtml(html)).toEqual({ ok: false, reason: 'too_deep' });
  });

  it('rejects doubled opening brackets before sanitization', () => {
    const html = '<<div>'.repeat(1_000);

    expect(guardComposedHtml(html)).toEqual({ ok: false, reason: 'too_deep' });
  });

  it('treats a trailing slash on a non-void element as an opening tag', () => {
    const html = '<div/>'.repeat(MAX_HTML_NESTING_DEPTH + 1);

    expect(guardComposedHtml(html)).toEqual({ ok: false, reason: 'too_deep' });
  });

  it('accepts balanced mixed-case tags with attributes and whitespace', () => {
    const openings = Array.from(
      { length: MAX_HTML_NESTING_DEPTH },
      (_, index) => `  <DiV data-level="${index}" >`,
    ).join('');
    const closings = ' </DIV   > '.repeat(MAX_HTML_NESTING_DEPTH);

    expect(guardComposedHtml(`${openings}content${closings}`)).toEqual({ ok: true });
  });

  it('enforces the exact nesting-depth boundary', () => {
    expect(guardComposedHtml('<div>'.repeat(MAX_HTML_NESTING_DEPTH))).toEqual({ ok: true });
    expect(guardComposedHtml('<div>'.repeat(MAX_HTML_NESTING_DEPTH + 1))).toEqual({
      ok: false,
      reason: 'too_deep',
    });
  });

  it('enforces the exact tag-count boundary', () => {
    expect(guardComposedHtml('<br>'.repeat(MAX_HTML_TAG_COUNT))).toEqual({ ok: true });
    expect(guardComposedHtml('<br>'.repeat(MAX_HTML_TAG_COUNT + 1))).toEqual({
      ok: false,
      reason: 'too_many_tags',
    });
  });

  it('enforces the exact UTF-8 byte boundary', () => {
    const atLimit = 'é'.repeat(MAX_COMPOSED_HTML_BYTES / 2);

    expect(guardComposedHtml(atLimit)).toEqual({ ok: true });
    expect(guardComposedHtml(`${atLimit}x`)).toEqual({
      ok: false,
      reason: 'too_large',
    });
  });
});
