# MAIOS on the TNAS (TerraMaster T9-500 Pro)

The NAS is the **data node**: self-hosted Supabase (PostgreSQL 16 + pgvector, Auth, REST, Realtime,
Storage, Studio), Redis, the MAIOS worker (ETL agent, workflow engine, scheduler, webhooks, knowledge
search), a Cloudflare tunnel for `api.marketingpowered.ai`, and nightly backups. Models run on the Macs
through LM Studio + LM Link over Tailscale. The Vercel dashboard talks to Supabase and to the worker.

## 0. NAS layout (after the TOS rebuild)
| Pool / volume | Use |
|---|---|
| M.2 NVMe pool (Btrfs) | `/VolumeX/maios/docker` – Postgres data, Redis, Qdrant if added later |
| 3×24 TB (+Exos) TRAID pool | `/VolumeY/maios/tenants/<org>/kb/<collection>/…` knowledge folders and uploads; `/VolumeY/maios/backups` |

Adjust `MAIOS_DATA_ROOT` / `MAIOS_DOCKER_ROOT` in `.env.maios` to the real mount points TOS assigns.

## 1. One-time setup on the NAS
1. TOS App Center → install **Docker Engine** (and Docker Manager). Join the NAS to Tailscale
   (`tailscale up`) so it reaches the LM Studio host; keep the old `tnas-n8n` node name or rename.
2. `git clone --depth 1 https://github.com/supabase/supabase && cp -r supabase/docker /VolumeX/maios/supabase`
   then in that folder `cp .env.example .env` and set strong `POSTGRES_PASSWORD`, `JWT_SECRET`, `ANON_KEY`,
   `SERVICE_ROLE_KEY`, `DASHBOARD_PASSWORD`, `SITE_URL=https://app.marketingpowered.ai`, `API_EXTERNAL_URL=https://db.marketingpowered.ai`.
   (Generate keys with the Supabase self-hosting guide's JWT tool.)
3. Clone this repo next to it and `cp .env.maios.example .env.maios`; fill it in.
4. Apply MAIOS migrations to the Supabase database (in order):
   `for f in supabase/migrations/*.sql; do docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < $f; done`
5. Start everything:
   `docker compose -f /VolumeX/maios/supabase/docker-compose.yml -f infra/tnas/docker-compose.maios.yml --env-file .env.maios up -d`
6. Cloudflare Zero Trust → create a tunnel; route `api.marketingpowered.ai` → `http://worker:8787` and
   `db.marketingpowered.ai` → `http://kong:8000` (Supabase gateway). Put Cloudflare Access (SSO) in front of
   Studio. Alternative without Cloudflare: `tailscale funnel` on the NAS.
7. Point the Vercel project at the NAS: `NEXT_PUBLIC_SUPABASE_URL=https://db.marketingpowered.ai`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY>`, `MAIOS_WORKER_URL=https://api.marketingpowered.ai`,
   `MAIOS_INTERNAL_KEY=<INTERNAL_API_KEY>`, `SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY>`.
   Users sign in through Supabase Auth on the NAS (enable Google provider in Studio → Authentication).

## 2. Day-2
- Drop files into `…/kb/<collection-slug>/` and the watcher ingests them (every `KB_SCAN_INTERVAL_SEC`),
  or use the Data page / `POST /v1/etl/jobs`.
- Load a chat model in LM Studio's Developer tab (or enable JIT loading) on the model host. Embeddings:
  `text-embedding-nomic-embed-text-v1.5`. Transcription: `whisper-large-v3-turbo`.
- Backups land in `/VolumeY/maios/backups/postgres/YYYY/MM/DD`. Copy that folder offsite (rclone to
  cloud storage or a second NAS); a backup that only lives on the same box is not disaster recovery.
- Health: `curl -H "x-internal-key: $INTERNAL_API_KEY" https://api.marketingpowered.ai/health`.

## 3. Dev on a Mac
`docker compose -f infra/dev/docker-compose.yml up -d` (Postgres 5433, Redis 6380), apply migrations,
`cd services/worker && cp .env.example .env && pnpm install && pnpm dev`. LM Studio server on :1234.
