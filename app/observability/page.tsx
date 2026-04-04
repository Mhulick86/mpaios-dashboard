"use client";

import { useState, useEffect } from "react";
import {
  getTokenUsageSummary,
  getAgentPerformance,
  getRecentAuditLog,
  getErrorLog,
} from "@/lib/observability";
import {
  Activity,
  Cpu,
  DollarSign,
  Zap,
  AlertTriangle,
  Clock,
  TrendingUp,
  BarChart3,
} from "lucide-react";

export default function ObservabilityPage() {
  const [usage, setUsage] = useState<Awaited<ReturnType<typeof getTokenUsageSummary>> | null>(null);
  const [agentPerf, setAgentPerf] = useState<Awaited<ReturnType<typeof getAgentPerformance>>>([]);
  const [auditLog, setAuditLog] = useState<Awaited<ReturnType<typeof getRecentAuditLog>>>([]);
  const [errors, setErrors] = useState<Awaited<ReturnType<typeof getErrorLog>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getTokenUsageSummary(30),
      getAgentPerformance(),
      getRecentAuditLog(30),
      getErrorLog(10),
    ]).then(([u, a, al, e]) => {
      setUsage(u);
      setAgentPerf(a);
      setAuditLog(al);
      setErrors(e);
      setLoading(false);
    });
  }, []);

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
          <h1 className="text-[20px] md:text-[24px] font-semibold">Observability</h1>
          <p className="text-[12px] md:text-[14px] text-text-secondary mt-1">
            Token usage, agent performance, audit trail, error monitoring
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-green/10 text-brand-green text-[12px] font-medium">
          <Activity className="w-4 h-4" />
          Live
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-surface-raised rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-brand-blue" />
            <span className="text-[11px] font-medium text-text-secondary uppercase tracking-wider">Total Tokens</span>
          </div>
          <p className="text-[24px] font-semibold">{(usage?.totalTokens ?? 0).toLocaleString()}</p>
        </div>
        <div className="bg-surface-raised rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-brand-green" />
            <span className="text-[11px] font-medium text-text-secondary uppercase tracking-wider">Total Cost</span>
          </div>
          <p className="text-[24px] font-semibold">${(usage?.totalCost ?? 0).toFixed(2)}</p>
        </div>
        <div className="bg-surface-raised rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Cpu className="w-4 h-4 text-div-4" />
            <span className="text-[11px] font-medium text-text-secondary uppercase tracking-wider">Agent Runs</span>
          </div>
          <p className="text-[24px] font-semibold">{agentPerf.reduce((s, a) => s + a.executions, 0)}</p>
        </div>
        <div className="bg-surface-raised rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-div-5" />
            <span className="text-[11px] font-medium text-text-secondary uppercase tracking-wider">Errors</span>
          </div>
          <p className="text-[24px] font-semibold">{errors.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Token Usage by Model */}
        <div className="bg-surface-raised rounded-xl border border-border p-5">
          <h3 className="text-[14px] font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-brand-blue" />
            Token Usage by Model
          </h3>
          {usage && Object.entries(usage.byModel).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(usage.byModel)
                .sort(([, a], [, b]) => b.tokens - a.tokens)
                .map(([model, data]) => (
                  <div key={model}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[12px] font-medium">{model}</span>
                      <span className="text-[11px] text-text-muted">
                        {data.tokens.toLocaleString()} tokens &middot; ${data.cost.toFixed(3)}
                      </span>
                    </div>
                    <div className="h-2 bg-surface rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand-blue rounded-full transition-all"
                        style={{ width: `${Math.min((data.tokens / usage.totalTokens) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-[13px] text-text-muted">No token usage recorded yet. Start a conversation to see metrics here.</p>
          )}
        </div>

        {/* Agent Performance */}
        <div className="bg-surface-raised rounded-xl border border-border p-5">
          <h3 className="text-[14px] font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-brand-green" />
            Agent Performance
          </h3>
          {agentPerf.length > 0 ? (
            <div className="space-y-2">
              {agentPerf
                .sort((a, b) => b.executions - a.executions)
                .slice(0, 10)
                .map((agent) => (
                  <div
                    key={agent.agentId}
                    className="flex items-center gap-3 py-2 border-b border-border last:border-0"
                  >
                    <div className="w-7 h-7 rounded-lg bg-brand-blue/10 flex items-center justify-center text-[11px] font-bold text-brand-blue shrink-0">
                      {String(agent.agentId).padStart(2, "0")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium truncate">{agent.agentName}</p>
                      <p className="text-[10px] text-text-muted">
                        {agent.executions} runs &middot; {agent.avgLatency}ms avg &middot;{" "}
                        {agent.successRate.toFixed(0)}% success
                      </p>
                    </div>
                    <span className="text-[11px] text-text-muted">${agent.totalCost.toFixed(3)}</span>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-[13px] text-text-muted">No agent executions recorded yet.</p>
          )}
        </div>

        {/* Error Log */}
        <div className="bg-surface-raised rounded-xl border border-border p-5">
          <h3 className="text-[14px] font-semibold mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-div-5" />
            Recent Errors
          </h3>
          {errors.length > 0 ? (
            <div className="space-y-2">
              {errors.map((err) => (
                <div key={err.id} className="p-3 rounded-lg bg-red-500/5 border border-red-500/10">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-semibold text-red-400">
                      Agent {String(err.agentId).padStart(2, "0")} - {err.agentName}
                    </span>
                    <span className="text-[10px] text-text-muted">{err.action}</span>
                  </div>
                  <p className="text-[12px] text-text-secondary">{err.error}</p>
                  <p className="text-[10px] text-text-muted mt-1">
                    {new Date(err.startedAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-text-muted text-brand-green">No errors recorded. System running clean.</p>
          )}
        </div>

        {/* Audit Log */}
        <div className="bg-surface-raised rounded-xl border border-border p-5">
          <h3 className="text-[14px] font-semibold mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-div-3" />
            Audit Trail
          </h3>
          {auditLog.length > 0 ? (
            <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
              {auditLog.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-3 py-1.5 border-b border-border last:border-0"
                >
                  <div className="w-2 h-2 rounded-full bg-brand-blue shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-[12px] font-medium">{entry.event_type}</span>
                    {entry.resource_type && (
                      <span className="text-[11px] text-text-muted ml-2">
                        {entry.resource_type}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-text-muted shrink-0">
                    {new Date(entry.created_at).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-text-muted">No audit events recorded yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
