import DOMPurify from 'dompurify';

/**
 * Sanitize HTML string to prevent XSS attacks.
 * Strips dangerous tags/attributes while preserving safe formatting.
 */
export function sanitizeHTML(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'br', 'hr',
      'ul', 'ol', 'li',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'strong', 'em', 'b', 'i', 'u', 's',
      'a', 'span', 'div', 'pre', 'code',
      'sub', 'sup',
    ],
    ALLOWED_ATTR: [
      'href',
      'colspan', 'rowspan',
    ],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|\/|#)/i,
    FORBID_ATTR: ['style', 'id', 'class', 'src', 'srcset'],
  });
}
