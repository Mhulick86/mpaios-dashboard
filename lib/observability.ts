/**
 * Observability System
 * Token tracking, prompt logging, error monitoring, performance metrics
 */

import { createClient } from "@/lib/supabase/client";
import type { AuditLogEntry, TokenUsage } from "@/lib/supabase/types";

const supabase = createClient();

// ── Cost Calculations ──
const COST_PER_1K: Record<string, { input: number; output: number }> = {
  "gpt-4o": { input: 0.0025, output: 0.01 },
  "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
  "gpt-4-turbo": { input: 0.01, output: 0.03 },
  "o1": { input: 0.015, output: 0.06 },
  "o3-mini": { input: 0.00115, output: 0.0044 },
  "claude-sonnet-4-20250514": { input: 0.003, output: 0.015 },
  "claude-3.5-haiku": { input: 0.0008, output: 0.004 },
  "claude-3-opus": { input: 0.015, output: 0.075 },
  "gemini-2.0-flash": { input: 0.0001, output: 0.0004 },
  "gemini-2.0-pro": { input: 0.00125, output: 0.005 },
  "gemini-1.5-pro": { input: 0.00125, output: 0.005 },
};

function calculateCost(
  model: string,
  tokensInput: number,
  tokensOutput: number
): number {
  const rates = COST_PER_1K[model] || { input: 0.001, output: 0.002 };
  return (tokensInput / 1000) * rates.input + (tokensOutput / 1000) * rates.output;
}

function detectProvider(model: string): string {
  if (model.startsWith("gpt") || model.startsWith("o1") || model.startsWith("o3")) return "openai";
  if (model.startsWith("claude")) return "anthropic";
  if (model.startsWith("gemini")) return "google";
  if (model.startsWith("sonar")) return "perplexity";
  return "custom";
}

// ── Token Usage Tracking ──

export async function trackTokenUsage(params: {
  model: string;
  tokensInput: number;
  tokensOutput: number;
  endpoint?: string;
  conversationId?: string;
  agentId?: number;
}): Promise<void> {
  const cost = calculateCost(params.model, params.tokensInput, params.tokensOutput);
  const provider = detectProvider(params.model);

  await supabase.from("token_usage").insert({
    model: params.model,
    provider,
    tokens_input: params.tokensInput,
    tokens_output: params.tokensOutput,
    cost,
    endpoint: params.endpoint,
    conversation_id: params.conversationId,
    agent_id: params.agentId,
  });
}

// ── Audit Logging ──

export async function logAuditEvent(params: {
  eventType: string;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  tokensUsed?: number;
  cost?: number;
  model?: string;
  latencyMs?: number;
}): Promise<void> {
  await supabase.from("audit_log").insert({
    event_type: params.eventType,
    resource_type: params.resourceType,
    resource_id: params.resourceId,
    details: params.details || {},
    tokens_used: params.tokensUsed || 0,
    cost: params.cost || 0,
    model: params.model,
    latency_ms: params.latencyMs,
  });
}

// ── Analytics Queries ──

export async function getTokenUsageSummary(days: number = 30): Promise<{
  totalTokens: number;
  totalCost: number;
  byModel: Record<string, { tokens: number; cost: number }>;
  byProvider: Record<string, { tokens: number; cost: number }>;
  daily: { date: string; tokens: number; cost: number }[];
}> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data } = await supabase
    .from("token_usage")
    .select("*")
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: true });

  if (!data) {
    return { totalTokens: 0, totalCost: 0, byModel: {}, byProvider: {}, daily: [] };
  }

  let totalTokens = 0;
  let totalCost = 0;
  const byModel: Record<string, { tokens: number; cost: number }> = {};
  const byProvider: Record<string, { tokens: number; cost: number }> = {};
  const dailyMap: Record<string, { tokens: number; cost: number }> = {};

  for (const row of data) {
    const tokens = row.tokens_input + row.tokens_output;
    totalTokens += tokens;
    totalCost += row.cost;

    if (!byModel[row.model]) byModel[row.model] = { tokens: 0, cost: 0 };
    byModel[row.model].tokens += tokens;
    byModel[row.model].cost += row.cost;

    if (!byProvider[row.provider]) byProvider[row.provider] = { tokens: 0, cost: 0 };
    byProvider[row.provider].tokens += tokens;
    byProvider[row.provider].cost += row.cost;

    const date = row.created_at.split("T")[0];
    if (!dailyMap[date]) dailyMap[date] = { tokens: 0, cost: 0 };
    dailyMap[date].tokens += tokens;
    dailyMap[date].cost += row.cost;
  }

  const daily = Object.entries(dailyMap).map(([date, v]) => ({ date, ...v }));

  return { totalTokens, totalCost, byModel, byProvider, daily };
}

export async function getAgentPerformance(): Promise<{
  agentId: number;
  agentName: string;
  executions: number;
  avgLatency: number;
  successRate: number;
  totalTokens: number;
  totalCost: number;
}[]> {
  const { data } = await supabase
    .from("agent_executions")
    .select("agent_id, agent_name, status, latency_ms, tokens_used, cost");

  if (!data) return [];

  const grouped: Record<number, typeof data> = {};
  for (const row of data) {
    if (!grouped[row.agent_id]) grouped[row.agent_id] = [];
    grouped[row.agent_id].push(row);
  }

  return Object.entries(grouped).map(([agentId, rows]) => {
    const completed = rows.filter((r) => r.status === "completed").length;
    const latencies = rows.filter((r) => r.latency_ms).map((r) => r.latency_ms!);
    return {
      agentId: Number(agentId),
      agentName: rows[0].agent_name,
      executions: rows.length,
      avgLatency: latencies.length
        ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
        : 0,
      successRate: rows.length ? (completed / rows.length) * 100 : 0,
      totalTokens: rows.reduce((s, r) => s + (r.tokens_used || 0), 0),
      totalCost: rows.reduce((s, r) => s + (r.cost || 0), 0),
    };
  });
}

export async function getRecentAuditLog(limit: number = 50): Promise<AuditLogEntry[]> {
  const { data } = await supabase
    .from("audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  return data || [];
}

export async function getErrorLog(limit: number = 20): Promise<{
  id: string;
  agentId: number;
  agentName: string;
  error: string;
  action: string;
  startedAt: string;
}[]> {
  const { data } = await supabase
    .from("agent_executions")
    .select("id, agent_id, agent_name, error, action, started_at")
    .eq("status", "failed")
    .order("started_at", { ascending: false })
    .limit(limit);

  return (data || []).map((r) => ({
    id: r.id,
    agentId: r.agent_id,
    agentName: r.agent_name,
    error: r.error || "Unknown error",
    action: r.action,
    startedAt: r.started_at,
  }));
}
