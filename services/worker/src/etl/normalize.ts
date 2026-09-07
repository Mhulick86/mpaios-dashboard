/**
 * LLM-assisted normalization. Used when a collection defines a record_schema:
 * the ETL agent maps arbitrary rows / text into that schema (JSON), keeping the
 * original payload alongside. Deterministic paths never depend on this.
 */
import { chat } from '../model/gateway.ts';

export async function normalizeRows(rows: Record<string, unknown>[], schema: Record<string, unknown>, opts: { batch?: number } = {}): Promise<Record<string, unknown>[]> {
  const batch = opts.batch ?? 20;
  const out: Record<string, unknown>[] = [];
  for (let i = 0; i < rows.length; i += batch) {
    const slice = rows.slice(i, i + batch);
    const r = await chat([
      { role: 'system', content: 'You are the MAIOS ETL normalizer. Map each input object to the target JSON schema. Preserve values exactly, convert units/dates to ISO 8601, never invent data; use null for unknown fields. Respond with a JSON object {"records":[...]} in the same order as the input.' },
      { role: 'user', content: `Target schema:\n${JSON.stringify(schema)}\n\nInput records:\n${JSON.stringify(slice)}` },
    ], { json: true, temperature: 0 });
    let parsed: { records?: Record<string, unknown>[] } = {};
    try { parsed = JSON.parse(r.text); } catch { parsed = {}; }
    const recs = parsed.records && parsed.records.length === slice.length ? parsed.records : slice;
    recs.forEach((rec, j) => out.push({ ...rec, _source: slice[j] }));
  }
  return out;
}

export async function summarizeForEmbedding(text: string): Promise<string> {
  const r = await chat([
    { role: 'system', content: 'Summarize the record below in 2-3 factual sentences for search indexing. No preamble.' },
    { role: 'user', content: text.slice(0, 6000) },
  ], { temperature: 0, maxTokens: 300 });
  return r.text.trim();
}

/** Classify a free-form document into the best target collection when the caller passed none. */
export async function suggestCollection(text: string, collections: { slug: string; name: string; description: string | null }[]): Promise<string | null> {
  if (!collections.length) return null;
  const r = await chat([
    { role: 'system', content: 'Choose the single best-fitting collection slug for the document. Respond with JSON {"slug": "..."} only.' },
    { role: 'user', content: `Collections:\n${collections.map((c) => `- ${c.slug}: ${c.name} — ${c.description || ''}`).join('\n')}\n\nDocument excerpt:\n${text.slice(0, 3000)}` },
  ], { json: true, temperature: 0, maxTokens: 60 });
  try { const slug = JSON.parse(r.text).slug; return collections.some((c) => c.slug === slug) ? slug : null; } catch { return null; }
}
