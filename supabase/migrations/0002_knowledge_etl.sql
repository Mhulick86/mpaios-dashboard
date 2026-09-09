-- Knowledge base, access-controlled collections ("databases"), documents,
-- chunks (pgvector), structured records, and the ETL job ledger.

-- ── Collections: the user-facing "databases" an ETL job deposits into ────────
create table if not exists public.knowledge_collections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  slug text not null,
  name text not null,
  description text,
  kind text not null default 'documents' check (kind in ('documents','records','mixed')),
  classification text not null default 'internal' check (classification in ('public','internal','confidential','restricted','regulated')),
  visibility text not null default 'members' check (visibility in ('org','members')),   -- org = every member of the org can read; members = only collection_members
  min_role_level int not null default 1,                                                  -- 1 viewer, 2 member, 3 admin, 4 owner (applies when visibility = org)
  record_schema jsonb,                                                                    -- optional JSON schema the ETL normalizer targets for 'records'
  embedding_model text not null default 'text-embedding-nomic-embed-text-v1.5',
  embedding_dim int not null default 768,
  chunking jsonb not null default '{"max_chars":1800,"overlap":200,"strategy":"heading"}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);
drop trigger if exists knowledge_collections_updated on public.knowledge_collections;
create trigger knowledge_collections_updated before update on public.knowledge_collections for each row execute function public.set_updated_at();

create table if not exists public.collection_members (
  collection_id uuid not null references public.knowledge_collections(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'reader' check (role in ('reader','contributor','manager')),
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (collection_id, user_id)
);

-- Can the current user read a collection? (used by RLS and by the search RPCs)
create or replace function public.can_read_collection(cid uuid) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (
    select 1 from public.knowledge_collections c
    where c.id = cid and (
      exists (select 1 from public.collection_members m where m.collection_id = c.id and m.user_id = auth.uid())
      or (c.visibility = 'org' and public.current_role_level() >= c.min_role_level
          and exists (select 1 from public.profiles p where p.id = auth.uid() and p.organization_id = c.organization_id))
      or public.current_role_level() >= 4
    )) $$;

create or replace function public.can_write_collection(cid uuid) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (
    select 1 from public.knowledge_collections c
    where c.id = cid and (
      exists (select 1 from public.collection_members m where m.collection_id = c.id and m.user_id = auth.uid() and m.role in ('contributor','manager'))
      or public.current_role_level() >= 3
    )) $$;

-- ── Documents and versions ───────────────────────────────────────────────────
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.knowledge_collections(id) on delete cascade,
  title text not null,
  source_type text not null check (source_type in ('file','url','text','api','upload','email','transcript')),
  source_uri text,                       -- logical URI (tnas://tenants/<slug>/documents/...), URL, or null for pasted text
  mime_type text,
  byte_size bigint,
  checksum text,                         -- sha256 of the source bytes
  language text,
  tags text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','processing','active','failed','archived','superseded')),
  current_version_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists documents_collection_idx on public.documents (collection_id, status);
create unique index if not exists documents_checksum_idx on public.documents (collection_id, checksum) where checksum is not null;
drop trigger if exists documents_updated on public.documents;
create trigger documents_updated before update on public.documents for each row execute function public.set_updated_at();

create table if not exists public.document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  version int not null default 1,
  extracted_text text,
  extraction jsonb not null default '{}'::jsonb,   -- parser, page count, warnings
  chunking_version text,
  embedding_model text,
  chunk_count int not null default 0,
  created_at timestamptz not null default now(),
  unique (document_id, version)
);

-- ── Chunks: what retrieval returns ───────────────────────────────────────────
create table if not exists public.chunks (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.knowledge_collections(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  version_id uuid not null references public.document_versions(id) on delete cascade,
  chunk_index int not null,
  heading text,
  content text not null,
  token_estimate int,
  embedding vector(768),
  embedding_model text,
  tsv tsvector generated always as (to_tsvector('english', coalesce(heading,'') || ' ' || content)) stored,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (version_id, chunk_index)
);
create index if not exists chunks_collection_idx on public.chunks (collection_id);
create index if not exists chunks_embedding_idx on public.chunks using hnsw (embedding vector_cosine_ops);
create index if not exists chunks_tsv_idx on public.chunks using gin (tsv);

-- ── Structured records: tabular / JSON deposits ──────────────────────────────
create table if not exists public.records (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.knowledge_collections(id) on delete cascade,
  document_id uuid references public.documents(id) on delete cascade,
  record_key text,                        -- natural key from the source row when present
  data jsonb not null,
  summary text,                           -- optional LLM/ETL summary used for embedding
  embedding vector(768),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists records_collection_idx on public.records (collection_id);
create index if not exists records_data_idx on public.records using gin (data jsonb_path_ops);
create unique index if not exists records_key_idx on public.records (collection_id, record_key) where record_key is not null;
create index if not exists records_embedding_idx on public.records using hnsw (embedding vector_cosine_ops);
drop trigger if exists records_updated on public.records;
create trigger records_updated before update on public.records for each row execute function public.set_updated_at();

-- ── ETL jobs ─────────────────────────────────────────────────────────────────
create table if not exists public.etl_jobs (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.knowledge_collections(id) on delete cascade,
  document_id uuid references public.documents(id) on delete set null,
  requested_by uuid references auth.users(id) on delete set null,
  source_type text not null,
  source_uri text,
  input jsonb not null default '{}'::jsonb,        -- inline text, url, options, target schema overrides
  profile text not null default 'auto',           -- auto | document | tabular | web | transcript | records
  status text not null default 'queued' check (status in ('queued','running','completed','failed','cancelled')),
  stage text,                                       -- detect | extract | normalize | chunk | embed | load
  progress jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  error text,
  correlation_id uuid not null default gen_random_uuid(),
  idempotency_key text unique,
  attempt int not null default 0,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);
create index if not exists etl_jobs_status_idx on public.etl_jobs (status, created_at);
create index if not exists etl_jobs_collection_idx on public.etl_jobs (collection_id, created_at desc);

-- ── Retrieval RPCs (enforce collection access inside the function) ───────────
create or replace function public.match_chunks(
  query_embedding vector(768), match_count int default 8,
  collection_ids uuid[] default null, min_similarity real default 0.2, query_text text default null)
returns table (id uuid, collection_id uuid, document_id uuid, document_title text, source_uri text, heading text, content text, chunk_index int, similarity real, metadata jsonb)
language sql stable security definer set search_path = public, extensions as $$
  select c.id, c.collection_id, c.document_id, d.title, d.source_uri, c.heading, c.content, c.chunk_index,
         (1 - (c.embedding <=> query_embedding))::real as similarity, c.metadata
  from public.chunks c
  join public.documents d on d.id = c.document_id
  where c.embedding is not null
    and d.status = 'active'
    and (collection_ids is null or c.collection_id = any (collection_ids))
    and public.can_read_collection(c.collection_id)
    and 1 - (c.embedding <=> query_embedding) >= min_similarity
  order by c.embedding <=> query_embedding
  limit match_count $$;

create or replace function public.search_chunks_text(query_text text, match_count int default 8, collection_ids uuid[] default null)
returns table (id uuid, collection_id uuid, document_id uuid, document_title text, heading text, content text, rank real)
language sql stable security definer set search_path = public, extensions as $$
  select c.id, c.collection_id, c.document_id, d.title, c.heading, c.content,
         ts_rank(c.tsv, websearch_to_tsquery('english', query_text))::real as rank
  from public.chunks c join public.documents d on d.id = c.document_id
  where c.tsv @@ websearch_to_tsquery('english', query_text)
    and d.status = 'active'
    and (collection_ids is null or c.collection_id = any (collection_ids))
    and public.can_read_collection(c.collection_id)
  order by rank desc limit match_count $$;

create or replace function public.match_records(query_embedding vector(768), match_count int default 8, collection_ids uuid[] default null, min_similarity real default 0.2)
returns table (id uuid, collection_id uuid, record_key text, data jsonb, summary text, similarity real)
language sql stable security definer set search_path = public, extensions as $$
  select r.id, r.collection_id, r.record_key, r.data, r.summary, (1 - (r.embedding <=> query_embedding))::real
  from public.records r
  where r.embedding is not null
    and (collection_ids is null or r.collection_id = any (collection_ids))
    and public.can_read_collection(r.collection_id)
    and 1 - (r.embedding <=> query_embedding) >= min_similarity
  order by r.embedding <=> query_embedding limit match_count $$;

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.knowledge_collections enable row level security;
alter table public.collection_members enable row level security;
alter table public.documents enable row level security;
alter table public.document_versions enable row level security;
alter table public.chunks enable row level security;
alter table public.records enable row level security;
alter table public.etl_jobs enable row level security;

drop policy if exists collections_read on public.knowledge_collections;
create policy collections_read on public.knowledge_collections for select using (public.can_read_collection(id));
drop policy if exists collections_manage on public.knowledge_collections;
create policy collections_manage on public.knowledge_collections for all using (public.current_role_level() >= 3) with check (public.current_role_level() >= 3);
drop policy if exists members_read on public.collection_members;
create policy members_read on public.collection_members for select using (user_id = auth.uid() or public.current_role_level() >= 3);
drop policy if exists members_manage on public.collection_members;
create policy members_manage on public.collection_members for all using (public.current_role_level() >= 3 or exists (select 1 from public.collection_members m where m.collection_id = collection_id and m.user_id = auth.uid() and m.role = 'manager'));
drop policy if exists documents_read on public.documents;
create policy documents_read on public.documents for select using (public.can_read_collection(collection_id));
drop policy if exists documents_write on public.documents;
create policy documents_write on public.documents for all using (public.can_write_collection(collection_id)) with check (public.can_write_collection(collection_id));
drop policy if exists versions_read on public.document_versions;
create policy versions_read on public.document_versions for select using (exists (select 1 from public.documents d where d.id = document_id and public.can_read_collection(d.collection_id)));
drop policy if exists chunks_read on public.chunks;
create policy chunks_read on public.chunks for select using (public.can_read_collection(collection_id));
drop policy if exists records_read on public.records;
create policy records_read on public.records for select using (public.can_read_collection(collection_id));
drop policy if exists records_write on public.records;
create policy records_write on public.records for all using (public.can_write_collection(collection_id)) with check (public.can_write_collection(collection_id));
drop policy if exists etl_read on public.etl_jobs;
create policy etl_read on public.etl_jobs for select using (requested_by = auth.uid() or public.can_write_collection(collection_id));
drop policy if exists etl_insert on public.etl_jobs;
create policy etl_insert on public.etl_jobs for insert with check (public.can_write_collection(collection_id));

-- Default collections for Marketing Powered.
insert into public.knowledge_collections (organization_id, slug, name, description, visibility, min_role_level, classification)
select o.id, v.slug, v.name, v.description, v.visibility, v.min_role_level, v.classification
from public.organizations o,
 (values
   ('company-kb', 'Company Knowledge Base', 'Policies, playbooks, process docs, agent definitions, templates.', 'org', 1, 'internal'),
   ('client-intel', 'Client Intelligence', 'Per-client research, briefs, and performance narratives.', 'org', 2, 'confidential'),
   ('sales-restricted', 'Sales & Contracts (restricted)', 'Proposals, contracts, pricing. Membership only.', 'members', 3, 'restricted')
 ) as v(slug, name, description, visibility, min_role_level, classification)
where o.slug = 'marketing-powered'
on conflict (organization_id, slug) do nothing;
