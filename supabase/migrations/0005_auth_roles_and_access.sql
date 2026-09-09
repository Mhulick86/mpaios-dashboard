-- 0005_auth_roles_and_access.sql
-- MAIOS access-control revamp: domain-restricted sign-in, a single owner,
-- a role-escalation guard, admin-only business data, plus the app_settings,
-- invitations and local_seo_scans tables the app already queries.
--
-- ── HOW TO APPLY ─────────────────────────────────────────────────────────────
--   Prerequisite: 0001_core_schema.sql .. 0004_service_role_access.sql must
--   already be applied. This file relies on public.profiles, organizations,
--   clients, campaigns, token_usage, audit_log, evaluations, set_updated_at(),
--   current_role_level() (0001) and is_service() (0004).
--
--   * Supabase MCP : apply_migration(name = "0005_auth_roles_and_access",
--                                    query = <contents of this file>)
--   * Supabase CLI : supabase db push          (run from the repo root; the CLI
--                    applies every unapplied file in supabase/migrations/)
--   * Manual       : paste the file into the project's SQL editor (runs as the
--                    postgres role).
--
--   Safe to re-run: every statement is idempotent (create or replace /
--   if not exists / drop policy if exists / on conflict do nothing). Tested on
--   hosted Supabase semantics (Postgres 17, auth schema present) and on a plain
--   Postgres 16 + pgvector stack where 0001 creates the auth stub.
--
-- ── WHAT IT ENFORCES ─────────────────────────────────────────────────────────
--   1. Only Google accounts on the allowed domain (default marketingpowered.ai)
--      can be created in auth.users: handle_new_user() raises for any other
--      address, which aborts the insert so Supabase Auth rejects the sign-in
--      ("Database error saving new user" is what GoTrue reports to the app).
--   2. The owner_email (default mhulick@marketingpowered.ai) is the single
--      'owner' (level 4). Every other allowed sign-in is created as 'member'
--      (level 2). Nobody else can ever hold 'owner' and the owner can never be
--      demoted.
--   3. profiles.role can only be changed by the owner (or by the service role /
--      direct database access, which browser sessions never have).
--   4. clients, campaigns, invitations and app_settings are admin-only
--      (level >= 3 via public.is_admin()); app_settings writes are owner-only.
--
--   The domain and owner address live in public.app_settings so they can be
--   changed without a new migration. Keep them in sync with
--   NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN / NEXT_PUBLIC_OWNER_EMAIL (lib/access.ts).
--   Existing off-domain users already present in auth.users are NOT deleted by
--   this migration (the trigger only fires on insert); remove them from the
--   Supabase dashboard or let the app's session check sign them out.

-- ── 0. Helpers ───────────────────────────────────────────────────────────────

-- Service-role detection. 0004 only read the legacy request.jwt.claim.role GUC;
-- newer PostgREST publishes claims as JSON in request.jwt.claims, so honour both.
create or replace function public.is_service() returns boolean
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    ''
  ) = 'service_role' $$;

-- Admin = owner or admin (level >= 3). The service role (workers / API routes
-- using the service key) is treated as admin so self-hosted stacks without
-- BYPASSRLS behave like hosted Supabase.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_service() or public.current_role_level() >= 3 $$;

-- Lower-cased domain part of an email ('a@B.com' -> 'b.com'); null when absent.
create or replace function public.email_domain(p_email text) returns text
language sql immutable as $$
  select lower(nullif(substring(coalesce(p_email, '') from '@([^@]+)$'), '')) $$;

-- ── 1. app_settings ──────────────────────────────────────────────────────────
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
create or replace trigger app_settings_updated before update on public.app_settings
  for each row execute function public.set_updated_at();

insert into public.app_settings (key, value) values
  ('allowed_email_domain', to_jsonb('marketingpowered.ai'::text)),
  ('owner_email',          to_jsonb('mhulick@marketingpowered.ai'::text))
on conflict (key) do nothing;

-- Read a text setting with a fallback. Used by the triggers below (which run as
-- the definer), so it is deliberately not exposed to API roles.
create or replace function public.app_setting(p_key text, p_default text default null) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select value #>> '{}' from public.app_settings where key = p_key), p_default) $$;
revoke execute on function public.app_setting(text, text) from public;

alter table public.app_settings enable row level security;
drop policy if exists app_settings_read  on public.app_settings;
drop policy if exists app_settings_write on public.app_settings;
create policy app_settings_read  on public.app_settings for select using (public.is_admin());
create policy app_settings_write on public.app_settings for all
  using (public.current_role_level() >= 4) with check (public.current_role_level() >= 4);

-- ── 2. Sign-up gate + profile provisioning ───────────────────────────────────
-- AFTER INSERT on auth.users. Raising here aborts the auth.users insert, so
-- Supabase Auth refuses to create the account for any off-domain address.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_domain text := lower(public.app_setting('allowed_email_domain', 'marketingpowered.ai'));
  v_owner  text := lower(public.app_setting('owner_email', 'mhulick@marketingpowered.ai'));
  v_email  text := lower(new.email);
  v_role   text;
begin
  if v_email is null or public.email_domain(v_email) is distinct from v_domain then
    raise exception 'Sign-in is limited to @% accounts', v_domain
      using hint = 'Use your Marketing Powered Google Workspace account.';
  end if;

  v_role := case when v_email = v_owner then 'owner' else 'member' end;

  insert into public.profiles as p (id, email, full_name, avatar_url, role, organization_id)
  values (
    new.id,
    v_email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture'),
    v_role,
    (select id from public.organizations where slug = 'marketing-powered')
  )
  on conflict (id) do update
    set email      = excluded.email,
        full_name  = coalesce(excluded.full_name, p.full_name),
        avatar_url = coalesce(excluded.avatar_url, p.avatar_url);
  return new;
end $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'on_auth_user_created') then
    create trigger on_auth_user_created after insert on auth.users
      for each row execute function public.handle_new_user();
  end if;
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    grant execute on function public.handle_new_user() to supabase_auth_admin;
  end if;
end $$;

-- ── 3. One-off backfill: provision missing profiles, promote the owner ───────
-- Keyed on auth.users.email (the identity verified by Google), never on the
-- editable profiles.email column.
do $$
declare
  v_domain text := lower(public.app_setting('allowed_email_domain', 'marketingpowered.ai'));
  v_owner  text := lower(public.app_setting('owner_email', 'mhulick@marketingpowered.ai'));
  v_org    uuid := (select id from public.organizations where slug = 'marketing-powered');
begin
  -- Allowed-domain auth users that somehow have no profile row.
  insert into public.profiles (id, email, full_name, avatar_url, role, organization_id)
  select u.id, lower(u.email),
         coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name'),
         coalesce(u.raw_user_meta_data->>'avatar_url', u.raw_user_meta_data->>'picture'),
         case when lower(u.email) = v_owner then 'owner' else 'member' end,
         v_org
  from auth.users u
  where public.email_domain(u.email) = v_domain
    and not exists (select 1 from public.profiles p where p.id = u.id)
  on conflict (id) do nothing;

  -- The owner account is always 'owner'.
  update public.profiles p set role = 'owner'
  from auth.users u
  where u.id = p.id and lower(u.email) = v_owner and p.role <> 'owner';

  -- Nobody else may hold 'owner'; stray owners keep admin access (level 3).
  update public.profiles p set role = 'admin'
  from auth.users u
  where u.id = p.id and p.role = 'owner' and lower(u.email) is distinct from v_owner;
end $$;

-- ── 4. Role-escalation guard on profiles ─────────────────────────────────────
create or replace function public.protect_profile_role() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_owner    text    := lower(public.app_setting('owner_email', 'mhulick@marketingpowered.ai'));
  -- A browser/API session has a JWT subject. No subject means direct database
  -- access (migrations, SQL editor) or the service role: both are trusted.
  v_trusted  boolean := auth.uid() is null or public.is_service() or public.current_role_level() >= 4;
begin
  if new.role is distinct from old.role then
    if new.role <> 'owner' and (lower(old.email) = v_owner or lower(new.email) = v_owner) then
      raise exception 'The owner account (%) cannot be demoted', v_owner;
    end if;
    if new.role = 'owner' and lower(coalesce(new.email, old.email)) is distinct from v_owner then
      raise exception 'Only % can hold the owner role', v_owner;
    end if;
    if not v_trusted then
      raise exception 'Only the owner can change roles';
    end if;
  end if;

  -- profiles.email mirrors the identity provider; a member must not be able to
  -- relabel themselves as the owner (or anyone else) in the team list.
  if new.email is distinct from old.email and not v_trusted then
    raise exception 'Email is managed by the identity provider';
  end if;

  return new;
end $$;

create or replace trigger protect_profile_role before update on public.profiles
  for each row execute function public.protect_profile_role();

-- ── 5. Tighten RLS on sensitive tables ───────────────────────────────────────
-- Clients and campaigns (budgets, spend, revenue, contacts): admins only.
drop policy if exists clients_org on public.clients;
create policy clients_org on public.clients for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists campaigns_org on public.campaigns;
create policy campaigns_org on public.campaigns for all
  using (public.is_admin()) with check (public.is_admin());

-- Usage / audit / evaluations: row owner or admin (unchanged semantics,
-- re-asserted here so 0005 is self-contained).
drop policy if exists usage_read on public.token_usage;
create policy usage_read on public.token_usage for select
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists audit_read on public.audit_log;
create policy audit_read on public.audit_log for select
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists eval_own on public.evaluations;
create policy eval_own on public.evaluations for all
  using (user_id = auth.uid() or public.is_admin()) with check (auth.uid() is not null);

-- Profiles: everyone sees their own row, admins see the team; members may edit
-- their own row (preferences, name) but the trigger above blocks role/email
-- changes; the owner may edit any row (team page role assignment).
drop policy if exists profiles_self on public.profiles;
create policy profiles_self on public.profiles for select
  using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists profiles_update_owner on public.profiles;
create policy profiles_update_owner on public.profiles for update
  using (public.current_role_level() >= 4) with check (public.current_role_level() >= 4);

-- ── 6. invitations (app/team) ────────────────────────────────────────────────
create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role text not null default 'member' check (role in ('admin','member','viewer')),
  status text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  token text unique not null default encode(gen_random_bytes(16), 'hex'),
  invited_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now()
);
-- In case an older hand-made table exists with fewer columns.
alter table public.invitations add column if not exists role text not null default 'member';
alter table public.invitations add column if not exists status text not null default 'pending';
alter table public.invitations add column if not exists token text not null default encode(gen_random_bytes(16), 'hex');
alter table public.invitations add column if not exists invited_by uuid references auth.users(id) on delete set null;
alter table public.invitations add column if not exists expires_at timestamptz not null default now() + interval '7 days';
alter table public.invitations add column if not exists created_at timestamptz not null default now();
create unique index if not exists invitations_token_idx on public.invitations (token);
create index if not exists invitations_email_idx on public.invitations (lower(email), status);

-- Invitations must target the allowed domain (anything else could never sign in).
create or replace function public.validate_invitation() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_domain text := lower(public.app_setting('allowed_email_domain', 'marketingpowered.ai'));
begin
  new.email := lower(trim(new.email));
  if public.email_domain(new.email) is distinct from v_domain then
    raise exception 'Invitations are limited to @% accounts', v_domain;
  end if;
  return new;
end $$;
create or replace trigger invitations_validate before insert or update of email on public.invitations
  for each row execute function public.validate_invitation();

alter table public.invitations enable row level security;
drop policy if exists invitations_admin on public.invitations;
create policy invitations_admin on public.invitations for all
  using (public.is_admin()) with check (public.is_admin());

-- ── 7. local_seo_scans (lib/localSeoHistory.ts, app/database) ────────────────
-- Carries both the generic columns (location / query / results / score) and
-- the grid-scan columns the app inserts today (keyword, grid_size, ranks, points).
create table if not exists public.local_seo_scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade default auth.uid(),
  business_name text,
  location text,
  query text,
  keyword text,
  grid_size int,
  center_lat double precision,
  center_lng double precision,
  avg_rank numeric,
  top_rank numeric,
  visibility numeric,
  total_points int,
  ranking_points int,
  points jsonb not null default '[]'::jsonb,
  results jsonb not null default '{}'::jsonb,
  score numeric,
  created_at timestamptz not null default now()
);
alter table public.local_seo_scans add column if not exists user_id uuid references auth.users(id) on delete cascade default auth.uid();
alter table public.local_seo_scans add column if not exists business_name text;
alter table public.local_seo_scans add column if not exists location text;
alter table public.local_seo_scans add column if not exists query text;
alter table public.local_seo_scans add column if not exists keyword text;
alter table public.local_seo_scans add column if not exists grid_size int;
alter table public.local_seo_scans add column if not exists center_lat double precision;
alter table public.local_seo_scans add column if not exists center_lng double precision;
alter table public.local_seo_scans add column if not exists avg_rank numeric;
alter table public.local_seo_scans add column if not exists top_rank numeric;
alter table public.local_seo_scans add column if not exists visibility numeric;
alter table public.local_seo_scans add column if not exists total_points int;
alter table public.local_seo_scans add column if not exists ranking_points int;
alter table public.local_seo_scans add column if not exists points jsonb not null default '[]'::jsonb;
alter table public.local_seo_scans add column if not exists results jsonb not null default '{}'::jsonb;
alter table public.local_seo_scans add column if not exists score numeric;
alter table public.local_seo_scans add column if not exists created_at timestamptz not null default now();
create index if not exists local_seo_scans_user_idx on public.local_seo_scans (user_id, created_at desc);

alter table public.local_seo_scans enable row level security;
drop policy if exists local_seo_scans_own on public.local_seo_scans;
create policy local_seo_scans_own on public.local_seo_scans for all
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- ── 8. API role grants (hosted Supabase roles; no-ops elsewhere) ─────────────
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant select, insert, update, delete on public.app_settings, public.invitations, public.local_seo_scans to authenticated;
    grant execute on function public.is_admin() to authenticated;
    revoke execute on function public.app_setting(text, text) from authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.app_settings, public.invitations, public.local_seo_scans from anon;
    revoke execute on function public.app_setting(text, text) from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant all on public.app_settings, public.invitations, public.local_seo_scans to service_role;
  end if;
end $$;

-- Ask PostgREST to pick up the new tables immediately (harmless elsewhere).
notify pgrst, 'reload schema';
