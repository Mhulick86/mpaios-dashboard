export interface Tool {
  id: string;
  name: string;
  blueprint: number;
  description: string;
  status: "active" | "beta" | "development";
  techStack: string[];
  category: "funnel" | "ads" | "seo" | "content" | "social" | "data" | "directory";
  icon: string;
  color: string;
  metrics?: { label: string; value: string }[];
}

export const tools: Tool[] = [
  {
    id: "vibe-marketing-funnel",
    name: "Vibe Marketing Funnel",
    blueprint: 3,
    description:
      "Scrapes competitor landing pages with Playwright, analyzes them with Claude Vision, then generates optimized landing pages and social video assets via Remotion.",
    status: "active",
    techStack: ["Playwright", "Claude Vision", "React", "Remotion", "shadcn/ui"],
    category: "funnel",
    icon: "rocket",
    color: "#8B5CF6",
    metrics: [
      { label: "Pages Analyzed", value: "148" },
      { label: "Videos Rendered", value: "36" },
    ],
  },
  {
    id: "gtm-ad-bidding",
    name: "GTM Ad Bidding Engine",
    blueprint: 4,
    description:
      "Extracts pain points from Reddit and Twitter via Perplexity API, generates ad creatives with Puppeteer, and auto-manages Facebook Ads campaigns — pausing losers and scaling winners.",
    status: "active",
    techStack: ["Perplexity API", "Puppeteer", "Facebook Ads SDK", "Docker"],
    category: "ads",
    icon: "target",
    color: "#F59E0B",
    metrics: [
      { label: "Avg ROAS", value: "4.2x" },
      { label: "Active Ads", value: "23" },
    ],
  },
  {
    id: "seo-content-machine",
    name: "SEO Content Machine",
    blueprint: 5,
    description:
      "Full pipeline from Ahrefs keyword research (KD<20, Vol>500) through SERP scraping, Claude-powered gap analysis, content generation with banned-word filters, DALL-E hero images, and CMS publishing.",
    status: "active",
    techStack: ["Ahrefs API", "Playwright", "Claude API", "DALL-E 3", "WordPress API"],
    category: "seo",
    icon: "search",
    color: "#08AE67",
    metrics: [
      { label: "Articles Published", value: "67" },
      { label: "Avg Position", value: "8.3" },
    ],
  },
  {
    id: "social-proof-engine",
    name: "Social Proof Engine",
    blueprint: 6,
    description:
      "Monitors brand mentions across social platforms, aggregates testimonials and reviews, generates social proof widgets, and auto-creates case study drafts from customer success signals.",
    status: "beta",
    techStack: ["Twitter API", "Claude API", "Puppeteer", "Supabase"],
    category: "social",
    icon: "heart",
    color: "#EC4899",
    metrics: [
      { label: "Mentions Tracked", value: "1.2K" },
      { label: "Proof Widgets", value: "18" },
    ],
  },
  {
    id: "data-enrichment-pipeline",
    name: "Data Enrichment Pipeline",
    blueprint: 7,
    description:
      "Cleans and enriches lead lists with firmographic data, validates emails, scores leads with Claude-powered ICP matching, and syncs enriched records to CRM.",
    status: "beta",
    techStack: ["Pandas", "Claude API", "Clearbit API", "HubSpot API"],
    category: "data",
    icon: "database",
    color: "#06B6D4",
    metrics: [
      { label: "Leads Enriched", value: "5.4K" },
      { label: "Match Rate", value: "87%" },
    ],
  },
  {
    id: "ig-reels-generator",
    name: "IG Reels Generator",
    blueprint: 8,
    description:
      "Parses Obsidian knowledge vaults to extract topics, generates JSON storyboards with Claude, creates portrait background images with DALL-E 3, and outputs production-ready Reel assets.",
    status: "development",
    techStack: ["Obsidian Parser", "Claude API", "DALL-E 3", "Pillow"],
    category: "content",
    icon: "film",
    color: "#E11D48",
    metrics: [
      { label: "Reels Created", value: "12" },
      { label: "Topics Mapped", value: "89" },
    ],
  },
  {
    id: "seo-directory",
    name: "SEO Directory Builder",
    blueprint: 9,
    description:
      "End-to-end programmatic SEO directory: CSV data cleaning, async web crawling with BrightData proxies, Claude Vision image curation, Supabase storage, and a Next.js frontend with ISR and Schema.org markup.",
    status: "development",
    techStack: [
      "Pandas",
      "aiohttp",
      "Claude Vision",
      "Supabase",
      "Next.js",
      "Tailwind",
    ],
    category: "directory",
    icon: "map-pin",
    color: "#2CACE8",
    metrics: [
      { label: "Listings", value: "2.1K" },
      { label: "Cities Indexed", value: "84" },
    ],
  },
];

export const toolCategories: Record<string, string> = {
  funnel: "Funnels",
  ads: "Advertising",
  seo: "SEO",
  content: "Content",
  social: "Social",
  data: "Data",
  directory: "Directory",
};

export const statusLabels: Record<string, { label: string; color: string }> = {
  active: { label: "Active", color: "#08AE67" },
  beta: { label: "Beta", color: "#F59E0B" },
  development: { label: "In Development", color: "#6B7280" },
};
