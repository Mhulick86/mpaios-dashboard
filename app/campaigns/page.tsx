"use client";

import { useState } from "react";
import {
  Megaphone,
  Plus,
  Search,
  Filter,
  ArrowRight,
  Clock,
  Users,
  BarChart3,
  Target,
  Zap,
  Globe,
  Mail,
  Video,
  FileText,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Pause,
} from "lucide-react";

type CampaignStatus = "active" | "draft" | "paused" | "completed";
type ServiceCategory =
  | "all"
  | "paid-media"
  | "seo-llmo"
  | "content"
  | "email"
  | "social"
  | "web";

interface Campaign {
  id: string;
  name: string;
  client: string;
  vertical: string;
  service: ServiceCategory;
  serviceLabel: string;
  status: CampaignStatus;
  startDate: string;
  budget: string;
  kpi: string;
  kpiValue: string;
  kpiTrend: "up" | "down" | "flat";
  agentsAssigned: number;
  pipelineId: number | null;
  description: string;
}

const serviceTabs: { value: ServiceCategory; label: string; icon: React.ElementType }[] = [
  { value: "all", label: "All Campaigns", icon: Megaphone },
  { value: "paid-media", label: "Paid Media", icon: Target },
  { value: "seo-llmo", label: "SEO & LLMO", icon: Globe },
  { value: "content", label: "Content", icon: FileText },
  { value: "email", label: "Email & Automation", icon: Mail },
  { value: "social", label: "Social Media", icon: Users },
  { value: "web", label: "Web & Landing Pages", icon: Zap },
];

const campaigns: Campaign[] = [
  {
    id: "c1",
    name: "Mental Health PPC - Q1 Intake Drive",
    client: "Serenity Wellness Center",
    vertical: "Mental Health",
    service: "paid-media",
    serviceLabel: "Paid Media Advertising",
    status: "active",
    startDate: "2026-01-15",
    budget: "$12,500/mo",
    kpi: "Cost per Intake",
    kpiValue: "$38.20",
    kpiTrend: "down",
    agentsAssigned: 4,
    pipelineId: 1,
    description: "Google Ads + Meta Ads campaigns targeting therapy intake appointments in the DFW metro area.",
  },
  {
    id: "c2",
    name: "Behavioral Health Authority Content",
    client: "Recovery Path Centers",
    vertical: "Behavioral Health",
    service: "content",
    serviceLabel: "SEO & Content (LLMO)",
    status: "active",
    startDate: "2026-02-01",
    budget: "$5,000/mo",
    kpi: "Organic Sessions",
    kpiValue: "+42%",
    kpiTrend: "up",
    agentsAssigned: 3,
    pipelineId: 2,
    description: "Authority content engine producing 4 long-form articles/month optimized for AI search visibility.",
  },
  {
    id: "c3",
    name: "AI Visibility & LLMO Optimization",
    client: "MindBridge Therapy Group",
    vertical: "Mental Health",
    service: "seo-llmo",
    serviceLabel: "LLMO & AI Search",
    status: "active",
    startDate: "2026-02-15",
    budget: "$3,500/mo",
    kpi: "AI Citations",
    kpiValue: "23 mentions",
    kpiTrend: "up",
    agentsAssigned: 2,
    pipelineId: 6,
    description: "Optimizing content structure so client appears in ChatGPT, Claude, and Perplexity responses.",
  },
  {
    id: "c4",
    name: "Lead Nurture Email Automation",
    client: "Serenity Wellness Center",
    vertical: "Mental Health",
    service: "email",
    serviceLabel: "Marketing Automation",
    status: "active",
    startDate: "2026-01-20",
    budget: "$2,000/mo",
    kpi: "Email-to-Booking Rate",
    kpiValue: "8.4%",
    kpiTrend: "up",
    agentsAssigned: 2,
    pipelineId: 7,
    description: "6-email nurture sequence for new leads with behavioral triggers and appointment booking CTAs.",
  },
  {
    id: "c5",
    name: "Social Media Brand Presence",
    client: "Recovery Path Centers",
    vertical: "Behavioral Health",
    service: "social",
    serviceLabel: "Social Media Management",
    status: "active",
    startDate: "2026-01-10",
    budget: "$3,000/mo",
    kpi: "Engagement Rate",
    kpiValue: "4.7%",
    kpiTrend: "up",
    agentsAssigned: 2,
    pipelineId: null,
    description: "Organic social content calendar across Instagram, Facebook, and LinkedIn with community management.",
  },
  {
    id: "c6",
    name: "Conversion Landing Page Rebuild",
    client: "MindBridge Therapy Group",
    vertical: "Mental Health",
    service: "web",
    serviceLabel: "Web Design & Development",
    status: "draft",
    startDate: "2026-03-15",
    budget: "$8,000",
    kpi: "Conversion Rate",
    kpiValue: "Target: 12%",
    kpiTrend: "flat",
    agentsAssigned: 2,
    pipelineId: null,
    description: "Redesigning 5 core landing pages with mobile-first approach, A/B test variants, and quiz funnel.",
  },
  {
    id: "c7",
    name: "Google Ads - Rehab Admissions",
    client: "Recovery Path Centers",
    vertical: "Behavioral Health",
    service: "paid-media",
    serviceLabel: "Paid Media Advertising",
    status: "paused",
    startDate: "2025-11-01",
    budget: "$15,000/mo",
    kpi: "Cost per Admission",
    kpiValue: "$142",
    kpiTrend: "flat",
    agentsAssigned: 3,
    pipelineId: 3,
    description: "Search and Performance Max campaigns for addiction treatment admissions. Paused for Q1 budget review.",
  },
  {
    id: "c8",
    name: "Thought Leadership Video Series",
    client: "Serenity Wellness Center",
    vertical: "Mental Health",
    service: "content",
    serviceLabel: "Content & Video Production",
    status: "completed",
    startDate: "2025-10-01",
    budget: "$4,500",
    kpi: "Views",
    kpiValue: "28.4K",
    kpiTrend: "up",
    agentsAssigned: 3,
    pipelineId: null,
    description: "6-part YouTube Shorts series on anxiety management tips featuring client's lead therapist.",
  },
];

const statusConfig: Record<CampaignStatus, { color: string; bg: string; icon: React.ElementType; label: string }> = {
  active: { color: "text-brand-green", bg: "bg-brand-green/10", icon: CheckCircle2, label: "Active" },
  draft: { color: "text-brand-blue", bg: "bg-brand-blue/10", icon: FileText, label: "Draft" },
  paused: { color: "text-amber-500", bg: "bg-amber-500/10", icon: Pause, label: "Paused" },
  completed: { color: "text-gray-400", bg: "bg-gray-100", icon: CheckCircle2, label: "Completed" },
};

export default function CampaignsPage() {
  const [activeTab, setActiveTab] = useState<ServiceCategory>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = campaigns.filter((c) => {
    const matchesTab = activeTab === "all" || c.service === activeTab;
    const matchesSearch =
      !searchQuery ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.client.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.vertical.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const activeCampaigns = campaigns.filter((c) => c.status === "active").length;
  const totalBudget = "$41,000";

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 md:mb-8 gap-3">
        <div>
          <h1 className="text-[20px] md:text-[24px] font-semibold">Campaigns</h1>
          <p className="text-[12px] md:text-[14px] text-text-secondary mt-1">
            {activeCampaigns} active campaigns &middot; {totalBudget}/mo managed &middot; All services
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand-blue text-white text-[13px] font-medium hover:bg-brand-blue-dark transition-colors">
          <Plus className="w-4 h-4" />
          New Campaign
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
        <div className="bg-surface-raised rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-brand-blue" />
            <span className="text-[11px] text-text-muted font-medium uppercase tracking-wide">Active</span>
          </div>
          <div className="text-[22px] font-semibold">{activeCampaigns}</div>
          <div className="text-[11px] text-text-secondary mt-0.5">campaigns running</div>
        </div>
        <div className="bg-surface-raised rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-4 h-4 text-brand-green" />
            <span className="text-[11px] text-text-muted font-medium uppercase tracking-wide">Budget</span>
          </div>
          <div className="text-[22px] font-semibold">{totalBudget}</div>
          <div className="text-[11px] text-text-secondary mt-0.5">monthly managed</div>
        </div>
        <div className="bg-surface-raised rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-purple-500" />
            <span className="text-[11px] text-text-muted font-medium uppercase tracking-wide">Clients</span>
          </div>
          <div className="text-[22px] font-semibold">3</div>
          <div className="text-[11px] text-text-secondary mt-0.5">active clients</div>
        </div>
        <div className="bg-surface-raised rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-amber-500" />
            <span className="text-[11px] text-text-muted font-medium uppercase tracking-wide">Agents</span>
          </div>
          <div className="text-[22px] font-semibold">16</div>
          <div className="text-[11px] text-text-secondary mt-0.5">assigned to campaigns</div>
        </div>
      </div>

      {/* Service Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-4 scrollbar-none">
        {serviceTabs.map((tab) => {
          const Icon = tab.icon;
          const count = tab.value === "all" ? campaigns.length : campaigns.filter((c) => c.service === tab.value).length;
          return (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.value
                  ? "bg-brand-blue/10 text-brand-blue border border-brand-blue/20"
                  : "bg-surface-raised border border-border text-text-secondary hover:border-brand-blue/20"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                activeTab === tab.value ? "bg-brand-blue/20" : "bg-gray-100"
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
        <input
          type="text"
          placeholder="Search campaigns, clients, or verticals..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-surface-raised border border-border text-[13px] focus:outline-none focus:border-brand-blue/50"
        />
      </div>

      {/* Campaign Cards */}
      <div className="space-y-3">
        {filtered.map((campaign) => {
          const status = statusConfig[campaign.status];
          const StatusIcon = status.icon;
          return (
            <div
              key={campaign.id}
              className="bg-surface-raised rounded-xl border border-border p-4 md:p-5 hover:border-brand-blue/20 transition-colors"
            >
              <div className="flex flex-col md:flex-row md:items-start gap-3 md:gap-4">
                {/* Main Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <h3 className="text-[14px] font-semibold truncate">{campaign.name}</h3>
                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${status.bg} ${status.color}`}>
                      <StatusIcon className="w-3 h-3" />
                      {status.label}
                    </span>
                  </div>
                  <p className="text-[12px] text-text-secondary mb-2">{campaign.description}</p>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-[11px] text-text-muted flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {campaign.client}
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 font-medium">
                      {campaign.vertical}
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-brand-blue font-medium">
                      {campaign.serviceLabel}
                    </span>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 md:gap-6 shrink-0">
                  <div className="text-right">
                    <div className="text-[10px] text-text-muted uppercase tracking-wide">{campaign.kpi}</div>
                    <div className="text-[15px] font-semibold flex items-center gap-1 justify-end">
                      {campaign.kpiValue}
                      {campaign.kpiTrend === "up" && <TrendingUp className="w-3.5 h-3.5 text-brand-green" />}
                      {campaign.kpiTrend === "down" && <TrendingUp className="w-3.5 h-3.5 text-brand-green rotate-180" />}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-text-muted uppercase tracking-wide">Budget</div>
                    <div className="text-[13px] font-medium">{campaign.budget}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-text-muted uppercase tracking-wide">Agents</div>
                    <div className="text-[13px] font-medium">{campaign.agentsAssigned}</div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="bg-surface-raised rounded-xl border border-border p-12 text-center">
          <AlertCircle className="w-8 h-8 text-text-muted mx-auto mb-3" />
          <p className="text-[14px] text-text-muted">No campaigns match your filters</p>
        </div>
      )}
    </div>
  );
}
