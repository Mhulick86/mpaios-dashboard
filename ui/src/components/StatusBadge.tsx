import type { AgentStatus } from "@/lib/agents";
import type { PipelineStatus } from "@/lib/pipelines";

type BadgeStatus = AgentStatus | PipelineStatus;

const statusConfig: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  active: { bg: "bg-brand-green/10", text: "text-brand-green", dot: "bg-brand-green", label: "Active" },
  running: { bg: "bg-brand-blue/10", text: "text-brand-blue", dot: "bg-brand-blue", label: "Running" },
  idle: { bg: "bg-gray-100", text: "text-gray-500", dot: "bg-gray-400", label: "Idle" },
  ready: { bg: "bg-gray-100", text: "text-gray-500", dot: "bg-gray-400", label: "Ready" },
  completed: { bg: "bg-brand-green/10", text: "text-brand-green", dot: "bg-brand-green", label: "Completed" },
  error: { bg: "bg-red-50", text: "text-red-600", dot: "bg-red-500", label: "Error" },
};

export function StatusBadge({ status }: { status: BadgeStatus }) {
  const config = statusConfig[status] || statusConfig.idle;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${config.bg} ${config.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot} ${status === "running" || status === "active" ? "animate-pulse" : ""}`} />
      {config.label}
    </span>
  );
}
