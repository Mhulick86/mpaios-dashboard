export interface ToolConfigField {
  id: string;
  label: string;
  type: "text" | "number" | "select" | "textarea" | "toggle" | "url";
  placeholder?: string;
  options?: string[];
  defaultValue?: string | number | boolean;
  required?: boolean;
  helpText?: string;
}

export interface ToolRunLog {
  id: string;
  timestamp: string;
  status: "success" | "error" | "running" | "queued";
  duration: string;
  summary: string;
  details?: string[];
}

export interface Tool {
  id: string;
  name: string;
  blueprint: number;
  description: string;
  longDescription: string;
  status: "active" | "beta" | "development";
  techStack: string[];
  category:
    | "funnel"
    | "ads"
    | "seo"
    | "content"
    | "social"
    | "data"
    | "directory";
  icon: string;
  color: string;
  metrics?: { label: string; value: string }[];
  configFields: ToolConfigField[];
  runLogs: ToolRunLog[];
  schedule?: string;
  lastRun?: string;
  nextRun?: string;
}

export const tools: Tool[] = [
  {
    id: "vibe-marketing-funnel",
    name: "Vibe Marketing Funnel",
    blueprint: 3,
    description:
      "Scrapes competitor landing pages with Playwright, analyzes them with Claude Vision, then generates optimized landing pages and social video assets via Remotion.",
    longDescription:
      "End-to-end competitive intelligence and funnel builder. Provide competitor URLs and the engine scrapes their landing pages using headless Playwright, runs them through Claude Vision for layout, copy, and CTA analysis, then generates optimized landing page variants with React + shadcn/ui components. Optionally renders short-form video assets with Remotion for social distribution.",
    status: "active",
    techStack: ["Playwright", "Claude Vision", "React", "Remotion", "shadcn/ui"],
    category: "funnel",
    icon: "rocket",
    color: "#8B5CF6",
    metrics: [
      { label: "Pages Analyzed", value: "148" },
      { label: "Videos Rendered", value: "36" },
    ],
    configFields: [
      {
        id: "competitor_urls",
        label: "Competitor URLs",
        type: "textarea",
        placeholder: "https://competitor1.com\nhttps://competitor2.com",
        required: true,
        helpText: "One URL per line. Max 10 URLs per run.",
      },
      {
        id: "output_style",
        label: "Landing Page Style",
        type: "select",
        options: ["Modern Minimal", "Bold & Dark", "Corporate Clean", "Healthcare Trust", "SaaS Conversion"],
        defaultValue: "Modern Minimal",
      },
      {
        id: "generate_video",
        label: "Generate Video Assets",
        type: "toggle",
        defaultValue: true,
        helpText: "Create 15s Remotion video variants for social.",
      },
      {
        id: "brand_color",
        label: "Brand Primary Color",
        type: "text",
        placeholder: "#2CACE8",
        defaultValue: "#2CACE8",
      },
      {
        id: "cta_text",
        label: "Primary CTA Text",
        type: "text",
        placeholder: "Get Started Free",
        defaultValue: "Get Started Free",
      },
      {
        id: "stealth_mode",
        label: "Stealth Browser Mode",
        type: "select",
        options: ["Standard", "Stealth (Anti-Detect)", "Residential Proxy + Stealth"],
        defaultValue: "Stealth (Anti-Detect)",
        helpText: "Bypass Cloudflare, Akamai, and bot detection. Use 'Residential Proxy + Stealth' for aggressive WAFs.",
      },
      {
        id: "proxy_rotation",
        label: "Proxy Rotation",
        type: "toggle",
        defaultValue: true,
        helpText: "Rotate residential proxies per request via BrightData to avoid IP blocks.",
      },
      {
        id: "retry_on_block",
        label: "Auto-Retry on Cloudflare Block",
        type: "toggle",
        defaultValue: true,
        helpText: "Automatically retry with different fingerprint + proxy when Cloudflare challenge detected. Up to 3 retries.",
      },
      {
        id: "page_wait_timeout",
        label: "Page Load Timeout (seconds)",
        type: "number",
        placeholder: "30",
        defaultValue: 30,
        helpText: "Max wait time per page. Increase for slow-loading sites.",
      },
      {
        id: "screenshot_full_page",
        label: "Full-Page Screenshots",
        type: "toggle",
        defaultValue: true,
        helpText: "Capture full scrollable page. Disable for above-fold only.",
      },
    ],
    runLogs: [
      {
        id: "r1",
        timestamp: "2026-03-12T09:14:00Z",
        status: "success",
        duration: "4m 32s",
        summary: "Analyzed 3 competitor pages, generated 2 landing page variants + 3 video assets",
        details: [
          "Scraped serenity-wellness.com/intake (12 sections detected)",
          "Scraped mindbridge-therapy.com/contact (8 sections detected)",
          "Scraped recovery-path.org/admissions (15 sections detected)",
          "Claude Vision analysis complete — 94% confidence on CTA patterns",
          "Generated LP variant A (Modern Minimal) — 1,420 words",
          "Generated LP variant B (Healthcare Trust) — 1,180 words",
          "Rendered 3 Remotion videos (15s each, 1080x1920)",
        ],
      },
      {
        id: "r1b",
        timestamp: "2026-03-12T05:14:00Z",
        status: "success",
        duration: "5m 48s",
        summary: "Retried competitor3.com with Stealth + Proxy — successfully bypassed Cloudflare",
        details: [
          "Stealth mode: Anti-detect fingerprint applied (Chrome 122, macOS)",
          "Proxy: Rotated to residential IP 74.x.x.x (Dallas, TX)",
          "Cloudflare challenge detected → auto-retry #1 with new fingerprint",
          "Retry #1: Cloudflare passed ✓ (2.3s solve time)",
          "Scraped competitor3.com (22 sections detected)",
          "Claude Vision analysis complete — 91% confidence on CTA patterns",
          "Generated LP variant A (SaaS Conversion) — 1,680 words",
          "Rendered 2 Remotion videos (15s each, 1080x1920)",
        ],
      },
      {
        id: "r2",
        timestamp: "2026-03-11T14:22:00Z",
        status: "success",
        duration: "3m 18s",
        summary: "Analyzed 2 pages, generated 2 variants + 2 videos",
      },
      {
        id: "r3",
        timestamp: "2026-03-10T10:05:00Z",
        status: "error",
        duration: "1m 02s",
        summary: "Failed: Playwright timeout on competitor3.com (Cloudflare block)",
        details: [
          "Standard browser mode — no stealth fingerprint",
          "Request to competitor3.com returned Cloudflare challenge page",
          "Waited 30s for challenge resolution — timeout exceeded",
          "No proxy rotation configured — direct IP blocked",
          "⚠ Fix: Enable Stealth Browser Mode + Proxy Rotation in Configuration",
        ],
      },
    ],
    schedule: "Manual",
    lastRun: "2 hours ago",
    nextRun: "Manual trigger",
  },
  {
    id: "gtm-ad-bidding",
    name: "GTM Ad Bidding Engine",
    blueprint: 4,
    description:
      "Extracts pain points from Reddit and Twitter via Perplexity API, generates ad creatives with Puppeteer, and auto-manages Facebook Ads campaigns — pausing losers and scaling winners.",
    longDescription:
      "Automated go-to-market ad pipeline. Mines Reddit threads and Twitter/X conversations through Perplexity API to extract real customer pain points and language. Generates ad creatives (headlines, descriptions, images) with Puppeteer screenshots of mock-up templates. Deploys to Facebook Ads via the Marketing API, then continuously monitors CPA — pausing underperformers and scaling budget on winners.",
    status: "active",
    techStack: ["Perplexity API", "Puppeteer", "Facebook Ads SDK", "Docker"],
    category: "ads",
    icon: "target",
    color: "#F59E0B",
    metrics: [
      { label: "Avg ROAS", value: "4.2x" },
      { label: "Active Ads", value: "23" },
    ],
    configFields: [
      {
        id: "target_keywords",
        label: "Target Pain Point Keywords",
        type: "textarea",
        placeholder: "anxiety treatment near me\ntherapy intake process\naffordable counseling",
        required: true,
        helpText: "Keywords to mine from Reddit/Twitter. One per line.",
      },
      {
        id: "daily_budget",
        label: "Daily Budget ($)",
        type: "number",
        placeholder: "50",
        defaultValue: 50,
        required: true,
      },
      {
        id: "cpa_threshold",
        label: "Max CPA ($)",
        type: "number",
        placeholder: "45",
        defaultValue: 45,
        helpText: "Ads exceeding this CPA will be auto-paused.",
      },
      {
        id: "ad_account_id",
        label: "Facebook Ad Account ID",
        type: "text",
        placeholder: "act_123456789",
        required: true,
      },
      {
        id: "auto_scale",
        label: "Auto-Scale Winners",
        type: "toggle",
        defaultValue: true,
        helpText: "Automatically increase budget 20% on ads beating CPA target by 30%+.",
      },
      {
        id: "platforms",
        label: "Source Platforms",
        type: "select",
        options: ["Reddit + Twitter", "Reddit Only", "Twitter Only"],
        defaultValue: "Reddit + Twitter",
      },
    ],
    runLogs: [
      {
        id: "r1",
        timestamp: "2026-03-12T08:00:00Z",
        status: "success",
        duration: "12m 45s",
        summary: "Mined 47 pain points, created 6 new ads, paused 2 underperformers, scaled 3 winners",
        details: [
          "Perplexity API: Scraped 23 Reddit threads, 31 Twitter conversations",
          "Extracted 47 unique pain points (de-duped from 89 raw)",
          "Generated 6 ad creatives (3 image, 3 carousel)",
          "Deployed to Facebook Ads account act_29384756",
          "Auto-paused: Ad #1847 (CPA $62.40), Ad #1832 (CPA $58.10)",
          "Auto-scaled: Ad #1839 (+20%, ROAS 5.8x), Ad #1841 (+20%, ROAS 4.9x), Ad #1844 (+20%, ROAS 6.1x)",
        ],
      },
      {
        id: "r2",
        timestamp: "2026-03-11T08:00:00Z",
        status: "success",
        duration: "11m 33s",
        summary: "Mined 38 pain points, created 4 ads, paused 1, scaled 2",
      },
    ],
    schedule: "Daily at 8:00 AM",
    lastRun: "4 hours ago",
    nextRun: "Tomorrow 8:00 AM",
  },
  {
    id: "seo-content-machine",
    name: "SEO Content Machine",
    blueprint: 5,
    description:
      "Full pipeline from Ahrefs keyword research (KD<20, Vol>500) through SERP scraping, Claude-powered gap analysis, content generation with banned-word filters, DALL-E hero images, and CMS publishing.",
    longDescription:
      "Automated SEO content factory. Queries Ahrefs API for keyword opportunities (KD<20, Vol>500+), scrapes top 10 SERP results with Playwright, feeds them to Claude for content gap analysis, generates comprehensive articles with banned-word filtering and internal linking, creates hero images via DALL-E 3, and publishes directly to WordPress via REST API with proper schema markup.",
    status: "active",
    techStack: ["Ahrefs API", "Playwright", "Claude API", "DALL-E 3", "WordPress API"],
    category: "seo",
    icon: "search",
    color: "#08AE67",
    metrics: [
      { label: "Articles Published", value: "67" },
      { label: "Avg Position", value: "8.3" },
    ],
    configFields: [
      {
        id: "seed_keywords",
        label: "Seed Keywords",
        type: "textarea",
        placeholder: "anxiety therapy dallas\nmental health counseling near me",
        required: true,
        helpText: "Seed keywords for Ahrefs opportunity discovery.",
      },
      {
        id: "max_kd",
        label: "Max Keyword Difficulty",
        type: "number",
        placeholder: "20",
        defaultValue: 20,
      },
      {
        id: "min_volume",
        label: "Min Search Volume",
        type: "number",
        placeholder: "500",
        defaultValue: 500,
      },
      {
        id: "banned_words",
        label: "Banned Words",
        type: "textarea",
        placeholder: "guarantee\nbest\n#1",
        helpText: "Words to exclude from generated content. One per line.",
      },
      {
        id: "wordpress_url",
        label: "WordPress Site URL",
        type: "url",
        placeholder: "https://yoursite.com",
        required: true,
      },
      {
        id: "auto_publish",
        label: "Auto-Publish to WordPress",
        type: "toggle",
        defaultValue: false,
        helpText: "When off, articles are saved as drafts for review.",
      },
    ],
    runLogs: [
      {
        id: "r1",
        timestamp: "2026-03-12T06:00:00Z",
        status: "success",
        duration: "18m 22s",
        summary: "Found 12 keyword opportunities, published 3 articles to WordPress",
        details: [
          "Ahrefs API: 12 opportunities found (KD<20, Vol>500)",
          "SERP scraped for top 3 keywords (30 pages total)",
          "Claude gap analysis identified 8 content gaps",
          "Generated 3 articles (avg 2,100 words each)",
          "DALL-E 3: Created 3 hero images (1200x630)",
          "Published 3 drafts to WordPress (pending review)",
        ],
      },
      {
        id: "r2",
        timestamp: "2026-03-11T06:00:00Z",
        status: "success",
        duration: "15m 48s",
        summary: "Found 8 opportunities, published 2 articles",
      },
      {
        id: "r3",
        timestamp: "2026-03-10T06:00:00Z",
        status: "error",
        duration: "3m 12s",
        summary: "WordPress API auth token expired — articles generated but not published",
      },
    ],
    schedule: "Daily at 6:00 AM",
    lastRun: "6 hours ago",
    nextRun: "Tomorrow 6:00 AM",
  },
  {
    id: "social-proof-engine",
    name: "Social Proof Engine",
    blueprint: 6,
    description:
      "Monitors brand mentions across social platforms, aggregates testimonials and reviews, generates social proof widgets, and auto-creates case study drafts from customer success signals.",
    longDescription:
      "Real-time social listening and proof generation system. Monitors Twitter/X, Reddit, Google Reviews, and G2 for brand mentions and sentiment. Aggregates positive testimonials, generates embeddable social proof widgets (notification popups, review carousels, trust badges), and drafts case studies from clusters of positive customer signals using Claude.",
    status: "beta",
    techStack: ["Twitter API", "Claude API", "Puppeteer", "Supabase"],
    category: "social",
    icon: "heart",
    color: "#EC4899",
    metrics: [
      { label: "Mentions Tracked", value: "1.2K" },
      { label: "Proof Widgets", value: "18" },
    ],
    configFields: [
      {
        id: "brand_name",
        label: "Brand Name",
        type: "text",
        placeholder: "Serenity Wellness",
        required: true,
      },
      {
        id: "brand_aliases",
        label: "Brand Aliases / Variations",
        type: "textarea",
        placeholder: "Serenity Wellness Center\n@serenitywellness\nserenity-wellness.com",
        helpText: "Alternative names, handles, domains to monitor.",
      },
      {
        id: "platforms",
        label: "Monitoring Platforms",
        type: "select",
        options: ["All Platforms", "Twitter + Reddit", "Google Reviews Only", "G2 + Capterra"],
        defaultValue: "All Platforms",
      },
      {
        id: "sentiment_threshold",
        label: "Min Sentiment Score",
        type: "number",
        placeholder: "0.7",
        defaultValue: 0.7,
        helpText: "Only capture mentions above this sentiment (0-1 scale).",
      },
      {
        id: "auto_widget",
        label: "Auto-Generate Widgets",
        type: "toggle",
        defaultValue: true,
        helpText: "Automatically create embeddable proof widgets from new testimonials.",
      },
    ],
    runLogs: [
      {
        id: "r1",
        timestamp: "2026-03-12T10:00:00Z",
        status: "running",
        duration: "2m 14s...",
        summary: "Scanning 4 platforms for brand mentions...",
      },
      {
        id: "r2",
        timestamp: "2026-03-11T10:00:00Z",
        status: "success",
        duration: "8m 45s",
        summary: "Found 23 mentions, 8 positive testimonials captured, 2 widgets generated",
      },
    ],
    schedule: "Every 6 hours",
    lastRun: "Running now",
    nextRun: "4:00 PM today",
  },
  {
    id: "data-enrichment-pipeline",
    name: "Data Enrichment Pipeline",
    blueprint: 7,
    description:
      "Cleans and enriches lead lists with firmographic data, validates emails, scores leads with Claude-powered ICP matching, and syncs enriched records to CRM.",
    longDescription:
      "Lead intelligence pipeline. Ingests raw lead CSVs, deduplicates and normalizes records with Pandas, enriches with firmographic data from Clearbit API, validates emails, runs each lead through Claude for ICP (Ideal Customer Profile) scoring, and syncs scored + enriched records to HubSpot CRM with proper field mapping.",
    status: "beta",
    techStack: ["Pandas", "Claude API", "Clearbit API", "HubSpot API"],
    category: "data",
    icon: "database",
    color: "#06B6D4",
    metrics: [
      { label: "Leads Enriched", value: "5.4K" },
      { label: "Match Rate", value: "87%" },
    ],
    configFields: [
      {
        id: "csv_source",
        label: "Lead CSV Source",
        type: "select",
        options: ["Upload CSV", "HubSpot Export", "Google Sheets URL", "Supabase Table"],
        defaultValue: "Upload CSV",
        required: true,
      },
      {
        id: "icp_description",
        label: "Ideal Customer Profile",
        type: "textarea",
        placeholder: "Mental health practice, 5-50 employees, located in Texas, accepting insurance...",
        required: true,
        helpText: "Describe your ideal customer. Claude uses this for lead scoring.",
      },
      {
        id: "min_score",
        label: "Min ICP Score to Sync",
        type: "number",
        placeholder: "70",
        defaultValue: 70,
        helpText: "Only leads scoring above this (0-100) get pushed to CRM.",
      },
      {
        id: "hubspot_pipeline",
        label: "HubSpot Pipeline",
        type: "text",
        placeholder: "New Leads",
        defaultValue: "New Leads",
      },
      {
        id: "validate_emails",
        label: "Email Validation",
        type: "toggle",
        defaultValue: true,
        helpText: "Verify email deliverability before enrichment.",
      },
      {
        id: "enrich_firmographic",
        label: "Firmographic Enrichment",
        type: "toggle",
        defaultValue: true,
        helpText: "Pull company size, revenue, industry from Clearbit.",
      },
    ],
    runLogs: [
      {
        id: "r1",
        timestamp: "2026-03-12T07:30:00Z",
        status: "success",
        duration: "6m 18s",
        summary: "Processed 245 leads: 198 enriched, 189 valid emails, 142 synced to HubSpot (ICP≥70)",
        details: [
          "CSV imported: 245 raw leads",
          "Deduplication: 12 duplicates removed → 233 unique",
          "Email validation: 189/233 valid (81.1%)",
          "Clearbit enrichment: 198/233 matched (85.0%)",
          "Claude ICP scoring: avg score 64.2, median 68",
          "HubSpot sync: 142 leads pushed (ICP score ≥ 70)",
        ],
      },
      {
        id: "r2",
        timestamp: "2026-03-10T15:00:00Z",
        status: "success",
        duration: "4m 02s",
        summary: "Processed 128 leads: 112 enriched, 96 synced to HubSpot",
      },
    ],
    schedule: "Manual",
    lastRun: "5 hours ago",
    nextRun: "Manual trigger",
  },
  {
    id: "ig-reels-generator",
    name: "IG Reels Generator",
    blueprint: 8,
    description:
      "Parses Obsidian knowledge vaults to extract topics, generates JSON storyboards with Claude, creates portrait background images with DALL-E 3, and outputs production-ready Reel assets.",
    longDescription:
      "Content repurposing engine for Instagram Reels. Scans Obsidian markdown vaults to extract high-value topic clusters, generates JSON storyboards (hook, body, CTA) with Claude, creates 1080×1920 background images with DALL-E 3, composites text overlays with Pillow, and exports MP4-ready image sequences for Reels production.",
    status: "development",
    techStack: ["Obsidian Parser", "Claude API", "DALL-E 3", "Pillow"],
    category: "content",
    icon: "film",
    color: "#E11D48",
    metrics: [
      { label: "Reels Created", value: "12" },
      { label: "Topics Mapped", value: "89" },
    ],
    configFields: [
      {
        id: "vault_path",
        label: "Obsidian Vault Path",
        type: "text",
        placeholder: "/path/to/obsidian/vault",
        required: true,
        helpText: "Local path or synced folder for your Obsidian vault.",
      },
      {
        id: "topic_filter",
        label: "Topic Filter Tags",
        type: "textarea",
        placeholder: "#content-idea\n#social-post\n#reel",
        helpText: "Only process notes with these tags.",
      },
      {
        id: "visual_style",
        label: "Visual Style",
        type: "select",
        options: ["Gradient Abstract", "Nature Calm", "Bold Typography", "Minimal White", "Dark Professional"],
        defaultValue: "Gradient Abstract",
      },
      {
        id: "include_cta",
        label: "Include CTA Slide",
        type: "toggle",
        defaultValue: true,
      },
      {
        id: "brand_handle",
        label: "Instagram Handle",
        type: "text",
        placeholder: "@yourbrand",
        helpText: "Watermarked on generated assets.",
      },
    ],
    runLogs: [
      {
        id: "r1",
        timestamp: "2026-03-11T16:00:00Z",
        status: "success",
        duration: "9m 42s",
        summary: "Scanned vault, extracted 5 topics, generated 5 Reel asset packs",
        details: [
          "Vault scan: 234 notes, 89 tagged with content-idea",
          "Topic extraction: 5 new clusters identified",
          "Claude storyboards: 5 JSON scripts generated (hook-body-CTA)",
          "DALL-E 3: 15 background images (3 per Reel)",
          "Pillow compositing: 15 text-overlay frames exported",
          "Output: 5 asset packs ready for IG upload",
        ],
      },
      {
        id: "r2",
        timestamp: "2026-03-09T12:00:00Z",
        status: "error",
        duration: "2m 15s",
        summary: "DALL-E API rate limit exceeded — 3 of 5 images generated",
      },
    ],
    schedule: "Weekly (Monday 9 AM)",
    lastRun: "Yesterday",
    nextRun: "Monday 9:00 AM",
  },
  {
    id: "seo-directory",
    name: "SEO Directory Builder",
    blueprint: 9,
    description:
      "End-to-end programmatic SEO directory: CSV data cleaning, async web crawling with BrightData proxies, Claude Vision image curation, Supabase storage, and a Next.js frontend with ISR and Schema.org markup.",
    longDescription:
      "Programmatic SEO directory generator. Cleans raw business data CSVs with Pandas, crawls business websites asynchronously using aiohttp + BrightData proxies, curates images through Claude Vision (quality scoring + relevance filtering), stores everything in Supabase, and deploys a Next.js frontend with ISR pages, Schema.org structured data, and automatic sitemap generation for each city/category combination.",
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
    configFields: [
      {
        id: "data_csv",
        label: "Business Data CSV",
        type: "select",
        options: ["Upload CSV", "Google Sheets URL", "Supabase Table"],
        defaultValue: "Upload CSV",
        required: true,
      },
      {
        id: "directory_name",
        label: "Directory Name",
        type: "text",
        placeholder: "Best Therapists In",
        required: true,
      },
      {
        id: "target_cities",
        label: "Target Cities",
        type: "textarea",
        placeholder: "Dallas, TX\nFort Worth, TX\nAustin, TX",
        required: true,
        helpText: "One city per line. Pages generated for each city.",
      },
      {
        id: "category_slug",
        label: "Category Slug",
        type: "text",
        placeholder: "therapists",
        required: true,
      },
      {
        id: "use_proxies",
        label: "Use BrightData Proxies",
        type: "toggle",
        defaultValue: true,
        helpText: "Route crawl requests through residential proxies to avoid blocks.",
      },
      {
        id: "auto_deploy",
        label: "Auto-Deploy to Vercel",
        type: "toggle",
        defaultValue: false,
        helpText: "Push generated Next.js site to Vercel on completion.",
      },
    ],
    runLogs: [
      {
        id: "r1",
        timestamp: "2026-03-10T14:00:00Z",
        status: "success",
        duration: "34m 18s",
        summary: "Processed 340 listings across 12 cities, deployed directory site",
        details: [
          "CSV cleaned: 340 valid listings from 412 raw rows",
          "Web crawl: 298/340 sites responded (87.6%)",
          "Claude Vision: 892 images scored, 654 passed quality threshold",
          "Supabase: 340 listings + 654 images stored",
          "Next.js: Generated 12 city pages + 340 listing pages",
          "Schema.org markup applied to all pages",
          "Sitemap: 352 URLs generated",
        ],
      },
      {
        id: "r2",
        timestamp: "2026-03-08T10:00:00Z",
        status: "success",
        duration: "22m 45s",
        summary: "Processed 180 listings across 6 cities",
      },
    ],
    schedule: "Weekly (Wednesday 2 PM)",
    lastRun: "2 days ago",
    nextRun: "Wednesday 2:00 PM",
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
