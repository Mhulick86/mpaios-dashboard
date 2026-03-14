"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { channelPerformance } from "@/lib/metrics";

interface ChannelChartProps {
  metric?: "roas" | "spend" | "revenue" | "conversions";
  title?: string;
}

export function ChannelChart({
  metric = "roas",
  title = "ROAS by Channel",
}: ChannelChartProps) {
  const formatValue = (val: number) => {
    if (metric === "spend" || metric === "revenue") {
      if (val >= 1000) return `$${(val / 1000).toFixed(0)}K`;
      return `$${val}`;
    }
    if (metric === "roas") return `${val}x`;
    return val.toLocaleString();
  };

  return (
    <div className="bg-surface-raised rounded-xl border border-border p-4 md:p-5">
      <h3 className="text-[13px] md:text-[14px] font-semibold mb-4">
        {title}
      </h3>
      <div className="h-[200px] md:h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={channelPerformance} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb20" horizontal={false} />
            <XAxis
              type="number"
              tickFormatter={formatValue}
              tick={{ fill: "#9ca3af", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="channel"
              tick={{ fill: "#9ca3af", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={90}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#ffffff",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              formatter={(value) => [formatValue(Number(value)), metric.toUpperCase()]}
            />
            <Bar dataKey={metric} radius={[0, 4, 4, 0]} barSize={20}>
              {channelPerformance.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
