# ADR-0004: Knowledge "databases" are access-controlled collections

**Status:** accepted 2026-09-06

## Decision
Every ETL deposit targets one `knowledge_collections` row ("database"). Access is decided in the database:
`can_read_collection()` / `can_write_collection()` combine explicit `collection_members` (reader /
contributor / manager) with organization-wide visibility gated by profile role level (viewer 1 · member 2 ·
admin 3 · owner 4). RLS on documents/chunks/records and the retrieval RPCs (`match_chunks`,
`search_chunks_text`, `match_records`) call these functions, so a browser session and an agent run see the
same subset. The worker impersonates the acting user (`request.jwt.claim.sub`) for every search; service
calls (`service_role`) bypass for ingestion and maintenance only.

## Defaults
`company-kb` (org, viewer+), `client-intel` (org, member+), `sales-restricted` (members only, admin+).
