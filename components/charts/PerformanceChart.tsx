"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { campaignTimeline } from "@/lib/metrics";

interface PerformanceChartProps {
  dataKey?: "revenue" | "conversions" | "clicks" | "impressions";
  title?: string;
  color?: string;
}

export function PerformanceChart({
  dataKey = "revenue",
  title = "Revenue Trend",
  color = "#2CACE8",
}: PerformanceChartProps) {
  const formatValue = (val: number) => {
    if (dataKey === "revenue" || dataKey === "impressions") {
      if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
      if (val >= 1000) return `${(val / 1000).toFixed(0)}K`;
    }
    return val.toLocaleString();
  };

  return (
    <div className="bg-surface-raised rounded-xl border border-border p-4 md:p-5">
      <h3 className="text-[13px] md:text-[14px] font-semibold mb-4">
        {title}
      </h3>
      <div className="h-[200px] md:h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={campaignTimeline}>
            <defs>
              <linearGradient id={`gradient-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.2} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb20" />
            <XAxis
              dataKey="date"
              tick={{ fill: "#9ca3af", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={formatValue}
              tick={{ fill: "#9ca3af", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={50}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#ffffff",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              formatter={(value) => [formatValue(Number(value)), dataKey]}
            />
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={2}
              fill={`url(#gradient-${dataKey})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
