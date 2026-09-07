# MAIOS foundation (branch `maios-foundation`)

What exists now, how it fits together, and how to run it. Blueprint: `~/Downloads/09062026_Build-Ready Technical Implementation Blueprint.pdf`.

```
Vercel (this Next.js app)  ──HTTPS──▶  api.marketingpowered.ai  ──▶  services/worker (TNAS)
   │  Supabase JS client                 (Cloudflare tunnel)           ├─ ETL agent   (detect→extract→normalize→chunk→embed→load)
   └──HTTPS──▶ db.marketingpowered.ai ─▶ self-hosted Supabase (TNAS)   ├─ workflow engine (BullMQ, cron, events, webhooks, approvals)
                                          PostgreSQL 16 + pgvector      ├─ knowledge search (hybrid vector + FTS, per-user access)
                                                                        └─ providers: Asana, Slack, LM Studio (Tailscale), Anthropic
```

| Piece | Path |
|---|---|
| Schema (27 tables, RLS, retrieval RPCs) | `supabase/migrations/0001…0004.sql` |
| Worker service | `services/worker` (`pnpm dev`, HTTP :8787) |
| Dev stack (Postgres+pgvector, Redis) | `infra/dev/docker-compose.yml` |
| TNAS stack (Supabase overlay, worker, tunnel, backups) | `infra/tnas/` + `.env.maios.example` |
| Dashboard integration | `lib/maios.ts`, `app/api/maios/[...path]/route.ts`, `app/api/chat/route.ts` (`search_knowledge` tool + pre-retrieval), `app/data`, `app/workflows` |
| Decisions | `docs/adr/` |

## Worker HTTP API (header `x-internal-key`, optional `x-user-id`)
- `GET /health`
- `GET/POST /v1/collections`, `POST /v1/collections/:id/members`, `DELETE …/members/:userId`
- `POST /v1/etl/jobs` `{collection, url|text|source_uri, title?, profile?, route?:'auto', record_key?}` · `POST /v1/etl/upload` (multipart) · `GET /v1/etl/jobs[/:id]` · `POST /v1/etl/scan` · `GET /v1/documents`
- `POST /v1/knowledge/search` `{query, collections?, limit?, include_records?}` → hits + citations
- `GET/POST /v1/workflows`, `DELETE /v1/workflows/:id`, `POST /v1/workflows/:id/runs`, `GET /v1/workflows/:id/runs`, `GET /v1/runs[/:id]`, `POST /v1/runs/:id/cancel`
- `POST /v1/triggers` (schedule/event/webhook) · `DELETE /v1/triggers/:id` · `POST /webhooks/:token` (public)
- `GET /v1/approvals`, `POST /v1/approvals/:id/decide` · `POST /v1/events`, `GET /v1/events`

## Dashboard env (Vercel)
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (NAS Supabase), `MAIOS_WORKER_URL`,
`MAIOS_INTERNAL_KEY`, optional `MAIOS_DEFAULT_USER_ID` (dev only: acting user for anonymous sessions).

## Verified on 2026-09-06 (Mac dev stack)
28 files ingested from the repo docs (markdown, a 56-chunk .docx, a PDF, a CSV → 3 records), hybrid search
with per-role access (member denied on `sales-restricted`, viewer denied on `client-intel`), a webhook-triggered
3-step workflow (retrieve → Agent 02 brief with citations on a local model → event), duplicate webhook dedupe.

## Not done yet
Supabase self-host bring-up on the NAS (needs the rebuilt NAS), Cloudflare tunnel, Vercel env switch,
per-step visual canvas (the Workflows page is form-based), remaining WP10 workflow templates, Close CRM adapter.
