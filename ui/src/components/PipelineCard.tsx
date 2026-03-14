"use client";

import { useState } from "react";
import type { Pipeline, PipelineStep } from "@/lib/pipelines";
import { StatusBadge } from "./StatusBadge";
import {
  Play,
  Square,
  ChevronDown,
  ChevronUp,
  Clock,
  Zap,
  UserCheck,
  CheckCircle2,
  Loader2,
} from "lucide-react";

export function PipelineCard({ pipeline }: { pipeline: Pipeline }) {
  const [expanded, setExpanded] = useState(false);
  const [running, setRunning] = useState(false);
  const [activeStep, setActiveStep] = useState(-1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  function handleLaunch() {
    if (running) {
      setRunning(false);
      setActiveStep(-1);
      setCompletedSteps([]);
      return;
    }

    setRunning(true);
    setExpanded(true);
    setActiveStep(0);
    setCompletedSteps([]);

    let current = 0;
    const interval = setInterval(() => {
      setCompletedSteps((prev) => [...prev, current]);
      current++;
      if (current < pipeline.steps.length) {
        setActiveStep(current);
      } else {
        clearInterval(interval);
        setRunning(false);
        setActiveStep(-1);
      }
    }, 1500);
  }

  function getStepIcon(step: PipelineStep, idx: number) {
    if (completedSteps.includes(idx)) {
      return <CheckCircle2 className="w-3.5 h-3.5 text-brand-green" />;
    }
    if (activeStep === idx) {
      return <Loader2 className="w-3.5 h-3.5 animate-spin" />;
    }
    if (step.isHumanReview) {
      return <UserCheck className="w-3.5 h-3.5" />;
    }
    return step.step;
  }

  function getStepClasses(step: PipelineStep, idx: number) {
    if (completedSteps.includes(idx)) {
      return "bg-brand-green/10 text-brand-green border-2 border-brand-green/30";
    }
    if (activeStep === idx) {
      return "bg-brand-blue/10 text-brand-blue border-2 border-brand-blue animate-pulse";
    }
    if (step.isHumanReview) {
      return "bg-amber-100 text-amber-700 border-2 border-amber-300";
    }
    return "bg-brand-blue/10 text-brand-blue border-2 border-brand-blue/30";
  }

  return (
    <div className="bg-surface-raised rounded-xl border border-border">
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-brand-blue/10 flex items-center justify-center">
              <Zap className="w-5 h-5 text-brand-blue" />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold">{pipeline.name}</h3>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-[11px] text-text-muted flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {pipeline.estimatedDuration}
                </span>
                <span className="text-[11px] text-text-muted">
                  {pipeline.steps.length} steps
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {running ? (
              <StatusBadge status="running" />
            ) : completedSteps.length === pipeline.steps.length ? (
              <StatusBadge status="completed" />
            ) : (
              <StatusBadge status={pipeline.status} />
            )}
            <button
              onClick={handleLaunch}
              className={`px-3 py-1.5 text-white text-[12px] font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                running
                  ? "bg-red-500 hover:bg-red-600"
                  : "bg-brand-blue hover:bg-brand-blue-dark"
              }`}
            >
              {running ? (
                <>
                  <Square className="w-3 h-3" />
                  Stop
                </>
              ) : (
                <>
                  <Play className="w-3 h-3" />
                  Launch
                </>
              )}
            </button>
          </div>
        </div>

        <p className="text-[13px] text-text-secondary leading-relaxed mt-2">
          {pipeline.description}
        </p>

        <div className="mt-3 flex items-center gap-2">
          <span className="text-[11px] font-medium text-text-muted">Trigger:</span>
          <span className="text-[11px] text-text-secondary">{pipeline.trigger}</span>
        </div>

        {/* Expand */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 flex items-center gap-1 text-[12px] font-medium text-brand-blue hover:text-brand-blue-dark transition-colors"
        >
          {expanded ? (
            <>
              Hide steps <ChevronUp className="w-3.5 h-3.5" />
            </>
          ) : (
            <>
              View pipeline steps <ChevronDown className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </div>

      {/* Steps */}
      {expanded && (
        <div className="border-t border-border px-5 py-4">
          <div className="space-y-0">
            {pipeline.steps.map((step, idx) => (
              <div key={step.step} className="flex gap-3">
                {/* Timeline */}
                <div className="flex flex-col items-center">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${getStepClasses(step, idx)}`}
                  >
                    {getStepIcon(step, idx)}
                  </div>
                  {idx < pipeline.steps.length - 1 && (
                    <div
                      className={`w-px h-full min-h-[24px] my-1 ${
                        completedSteps.includes(idx) ? "bg-brand-green/40" : "bg-gray-200"
                      }`}
                    />
                  )}
                </div>
                {/* Content */}
                <div className="pb-4 pt-0.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[12px] font-semibold ${
                        activeStep === idx ? "text-brand-blue" : ""
                      }`}
                    >
                      {step.agent}
                    </span>
                    {step.isHumanReview && (
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                        Human Review
                      </span>
                    )}
                    {completedSteps.includes(idx) && (
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-brand-green/10 text-brand-green">
                        Done
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-text-secondary mt-0.5">
                    {step.action}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
