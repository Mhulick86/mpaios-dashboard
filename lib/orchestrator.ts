// ─── Orchestrator Types ───

export type OrchestrationPhase =
  | "idle"
  | "analyzing"
  | "planning"
  | "provisioning"
  | "executing"
  | "completed"
  | "error";

export interface OrchestrationRequest {
  id: string;
  prompt: string;
  createdAt: number;
}

export interface OrchestrationStep {
  stepIndex: number;
  agentId: number;
  agentName: string;
  agentShortName: string;
  action: string;
  status: "pending" | "active" | "complete" | "human_review";
  isHumanReview?: boolean;
  asanaTaskGid?: string;
  asanaSectionGid?: string;
  startedAt?: number;
  completedAt?: number;
}

export interface OrchestrationPlan {
  pipelineId: number;
  pipelineName: string;
  reasoning: string;
  steps: OrchestrationStep[];
}

/** Assembly-line stage columns in the Asana board */
export type AsanaStage = "queued" | "in_progress" | "review" | "complete";

export const ASANA_STAGES: { key: AsanaStage; label: string }[] = [
  { key: "queued", label: "Queued" },
  { key: "in_progress", label: "In Progress" },
  { key: "review", label: "Review" },
  { key: "complete", label: "Complete" },
];

export interface AsanaProvisionResult {
  projectGid: string;
  projectName: string;
  /** Stage columns keyed by AsanaStage */
  stages: Record<AsanaStage, { gid: string; label: string }>;
  tasks: { gid: string; name: string; stepIndex: number; agentId: number }[];
}

export type ActivityLogType = "system" | "asana" | "agent" | "human" | "data";

export interface ActivityLogEntry {
  id: string;
  timestamp: number;
  type: ActivityLogType;
  message: string;
  detail?: string;
}

/** Data fetched from real integrations during agent execution */
export interface InsightData {
  gaOverview: string | null;
  gscOverview: string | null;
}
