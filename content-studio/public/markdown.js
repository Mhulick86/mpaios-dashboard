/**
 * Small, dependency-free Markdown renderer for model output.
 * Safety model: every character of the source is HTML-escaped first; only this file's own tags are then added,
 * and links are limited to http(s). Model output is untrusted, so raw HTML in it is always shown as text.
 */
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function inline(raw) {
  let s = esc(raw);
  const codes = [];
  s = s.replace(/`([^`\n]+)`/g, (_, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
  s = s.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, text, url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`);
  s = s.replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>').replace(/__([^_\n]+?)__/g, '<strong>$1</strong>');
  s = s.replace(/(^|[\s(])\*([^*\s][^*\n]*?)\*(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>').replace(/(^|[\s(])_([^_\s][^_\n]*?)_(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>');
  s = s.replace(/\[VERIFY[^\]]*\]/gi, (m) => `<mark class="verify">${m}</mark>`);
  s = s.replace(/^(BLOCK|REVIEW):/, (_, k) => `<span class="flag ${k.toLowerCase()}">${k}</span>`);
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[i]}</code>`);
}
const cells = (line) => line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());

export function renderMarkdown(source) {
  const lines = String(source ?? '').replace(/\r\n?/g, '\n').split('\n');
  const out = []; let para = []; const lists = [];
  const flushPara = () => { if (para.length) { out.push(`<p>${para.map(inline).join('<br>')}</p>`); para = []; } };
  const closeLists = (depth = 0) => { while (lists.length > depth) out.push(`</li></${lists.pop().type}>`); };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = line.match(/^\s*(```|~~~)/);
    if (fence) {
      flushPara(); closeLists();
      const body = []; i++;
      while (i < lines.length && !lines[i].trim().startsWith(fence[1])) body.push(lines[i++]);
      out.push(`<pre><code>${esc(body.join('\n'))}</code></pre>`);
      continue;
    }
    if (!line.trim()) { flushPara(); continue; }
    const item = line.match(/^(\s*)([-*+]|\d{1,3}[.)])\s+(.*)$/);
    if (item) {
      flushPara();
      const indent = item[1].replace(/\t/g, '  ').length, type = /\d/.test(item[2]) ? 'ol' : 'ul';
      while (lists.length && lists.at(-1).indent > indent) out.push(`</li></${lists.pop().type}>`);
      const top = lists.at(-1);
      if (top && top.indent === indent && top.type === type) out.push('</li><li>');
      else { if (top && top.indent === indent) out.push(`</li></${lists.pop().type}>`); out.push(`<${type}><li>`); lists.push({ type, indent }); }
      out.push(inline(item[3]));
      continue;
    }
    if (lists.length && /^\s{2,}\S/.test(line)) { out.push('<br>' + inline(line.trim())); continue; }
    closeLists();
    const heading = line.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/);
    if (heading) { flushPara(); out.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`); continue; }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { flushPara(); out.push('<hr>'); continue; }
    if (/^\s*>/.test(line)) {
      flushPara(); const quote = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) quote.push(lines[i++].replace(/^\s*>\s?/, ''));
      i--; out.push(`<blockquote>${quote.map(inline).join('<br>')}</blockquote>`); continue;
    }
    if (line.includes('|') && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(lines[i + 1] || '')) {
      flushPara();
      const head = cells(line); i += 2; const rows = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) rows.push(cells(lines[i++]));
      i--;
      out.push(`<div class="md-table"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${head.map((_, n) => `<td>${inline(r[n] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }
    para.push(line.trim());
  }
  flushPara(); closeLists();
  return out.join('\n');
}
export const countWords = (s) => (String(s ?? '').trim().match(/\S+/g) || []).length;
