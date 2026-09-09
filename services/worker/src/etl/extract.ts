/**
 * Extractors: turn any supported source into either text (documents) or rows (tabular/records).
 * Everything here is deterministic; the LLM is only used later in normalize.ts.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { convert as htmlToText } from 'html-to-text';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { transcribe } from '../model/gateway.ts';
import type { EtlProfile } from './detect.ts';

const require = createRequire(import.meta.url);

export interface Extraction {
  text?: string;                       // for document/web/text/transcript
  rows?: Record<string, unknown>[];    // for tabular/records
  title?: string;
  meta: Record<string, unknown>;
}

export async function extract(profile: EtlProfile, src: { filePath?: string; url?: string; text?: string; title?: string }): Promise<Extraction> {
  switch (profile) {
    case 'text':
      return { text: src.text || '', title: src.title, meta: { parser: 'inline' } };
    case 'web':
      return extractUrl(src.url!);
    case 'transcript': {
      const text = await transcribe(src.filePath!);
      return { text, title: src.title || path.basename(src.filePath!), meta: { parser: 'lmstudio-whisper' } };
    }
    case 'tabular':
      return extractTabular(src.filePath!);
    case 'records':
      return extractRecords(src);
    case 'document':
    default:
      return extractDocument(src.filePath!, src.title);
  }
}

async function extractDocument(filePath: string, title?: string): Promise<Extraction> {
  const ext = path.extname(filePath).toLowerCase();
  const base = title || path.basename(filePath, ext);
  if (ext === '.pdf') {
    const pdfParse = require('pdf-parse') as (b: Buffer) => Promise<{ text: string; numpages: number; info?: unknown }>;
    const data = await pdfParse(await fs.readFile(filePath));
    return { text: data.text, title: base, meta: { parser: 'pdf-parse', pages: data.numpages } };
  }
  if (ext === '.docx') {
    const mammoth = await import('mammoth');
    const r = await mammoth.convertToHtml({ path: filePath });
    // Keep headings as markdown so the chunker can use them.
    const html = r.value.replace(/<h([1-6])[^>]*>(.*?)<\/h\1>/gis, (_m: string, lvl: string, t: string) => `<p>${'#'.repeat(Number(lvl))} ${t.replace(/<[^>]+>/g, '')}</p>`);
    const text = htmlToText(html, { wordwrap: false, selectors: [{ selector: 'a', options: { ignoreHref: true } }, { selector: 'img', format: 'skip' }] });
    return { text, title: base, meta: { parser: 'mammoth', warnings: r.messages.map((m: { message: string }) => m.message).slice(0, 10) } };
  }
  if (ext === '.html' || ext === '.htm') {
    const html = await fs.readFile(filePath, 'utf8');
    return { text: htmlToText(html, { wordwrap: false, selectors: [{ selector: 'a', options: { ignoreHref: true } }, { selector: 'img', format: 'skip' }] }), title: base, meta: { parser: 'html-to-text' } };
  }
  const text = await fs.readFile(filePath, 'utf8');
  return { text, title: base, meta: { parser: 'utf8' } };
}

async function extractUrl(url: string): Promise<Extraction> {
  const res = await fetch(url, { headers: { 'user-agent': 'MAIOS-ETL/0.1 (+https://marketingpowered.ai)' }, redirect: 'follow' });
  if (!res.ok) throw new Error(`fetch ${url} -> ${res.status}`);
  const ctype = res.headers.get('content-type') || '';
  if (ctype.includes('application/json')) {
    const json = await res.json();
    return { rows: Array.isArray(json) ? json : [json], title: url, meta: { parser: 'json-url' } };
  }
  const html = await res.text();
  const title = /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1]?.trim() || url;
  const text = htmlToText(html, { wordwrap: false, selectors: [{ selector: 'nav', format: 'skip' }, { selector: 'footer', format: 'skip' }, { selector: 'script', format: 'skip' }, { selector: 'style', format: 'skip' }, { selector: 'a', options: { ignoreHref: true } }, { selector: 'img', format: 'skip' }] });
  return { text, title, meta: { parser: 'html-to-text', url, contentType: ctype } };
}

async function extractTabular(filePath: string): Promise<Extraction> {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.xlsx' || ext === '.xls') {
    const wb = XLSX.read(await fs.readFile(filePath), { type: 'buffer' });
    const rows: Record<string, unknown>[] = [];
    for (const name of wb.SheetNames) {
      for (const r of XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[name], { defval: null })) rows.push({ _sheet: name, ...r });
    }
    return { rows, title: path.basename(filePath), meta: { parser: 'xlsx', sheets: wb.SheetNames } };
  }
  const csv = await fs.readFile(filePath, 'utf8');
  const parsed = Papa.parse<Record<string, unknown>>(csv, { header: true, dynamicTyping: true, skipEmptyLines: true, delimiter: ext === '.tsv' ? '\t' : undefined });
  return { rows: parsed.data, title: path.basename(filePath), meta: { parser: 'papaparse', errors: parsed.errors.slice(0, 5) } };
}

async function extractRecords(src: { filePath?: string; text?: string; title?: string }): Promise<Extraction> {
  const raw = src.text ?? (await fs.readFile(src.filePath!, 'utf8'));
  const trimmed = raw.trim();
  let rows: Record<string, unknown>[];
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    const json = JSON.parse(trimmed);
    rows = Array.isArray(json) ? json : (Array.isArray(json.data) ? json.data : [json]);
  } else {
    rows = trimmed.split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l));
  }
  return { rows, title: src.title || (src.filePath ? path.basename(src.filePath) : 'records'), meta: { parser: 'json' } };
}
