-- 0006: lock standard members out of everything that is not their own chat data.
--
-- Requires 0001-0005. Idempotent (drop policy if exists / create or replace).
--
-- Findings this closes (from the adversarial review of 0001-0005):
--   * workflows / workflow_runs / agent_executions were readable by any signed-in
--     user, and members could INSERT workflow_runs, which the worker then executes
--     under its service identity (knowledge-ACL bypass, Asana/Slack writes).
--   * workflow_triggers exposed webhook_token / webhook_secret to members and let
--     them create triggers; approvals could be decided by members; workflow_events,
--     external_object_map and idempotency_keys were readable.
--   * knowledge collections classified confidential/restricted/financial were
--     readable org-wide when min_role_level was set to 2 (the seeded client-intel).
--   * collection_members.members_manage compared a column to itself, so any
--     collection manager could add themselves to every collection.
--   * 0005's backfill turned stray 'owner' rows into permanent admins.
--
-- Rule of thumb after this file: members (level 2) see only rows they own
-- (conversations, messages, memory, evaluations, token_usage, audit_log,
-- workflow_runs.user_id) plus non-confidential org knowledge; every other table
-- is admin (level >= 3) only. The worker uses service_role and bypasses RLS.

-- ── Workflows ──────────────────────────────────────────────────────────────
drop policy if exists workflows_org    on public.workflows;
drop policy if exists workflows_write  on public.workflows;
drop policy if exists workflows_update on public.workflows;
drop policy if exists workflows_delete on public.workflows;
drop policy if exists workflows_read   on public.workflows;
create policy workflows_read   on public.workflows for select using (public.is_admin() or user_id = auth.uid());
create policy workflows_write  on public.workflows for insert with check (public.is_admin());
create policy workflows_update on public.workflows for update using (public.is_admin()) with check (public.is_admin());
create policy workflows_delete on public.workflows for delete using (public.is_admin());

-- ── Workflow runs: members may read their own runs, never create or edit any ──
drop policy if exists runs_read   on public.workflow_runs;
drop policy if exists runs_insert on public.workflow_runs;
drop policy if exists runs_update on public.workflow_runs;
drop policy if exists runs_write  on public.workflow_runs;
create policy runs_read  on public.workflow_runs for select using (public.is_admin() or user_id = auth.uid());
create policy runs_write on public.workflow_runs for all using (public.is_admin()) with check (public.is_admin());

-- ── Agent executions: readable when tied to the caller's own conversation/run ──
drop policy if exists exec_read   on public.agent_executions;
drop policy if exists exec_write  on public.agent_executions;
drop policy if exists exec_insert on public.agent_executions;
drop policy if exists exec_admin  on public.agent_executions;
create policy exec_read on public.agent_executions for select using (
  public.is_admin()
  or (conversation_id is not null and exists (select 1 from public.conversations c where c.id = conversation_id and c.user_id = auth.uid()))
  or (workflow_run_id is not null and exists (select 1 from public.workflow_runs r where r.id = workflow_run_id and r.user_id = auth.uid()))
);
-- Members may log executions for their own chat conversations (observability); nothing else.
create policy exec_insert on public.agent_executions for insert with check (
  public.is_admin()
  or (conversation_id is not null and exists (select 1 from public.conversations c where c.id = conversation_id and c.user_id = auth.uid()))
);
create policy exec_admin on public.agent_executions for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists exec_delete on public.agent_executions;
create policy exec_delete on public.agent_executions for delete using (public.is_admin());

-- ── Workflow engine tables (0003): admin only for browser sessions ─────────
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public'
      and tablename in ('workflow_triggers','workflow_events','webhook_inbox','outbox_events','approvals','external_object_map','idempotency_keys')
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

alter table public.idempotency_keys enable row level security;

create policy triggers_admin on public.workflow_triggers   for all using (public.is_admin()) with check (public.is_admin());
create policy events_admin   on public.workflow_events     for all using (public.is_admin()) with check (public.is_admin());
create policy inbox_admin    on public.webhook_inbox       for all using (public.is_admin()) with check (public.is_admin());
create policy outbox_admin   on public.outbox_events       for all using (public.is_admin()) with check (public.is_admin());
create policy approvals_admin on public.approvals          for all using (public.is_admin()) with check (public.is_admin());
create policy eom_admin      on public.external_object_map for all using (public.is_admin()) with check (public.is_admin());
create policy idem_admin     on public.idempotency_keys    for all using (public.is_admin()) with check (public.is_admin());

-- ── Knowledge: confidential collections need an admin unless explicitly shared ──
create or replace function public.can_read_collection(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_service() or exists (
    select 1 from public.knowledge_collections c
    where c.id = cid and (
      -- explicit grant by an admin/manager
      exists (select 1 from public.collection_members m where m.collection_id = c.id and m.user_id = auth.uid())
      -- organisation-wide visibility, but sensitive classifications always need level >= 3
      or (c.visibility = 'org'
          and public.current_role_level() >= greatest(
                c.min_role_level,
                case when lower(coalesce(c.classification, '')) in ('confidential','restricted','financial','secret') then 3 else 1 end)
          and exists (select 1 from public.profiles p where p.id = auth.uid() and p.organization_id = c.organization_id))
      or public.current_role_level() >= 4
    )) $$;

update public.knowledge_collections
   set min_role_level = greatest(min_role_level, 3)
 where lower(coalesce(classification, '')) in ('confidential','restricted','financial','secret')
   and min_role_level < 3;

-- Fix the self-comparison in members_manage (m.collection_id = collection_id was always true).
drop policy if exists members_manage on public.collection_members;
create policy members_manage on public.collection_members for all
  using (
    public.is_admin()
    or exists (select 1 from public.collection_members m
                where m.collection_id = collection_members.collection_id
                  and m.user_id = auth.uid() and m.role = 'manager'))
  with check (
    public.is_admin()
    or exists (select 1 from public.collection_members m
                where m.collection_id = collection_members.collection_id
                  and m.user_id = auth.uid() and m.role = 'manager'));

-- ── Single-owner invariant: stray owners become members, not admins ────────
-- (0005 demoted them to admin; this runs with no JWT subject so the
-- protect_profile_role trigger treats it as trusted.)
update public.profiles
   set role = 'member'
 where role = 'owner'
   and lower(coalesce(email, '')) <> lower(coalesce(public.app_setting('owner_email', 'mhulick@marketingpowered.ai'), 'mhulick@marketingpowered.ai'));

notify pgrst, 'reload schema';
