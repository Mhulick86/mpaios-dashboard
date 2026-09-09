# ADR-0006: Agents get an explicit allow-list of knowledge collections

**Status:** accepted 2026-09-09

## Decision
Which knowledge "databases" (`knowledge_collections`, ADR-0004) an agent may search is a per-agent
allow-list stored in `public.agent_collection_access` (`supabase/migrations/0009`): one row per
(`collection_id`, `agent_id`), where `agent_id` is the static numeric id from `lib/agents.ts` (01–33).
The orchestrator's owner grants these from the Data & ETL page; every knowledge search that runs *as an
agent* carries `agent_id`, and the MAIOS worker (`services/worker/src/knowledge/search.ts`) applies the
list before the retrieval RPCs run. ADR-0004's per-user access is unchanged and always applies as well.

## Rules
1. **Allow-list per agent.** An agent may only search collections it has been granted. An agent with no
   grants sees nothing from `search_knowledge` — silence, not an error.
2. **Never more than the acting user.** Every agent step runs on behalf of a signed-in user (the proxy
   sets `x-user-id`; the worker impersonates it via `request.jwt.claim.sub`). Effective collections are
   `agent grants ∩ collections the user can read (can_read_collection)`, further intersected with any
   explicit collection list the caller passed. A grant can therefore never expose a collection to
   someone who could not open it themselves: granting `sales-restricted` to agent 26 does nothing for a
   member running agent 26.
3. **Admin fallback.** If the agent has no grants at all and the acting user is an admin
   (`current_role_level() >= 3`), or the call runs as the service role (scheduled / webhook workflow
   runs, which only admins can create), the search falls back to every collection that identity can
   read. The owner is never blocked while grants are still being configured; members are, by design.
4. **Who can change grants.** Reads: anyone signed in (RLS `auth.uid() is not null`; the table holds
   ids only). Writes: `public.is_admin()` via RLS, and the worker re-checks
   `current_role_level() >= 3` inside the impersonated transaction and answers 403 otherwise. Every
   change is written to `audit_log` as `collection.agents_updated`.

## How the orchestrator uses it
- **Pipeline steps (`lib/orchestratorEngine.ts`).** Before each agent step the browser calls
  `POST /api/maios/v1/knowledge/search` with `{ query: <step task>, agent_id, limit: 5 }` and prepends
  the hits as a "Knowledge from your databases" block to that step's user message; the same `agentId`
  travels in the `/api/chat` body so the model's `search_knowledge` tool is scoped identically. Any
  failure (worker down, migration not applied, 403) is skipped silently and the step runs without
  knowledge.
- **Chat (`app/api/chat/route.ts`).** `agentId` in the request body scopes both the automatic
  per-message retrieval and the `search_knowledge` tool. The chat page itself has a *tool* selector
  (tools are shared by several agents), not an agent selector, so ordinary chat runs at user scope.
- **Worker workflows (`services/worker/src/workflows/steps.ts`).** `agent` steps and
  `search_knowledge` steps pass `step.agent_id` (or `config.agent_id`) to `searchKnowledge`, on top of
  the run's `trigger_config.collection_ids` and the run user's access.
- **Everything else** (dashboard search box "as me", ETL routing) is unchanged: no `agent_id`, user scope.

## How to grant
- **Dashboard:** Data & ETL → a collection card shows `Agents: 03, 07, 12`; the **Agents** button opens
  an inline multi-select of the 33 agents; Save replaces the set. The "Ask the knowledge base" box has
  an *as agent NN* selector to verify what an agent will actually see.
- **API (worker, through the `/api/maios` proxy):**
  `GET /v1/collections/:id/agents` → `[{ agent_id, granted_by, note, created_at }]`;
  `PUT /v1/collections/:id/agents` with `{ agent_ids: [3, 7, 12], note? }` replaces the set (admins
  only; `POST` is accepted as an alias because the proxy forwards GET/POST/DELETE only). `GET
  /v1/collections` includes `agent_ids` per collection. `POST /v1/knowledge/search` accepts `agent_id`.
- **SQL:** `insert into public.agent_collection_access (organization_id, agent_id, collection_id,
  granted_by) …`; `select * from public.agent_collections(7)` lists agent 07's grants.

## Consequences
- Migration 0009 must be applied (hosted: after 0008; self-hosted: `supabase/migrations/` in order).
  Until it is, `GET /v1/collections` reports `agent_ids: []` and agent-scoped searches fail closed
  (the orchestrator skips knowledge; the chat tool reports the error).
- Agent ids are code, not data: the worker rejects ids that are not in `lib/agents.ts` (400) and the
  table has no FK to an agents table. Renumbering agents requires migrating this table.
- Grants are per collection, not per document; per-document restrictions still come from
  `collection_members` / classification on the collection.
