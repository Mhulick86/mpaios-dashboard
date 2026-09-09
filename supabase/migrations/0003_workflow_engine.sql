-- Durable workflow engine tables (the n8n replacement): triggers, schedules,
-- event bus, webhook inbox, outbox, approvals, external object map.

create table if not exists public.workflow_triggers (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  kind text not null check (kind in ('schedule','event','webhook')),
  cron text,                                  -- kind = schedule (5-field cron, UTC unless timezone set)
  timezone text default 'America/New_York',
  event_type text,                            -- kind = event, e.g. crm.lead.created, etl.job.completed
  event_filter jsonb not null default '{}'::jsonb,
  webhook_token text unique,                  -- kind = webhook; POST /webhooks/<token>
  webhook_secret text,                        -- optional HMAC-SHA256 signature check (x-maios-signature)
  is_active boolean not null default true,
  last_fired_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists workflow_triggers_kind_idx on public.workflow_triggers (kind, is_active);

-- Canonical event bus. Workers LISTEN on channel 'maios_events'.
create table if not exists public.workflow_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  event_version int not null default 1,
  tenant_id uuid references public.organizations(id),
  actor jsonb not null default '{}'::jsonb,
  subject jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  correlation_id uuid not null default gen_random_uuid(),
  causation_id uuid,
  occurred_at timestamptz not null default now(),
  recorded_at timestamptz not null default now(),
  processed_at timestamptz
);
create index if not exists workflow_events_unprocessed_idx on public.workflow_events (recorded_at) where processed_at is null;
create index if not exists workflow_events_type_idx on public.workflow_events (event_type, occurred_at desc);

create or replace function public.notify_workflow_event() returns trigger language plpgsql as $$
begin
  perform pg_notify('maios_events', json_build_object('id', new.id, 'event_type', new.event_type)::text);
  return new;
end $$;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'workflow_events_notify') then
    create trigger workflow_events_notify after insert on public.workflow_events for each row execute function public.notify_workflow_event();
  end if;
end $$;

create table if not exists public.webhook_inbox (
  id uuid primary key default gen_random_uuid(),
  provider text not null,                   -- 'workflow', 'close', 'asana', 'stripe', ...
  trigger_id uuid references public.workflow_triggers(id) on delete set null,
  provider_event_id text,
  signature_status text not null default 'unverified' check (signature_status in ('unverified','valid','invalid','none')),
  headers jsonb not null default '{}'::jsonb,
  raw_payload jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  status text not null default 'received' check (status in ('received','processed','failed','ignored')),
  error text
);
create unique index if not exists webhook_inbox_dedupe_idx on public.webhook_inbox (provider, provider_event_id) where provider_event_id is not null;

create table if not exists public.outbox_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.organizations(id),
  event_type text not null,
  aggregate_type text not null,
  aggregate_id uuid,
  payload jsonb not null default '{}'::jsonb,
  available_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending','delivering','delivered','dead')),
  attempt_count int not null default 0,
  last_error text,
  correlation_id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  delivered_at timestamptz
);
create index if not exists outbox_pending_idx on public.outbox_events (available_at) where status = 'pending';

create table if not exists public.approvals (
  id uuid primary key default gen_random_uuid(),
  workflow_run_id uuid references public.workflow_runs(id) on delete cascade,
  agent_execution_id uuid references public.agent_executions(id) on delete set null,
  risk_class text not null default 'provider_write',
  proposed_action jsonb not null,
  evidence jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','approved','rejected','expired','edited')),
  decided_by uuid references auth.users(id) on delete set null,
  decision_note text,
  expires_at timestamptz not null default now() + interval '3 days',
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index if not exists approvals_pending_idx on public.approvals (created_at) where status = 'pending';

create table if not exists public.external_object_map (
  id uuid primary key default gen_random_uuid(),
  provider text not null,                   -- asana | close | google_drive | ...
  connection_id text,
  object_type text not null,                -- task | project | lead | file
  canonical_type text not null,             -- workflow_run | client | campaign | document
  canonical_id uuid not null,
  external_id text not null,
  external_url text,
  provider_version text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, object_type, external_id)
);
create index if not exists external_object_canonical_idx on public.external_object_map (canonical_type, canonical_id);
create trigger external_object_map_updated before update on public.external_object_map for each row execute function public.set_updated_at();

create table if not exists public.idempotency_keys (
  key text primary key,
  scope text not null,
  result jsonb,
  created_at timestamptz not null default now()
);

alter table public.workflow_triggers enable row level security;
alter table public.workflow_events enable row level security;
alter table public.webhook_inbox enable row level security;
alter table public.outbox_events enable row level security;
alter table public.approvals enable row level security;
alter table public.external_object_map enable row level security;
create policy triggers_read on public.workflow_triggers for select using (auth.uid() is not null);
create policy triggers_write on public.workflow_triggers for all using (public.current_role_level() >= 2) with check (public.current_role_level() >= 2);
create policy events_read on public.workflow_events for select using (public.current_role_level() >= 2);
create policy events_insert on public.workflow_events for insert with check (public.current_role_level() >= 2);
create policy inbox_admin on public.webhook_inbox for select using (public.current_role_level() >= 3);
create policy outbox_admin on public.outbox_events for select using (public.current_role_level() >= 3);
create policy approvals_read on public.approvals for select using (auth.uid() is not null);
create policy approvals_decide on public.approvals for update using (public.current_role_level() >= 2);
create policy eom_read on public.external_object_map for select using (auth.uid() is not null);
