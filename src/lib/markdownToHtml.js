'use strict';

/**
 * Minimal markdown-to-HTML converter for agent-generated content.
 * Handles: headings (##, ###), bold, italic, links, bullet lists, paragraphs.
 * Not a full spec implementation — tuned for predictable agent output.
 */
function markdownToHtml(md) {
  if (!md) return '';

  const lines = md.split('\n');
  const html = [];
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Headings
    if (line.startsWith('### ')) {
      if (inList) { html.push('</ul>'); inList = false; }
      html.push(`<h3>${inline(line.slice(4))}</h3>`);
      continue;
    }
    if (line.startsWith('## ')) {
      if (inList) { html.push('</ul>'); inList = false; }
      html.push(`<h2>${inline(line.slice(3))}</h2>`);
      continue;
    }
    if (line.startsWith('# ')) {
      if (inList) { html.push('</ul>'); inList = false; }
      html.push(`<h1>${inline(line.slice(2))}</h1>`);
      continue;
    }

    // List items
    if (line.match(/^[-*] /)) {
      if (!inList) { html.push('<ul>'); inList = true; }
      html.push(`<li>${inline(line.slice(2))}</li>`);
      continue;
    }

    // End list on non-list line
    if (inList && line.trim() !== '') {
      html.push('</ul>');
      inList = false;
    }

    // Empty line = paragraph break
    if (line.trim() === '') {
      if (inList) { html.push('</ul>'); inList = false; }
      continue;
    }

    // Regular paragraph
    html.push(`<p>${inline(line)}</p>`);
  }

  if (inList) html.push('</ul>');

  return html.join('\n');
}

function inline(text) {
  return text
    // Links: [text](url)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    // Bold: **text**
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // Italic: *text* (not preceded/followed by *)
    .replace(/(?<!\*)\*(?!\*)([^*]+)(?<!\*)\*(?!\*)/g, '<em>$1</em>')
    // Escape remaining < and > that aren't already tags
    .replace(/</g, (m, offset, str) => {
      // Already an HTML tag — leave it
      if (str.slice(offset).match(/^<\/?[a-zA-Z]/)) return m;
      return '&lt;';
    });
}

module.exports = { markdownToHtml };
