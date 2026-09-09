/** Retrieval for agents and the dashboard: hybrid vector + full-text, access enforced per user (and per agent, 0009). */
import type { PoolClient } from 'pg';
import { asUser, toVector } from '../db.ts';
import { embed } from '../model/gateway.ts';

export interface SearchHit { id: string; collection_id: string; document_id: string; document_title: string; source_uri?: string | null; heading: string | null; content: string; chunk_index?: number; score: number; kind: 'chunk' | 'record'; data?: unknown }

export interface SearchParams {
  query: string;
  /** Acting user (request.jwt.claim.sub). null = trusted service call (service_role). */
  userId: string | null;
  /** Explicit collection ids to restrict to (already resolved from slugs). */
  collectionIds?: string[];
  /** Agent running the search (lib/agents.ts id). Applies the agent_collection_access allow-list. */
  agentId?: number | null;
  limit?: number;
  includeRecords?: boolean;
  minSimilarity?: number;
}

/** Admin level as defined by public.current_role_level() (viewer 1, member 2, admin 3, owner 4). */
const ADMIN_LEVEL = 3;

/**
 * Collections an agent may search on behalf of the acting user (migration 0009):
 *
 *   effective = agent grants ∩ collections the user can read (can_read_collection) [∩ requested]
 *
 * Returns `null` when the agent imposes no restriction (every collection the user can
 * read, or the caller's explicit list), and `[]` when the agent may see nothing.
 * An agent with no grants sees nothing, except that admins (level >= 3) and service
 * calls fall back to their own access so the owner is never blocked while configuring.
 * Must run inside asUser() so auth.uid() / RLS reflect the acting user.
 */
export async function agentScope(c: PoolClient, userId: string | null, agentId: number, requested: string[] | null): Promise<string[] | null> {
  const grants = (await c.query<{ cid: string; readable: boolean }>(
    'select cid, public.can_read_collection(cid) as readable from public.agent_collections($1) as cid', [agentId])).rows;
  if (!grants.length) {
    const level = userId === null
      ? ADMIN_LEVEL // service role: is_admin() is true for it in the database as well
      : Number((await c.query<{ level: number }>('select public.current_role_level() as level')).rows[0]?.level ?? 0);
    return level >= ADMIN_LEVEL ? requested : [];
  }
  const readable = grants.filter((g) => g.readable).map((g) => g.cid);
  return requested ? readable.filter((id) => requested.includes(id)) : readable;
}

export async function searchKnowledge(params: SearchParams): Promise<SearchHit[]> {
  const limit = params.limit ?? 8;
  const requested = params.collectionIds && params.collectionIds.length ? params.collectionIds : null;
  let cols: string[] | null = requested;
  if (params.agentId != null) {
    cols = await asUser(params.userId, (c) => agentScope(c, params.userId, params.agentId as number, requested));
    if (cols && !cols.length) return []; // nothing to search: skip the embedding call entirely
  }
  const [vec] = await embed([params.query]);
  const v = toVector(vec);
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
