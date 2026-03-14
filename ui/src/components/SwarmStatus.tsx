"use client";

import { agents, divisions, getAgentsByDivision } from "@/lib/agents";
import { agentMetrics } from "@/lib/metrics";

export function SwarmStatus() {
  const totalTasks = agentMetrics.reduce((sum, m) => sum + m.tasksCompleted, 0);
  const avgEfficiency = Math.round(
    agentMetrics.reduce((sum, m) => sum + m.efficiency, 0) / agentMetrics.length
  );
  const activeCount = agents.filter((a) => a.status === "active").length;

  return (
    <div className="bg-surface-raised rounded-xl border border-border p-4 md:p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[13px] md:text-[14px] font-semibold">
          Agent Swarm Status
        </h3>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-brand-green animate-pulse" />
          <span className="text-[11px] text-text-muted">
            {activeCount} active &middot; {agents.length} total
          </span>
        </div>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center p-2 rounded-lg bg-surface">
          <p className="text-[18px] font-semibold">{totalTasks}</p>
          <p className="text-[10px] text-text-muted uppercase tracking-wider">Tasks Done</p>
        </div>
        <div className="text-center p-2 rounded-lg bg-surface">
          <p className="text-[18px] font-semibold">{avgEfficiency}%</p>
          <p className="text-[10px] text-text-muted uppercase tracking-wider">Efficiency</p>
        </div>
        <div className="text-center p-2 rounded-lg bg-surface">
          <p className="text-[18px] font-semibold">{agents.length}</p>
          <p className="text-[10px] text-text-muted uppercase tracking-wider">Agents</p>
        </div>
      </div>

      {/* Division breakdown with agent dots */}
      <div className="space-y-3">
        {divisions.map((div) => {
          const divAgents = getAgentsByDivision(div.id);
          return (
            <div key={div.id}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: div.color }}
                  />
                  <span className="text-[11px] md:text-[12px] font-medium">
                    {div.name}
                  </span>
                </div>
                <span className="text-[10px] text-text-muted">
                  {divAgents.length} agents
                </span>
              </div>
              <div className="flex items-center gap-1.5 ml-[18px]">
                {divAgents.map((agent) => {
                  const metric = agentMetrics.find(
                    (m) => m.agentId === agent.id
                  );
                  const statusColor =
                    agent.status === "active"
                      ? "#08AE67"
                      : agent.status === "error"
                        ? "#EF4444"
                        : "#6B7280";
                  return (
                    <div
                      key={agent.id}
                      className="group relative"
                    >
                      <div
                        className="w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center text-[9px] md:text-[10px] font-semibold text-white cursor-default transition-transform hover:scale-110"
                        style={{ backgroundColor: statusColor }}
                        title={`${agent.shortName} - ${agent.status} - ${metric?.efficiency ?? 0}% efficiency`}
                      >
                        {agent.shortName.charAt(0)}
                      </div>
                      {agent.status === "active" && (
                        <div
                          className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white animate-pulse"
                          style={{ backgroundColor: "#08AE67" }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
