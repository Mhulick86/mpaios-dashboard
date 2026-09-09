-- MAIOS core schema (self-hosted Supabase / PostgreSQL 16 + pgvector).
-- Mirrors the tables the dashboard already uses (lib/supabase/types.ts) so the
-- Vercel app keeps working when NEXT_PUBLIC_SUPABASE_URL points at the TNAS.
-- Embeddings are 768-dim (nomic-embed-text via Ollama on the TNAS).

create extension if not exists vector;
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- auth.users exists on Supabase. For plain PostgreSQL dev stacks create a stub.
do $$ begin
  if not exists (select 1 from pg_namespace where nspname = 'auth') then
    create schema auth;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb not null default '{}'::jsonb, created_at timestamptz default now());
    create or replace function auth.uid() returns uuid language sql stable as $f$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $f$;
    create or replace function auth.role() returns text language sql stable as $f$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon') $f$;
  end if;
end $$;

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ── Organizations (tenants) and profiles ─────────────────────────────────────
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger organizations_updated before update on public.organizations for each row execute function public.set_updated_at();
insert into public.organizations (slug, name) values ('marketing-powered', 'Marketing Powered LLC') on conflict (slug) do nothing;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  role text not null default 'member' check (role in ('owner','admin','member','viewer')),
  organization text not null default 'marketing-powered',
  organization_id uuid references public.organizations(id),
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();

-- Auto-create a profile when a Supabase auth user is created.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, organization_id)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url',
          (select id from public.organizations where slug = 'marketing-powered'))
  on conflict (id) do nothing;
  return new;
end $$;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'on_auth_user_created') then
    create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
  end if;
end $$;

create or replace function public.current_role_level() returns int language sql stable security definer set search_path = public as $$
  select case (select role from public.profiles where id = auth.uid())
    when 'owner' then 4 when 'admin' then 3 when 'member' then 2 when 'viewer' then 1 else 0 end $$;

-- ── Memory (Agent 18) with pgvector ──────────────────────────────────────────
create table if not exists public.memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  embedding vector(768),
  embedding_model text,
  confidence real not null default 0.7,
  source_agent int,
  source_conversation uuid,
  access_count int not null default 0,
  last_accessed timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists memory_user_idx on public.memory (user_id, category);
create index if not exists memory_embedding_idx on public.memory using hnsw (embedding vector_cosine_ops);
create trigger memory_updated before update on public.memory for each row execute function public.set_updated_at();

create or replace function public.match_memory(query_embedding vector(768), match_count int default 8, filter_user uuid default null, min_similarity real default 0.3)
returns table (id uuid, category text, content text, confidence real, metadata jsonb, similarity real)
language sql stable as $$
  select m.id, m.category, m.content, m.confidence, m.metadata, (1 - (m.embedding <=> query_embedding))::real as similarity
  from public.memory m
  where m.embedding is not null
    and (filter_user is null or m.user_id = filter_user)
    and (m.expires_at is null or m.expires_at > now())
    and 1 - (m.embedding <=> query_embedding) >= min_similarity
  order by m.embedding <=> query_embedding
  limit match_count $$;

-- ── Conversations and messages ───────────────────────────────────────────────
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New conversation',
  model text not null default '',
  system_context text,
  metadata jsonb not null default '{}'::jsonb,
  is_archived boolean not null default false,
  message_count int not null default 0,
  total_tokens int not null default 0,
  total_cost numeric(12,6) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists conversations_user_idx on public.conversations (user_id, updated_at desc);
create trigger conversations_updated before update on public.conversations for each row execute function public.set_updated_at();

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null check (role in ('system','user','assistant','tool')),
  content text not null default '',
  agent_id int,
  tool_calls jsonb,
  tool_results jsonb,
  metadata jsonb not null default '{}'::jsonb,
  tokens_input int not null default 0,
  tokens_output int not null default 0,
  latency_ms int,
  model text,
  created_at timestamptz not null default now()
);
create index if not exists messages_conversation_idx on public.messages (conversation_id, created_at);

-- ── Workflows, runs, agent executions ────────────────────────────────────────
create table if not exists public.workflows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  organization_id uuid references public.organizations(id),
  name text not null,
  description text,
  pipeline_id text,
  trigger_type text not null default 'manual' check (trigger_type in ('manual','schedule','event','webhook')),
  trigger_config jsonb not null default '{}'::jsonb,
  steps jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  run_count int not null default 0,
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger workflows_updated before update on public.workflows for each row execute function public.set_updated_at();

create table if not exists public.workflow_runs (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  status text not null default 'queued' check (status in ('queued','running','completed','failed','cancelled','paused','waiting_approval')),
  trigger text not null default 'manual',
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  current_step int not null default 0,
  total_steps int not null default 0,
  step_results jsonb not null default '[]'::jsonb,
  error text,
  tokens_total int not null default 0,
  cost_total numeric(12,6) not null default 0,
  correlation_id uuid not null default gen_random_uuid(),
  idempotency_key text unique,
  attempt int not null default 0,
  queued_at timestamptz not null default now(),
  started_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists workflow_runs_workflow_idx on public.workflow_runs (workflow_id, started_at desc);
create index if not exists workflow_runs_status_idx on public.workflow_runs (status) where status in ('queued','running','waiting_approval');

create table if not exists public.agent_executions (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete set null,
  workflow_run_id uuid references public.workflow_runs(id) on delete cascade,
  agent_id int not null,
  agent_name text not null,
  division text,
  action text not null,
  status text not null default 'queued' check (status in ('queued','running','completed','failed','cancelled')),
  input jsonb,
  output jsonb,
  error text,
  tokens_used int not null default 0,
  cost numeric(12,6) not null default 0,
  latency_ms int,
  parent_execution_id uuid references public.agent_executions(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists agent_executions_run_idx on public.agent_executions (workflow_run_id, started_at);

-- ── Evaluations, audit, token usage ──────────────────────────────────────────
create table if not exists public.evaluations (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references public.messages(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  agent_execution_id uuid references public.agent_executions(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  rating int check (rating between 1 and 5),
  thumbs text check (thumbs in ('up','down')),
  feedback_text text,
  quality_scores jsonb not null default '{}'::jsonb,
  auto_metrics jsonb not null default '{}'::jsonb,
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  resource_type text,
  resource_id text,
  details jsonb not null default '{}'::jsonb,
  ip_address text,
  user_agent text,
  tokens_used int not null default 0,
  cost numeric(12,6) not null default 0,
  model text,
  latency_ms int,
  correlation_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists audit_log_created_idx on public.audit_log (created_at desc);
create index if not exists audit_log_event_idx on public.audit_log (event_type, created_at desc);

create table if not exists public.token_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  model text not null,
  provider text not null,
  tokens_input int not null default 0,
  tokens_output int not null default 0,
  cost numeric(12,6) not null default 0,
  endpoint text,
  conversation_id uuid,
  agent_id int,
  created_at timestamptz not null default now()
);
create index if not exists token_usage_created_idx on public.token_usage (created_at desc);

-- ── Clients and campaigns ────────────────────────────────────────────────────
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  organization_id uuid references public.organizations(id),
  name text not null,
  industry text,
  website text,
  contact_email text,
  contact_name text,
  status text not null default 'active' check (status in ('active','onboarding','paused','churned')),
  monthly_budget numeric(12,2),
  goals text[] not null default '{}',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger clients_updated before update on public.clients for each row execute function public.set_updated_at();

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  name text not null,
  type text,
  status text not null default 'draft' check (status in ('draft','active','paused','completed','archived')),
  channels text[] not null default '{}',
  budget numeric(12,2),
  spend numeric(12,2) not null default 0,
  revenue numeric(12,2) not null default 0,
  conversions int not null default 0,
  kpis jsonb not null default '{}'::jsonb,
  assigned_agents int[] not null default '{}',
  start_date date,
  end_date date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger campaigns_updated before update on public.campaigns for each row execute function public.set_updated_at();

-- ── Row level security (Supabase) ────────────────────────────────────────────
-- Service role (workers, API) bypasses RLS. Browser sessions get per-user access;
-- admins/owners see everything in the organization.
alter table public.profiles enable row level security;
alter table public.memory enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.workflows enable row level security;
alter table public.workflow_runs enable row level security;
alter table public.agent_executions enable row level security;
alter table public.evaluations enable row level security;
alter table public.audit_log enable row level security;
alter table public.token_usage enable row level security;
alter table public.clients enable row level security;
alter table public.campaigns enable row level security;

create policy profiles_self on public.profiles for select using (id = auth.uid() or public.current_role_level() >= 3);
create policy profiles_update_self on public.profiles for update using (id = auth.uid());
create policy memory_own on public.memory for all using (user_id = auth.uid() or public.current_role_level() >= 3) with check (user_id = auth.uid() or public.current_role_level() >= 3);
create policy conversations_own on public.conversations for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy messages_own on public.messages for all using (exists (select 1 from public.conversations c where c.id = conversation_id and c.user_id = auth.uid()));
create policy workflows_org on public.workflows for select using (auth.uid() is not null);
create policy workflows_write on public.workflows for insert with check (public.current_role_level() >= 2);
create policy workflows_update on public.workflows for update using (user_id = auth.uid() or public.current_role_level() >= 3);
create policy workflows_delete on public.workflows for delete using (user_id = auth.uid() or public.current_role_level() >= 3);
create policy runs_read on public.workflow_runs for select using (auth.uid() is not null);
create policy runs_insert on public.workflow_runs for insert with check (public.current_role_level() >= 2);
create policy runs_update on public.workflow_runs for update using (public.current_role_level() >= 2);
create policy exec_read on public.agent_executions for select using (auth.uid() is not null);
create policy exec_write on public.agent_executions for all using (public.current_role_level() >= 2) with check (public.current_role_level() >= 2);
create policy eval_own on public.evaluations for all using (user_id = auth.uid() or public.current_role_level() >= 3) with check (auth.uid() is not null);
create policy audit_read on public.audit_log for select using (user_id = auth.uid() or public.current_role_level() >= 3);
create policy audit_insert on public.audit_log for insert with check (auth.uid() is not null);
create policy usage_read on public.token_usage for select using (user_id = auth.uid() or public.current_role_level() >= 3);
create policy usage_insert on public.token_usage for insert with check (auth.uid() is not null);
create policy clients_org on public.clients for all using (auth.uid() is not null) with check (public.current_role_level() >= 2);
create policy campaigns_org on public.campaigns for all using (auth.uid() is not null) with check (public.current_role_level() >= 2);
