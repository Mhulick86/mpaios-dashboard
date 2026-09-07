# Applying the migrations to the hosted Supabase project

The hosted project `mpaios-platform` (`rxbgikvmussdstsjciwt`) was created by hand in
April 2026 before `supabase/migrations/` existed. Its tables have the same names as
`0001_core_schema.sql` but slightly different shapes (no `organization_id` columns,
`memory.embedding` is `vector(1536)` for OpenAI `text-embedding-3-small`, legacy
policy names such as "Users can manage own clients"). The files in this folder adapt
that schema so the numbered migrations apply cleanly. Run them in this order:

| Step | File | Why |
|---|---|---|
| 1 | `hosted/00_pre_compat.sql` | drop the legacy permissive policies (they would be OR-ed with the new ones) and the legacy `profiles.role` check |
| 2 | `migrations/0001_core_schema.sql` | creates the missing tables/functions; existing tables are skipped (`if not exists`) |
| 3 | `hosted/01_post_0001_columns.sql` | adds the columns 0001 would have created on the skipped tables |
| 4 | `migrations/0002` … `0006` | knowledge, workflow engine, service access, Google SSO roles, member lockdown |
| 5 | `hosted/09_match_memory_1536.sql` | re-declare `match_memory` for the 1536-d embeddings the dashboard writes |

Each file is idempotent. Apply with the Supabase MCP `apply_migration`, the SQL
editor, or `supabase db push` after copying them into `supabase/migrations/` with a
timestamp prefix. A fresh self-hosted database (TNAS) needs only `migrations/`.

After applying, in the Supabase dashboard: Authentication → Providers → enable
**Google** only and disable Email; Authentication → URL configuration → set the
Site URL and redirect URLs listed in `docs/runbooks/deploy-maios-subdomain.md`.
