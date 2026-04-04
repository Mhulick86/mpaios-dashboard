import type { ReactNode } from "react";

interface StatsCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  color?: string;
}

export function StatsCard({ label, value, subtitle, icon, color = "#2CACE8" }: StatsCardProps) {
  return (
    <div className="bg-surface-raised rounded-xl border border-border p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[12px] font-medium text-text-secondary uppercase tracking-wider">
            {label}
          </p>
          <p className="text-[28px] font-semibold mt-1 leading-tight">{value}</p>
          {subtitle && (
            <p className="text-[12px] text-text-muted mt-1">{subtitle}</p>
          )}
        </div>
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${color}15` }}
        >
          <div style={{ color }}>{icon}</div>
        </div>
      </div>
    </div>
  );
}
