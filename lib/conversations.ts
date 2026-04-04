/**
 * Server-side Conversation & Message Management
 * Replaces localStorage chatStorage.ts with Supabase persistence
 */

import { createClient } from "@/lib/supabase/client";
import type { Conversation, Message } from "@/lib/supabase/types";

const supabase = createClient();

// ── Conversations ──

export async function createConversation(params?: {
  title?: string;
  model?: string;
  systemContext?: string;
}): Promise<Conversation | null> {
  const { data, error } = await supabase
    .from("conversations")
    .insert({
      title: params?.title || "New Conversation",
      model: params?.model || "claude-sonnet-4-20250514",
      system_context: params?.systemContext,
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to create conversation:", error);
    return null;
  }
  return data;
}

export async function getConversations(params?: {
  limit?: number;
  offset?: number;
  includeArchived?: boolean;
}): Promise<Conversation[]> {
  let query = supabase
    .from("conversations")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(params?.limit ?? 50);

  if (!params?.includeArchived) {
    query = query.eq("is_archived", false);
  }

  if (params?.offset) {
    query = query.range(params.offset, params.offset + (params?.limit ?? 50) - 1);
  }

  const { data } = await query;
  return data || [];
}

export async function getConversation(id: string): Promise<Conversation | null> {
  const { data } = await supabase.from("conversations").select("*").eq("id", id).single();
  return data;
}

export async function updateConversation(
  id: string,
  updates: Partial<Pick<Conversation, "title" | "model" | "is_archived" | "metadata">>
): Promise<Conversation | null> {
  const { data } = await supabase
    .from("conversations")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  return data;
}

export async function deleteConversation(id: string): Promise<boolean> {
  const { error } = await supabase.from("conversations").delete().eq("id", id);
  return !error;
}

// ── Messages ──

export async function addMessage(params: {
  conversationId: string;
  role: Message["role"];
  content: string;
  agentId?: number;
  toolCalls?: Record<string, unknown>[];
  toolResults?: Record<string, unknown>[];
  tokensInput?: number;
  tokensOutput?: number;
  latencyMs?: number;
  model?: string;
  metadata?: Record<string, unknown>;
}): Promise<Message | null> {
  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: params.conversationId,
      role: params.role,
      content: params.content,
      agent_id: params.agentId,
      tool_calls: params.toolCalls,
      tool_results: params.toolResults,
      tokens_input: params.tokensInput || 0,
      tokens_output: params.tokensOutput || 0,
      latency_ms: params.latencyMs,
      model: params.model,
      metadata: params.metadata || {},
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to add message:", error);
    return null;
  }
  return data;
}

export async function getMessages(
  conversationId: string,
  limit?: number
): Promise<Message[]> {
  let query = supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (limit) query = query.limit(limit);

  const { data } = await query;
  return data || [];
}

// ── Title Generation ──

export function generateTitle(firstMessage: string): string {
  const cleaned = firstMessage.replace(/\n/g, " ").trim();
  if (cleaned.length <= 50) return cleaned;
  const words = cleaned.split(" ");
  let title = "";
  for (const word of words) {
    if ((title + " " + word).length > 47) break;
    title += (title ? " " : "") + word;
  }
  return title + "...";
}

// ── Context Compression ──
// Returns a compressed context window for the LLM, managing token budgets

export async function getCompressedContext(
  conversationId: string,
  maxMessages: number = 20,
  maxTokenBudget: number = 8000
): Promise<Message[]> {
  const messages = await getMessages(conversationId);

  if (messages.length <= maxMessages) return messages;

  // Keep system message + first message + last N messages
  const systemMessages = messages.filter((m) => m.role === "system");
  const firstUserMessage = messages.find((m) => m.role === "user");
  const recentMessages = messages.slice(-(maxMessages - systemMessages.length - 1));

  const compressed = [...systemMessages];
  if (firstUserMessage && !recentMessages.includes(firstUserMessage)) {
    compressed.push(firstUserMessage);
  }
  compressed.push(...recentMessages);

  // Token budget check
  let tokenCount = 0;
  const withinBudget: Message[] = [];
  for (let i = compressed.length - 1; i >= 0; i--) {
    const msgTokens = Math.ceil(compressed[i].content.length / 4);
    if (tokenCount + msgTokens > maxTokenBudget && withinBudget.length > 2) break;
    tokenCount += msgTokens;
    withinBudget.unshift(compressed[i]);
  }

  return withinBudget;
}
