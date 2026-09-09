-- Service role (worker, API) bypasses collection access checks; browser sessions do not.
create or replace function public.is_service() returns boolean language sql stable as $$
  select coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role' $$;

create or replace function public.can_read_collection(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_service() or exists (
    select 1 from public.knowledge_collections c
    where c.id = cid and (
      exists (select 1 from public.collection_members m where m.collection_id = c.id and m.user_id = auth.uid())
      or (c.visibility = 'org' and public.current_role_level() >= c.min_role_level
          and exists (select 1 from public.profiles p where p.id = auth.uid() and p.organization_id = c.organization_id))
      or public.current_role_level() >= 4
    )) $$;

create or replace function public.can_write_collection(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_service() or exists (
    select 1 from public.knowledge_collections c
    where c.id = cid and (
      exists (select 1 from public.collection_members m where m.collection_id = c.id and m.user_id = auth.uid() and m.role in ('contributor','manager'))
      or public.current_role_level() >= 3
    )) $$;
