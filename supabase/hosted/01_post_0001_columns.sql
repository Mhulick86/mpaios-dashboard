-- Hosted Supabase (mpaios-platform) compatibility, step 2 of 3. Idempotent.
-- Run AFTER migrations/0001_core_schema.sql and BEFORE 0002. Adds the columns
-- 0001 would have created on tables that already existed.

alter table public.profiles      add column if not exists organization_id uuid references public.organizations(id);
alter table public.clients       add column if not exists organization_id uuid references public.organizations(id);
alter table public.workflows     add column if not exists organization_id uuid references public.organizations(id);
alter table public.memory        add column if not exists embedding_model text;
alter table public.workflow_runs add column if not exists correlation_id uuid not null default gen_random_uuid();
alter table public.workflow_runs add column if not exists idempotency_key text;
alter table public.workflow_runs add column if not exists attempt int not null default 0;
alter table public.workflow_runs add column if not exists queued_at timestamptz not null default now();
create unique index if not exists workflow_runs_idempotency_key_key on public.workflow_runs (idempotency_key);

-- The worker parks runs in 'waiting_approval'; the hand-made check constraint lacks it.
alter table public.workflow_runs drop constraint if exists workflow_runs_status_check;
alter table public.workflow_runs add constraint workflow_runs_status_check
  check (status in ('queued','running','completed','failed','cancelled','paused','waiting_approval'));

-- Every existing row belongs to the single tenant.
update public.profiles  set organization_id = o.id from public.organizations o where o.slug = 'marketing-powered' and public.profiles.organization_id is null;
update public.clients   set organization_id = o.id from public.organizations o where o.slug = 'marketing-powered' and public.clients.organization_id is null;
update public.workflows set organization_id = o.id from public.organizations o where o.slug = 'marketing-powered' and public.workflows.organization_id is null;

-- 0001 declares memory.embedding as vector(768) for the self-hosted stack; the
-- hosted project keeps vector(1536) (OpenAI text-embedding-3-small) because
-- lib/memory.ts writes 1536-d vectors. Record that on existing rows.
update public.memory set embedding_model = 'text-embedding-3-small' where embedding_model is null and embedding is not null;
