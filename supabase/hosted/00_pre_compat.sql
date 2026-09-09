-- Hosted Supabase (mpaios-platform) compatibility, step 1 of 3. Idempotent.
-- Run BEFORE migrations/0001_core_schema.sql. See supabase/hosted/README.md.

-- Drop every legacy policy on the hand-made tables so only the migration-defined
-- policies remain (permissive policies are OR-ed together; a leftover
-- "Users can manage own clients" would let members read clients).
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles','memory','conversations','messages','workflows','workflow_runs',
                        'agent_executions','evaluations','audit_log','token_usage','clients','campaigns',
                        'invitations','local_seo_scans')
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- Legacy check constraints on profiles.role may not include 'owner'; replace with the 0001 definition.
do $$
declare r record;
begin
  if to_regclass('public.profiles') is not null then
    for r in
      select conname from pg_constraint
      where conrelid = 'public.profiles'::regclass and contype = 'c'
        and pg_get_constraintdef(oid) ilike '%role%'
    loop
      execute format('alter table public.profiles drop constraint %I', r.conname);
    end loop;
    alter table public.profiles add constraint profiles_role_check
      check (role in ('owner','admin','member','viewer'));
  end if;
end $$;

-- Same for invitations.role / status (0005 expects admin|member|viewer and pending|accepted|revoked|expired).
do $$
declare r record;
begin
  if to_regclass('public.invitations') is not null then
    for r in
      select conname from pg_constraint
      where conrelid = 'public.invitations'::regclass and contype = 'c'
    loop
      execute format('alter table public.invitations drop constraint %I', r.conname);
    end loop;
  end if;
end $$;

create extension if not exists vector;
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;
