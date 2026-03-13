"use client";

import { useState, useCallback, useEffect } from "react";
import type {
  OrchestrationPhase,
  OrchestrationPlan,
  OrchestrationStep,
  AsanaProvisionResult,
  ActivityLogEntry,
  InsightData,
} from "@/lib/orchestrator";
import {
  selectPipeline,
  buildPlan,
  provisionAsana,
  executeSimulation,
  provisionGoogleDrive,
} from "@/lib/orchestratorEngine";
import type { DriveProvisionResult } from "@/lib/orchestratorEngine";
import type { IntegrationsConfig } from "@/lib/asana";
import { INTEGRATIONS_STORAGE_KEY, defaultIntegrations } from "@/lib/asana";
import { agents } from "@/lib/agents";

import { RequestInputBar } from "@/components/orchestrator/RequestInputBar";
import { OrchestratorStatus } from "@/components/orchestrator/OrchestratorStatus";
import { KanbanBoard } from "@/components/orchestrator/KanbanBoard";
import { ActivityLog } from "@/components/orchestrator/ActivityLog";
import { AsanaBanner } from "@/components/orchestrator/AsanaBanner";
import { DataInsightsPanel } from "@/components/orchestrator/DataInsightsPanel";

import { Activity, RotateCcw, Cpu } from "lucide-react";

const TEAM_GID = "1210642764336819";

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

export default function DashboardPage() {
  /* ── Asana config ── */
  const [integrations, setIntegrations] = useState<IntegrationsConfig>(
    defaultIntegrations()
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem(INTEGRATIONS_STORAGE_KEY);
      if (raw) setIntegrations(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  const asanaConnected = integrations.asana.connected && !!integrations.asana.pat;
  const pat = integrations.asana.pat;
  const workspaceGid = integrations.asana.workspace?.gid ?? "";

  /* ── Orchestration state ── */
  const [phase, setPhase] = useState<OrchestrationPhase>("idle");
  const [plan, setPlan] = useState<OrchestrationPlan | null>(null);
  const [asanaResult, setAsanaResult] = useState<AsanaProvisionResult | null>(
    null
  );
  const [log, setLog] = useState<ActivityLogEntry[]>([]);
  const [prompt, setPrompt] = useState("");
  const [insights, setInsights] = useState<InsightData>({ gaOverview: null, gscOverview: null });

  const addLog = useCallback(
    (entry: ActivityLogEntry) => setLog((prev) => [...prev, entry]),
    []
  );

  const activeAgents = agents.filter((a) => a.status === "active").length;

  /* ── Reset ── */
  const reset = () => {
    setPhase("idle");
    setPlan(null);
    setAsanaResult(null);
    setLog([]);
    setPrompt("");
    setInsights({ gaOverview: null, gscOverview: null });
  };

  /* ── Main orchestration flow ── */
  const handleSubmit = useCallback(
    async (userPrompt: string) => {
      setPrompt(userPrompt);
      setLog([]);
      setAsanaResult(null);

      try {
        // Phase 1: Analyzing
        setPhase("analyzing");
        addLog(
          makeLogEntry(
            "system",
            "Agent 15 (Workflow Orchestrator) analyzing request…",
            userPrompt.slice(0, 80)
          )
        );
        await new Promise((r) => setTimeout(r, 1500));

        // Phase 2: Planning
        setPhase("planning");
        const { pipeline, reasoning } = selectPipeline(userPrompt);
        const newPlan = buildPlan(pipeline, reasoning);
        setPlan(newPlan);
        addLog(
          makeLogEntry(
            "system",
            `Selected pipeline: ${pipeline.name}`,
            reasoning.slice(0, 100)
          )
        );
        addLog(
          makeLogEntry(
            "system",
            `Built ${newPlan.steps.length}-step execution plan`
          )
        );
        await new Promise((r) => setTimeout(r, 1200));

        // Phase 3: Provisioning (Asana or skip)
        let result: AsanaProvisionResult | null = null;
        if (asanaConnected && pat && workspaceGid) {
          setPhase("provisioning");
          addLog(makeLogEntry("asana", "Provisioning Asana project board…"));
          try {
            result = await provisionAsana(
              pat,
              workspaceGid,
              TEAM_GID,
              newPlan,
              addLog
            );
            setAsanaResult(result);
            addLog(
              makeLogEntry(
                "asana",
                `Asana board ready: ${result.projectName}`,
                `4 stage columns, ${result.tasks.length} tasks — assembly-line board`
              )
            );
          } catch (err) {
            addLog(
              makeLogEntry(
                "system",
                "Asana provisioning failed — continuing in simulation mode",
                err instanceof Error ? err.message : undefined
              )
            );
          }
        } else {
          addLog(
            makeLogEntry(
              "system",
              "Asana not connected — running in simulation mode"
            )
          );
        }

        // Phase 3b: Google Drive provisioning
        let driveConfig: { accessToken: string; folderId: string } | null = null;
        const driveConnected = integrations.googleDrive.connected && !!integrations.googleDrive.accessToken;
        if (driveConnected) {
          try {
            addLog(makeLogEntry("system", "Provisioning Google Drive folder…"));
            const driveResult: DriveProvisionResult = await provisionGoogleDrive(
              integrations.googleDrive.accessToken,
              integrations.googleDrive.folderId || undefined,
              newPlan,
              addLog
            );
            driveConfig = { accessToken: integrations.googleDrive.accessToken, folderId: driveResult.folderId };
            addLog(makeLogEntry("system", `Drive folder ready: ${driveResult.folderName}`, driveResult.webViewLink || undefined));
          } catch (err) {
            addLog(makeLogEntry("system", "Drive provisioning failed — continuing without file uploads", err instanceof Error ? err.message : undefined));
          }
        }

        // Phase 4: Executing
        setPhase("executing");
        addLog(makeLogEntry("system", "Beginning agent execution sequence…"));

        // Determine which integrations have real data
        const gaConnected = integrations.googleAnalytics.connected && !!integrations.googleAnalytics.accessToken;
        const gscConnected = integrations.googleSearchConsole.connected && !!integrations.googleSearchConsole.accessToken;
        if (gaConnected) addLog(makeLogEntry("data", "GA4 integration active — will pull live analytics data"));
        if (gscConnected) addLog(makeLogEntry("data", "GSC integration active — will pull live search data"));
        if (driveConfig) addLog(makeLogEntry("data", "Google Drive active — agent outputs will be uploaded as .md files"));

        const finalInsights = await executeSimulation(
          newPlan,
          result,
          asanaConnected ? pat : null,
          integrations,
          (stepIndex, status) => {
            setPlan((prev) => {
              if (!prev) return prev;
              const steps = prev.steps.map((s) =>
                s.stepIndex === stepIndex ? { ...s, status } : s
              );
              return { ...prev, steps };
            });
          },
          addLog,
          (updatedInsights) => setInsights(updatedInsights),
          driveConfig
        );
        setInsights(finalInsights);

        // Phase 5: Completed
        setPhase("completed");
        addLog(
          makeLogEntry(
            "system",
            "Orchestration complete — all agents finished",
            `Pipeline: ${newPlan.pipelineName}`
          )
        );
      } catch (err) {
        setPhase("error");
        addLog(
          makeLogEntry(
            "system",
            "Orchestration error",
            err instanceof Error ? err.message : "Unknown error"
          )
        );
      }
    },
    [asanaConnected, pat, workspaceGid, addLog]
  );

  const isRunning = phase !== "idle" && phase !== "completed" && phase !== "error";

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 md:mb-8 gap-3">
        <div>
          <h1 className="text-[20px] md:text-[24px] font-semibold">
            Orchestrator Command Center
          </h1>
          <p className="text-[12px] md:text-[14px] text-text-secondary mt-1">
            Agent-driven workflow automation &middot; {activeAgents} agents
            active &middot; Powered by Agent 15
          </p>
        </div>
        <div className="flex items-center gap-3">
          {phase !== "idle" && (
            <button
              onClick={reset}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-raised border border-border text-[12px] font-medium hover:border-brand-blue/30 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              New Request
            </button>
          )}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-green/10 text-brand-green text-[12px] font-medium">
            <Activity className="w-4 h-4" />
            <span className="hidden sm:inline">System Online</span>
          </div>
        </div>
      </div>

      {/* Asana Banner */}
      <div className="mb-5">
        <AsanaBanner
          connected={asanaConnected}
          projectGid={asanaResult?.projectGid}
          projectName={asanaResult?.projectName}
        />
      </div>

      {/* Request Input */}
      <div className="mb-6">
        <RequestInputBar
          onSubmit={handleSubmit}
          disabled={isRunning}
          phase={phase}
        />
      </div>

      {/* Orchestration Status */}
      {phase !== "idle" && (
        <div className="mb-5">
          <OrchestratorStatus
            phase={phase}
            reasoning={plan?.reasoning}
            pipelineName={plan?.pipelineName}
          />
        </div>
      )}

      {/* Kanban Board */}
      {plan && (
        <div className="mb-5">
          <KanbanBoard steps={plan.steps} />
        </div>
      )}

      {/* Live Integration Data */}
      {(insights.gaOverview || insights.gscOverview) && (
        <div className="mb-5">
          <DataInsightsPanel insights={insights} />
        </div>
      )}

      {/* Activity Log */}
      {log.length > 0 && (
        <div className="mb-6">
          <ActivityLog entries={log} />
        </div>
      )}

      {/* Completed Summary */}
      {phase === "completed" && plan && (
        <div className="bg-brand-green/10 rounded-xl border border-brand-green/20 p-5 md:p-6 mb-6">
          <div className="flex items-start gap-3">
            <Cpu className="w-5 h-5 text-brand-green mt-0.5 shrink-0" />
            <div>
              <h3 className="text-[14px] md:text-[15px] font-semibold text-brand-green mb-1">
                Orchestration Complete
              </h3>
              <p className="text-[12px] md:text-[13px] text-text-secondary leading-relaxed mb-2">
                Pipeline <strong>{plan.pipelineName}</strong> finished
                successfully with {plan.steps.length} agent steps.
                {asanaResult && (
                  <>
                    {" "}
                    All tasks synced to Asana project{" "}
                    <strong>{asanaResult.projectName}</strong>.
                  </>
                )}
              </p>
              {prompt && (
                <p className="text-[11px] text-text-muted">
                  Original request: &ldquo;{prompt.slice(0, 120)}
                  {prompt.length > 120 ? "…" : ""}&rdquo;
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Idle state - show quick-start suggestions */}
      {phase === "idle" && (
        <div className="mt-8">
          <h2 className="text-[14px] md:text-[16px] font-semibold mb-4 text-text-secondary">
            Quick Start
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              {
                label: "Launch Campaign",
                desc: "Full multi-channel campaign from research to deployment",
                prompt: "Launch a full campaign for a new DTC skincare brand",
              },
              {
                label: "Onboard Client",
                desc: "End-to-end client discovery and Asana project setup",
                prompt:
                  "Onboard a new B2B SaaS client with competitive analysis",
              },
              {
                label: "Optimize Performance",
                desc: "Weekly optimization cycle across all active campaigns",
                prompt:
                  "Run a performance optimization cycle on all active campaigns",
              },
              {
                label: "Content Engine",
                desc: "Produce authority content with SEO and social distribution",
                prompt:
                  "Create an authority content piece on AI marketing trends",
              },
              {
                label: "AI Visibility Audit",
                desc: "Audit brand presence across ChatGPT, Claude, Perplexity",
                prompt:
                  "Run an LLMO audit for our brand across AI search platforms",
              },
              {
                label: "Email Sequences",
                desc: "Build automated nurture workflows with behavioral triggers",
                prompt:
                  "Build an email nurture sequence for our free trial signups",
              },
            ].map((item) => (
              <button
                key={item.label}
                onClick={() => handleSubmit(item.prompt)}
                className="text-left bg-surface-raised rounded-xl border border-border p-4 hover:border-brand-blue/30 transition-colors group"
              >
                <h3 className="text-[13px] font-semibold group-hover:text-brand-blue transition-colors mb-1">
                  {item.label}
                </h3>
                <p className="text-[11px] text-text-muted leading-relaxed">
                  {item.desc}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
