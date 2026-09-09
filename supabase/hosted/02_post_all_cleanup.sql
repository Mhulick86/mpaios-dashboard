-- Hosted Supabase (mpaios-platform) compatibility, final step. Idempotent.
-- Run AFTER migrations/0007. Removes hand-made leftovers the security advisor
-- flags and that the dashboard no longer uses.

-- Legacy SECURITY DEFINER view from the April schema; nothing in the app reads it.
drop view if exists public.team_members;

-- 0001 installed pg_trgm into public; hosted Supabase expects extensions there.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'extensions')
     and exists (select 1 from pg_extension e join pg_namespace n on n.oid = e.extnamespace
                 where e.extname = 'pg_trgm' and n.nspname = 'public') then
    alter extension pg_trgm set schema extensions;
  end if;
end $$;

notify pgrst, 'reload schema';
