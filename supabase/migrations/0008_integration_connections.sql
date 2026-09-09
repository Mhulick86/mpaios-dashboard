-- 0008: server-side integration credentials (Google Ads, GBP, LinkedIn, TikTok,
-- Pinterest, HubSpot, Slack, Semrush, ...). Tokens are AES-256-GCM ciphertext
-- produced by lib/integrations/crypto.ts; the key never enters the database.
-- Requires 0001 (organizations, set_updated_at) and 0005 (is_admin). Idempotent.

create table if not exists public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null,
  account_id text not null default 'default',
  account_name text,
  scopes text[] not null default '{}',
  access_token_enc text not null,
  refresh_token_enc text,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  connected_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider, account_id)
);
create index if not exists integration_connections_provider_idx on public.integration_connections (organization_id, provider);

drop trigger if exists integration_connections_updated on public.integration_connections;
create trigger integration_connections_updated before update on public.integration_connections
  for each row execute function public.set_updated_at();

alter table public.integration_connections enable row level security;
drop policy if exists integration_connections_admin on public.integration_connections;
create policy integration_connections_admin on public.integration_connections for all
  using (public.is_admin()) with check (public.is_admin());

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant select, insert, update, delete on public.integration_connections to authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.integration_connections from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant all on public.integration_connections to service_role;
  end if;
end $$;

notify pgrst, 'reload schema';
