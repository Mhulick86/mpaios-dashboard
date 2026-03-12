"use client";

import { useState } from "react";
import {
  channelPerformance,
  campaignTimeline,
  sentimentTimeline,
  leadFunnel,
  formatNumber,
} from "@/lib/metrics";
import { PerformanceChart } from "@/components/charts/PerformanceChart";
import { ChannelChart } from "@/components/charts/ChannelChart";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

type Tab = "overview" | "channels" | "funnel" | "sentiment";

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "channels", label: "Channels" },
    { id: "funnel", label: "Lead Funnel" },
    { id: "sentiment", label: "Sentiment" },
  ];

  return (
    <div>
      <div className="mb-6 md:mb-8">
        <h1 className="text-[20px] md:text-[24px] font-semibold">Analytics</h1>
        <p className="text-[12px] md:text-[14px] text-text-secondary mt-1">
          Cross-channel campaign performance, budget efficiency, and market intelligence
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-6 overflow-x-auto pb-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-[12px] md:text-[13px] font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? "bg-brand-blue text-white"
                : "bg-surface-raised border border-border text-text-secondary hover:text-text-primary"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && <OverviewTab />}
      {activeTab === "channels" && <ChannelsTab />}
      {activeTab === "funnel" && <FunnelTab />}
      {activeTab === "sentiment" && <SentimentTab />}
    </div>
  );
}

function OverviewTab() {
  // Compute totals
  const totalSpend = channelPerformance.reduce((s, c) => s + c.spend, 0);
  const totalRevenue = channelPerformance.reduce((s, c) => s + c.revenue, 0);
  const totalConversions = channelPerformance.reduce((s, c) => s + c.conversions, 0);
  const blendedROAS = totalRevenue / totalSpend;
  const blendedCPA = totalSpend / totalConversions;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: "Total Spend", value: `$${formatNumber(totalSpend)}` },
          { label: "Total Revenue", value: `$${formatNumber(totalRevenue)}` },
          { label: "Blended ROAS", value: `${blendedROAS.toFixed(1)}x` },
          { label: "Blended CPA", value: `$${blendedCPA.toFixed(2)}` },
          { label: "Conversions", value: formatNumber(totalConversions) },
        ].map((card) => (
          <div
            key={card.label}
            className="bg-surface-raised rounded-xl border border-border p-4"
          >
            <p className="text-[10px] md:text-[11px] font-medium text-text-muted uppercase tracking-wider">
              {card.label}
            </p>
            <p className="text-[20px] md:text-[24px] font-semibold mt-1">
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PerformanceChart dataKey="revenue" title="Revenue Trend" color="#2CACE8" />
        <PerformanceChart dataKey="conversions" title="Conversions Trend" color="#08AE67" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PerformanceChart dataKey="clicks" title="Click Trend" color="#8B5CF6" />
        <ChannelChart metric="spend" title="Spend by Channel" />
      </div>
    </div>
  );
}

function ChannelsTab() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChannelChart metric="roas" title="ROAS by Channel" />
        <ChannelChart metric="revenue" title="Revenue by Channel" />
      </div>
      <ChannelChart metric="conversions" title="Conversions by Channel" />

      {/* Channel Table */}
      <div className="bg-surface-raised rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px] md:text-[13px]">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-3 md:p-4 font-medium text-text-muted">Channel</th>
                <th className="text-right p-3 md:p-4 font-medium text-text-muted">Spend</th>
                <th className="text-right p-3 md:p-4 font-medium text-text-muted">Revenue</th>
                <th className="text-right p-3 md:p-4 font-medium text-text-muted">ROAS</th>
                <th className="text-right p-3 md:p-4 font-medium text-text-muted">CPA</th>
                <th className="text-right p-3 md:p-4 font-medium text-text-muted">Conv.</th>
              </tr>
            </thead>
            <tbody>
              {channelPerformance.map((ch) => (
                <tr key={ch.channel} className="border-b border-border last:border-0 hover:bg-surface transition-colors">
                  <td className="p-3 md:p-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ch.color }} />
                      <span className="font-medium">{ch.channel}</span>
                    </div>
                  </td>
                  <td className="text-right p-3 md:p-4">${ch.spend.toLocaleString()}</td>
                  <td className="text-right p-3 md:p-4">${ch.revenue.toLocaleString()}</td>
                  <td className="text-right p-3 md:p-4">
                    <span className={ch.roas >= 4 ? "text-brand-green font-medium" : ""}>
                      {ch.roas}x
                    </span>
                  </td>
                  <td className="text-right p-3 md:p-4">${ch.cpa.toFixed(2)}</td>
                  <td className="text-right p-3 md:p-4">{ch.conversions.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function FunnelTab() {
  const maxValue = leadFunnel[0].value;
  const funnelColors = ["#2CACE8", "#3B82F6", "#8B5CF6", "#A855F7", "#EC4899", "#08AE67"];

  return (
    <div className="space-y-6">
      <div className="bg-surface-raised rounded-xl border border-border p-4 md:p-6">
        <h3 className="text-[14px] font-semibold mb-6">Lead Conversion Funnel</h3>
        <div className="space-y-3">
          {leadFunnel.map((stage, i) => {
            const widthPct = (stage.value / maxValue) * 100;
            const conversionRate =
              i > 0
                ? ((stage.value / leadFunnel[i - 1].value) * 100).toFixed(1)
                : "100";
            return (
              <div key={stage.stage}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[12px] md:text-[13px] font-medium">{stage.stage}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-[12px] text-text-muted">
                      {i > 0 && `${conversionRate}% conv.`}
                    </span>
                    <span className="text-[13px] font-semibold">
                      {formatNumber(stage.value)}
                    </span>
                  </div>
                </div>
                <div className="h-8 bg-surface rounded-lg overflow-hidden">
                  <div
                    className="h-full rounded-lg transition-all duration-500 flex items-center justify-end pr-3"
                    style={{
                      width: `${Math.max(widthPct, 5)}%`,
                      backgroundColor: funnelColors[i],
                    }}
                  >
                    {widthPct > 15 && (
                      <span className="text-[10px] font-medium text-white">
                        {formatNumber(stage.value)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Funnel metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-surface-raised rounded-xl border border-border p-4">
          <p className="text-[10px] text-text-muted uppercase tracking-wider">Click-to-Lead</p>
          <p className="text-[20px] font-semibold mt-1">
            {((leadFunnel[2].value / leadFunnel[1].value) * 100).toFixed(1)}%
          </p>
        </div>
        <div className="bg-surface-raised rounded-xl border border-border p-4">
          <p className="text-[10px] text-text-muted uppercase tracking-wider">Lead-to-MQL</p>
          <p className="text-[20px] font-semibold mt-1">
            {((leadFunnel[3].value / leadFunnel[2].value) * 100).toFixed(1)}%
          </p>
        </div>
        <div className="bg-surface-raised rounded-xl border border-border p-4">
          <p className="text-[10px] text-text-muted uppercase tracking-wider">MQL-to-SQL</p>
          <p className="text-[20px] font-semibold mt-1">
            {((leadFunnel[4].value / leadFunnel[3].value) * 100).toFixed(1)}%
          </p>
        </div>
        <div className="bg-surface-raised rounded-xl border border-border p-4">
          <p className="text-[10px] text-text-muted uppercase tracking-wider">SQL-to-Customer</p>
          <p className="text-[20px] font-semibold mt-1">
            {((leadFunnel[5].value / leadFunnel[4].value) * 100).toFixed(1)}%
          </p>
        </div>
      </div>
    </div>
  );
}

function SentimentTab() {
  return (
    <div className="space-y-6">
      <div className="bg-surface-raised rounded-xl border border-border p-4 md:p-5">
        <h3 className="text-[14px] font-semibold mb-4">Brand Sentiment Over Time</h3>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sentimentTimeline}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb20" />
              <XAxis
                dataKey="date"
                tick={{ fill: "#9ca3af", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#9ca3af", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                domain={[0, 100]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#ffffff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Area type="monotone" dataKey="positive" stackId="1" stroke="#08AE67" fill="#08AE6730" />
              <Area type="monotone" dataKey="neutral" stackId="1" stroke="#F59E0B" fill="#F59E0B30" />
              <Area type="monotone" dataKey="negative" stackId="1" stroke="#EF4444" fill="#EF444430" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center justify-center gap-6 mt-3">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-brand-green" />
            <span className="text-[11px] text-text-muted">Positive</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#F59E0B" }} />
            <span className="text-[11px] text-text-muted">Neutral</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#EF4444" }} />
            <span className="text-[11px] text-text-muted">Negative</span>
          </div>
        </div>
      </div>

      {/* Sentiment summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Positive", value: "85%", change: "+7%", color: "#08AE67" },
          { label: "Neutral", value: "12%", change: "-5%", color: "#F59E0B" },
          { label: "Negative", value: "3%", change: "-2%", color: "#EF4444" },
        ].map((item) => (
          <div
            key={item.label}
            className="bg-surface-raised rounded-xl border border-border p-4"
            style={{ borderTopColor: item.color, borderTopWidth: 3 }}
          >
            <p className="text-[11px] text-text-muted uppercase tracking-wider">{item.label}</p>
            <p className="text-[24px] font-semibold mt-1">{item.value}</p>
            <p className="text-[11px] mt-1" style={{ color: item.color }}>
              {item.change} vs last period
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
