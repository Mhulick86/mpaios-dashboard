-- 0009: per-agent access to knowledge collections ("which databases may an
-- agent search?"). Requires 0001 (organizations), 0002 (knowledge_collections,
-- can_read_collection) and 0005 (is_admin, is_service). Idempotent; safe on
-- hosted Supabase and on the plain-Postgres dev stack.
--
-- ── RULES (enforced by services/worker/src/knowledge/search.ts) ──────────────
--   1. Allow-list per agent. A row grants agent `agent_id` (the static numeric
--      id in lib/agents.ts, 1..33) the right to search `collection_id`. An
--      agent with NO rows sees nothing from knowledge search.
--   2. Never more than the acting user. Every agent step runs on behalf of a
--      user (x-user-id -> request.jwt.claim.sub). Its effective collections are
--          agent grants  ∩  { collections that user can read (can_read_collection) }
--      so a grant can never expose a collection to someone who could not open
--      it themselves. If the caller also passed an explicit collection list,
--      that list is intersected as well.
--   3. Admin fallback. When the agent has no grants at all and the acting user
--      is an admin (current_role_level() >= 3) - or the call runs as the
--      service role (scheduled / webhook workflow runs, which only admins can
--      create) - the search falls back to every collection that identity can
--      read, so the owner is never blocked while grants are still being set up.
--
--   Grants are managed by admins: Data & ETL page -> "Agents" on a collection,
--   i.e. PUT /v1/collections/:id/agents on the worker. Every signed-in user may
--   read the table (it holds agent ids and collection ids only).

create table if not exists public.agent_collection_access (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_id int not null check (agent_id > 0),
  collection_id uuid not null references public.knowledge_collections(id) on delete cascade,
  granted_by uuid references auth.users(id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  primary key (collection_id, agent_id)
);
create index if not exists agent_collection_access_agent_idx on public.agent_collection_access (agent_id);
create index if not exists agent_collection_access_org_idx on public.agent_collection_access (organization_id);

comment on table public.agent_collection_access is
  'Allow-list: which MAIOS agents (lib/agents.ts ids) may search which knowledge collections. Effective access = grants ∩ what the acting user can read; agents with no grants see nothing (admins fall back to their own access).';

-- Collection ids granted to an agent. SECURITY INVOKER on purpose: RLS on
-- agent_collection_access applies to the caller, and the worker still
-- intersects the result with can_read_collection() for the acting user.
create or replace function public.agent_collections(p_agent_id int) returns setof uuid
language sql stable security invoker set search_path = public as $$
  select collection_id from public.agent_collection_access where agent_id = p_agent_id $$;

-- ── RLS: anyone signed in may read, admins (or the service role) may write ──
alter table public.agent_collection_access enable row level security;

drop policy if exists agent_access_read   on public.agent_collection_access;
drop policy if exists agent_access_insert on public.agent_collection_access;
drop policy if exists agent_access_update on public.agent_collection_access;
drop policy if exists agent_access_delete on public.agent_collection_access;
create policy agent_access_read   on public.agent_collection_access for select using (auth.uid() is not null or public.is_service());
create policy agent_access_insert on public.agent_collection_access for insert with check (public.is_admin());
create policy agent_access_update on public.agent_collection_access for update using (public.is_admin()) with check (public.is_admin());
create policy agent_access_delete on public.agent_collection_access for delete using (public.is_admin());

-- ── API role grants (hosted Supabase roles; no-ops elsewhere) ────────────────
revoke execute on function public.agent_collections(int) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant select, insert, update, delete on public.agent_collection_access to authenticated;
    grant execute on function public.agent_collections(int) to authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.agent_collection_access from anon;
    revoke execute on function public.agent_collections(int) from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant all on public.agent_collection_access to service_role;
    grant execute on function public.agent_collections(int) to service_role;
  end if;
end $$;

notify pgrst, 'reload schema';
