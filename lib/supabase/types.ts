/** Database type definitions for Supabase tables */

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  role: "owner" | "admin" | "member" | "viewer";
  organization: string;
  preferences: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Memory {
  id: string;
  user_id: string;
  category: MemoryCategory;
  content: string;
  metadata: Record<string, unknown>;
  embedding?: number[];
  confidence: number;
  source_agent: number | null;
  source_conversation: string | null;
  access_count: number;
  last_accessed: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export type MemoryCategory =
  | "client_insight"
  | "campaign_learning"
  | "strategy_pattern"
  | "creative_insight"
  | "performance_data"
  | "platform_update"
  | "process_improvement"
  | "audience_insight"
  | "agent_learning"
  | "user_preference";

export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  model: string;
  system_context: string | null;
  metadata: Record<string, unknown>;
  is_archived: boolean;
  message_count: number;
  total_tokens: number;
  total_cost: number;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  agent_id: number | null;
  tool_calls: Record<string, unknown>[] | null;
  tool_results: Record<string, unknown>[] | null;
  metadata: Record<string, unknown>;
  tokens_input: number;
  tokens_output: number;
  latency_ms: number | null;
  model: string | null;
  created_at: string;
}

export interface AgentExecution {
  id: string;
  conversation_id: string | null;
  workflow_run_id: string | null;
  agent_id: number;
  agent_name: string;
  division: string | null;
  action: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  error: string | null;
  tokens_used: number;
  cost: number;
  latency_ms: number | null;
  parent_execution_id: string | null;
  metadata: Record<string, unknown>;
  started_at: string;
  completed_at: string | null;
}

export interface Workflow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  pipeline_id: string | null;
  trigger_type: "manual" | "schedule" | "event" | "webhook";
  trigger_config: Record<string, unknown>;
  steps: WorkflowStep[];
  is_active: boolean;
  run_count: number;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkflowStep {
  index: number;
  agent_id: number;
  action: string;
  description: string;
  config: Record<string, unknown>;
  depends_on?: number[];
}

export interface WorkflowRun {
  id: string;
  workflow_id: string;
  user_id: string | null;
  status: "queued" | "running" | "completed" | "failed" | "cancelled" | "paused";
  trigger: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  current_step: number;
  total_steps: number;
  step_results: Record<string, unknown>[];
  error: string | null;
  tokens_total: number;
  cost_total: number;
  started_at: string;
  completed_at: string | null;
}

export interface Evaluation {
  id: string;
  message_id: string | null;
  conversation_id: string | null;
  agent_execution_id: string | null;
  user_id: string | null;
  rating: number | null;
  thumbs: "up" | "down" | null;
  feedback_text: string | null;
  quality_scores: QualityScores;
  auto_metrics: AutoMetrics;
  tags: string[];
  created_at: string;
}

export interface QualityScores {
  relevance?: number;
  accuracy?: number;
  completeness?: number;
  actionability?: number;
  clarity?: number;
}

export interface AutoMetrics {
  response_length?: number;
  latency_ms?: number;
  tokens_used?: number;
  tools_called?: number;
  agents_invoked?: number;
}

export interface AuditLogEntry {
  id: string;
  user_id: string | null;
  event_type: string;
  resource_type: string | null;
  resource_id: string | null;
  details: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  tokens_used: number;
  cost: number;
  model: string | null;
  latency_ms: number | null;
  created_at: string;
}

export interface TokenUsage {
  id: string;
  user_id: string | null;
  model: string;
  provider: string;
  tokens_input: number;
  tokens_output: number;
  cost: number;
  endpoint: string | null;
  conversation_id: string | null;
  agent_id: number | null;
  created_at: string;
}

export interface Client {
  id: string;
  user_id: string;
  name: string;
  industry: string | null;
  website: string | null;
  contact_email: string | null;
  contact_name: string | null;
  status: "active" | "onboarding" | "paused" | "churned";
  monthly_budget: number | null;
  goals: string[];
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Campaign {
  id: string;
  user_id: string;
  client_id: string | null;
  name: string;
  type: string | null;
  status: "draft" | "active" | "paused" | "completed" | "archived";
  channels: string[];
  budget: number | null;
  spend: number;
  revenue: number;
  conversions: number;
  kpis: Record<string, unknown>;
  assigned_agents: number[];
  start_date: string | null;
  end_date: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}
