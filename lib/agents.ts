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
  {
    id: 7,
    name: "Client Success & Revenue",
    color: "#0EA5E9",
    agentCount: 3,
    scope: "Client retention, proposals & SOWs, revenue intelligence, churn prediction, QBR prep, upsell identification",
  },
  {
    id: 8,
    name: "Data Engineering & Intelligence",
    color: "#F97316",
    agentCount: 3,
    scope: "Data pipelines, audience enrichment, predictive modeling, market research, first-party data, cross-client pattern recognition",
  },
  {
    id: 9,
    name: "Local & Community Growth",
    color: "#14B8A6",
    agentCount: 3,
    scope: "Local SEO, GEO grid tracking, Google Business Profile, citation management, hyperlocal community awareness, review generation",
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
    tooling: ["Browser automation", "Gemini Vision API", "Meta Ads Library API", "Screenshot capture", "Competitor Ad Monitor", "Vibe Marketing Funnel"],
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
    tooling: ["Web browsing", "Brand analysis framework", "Campaign planning templates", "UTM Campaign Tracker", "Budget Pacing Optimizer"],
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
    tooling: ["AHREFS API", "Semrush API", "Google Search Console", "BuzzSumo", "GSC Performance Monitor", "AI Search Visibility (LLMO)"],
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
    tooling: ["Research tools", "Style guide enforcement", "Readability analysis", "Plagiarism checking", "Blog Brand Voice Writer", "Email Nurture Automator"],
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
    tooling: ["Gemini API", "Image generation APIs", "Browser tools", "Vision analysis", "IG Reels Generator", "Social Content Amplifier"],
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
    tooling: ["Frontend frameworks", "Design systems", "Browser preview", "Responsive testing", "CRO A/B Test Engine"],
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
    tooling: ["Meta Marketing API", "Meta Ads Manager", "Campaign templates", "GTM Ad Bidding Engine", "Competitor Ad Monitor"],
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
    tooling: ["Google Ads API", "Google Keyword Planner", "Google Ads Editor", "GTM Ad Bidding Engine", "Budget Pacing Optimizer"],
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
    tooling: ["AHREFS API", "Semrush API", "Google Search Console", "Screaming Frog", "PageSpeed Insights", "SEO Content Machine", "GSC Performance Monitor", "WordPress Auto-Tagger"],
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
    tooling: ["Social scheduling APIs", "Analytics dashboards", "Content calendars", "Trend tools", "Social Content Amplifier", "Instagram Trend Engine"],
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
    tooling: ["Social listening APIs", "Google NLP API", "Review platform APIs", "Web scraping", "Brand Mention Radar", "Sentiment & Feedback Analyzer"],
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
    tooling: ["Ad platform APIs", "Google Analytics 4", "Data aggregation pipelines", "GA4 Weekly AI Report", "UTM Campaign Tracker", "Budget Pacing Optimizer"],
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
    tooling: ["Analytics platforms", "A/B testing tools", "Heatmap data", "Statistical analysis", "CRO A/B Test Engine"],
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
    tooling: ["Ad platform APIs", "Financial tracking", "Forecasting models", "Budget Pacing Optimizer"],
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
    tooling: ["Asana API", "Web research", "CRM integration", "Document generation", "AI Lead Qualifier", "Testimonial Collector"],
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
    tooling: ["Script templates", "Video AI tools", "Multimedia planning", "Social platform APIs", "YouTube Trend Finder", "IG Reels Generator"],
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
    tooling: ["AI search APIs", "Schema markup tools", "Content structure analyzers", "Citation trackers", "AI Search Visibility (LLMO)"],
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
    tooling: ["PR databases", "Email outreach tools", "Media monitoring", "Backlink analyzers", "Brand Mention Radar", "Testimonial Collector"],
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
    tooling: ["Email platform APIs", "CRM connectors", "Automation builders", "Analytics tracking", "Email Nurture Automator", "Email Reply Classifier"],
    status: "idle",
  },

  // ── Division 7: Client Success & Revenue ──
  {
    id: 25,
    name: "Client Success & Retention Manager",
    shortName: "Client Success",
    division: "Client Success & Revenue",
    divisionId: 7,
    description:
      "Owns the full client lifecycle from onboarding through renewal. Monitors client health scores, predicts churn risk, prepares QBR materials, tracks NPS/CSAT, and proactively identifies retention risks before they escalate.",
    capabilities: [
      "Client health scoring & monitoring",
      "Churn risk prediction & alerting",
      "QBR deck preparation & talking points",
      "NPS/CSAT survey management",
      "Client milestone tracking",
      "Proactive issue escalation",
    ],
    tooling: ["CRM APIs", "Survey tools", "Health scoring engine", "Asana API", "Predictive analytics", "Sentiment & Feedback Analyzer"],
    status: "idle",
  },
  {
    id: 26,
    name: "Proposal & Revenue Strategist",
    shortName: "Proposal Strategist",
    division: "Client Success & Revenue",
    divisionId: 7,
    description:
      "Creates compelling proposals, SOWs, and pricing strategies for new and existing clients. Identifies upsell and cross-sell opportunities based on performance data, builds custom service packages, and tracks pipeline velocity.",
    capabilities: [
      "Proposal & SOW generation",
      "Custom pricing strategy",
      "Upsell/cross-sell identification",
      "Pipeline velocity tracking",
      "Win/loss analysis",
      "Service package architecture",
    ],
    tooling: ["Document generation", "CRM APIs", "Pricing models", "Revenue analytics", "Competitive benchmarks"],
    status: "idle",
  },
  {
    id: 27,
    name: "Revenue Intelligence Analyst",
    shortName: "Revenue Intel",
    division: "Client Success & Revenue",
    divisionId: 7,
    description:
      "Tracks client-level and agency-level revenue metrics including LTV, MRR, profit margins, and cost-to-serve. Produces financial intelligence reports and forecasts revenue scenarios for strategic decision-making.",
    capabilities: [
      "Client LTV calculation & tracking",
      "MRR/ARR monitoring",
      "Profit margin analysis by client",
      "Cost-to-serve modeling",
      "Revenue forecasting & scenarios",
      "Agency financial dashboards",
    ],
    tooling: ["Financial APIs", "Spreadsheet automation", "Forecasting models", "Budget Pacing Optimizer", "Data visualization"],
    status: "idle",
  },

  // ── Division 8: Data Engineering & Intelligence ──
  {
    id: 28,
    name: "Data Pipeline & Enrichment Engineer",
    shortName: "Data Engineer",
    division: "Data Engineering & Intelligence",
    divisionId: 8,
    description:
      "Builds and maintains ETL pipelines that ingest, clean, and enrich data from all marketing channels. Creates unified customer profiles, audience segments, and first-party data assets that feed the entire agent ecosystem.",
    capabilities: [
      "ETL pipeline architecture",
      "Cross-platform data unification",
      "First-party data ingestion",
      "Audience enrichment & segmentation",
      "Data quality monitoring",
      "Customer data platform management",
    ],
    tooling: ["Supabase", "Data transformation tools", "API connectors", "Schema validation", "Data quality monitors"],
    status: "idle",
  },
  {
    id: 29,
    name: "Predictive Modeling & Analytics Specialist",
    shortName: "Predictive Analytics",
    division: "Data Engineering & Intelligence",
    divisionId: 8,
    description:
      "Builds predictive models for conversion propensity, audience lookalikes, churn probability, and campaign outcome forecasting. Turns historical data into forward-looking intelligence that drives proactive decision-making.",
    capabilities: [
      "Conversion propensity modeling",
      "Lookalike audience building",
      "Campaign outcome forecasting",
      "Customer journey modeling",
      "Spend-to-outcome prediction",
      "Anomaly detection & alerting",
    ],
    tooling: ["ML frameworks", "Statistical modeling", "Analytics APIs", "GA4 data", "Cross-platform data"],
    status: "idle",
  },
  {
    id: 30,
    name: "Market Research & Trends Analyst",
    shortName: "Market Research",
    division: "Data Engineering & Intelligence",
    divisionId: 8,
    description:
      "Conducts ongoing market research, identifies emerging trends, sizes market opportunities, and produces industry intelligence reports. Monitors macro trends across verticals to inform strategy before competitors react.",
    capabilities: [
      "Market sizing & TAM analysis",
      "Trend detection & monitoring",
      "Industry vertical deep dives",
      "Consumer behavior analysis",
      "Competitive landscape mapping",
      "Emerging platform intelligence",
    ],
    tooling: ["Web research", "Trend APIs", "Social listening", "AHREFS API", "News monitoring", "Survey tools"],
    status: "idle",
  },

  // ── Division 9: Local & Community Growth ──
  {
    id: 31,
    name: "Local SEO & GEO Grid Analyst",
    shortName: "Local SEO",
    division: "Local & Community Growth",
    divisionId: 9,
    description:
      "Operates like a LocalFalcon-style system for tracking and optimizing local search visibility. Performs geo-grid rank scanning across service areas, monitors Google Local Pack positions at granular geographic coordinates, tracks map pack rankings by location, and identifies hyperlocal ranking opportunities and gaps.",
    capabilities: [
      "GEO grid rank scanning (LocalFalcon-style)",
      "Google Local Pack position tracking",
      "Map pack ranking by zip code & neighborhood",
      "Local keyword rank tracking",
      "Service area coverage analysis",
      "Competitor local rank comparison",
      "Local search visibility heatmaps",
      "Proximity-based ranking analysis",
    ],
    tooling: ["Google Places API", "Google Maps API", "GEO grid scanner", "Local SERP tracker", "Rank tracking APIs", "Geolocation tools"],
    status: "idle",
  },
  {
    id: 32,
    name: "Google Business Profile & Citations Manager",
    shortName: "GBP Manager",
    division: "Local & Community Growth",
    divisionId: 9,
    description:
      "Manages Google Business Profile optimization, NAP consistency across the web, citation building and cleanup, and local directory listings. Ensures accurate, optimized business information across all local platforms and aggregators.",
    capabilities: [
      "Google Business Profile optimization",
      "NAP consistency auditing (Name, Address, Phone)",
      "Citation building & cleanup",
      "Local directory submission & monitoring",
      "GBP post creation & scheduling",
      "Review generation campaign management",
      "Photo & media optimization",
      "Q&A monitoring & response",
    ],
    tooling: ["Google Business Profile API", "Citation aggregators", "NAP auditing tools", "Review platforms", "Local listing APIs"],
    status: "idle",
  },
  {
    id: 33,
    name: "Hyperlocal Community & Awareness Strategist",
    shortName: "Community Growth",
    division: "Local & Community Growth",
    divisionId: 9,
    description:
      "Drives hyperlocal brand awareness through community engagement, local event marketing, neighborhood-level targeting, and grassroots outreach. Builds genuine community presence that translates to local search authority, foot traffic, and word-of-mouth referrals.",
    capabilities: [
      "Hyperlocal content creation (neighborhood-specific)",
      "Local event marketing & promotion",
      "Community partnership identification",
      "Neighborhood Facebook/Nextdoor engagement",
      "Local influencer & micro-influencer outreach",
      "Sponsorship opportunity identification",
      "Local PR & media placement",
      "Community awareness campaign design",
    ],
    tooling: ["Social platform APIs", "Local event platforms", "Community forums", "Nextdoor API", "Local media databases", "Geotargeting tools"],
    status: "idle",
  },
];

export function getAgentsByDivision(divisionId: number): Agent[] {
  return agents.filter((a) => a.divisionId === divisionId);
}

export function getDivisionById(id: number): Division | undefined {
  return divisions.find((d) => d.id === id);
}
