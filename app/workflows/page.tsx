"use client";

import { useState, useEffect } from "react";
import { getWorkflows, getWorkflowRuns, executeWorkflow, deleteWorkflow } from "@/lib/workflowEngine";
import type { Workflow, WorkflowRun } from "@/lib/supabase/types";
import { pipelines } from "@/lib/pipelines";
import { agents } from "@/lib/agents";
import {
  Workflow as WorkflowIcon,
  Play,
  Pause,
  Trash2,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Plus,
  ChevronDown,
  ChevronUp,
  Zap,
} from "lucide-react";

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [executingId, setExecutingId] = useState<string | null>(null);

  const loadData = async () => {
    const [wf, wr] = await Promise.all([getWorkflows(), getWorkflowRuns()]);
    setWorkflows(wf);
    setRuns(wr);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleExecute = async (workflowId: string) => {
    setExecutingId(workflowId);
    await executeWorkflow(workflowId);
    await loadData();
    setExecutingId(null);
  };

  const handleDelete = async (workflowId: string) => {
    await deleteWorkflow(workflowId);
    await loadData();
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle className="w-4 h-4 text-brand-green" />;
      case "failed": return <XCircle className="w-4 h-4 text-div-5" />;
      case "running": return <Loader2 className="w-4 h-4 text-brand-blue animate-spin" />;
      default: return <Clock className="w-4 h-4 text-text-muted" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[20px] md:text-[24px] font-semibold">Workflows</h1>
          <p className="text-[12px] md:text-[14px] text-text-secondary mt-1">
            Automated multi-agent execution pipelines &middot; {workflows.length} workflows &middot;{" "}
            {runs.length} runs
          </p>
        </div>
      </div>

      {/* Available Pipelines as Workflow Templates */}
      <div className="mb-8">
        <h2 className="text-[14px] font-semibold mb-3 text-text-secondary">Pipeline Templates</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {pipelines.map((pipeline) => (
            <div
              key={pipeline.id}
              className="bg-surface-raised rounded-xl border border-border p-4 hover:border-brand-blue/30 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-[13px] font-semibold">{pipeline.name}</h3>
                <Zap className="w-4 h-4 text-brand-blue shrink-0" />
              </div>
              <p className="text-[11px] text-text-muted mb-3 line-clamp-2">
                {pipeline.steps.length} steps &middot; {pipeline.estimatedDuration}
              </p>
              <div className="flex flex-wrap gap-1">
                {pipeline.steps.slice(0, 3).map((step, i) => {
                  const agent = agents.find((a) => a.id === step.agentId);
                  return (
                    <span
                      key={i}
                      className="text-[9px] px-2 py-0.5 rounded-full bg-brand-blue/10 text-brand-blue"
                    >
                      {agent?.shortName || `Agent ${step.agentId}`}
                    </span>
                  );
                })}
                {pipeline.steps.length > 3 && (
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-gray-100 text-text-muted">
                    +{pipeline.steps.length - 3} more
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Saved Workflows */}
      <div className="mb-8">
        <h2 className="text-[14px] font-semibold mb-3 text-text-secondary">Saved Workflows</h2>
        {workflows.length > 0 ? (
          <div className="space-y-3">
            {workflows.map((wf) => (
              <div
                key={wf.id}
                className="bg-surface-raised rounded-xl border border-border p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <WorkflowIcon className="w-5 h-5 text-brand-blue" />
                    <div>
                      <h3 className="text-[13px] font-semibold">{wf.name}</h3>
                      <p className="text-[11px] text-text-muted">
                        {wf.steps.length} steps &middot; {wf.trigger_type} trigger &middot;{" "}
                        {wf.run_count} runs
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleExecute(wf.id)}
                      disabled={executingId === wf.id}
                      className="p-2 rounded-lg bg-brand-blue/10 text-brand-blue hover:bg-brand-blue/20 transition-colors disabled:opacity-50"
                    >
                      {executingId === wf.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(wf.id)}
                      className="p-2 rounded-lg text-text-muted hover:text-div-5 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-surface-raised rounded-xl border border-border p-8 text-center">
            <WorkflowIcon className="w-8 h-8 text-text-muted mx-auto mb-3" />
            <p className="text-[13px] text-text-secondary">No workflows created yet.</p>
            <p className="text-[11px] text-text-muted mt-1">
              Use the Dashboard orchestrator or create a workflow from a pipeline template.
            </p>
          </div>
        )}
      </div>

      {/* Recent Runs */}
      <div>
        <h2 className="text-[14px] font-semibold mb-3 text-text-secondary">Recent Runs</h2>
        {runs.length > 0 ? (
          <div className="space-y-2">
            {runs.map((run) => (
              <div key={run.id} className="bg-surface-raised rounded-xl border border-border">
                <div
                  className="flex items-center justify-between p-4 cursor-pointer"
                  onClick={() => setExpandedRun(expandedRun === run.id ? null : run.id)}
                >
                  <div className="flex items-center gap-3">
                    {statusIcon(run.status)}
                    <div>
                      <p className="text-[12px] font-medium">
                        {run.status.charAt(0).toUpperCase() + run.status.slice(1)} &middot;{" "}
                        Step {run.current_step + 1}/{run.total_steps}
                      </p>
                      <p className="text-[10px] text-text-muted">
                        {new Date(run.started_at).toLocaleString()}
                        {run.tokens_total > 0 && ` · ${run.tokens_total.toLocaleString()} tokens`}
                        {run.cost_total > 0 && ` · $${run.cost_total.toFixed(3)}`}
                      </p>
                    </div>
                  </div>
                  {expandedRun === run.id ? (
                    <ChevronUp className="w-4 h-4 text-text-muted" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-text-muted" />
                  )}
                </div>
                {expandedRun === run.id && (
                  <div className="px-4 pb-4 border-t border-border pt-3">
                    {run.step_results && (run.step_results as Record<string, unknown>[]).length > 0 ? (
                      <div className="space-y-2">
                        {(run.step_results as Record<string, unknown>[]).map((step, i) => (
                          <div key={i} className="flex items-center gap-2 text-[12px]">
                            {step.status === "completed" ? (
                              <CheckCircle className="w-3 h-3 text-brand-green" />
                            ) : (
                              <XCircle className="w-3 h-3 text-div-5" />
                            )}
                            <span>Step {(step.stepIndex as number) + 1}</span>
                            {step.latency && (
                              <span className="text-text-muted">{step.latency as number}ms</span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[12px] text-text-muted">No step results available.</p>
                    )}
                    {run.error && (
                      <div className="mt-2 p-2 rounded-lg bg-red-500/5 text-[12px] text-red-400">
                        {run.error}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[13px] text-text-muted bg-surface-raised rounded-xl border border-border p-6 text-center">
            No workflow runs yet.
          </p>
        )}
      </div>
    </div>
  );
}
