"use client";

import { useState } from "react";
import { agents, divisions, getAgentsByDivision } from "@/lib/agents";
import { agentMetrics } from "@/lib/metrics";
import { AgentCard } from "@/components/AgentCard";
import {
  Bot,
  Zap,
  Clock,
  TrendingUp,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

export default function AgentsPage() {
  const [expandedDivision, setExpandedDivision] = useState<number | null>(null);

  const totalTasks = agentMetrics.reduce((sum, m) => sum + m.tasksCompleted, 0);
  const avgEfficiency = Math.round(
    agentMetrics.reduce((sum, m) => sum + m.efficiency, 0) / agentMetrics.length
  );
  const activeCount = agents.filter((a) => a.status === "active").length;

  return (
    <div>
      <div className="mb-6 md:mb-8">
        <h1 className="text-[20px] md:text-[24px] font-semibold">Agents</h1>
        <p className="text-[12px] md:text-[14px] text-text-secondary mt-1">
          {agents.length} specialized AI agents across {divisions.length}{" "}
          divisions
        </p>
      </div>

      {/* Agent System Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
        <div className="bg-surface-raised rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Bot className="w-4 h-4 text-brand-blue" />
            <span className="text-[11px] text-text-muted uppercase tracking-wider">
              Total Agents
            </span>
          </div>
          <p className="text-[24px] font-semibold">{agents.length}</p>
          <p className="text-[11px] text-text-muted">
            {activeCount} currently active
          </p>
        </div>
        <div className="bg-surface-raised rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-brand-green" />
            <span className="text-[11px] text-text-muted uppercase tracking-wider">
              Tasks Done
            </span>
          </div>
          <p className="text-[24px] font-semibold">{totalTasks}</p>
          <p className="text-[11px] text-text-muted">This period</p>
        </div>
        <div className="bg-surface-raised rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-[#8B5CF6]" />
            <span className="text-[11px] text-text-muted uppercase tracking-wider">
              Avg Efficiency
            </span>
          </div>
          <p className="text-[24px] font-semibold">{avgEfficiency}%</p>
          <p className="text-[11px] text-brand-green">+2.1% vs last period</p>
        </div>
        <div className="bg-surface-raised rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-[#F59E0B]" />
            <span className="text-[11px] text-text-muted uppercase tracking-wider">
              Avg Response
            </span>
          </div>
          <p className="text-[24px] font-semibold">1.9s</p>
          <p className="text-[11px] text-brand-green">-0.3s improvement</p>
        </div>
      </div>

      {/* Divisions with agents */}
      <div className="space-y-4">
        {divisions.map((division) => {
          const divisionAgents = getAgentsByDivision(division.id);
          const isExpanded = expandedDivision === division.id;
          const divActiveCount = divisionAgents.filter(
            (a) => a.status === "active"
          ).length;
          const divMetrics = agentMetrics.filter((m) =>
            divisionAgents.some((a) => a.id === m.agentId)
          );
          const divEfficiency =
            divMetrics.length > 0
              ? Math.round(
                  divMetrics.reduce((sum, m) => sum + m.efficiency, 0) /
                    divMetrics.length
                )
              : 0;

          return (
            <section key={division.id}>
              {/* Division Header */}
              <button
                onClick={() =>
                  setExpandedDivision(isExpanded ? null : division.id)
                }
                className="w-full bg-surface-raised rounded-xl border border-border p-4 md:p-5 hover:border-brand-blue/30 transition-colors text-left"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: division.color }}
                    />
                    <div>
                      <h2 className="text-[14px] md:text-[16px] font-semibold">
                        {division.name}
                      </h2>
                      <p className="text-[11px] md:text-[12px] text-text-secondary mt-0.5">
                        {division.scope}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="hidden sm:flex items-center gap-3">
                      <span className="text-[11px] text-text-muted">
                        {divisionAgents.length} agents
                      </span>
                      <span className="text-[11px] text-brand-green">
                        {divActiveCount} active
                      </span>
                      <span className="text-[11px] text-text-muted">
                        {divEfficiency}% eff.
                      </span>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-text-muted" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-text-muted" />
                    )}
                  </div>
                </div>

                {/* Mini agent status row */}
                <div className="flex items-center gap-1.5 mt-3 ml-6">
                  {divisionAgents.map((agent) => {
                    const statusColor =
                      agent.status === "active"
                        ? "#08AE67"
                        : agent.status === "error"
                          ? "#EF4444"
                          : "#d1d5db";
                    return (
                      <div
                        key={agent.id}
                        className="w-6 h-6 md:w-7 md:h-7 rounded-full flex items-center justify-center text-[8px] md:text-[9px] font-semibold text-white"
                        style={{ backgroundColor: statusColor }}
                        title={`${agent.shortName} - ${agent.status}`}
                      >
                        {agent.shortName.charAt(0)}
                      </div>
                    );
                  })}
                </div>
              </button>

              {/* Expanded Agent Cards */}
              {isExpanded && (
                <div className="mt-3 space-y-3">
                  {divisionAgents.map((agent) => {
                    const metric = agentMetrics.find(
                      (m) => m.agentId === agent.id
                    );
                    return (
                      <div key={agent.id}>
                        {metric && (
                          <div className="bg-surface rounded-t-xl border border-border border-b-0 px-4 py-2.5 flex items-center gap-4 md:gap-6 overflow-x-auto">
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[10px] text-text-muted">
                                Tasks:
                              </span>
                              <span className="text-[11px] font-medium">
                                {metric.tasksCompleted}/{metric.tasksTotal}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[10px] text-text-muted">
                                Efficiency:
                              </span>
                              <span
                                className="text-[11px] font-medium"
                                style={{
                                  color:
                                    metric.efficiency >= 90
                                      ? "#08AE67"
                                      : metric.efficiency >= 80
                                        ? "#F59E0B"
                                        : "#EF4444",
                                }}
                              >
                                {metric.efficiency}%
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[10px] text-text-muted">
                                Avg Response:
                              </span>
                              <span className="text-[11px] font-medium">
                                {metric.avgResponseTime}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[10px] text-text-muted">
                                Last Active:
                              </span>
                              <span className="text-[11px] font-medium">
                                {metric.lastActive}
                              </span>
                            </div>
                            <div className="flex-1 min-w-[60px]">
                              <div className="h-1.5 bg-border rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${(metric.tasksCompleted / metric.tasksTotal) * 100}%`,
                                    backgroundColor:
                                      metric.efficiency >= 90
                                        ? "#08AE67"
                                        : "#F59E0B",
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        )}
                        <AgentCard agent={agent} />
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
