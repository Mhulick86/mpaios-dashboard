"use client";

import { useState, useCallback, useEffect } from "react";
import type {
  OrchestrationPhase,
  OrchestrationPlan,
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
import { agents, divisions } from "@/lib/agents";

import { RequestInputBar } from "@/components/orchestrator/RequestInputBar";
import { OrchestratorStatus } from "@/components/orchestrator/OrchestratorStatus";
import { KanbanBoard } from "@/components/orchestrator/KanbanBoard";
import { ActivityLog } from "@/components/orchestrator/ActivityLog";
import { AsanaBanner } from "@/components/orchestrator/AsanaBanner";
import { DataInsightsPanel } from "@/components/orchestrator/DataInsightsPanel";

import {
  Activity,
  RotateCcw,
  Cpu,
  Zap,
  Bot,
  GitBranch,
  Brain,
  Rocket,
  Target,
  BarChart3,
  Mail,
  Search,
  MapPin,
  Users,
  TrendingUp,
  Shield,
  Database,
  FileDown,
  FileText,
  Printer,
  FileCode,
} from "lucide-react";
import {
  generateHTMLReport,
  downloadHTMLReport,
  downloadDOCXReport,
  downloadMarkdownReport,
  printReport,
} from "@/lib/reportGenerator";

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

/* ── Animated counter hook ── */
function useAnimatedCount(target: number, duration: number = 1200) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let start = 0;
    const increment = target / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return count;
}

export default function DashboardPage() {
  /* ── Asana config ── */
  const [integrations, setIntegrations] = useState<IntegrationsConfig>(defaultIntegrations());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(INTEGRATIONS_STORAGE_KEY);
      if (raw) setIntegrations(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  const asanaConnected = integrations.asana.connected && !!integrations.asana.pat;
  const pat = integrations.asana.pat;
  const workspaceGid = integrations.asana.workspace?.gid ?? "";

  /* ── Orchestration state ── */
  const [phase, setPhase] = useState<OrchestrationPhase>("idle");
  const [plan, setPlan] = useState<OrchestrationPlan | null>(null);
  const [asanaResult, setAsanaResult] = useState<AsanaProvisionResult | null>(null);
  const [log, setLog] = useState<ActivityLogEntry[]>([]);
  const [prompt, setPrompt] = useState("");
  const [insights, setInsights] = useState<InsightData>({ gaOverview: null, gscOverview: null });
  const [currentTime, setCurrentTime] = useState(new Date());
  const [prefill, setPrefill] = useState("");
  const [stepOutputs, setStepOutputs] = useState<{ agentName: string; agentId: number; content: string }[]>([]);

  const addLog = useCallback(
    (entry: ActivityLogEntry) => {
      setLog((prev) => [...prev, entry]);
      // Capture agent step completions for report generation
      if (entry.type === "agent" && entry.message.includes("produced") && entry.message.includes("chars")) {
        // The actual output is stored in the orchestrator's stepOutputs array
        // We'll capture it from the plan steps
      }
    },
    []
  );

  const activeAgents = agents.filter((a) => a.status === "active").length;
  const totalAgents = useAnimatedCount(agents.length);
  const totalDivisions = useAnimatedCount(divisions.length);
  const animatedPipelines = useAnimatedCount(7);

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

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
      setStepOutputs([]);

      try {
        setPhase("analyzing");
        addLog(makeLogEntry("system", "Agent 15 analyzing request\u2026", userPrompt.slice(0, 80)));
        await new Promise((r) => setTimeout(r, 300));

        setPhase("planning");
        const { pipeline, reasoning } = selectPipeline(userPrompt);
        const newPlan = buildPlan(pipeline, reasoning);
        setPlan(newPlan);
        addLog(makeLogEntry("system", `Pipeline: ${pipeline.name}`, reasoning.slice(0, 100)));
        addLog(makeLogEntry("system", `${newPlan.steps.length}-step execution plan ready`));

        let result: AsanaProvisionResult | null = null;
        if (asanaConnected && pat && workspaceGid) {
          setPhase("provisioning");
          addLog(makeLogEntry("asana", "Provisioning Asana project board\u2026"));
          try {
            result = await provisionAsana(pat, workspaceGid, TEAM_GID, newPlan, addLog);
            setAsanaResult(result);
            addLog(makeLogEntry("asana", `Asana board ready: ${result.projectName}`, `4 stage columns, ${result.tasks.length} tasks`));
          } catch (err) {
            addLog(makeLogEntry("system", "Asana provisioning failed \u2014 simulation mode", err instanceof Error ? err.message : undefined));
          }
        } else {
          addLog(makeLogEntry("system", "Asana not connected \u2014 running in simulation mode"));
        }

        let driveConfig: { accessToken: string; folderId: string } | null = null;
        const driveConnected = integrations.googleDrive.connected && !!integrations.googleDrive.accessToken;
        if (driveConnected) {
          try {
            addLog(makeLogEntry("system", "Provisioning Google Drive folder\u2026"));
            const driveResult: DriveProvisionResult = await provisionGoogleDrive(
              integrations.googleDrive.accessToken,
              integrations.googleDrive.folderId || undefined,
              newPlan,
              addLog
            );
            driveConfig = { accessToken: integrations.googleDrive.accessToken, folderId: driveResult.folderId };
            addLog(makeLogEntry("system", `Drive folder ready: ${driveResult.folderName}`, driveResult.webViewLink || undefined));
          } catch (err) {
            addLog(makeLogEntry("system", "Drive provisioning failed", err instanceof Error ? err.message : undefined));
          }
        }

        setPhase("executing");
        addLog(makeLogEntry("system", "Beginning agent execution sequence\u2026"));

        const gaConnected = integrations.googleAnalytics.connected && !!integrations.googleAnalytics.accessToken;
        const gscConnected = integrations.googleSearchConsole.connected && !!integrations.googleSearchConsole.accessToken;
        if (gaConnected) addLog(makeLogEntry("data", "GA4 integration active"));
        if (gscConnected) addLog(makeLogEntry("data", "GSC integration active"));
        if (driveConfig) addLog(makeLogEntry("data", "Google Drive active"));

        const finalInsights = await executeSimulation(
          newPlan, result, asanaConnected ? pat : null, integrations,
          (stepIndex, status) => {
            setPlan((prev) => {
              if (!prev) return prev;
              const steps = prev.steps.map((s) => s.stepIndex === stepIndex ? { ...s, status } : s);
              return { ...prev, steps };
            });
          },
          addLog,
          (updatedInsights) => setInsights(updatedInsights),
          driveConfig,
          (output) => setStepOutputs((prev) => [...prev, output])
        );
        setInsights(finalInsights);

        setPhase("completed");
        addLog(makeLogEntry("system", "Orchestration complete \u2014 all agents finished", `Pipeline: ${newPlan.pipelineName}`));
      } catch (err) {
        setPhase("error");
        addLog(makeLogEntry("system", "Orchestration error", err instanceof Error ? err.message : "Unknown error"));
      }
    },
    [asanaConnected, pat, workspaceGid, addLog, integrations]
  );

  const isRunning = phase !== "idle" && phase !== "completed" && phase !== "error";

  return (
    <div>
      {/* ── Hero Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-3">
        <div>
          <h1 className="text-[22px] md:text-[28px] font-semibold tracking-tight">
            Command Center
          </h1>
          <p className="text-[12px] md:text-[14px] text-text-secondary mt-1">
            {currentTime.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} &middot; {currentTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {phase !== "idle" && (
            <button onClick={reset} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-raised border border-border text-[12px] font-medium hover:border-brand-blue/30 transition-colors">
              <RotateCcw className="w-4 h-4" />
              New Request
            </button>
          )}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-green/10 text-brand-green text-[12px] font-semibold">
            <div className="w-2 h-2 rounded-full bg-brand-green animate-pulse" />
            System Online
          </div>
        </div>
      </div>

      {/* ── Hero Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-gradient-to-br from-brand-blue/10 to-brand-blue/5 rounded-xl border border-brand-blue/20 p-4 relative overflow-hidden">
          <Bot className="w-8 h-8 text-brand-blue/20 absolute -right-1 -bottom-1" />
          <p className="text-[10px] font-semibold text-brand-blue uppercase tracking-wider">Agents</p>
          <p className="text-[28px] md:text-[32px] font-bold text-brand-blue mt-1 leading-none">{totalAgents}</p>
          <p className="text-[10px] text-text-muted mt-1">{activeAgents} active now</p>
        </div>
        <div className="bg-gradient-to-br from-brand-green/10 to-brand-green/5 rounded-xl border border-brand-green/20 p-4 relative overflow-hidden">
          <Shield className="w-8 h-8 text-brand-green/20 absolute -right-1 -bottom-1" />
          <p className="text-[10px] font-semibold text-brand-green uppercase tracking-wider">Divisions</p>
          <p className="text-[28px] md:text-[32px] font-bold text-brand-green mt-1 leading-none">{totalDivisions}</p>
          <p className="text-[10px] text-text-muted mt-1">Operational units</p>
        </div>
        <div className="bg-gradient-to-br from-[#8B5CF6]/10 to-[#8B5CF6]/5 rounded-xl border border-[#8B5CF6]/20 p-4 relative overflow-hidden">
          <GitBranch className="w-8 h-8 text-[#8B5CF6]/20 absolute -right-1 -bottom-1" />
          <p className="text-[10px] font-semibold text-[#8B5CF6] uppercase tracking-wider">Pipelines</p>
          <p className="text-[28px] md:text-[32px] font-bold text-[#8B5CF6] mt-1 leading-none">{animatedPipelines}</p>
          <p className="text-[10px] text-text-muted mt-1">Automation workflows</p>
        </div>
        <div className="bg-gradient-to-br from-[#F59E0B]/10 to-[#F59E0B]/5 rounded-xl border border-[#F59E0B]/20 p-4 relative overflow-hidden">
          <Database className="w-8 h-8 text-[#F59E0B]/20 absolute -right-1 -bottom-1" />
          <p className="text-[10px] font-semibold text-[#F59E0B] uppercase tracking-wider">Memory</p>
          <p className="text-[28px] md:text-[32px] font-bold text-[#F59E0B] mt-1 leading-none">pgvector</p>
          <p className="text-[10px] text-text-muted mt-1">Supabase RAG</p>
        </div>
      </div>

      {/* ── Division Grid ── */}
      <div className="bg-surface-raised rounded-xl border border-border p-4 md:p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[13px] md:text-[14px] font-semibold">Division Status</h2>
          <span className="text-[10px] text-text-muted">{agents.length} agents across {divisions.length} divisions</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {divisions.map((div) => {
            const divAgents = agents.filter((a) => a.divisionId === div.id);
            const activeCount = divAgents.filter((a) => a.status === "active").length;
            return (
              <div
                key={div.id}
                className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-opacity-50 transition-all group"
                style={{ borderLeftWidth: 3, borderLeftColor: div.color }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-semibold truncate">{div.name}</span>
                    {activeCount > 0 && (
                      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: div.color }} />
                    )}
                  </div>
                  <p className="text-[10px] text-text-muted mt-0.5 truncate">{div.scope.split(",").slice(0, 2).join(",")}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {divAgents.map((agent) => (
                    <div
                      key={agent.id}
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold text-white transition-transform hover:scale-125 cursor-default"
                      style={{
                        backgroundColor: agent.status === "active" ? div.color : `${div.color}40`,
                      }}
                      title={`${agent.shortName} - ${agent.status}`}
                    >
                      {String(agent.id).padStart(2, "0")}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Asana Banner */}
      <div className="mb-5">
        <AsanaBanner connected={asanaConnected} projectGid={asanaResult?.projectGid} projectName={asanaResult?.projectName} />
      </div>

      {/* Request Input */}
      <div className="mb-6">
        <RequestInputBar onSubmit={handleSubmit} disabled={isRunning} phase={phase} prefill={prefill} />
      </div>

      {/* Orchestration Status */}
      {phase !== "idle" && (
        <div className="mb-5">
          <OrchestratorStatus phase={phase} reasoning={plan?.reasoning} pipelineName={plan?.pipelineName} />
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

      {/* Completed Summary + Report Download */}
      {phase === "completed" && plan && (
        <div className="bg-brand-green/10 rounded-xl border border-brand-green/20 p-5 md:p-6 mb-6">
          <div className="flex items-start gap-3 mb-4">
            <Cpu className="w-5 h-5 text-brand-green mt-0.5 shrink-0" />
            <div className="flex-1">
              <h3 className="text-[14px] md:text-[15px] font-semibold text-brand-green mb-1">Orchestration Complete</h3>
              <p className="text-[12px] md:text-[13px] text-text-secondary leading-relaxed mb-2">
                Pipeline <strong>{plan.pipelineName}</strong> finished with {plan.steps.length} agent steps.
                {asanaResult && <> All tasks synced to Asana project <strong>{asanaResult.projectName}</strong>.</>}
              </p>
              {prompt && (
                <p className="text-[11px] text-text-muted">
                  Original request: &ldquo;{prompt.slice(0, 120)}{prompt.length > 120 ? "\u2026" : ""}&rdquo;
                </p>
              )}
            </div>
          </div>

          {/* Report Download Buttons */}
          <div className="border-t border-brand-green/20 pt-4">
            <p className="text-[12px] font-semibold text-brand-green mb-3 flex items-center gap-2">
              <FileDown className="w-4 h-4" />
              Download Report
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  downloadDOCXReport(
                    stepOutputs,
                    `MP-${plan.pipelineName.replace(/\s+/g, "-")}`,
                    plan.pipelineName,
                    prompt?.slice(0, 100)
                  );
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white border border-brand-green/30 text-[12px] font-semibold text-text-primary hover:border-brand-green hover:shadow-sm transition-all"
              >
                <FileText className="w-4 h-4 text-brand-blue" />
                Word (.doc)
              </button>
              <button
                onClick={() => {
                  const html = generateHTMLReport({
                    title: plan.pipelineName,
                    subtitle: prompt?.slice(0, 100),
                    sections: stepOutputs,
                    pipelineName: plan.pipelineName,
                  });
                  downloadHTMLReport(html, `MP-${plan.pipelineName.replace(/\s+/g, "-")}`);
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white border border-brand-green/30 text-[12px] font-semibold text-text-primary hover:border-brand-green hover:shadow-sm transition-all"
              >
                <FileCode className="w-4 h-4 text-[#F59E0B]" />
                HTML
              </button>
              <button
                onClick={() => downloadMarkdownReport(
                  stepOutputs,
                  `MP-${plan.pipelineName.replace(/\s+/g, "-")}`,
                  plan.pipelineName
                )}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white border border-brand-green/30 text-[12px] font-semibold text-text-primary hover:border-brand-green hover:shadow-sm transition-all"
              >
                <FileDown className="w-4 h-4 text-[#8B5CF6]" />
                Markdown (.md)
              </button>
              <button
                onClick={() => {
                  const html = generateHTMLReport({
                    title: plan.pipelineName,
                    subtitle: prompt?.slice(0, 100),
                    sections: stepOutputs,
                    pipelineName: plan.pipelineName,
                  });
                  printReport(html);
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white border border-brand-green/30 text-[12px] font-semibold text-text-primary hover:border-brand-green hover:shadow-sm transition-all"
              >
                <Printer className="w-4 h-4 text-text-secondary" />
                Print
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Quick Start Grid ── */}
      {phase === "idle" && (
        <div className="mt-6">
          <h2 className="text-[14px] md:text-[16px] font-semibold mb-4 text-text-secondary">Quick Start</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { label: "Launch Campaign", desc: "Full multi-channel campaign from research to deployment", prompt: "Launch a full campaign for [CLIENT/BRAND NAME] targeting [AUDIENCE] across [CHANNELS]", icon: Rocket, color: "#2CACE8", agents: "02, 05, 07, 08" },
              { label: "Onboard Client", desc: "End-to-end client discovery and Asana project setup", prompt: "Onboard new client [CLIENT NAME] in the [INDUSTRY] vertical with competitive analysis", icon: Users, color: "#08AE67", agents: "19, 01, 25" },
              { label: "Optimize Performance", desc: "Weekly optimization cycle across all active campaigns", prompt: "Run a performance optimization cycle on all active campaigns for [CLIENT NAME]", icon: TrendingUp, color: "#F59E0B", agents: "13, 14, 07, 08" },
              { label: "Content Engine", desc: "Produce authority content with SEO and social distribution", prompt: "Create an authority content piece about [TOPIC] for [CLIENT/BRAND] targeting [AUDIENCE]", icon: Brain, color: "#8B5CF6", agents: "03, 04, 10, 21" },
              { label: "AI Visibility Audit", desc: "Audit brand presence across ChatGPT, Claude, Perplexity", prompt: "Run an LLMO audit for [BRAND NAME] across ChatGPT, Claude, Perplexity, and Google AI Overviews", icon: Search, color: "#EF4444", agents: "21, 10, 03" },
              { label: "Local SEO Scan", desc: "GEO grid rank scan and Google Business Profile audit", prompt: "Run a local SEO geo-grid scan for [BUSINESS NAME] in [CITY/SERVICE AREA] and audit the GBP listing", icon: MapPin, color: "#14B8A6", agents: "31, 32, 33" },
              { label: "Email Sequences", desc: "Build automated nurture workflows with behavioral triggers", prompt: "Build an email nurture sequence for [CLIENT NAME] targeting [AUDIENCE/SEGMENT] with [GOAL]", icon: Mail, color: "#0EA5E9", agents: "24, 04, 14" },
              { label: "Revenue Intelligence", desc: "Client LTV analysis, churn prediction, and upsell scan", prompt: "Run a revenue intelligence report for [CLIENT NAME] with churn risk analysis and upsell opportunities", icon: BarChart3, color: "#F97316", agents: "27, 25, 26" },
              { label: "Market Research", desc: "Industry trends, competitive landscape, and TAM analysis", prompt: "Conduct market research on the [INDUSTRY] industry with TAM analysis and competitor mapping", icon: Target, color: "#EC4899", agents: "30, 01, 29" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  onClick={() => { setPrefill(item.prompt); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  className="text-left bg-surface-raised rounded-xl border border-border p-4 hover:border-opacity-50 transition-all group relative overflow-hidden"
                  style={{ borderTopWidth: 2, borderTopColor: item.color }}
                >
                  <Icon className="w-12 h-12 absolute -right-2 -bottom-2 transition-transform group-hover:scale-110" style={{ color: `${item.color}12` }} />
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${item.color}15` }}>
                      <Icon className="w-3.5 h-3.5" style={{ color: item.color }} />
                    </div>
                    <h3 className="text-[13px] font-semibold group-hover:text-brand-blue transition-colors">{item.label}</h3>
                  </div>
                  <p className="text-[11px] text-text-muted leading-relaxed mb-2">{item.desc}</p>
                  <div className="flex items-center gap-1">
                    <Zap className="w-3 h-3 text-text-muted" />
                    <span className="text-[9px] text-text-muted font-medium">Agents {item.agents}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
