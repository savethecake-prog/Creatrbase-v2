/**
 * sanitizeHtml.js
 * Zero-dependency browser-side HTML sanitizer.
 * Uses the browser's DOMParser to strip <script> tags and inline event
 * handlers (onclick, onerror, etc.) before rendering untrusted HTML.
 * Suitable for CMS-authored blog content.
 */

const DANGEROUS_TAGS = ['script', 'iframe', 'object', 'embed', 'form', 'base'];

export function sanitizeHtml(html) {
  if (!html || typeof html !== 'string') return '';

  // Parse into a document fragment via DOMParser (no network requests)
  const parser = new DOMParser();
  const doc    = parser.parseFromString(html, 'text/html');

  // Remove dangerous tags
  DANGEROUS_TAGS.forEach(tag => {
    doc.querySelectorAll(tag).forEach(el => el.remove());
  });

  // Strip all inline event handlers from every element
  doc.body.querySelectorAll('*').forEach(el => {
    for (const attr of [...el.attributes]) {
      if (attr.name.startsWith('on') || attr.value.toLowerCase().startsWith('javascript:')) {
        el.removeAttribute(attr.name);
      }
    }
  });

  return doc.body.innerHTML;
}
