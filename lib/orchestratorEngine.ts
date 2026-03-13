import { pipelines, type Pipeline } from "./pipelines";
import { agents } from "./agents";
import type {
  OrchestrationPlan,
  OrchestrationStep,
  AsanaProvisionResult,
  AsanaStage,
  ActivityLogEntry,
  InsightData,
} from "./orchestrator";
import { ASANA_STAGES } from "./orchestrator";
import type { IntegrationsConfig } from "./asana";
import { generateAgentOutput } from "./agentOutputs";

/* ─── Helpers ─── */

function randomDelay(min: number, max: number): Promise<void> {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeLogEntry(
  type: ActivityLogEntry["type"],
  message: string,
  detail?: string
): ActivityLogEntry {
  return {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    type,
    message,
    detail,
  };
}

/* ─── Pipeline Selection ─── */

const PIPELINE_KEYWORDS: { keywords: string[]; pipelineId: number }[] = [
  { keywords: ["onboard", "new client", "discovery", "intake"], pipelineId: 5 },
  { keywords: ["competitor", "competitive", "response", "rival"], pipelineId: 4 },
  { keywords: ["llmo", "ai visibility", "ai search", "ai citation"], pipelineId: 6 },
  { keywords: ["email", "nurture", "drip", "sequence", "automation"], pipelineId: 7 },
  { keywords: ["content", "blog", "article", "authority", "thought leadership"], pipelineId: 2 },
  { keywords: ["optimize", "performance", "improve", "weekly", "optimization"], pipelineId: 3 },
  { keywords: ["launch", "campaign", "new campaign", "full campaign", "seo", "ads", "funnel"], pipelineId: 1 },
];

const PIPELINE_REASONING: Record<number, string> = {
  1: "Your request involves launching a multi-channel campaign. Selecting the Full Campaign Launch pipeline — our flagship end-to-end workflow from competitive research through live campaign deployment.",
  2: "Your request is focused on content production. Selecting the Authority Content Engine — a recurring pipeline that produces SEO-optimized thought leadership content.",
  3: "Your request targets performance improvement. Selecting the Performance Optimization Cycle — an automated cycle that analyzes campaigns and generates optimization actions.",
  4: "Your request involves competitive intelligence. Selecting the Competitive Response pipeline — triggered when significant competitor moves require a strategic response.",
  5: "Your request involves a new client. Selecting the Client Onboarding & Discovery pipeline — end-to-end onboarding from research through Asana project setup.",
  6: "Your request targets AI search visibility. Selecting the LLMO & AI Visibility Audit — auditing and optimizing brand presence across AI search platforms.",
  7: "Your request involves email automation. Selecting the Email & Nurture Sequence Builder — designing personalized email workflows triggered by user behavior.",
};

export function selectPipeline(prompt: string): { pipeline: Pipeline; reasoning: string } {
  const lower = prompt.toLowerCase();

  for (const entry of PIPELINE_KEYWORDS) {
    if (entry.keywords.some((kw) => lower.includes(kw))) {
      const pipeline = pipelines.find((p) => p.id === entry.pipelineId)!;
      return { pipeline, reasoning: PIPELINE_REASONING[entry.pipelineId] };
    }
  }

  // Default to Full Campaign Launch
  const pipeline = pipelines.find((p) => p.id === 1)!;
  return {
    pipeline,
    reasoning: "Selecting the Full Campaign Launch pipeline as the best general-purpose workflow for your request.",
  };
}

/* ─── Plan Builder ─── */

export function buildPlan(pipeline: Pipeline, reasoning: string): OrchestrationPlan {
  const steps: OrchestrationStep[] = pipeline.steps.map((step, idx) => {
    const agent = agents.find((a) => a.id === step.agentId);
    return {
      stepIndex: idx,
      agentId: step.agentId,
      agentName: step.agent,
      agentShortName: agent?.shortName ?? step.agent,
      action: step.action,
      status: "pending",
      isHumanReview: step.isHumanReview,
    };
  });

  return {
    pipelineId: pipeline.id,
    pipelineName: pipeline.name,
    reasoning,
    steps,
  };
}

/* ─── Asana API helper ─── */

async function asanaPost(endpoint: string, body: Record<string, unknown>) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || `API error ${res.status}`);
  }
  return res.json();
}

/* ─── Asana Provisioning (Assembly-Line Board) ─── */

export async function provisionAsana(
  pat: string,
  workspaceGid: string,
  teamGid: string,
  plan: OrchestrationPlan,
  onLog: (entry: ActivityLogEntry) => void
): Promise<AsanaProvisionResult> {
  const ts = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  const projectName = `MP: ${plan.pipelineName} — ${ts}`;

  // 1. Create project
  const projRes = await asanaPost("/api/asana/projects/create", {
    pat,
    workspaceGid,
    teamGid,
    name: projectName,
    notes: `Orchestrated workflow for: ${plan.pipelineName}\nPipeline ID: ${plan.pipelineId}\n\nTasks move through columns like an assembly line:\nQueued → In Progress → Review → Complete`,
    color: "light-blue",
  });
  const projectGid = projRes.project.gid;
  onLog(makeLogEntry("asana", `Created Asana project: ${projectName}`, `GID: ${projectGid}`));

  // 2. Create stage columns (assembly-line)
  const stages = {} as Record<AsanaStage, { gid: string; label: string }>;
  for (const stage of ASANA_STAGES) {
    const secRes = await asanaPost("/api/asana/sections/create", {
      pat,
      projectGid,
      name: stage.label,
    });
    stages[stage.key] = { gid: secRes.section.gid, label: stage.label };
    onLog(makeLogEntry("asana", `Created column: ${stage.label}`));
  }

  // 3. Create tasks — all start in "Queued"
  const tasks: AsanaProvisionResult["tasks"] = [];
  for (let i = 0; i < plan.steps.length; i++) {
    const step = plan.steps[i];
    const taskRes = await asanaPost("/api/asana/tasks/create", {
      pat,
      name: `${i + 1}. ${step.agentShortName}: ${step.action}`,
      notes: `Agent: ${step.agentName}\nStep ${step.stepIndex + 1} of ${plan.steps.length}\nPipeline: ${plan.pipelineName}\n\nStatus: Queued — waiting for execution`,
      projectGid,
    });
    const taskGid = taskRes.task.gid;

    // Move task into Queued column
    await asanaPost("/api/asana/tasks/move", {
      pat,
      taskGid,
      sectionGid: stages.queued.gid,
    });

    tasks.push({ gid: taskGid, name: step.action, stepIndex: i, agentId: step.agentId });
    onLog(makeLogEntry("asana", `Queued task: ${step.agentShortName}`, step.action.slice(0, 80)));
  }

  return { projectGid, projectName, stages, tasks };
}

/* ─── Integration Data Fetching ─── */

const GA_AGENT_IDS = [13]; // Agent 13: Campaign Performance Analyst
const GSC_AGENT_IDS = [10]; // Agent 10: SEO & Organic Growth Manager

async function fetchIntegrationData(
  agentId: number,
  integrations: IntegrationsConfig | null,
  insights: InsightData,
  onLog: (entry: ActivityLogEntry) => void
): Promise<InsightData> {
  if (!integrations) return insights;

  // Agent 13 → fetch GA data
  if (
    GA_AGENT_IDS.includes(agentId) &&
    integrations.googleAnalytics.connected &&
    integrations.googleAnalytics.accessToken &&
    integrations.googleAnalytics.propertyId &&
    !insights.gaOverview
  ) {
    onLog(makeLogEntry("data", "Pulling live Google Analytics data…", `Property: ${integrations.googleAnalytics.propertyName || integrations.googleAnalytics.propertyId}`));
    try {
      const res = await fetch("/api/google-analytics/overview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken: integrations.googleAnalytics.accessToken,
          propertyId: integrations.googleAnalytics.propertyId,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        insights = { ...insights, gaOverview: data.markdown };
        onLog(makeLogEntry("data", "GA4 data loaded — traffic, sessions, top pages, sources", `${data.markdown.length} chars of analytics context`));
      } else {
        const err = await res.json().catch(() => ({ error: "Unknown" }));
        onLog(makeLogEntry("system", "GA4 fetch failed — continuing without analytics data", err.error));
      }
    } catch {
      onLog(makeLogEntry("system", "GA4 fetch error — continuing without analytics data"));
    }
  }

  // Agent 10 → fetch GSC data
  if (
    GSC_AGENT_IDS.includes(agentId) &&
    integrations.googleSearchConsole.connected &&
    integrations.googleSearchConsole.accessToken &&
    integrations.googleSearchConsole.siteUrl &&
    !insights.gscOverview
  ) {
    onLog(makeLogEntry("data", "Pulling live Search Console data…", `Site: ${integrations.googleSearchConsole.siteUrl}`));
    try {
      const res = await fetch("/api/google-search-console/overview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken: integrations.googleSearchConsole.accessToken,
          siteUrl: integrations.googleSearchConsole.siteUrl,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        insights = { ...insights, gscOverview: data.markdown };
        onLog(makeLogEntry("data", "GSC data loaded — queries, CTR, impressions, top pages", `${data.markdown.length} chars of search context`));
      } else {
        const err = await res.json().catch(() => ({ error: "Unknown" }));
        onLog(makeLogEntry("system", "GSC fetch failed — continuing without search data", err.error));
      }
    } catch {
      onLog(makeLogEntry("system", "GSC fetch error — continuing without search data"));
    }
  }

  return insights;
}

/* ─── Move task to a stage column ─── */

async function moveToStage(
  pat: string,
  asanaResult: AsanaProvisionResult,
  taskGid: string,
  stage: AsanaStage,
  onLog: (entry: ActivityLogEntry) => void,
  taskLabel: string
): Promise<void> {
  try {
    await asanaPost("/api/asana/tasks/move", {
      pat,
      taskGid,
      sectionGid: asanaResult.stages[stage].gid,
    });
    onLog(makeLogEntry("asana", `Moved to ${asanaResult.stages[stage].label}`, taskLabel));
  } catch {
    // Non-critical
  }
}

/* ─── Google Drive Provisioning ─── */

export interface DriveProvisionResult {
  folderId: string;
  folderName: string;
  webViewLink: string;
}

async function drivePost(endpoint: string, body: Record<string, unknown>) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || `Drive API error ${res.status}`);
  }
  return res.json();
}

export async function provisionGoogleDrive(
  accessToken: string,
  parentFolderId: string | undefined,
  plan: OrchestrationPlan,
  onLog: (entry: ActivityLogEntry) => void
): Promise<DriveProvisionResult> {
  const ts = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  const folderName = `MP: ${plan.pipelineName} — ${ts}`;

  const res = await drivePost("/api/google-drive/folder", {
    accessToken,
    folderName,
    parentFolderId: parentFolderId || undefined,
  });

  onLog(makeLogEntry("system", `📁 Created Drive folder: ${folderName}`, res.folder?.webViewLink || ""));

  return {
    folderId: res.folder.id,
    folderName,
    webViewLink: res.folder.webViewLink || "",
  };
}

async function uploadToDrive(
  accessToken: string,
  folderId: string,
  fileName: string,
  content: string,
  onLog: (entry: ActivityLogEntry) => void
): Promise<void> {
  try {
    await drivePost("/api/google-drive/upload", {
      accessToken,
      fileName,
      content,
      folderId,
      mimeType: "text/markdown",
    });
    onLog(makeLogEntry("system", `📄 Uploaded to Drive: ${fileName}`));
  } catch {
    onLog(makeLogEntry("system", `Drive upload failed for ${fileName} — continuing`));
  }
}

/* ─── Simulation Execution ─── */

export async function executeSimulation(
  plan: OrchestrationPlan,
  asanaResult: AsanaProvisionResult | null,
  pat: string | null,
  integrations: IntegrationsConfig | null,
  onStepUpdate: (stepIndex: number, status: OrchestrationStep["status"]) => void,
  onLog: (entry: ActivityLogEntry) => void,
  onInsightUpdate: (insights: InsightData) => void,
  driveConfig?: { accessToken: string; folderId: string } | null
): Promise<InsightData> {
  let insights: InsightData = { gaOverview: null, gscOverview: null };

  for (let i = 0; i < plan.steps.length; i++) {
    const step = plan.steps[i];
    const asanaTask = asanaResult?.tasks.find((t) => t.stepIndex === i);
    const taskLabel = `${step.agentShortName}: ${step.action.slice(0, 60)}`;

    // ── Start step ──
    onStepUpdate(i, "active");
    onLog(makeLogEntry("agent", `${step.agentShortName} starting...`, step.action));

    // Move task: Queued → In Progress
    if (pat && asanaResult && asanaTask) {
      await moveToStage(pat, asanaResult, asanaTask.gid, "in_progress", onLog, taskLabel);
    }

    // Fetch real integration data if this agent needs it
    const prevInsights = { ...insights };
    insights = await fetchIntegrationData(step.agentId, integrations, insights, onLog);
    if (insights.gaOverview !== prevInsights.gaOverview || insights.gscOverview !== prevInsights.gscOverview) {
      onInsightUpdate(insights);
    }

    // Simulate agent work
    await randomDelay(1200, 2500);

    // ── Generate agent output ──
    const agentOutput = generateAgentOutput({
      agentId: step.agentId,
      agentName: step.agentName,
      agentShortName: step.agentShortName,
      action: step.action,
      stepIndex: step.stepIndex,
      totalSteps: plan.steps.length,
      pipelineName: plan.pipelineName,
      insights,
    });

    // Write output into Asana task notes
    if (pat && asanaResult && asanaTask) {
      try {
        await asanaPost("/api/asana/tasks/update", {
          pat,
          taskGid: asanaTask.gid,
          notes: agentOutput,
        });
        onLog(makeLogEntry("asana", `Output written to task`, `${step.agentShortName} — ${agentOutput.length} chars`));
      } catch {
        // Non-critical
      }
    }

    // Upload agent output to Google Drive
    if (driveConfig?.accessToken && driveConfig?.folderId) {
      const fileName = `${String(i + 1).padStart(2, "0")}-${step.agentShortName.replace(/[^a-zA-Z0-9]/g, "_")}.md`;
      await uploadToDrive(driveConfig.accessToken, driveConfig.folderId, fileName, agentOutput, onLog);
    }

    // ── Human review checkpoint ──
    if (step.isHumanReview) {
      onStepUpdate(i, "human_review");
      onLog(makeLogEntry("human", `Human review checkpoint`, `${step.agentShortName} — auto-approving for demo`));

      // Move task: In Progress → Review
      if (pat && asanaResult && asanaTask) {
        await moveToStage(pat, asanaResult, asanaTask.gid, "review", onLog, taskLabel);
      }

      await randomDelay(800, 1200);
    }

    // ── Complete step ──
    onStepUpdate(i, "complete");
    onLog(makeLogEntry("agent", `${step.agentShortName} completed`, step.action));

    // Move task → Complete column + mark complete
    if (pat && asanaResult && asanaTask) {
      await moveToStage(pat, asanaResult, asanaTask.gid, "complete", onLog, taskLabel);
      try {
        await asanaPost("/api/asana/tasks/update", {
          pat,
          taskGid: asanaTask.gid,
          completed: true,
        });
        onLog(makeLogEntry("asana", `Marked complete in Asana`, taskLabel));
      } catch {
        // Non-critical
      }
    }

    // Gap between steps
    if (i < plan.steps.length - 1) {
      await randomDelay(300, 500);
    }
  }

  return insights;
}
