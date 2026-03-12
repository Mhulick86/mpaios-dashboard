import { agents, divisions } from "@/lib/agents";
import { dashboardKPIs, systemAlerts, serviceMetrics } from "@/lib/metrics";
import { pipelines } from "@/lib/pipelines";
import { KPICard } from "@/components/KPICard";
import { AlertItem } from "@/components/AlertItem";
import { SwarmStatus } from "@/components/SwarmStatus";
import { PerformanceChart } from "@/components/charts/PerformanceChart";
import { ChannelChart } from "@/components/charts/ChannelChart";
import { PipelineCard } from "@/components/PipelineCard";
import {
  Activity,
  ArrowRight,
  Bell,
  Target,
  Globe,
  BarChart3 as BarChartIcon,
  Mail,
  Megaphone,
  Zap as ZapIcon,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  const activeAgents = agents.filter((a) => a.status === "active").length;
  const unreadAlerts = systemAlerts.filter((a) => !a.read).length;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 md:mb-8 gap-3">
        <div>
          <h1 className="text-[20px] md:text-[24px] font-semibold">
            CMO Command Center
          </h1>
          <p className="text-[12px] md:text-[14px] text-text-secondary mt-1">
            Real-time marketing intelligence &middot; {activeAgents} agents active &middot; All systems operational
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/alerts"
            className="relative flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-raised border border-border text-[12px] font-medium hover:border-brand-blue/30 transition-colors"
          >
            <Bell className="w-4 h-4" />
            Alerts
            {unreadAlerts > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-brand-blue text-white text-[10px] font-semibold flex items-center justify-center">
                {unreadAlerts}
              </span>
            )}
          </Link>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-green/10 text-brand-green text-[12px] font-medium">
            <Activity className="w-4 h-4" />
            <span className="hidden sm:inline">System Online</span>
          </div>
        </div>
      </div>

      {/* KPI Grid - max 8 per spec */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
        {dashboardKPIs.map((kpi) => (
          <KPICard key={kpi.label} kpi={kpi} />
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6 md:mb-8">
        <PerformanceChart
          dataKey="revenue"
          title="Revenue Trend (8 Weeks)"
          color="#2CACE8"
        />
        <ChannelChart metric="roas" title="ROAS by Channel" />
      </div>

      {/* Swarm + Alerts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6 md:mb-8">
        {/* Agent Swarm - wider */}
        <div className="lg:col-span-3">
          <SwarmStatus />
        </div>

        {/* Recent Alerts */}
        <div className="lg:col-span-2">
          <div className="bg-surface-raised rounded-xl border border-border p-4 md:p-5 h-full">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[13px] md:text-[14px] font-semibold">
                Recent Alerts
              </h3>
              <Link
                href="/alerts"
                className="text-[11px] text-brand-blue hover:underline flex items-center gap-1"
              >
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="space-y-1">
              {systemAlerts.slice(0, 5).map((alert) => (
                <AlertItem key={alert.id} alert={alert} compact />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row: Performance + Active Pipelines */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6 md:mb-8">
        <PerformanceChart
          dataKey="conversions"
          title="Conversion Trend"
          color="#08AE67"
        />
        <div>
          <h3 className="text-[13px] md:text-[14px] font-semibold mb-3">
            Active Pipelines
          </h3>
          <div className="space-y-3">
            {pipelines
              .filter((p) => p.status === "running")
              .slice(0, 2)
              .map((pipeline) => (
                <PipelineCard key={pipeline.id} pipeline={pipeline} />
              ))}
            {pipelines.filter((p) => p.status === "running").length === 0 && (
              <div className="bg-surface-raised rounded-xl border border-border p-6 text-center">
                <p className="text-[13px] text-text-muted">
                  No pipelines currently running
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Services Intelligence */}
      <div className="mb-6 md:mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[16px] md:text-[18px] font-semibold">
            Services Intelligence
          </h2>
          <Link
            href="/campaigns"
            className="text-[11px] text-brand-blue hover:underline flex items-center gap-1"
          >
            View all campaigns <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {serviceMetrics.map((svc) => {
            const iconMap: Record<string, React.ElementType> = {
              target: Target,
              globe: Globe,
              "bar-chart": BarChartIcon,
              mail: Mail,
              megaphone: Megaphone,
              zap: ZapIcon,
            };
            const Icon = iconMap[svc.icon] || Target;
            return (
              <Link
                key={svc.service}
                href="/campaigns"
                className="bg-surface-raised rounded-xl border border-border p-4 md:p-5 hover:border-brand-blue/20 transition-colors group"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${svc.color}15` }}
                  >
                    <Icon className="w-4 h-4" style={{ color: svc.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[13px] font-semibold truncate group-hover:text-brand-blue transition-colors">
                      {svc.service}
                    </h3>
                    <span className="text-[11px] text-text-muted">
                      {svc.activeCampaigns} active campaigns
                    </span>
                  </div>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-[10px] text-text-muted uppercase tracking-wide">
                      {svc.topKPI}
                    </div>
                    <div className="text-[18px] font-semibold">{svc.topKPIValue}</div>
                  </div>
                  <div className="flex items-center gap-1 text-brand-green text-[12px] font-medium">
                    <TrendingUp className="w-3.5 h-3.5" />
                    {svc.trendValue}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Division Performance Summary */}
      <div className="mb-8">
        <h2 className="text-[16px] md:text-[18px] font-semibold mb-4">
          Division Overview
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {divisions.map((div) => {
            const divAgents = agents.filter((a) => a.divisionId === div.id);
            const activeCount = divAgents.filter(
              (a) => a.status === "active"
            ).length;
            return (
              <Link
                key={div.id}
                href="/agents"
                className="bg-surface-raised rounded-xl border border-border p-5 hover:border-brand-blue/30 transition-colors group"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: div.color }}
                  />
                  <h3 className="text-[13px] md:text-[14px] font-semibold group-hover:text-brand-blue transition-colors">
                    {div.name}
                  </h3>
                </div>
                <p className="text-[11px] md:text-[12px] text-text-secondary leading-relaxed mb-3">
                  {div.scope}
                </p>
                <div className="flex items-center gap-4 text-[11px] text-text-muted">
                  <span>{div.agentCount} agents</span>
                  <span>{activeCount} active</span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
