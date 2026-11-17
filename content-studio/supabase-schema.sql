-- Content Studio storage on Supabase (see supabase-store.mjs). Only the server, with a secret key, can use any of it.

-- The current version of the studio database snapshot. A save swaps it only if it still points at the version that
-- server read, so concurrent servers cannot overwrite each other.
create table if not exists public.studio_db (
  key text primary key,
  etag text not null,
  path text not null,
  updated_at timestamptz not null default now()
);
alter table public.studio_db enable row level security; -- no policies: anon and signed-in users get nothing

create or replace function public.studio_db_head(p_key text)
returns table (etag text, path text)
language sql stable security invoker set search_path = public
as $$ select d.etag, d.path from public.studio_db d where d.key = p_key $$;

create or replace function public.studio_db_swap(p_key text, p_old_etag text, p_new_etag text, p_path text)
returns jsonb
language plpgsql security invoker set search_path = public
as $$
declare v_old text;
begin
  if p_old_etag is null then
    insert into public.studio_db (key, etag, path) values (p_key, p_new_etag, p_path) on conflict (key) do nothing;
    if found then return jsonb_build_object('ok', true, 'old_path', null); end if;
    return jsonb_build_object('ok', false);
  end if;
  select d.path into v_old from public.studio_db d where d.key = p_key and d.etag = p_old_etag for update;
  if not found then return jsonb_build_object('ok', false); end if;
  update public.studio_db set etag = p_new_etag, path = p_path, updated_at = now() where key = p_key;
  return jsonb_build_object('ok', true, 'old_path', v_old);
end $$;

revoke all on function public.studio_db_head(text) from public, anon, authenticated;
revoke all on function public.studio_db_swap(text, text, text, text) from public, anon, authenticated;
grant execute on function public.studio_db_head(text) to service_role;
grant execute on function public.studio_db_swap(text, text, text, text) to service_role;
grant all on table public.studio_db to service_role;

-- Private bucket for the snapshot and images (no storage policies: only the secret key can read or write).
insert into storage.buckets (id, name, public) values ('studio', 'studio', false) on conflict (id) do nothing;
