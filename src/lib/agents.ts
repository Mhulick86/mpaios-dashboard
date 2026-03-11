export type AgentStatus = "active" | "idle" | "running" | "error";

export interface Agent {
  id: number;
  name: string;
  shortName: string;
  division: string;
  divisionId: number;
  description: string;
  capabilities: string[];
  tooling: string[];
  status: AgentStatus;
}

export interface Division {
  id: number;
  name: string;
  color: string;
  agentCount: number;
  scope: string;
}

export const divisions: Division[] = [
  {
    id: 1,
    name: "Strategy & Intelligence",
    color: "#2CACE8",
    agentCount: 3,
    scope: "Competitive research, campaign planning, client onboarding, brand analysis, market positioning",
  },
  {
    id: 2,
    name: "Content & Creative",
    color: "#08AE67",
    agentCount: 5,
    scope: "Authority content, ad creative, landing pages, video production, copywriting across all formats",
  },
  {
    id: 3,
    name: "Paid Media Operations",
    color: "#F59E0B",
    agentCount: 3,
    scope: "Meta Ads, Google Ads, TikTok, LinkedIn, Pinterest, X campaign management",
  },
  {
    id: 4,
    name: "Organic & Authority",
    color: "#8B5CF6",
    agentCount: 4,
    scope: "SEO, LLMO, organic social, brand sentiment, reputation management, community & PR",
  },
  {
    id: 5,
    name: "Analytics & Optimization",
    color: "#EF4444",
    agentCount: 3,
    scope: "Cross-channel reporting, CRO, A/B testing, attribution modeling, brand compliance QA",
  },
  {
    id: 6,
    name: "Operations & Infrastructure",
    color: "#6B7280",
    agentCount: 6,
    scope: "Workflow management, client reporting, budget operations, marketing automation, system memory",
  },
];

export const agents: Agent[] = [
  {
    id: 1,
    name: "Competitive Intelligence Analyst",
    shortName: "Competitive Intel",
    division: "Strategy & Intelligence",
    divisionId: 1,
    description:
      "Conducts deep competitive research across paid channels, organic presence, and market positioning. Scrapes Meta Ads Library, Google Ads Transparency Center, and landing pages.",
    capabilities: [
      "Meta Ads Library extraction",
      "Google Ads Transparency Center monitoring",
      "Landing page crawling & funnel mapping",
      "Ad creative scoring",
      "Competitor spend estimation",
      "Weekly competitive briefings",
    ],
    tooling: ["Browser automation", "Gemini Vision API", "Meta Ads Library API", "Screenshot capture"],
    status: "idle",
  },
  {
    id: 2,
    name: "Head of Strategy & Campaign Planning",
    shortName: "Head of Strategy",
    division: "Strategy & Intelligence",
    divisionId: 1,
    description:
      "Translates competitive intelligence and brand understanding into comprehensive campaign strategies. Develops multi-channel campaign proposals with audience targeting, budget allocation, and creative briefings.",
    capabilities: [
      "Website & brand analysis",
      "Multi-channel campaign architecture",
      "Audience persona development",
      "Budget allocation modeling",
      "Funnel design (TOFU/MOFU/BOFU)",
      "A/B testing strategy",
    ],
    tooling: ["Web browsing", "Brand analysis framework", "Campaign planning templates"],
    status: "idle",
  },
  {
    id: 3,
    name: "Authority Content Strategist",
    shortName: "Content Strategist",
    division: "Content & Creative",
    divisionId: 2,
    description:
      "Develops the content strategy and editorial calendar that positions clients as industry authorities. Focuses on thought leadership, SEO-driven content planning, and content-to-conversion pipelines.",
    capabilities: [
      "Editorial calendar development",
      "SEO keyword research",
      "E-E-A-T compliance auditing",
      "Content gap analysis",
      "Content-to-conversion funnel design",
      "Content performance analysis",
    ],
    tooling: ["AHREFS API", "Semrush API", "Google Search Console", "BuzzSumo"],
    status: "idle",
  },
  {
    id: 4,
    name: "Authority Copywriter",
    shortName: "Copywriter",
    division: "Content & Creative",
    divisionId: 2,
    description:
      "Produces authoritative long-form and short-form content that establishes client expertise. Specializes in healthcare, professional services, and regulated industry content.",
    capabilities: [
      "Long-form articles (2,000-5,000 words)",
      "White papers & industry reports",
      "Case studies with measurable outcomes",
      "Email sequences",
      "Landing page copy",
      "LinkedIn thought leadership",
    ],
    tooling: ["Research tools", "Style guide enforcement", "Readability analysis", "Plagiarism checking"],
    status: "idle",
  },
  {
    id: 5,
    name: "Ad Creative Director",
    shortName: "Creative Director",
    division: "Content & Creative",
    divisionId: 2,
    description:
      "Oversees all paid advertising creative production. Directs ad image generation, video script writing, carousel design, and ad copy across channels.",
    capabilities: [
      "AI image ad creation",
      "Video ad script writing (15s, 30s, 60s)",
      "Carousel ad design",
      "UGC-style ad scripting",
      "Creative testing matrix design",
      "Performance-informed iteration",
    ],
    tooling: ["Gemini API", "Image generation APIs", "Browser tools", "Vision analysis"],
    status: "idle",
  },
  {
    id: 6,
    name: "Landing Page Architect",
    shortName: "Landing Pages",
    division: "Content & Creative",
    divisionId: 2,
    description:
      "Designs and builds high-converting landing pages, quiz funnels, and lead capture experiences. Produces production-ready HTML/CSS or platform-specific implementations.",
    capabilities: [
      "Landing page design (HTML/CSS/JS)",
      "Quiz funnel architecture",
      "Lead magnet delivery pages",
      "A/B test variant generation",
      "Mobile-first responsive design",
      "CRO with heatmap-informed layouts",
    ],
    tooling: ["Frontend frameworks", "Design systems", "Browser preview", "Responsive testing"],
    status: "idle",
  },
  {
    id: 7,
    name: "Meta Ads Performance Manager",
    shortName: "Meta Ads",
    division: "Paid Media Operations",
    divisionId: 3,
    description:
      "Manages the complete Meta advertising lifecycle from campaign creation to optimization across Facebook and Instagram. Publishes campaigns in draft for human review.",
    capabilities: [
      "Campaign creation via Meta Marketing API",
      "Audience building (interest, lookalike, custom)",
      "Budget allocation & bid strategy",
      "Creative upload & ad format config",
      "Retargeting funnel setup",
      "Dynamic creative testing",
    ],
    tooling: ["Meta Marketing API", "Meta Ads Manager", "Campaign templates"],
    status: "idle",
  },
  {
    id: 8,
    name: "Google Ads Performance Manager",
    shortName: "Google Ads",
    division: "Paid Media Operations",
    divisionId: 3,
    description:
      "Manages Google Ads campaigns across Search, Display, YouTube, Performance Max, and Demand Gen. Specializes in healthcare and professional services PPC.",
    capabilities: [
      "Search campaign creation",
      "Performance Max setup",
      "YouTube ad management",
      "Display campaign targeting",
      "Negative keyword optimization",
      "Bid strategy optimization",
    ],
    tooling: ["Google Ads API", "Google Keyword Planner", "Google Ads Editor"],
    status: "idle",
  },
  {
    id: 9,
    name: "Social Media Advertising Specialist",
    shortName: "Social Ads",
    division: "Paid Media Operations",
    divisionId: 3,
    description:
      "Manages paid advertising across TikTok, LinkedIn, X (Twitter), Pinterest, and emerging platforms. Handles both B2B and B2C advertising.",
    capabilities: [
      "TikTok Ads Manager & Spark Ads",
      "LinkedIn Campaign Manager (B2B)",
      "Pinterest promoted pins",
      "X (Twitter) ads",
      "Cross-platform audience strategy",
      "Influencer amplification",
    ],
    tooling: ["Platform APIs", "Ad managers", "Social listening tools", "Trend monitoring"],
    status: "idle",
  },
  {
    id: 10,
    name: "SEO & Organic Growth Manager",
    shortName: "SEO Manager",
    division: "Organic & Authority",
    divisionId: 4,
    description:
      "Drives organic visibility through technical SEO, on-page optimization, and link building strategy. Monitors rankings and organic performance.",
    capabilities: [
      "Technical SEO auditing",
      "On-page optimization",
      "Keyword tracking & SERP monitoring",
      "Backlink analysis",
      "Local SEO optimization",
      "Schema markup implementation",
    ],
    tooling: ["AHREFS API", "Semrush API", "Google Search Console", "Screaming Frog", "PageSpeed Insights"],
    status: "idle",
  },
  {
    id: 11,
    name: "Social Media Organic Manager",
    shortName: "Social Organic",
    division: "Organic & Authority",
    divisionId: 4,
    description:
      "Manages organic social media presence across all platforms. Creates posting calendars, writes social copy, and develops engagement strategies.",
    capabilities: [
      "Social media calendar creation",
      "Platform-native content writing",
      "Hashtag strategy",
      "Community engagement monitoring",
      "Content repurposing pipeline",
      "Social media analytics",
    ],
    tooling: ["Social scheduling APIs", "Analytics dashboards", "Content calendars", "Trend tools"],
    status: "idle",
  },
  {
    id: 12,
    name: "Brand Sentiment & Reputation Monitor",
    shortName: "Brand Monitor",
    division: "Organic & Authority",
    divisionId: 4,
    description:
      "Continuously monitors brand mentions, reviews, and sentiment across social media, review platforms, and the web. Provides real-time alerts for reputation threats.",
    capabilities: [
      "Social listening (Twitter/X, Facebook, Reddit)",
      "Review monitoring (Google, Yelp, Trustpilot)",
      "Sentiment analysis with NLP",
      "Crisis detection & alerting",
      "Competitor sentiment benchmarking",
      "Review response drafting",
    ],
    tooling: ["Social listening APIs", "Google NLP API", "Review platform APIs", "Web scraping"],
    status: "idle",
  },
  {
    id: 13,
    name: "Campaign Performance Analyst",
    shortName: "Performance Analyst",
    division: "Analytics & Optimization",
    divisionId: 5,
    description:
      "Aggregates performance data across all paid channels into unified reporting. Tracks KPIs including CPA, ROAS, CTR, conversion rates, and LTV.",
    capabilities: [
      "Cross-channel dashboarding",
      "KPI tracking & alerting",
      "Campaign benchmarking",
      "Budget pacing analysis",
      "Attribution modeling",
      "Creative performance analysis",
    ],
    tooling: ["Ad platform APIs", "Google Analytics 4", "Data aggregation pipelines"],
    status: "idle",
  },
  {
    id: 14,
    name: "Conversion Rate Optimization Specialist",
    shortName: "CRO Specialist",
    division: "Analytics & Optimization",
    divisionId: 5,
    description:
      "Focuses on improving conversion rates across the entire customer journey. Analyzes funnel drop-off points, designs A/B tests, and recommends UX improvements.",
    capabilities: [
      "Funnel analysis with drop-off identification",
      "A/B test design & statistical analysis",
      "Heatmap & session recording analysis",
      "Landing page conversion audits",
      "Form optimization",
      "Multi-variant testing strategy",
    ],
    tooling: ["Analytics platforms", "A/B testing tools", "Heatmap data", "Statistical analysis"],
    status: "idle",
  },
  {
    id: 15,
    name: "Workflow Orchestrator & Task Manager",
    shortName: "Workflow Orchestrator",
    division: "Operations & Infrastructure",
    divisionId: 6,
    description:
      "Monitors all agency workflows, manages task assignments across agents, and identifies operational bottlenecks. Acts as the agency project manager.",
    capabilities: [
      "Project workflow monitoring",
      "Task assignment & prioritization",
      "Bottleneck detection",
      "Agent handoff validation",
      "SLA tracking",
      "Quality assurance checkpoints",
    ],
    tooling: ["Asana API", "Project management templates", "Workflow automation"],
    status: "active",
  },
  {
    id: 16,
    name: "Client Reporting & Insights Compiler",
    shortName: "Client Reporting",
    division: "Operations & Infrastructure",
    divisionId: 6,
    description:
      "Compiles data from all agents into polished client-facing reports. Translates raw performance data into executive-friendly narratives.",
    capabilities: [
      "Weekly performance summaries",
      "Monthly strategic reviews",
      "QBR presentations",
      "Executive dashboards",
      "ROI storytelling",
      "Custom report generation",
    ],
    tooling: ["Data aggregation", "Document generation", "Presentation tools", "Charting libraries"],
    status: "idle",
  },
  {
    id: 17,
    name: "Budget & Financial Operations Manager",
    shortName: "Budget Manager",
    division: "Operations & Infrastructure",
    divisionId: 6,
    description:
      "Monitors all marketing spend across platforms, tracks budget pacing, and provides real-time financial intelligence. Flags overspend and reallocation opportunities.",
    capabilities: [
      "Cross-platform spend monitoring",
      "Budget vs. actual tracking",
      "Spend efficiency scoring",
      "Budget reallocation recommendations",
      "Cost anomaly detection",
      "Forecasting & scenario modeling",
    ],
    tooling: ["Ad platform APIs", "Financial tracking", "Forecasting models"],
    status: "idle",
  },
  {
    id: 18,
    name: "System Intelligence & Memory Agent",
    shortName: "System Intelligence",
    division: "Operations & Infrastructure",
    divisionId: 6,
    description:
      "Maintains the collective memory and knowledge base of the entire agent ecosystem. Caches historical campaign data, extracts key learnings, and ensures all agents have access to relevant context.",
    capabilities: [
      "Historical performance caching",
      "Key learning extraction",
      "Client preference database",
      "Agent ecosystem monitoring",
      "Cross-client pattern recognition",
      "Knowledge base management",
    ],
    tooling: ["PostgreSQL/Redis", "ElasticSearch", "Vector embeddings", "RAG pipeline"],
    status: "active",
  },
  {
    id: 19,
    name: "Client Onboarding & Discovery Specialist",
    shortName: "Client Onboarding",
    division: "Strategy & Intelligence",
    divisionId: 1,
    description:
      "Manages end-to-end client onboarding from discovery to project setup. Conducts intake interviews, researches client industry, builds initial Asana project structures, and schedules kickoff workflows.",
    capabilities: [
      "Client discovery research",
      "Industry vertical analysis",
      "Onboarding questionnaire management",
      "Asana project template creation",
      "Kickoff meeting prep",
      "Client account setup automation",
    ],
    tooling: ["Asana API", "Web research", "CRM integration", "Document generation"],
    status: "idle",
  },
  {
    id: 20,
    name: "Video & Multimedia Producer",
    shortName: "Video Producer",
    division: "Content & Creative",
    divisionId: 2,
    description:
      "Produces video scripts, storyboards, and multimedia content for ads, social media, and client branding. Specializes in short-form video (15s-60s) for TikTok, Reels, and YouTube Shorts.",
    capabilities: [
      "Video script writing (15s, 30s, 60s)",
      "Storyboard generation",
      "UGC-style video briefs",
      "YouTube Shorts & Reels optimization",
      "Podcast show notes & transcripts",
      "Webinar content planning",
    ],
    tooling: ["Script templates", "Video AI tools", "Multimedia planning", "Social platform APIs"],
    status: "idle",
  },
  {
    id: 21,
    name: "LLMO & AI Visibility Specialist",
    shortName: "LLMO Specialist",
    division: "Organic & Authority",
    divisionId: 4,
    description:
      "Specializes in Large Language Model Optimization (LLMO) to ensure client brands appear in AI-generated search results from ChatGPT, Claude, Perplexity, and other AI platforms. Optimizes content structure for AI citation.",
    capabilities: [
      "LLMO content structuring",
      "AI search visibility auditing",
      "FAQ & schema optimization for LLMs",
      "AI citation monitoring",
      "Structured data implementation",
      "AI platform advertising strategy",
    ],
    tooling: ["AI search APIs", "Schema markup tools", "Content structure analyzers", "Citation trackers"],
    status: "idle",
  },
  {
    id: 22,
    name: "Brand Compliance & QA Reviewer",
    shortName: "Brand QA",
    division: "Analytics & Optimization",
    divisionId: 5,
    description:
      "Reviews all agent outputs for brand guideline compliance, tone of voice consistency, and quality standards. Acts as the final quality gate before any deliverable reaches clients.",
    capabilities: [
      "Brand guideline enforcement",
      "Tone of voice validation",
      "Content accuracy checking",
      "HIPAA compliance review (healthcare)",
      "Ad policy compliance (Meta, Google)",
      "Deliverable scoring & approval",
    ],
    tooling: ["Style guide engine", "Compliance checkers", "Grammar analysis", "Policy databases"],
    status: "idle",
  },
  {
    id: 23,
    name: "Community & PR Manager",
    shortName: "PR Manager",
    division: "Organic & Authority",
    divisionId: 4,
    description:
      "Manages public relations outreach, guest post syndication, podcast booking, and community engagement. Builds earned media presence and backlinks through strategic relationship management.",
    capabilities: [
      "Guest post outreach & placement",
      "Podcast booking & show prep",
      "Press release drafting",
      "Media list management",
      "Community forum engagement",
      "Backlink opportunity identification",
    ],
    tooling: ["PR databases", "Email outreach tools", "Media monitoring", "Backlink analyzers"],
    status: "idle",
  },
  {
    id: 24,
    name: "Email & Marketing Automation Manager",
    shortName: "Email Automation",
    division: "Operations & Infrastructure",
    divisionId: 6,
    description:
      "Designs and manages email marketing campaigns, lead nurturing sequences, CRM workflows, and marketing automation rules. Ensures personalized engagement at scale across the customer lifecycle.",
    capabilities: [
      "Email sequence design",
      "Lead nurturing workflows",
      "CRM integration & sync",
      "Behavioral trigger automation",
      "A/B testing email campaigns",
      "Lifecycle marketing automation",
    ],
    tooling: ["Email platform APIs", "CRM connectors", "Automation builders", "Analytics tracking"],
    status: "idle",
  },
];

export function getAgentsByDivision(divisionId: number): Agent[] {
  return agents.filter((a) => a.divisionId === divisionId);
}

export function getDivisionById(id: number): Division | undefined {
  return divisions.find((d) => d.id === id);
}
