export type PipelineStatus = "ready" | "running" | "completed" | "error";

export interface PipelineStep {
  step: number;
  agent: string;
  agentId: number;
  action: string;
  status: PipelineStatus;
  isHumanReview?: boolean;
}

export interface Pipeline {
  id: number;
  name: string;
  description: string;
  trigger: string;
  estimatedDuration: string;
  status: PipelineStatus;
  steps: PipelineStep[];
}

export const pipelines: Pipeline[] = [
  {
    id: 1,
    name: "Full Campaign Launch",
    description:
      "End-to-end pipeline from competitive research to live campaigns across multiple channels. The flagship workflow for new client engagements.",
    trigger: "New client onboarding or new campaign request",
    estimatedDuration: "1-3 business days",
    status: "ready",
    steps: [
      { step: 1, agent: "Competitive Intelligence Analyst", agentId: 1, action: "Extract and analyze competitor ads, landing pages, and positioning", status: "ready" },
      { step: 2, agent: "Head of Strategy", agentId: 2, action: "Analyze client brand, develop multi-channel campaign proposal", status: "ready" },
      { step: 3, agent: "Authority Content Strategist", agentId: 3, action: "Develop content pillars and SEO-aligned editorial plan", status: "ready" },
      { step: 4, agent: "Authority Copywriter", agentId: 4, action: "Produce landing page copy, ad copy, email sequences", status: "ready" },
      { step: 5, agent: "Ad Creative Director", agentId: 5, action: "Generate image ads, video scripts, carousel assets", status: "ready" },
      { step: 6, agent: "Landing Page Architect", agentId: 6, action: "Build conversion-optimized landing pages and quiz funnels", status: "ready" },
      { step: 7, agent: "Ads Managers (Meta/Google/Social)", agentId: 7, action: "Deploy campaigns in draft mode across all target platforms", status: "ready" },
      { step: 8, agent: "Campaign Performance Analyst", agentId: 13, action: "Set up tracking dashboards and KPI benchmarks", status: "ready" },
      { step: 9, agent: "Workflow Orchestrator", agentId: 15, action: "Validate all handoffs and trigger human review", status: "ready", isHumanReview: true },
    ],
  },
  {
    id: 2,
    name: "Authority Content Engine",
    description:
      "Recurring pipeline that produces consistent thought leadership content optimized for both organic visibility and paid amplification.",
    trigger: "Weekly/bi-weekly content production cycle",
    estimatedDuration: "2-3 business days per piece",
    status: "ready",
    steps: [
      { step: 1, agent: "Authority Content Strategist", agentId: 3, action: "Identify high-opportunity topics from keyword research", status: "ready" },
      { step: 2, agent: "Authority Copywriter", agentId: 4, action: "Produce long-form authority content piece", status: "ready" },
      { step: 3, agent: "SEO Manager", agentId: 10, action: "Optimize content for on-page SEO factors", status: "ready" },
      { step: 4, agent: "Social Media Organic Manager", agentId: 11, action: "Create derivative social content from authority piece", status: "ready" },
      { step: 5, agent: "Ad Creative Director", agentId: 5, action: "Create paid amplification creatives", status: "ready" },
      { step: 6, agent: "Client Reporting Compiler", agentId: 16, action: "Track content performance and feed learnings back", status: "ready" },
    ],
  },
  {
    id: 3,
    name: "Performance Optimization Cycle",
    description:
      "Weekly automated cycle that analyzes campaign performance and generates optimization actions across all active campaigns.",
    trigger: "Weekly schedule (every Monday) or on-demand",
    estimatedDuration: "6-12 hours",
    status: "ready",
    steps: [
      { step: 1, agent: "Campaign Performance Analyst", agentId: 13, action: "Pull cross-channel data and identify underperformers", status: "ready" },
      { step: 2, agent: "CRO Specialist", agentId: 14, action: "Analyze landing page and funnel conversion data", status: "ready" },
      { step: 3, agent: "Budget Manager", agentId: 17, action: "Review spend pacing and recommend reallocations", status: "ready" },
      { step: 4, agent: "Ad Creative Director", agentId: 5, action: "Produce refreshed creatives for fatiguing ads", status: "ready" },
      { step: 5, agent: "Ads Managers (Platform-specific)", agentId: 7, action: "Implement approved optimizations in each platform", status: "ready" },
      { step: 6, agent: "Client Reporting Compiler", agentId: 16, action: "Generate weekly performance summary", status: "ready" },
    ],
  },
  {
    id: 4,
    name: "Competitive Response",
    description:
      "Triggered when the Competitive Intelligence Analyst detects significant competitor moves requiring a strategic response.",
    trigger: "Competitor activity detection or manual trigger",
    estimatedDuration: "1-2 business days",
    status: "ready",
    steps: [
      { step: 1, agent: "Competitive Intelligence Analyst", agentId: 1, action: "Flag competitor activity change with analysis", status: "ready" },
      { step: 2, agent: "Head of Strategy", agentId: 2, action: "Assess strategic implications and develop response options", status: "ready", isHumanReview: true },
      { step: 3, agent: "Creative & Media Agents", agentId: 5, action: "Execute approved response (new creatives, targeting adjustments, budget shifts)", status: "ready" },
      { step: 4, agent: "Client Reporting Compiler", agentId: 16, action: "Document competitive move and agency response for client briefing", status: "ready" },
    ],
  },
  {
    id: 5,
    name: "Client Onboarding & Discovery",
    description:
      "End-to-end client onboarding from initial discovery research through Asana project setup, brand analysis, and kickoff preparation. Automates the first 48 hours of a new client engagement.",
    trigger: "New client signed or discovery call scheduled",
    estimatedDuration: "24-48 hours",
    status: "ready",
    steps: [
      { step: 1, agent: "Client Onboarding Specialist", agentId: 19, action: "Research client industry, competitors, and existing digital presence", status: "ready" },
      { step: 2, agent: "Competitive Intelligence Analyst", agentId: 1, action: "Run comprehensive competitor audit for the client's market", status: "ready" },
      { step: 3, agent: "SEO Manager", agentId: 10, action: "Audit client website for technical SEO and organic opportunities", status: "ready" },
      { step: 4, agent: "LLMO Specialist", agentId: 21, action: "Assess client AI search visibility across ChatGPT, Claude, Perplexity", status: "ready" },
      { step: 5, agent: "Head of Strategy", agentId: 2, action: "Synthesize findings into strategic recommendations and campaign proposal", status: "ready", isHumanReview: true },
      { step: 6, agent: "Workflow Orchestrator", agentId: 15, action: "Create Asana project from template, assign tasks, schedule kickoff", status: "ready" },
    ],
  },
  {
    id: 6,
    name: "LLMO & AI Visibility Audit",
    description:
      "Audits and optimizes client brand presence across AI search platforms (ChatGPT, Claude, Perplexity, Google AI Overviews). Ensures content is structured for AI citation and visibility.",
    trigger: "Monthly schedule or new content published",
    estimatedDuration: "4-8 hours",
    status: "ready",
    steps: [
      { step: 1, agent: "LLMO Specialist", agentId: 21, action: "Query AI platforms for client brand mentions and citation frequency", status: "ready" },
      { step: 2, agent: "Authority Content Strategist", agentId: 3, action: "Identify content gaps where competitors are cited but client is not", status: "ready" },
      { step: 3, agent: "SEO Manager", agentId: 10, action: "Implement schema markup and structured data enhancements", status: "ready" },
      { step: 4, agent: "Authority Copywriter", agentId: 4, action: "Create or revise FAQ and authority content for AI-friendly structure", status: "ready" },
      { step: 5, agent: "Brand QA", agentId: 22, action: "Review all outputs for compliance and quality before publishing", status: "ready" },
      { step: 6, agent: "Client Reporting Compiler", agentId: 16, action: "Generate AI visibility report with before/after metrics", status: "ready" },
    ],
  },
  {
    id: 7,
    name: "Email & Nurture Sequence Builder",
    description:
      "Designs and deploys automated email nurture sequences for lead conversion. Creates personalized workflows triggered by user behavior across the marketing funnel.",
    trigger: "New campaign launch or lead magnet created",
    estimatedDuration: "2-3 business days",
    status: "ready",
    steps: [
      { step: 1, agent: "Head of Strategy", agentId: 2, action: "Define funnel stages, audience segments, and conversion goals", status: "ready" },
      { step: 2, agent: "Authority Copywriter", agentId: 4, action: "Write email sequence copy for each funnel stage", status: "ready" },
      { step: 3, agent: "Landing Page Architect", agentId: 6, action: "Build landing pages and lead capture forms for each stage", status: "ready" },
      { step: 4, agent: "Email Automation Manager", agentId: 24, action: "Configure automation workflows with behavioral triggers", status: "ready" },
      { step: 5, agent: "Brand QA", agentId: 22, action: "Review all emails for brand compliance and deliverability", status: "ready", isHumanReview: true },
      { step: 6, agent: "Campaign Performance Analyst", agentId: 13, action: "Set up tracking for open rates, CTR, and conversion attribution", status: "ready" },
    ],
  },
];
