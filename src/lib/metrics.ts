// Mock KPI and metrics data for the CMO Command Center

export interface KPI {
  label: string;
  value: string;
  change: number; // percentage change
  trend: "up" | "down" | "flat";
  status: "good" | "warning" | "critical";
  sparkline?: number[];
}

export interface Alert {
  id: number;
  type: "success" | "warning" | "critical" | "info";
  title: string;
  message: string;
  agent: string;
  division: string;
  timestamp: number;
  read: boolean;
}

export interface CampaignMetric {
  date: string;
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  revenue: number;
}

export interface ChannelPerformance {
  channel: string;
  spend: number;
  revenue: number;
  roas: number;
  cpa: number;
  conversions: number;
  color: string;
}

export interface AgentMetric {
  agentId: number;
  tasksCompleted: number;
  tasksTotal: number;
  efficiency: number;
  lastActive: string;
  avgResponseTime: string;
}

// Top-level KPIs for the CMO dashboard
export const dashboardKPIs: KPI[] = [
  {
    label: "Total Revenue",
    value: "$284,500",
    change: 12.5,
    trend: "up",
    status: "good",
    sparkline: [180, 200, 195, 220, 240, 235, 260, 284],
  },
  {
    label: "ROAS",
    value: "4.2x",
    change: 8.3,
    trend: "up",
    status: "good",
    sparkline: [3.1, 3.4, 3.2, 3.8, 3.9, 4.0, 3.8, 4.2],
  },
  {
    label: "Cost Per Acquisition",
    value: "$24.80",
    change: -6.2,
    trend: "down",
    status: "good",
    sparkline: [32, 30, 28, 29, 27, 26, 25, 24.8],
  },
  {
    label: "Lead Conversion Rate",
    value: "3.8%",
    change: 0.4,
    trend: "up",
    status: "good",
    sparkline: [2.8, 3.0, 3.1, 3.2, 3.4, 3.5, 3.6, 3.8],
  },
  {
    label: "Active Campaigns",
    value: "12",
    change: 2,
    trend: "up",
    status: "good",
  },
  {
    label: "Monthly Ad Spend",
    value: "$67,750",
    change: 5.1,
    trend: "up",
    status: "warning",
    sparkline: [52, 55, 58, 60, 62, 64, 65, 67.7],
  },
  {
    label: "Organic Traffic",
    value: "45.2K",
    change: 18.7,
    trend: "up",
    status: "good",
    sparkline: [28, 30, 33, 35, 38, 40, 42, 45.2],
  },
  {
    label: "Brand Sentiment",
    value: "87%",
    change: 2.1,
    trend: "up",
    status: "good",
    sparkline: [78, 80, 82, 83, 84, 85, 86, 87],
  },
];

// Campaign performance over time (last 8 weeks)
export const campaignTimeline: CampaignMetric[] = [
  { date: "Jan 13", impressions: 245000, clicks: 12400, conversions: 380, spend: 8200, revenue: 32400 },
  { date: "Jan 20", impressions: 262000, clicks: 13100, conversions: 410, spend: 8500, revenue: 35200 },
  { date: "Jan 27", impressions: 258000, clicks: 12800, conversions: 395, spend: 8300, revenue: 33800 },
  { date: "Feb 3", impressions: 280000, clicks: 14200, conversions: 445, spend: 8800, revenue: 38500 },
  { date: "Feb 10", impressions: 295000, clicks: 15100, conversions: 470, spend: 9100, revenue: 40200 },
  { date: "Feb 17", impressions: 310000, clicks: 15800, conversions: 490, spend: 9400, revenue: 42100 },
  { date: "Feb 24", impressions: 305000, clicks: 15500, conversions: 485, spend: 9200, revenue: 41500 },
  { date: "Mar 3", impressions: 328000, clicks: 16800, conversions: 520, spend: 9800, revenue: 44800 },
];

// Channel breakdown
export const channelPerformance: ChannelPerformance[] = [
  { channel: "Meta Ads", spend: 28500, revenue: 125000, roas: 4.4, cpa: 22.5, conversions: 1267, color: "#1877F2" },
  { channel: "Google Ads", spend: 22000, revenue: 98000, roas: 4.5, cpa: 21.8, conversions: 1009, color: "#4285F4" },
  { channel: "TikTok", spend: 8500, revenue: 32000, roas: 3.8, cpa: 28.3, conversions: 300, color: "#FF0050" },
  { channel: "LinkedIn", spend: 5250, revenue: 18500, roas: 3.5, cpa: 35.0, conversions: 150, color: "#0A66C2" },
  { channel: "Organic Search", spend: 2500, revenue: 28000, roas: 11.2, cpa: 8.9, conversions: 281, color: "#08AE67" },
  { channel: "Email", spend: 1000, revenue: 15000, roas: 15.0, cpa: 5.0, conversions: 200, color: "#F59E0B" },
];

// Agent performance metrics
export const agentMetrics: AgentMetric[] = [
  { agentId: 1, tasksCompleted: 24, tasksTotal: 26, efficiency: 92, lastActive: "2 min ago", avgResponseTime: "1.2s" },
  { agentId: 2, tasksCompleted: 18, tasksTotal: 20, efficiency: 90, lastActive: "5 min ago", avgResponseTime: "2.1s" },
  { agentId: 3, tasksCompleted: 31, tasksTotal: 35, efficiency: 89, lastActive: "1 min ago", avgResponseTime: "1.8s" },
  { agentId: 4, tasksCompleted: 45, tasksTotal: 48, efficiency: 94, lastActive: "3 min ago", avgResponseTime: "3.5s" },
  { agentId: 5, tasksCompleted: 22, tasksTotal: 25, efficiency: 88, lastActive: "8 min ago", avgResponseTime: "4.2s" },
  { agentId: 6, tasksCompleted: 15, tasksTotal: 16, efficiency: 94, lastActive: "12 min ago", avgResponseTime: "5.1s" },
  { agentId: 7, tasksCompleted: 38, tasksTotal: 40, efficiency: 95, lastActive: "1 min ago", avgResponseTime: "0.8s" },
  { agentId: 8, tasksCompleted: 35, tasksTotal: 38, efficiency: 92, lastActive: "4 min ago", avgResponseTime: "0.9s" },
  { agentId: 9, tasksCompleted: 20, tasksTotal: 22, efficiency: 91, lastActive: "15 min ago", avgResponseTime: "1.1s" },
  { agentId: 10, tasksCompleted: 28, tasksTotal: 30, efficiency: 93, lastActive: "6 min ago", avgResponseTime: "2.4s" },
  { agentId: 11, tasksCompleted: 42, tasksTotal: 45, efficiency: 93, lastActive: "2 min ago", avgResponseTime: "1.5s" },
  { agentId: 12, tasksCompleted: 55, tasksTotal: 60, efficiency: 92, lastActive: "1 min ago", avgResponseTime: "0.6s" },
  { agentId: 13, tasksCompleted: 30, tasksTotal: 32, efficiency: 94, lastActive: "3 min ago", avgResponseTime: "1.9s" },
  { agentId: 14, tasksCompleted: 18, tasksTotal: 20, efficiency: 90, lastActive: "10 min ago", avgResponseTime: "3.2s" },
  { agentId: 15, tasksCompleted: 60, tasksTotal: 62, efficiency: 97, lastActive: "now", avgResponseTime: "0.4s" },
  { agentId: 16, tasksCompleted: 25, tasksTotal: 28, efficiency: 89, lastActive: "7 min ago", avgResponseTime: "4.8s" },
  { agentId: 17, tasksCompleted: 33, tasksTotal: 35, efficiency: 94, lastActive: "5 min ago", avgResponseTime: "1.3s" },
  { agentId: 18, tasksCompleted: 48, tasksTotal: 50, efficiency: 96, lastActive: "now", avgResponseTime: "0.3s" },
];

// System alerts
export const systemAlerts: Alert[] = [
  {
    id: 1,
    type: "success",
    title: "Campaign ROAS Exceeded Target",
    message: "Meta Ads Q1 campaign achieved 4.4x ROAS, exceeding the 3.5x target by 26%.",
    agent: "Meta Ads Performance Manager",
    division: "Paid Media Operations",
    timestamp: Date.now() - 1000 * 60 * 5,
    read: false,
  },
  {
    id: 2,
    type: "warning",
    title: "Ad Spend Pacing Above Budget",
    message: "Monthly ad spend is pacing 8% above allocated budget. Recommend reviewing bid strategies.",
    agent: "Budget & Financial Operations Manager",
    division: "Operations & Infrastructure",
    timestamp: Date.now() - 1000 * 60 * 15,
    read: false,
  },
  {
    id: 3,
    type: "info",
    title: "New Competitive Intelligence Report",
    message: "Weekly competitive briefing ready. 3 new competitor campaigns detected across Meta and Google.",
    agent: "Competitive Intelligence Analyst",
    division: "Strategy & Intelligence",
    timestamp: Date.now() - 1000 * 60 * 30,
    read: false,
  },
  {
    id: 4,
    type: "critical",
    title: "Landing Page Conversion Drop",
    message: "Primary landing page conversion rate dropped 15% in the last 24 hours. Investigating.",
    agent: "Conversion Rate Optimization Specialist",
    division: "Analytics & Optimization",
    timestamp: Date.now() - 1000 * 60 * 45,
    read: true,
  },
  {
    id: 5,
    type: "success",
    title: "Organic Traffic Milestone",
    message: "Organic search traffic surpassed 45K monthly visits, a new record. Up 18.7% MoM.",
    agent: "SEO & Organic Growth Manager",
    division: "Organic & Authority",
    timestamp: Date.now() - 1000 * 60 * 60,
    read: true,
  },
  {
    id: 6,
    type: "info",
    title: "Content Calendar Updated",
    message: "March content calendar finalized with 24 pieces across blog, social, and email channels.",
    agent: "Authority Content Strategist",
    division: "Content & Creative",
    timestamp: Date.now() - 1000 * 60 * 90,
    read: true,
  },
  {
    id: 7,
    type: "warning",
    title: "Brand Mention Spike Detected",
    message: "Unusual spike in brand mentions on Reddit. Sentiment analysis shows 72% positive, 28% neutral.",
    agent: "Brand Sentiment & Reputation Monitor",
    division: "Organic & Authority",
    timestamp: Date.now() - 1000 * 60 * 120,
    read: true,
  },
  {
    id: 8,
    type: "success",
    title: "A/B Test Winner Declared",
    message: "Landing page variant B outperformed control by 23% with 99% statistical significance.",
    agent: "Conversion Rate Optimization Specialist",
    division: "Analytics & Optimization",
    timestamp: Date.now() - 1000 * 60 * 180,
    read: true,
  },
];

// Sentiment data over time
export const sentimentTimeline = [
  { date: "Jan W1", positive: 72, neutral: 20, negative: 8 },
  { date: "Jan W2", positive: 74, neutral: 19, negative: 7 },
  { date: "Jan W3", positive: 71, neutral: 21, negative: 8 },
  { date: "Jan W4", positive: 76, neutral: 18, negative: 6 },
  { date: "Feb W1", positive: 78, neutral: 17, negative: 5 },
  { date: "Feb W2", positive: 80, neutral: 15, negative: 5 },
  { date: "Feb W3", positive: 82, neutral: 14, negative: 4 },
  { date: "Feb W4", positive: 85, neutral: 12, negative: 3 },
];

// Lead funnel data
export const leadFunnel = [
  { stage: "Impressions", value: 328000 },
  { stage: "Clicks", value: 16800 },
  { stage: "Leads", value: 2400 },
  { stage: "MQLs", value: 840 },
  { stage: "SQLs", value: 320 },
  { stage: "Customers", value: 96 },
];

export function getAlertColor(type: Alert["type"]): string {
  switch (type) {
    case "success": return "#08AE67";
    case "warning": return "#F59E0B";
    case "critical": return "#EF4444";
    case "info": return "#2CACE8";
  }
}

// Service category performance (aligned with Marketing Powered service offerings)
export interface ServiceMetric {
  service: string;
  icon: string;
  activeCampaigns: number;
  topKPI: string;
  topKPIValue: string;
  trend: "up" | "down" | "flat";
  trendValue: string;
  agentsInvolved: number[];
  color: string;
}

export const serviceMetrics: ServiceMetric[] = [
  {
    service: "Paid Media Advertising",
    icon: "target",
    activeCampaigns: 4,
    topKPI: "Blended ROAS",
    topKPIValue: "4.2x",
    trend: "up",
    trendValue: "+8.3%",
    agentsInvolved: [7, 8, 9, 5, 13],
    color: "#F59E0B",
  },
  {
    service: "SEO & Content (LLMO)",
    icon: "globe",
    activeCampaigns: 3,
    topKPI: "Organic Sessions",
    topKPIValue: "45.2K",
    trend: "up",
    trendValue: "+18.7%",
    agentsInvolved: [3, 4, 10, 21],
    color: "#8B5CF6",
  },
  {
    service: "Analytics & Performance",
    icon: "bar-chart",
    activeCampaigns: 8,
    topKPI: "Conversion Rate",
    topKPIValue: "3.8%",
    trend: "up",
    trendValue: "+0.4%",
    agentsInvolved: [13, 14, 22],
    color: "#EF4444",
  },
  {
    service: "Marketing Automation",
    icon: "mail",
    activeCampaigns: 2,
    topKPI: "Email-to-Booking",
    topKPIValue: "8.4%",
    trend: "up",
    trendValue: "+1.2%",
    agentsInvolved: [24, 15],
    color: "#2CACE8",
  },
  {
    service: "Brand & PR",
    icon: "megaphone",
    activeCampaigns: 2,
    topKPI: "Brand Sentiment",
    topKPIValue: "87%",
    trend: "up",
    trendValue: "+2.1%",
    agentsInvolved: [12, 23, 11],
    color: "#08AE67",
  },
  {
    service: "Web & Landing Pages",
    icon: "zap",
    activeCampaigns: 1,
    topKPI: "Page Conversion",
    topKPIValue: "9.2%",
    trend: "up",
    trendValue: "+1.8%",
    agentsInvolved: [6, 14],
    color: "#6B7280",
  },
];

export function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}
