/** Retrieval for agents and the dashboard: hybrid vector + full-text, access enforced per user. */
import { asUser, toVector } from '../db.ts';
import { embed } from '../model/gateway.ts';

export interface SearchHit { id: string; collection_id: string; document_id: string; document_title: string; source_uri?: string | null; heading: string | null; content: string; chunk_index?: number; score: number; kind: 'chunk' | 'record'; data?: unknown }

export async function searchKnowledge(params: { query: string; userId: string | null; collectionIds?: string[]; limit?: number; includeRecords?: boolean; minSimilarity?: number }): Promise<SearchHit[]> {
  const limit = params.limit ?? 8;
  const [vec] = await embed([params.query]);
  const v = toVector(vec);
  const cols = params.collectionIds && params.collectionIds.length ? params.collectionIds : null;
  return asUser(params.userId, async (c) => {
    const vecHits = (await c.query('select * from match_chunks($1::vector, $2, $3::uuid[], $4)', [v, limit * 2, cols, params.minSimilarity ?? 0.2])).rows;
    const textHits = (await c.query('select * from search_chunks_text($1, $2, $3::uuid[])', [params.query, limit, cols])).rows;
    // Reciprocal rank fusion
    const scores = new Map<string, { row: any; score: number }>();
    vecHits.forEach((r: any, i: number) => scores.set(r.id, { row: r, score: 1 / (60 + i) + Number(r.similarity) * 0.5 }));
    textHits.forEach((r: any, i: number) => { const s = scores.get(r.id); if (s) s.score += 1 / (60 + i); else scores.set(r.id, { row: r, score: 1 / (60 + i) }); });
    const hits: SearchHit[] = [...scores.values()].sort((a, b) => b.score - a.score).slice(0, limit)
      .map(({ row, score }) => ({ id: row.id, collection_id: row.collection_id, document_id: row.document_id, document_title: row.document_title, source_uri: row.source_uri, heading: row.heading, content: row.content, chunk_index: row.chunk_index, score, kind: 'chunk' as const }));
    if (params.includeRecords) {
      const recs = (await c.query('select * from match_records($1::vector, $2, $3::uuid[])', [v, Math.ceil(limit / 2), cols])).rows;
      for (const r of recs) hits.push({ id: r.id, collection_id: r.collection_id, document_id: '', document_title: r.record_key || 'record', heading: null, content: r.summary || JSON.stringify(r.data).slice(0, 800), score: Number(r.similarity), kind: 'record', data: r.data });
    }
    return hits;
  });
}

export function formatCitations(hits: SearchHit[]): string {
  return hits.map((h, i) => `[${i + 1}] ${h.document_title}${h.heading ? ` › ${h.heading}` : ''} (score ${h.score.toFixed(3)})\n${h.content.slice(0, 1200)}`).join('\n\n');
}
