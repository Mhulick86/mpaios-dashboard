import type { Alert } from "@/lib/metrics";
import { getAlertColor } from "@/lib/metrics";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
} from "lucide-react";

interface AlertItemProps {
  alert: Alert;
  compact?: boolean;
}

function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const alertIcons = {
  success: CheckCircle2,
  warning: AlertTriangle,
  critical: XCircle,
  info: Info,
};

export function AlertItem({ alert, compact }: AlertItemProps) {
  const color = getAlertColor(alert.type);
  const Icon = alertIcons[alert.type];

  if (compact) {
    return (
      <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-surface transition-colors">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
          style={{ backgroundColor: `${color}15` }}
        >
          <Icon className="w-3.5 h-3.5" style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[12px] font-medium truncate">{alert.title}</p>
            {!alert.read && (
              <div className="w-1.5 h-1.5 rounded-full bg-brand-blue shrink-0" />
            )}
          </div>
          <p className="text-[11px] text-text-muted mt-0.5">
            {alert.agent} &middot; {timeAgo(alert.timestamp)}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="bg-surface-raised rounded-xl border border-border p-4 md:p-5 hover:border-brand-blue/30 transition-colors"
      style={{ borderLeftColor: color, borderLeftWidth: 3 }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${color}15` }}
        >
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[13px] md:text-[14px] font-semibold">
                {alert.title}
              </p>
              <p className="text-[12px] text-text-secondary mt-1 leading-relaxed">
                {alert.message}
              </p>
            </div>
            {!alert.read && (
              <div className="w-2 h-2 rounded-full bg-brand-blue shrink-0 mt-1.5" />
            )}
          </div>
          <div className="flex items-center gap-3 mt-3 text-[11px] text-text-muted">
            <span>{alert.agent}</span>
            <span>&middot;</span>
            <span>{alert.division}</span>
            <span>&middot;</span>
            <span>{timeAgo(alert.timestamp)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
