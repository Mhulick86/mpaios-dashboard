import path from 'node:path';

export type EtlProfile = 'document' | 'tabular' | 'web' | 'transcript' | 'records' | 'text';

const DOC_EXT = new Set(['.pdf', '.docx', '.md', '.markdown', '.txt', '.html', '.htm', '.rtf']);
const TAB_EXT = new Set(['.csv', '.tsv', '.xlsx', '.xls']);
const AUDIO_EXT = new Set(['.mp3', '.m4a', '.wav', '.ogg', '.webm', '.mp4', '.flac']);

export function detectProfile(input: { sourceType: string; sourceUri?: string | null; mimeType?: string | null; text?: string | null; requested?: string }): EtlProfile {
  const requested = input.requested && input.requested !== 'auto' ? (input.requested as EtlProfile) : null;
  if (requested) return requested;
  if (input.sourceType === 'url') return 'web';
  if (input.sourceType === 'text') {
    const t = (input.text || '').trim();
    if (t.startsWith('[') || t.startsWith('{')) { try { JSON.parse(t); return 'records'; } catch { /* not json */ } }
    return 'text';
  }
  const ext = path.extname(input.sourceUri || '').toLowerCase();
  if (ext === '.json' || ext === '.jsonl' || ext === '.ndjson') return 'records';
  if (TAB_EXT.has(ext)) return 'tabular';
  if (AUDIO_EXT.has(ext)) return 'transcript';
  if (DOC_EXT.has(ext)) return 'document';
  const mime = (input.mimeType || '').toLowerCase();
  if (mime.startsWith('audio/') || mime.startsWith('video/')) return 'transcript';
  if (mime.includes('csv') || mime.includes('spreadsheet') || mime.includes('excel')) return 'tabular';
  if (mime.includes('json')) return 'records';
  return 'document';
}

export function mimeFor(uri: string): string {
  const ext = path.extname(uri).toLowerCase();
  return ({ '.pdf': 'application/pdf', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.md': 'text/markdown', '.txt': 'text/plain', '.html': 'text/html', '.htm': 'text/html', '.csv': 'text/csv', '.tsv': 'text/tab-separated-values', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.json': 'application/json', '.jsonl': 'application/x-ndjson', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.wav': 'audio/wav', '.mp4': 'video/mp4' } as Record<string, string>)[ext] || 'application/octet-stream';
}
