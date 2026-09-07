export interface Chunk { index: number; heading: string | null; content: string; tokenEstimate: number }
export interface ChunkOptions { max_chars?: number; overlap?: number; strategy?: 'heading' | 'fixed' }

/** Heading-aware chunker: splits on markdown headings / blank-line paragraphs, packs to max_chars, overlaps by `overlap` chars. */
export function chunkText(text: string, opts: ChunkOptions = {}): Chunk[] {
  const max = opts.max_chars ?? 1800;
  const overlap = opts.overlap ?? 200;
  const clean = text.replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!clean) return [];
  const blocks: { heading: string | null; text: string }[] = [];
  let heading: string | null = null;
  for (const para of clean.split(/\n\n+/)) {
    const h = /^(#{1,6})\s+(.*)$/.exec(para.trim());
    if (h && opts.strategy !== 'fixed') { heading = h[2].trim(); if (para.trim().split('\n').length === 1) continue; }
    blocks.push({ heading, text: para.trim() });
  }
  const chunks: Chunk[] = [];
  let buf = ''; let bufHeading: string | null = null;
  const flush = () => { if (buf.trim()) chunks.push({ index: chunks.length, heading: bufHeading, content: buf.trim(), tokenEstimate: Math.ceil(buf.length / 4) }); };
  for (const b of blocks) {
    const pieces = b.text.length > max ? splitLong(b.text, max) : [b.text];
    for (const piece of pieces) {
      if (buf && (buf.length + piece.length + 2 > max || (bufHeading !== b.heading && buf.length > max * 0.5))) {
        flush();
        buf = overlap > 0 ? buf.slice(-overlap) + '\n\n' : '';
      }
      if (!buf.trim()) bufHeading = b.heading;
      buf += (buf ? '\n\n' : '') + piece;
    }
  }
  flush();
  return chunks;
}

function splitLong(text: string, max: number): string[] {
  const out: string[] = [];
  const sentences = text.split(/(?<=[.!?])\s+/);
  let cur = '';
  for (const s of sentences) {
    if (s.length > max) { if (cur) { out.push(cur); cur = ''; } for (let i = 0; i < s.length; i += max) out.push(s.slice(i, i + max)); continue; }
    if (cur.length + s.length + 1 > max) { out.push(cur); cur = s; } else cur += (cur ? ' ' : '') + s;
  }
  if (cur) out.push(cur);
  return out;
}

/** Turn a tabular row into a readable line for embedding / summaries. */
export function rowToText(row: Record<string, unknown>, maxLen = 1500): string {
  return Object.entries(row).filter(([k, v]) => !k.startsWith('_') && v !== null && v !== '' && v !== undefined)
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`).join(' | ').slice(0, maxLen);
}
