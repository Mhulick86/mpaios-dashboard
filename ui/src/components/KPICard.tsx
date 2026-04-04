"use client";

import type { KPI } from "@/lib/metrics";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface KPICardProps {
  kpi: KPI;
}

export function KPICard({ kpi }: KPICardProps) {
  const trendColor =
    kpi.status === "good"
      ? "#08AE67"
      : kpi.status === "warning"
        ? "#F59E0B"
        : "#EF4444";

  const TrendIcon =
    kpi.trend === "up"
      ? TrendingUp
      : kpi.trend === "down"
        ? TrendingDown
        : Minus;

  // For CPA, down is good
  const isPositiveChange =
    kpi.label === "Cost Per Acquisition"
      ? kpi.change < 0
      : kpi.change > 0;

  return (
    <div className="bg-surface-raised rounded-xl border border-border p-4 md:p-5 hover:border-brand-blue/30 transition-colors">
      <p className="text-[11px] md:text-[12px] font-medium text-text-secondary uppercase tracking-wider">
        {kpi.label}
      </p>
      <div className="flex items-end justify-between mt-2">
        <p className="text-[24px] md:text-[28px] font-semibold leading-tight">
          {kpi.value}
        </p>
        <div
          className="flex items-center gap-1 text-[12px] font-medium px-2 py-0.5 rounded-full"
          style={{
            color: trendColor,
            backgroundColor: `${trendColor}12`,
          }}
        >
          <TrendIcon className="w-3 h-3" />
          <span>{Math.abs(kpi.change)}%</span>
        </div>
      </div>
      {/* Mini sparkline */}
      {kpi.sparkline && (
        <div className="mt-3 flex items-end gap-[3px] h-[28px]">
          {kpi.sparkline.map((val, i) => {
            const max = Math.max(...kpi.sparkline!);
            const min = Math.min(...kpi.sparkline!);
            const range = max - min || 1;
            const height = ((val - min) / range) * 100;
            return (
              <div
                key={i}
                className="flex-1 rounded-sm transition-all"
                style={{
                  height: `${Math.max(height, 8)}%`,
                  backgroundColor:
                    i === kpi.sparkline!.length - 1
                      ? trendColor
                      : `${trendColor}30`,
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
