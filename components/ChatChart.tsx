"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

export interface ChartData {
  type: "line" | "bar" | "area" | "pie";
  title: string;
  data: Record<string, unknown>[];
  xKey?: string;
  series: { key: string; label?: string; color?: string }[];
}

const COLORS = [
  "#2CACE8",
  "#08AE67",
  "#8B5CF6",
  "#F59E0B",
  "#EF4444",
  "#EC4899",
  "#06B6D4",
  "#10B981",
];

function formatValue(value: unknown): string {
  const num = Number(value);
  if (isNaN(num)) return String(value);
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + "M";
  if (num >= 1_000) return (num / 1_000).toFixed(1) + "K";
  return num.toLocaleString();
}

/** Try to sort data chronologically if xKey values look like dates */
function sortByDateIfNeeded(
  data: Record<string, unknown>[],
  xKey: string
): Record<string, unknown>[] {
  if (data.length < 2) return data;

  // Check if the first value parses as a date
  const sample = String(data[0][xKey] ?? "");
  const parsed = Date.parse(sample);
  if (isNaN(parsed)) return data; // not a date — keep original order

  // All values parse as dates → sort ascending (oldest first)
  return [...data].sort((a, b) => {
    const da = Date.parse(String(a[xKey] ?? ""));
    const db = Date.parse(String(b[xKey] ?? ""));
    return da - db;
  });
}

export function ChatChart({ chart }: { chart: ChartData }) {
  const { type, title, data: rawData, xKey = "label", series } = chart;

  if (!rawData || rawData.length === 0) return null;

  // Sort chronologically when xKey values are dates
  const data = sortByDateIfNeeded(rawData, xKey);

  const tooltipStyle = {
    backgroundColor: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    fontSize: "12px",
    boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
  };

  return (
    <div className="my-3 bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-gray-200 bg-white">
        <h4 className="text-[13px] font-semibold text-gray-800">{title}</h4>
      </div>
      <div className="p-3" style={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          {type === "line" ? (
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb40" />
              <XAxis
                dataKey={xKey}
                tick={{ fill: "#9ca3af", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#9ca3af", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => formatValue(v)}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value) => [formatValue(value), ""]}
              />
              {series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
              {series.map((s, i) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label || s.key}
                  stroke={s.color || COLORS[i % COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 3, fill: s.color || COLORS[i % COLORS.length] }}
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          ) : type === "bar" ? (
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb40" />
              <XAxis
                dataKey={xKey}
                tick={{ fill: "#9ca3af", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#9ca3af", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => formatValue(v)}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value) => [formatValue(value), ""]}
              />
              {series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
              {series.map((s, i) => (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  name={s.label || s.key}
                  fill={s.color || COLORS[i % COLORS.length]}
                  radius={[4, 4, 0, 0]}
                />
              ))}
            </BarChart>
          ) : type === "area" ? (
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb40" />
              <XAxis
                dataKey={xKey}
                tick={{ fill: "#9ca3af", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#9ca3af", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => formatValue(v)}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value) => [formatValue(value), ""]}
              />
              {series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
              {series.map((s, i) => (
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label || s.key}
                  stroke={s.color || COLORS[i % COLORS.length]}
                  fill={(s.color || COLORS[i % COLORS.length]) + "30"}
                  strokeWidth={2}
                />
              ))}
            </AreaChart>
          ) : (
            <PieChart>
              <Pie
                data={data}
                dataKey={series[0]?.key || "value"}
                nameKey={xKey}
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={({ name, value }) => `${name}: ${formatValue(value)}`}
                labelLine={{ stroke: "#9ca3af" }}
              >
                {data.map((_, i) => (
                  <Cell
                    key={i}
                    fill={COLORS[i % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value) => [formatValue(value), ""]}
              />
            </PieChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/**
 * Parse [CHART:type:title]...json...[/CHART] blocks from message content.
 * Returns segments: either { text: string } or { chart: ChartData }.
 */
export type ContentSegment =
  | { type: "text"; content: string }
  | { type: "chart"; chart: ChartData };

export function parseChartBlocks(content: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  const regex = /\[CHART:(line|bar|area|pie):([^\]]*)\]\s*([\s\S]*?)\s*\[\/CHART\]/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(content)) !== null) {
    // Text before this chart
    if (match.index > lastIndex) {
      segments.push({ type: "text", content: content.slice(lastIndex, match.index) });
    }

    const chartType = match[1] as ChartData["type"];
    const chartTitle = match[2].trim();
    const jsonStr = match[3].trim();

    try {
      const parsed = JSON.parse(jsonStr);

      // Support two formats:
      // 1. Full format: { data: [...], xKey: "...", series: [...] }
      // 2. Simple format: [{ label: "...", value: N }, ...] — auto-detect keys
      let chartData: ChartData;

      if (Array.isArray(parsed)) {
        // Simple array format — auto-detect
        const keys = Object.keys(parsed[0] || {});
        const xKey = keys.find(
          (k) => typeof parsed[0][k] === "string"
        ) || keys[0] || "label";
        const valueKeys = keys.filter(
          (k) => k !== xKey && typeof parsed[0][k] === "number"
        );
        chartData = {
          type: chartType,
          title: chartTitle,
          data: parsed,
          xKey,
          series: valueKeys.map((k, i) => ({
            key: k,
            label: k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, " "),
            color: COLORS[i % COLORS.length],
          })),
        };
      } else {
        // Full format
        chartData = {
          type: chartType,
          title: chartTitle,
          data: parsed.data || [],
          xKey: parsed.xKey || "label",
          series: parsed.series || [{ key: "value", label: "Value" }],
        };
      }

      segments.push({ type: "chart", chart: chartData });
    } catch {
      // If JSON parsing fails, treat as text
      segments.push({ type: "text", content: match[0] });
    }

    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < content.length) {
    segments.push({ type: "text", content: content.slice(lastIndex) });
  }

  return segments;
}
