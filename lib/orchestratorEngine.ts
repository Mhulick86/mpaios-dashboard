import { pipelines, type Pipeline } from "./pipelines";
import { agents } from "./agents";
import type {
  OrchestrationPlan,
  OrchestrationStep,
  AsanaProvisionResult,
  ActivityLogEntry,
} from "./orchestrator";

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

/* ─── Asana Provisioning ─── */

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

export async function provisionAsana(
  pat: string,
  workspaceGid: string,
  teamGid: string,
  plan: OrchestrationPlan,
  onLog: (entry: ActivityLogEntry) => void
): Promise<AsanaProvisionResult> {
  const ts = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  const projectName = `MPAIOS: ${plan.pipelineName} — ${ts}`;

  // 1. Create project
  const projRes = await asanaPost("/api/asana/projects/create", {
    pat,
    workspaceGid,
    teamGid,
    name: projectName,
    notes: `Orchestrated workflow for: ${plan.pipelineName}\nPipeline ID: ${plan.pipelineId}`,
    color: "light-blue",
  });
  const projectGid = projRes.project.gid;
  onLog(makeLogEntry("asana", `Created Asana project: ${projectName}`, `GID: ${projectGid}`));

  // 2. Create sections (one per step/agent)
  const sections: AsanaProvisionResult["sections"] = [];
  for (const step of plan.steps) {
    const secRes = await asanaPost("/api/asana/sections/create", {
      pat,
      projectGid,
      name: `${step.stepIndex + 1}. ${step.agentShortName}`,
    });
    sections.push({ gid: secRes.section.gid, name: step.agentShortName, agentId: step.agentId });
    onLog(makeLogEntry("asana", `Created column: ${step.agentShortName}`, `Section for step ${step.stepIndex + 1}`));
  }

  // 3. Create tasks + move to sections
  const tasks: AsanaProvisionResult["tasks"] = [];
  for (let i = 0; i < plan.steps.length; i++) {
    const step = plan.steps[i];
    const taskRes = await asanaPost("/api/asana/tasks/create", {
      pat,
      name: step.action,
      notes: `Agent: ${step.agentName}\nStep ${step.stepIndex + 1} of ${plan.steps.length}\nPipeline: ${plan.pipelineName}`,
      projectGid,
    });
    const taskGid = taskRes.task.gid;

    // Move task into its section
    await asanaPost("/api/asana/tasks/move", {
      pat,
      taskGid,
      sectionGid: sections[i].gid,
    });

    tasks.push({ gid: taskGid, name: step.action, sectionGid: sections[i].gid, stepIndex: i });
    onLog(makeLogEntry("asana", `Created task: ${step.action.slice(0, 60)}...`, `Assigned to ${step.agentShortName} column`));
  }

  return { projectGid, projectName, sections, tasks };
}

/* ─── Simulation Execution ─── */

export async function executeSimulation(
  plan: OrchestrationPlan,
  asanaResult: AsanaProvisionResult | null,
  pat: string | null,
  onStepUpdate: (stepIndex: number, status: OrchestrationStep["status"]) => void,
  onLog: (entry: ActivityLogEntry) => void
): Promise<void> {
  for (let i = 0; i < plan.steps.length; i++) {
    const step = plan.steps[i];

    // Start step
    onStepUpdate(i, "active");
    onLog(makeLogEntry("agent", `${step.agentShortName} starting...`, step.action));

    // Simulate work
    await randomDelay(1200, 2500);

    // Human review checkpoint
    if (step.isHumanReview) {
      onStepUpdate(i, "human_review");
      onLog(makeLogEntry("human", `Human review checkpoint`, `${step.agentShortName} — auto-approving for demo`));
      await randomDelay(800, 1200);
    }

    // Complete step
    onStepUpdate(i, "complete");
    onLog(makeLogEntry("agent", `${step.agentShortName} completed`, step.action));

    // Mark complete in Asana if connected
    if (pat && asanaResult) {
      const asanaTask = asanaResult.tasks.find((t) => t.stepIndex === i);
      if (asanaTask) {
        try {
          await asanaPost("/api/asana/tasks/update", {
            pat,
            taskGid: asanaTask.gid,
            completed: true,
          });
          onLog(makeLogEntry("asana", `Marked complete in Asana`, asanaTask.name.slice(0, 60)));
        } catch {
          // Non-critical — don't break simulation
        }
      }
    }

    // Gap between steps
    if (i < plan.steps.length - 1) {
      await randomDelay(300, 500);
    }
  }
}
