/**
 * Server-side client for the MAIOS worker (ETL agent, knowledge search, workflow engine) running on the TNAS.
 * Never import from client components: it carries the internal key.
 */
import "server-only";

export const MAIOS_WORKER_URL = (process.env.MAIOS_WORKER_URL || "http://localhost:8787").replace(/\/+$/, "");
const INTERNAL_KEY = process.env.MAIOS_INTERNAL_KEY || "dev-key";
const ANON = "00000000-0000-0000-0000-000000000000";

/**
 * Which user the worker should evaluate collection access for. Every dashboard
 * request now carries a real session user; MAIOS_DEFAULT_USER_ID is only a
 * development convenience and is never applied in production.
 */
export function actingUserId(userId?: string | null): string | null {
  if (userId && userId !== ANON) return userId;
  if (process.env.NODE_ENV === "production") return null;
  return process.env.MAIOS_DEFAULT_USER_ID || null;
}

export async function maiosFetch<T = unknown>(path: string, init: RequestInit & { userId?: string | null; timeoutMs?: number } = {}): Promise<T> {
  const { userId, timeoutMs = 60_000, headers, ...rest } = init;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(`${MAIOS_WORKER_URL}${path}`, {
      ...rest,
      signal: ctl.signal,
      headers: { "content-type": "application/json", "x-internal-key": INTERNAL_KEY, ...(actingUserId(userId) ? { "x-user-id": actingUserId(userId)! } : {}), ...(headers || {}) },
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) throw new Error(data?.error?.message || data?.message || `MAIOS ${path} -> ${res.status}`);
    return data as T;
  } finally { clearTimeout(t); }
}

export interface KnowledgeHit { id: string; collection_id: string; document_id: string; document_title: string; source_uri?: string | null; heading: string | null; content: string; score: number; kind: "chunk" | "record"; data?: unknown }

/**
 * Knowledge search. `agentId` (a lib/agents.ts id) makes the worker apply that agent's
 * collection allow-list (migration 0009 / ADR-0006) on top of the acting user's own
 * access: an agent with no grants gets nothing, admins fall back to what they can read.
 */
export async function searchKnowledge(query: string, opts: { userId?: string | null; collections?: string[]; limit?: number; includeRecords?: boolean; agentId?: number | null } = {}): Promise<{ hits: KnowledgeHit[]; citations: string }> {
  const agentId = typeof opts.agentId === "number" && Number.isInteger(opts.agentId) && opts.agentId > 0 ? opts.agentId : undefined;
  return maiosFetch("/v1/knowledge/search", { method: "POST", userId: opts.userId, body: JSON.stringify({ query, collections: opts.collections, agent_id: agentId, limit: opts.limit ?? 6, include_records: opts.includeRecords ?? true }) });
}
