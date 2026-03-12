"use client";

import { useState, useEffect } from "react";
import {
  ChevronRight,
  ChevronDown,
  Bot,
  ArrowRight,
  Brain,
  CheckCircle2,
  Loader2,
  Zap,
  PanelRightClose,
  PanelRightOpen,
  ChevronUp,
} from "lucide-react";
import type { AgentActivity } from "@/lib/chatStorage";

/* ---------- Division colors ---------- */
const DIVISION_COLORS: Record<number, string> = {
  1: "#2CACE8", // Strategy & Intelligence
  2: "#08AE67", // Content & Creative
  3: "#F59E0B", // Paid Media
  4: "#8B5CF6", // Organic & Authority
  5: "#EF4444", // Analytics & Optimization
  6: "#6B7280", // Operations & Infrastructure
};

function getDivision(agentId: number): number {
  if (agentId <= 2) return 1;
  if (agentId <= 6) return 2;
  if (agentId <= 9) return 3;
  if (agentId <= 12) return 4;
  if (agentId <= 14) return 5;
  return 6;
}

function getStatusIcon(action: AgentActivity["action"]) {
  switch (action) {
    case "activated":
      return <Zap className="w-3 h-3" />;
    case "thinking":
      return <Brain className="w-3 h-3" />;
    case "responding":
      return <Loader2 className="w-3 h-3 animate-spin" />;
    case "handoff":
      return <ArrowRight className="w-3 h-3" />;
    case "complete":
      return <CheckCircle2 className="w-3 h-3" />;
  }
}

function getStatusLabel(action: AgentActivity["action"]) {
  switch (action) {
    case "activated":
      return "Activated";
    case "thinking":
      return "Analyzing";
    case "responding":
      return "Working";
    case "handoff":
      return "Handoff";
    case "complete":
      return "Complete";
  }
}

/* ---------- Props ---------- */
interface AgentActivityPanelProps {
  activities: AgentActivity[];
  isStreaming: boolean;
  collapsed: boolean;
  onToggle: () => void;
}

export function AgentActivityPanel({
  activities,
  isStreaming,
  collapsed,
  onToggle,
}: AgentActivityPanelProps) {
  const [expandedAgents, setExpandedAgents] = useState<Set<number>>(new Set());
  const [mobileExpanded, setMobileExpanded] = useState(false);

  // Group activities by agent
  const agentGroups = new Map<number, AgentActivity[]>();
  for (const activity of activities) {
    const existing = agentGroups.get(activity.agentId) || [];
    existing.push(activity);
    agentGroups.set(activity.agentId, existing);
  }

  const toggleAgent = (id: number) => {
    setExpandedAgents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Auto-expand mobile sheet when streaming starts
  useEffect(() => {
    if (isStreaming && activities.length > 0) {
      setMobileExpanded(true);
    }
  }, [isStreaming, activities.length]);

  const panelContent = (
    <>
      {/* Activity Feed */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {activities.length === 0 && !isStreaming && (
          <div className="text-center py-8">
            <Bot className="w-8 h-8 text-gray-200 mx-auto mb-2" />
            <p className="text-[12px] text-text-muted">
              Agent activity will appear here as the orchestrator routes your requests.
            </p>
          </div>
        )}

        {isStreaming && activities.length === 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-blue/5 border border-brand-blue/10">
            <Loader2 className="w-3.5 h-3.5 text-brand-blue animate-spin" />
            <span className="text-[12px] text-brand-blue font-medium">
              Orchestrator routing...
            </span>
          </div>
        )}

        {Array.from(agentGroups.entries()).map(([agentId, agentActivities]) => {
          const divisionId = getDivision(agentId);
          const color = DIVISION_COLORS[divisionId];
          const isExpanded = expandedAgents.has(agentId);
          const latestAction = agentActivities[agentActivities.length - 1];

          return (
            <div
              key={agentId}
              className="rounded-lg border border-border overflow-hidden"
            >
              {/* Agent header */}
              <button
                onClick={() => toggleAgent(agentId)}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 transition-colors"
              >
                <div
                  className="w-6 h-6 rounded flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                  style={{ backgroundColor: color }}
                >
                  {String(agentId).padStart(2, "0")}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-[12px] font-medium truncate">
                    {latestAction.agentName}
                  </p>
                </div>
                <div
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0"
                  style={{
                    backgroundColor: `${color}15`,
                    color: color,
                  }}
                >
                  {getStatusIcon(latestAction.action)}
                  <span>{getStatusLabel(latestAction.action)}</span>
                </div>
                {agentActivities.length > 1 &&
                  (isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 text-text-muted shrink-0" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-text-muted shrink-0" />
                  ))}
              </button>

              {/* Latest message (always shown) */}
              {latestAction.message && (
                <div className="px-3 pb-2 -mt-0.5">
                  <p className="text-[11px] text-text-secondary leading-relaxed pl-8">
                    {latestAction.action === "handoff" && latestAction.targetAgent && (
                      <span className="font-medium text-brand-blue">
                        → {latestAction.targetAgent}:{" "}
                      </span>
                    )}
                    {latestAction.message}
                  </p>
                </div>
              )}

              {/* Expanded: show all activities for this agent */}
              {isExpanded && agentActivities.length > 1 && (
                <div className="border-t border-border bg-gray-50 px-3 py-2 space-y-1.5">
                  {agentActivities.map((act, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div
                        className="mt-0.5 shrink-0"
                        style={{ color: color }}
                      >
                        {getStatusIcon(act.action)}
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10px] font-medium text-text-muted">
                          {getStatusLabel(act.action)}
                        </span>
                        {act.message && (
                          <p className="text-[11px] text-text-secondary">
                            {act.action === "handoff" && act.targetAgent && (
                              <span className="font-medium">→ {act.targetAgent}: </span>
                            )}
                            {act.message}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary footer */}
      {agentGroups.size > 0 && (
        <div className="px-4 py-2.5 border-t border-border bg-gray-50">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-text-muted">
              {agentGroups.size} agent{agentGroups.size !== 1 ? "s" : ""} involved
            </span>
            <span className="text-text-muted">
              {activities.filter((a) => a.action === "handoff").length} handoff
              {activities.filter((a) => a.action === "handoff").length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      )}
    </>
  );

  /* ===== MOBILE: Bottom sheet ===== */
  const mobilePanel = (
    <div className="md:hidden">
      {/* Collapsed: floating pill at bottom */}
      {!mobileExpanded && activities.length > 0 && (
        <button
          onClick={() => setMobileExpanded(true)}
          className="fixed bottom-20 right-4 z-20 flex items-center gap-2 px-3 py-2 rounded-full bg-white border border-border shadow-lg"
        >
          <Bot className="w-4 h-4 text-brand-blue" />
          <span className="text-[12px] font-medium">
            {agentGroups.size} agent{agentGroups.size !== 1 ? "s" : ""}
          </span>
          {isStreaming && <Loader2 className="w-3 h-3 text-brand-blue animate-spin" />}
          <ChevronUp className="w-3.5 h-3.5 text-text-muted" />
        </button>
      )}

      {/* Expanded: bottom sheet */}
      {mobileExpanded && (
        <>
          <div
            className="fixed inset-0 z-30 bg-black/30"
            onClick={() => setMobileExpanded(false)}
          />
          <div className="fixed bottom-0 left-0 right-0 z-40 bg-white rounded-t-2xl border-t border-border shadow-2xl max-h-[60vh] flex flex-col">
            {/* Handle bar */}
            <div className="flex justify-center pt-2 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-300" />
            </div>
            {/* Header */}
            <div className="px-4 py-2 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-brand-blue" />
                <h2 className="text-[13px] font-semibold">Agent Activity</h2>
                {isStreaming && (
                  <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-brand-blue/10">
                    <Loader2 className="w-3 h-3 text-brand-blue animate-spin" />
                    <span className="text-[10px] font-medium text-brand-blue">Live</span>
                  </div>
                )}
              </div>
              <button
                onClick={() => setMobileExpanded(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <ChevronDown className="w-4 h-4 text-text-muted" />
              </button>
            </div>
            {panelContent}
          </div>
        </>
      )}
    </div>
  );

  /* ===== DESKTOP: Side panel ===== */
  if (collapsed) {
    return (
      <>
        {/* Desktop collapsed toggle */}
        <button
          onClick={onToggle}
          className="hidden md:flex fixed right-0 top-[80px] z-20 bg-white border border-r-0 border-border rounded-l-lg px-2 py-3 shadow-sm hover:bg-gray-50 transition-colors flex-col items-center"
          title="Show agent activity"
        >
          <PanelRightOpen className="w-4 h-4 text-text-muted" />
          {activities.length > 0 && (
            <div className="mt-1.5 w-5 h-5 rounded-full bg-brand-blue text-white text-[10px] font-bold flex items-center justify-center">
              {agentGroups.size}
            </div>
          )}
        </button>
        {mobilePanel}
      </>
    );
  }

  return (
    <>
      {/* Desktop side panel */}
      <div className="hidden md:flex w-[300px] border-l border-border bg-white flex-col h-full shrink-0">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-brand-blue" />
            <h2 className="text-[13px] font-semibold">Agent Activity</h2>
            {isStreaming && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-brand-blue/10">
                <Loader2 className="w-3 h-3 text-brand-blue animate-spin" />
                <span className="text-[10px] font-medium text-brand-blue">Live</span>
              </div>
            )}
          </div>
          <button
            onClick={onToggle}
            className="p-1 rounded hover:bg-gray-100 transition-colors"
            title="Hide panel"
          >
            <PanelRightClose className="w-4 h-4 text-text-muted" />
          </button>
        </div>
        {panelContent}
      </div>

      {/* Mobile bottom sheet */}
      {mobilePanel}
    </>
  );
}
