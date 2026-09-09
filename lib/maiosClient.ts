/** Browser-side helper for the MAIOS worker proxy (app/api/maios). */
export async function maios<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api/maios${path}`, { ...init, headers: { ...(init.body instanceof FormData ? {} : { "content-type": "application/json" }), ...(init.headers || {}) } });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.error?.message || data?.message || `${path} -> ${res.status}`);
  return data as T;
}

export const STEP_TYPES = [
  { type: "agent", label: "Agent (LLM step)" },
  { type: "search_knowledge", label: "Search knowledge base" },
  { type: "etl.ingest", label: "ETL: ingest into a collection" },
  { type: "asana.create_task", label: "Asana: create task" },
  { type: "asana.create_project", label: "Asana: create project" },
  { type: "slack.notify", label: "Slack: notify" },
  { type: "http.request", label: "HTTP request" },
  { type: "emit_event", label: "Emit event" },
  { type: "wait_approval", label: "Wait for human approval" },
  { type: "transform", label: "Transform / constant" },
] as const;
export type StepType = (typeof STEP_TYPES)[number]["type"];

export interface MaiosStep { index: number; agent_id?: number; action: string; description?: string; config: Record<string, unknown> & { type?: StepType }; }
export interface MaiosTrigger { id: string; kind: "schedule" | "event" | "webhook"; cron: string | null; timezone: string | null; event_type: string | null; event_filter: Record<string, unknown>; webhook_token: string | null; has_secret: boolean; is_active: boolean; last_fired_at: string | null }
export interface MaiosWorkflow { id: string; name: string; description: string | null; trigger_type: "manual" | "schedule" | "event" | "webhook"; trigger_config: Record<string, unknown>; steps: MaiosStep[]; is_active: boolean; run_count: number; last_run_at: string | null; triggers: MaiosTrigger[]; last_run: { id: string; status: string; started_at: string; completed_at: string | null; error: string | null } | null; active_runs: number }
export interface MaiosRun { id: string; workflow_id: string; workflow_name?: string; status: string; trigger: string; current_step: number; total_steps: number; error: string | null; tokens_total: number; started_at: string; completed_at: string | null; step_results?: Array<Record<string, unknown>>; executions?: Array<{ id: string; agent_name: string; action: string; status: string; error: string | null; latency_ms: number | null; tokens_used: number }> }
export interface MaiosCollection { id: string; slug: string; name: string; description: string | null; kind: string; classification: string; visibility: "org" | "members"; min_role_level: number; document_count: string | number; embedding_model: string; /** agents (lib/agents.ts ids) granted this collection, migration 0009 */ agent_ids?: number[] }
/** One row of agent_collection_access (GET/PUT /v1/collections/:id/agents). */
export interface MaiosAgentGrant { agent_id: number; granted_by: string | null; note: string | null; created_at: string }
export interface MaiosEtlJob { id: string; collection_id: string; collection_slug?: string; document_id: string | null; source_type: string; source_uri: string | null; input: Record<string, unknown>; profile: string; status: string; stage: string | null; progress: Record<string, unknown>; result: Record<string, unknown>; error: string | null; created_at: string; completed_at: string | null }
export interface MaiosDocument { id: string; title: string; source_type: string; source_uri: string | null; mime_type: string | null; byte_size: number | null; status: string; tags: string[]; created_at: string; updated_at: string; collection_slug: string; chunk_count: number | null }
export interface MaiosHit { id: string; collection_id: string; document_title: string; heading: string | null; content: string; score: number; kind: "chunk" | "record"; data?: unknown }
