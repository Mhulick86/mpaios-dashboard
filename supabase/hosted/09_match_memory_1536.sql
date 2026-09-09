-- Hosted Supabase (mpaios-platform) compatibility, step 3 of 3. Idempotent.
-- Run AFTER migrations/0006. The dashboard embeds memory with OpenAI
-- text-embedding-3-small (1536 dims), so match_memory must take vector(1536);
-- 0001's vector(768) overload is dropped to keep the RPC unambiguous.

drop function if exists public.match_memory(vector(768), int, uuid, real);
drop function if exists public.match_memory(vector, int, uuid, real);

create or replace function public.match_memory(query_embedding vector(1536), match_count int default 8, filter_user uuid default null, min_similarity real default 0.3)
returns table (id uuid, category text, content text, confidence real, metadata jsonb, similarity real)
language sql stable security invoker as $$
  select m.id, m.category, m.content, m.confidence, m.metadata, (1 - (m.embedding <=> query_embedding))::real as similarity
  from public.memory m
  where m.embedding is not null
    and (filter_user is null or m.user_id = filter_user)
    and (m.expires_at is null or m.expires_at > now())
    and 1 - (m.embedding <=> query_embedding) >= min_similarity
  order by m.embedding <=> query_embedding
  limit match_count $$;

notify pgrst, 'reload schema';
