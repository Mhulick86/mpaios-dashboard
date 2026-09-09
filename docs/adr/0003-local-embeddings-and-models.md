# ADR-0003: Local embeddings and models through LM Studio

**Status:** accepted 2026-09-06

## Decision
Embeddings use `text-embedding-nomic-embed-text-v1.5` (768-d) served by LM Studio's OpenAI-compatible API on
the Mac Studio / MacBook, reachable from the NAS over Tailscale (LM Link keeps model resolution consistent).
Chat/agent steps default to a local instruct model on the same server; `claude-*` models route to Anthropic
when a key is present. Transcription uses `whisper-large-v3-turbo` via the same server.

## Rules
- Every vector row stores `embedding_model`; changing the model means re-embedding a collection
  (`knowledge_collections.embedding_model`, `embedding_dim`). Never mix models in one collection.
- The ETL pipeline never depends on a chat model: LLM normalization/summaries are optional with deterministic
  fallbacks. Retrieval only needs the embedding model.
- Dev fallback: Ollama's OpenAI-compatible endpoint (`http://localhost:11434/v1`).
