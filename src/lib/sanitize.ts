import { sanitize } from 'isomorphic-dompurify';

const ALLOWED_TAGS = [
  'a', 'abbr', 'address', 'area', 'article', 'aside', 'audio', 'b', 'bdi', 'bdo',
  'blockquote', 'br', 'button', 'canvas', 'caption', 'cite', 'code', 'col', 'colgroup',
  'data', 'datalist', 'dd', 'del', 'details', 'dfn', 'dialog', 'div', 'dl', 'dt',
  'em', 'embed', 'fieldset', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2',
  'h3', 'h4', 'h5', 'h6', 'header', 'hgroup', 'hr', 'i', 'iframe', 'img', 'input',
  'ins', 'kbd', 'label', 'legend', 'li', 'main', 'map', 'mark', 'menu', 'meter', 'nav',
  'ol', 'optgroup', 'option', 'output', 'p', 'picture', 'pre', 'progress', 'q', 'rp',
  'rt', 'ruby', 's', 'samp', 'section', 'select', 'small', 'source', 'span', 'strong',
  'sub', 'summary', 'sup', 'table', 'tbody', 'td', 'template', 'textarea', 'tfoot',
  'th', 'thead', 'time', 'tr', 'track', 'u', 'ul', 'var', 'video', 'wbr'
];

const DISALLOWED_ATTR = ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'javascript:'];

export function sanitizeEmailHtml(html: string): string {
  if (!html) return '';
  const cleaned = sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'style', 'target', 'rel', 'width', 'height', 'class', 'id', 'colspan', 'rowspan', 'cite', 'datetime', 'start', 'type', 'value', 'selected', 'disabled', 'checked'],
    FORBID_ATTR: DISALLOWED_ATTR,
    FORBID_TAGS: ['script', 'object', 'form'],
    ALLOW_DATA_ATTR: false,
    ALLOWED_URI_REGEXP: /^(?:https?|mailto|cid|data:image\/(png|gif|jpeg|webp|svg))/i
  });
  return cleaned.replace(/target=["']?_blank["']?/gi, 'target="_blank" rel="noopener noreferrer"');
}

export function extractEmail(email: string): string {
  const m = email.match(/<([^>]+)>/);
  return (m?.[1] ?? email).trim();
}

export function buildReplySubject(subject: string): string {
  if (/^re:/i.test(subject)) return subject;
  return `Re: ${subject ?? ''}`;
}

export function rewriteCidImages(html: string, uid: number | string, mailbox: string): string {
  if (!html) return html;
  const safeMailbox = encodeURIComponent(mailbox);
  const safeUid = encodeURIComponent(String(uid));
  return html.replace(/cid:([^"')\s]+)/g, (_m, cid: string) => {
    const safeCid = encodeURIComponent(cid.replace(/^<|>$/g, ''));
    return `/api/attachment?uid=${safeUid}&mailbox=${safeMailbox}&cid=${safeCid}`;
  });
}

export function buildReplyHeaders(headerBlock: string): string {
  return headerBlock.split('\n').map((l) => `> ${l}`).join('\n');
}