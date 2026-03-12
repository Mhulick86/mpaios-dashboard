"use client";

import type { OrchestrationPhase } from "@/lib/orchestrator";
import {
  Search,
  BrainCircuit,
  FolderKanban,
  Play,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from "lucide-react";

interface Props {
  phase: OrchestrationPhase;
  reasoning?: string;
  pipelineName?: string;
}

const PHASE_CONFIG: {
  id: OrchestrationPhase;
  label: string;
  icon: React.ElementType;
}[] = [
  { id: "analyzing", label: "Analyzing", icon: Search },
  { id: "planning", label: "Planning", icon: BrainCircuit },
  { id: "provisioning", label: "Provisioning", icon: FolderKanban },
  { id: "executing", label: "Executing", icon: Play },
  { id: "completed", label: "Completed", icon: CheckCircle2 },
];

function phaseIndex(phase: OrchestrationPhase): number {
  return PHASE_CONFIG.findIndex((p) => p.id === phase);
}

export function OrchestratorStatus({ phase, reasoning, pipelineName }: Props) {
  if (phase === "idle") return null;

  const currentIdx = phaseIndex(phase);

  return (
    <div className="bg-surface-raised rounded-xl border border-border p-4 md:p-5">
      {/* Phase timeline */}
      <div className="flex items-center gap-1 md:gap-2 mb-4 overflow-x-auto pb-1">
        {PHASE_CONFIG.map((cfg, idx) => {
          const Icon = cfg.icon;
          const isActive = cfg.id === phase;
          const isComplete = currentIdx > idx;
          const isError = phase === "error";

          let dotColor = "bg-border";
          let textColor = "text-text-muted";
          let iconColor = "text-text-muted";

          if (isError && isActive) {
            dotColor = "bg-red-500";
            textColor = "text-red-400";
            iconColor = "text-red-400";
          } else if (isComplete) {
            dotColor = "bg-brand-green";
            textColor = "text-brand-green";
            iconColor = "text-brand-green";
          } else if (isActive) {
            dotColor = "bg-brand-blue";
            textColor = "text-brand-blue";
            iconColor = "text-brand-blue";
          }

          return (
            <div key={cfg.id} className="flex items-center gap-1 md:gap-2">
              {idx > 0 && (
                <div
                  className={`w-6 md:w-10 h-px ${
                    isComplete ? "bg-brand-green" : "bg-border"
                  }`}
                />
              )}
              <div className="flex items-center gap-1.5 shrink-0">
                <div
                  className={`w-6 h-6 md:w-7 md:h-7 rounded-full flex items-center justify-center ${dotColor}`}
                >
                  {isActive && !isComplete && !isError ? (
                    <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                  ) : isError && isActive ? (
                    <AlertTriangle className="w-3.5 h-3.5 text-white" />
                  ) : (
                    <Icon
                      className={`w-3.5 h-3.5 ${
                        isComplete ? "text-white" : iconColor
                      }`}
                    />
                  )}
                </div>
                <span
                  className={`text-[10px] md:text-[11px] font-medium ${textColor} hidden sm:inline`}
                >
                  {cfg.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Reasoning / Pipeline info */}
      {pipelineName && (
        <div className="text-[12px] md:text-[13px] font-semibold text-text-primary mb-1">
          Pipeline: {pipelineName}
        </div>
      )}
      {reasoning && (
        <p className="text-[11px] md:text-[12px] text-text-secondary leading-relaxed">
          {reasoning}
        </p>
      )}
    </div>
  );
}
