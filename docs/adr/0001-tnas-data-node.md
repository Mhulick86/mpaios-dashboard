# ADR-0001: The TNAS is the MAIOS data node

**Status:** accepted 2026-09-06 · **Supersedes:** blueprint §11.4 "TNAS stores binary assets only" for phase 1.

## Decision
Run the canonical stores on the TerraMaster T9-500 Pro: self-hosted Supabase (PostgreSQL 16 + pgvector,
Auth, REST, Realtime, Storage, Studio), Redis, and the MAIOS worker. PostgreSQL/Redis live on the 8 TB NVMe
pool; knowledge folders, uploads, recordings and backups live on the 24 TB TRAID pool. Models run on the Macs
through LM Studio (+ LM Link) reached over Tailscale.

## Why
- The dashboard already targets Supabase, so pointing `NEXT_PUBLIC_SUPABASE_URL` at the NAS keeps it working.
- The company wants to own its SQL and vector databases; pgvector inside PostgreSQL gives both with one backup.
- The NVMe pool satisfies the blueprint's "locally attached high-performance storage" requirement.

## Consequences
- The NAS is both database host and backup target, so the nightly dump **must** be copied offsite (§14.6).
- Vercel cannot join Tailscale: the worker and Supabase gateway are published through a Cloudflare tunnel
  (`api.` and `db.marketingpowered.ai`), databases stay private.
- Qdrant remains an option behind the same retrieval RPCs if pgvector limits are reached.
