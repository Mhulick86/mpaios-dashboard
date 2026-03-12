"use client";

import type { OrchestrationStep } from "@/lib/orchestrator";
import {
  Clock,
  Loader2,
  CheckCircle2,
  UserCheck,
  Circle,
} from "lucide-react";

interface Props {
  steps: OrchestrationStep[];
}

function statusIcon(status: OrchestrationStep["status"]) {
  switch (status) {
    case "active":
      return <Loader2 className="w-4 h-4 text-brand-blue animate-spin" />;
    case "complete":
      return <CheckCircle2 className="w-4 h-4 text-brand-green" />;
    case "human_review":
      return <UserCheck className="w-4 h-4 text-amber-400" />;
    default:
      return <Circle className="w-4 h-4 text-text-muted" />;
  }
}

function statusBorder(status: OrchestrationStep["status"]) {
  switch (status) {
    case "active":
      return "border-brand-blue/40 shadow-[0_0_12px_rgba(44,172,232,0.08)]";
    case "complete":
      return "border-brand-green/30";
    case "human_review":
      return "border-amber-400/40 shadow-[0_0_12px_rgba(245,158,11,0.08)]";
    default:
      return "border-border";
  }
}

function statusLabel(status: OrchestrationStep["status"]) {
  switch (status) {
    case "active":
      return (
        <span className="text-[10px] font-medium text-brand-blue bg-brand-blue/10 px-2 py-0.5 rounded-full">
          Running
        </span>
      );
    case "complete":
      return (
        <span className="text-[10px] font-medium text-brand-green bg-brand-green/10 px-2 py-0.5 rounded-full">
          Done
        </span>
      );
    case "human_review":
      return (
        <span className="text-[10px] font-medium text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full">
          Review
        </span>
      );
    default:
      return (
        <span className="text-[10px] font-medium text-text-muted bg-surface/60 px-2 py-0.5 rounded-full">
          Pending
        </span>
      );
  }
}

export function KanbanBoard({ steps }: Props) {
  if (steps.length === 0) return null;

  return (
    <div className="bg-surface-raised rounded-xl border border-border p-4 md:p-5">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-4 h-4 text-text-secondary" />
        <h3 className="text-[13px] md:text-[14px] font-semibold">
          Workflow Board
        </h3>
        <span className="text-[11px] text-text-muted ml-auto">
          {steps.filter((s) => s.status === "complete").length}/{steps.length}{" "}
          complete
        </span>
      </div>

      {/* Horizontal scroll kanban */}
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
        {steps.map((step) => (
          <div
            key={step.stepIndex}
            className={`shrink-0 w-[220px] md:w-[240px] rounded-lg border ${statusBorder(
              step.status
            )} bg-surface p-3 snap-start transition-all duration-300`}
          >
            {/* Column header */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                Step {step.stepIndex + 1}
              </span>
              {statusLabel(step.status)}
            </div>

            {/* Agent name */}
            <div className="text-[12px] font-semibold text-text-primary mb-1.5 leading-snug">
              {step.agentShortName}
            </div>

            {/* Task card */}
            <div className="flex items-start gap-2">
              {statusIcon(step.status)}
              <p className="text-[11px] text-text-secondary leading-relaxed flex-1">
                {step.action}
              </p>
            </div>

            {/* Human review indicator */}
            {step.isHumanReview && step.status !== "complete" && (
              <div className="mt-2 flex items-center gap-1.5 text-[10px] text-amber-400">
                <UserCheck className="w-3 h-3" />
                Human checkpoint
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
