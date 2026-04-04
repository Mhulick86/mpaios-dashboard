/**
 * Evaluation & Feedback Loop System
 * Quality scoring, user feedback, auto-metrics, reinforcement learning
 */

import { createClient } from "@/lib/supabase/client";
import type { Evaluation, QualityScores, AutoMetrics } from "@/lib/supabase/types";

const supabase = createClient();

// ── User Feedback ──

export async function submitFeedback(params: {
  messageId?: string;
  conversationId?: string;
  agentExecutionId?: string;
  thumbs?: "up" | "down";
  rating?: number;
  feedbackText?: string;
  tags?: string[];
}): Promise<Evaluation | null> {
  const { data, error } = await supabase
    .from("evaluations")
    .insert({
      message_id: params.messageId,
      conversation_id: params.conversationId,
      agent_execution_id: params.agentExecutionId,
      thumbs: params.thumbs,
      rating: params.rating,
      feedback_text: params.feedbackText,
      tags: params.tags || [],
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to submit feedback:", error);
    return null;
  }
  return data;
}

// ── Auto Quality Scoring ──
// Runs heuristic quality analysis on AI responses

export function computeAutoMetrics(params: {
  responseContent: string;
  latencyMs: number;
  tokensUsed: number;
  toolsCalled: number;
  agentsInvoked: number;
}): AutoMetrics {
  return {
    response_length: params.responseContent.length,
    latency_ms: params.latencyMs,
    tokens_used: params.tokensUsed,
    tools_called: params.toolsCalled,
    agents_invoked: params.agentsInvoked,
  };
}

export function computeQualityScores(
  responseContent: string,
  userQuery: string
): QualityScores {
  const response = responseContent.toLowerCase();
  const query = userQuery.toLowerCase();

  // Relevance: keyword overlap between query and response
  const queryWords = query.split(/\s+/).filter((w) => w.length > 3);
  const matchedWords = queryWords.filter((w) => response.includes(w));
  const relevance = queryWords.length
    ? Math.min((matchedWords.length / queryWords.length) * 1.2, 1)
    : 0.5;

  // Completeness: response length relative to query complexity
  const queryComplexity = Math.max(queryWords.length, 1);
  const expectedLength = queryComplexity * 100;
  const completeness = Math.min(responseContent.length / expectedLength, 1);

  // Actionability: presence of action-oriented language
  const actionPatterns = [
    /\bstep\s*\d/i, /\brecommend/i, /\bshould\b/i, /\baction\b/i,
    /\bimplement/i, /\boptimize/i, /\bcreate\b/i, /\blaunch\b/i,
    /\btarget\b/i, /\bschedule\b/i, /\bbudget\b/i, /\bstrategy\b/i,
  ];
  const actionScore = actionPatterns.filter((p) => p.test(responseContent)).length;
  const actionability = Math.min(actionScore / 5, 1);

  // Clarity: sentence structure quality
  const sentences = responseContent.split(/[.!?]+/).filter((s) => s.trim().length > 5);
  const avgSentenceLength = sentences.length
    ? sentences.reduce((s, sent) => s + sent.split(/\s+/).length, 0) / sentences.length
    : 0;
  const clarity = avgSentenceLength > 5 && avgSentenceLength < 40 ? 0.8 : 0.5;

  return {
    relevance: Math.round(relevance * 100) / 100,
    accuracy: 0.8, // Requires ground truth - default to 0.8
    completeness: Math.round(completeness * 100) / 100,
    actionability: Math.round(actionability * 100) / 100,
    clarity: Math.round(clarity * 100) / 100,
  };
}

// ── Store Evaluation with Auto Metrics ──

export async function evaluateResponse(params: {
  messageId: string;
  conversationId: string;
  responseContent: string;
  userQuery: string;
  latencyMs: number;
  tokensUsed: number;
  toolsCalled?: number;
  agentsInvoked?: number;
}): Promise<void> {
  const qualityScores = computeQualityScores(params.responseContent, params.userQuery);
  const autoMetrics = computeAutoMetrics({
    responseContent: params.responseContent,
    latencyMs: params.latencyMs,
    tokensUsed: params.tokensUsed,
    toolsCalled: params.toolsCalled || 0,
    agentsInvoked: params.agentsInvoked || 0,
  });

  await supabase.from("evaluations").insert({
    message_id: params.messageId,
    conversation_id: params.conversationId,
    quality_scores: qualityScores,
    auto_metrics: autoMetrics,
  });
}

// ── Evaluation Analytics ──

export async function getEvaluationSummary(days: number = 30): Promise<{
  totalEvaluations: number;
  avgRating: number;
  thumbsUpRate: number;
  avgQualityScores: QualityScores;
  recentFeedback: Evaluation[];
}> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data } = await supabase
    .from("evaluations")
    .select("*")
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false });

  if (!data || !data.length) {
    return {
      totalEvaluations: 0,
      avgRating: 0,
      thumbsUpRate: 0,
      avgQualityScores: {},
      recentFeedback: [],
    };
  }

  const rated = data.filter((e) => e.rating);
  const thumbed = data.filter((e) => e.thumbs);
  const thumbsUp = thumbed.filter((e) => e.thumbs === "up").length;

  const qualityKeys: (keyof QualityScores)[] = [
    "relevance", "accuracy", "completeness", "actionability", "clarity",
  ];
  const avgQualityScores: QualityScores = {};
  for (const key of qualityKeys) {
    const values = data
      .map((e) => (e.quality_scores as QualityScores)?.[key])
      .filter((v): v is number => typeof v === "number");
    if (values.length) {
      avgQualityScores[key] = Math.round(
        (values.reduce((a, b) => a + b, 0) / values.length) * 100
      ) / 100;
    }
  }

  return {
    totalEvaluations: data.length,
    avgRating: rated.length
      ? Math.round((rated.reduce((s, e) => s + e.rating!, 0) / rated.length) * 10) / 10
      : 0,
    thumbsUpRate: thumbed.length ? Math.round((thumbsUp / thumbed.length) * 100) : 0,
    avgQualityScores,
    recentFeedback: data.filter((e) => e.feedback_text).slice(0, 10),
  };
}
