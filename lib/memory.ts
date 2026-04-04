/**
 * Persistent Memory Layer with pgvector RAG
 * Replaces localStorage-based knowledgeBase.ts with Supabase-backed intelligence
 */

import { createClient } from "@/lib/supabase/client";
import type { Memory, MemoryCategory } from "@/lib/supabase/types";

const supabase = createClient();

// ── Embedding Generation ──
// Uses the configured AI provider to generate embeddings
// Falls back to a lightweight hash-based approach if no embedding API is available
async function generateEmbedding(text: string): Promise<number[] | null> {
  // Try to use OpenAI embeddings via stored API key
  try {
    const stored = localStorage.getItem("ai-settings");
    if (stored) {
      const settings = JSON.parse(stored);
      const openaiKey =
        settings?.providers?.openai?.apiKey ||
        settings?.providers?.OpenAI?.apiKey;
      if (openaiKey) {
        const res = await fetch("https://api.openai.com/v1/embeddings", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openaiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "text-embedding-3-small",
            input: text.slice(0, 8000),
          }),
        });
        if (res.ok) {
          const data = await res.json();
          return data.data[0].embedding;
        }
      }
    }
  } catch {
    // Fall through to null
  }
  return null;
}

// ── Core CRUD Operations ──

export async function storeMemory(params: {
  category: MemoryCategory;
  content: string;
  metadata?: Record<string, unknown>;
  confidence?: number;
  sourceAgent?: number;
  sourceConversation?: string;
  expiresAt?: string;
}): Promise<Memory | null> {
  const embedding = await generateEmbedding(params.content);

  const { data, error } = await supabase
    .from("memory")
    .insert({
      category: params.category,
      content: params.content,
      metadata: params.metadata || {},
      embedding,
      confidence: params.confidence ?? 0.8,
      source_agent: params.sourceAgent,
      source_conversation: params.sourceConversation,
      expires_at: params.expiresAt,
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to store memory:", error);
    return null;
  }
  return data;
}

export async function searchMemory(params: {
  query: string;
  category?: MemoryCategory;
  limit?: number;
  threshold?: number;
}): Promise<(Memory & { similarity: number })[]> {
  const embedding = await generateEmbedding(params.query);

  // If we have embeddings, use vector search
  if (embedding) {
    const { data, error } = await supabase.rpc("match_memories", {
      query_embedding: embedding,
      match_threshold: params.threshold ?? 0.7,
      match_count: params.limit ?? 10,
      filter_category: params.category || null,
    });

    if (error) {
      console.error("Vector search failed:", error);
      return fallbackTextSearch(params);
    }

    // Touch accessed memories
    for (const mem of data || []) {
      supabase.rpc("touch_memory", { memory_id: mem.id }).then(() => {});
    }

    return data || [];
  }

  // Fallback to text search
  return fallbackTextSearch(params);
}

async function fallbackTextSearch(params: {
  query: string;
  category?: MemoryCategory;
  limit?: number;
}): Promise<(Memory & { similarity: number })[]> {
  let query = supabase
    .from("memory")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(params.limit ?? 10);

  if (params.category) {
    query = query.eq("category", params.category);
  }

  // Simple text matching
  query = query.ilike("content", `%${params.query}%`);

  const { data, error } = await query;
  if (error) return [];
  return (data || []).map((m) => ({ ...m, similarity: 0.5 }));
}

export async function getMemories(params?: {
  category?: MemoryCategory;
  limit?: number;
  offset?: number;
}): Promise<Memory[]> {
  let query = supabase
    .from("memory")
    .select("*")
    .order("created_at", { ascending: false });

  if (params?.category) query = query.eq("category", params.category);
  if (params?.limit) query = query.limit(params.limit);
  if (params?.offset) query = query.range(params.offset, params.offset + (params?.limit ?? 20) - 1);

  const { data } = await query;
  return data || [];
}

export async function deleteMemory(id: string): Promise<boolean> {
  const { error } = await supabase.from("memory").delete().eq("id", id);
  return !error;
}

export async function getMemoryStats(): Promise<{
  total: number;
  byCategory: Record<string, number>;
  avgConfidence: number;
}> {
  const { data } = await supabase.from("memory").select("category, confidence");
  if (!data) return { total: 0, byCategory: {}, avgConfidence: 0 };

  const byCategory: Record<string, number> = {};
  let totalConfidence = 0;
  for (const m of data) {
    byCategory[m.category] = (byCategory[m.category] || 0) + 1;
    totalConfidence += m.confidence;
  }

  return {
    total: data.length,
    byCategory,
    avgConfidence: data.length ? totalConfidence / data.length : 0,
  };
}

// ── Context Building for System Prompts ──
// Retrieves relevant memories and formats them for injection into LLM context

export async function buildMemoryContext(
  query: string,
  maxTokens: number = 2000
): Promise<string> {
  const memories = await searchMemory({ query, limit: 8, threshold: 0.65 });
  if (!memories.length) return "";

  let context = "## Relevant Knowledge Base Memories\n\n";
  let estimatedTokens = 20;

  for (const mem of memories) {
    const entry = `**[${mem.category}]** (confidence: ${(mem.confidence * 100).toFixed(0)}%, relevance: ${(mem.similarity * 100).toFixed(0)}%)\n${mem.content}\n\n`;
    const entryTokens = Math.ceil(entry.length / 4);
    if (estimatedTokens + entryTokens > maxTokens) break;
    context += entry;
    estimatedTokens += entryTokens;
  }

  return context;
}

// ── Learning Extraction ──
// Parses agent outputs for learning markers and stores them

export async function extractAndStorelearnings(
  content: string,
  agentId: number,
  conversationId?: string
): Promise<number> {
  const pattern = /\[LEARNING:(\w+):(\d+(?:\.\d+)?)\]\s*(.+?)(?=\[LEARNING:|$)/gs;
  let match;
  let count = 0;

  while ((match = pattern.exec(content)) !== null) {
    const category = match[1] as MemoryCategory;
    const confidence = parseFloat(match[2]);
    const learning = match[3].trim();

    if (learning.length > 10) {
      await storeMemory({
        category,
        content: learning,
        confidence: Math.min(confidence, 1),
        sourceAgent: agentId,
        sourceConversation: conversationId,
      });
      count++;
    }
  }

  return count;
}
