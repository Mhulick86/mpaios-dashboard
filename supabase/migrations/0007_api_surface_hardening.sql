-- 0007: harden the PostgREST surface (findings from the Supabase security advisor
-- after 0001-0006). Idempotent; safe on hosted and self-hosted stacks.

-- organizations was created without RLS.
alter table public.organizations enable row level security;
drop policy if exists organizations_read  on public.organizations;
drop policy if exists organizations_admin on public.organizations;
create policy organizations_read  on public.organizations for select using (auth.uid() is not null);
create policy organizations_admin on public.organizations for all using (public.is_admin()) with check (public.is_admin());

-- Trigger functions and internal helpers must never be reachable via /rest/v1/rpc.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('handle_new_user','protect_profile_role','validate_invitation','notify_workflow_event','set_updated_at','app_setting')
  loop
    execute format('revoke execute on function %s from public', r.sig);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke execute on function %s from anon', r.sig); end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then execute format('revoke execute on function %s from authenticated', r.sig); end if;
  end loop;
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    grant execute on function public.handle_new_user() to supabase_auth_admin;
  end if;
end $$;

-- Retrieval RPCs are for signed-in users and the worker only (they enforce
-- collection access internally, but anonymous callers have no business here).
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('match_chunks','match_records','search_chunks_text','match_memory')
  loop
    execute format('revoke execute on function %s from public', r.sig);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke execute on function %s from anon', r.sig); end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then execute format('grant execute on function %s to authenticated', r.sig); end if;
    if exists (select 1 from pg_roles where rolname = 'service_role') then execute format('grant execute on function %s to service_role', r.sig); end if;
  end loop;
end $$;

-- Pin search_path on every function we own that lacked it (the "extensions"
-- entry is where hosted Supabase keeps pgvector; harmless when absent).
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('is_service','email_domain','match_memory','set_updated_at','notify_workflow_event',
                        'match_memories','touch_memory','update_updated_at','increment_message_count')
  loop
    execute format('alter function %s set search_path = public, extensions', r.sig);
  end loop;
end $$;

notify pgrst, 'reload schema';
