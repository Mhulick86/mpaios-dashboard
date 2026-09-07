# ADR-0002: A code-defined workflow engine replaces n8n

**Status:** accepted 2026-09-06

## Decision
Retire n8n (`n8n.marketingpowered.ai`). Long-running integrations, schedules, webhooks, approvals and
operational automations run in `services/worker` (BullMQ on Redis, state in PostgreSQL). Workflows are rows in
`workflows` (steps as JSON) edited from the dashboard's Workflows page; triggers are `workflow_triggers`
(cron / event / webhook); every run is a `workflow_runs` row with per-step `agent_executions`.

## Why
- n8n Community paywalls SSO, external secrets, environments/source control, log streaming and project RBAC.
- Blueprint §12 already forbids n8n from owning business rules; the ten WP10 workflows are event-driven jobs
  with retries, idempotency and correlation IDs, which BullMQ workers provide directly.
- The dashboard already had `workflows` / `workflow_runs` tables and a browser-side runner; the engine makes
  those durable and server-side without changing the data model.

## Step types
`agent` · `search_knowledge` · `etl.ingest` · `asana.create_task` · `asana.create_project` · `slack.notify` ·
`http.request` (allowlisted hosts) · `emit_event` · `wait_approval` · `transform`. Templating: `{{input.x}}`,
`{{steps.N.output.y}}`, `{{prev.text}}`.
