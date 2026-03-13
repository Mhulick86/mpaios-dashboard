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
    | "directory"
    | "email"
    | "analytics"
    | "leads"
    | "monitoring"
    | "video";
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
        status: "success",
        duration: "5m 48s",
        summary: "Retried with Stealth — Cloudflare bypassed, competitor3.com scraped successfully",
        details: [
          "Original run failed: Cloudflare challenge on competitor3.com",
          "Auto-retry triggered with Stealth (Anti-Detect) + Proxy Rotation",
          "Stealth fingerprint: Chrome 122, macOS, residential IP 74.x.x.x",
          "Cloudflare challenge solved in 2.3s ✓",
          "Scraped competitor3.com (22 sections detected)",
          "Claude Vision analysis — 91% CTA confidence score",
          "Generated 1 LP variant (SaaS Conversion) — 1,680 words",
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
    status: "beta",
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
    status: "beta",
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
  // ── n8n-Inspired Marketing Automation Tools ────────────────────────
  {
    id: "ga4-weekly-ai-report",
    name: "GA4 Weekly AI Report",
    blueprint: 10,
    description:
      "Pulls Google Analytics 4 data via Data API, feeds metrics to Claude for trend analysis, anomaly detection, and plain-English executive summaries delivered to Slack or email.",
    longDescription:
      "Automated analytics reporting engine. Connects to Google Analytics 4 Data API to pull weekly session, conversion, and engagement metrics. Claude analyzes week-over-week trends, flags anomalies (traffic drops, conversion spikes, unusual referral patterns), generates an executive summary with actionable recommendations, and distributes via Slack webhook or email. Includes optional comparison against previous period and custom dimension breakdowns.",
    status: "active",
    techStack: ["GA4 Data API", "Claude API", "Slack API", "Node.js"],
    category: "analytics",
    icon: "bar-chart-3",
    color: "#F97316",
    metrics: [
      { label: "Reports Sent", value: "42" },
      { label: "Anomalies Caught", value: "18" },
    ],
    configFields: [
      { id: "ga4_property_id", label: "GA4 Property ID", type: "text", placeholder: "properties/123456789", required: true },
      { id: "report_period", label: "Reporting Period", type: "select", options: ["Last 7 Days", "Last 14 Days", "Last 30 Days", "Month-to-Date"], defaultValue: "Last 7 Days" },
      { id: "compare_period", label: "Compare To", type: "select", options: ["Previous Period", "Same Period Last Year", "None"], defaultValue: "Previous Period" },
      { id: "delivery_channel", label: "Delivery Channel", type: "select", options: ["Slack", "Email", "Both"], defaultValue: "Slack" },
      { id: "slack_webhook", label: "Slack Webhook URL", type: "url", placeholder: "https://hooks.slack.com/services/..." },
      { id: "email_recipients", label: "Email Recipients", type: "textarea", placeholder: "cmo@company.com\nteam@company.com", helpText: "One email per line." },
      { id: "include_recommendations", label: "AI Recommendations", type: "toggle", defaultValue: true, helpText: "Include Claude-generated action items." },
    ],
    runLogs: [
      { id: "r1", timestamp: "2026-03-12T07:00:00Z", status: "success", duration: "2m 14s", summary: "Weekly report generated: +12% sessions WoW, 2 anomalies flagged, delivered to Slack", details: ["GA4 API: Pulled 7-day metrics for 14 dimensions", "WoW comparison: Sessions +12%, Conversions +8%, Bounce -3%", "Anomaly: Referral traffic from unknown.site spike (+400%)", "Anomaly: Mobile conversion rate drop (-22%)", "Claude summary: 485 words with 4 action items", "Delivered to #marketing-reports Slack channel"] },
      { id: "r2", timestamp: "2026-03-05T07:00:00Z", status: "success", duration: "1m 58s", summary: "Weekly report: -3% sessions, 1 anomaly, delivered to Slack + email" },
    ],
    schedule: "Weekly (Monday 7:00 AM)",
    lastRun: "Today 7:00 AM",
    nextRun: "Next Monday 7:00 AM",
  },
  {
    id: "gsc-performance-monitor",
    name: "GSC Performance Monitor",
    blueprint: 11,
    description:
      "Queries Google Search Console API for ranking changes, new keyword opportunities, and indexing issues. Claude generates prioritized SEO action plans from the data.",
    longDescription:
      "Search visibility monitoring system. Pulls daily data from Google Search Console API — impressions, clicks, CTR, and average position for all queries. Claude identifies ranking movements (gains/losses), discovers new keyword opportunities where impressions are rising but CTR is low, flags indexing errors, and produces a prioritized action plan. Results stored in Supabase for historical trending.",
    status: "active",
    techStack: ["Search Console API", "Claude API", "Supabase", "Node.js"],
    category: "seo",
    icon: "trending-up",
    color: "#08AE67",
    metrics: [
      { label: "Keywords Tracked", value: "2.8K" },
      { label: "Opportunities Found", value: "34" },
    ],
    configFields: [
      { id: "gsc_property", label: "GSC Property URL", type: "url", placeholder: "https://yoursite.com", required: true },
      { id: "lookback_days", label: "Lookback Period (days)", type: "number", placeholder: "28", defaultValue: 28 },
      { id: "min_impressions", label: "Min Impressions Threshold", type: "number", placeholder: "100", defaultValue: 100, helpText: "Only analyze queries above this impression count." },
      { id: "position_change_alert", label: "Position Change Alert", type: "number", placeholder: "5", defaultValue: 5, helpText: "Alert when position shifts by this many spots." },
      { id: "auto_create_tasks", label: "Auto-Create Asana Tasks", type: "toggle", defaultValue: true, helpText: "Create optimization tasks in Asana for flagged items." },
    ],
    runLogs: [
      { id: "r1", timestamp: "2026-03-12T06:30:00Z", status: "success", duration: "3m 42s", summary: "Analyzed 2,847 queries: 12 ranking gains, 5 losses, 8 new opportunities", details: ["GSC API: 2,847 queries with 100+ impressions over 28 days", "Ranking gains: 12 keywords improved 5+ positions", "Ranking losses: 5 keywords dropped 5+ positions", "New opportunities: 8 queries with 500+ impressions, <2% CTR", "Indexing: 3 new crawl errors detected", "Created 8 Asana tasks for SEO team review"] },
      { id: "r2", timestamp: "2026-03-11T06:30:00Z", status: "success", duration: "3m 18s", summary: "2,792 queries analyzed, 6 opportunities, 2 indexing errors" },
    ],
    schedule: "Daily at 6:30 AM",
    lastRun: "6 hours ago",
    nextRun: "Tomorrow 6:30 AM",
  },
  {
    id: "email-nurture-automator",
    name: "Email Nurture Automator",
    blueprint: 12,
    description:
      "Designs multi-step email nurture sequences with Claude, configures behavioral triggers, sets up A/B variants, and deploys to email platforms via API with full tracking.",
    longDescription:
      "Intelligent email sequence builder. Takes a campaign brief and funnel stage, uses Claude to generate personalized email sequences (subject lines, body copy, CTAs) for each segment. Configures behavioral triggers (opened, clicked, visited pricing page), creates A/B test variants for subject lines and send times, and deploys via email platform APIs (ActiveCampaign, Mailchimp, SendGrid). Monitors open rates, click rates, and conversion attribution.",
    status: "active",
    techStack: ["Claude API", "ActiveCampaign API", "SendGrid API", "Webhook"],
    category: "email",
    icon: "mail",
    color: "#7C3AED",
    metrics: [
      { label: "Sequences Active", value: "8" },
      { label: "Avg Open Rate", value: "34.2%" },
    ],
    configFields: [
      { id: "campaign_brief", label: "Campaign Brief", type: "textarea", placeholder: "New lead welcome sequence for mental health practice...", required: true, helpText: "Describe the audience, goal, and tone." },
      { id: "funnel_stage", label: "Funnel Stage", type: "select", options: ["Top of Funnel (Awareness)", "Middle of Funnel (Consideration)", "Bottom of Funnel (Decision)", "Post-Purchase (Retention)"], required: true },
      { id: "sequence_length", label: "Number of Emails", type: "number", placeholder: "5", defaultValue: 5 },
      { id: "email_platform", label: "Email Platform", type: "select", options: ["ActiveCampaign", "Mailchimp", "SendGrid", "HubSpot", "ConvertKit"], defaultValue: "ActiveCampaign" },
      { id: "ab_test", label: "A/B Test Subject Lines", type: "toggle", defaultValue: true },
      { id: "send_frequency", label: "Email Spacing", type: "select", options: ["Every Day", "Every 2 Days", "Every 3 Days", "Weekly"], defaultValue: "Every 2 Days" },
      { id: "brand_voice", label: "Brand Voice", type: "select", options: ["Professional & Warm", "Casual & Friendly", "Clinical & Authoritative", "Empathetic & Supportive"], defaultValue: "Professional & Warm" },
    ],
    runLogs: [
      { id: "r1", timestamp: "2026-03-12T10:30:00Z", status: "success", duration: "5m 22s", summary: "Generated 5-email welcome sequence with A/B variants, deployed to ActiveCampaign", details: ["Claude: Generated 5 emails (avg 280 words each)", "Subject line A/B: 10 variants created (2 per email)", "Behavioral triggers: Open → wait 2d → next; No open → resend with variant B", "ActiveCampaign: Sequence deployed to 'New Leads' automation", "Tracking: UTM parameters + conversion pixel configured"] },
      { id: "r2", timestamp: "2026-03-10T14:00:00Z", status: "success", duration: "4m 48s", summary: "Generated 4-email re-engagement sequence for inactive subscribers" },
    ],
    schedule: "Manual",
    lastRun: "2 hours ago",
    nextRun: "Manual trigger",
  },
  {
    id: "email-reply-classifier",
    name: "Email Reply Classifier",
    blueprint: 13,
    description:
      "Monitors inbound email replies, classifies intent with Claude (interested, objection, unsubscribe, OOO, spam), routes to appropriate team member, and auto-drafts responses.",
    longDescription:
      "AI-powered email triage system. Connects to Gmail/Outlook via API to monitor campaign reply inboxes. Claude classifies each reply by intent (interested/warm, objection/concern, unsubscribe request, out-of-office, spam/irrelevant) and sentiment. Routes high-intent replies to sales team immediately via Slack, auto-processes unsubscribe requests, and drafts contextual follow-up responses for review. Tracks reply rate and intent distribution per campaign.",
    status: "active",
    techStack: ["Gmail API", "Claude API", "Slack API", "Supabase"],
    category: "email",
    icon: "inbox",
    color: "#7C3AED",
    metrics: [
      { label: "Replies Classified", value: "847" },
      { label: "Accuracy", value: "96.4%" },
    ],
    configFields: [
      { id: "inbox_connection", label: "Email Provider", type: "select", options: ["Gmail", "Outlook/365", "IMAP Custom"], defaultValue: "Gmail", required: true },
      { id: "inbox_label", label: "Monitor Label/Folder", type: "text", placeholder: "Campaign Replies", helpText: "Only monitor this label or folder." },
      { id: "slack_channel", label: "Sales Alert Channel", type: "text", placeholder: "#sales-leads", helpText: "Slack channel for high-intent reply alerts." },
      { id: "auto_draft_replies", label: "Auto-Draft Responses", type: "toggle", defaultValue: true, helpText: "Generate draft follow-ups for interested replies." },
      { id: "auto_unsubscribe", label: "Auto-Process Unsubscribes", type: "toggle", defaultValue: true, helpText: "Automatically handle unsubscribe requests." },
    ],
    runLogs: [
      { id: "r1", timestamp: "2026-03-12T11:00:00Z", status: "success", duration: "1m 45s", summary: "Processed 14 replies: 3 interested → Slack, 2 objections → drafted, 4 OOO, 5 spam", details: ["Inbox scan: 14 new replies in 'Campaign Replies'", "Interested (3): Routed to #sales-leads with context", "Objections (2): Auto-drafted empathetic follow-ups for review", "Out-of-Office (4): Flagged for re-send after return date", "Spam/Irrelevant (5): Archived automatically"] },
    ],
    schedule: "Every 30 minutes",
    lastRun: "12 minutes ago",
    nextRun: "In 18 minutes",
  },
  {
    id: "social-content-amplifier",
    name: "Social Content Amplifier",
    blueprint: 14,
    description:
      "Transforms long-form content (blogs, podcasts, videos) into platform-optimized social posts for LinkedIn, Twitter/X, Instagram, and Facebook with scheduled publishing.",
    longDescription:
      "Content atomization engine. Takes a single authority content piece (blog post URL, podcast transcript, or video transcript) and uses Claude to generate platform-specific derivative content: LinkedIn thought leadership posts, Twitter/X threads, Instagram carousel copy, Facebook posts, and YouTube Community posts. Each output is optimized for the platform's algorithm, character limits, and engagement patterns. Publishes on schedule via platform APIs or Buffer/Hootsuite.",
    status: "active",
    techStack: ["Claude API", "Buffer API", "LinkedIn API", "Twitter API"],
    category: "social",
    icon: "share-2",
    color: "#EC4899",
    metrics: [
      { label: "Posts Generated", value: "234" },
      { label: "Avg Engagement", value: "4.7%" },
    ],
    configFields: [
      { id: "source_url", label: "Source Content URL", type: "url", placeholder: "https://yourblog.com/authority-article", required: true, helpText: "Blog post, podcast, or video URL to repurpose." },
      { id: "source_type", label: "Source Type", type: "select", options: ["Blog Post", "Podcast Episode", "YouTube Video", "Webinar Recording", "Whitepaper/PDF"], defaultValue: "Blog Post" },
      { id: "platforms", label: "Target Platforms", type: "select", options: ["All Platforms", "LinkedIn + Twitter", "Instagram + Facebook", "LinkedIn Only", "Twitter Only"], defaultValue: "All Platforms" },
      { id: "posts_per_platform", label: "Posts Per Platform", type: "number", placeholder: "3", defaultValue: 3, helpText: "Number of unique posts to generate per platform." },
      { id: "publishing_tool", label: "Publishing Tool", type: "select", options: ["Buffer", "Hootsuite", "Direct API", "Export Only"], defaultValue: "Buffer" },
      { id: "schedule_spread", label: "Posting Schedule", type: "select", options: ["Spread over 1 week", "Spread over 2 weeks", "All at once", "Custom"], defaultValue: "Spread over 1 week" },
      { id: "include_hashtags", label: "Auto-Generate Hashtags", type: "toggle", defaultValue: true },
    ],
    runLogs: [
      { id: "r1", timestamp: "2026-03-12T09:00:00Z", status: "success", duration: "3m 38s", summary: "Blog post atomized into 12 social posts across 4 platforms, scheduled over 1 week", details: ["Source: 'The Complete Guide to LLMO' (2,400 words)", "LinkedIn: 3 posts (thought leadership angle, avg 180 words)", "Twitter/X: 3 threads (5-7 tweets each, hook-driven)", "Instagram: 3 carousel scripts (10 slides each)", "Facebook: 3 posts (community-focused, 120 words avg)", "Buffer: All 12 posts scheduled over 7 days"] },
      { id: "r2", timestamp: "2026-03-11T09:00:00Z", status: "success", duration: "4m 12s", summary: "Podcast episode repurposed into 9 social posts" },
    ],
    schedule: "Manual",
    lastRun: "3 hours ago",
    nextRun: "Manual trigger",
  },
  {
    id: "instagram-trend-engine",
    name: "Instagram Trend Engine",
    blueprint: 15,
    description:
      "Monitors trending audio, hashtags, and content formats on Instagram. Generates branded Reels concepts, caption copy, and carousel content aligned with current trends.",
    longDescription:
      "Trend-reactive Instagram content system. Scrapes Instagram Explore, trending audio, and competitor accounts to identify rising trends, viral formats, and high-engagement content patterns. Claude maps trends to brand relevance, generates Reels scripts with hook/body/CTA structure, writes carousel slide copy, and produces optimized captions with strategic hashtag sets. Outputs a weekly content calendar with trend-aligned posting recommendations.",
    status: "beta",
    techStack: ["Instagram Graph API", "Claude API", "Apify", "Node.js"],
    category: "social",
    icon: "camera",
    color: "#E11D48",
    metrics: [
      { label: "Trends Tracked", value: "156" },
      { label: "Content Ideas", value: "89" },
    ],
    configFields: [
      { id: "ig_account", label: "Instagram Handle", type: "text", placeholder: "@yourbrand", required: true },
      { id: "competitor_accounts", label: "Competitor Accounts", type: "textarea", placeholder: "@competitor1\n@competitor2\n@competitor3", helpText: "Track these accounts for trend signals." },
      { id: "brand_niche", label: "Brand Niche", type: "select", options: ["Health & Wellness", "SaaS / Tech", "E-commerce / DTC", "Professional Services", "Education", "Real Estate", "Finance"], defaultValue: "Health & Wellness" },
      { id: "content_types", label: "Content Types", type: "select", options: ["Reels + Carousels + Stories", "Reels Only", "Carousels Only", "All Formats"], defaultValue: "Reels + Carousels + Stories" },
      { id: "weekly_output", label: "Content Pieces Per Week", type: "number", placeholder: "5", defaultValue: 5 },
    ],
    runLogs: [
      { id: "r1", timestamp: "2026-03-12T08:00:00Z", status: "success", duration: "6m 18s", summary: "Identified 8 trending formats, generated 5 Reels scripts + 3 carousel concepts", details: ["Trend scan: 156 trending audios, 42 viral formats analyzed", "Brand relevance: 8 trends matched to health/wellness niche", "Reels scripts: 5 generated (hook + 15-30s body + CTA)", "Carousel concepts: 3 designed (10 slides each)", "Caption copy: 8 captions with hashtag sets (avg 22 hashtags)", "Weekly calendar: Published to shared Google Sheet"] },
    ],
    schedule: "Weekly (Sunday 8:00 AM)",
    lastRun: "Today 8:00 AM",
    nextRun: "Next Sunday 8:00 AM",
  },
  {
    id: "lead-qualifier-ai",
    name: "AI Lead Qualifier",
    blueprint: 16,
    description:
      "Captures inbound leads from web forms, enriches with company data, scores with Claude-powered ICP matching, and routes qualified leads to sales with personalized talking points.",
    longDescription:
      "Intelligent lead qualification pipeline. Receives leads from webhook-connected forms (Typeform, HubSpot, custom), enriches with firmographic data (Clearbit/Apollo), scores against Ideal Customer Profile using Claude analysis, and routes qualified leads to appropriate sales reps via Slack with AI-generated talking points, company research summary, and recommended next steps. Unqualified leads enter nurture sequences automatically.",
    status: "active",
    techStack: ["Webhook", "Clearbit API", "Claude API", "Slack API", "HubSpot API"],
    category: "leads",
    icon: "user-check",
    color: "#10B981",
    metrics: [
      { label: "Leads Qualified", value: "342" },
      { label: "Qualification Rate", value: "38%" },
    ],
    configFields: [
      { id: "webhook_url", label: "Form Webhook Source", type: "select", options: ["Typeform", "HubSpot Forms", "Custom Webhook", "Gravity Forms", "Tally"], defaultValue: "HubSpot Forms", required: true },
      { id: "icp_criteria", label: "ICP Criteria", type: "textarea", placeholder: "Company size: 10-500 employees\nIndustry: Healthcare, Mental Health\nRevenue: $1M-$50M\nDecision maker title: CEO, CMO, Director...", required: true },
      { id: "min_score", label: "Min Qualification Score", type: "number", placeholder: "70", defaultValue: 70, helpText: "Leads below this score go to nurture." },
      { id: "enrichment_provider", label: "Enrichment Provider", type: "select", options: ["Clearbit", "Apollo", "ZoomInfo", "None"], defaultValue: "Clearbit" },
      { id: "sales_channel", label: "Sales Notification", type: "select", options: ["Slack DM to Owner", "Slack Channel", "Email + Slack", "HubSpot Task"], defaultValue: "Slack Channel" },
      { id: "auto_nurture", label: "Auto-Nurture Unqualified", type: "toggle", defaultValue: true, helpText: "Add low-score leads to email nurture sequence." },
    ],
    runLogs: [
      { id: "r1", timestamp: "2026-03-12T11:22:00Z", status: "success", duration: "45s", summary: "New lead qualified (score: 87) — routed to sales with talking points", details: ["Lead: Sarah Chen, VP Marketing at MindWell Therapy Group", "Enrichment: 45 employees, $8M revenue, Austin TX", "ICP Score: 87/100 (Healthcare ✓, Size ✓, Decision Maker ✓)", "Claude talking points: 3 personalized openers generated", "Routed to #qualified-leads + DM to account owner"] },
      { id: "r2", timestamp: "2026-03-12T10:45:00Z", status: "success", duration: "38s", summary: "Lead scored 42 — added to mid-funnel nurture sequence" },
    ],
    schedule: "Real-time (webhook)",
    lastRun: "40 minutes ago",
    nextRun: "On next form submission",
  },
  {
    id: "sentiment-feedback-analyzer",
    name: "Sentiment & Feedback Analyzer",
    blueprint: 17,
    description:
      "Aggregates customer feedback from reviews, support tickets, and social mentions. Claude performs sentiment analysis, extracts themes, and generates insight reports with trend tracking.",
    longDescription:
      "Voice-of-customer intelligence engine. Pulls customer feedback from multiple sources: Google Reviews, Trustpilot, G2, Zendesk tickets, and social mentions. Claude performs deep sentiment analysis (positive/negative/neutral with confidence scores), extracts recurring themes and pain points, identifies trending sentiment shifts, and generates weekly insight reports. Stores all data in a vector database for historical querying and long-term trend analysis.",
    status: "active",
    techStack: ["Google Places API", "Trustpilot API", "Claude API", "Pinecone", "Supabase"],
    category: "monitoring",
    icon: "message-circle",
    color: "#0EA5E9",
    metrics: [
      { label: "Reviews Analyzed", value: "1.8K" },
      { label: "Avg Sentiment", value: "0.78" },
    ],
    configFields: [
      { id: "google_place_id", label: "Google Place ID", type: "text", placeholder: "ChIJ...", helpText: "For Google Reviews monitoring." },
      { id: "trustpilot_domain", label: "Trustpilot Domain", type: "text", placeholder: "yourcompany.com" },
      { id: "review_sources", label: "Review Sources", type: "select", options: ["All Sources", "Google + Trustpilot", "Google Only", "Support Tickets Only"], defaultValue: "All Sources" },
      { id: "alert_threshold", label: "Negative Sentiment Alert", type: "number", placeholder: "0.3", defaultValue: 0.3, helpText: "Alert when sentiment drops below this (0-1 scale)." },
      { id: "report_frequency", label: "Report Frequency", type: "select", options: ["Daily", "Weekly", "Bi-Weekly", "Monthly"], defaultValue: "Weekly" },
      { id: "vector_storage", label: "Store in Vector DB", type: "toggle", defaultValue: true, helpText: "Enable historical querying and trend analysis." },
    ],
    runLogs: [
      { id: "r1", timestamp: "2026-03-12T08:00:00Z", status: "success", duration: "4m 22s", summary: "Analyzed 47 new reviews: avg sentiment 0.82, 3 themes extracted, 1 alert triggered", details: ["Google Reviews: 28 new (avg 4.2 stars)", "Trustpilot: 12 new (avg 4.0 stars)", "Social mentions: 7 new (5 positive, 2 neutral)", "Theme extraction: 'Wait times' (neg), 'Staff friendliness' (pos), 'Online booking' (pos)", "Alert: 3 reviews mention long wait times (sentiment 0.28)", "Pinecone: 47 vectors stored for historical analysis"] },
    ],
    schedule: "Daily at 8:00 AM",
    lastRun: "4 hours ago",
    nextRun: "Tomorrow 8:00 AM",
  },
  {
    id: "blog-brand-voice-writer",
    name: "Blog Brand Voice Writer",
    blueprint: 18,
    description:
      "Generates long-form blog content that matches your exact brand voice. Trained on existing content samples, produces SEO-optimized articles with internal linking and schema markup.",
    longDescription:
      "Brand-consistent content generation system. Analyzes your existing blog posts, website copy, and style guides to build a brand voice profile. When given a topic and target keyword, Claude generates long-form articles (1,500-3,000 words) that match your voice precisely, includes strategic internal links, adds FAQ schema markup, generates meta descriptions, and produces DALL-E hero images. Content goes through an automated readability and brand compliance check before publishing to WordPress.",
    status: "active",
    techStack: ["Claude API", "WordPress API", "DALL-E 3", "Yoast API"],
    category: "content",
    icon: "pen-tool",
    color: "#8B5CF6",
    metrics: [
      { label: "Articles Written", value: "38" },
      { label: "Avg Read Time", value: "7.2m" },
    ],
    configFields: [
      { id: "topic", label: "Article Topic", type: "text", placeholder: "Benefits of EMDR Therapy for PTSD", required: true },
      { id: "target_keyword", label: "Target Keyword", type: "text", placeholder: "EMDR therapy benefits", required: true },
      { id: "word_count", label: "Target Word Count", type: "select", options: ["1,500 words", "2,000 words", "2,500 words", "3,000 words"], defaultValue: "2,000 words" },
      { id: "voice_samples", label: "Brand Voice Sample URLs", type: "textarea", placeholder: "https://yourblog.com/sample-post-1\nhttps://yourblog.com/sample-post-2", helpText: "Existing content to train voice matching. 3-5 URLs recommended." },
      { id: "internal_links", label: "Internal Link Targets", type: "textarea", placeholder: "/services/emdr\n/about/our-therapists", helpText: "Pages to strategically link to. One per line." },
      { id: "auto_publish", label: "Auto-Publish", type: "toggle", defaultValue: false, helpText: "Publish directly or save as draft for review." },
      { id: "generate_images", label: "Generate Hero Image", type: "toggle", defaultValue: true },
    ],
    runLogs: [
      { id: "r1", timestamp: "2026-03-12T10:00:00Z", status: "success", duration: "7m 45s", summary: "Generated 2,100-word article with hero image, 4 internal links, FAQ schema — saved as draft", details: ["Brand voice analysis: 5 sample posts analyzed, voice profile built", "Article: 2,100 words, Flesch-Kincaid grade 8.2", "Internal links: 4 strategic links inserted", "FAQ schema: 5 questions generated and marked up", "DALL-E 3: Hero image generated (1200x630)", "Meta: Title (58 chars) + description (155 chars)", "WordPress: Saved as draft in 'Blog' category"] },
    ],
    schedule: "Manual",
    lastRun: "2 hours ago",
    nextRun: "Manual trigger",
  },
  {
    id: "wordpress-auto-tagger",
    name: "WordPress Auto-Tagger",
    blueprint: 19,
    description:
      "Automatically categorizes, tags, and adds internal links to WordPress posts using Claude NLP analysis. Maintains taxonomic consistency across your content library.",
    longDescription:
      "Content taxonomy automation for WordPress. Scans new and existing posts via WordPress REST API, uses Claude to analyze content and assign relevant categories, tags, and internal cross-links. Ensures consistent taxonomy usage across the blog, identifies orphan content (posts with no internal links), and suggests content clusters. Runs on a schedule to process new posts and periodically re-evaluates older content for linking opportunities.",
    status: "beta",
    techStack: ["WordPress API", "Claude API", "Node.js"],
    category: "content",
    icon: "tags",
    color: "#8B5CF6",
    metrics: [
      { label: "Posts Processed", value: "234" },
      { label: "Links Added", value: "412" },
    ],
    configFields: [
      { id: "wordpress_url", label: "WordPress Site URL", type: "url", placeholder: "https://yoursite.com", required: true },
      { id: "process_scope", label: "Process Scope", type: "select", options: ["New Posts Only", "All Published Posts", "Posts from Last 30 Days", "Drafts Only"], defaultValue: "New Posts Only" },
      { id: "max_tags", label: "Max Tags Per Post", type: "number", placeholder: "8", defaultValue: 8 },
      { id: "auto_internal_link", label: "Auto Internal Linking", type: "toggle", defaultValue: true, helpText: "Insert contextual links to related posts." },
      { id: "max_links_per_post", label: "Max Links Per Post", type: "number", placeholder: "5", defaultValue: 5 },
    ],
    runLogs: [
      { id: "r1", timestamp: "2026-03-12T06:00:00Z", status: "success", duration: "3m 12s", summary: "Processed 4 new posts: 28 tags assigned, 12 internal links added", details: ["WordPress API: 4 new posts detected since last run", "Claude analysis: Content classified across 6 categories", "Tags: 28 total assigned (avg 7 per post)", "Internal links: 12 contextual links inserted (avg 3 per post)", "Orphan check: 0 orphan posts found"] },
    ],
    schedule: "Daily at 6:00 AM",
    lastRun: "6 hours ago",
    nextRun: "Tomorrow 6:00 AM",
  },
  {
    id: "youtube-trend-finder",
    name: "YouTube Trend Finder",
    blueprint: 20,
    description:
      "Discovers trending YouTube topics in your niche, analyzes top-performing videos, extracts content patterns, and generates video briefs with title/thumbnail/script recommendations.",
    longDescription:
      "YouTube content intelligence tool. Monitors YouTube Data API for trending videos in your niche, analyzes top performers for content patterns (hook structure, video length, engagement triggers), scrapes transcripts via Whisper for topic extraction, and generates actionable video briefs. Each brief includes title options (optimized for CTR), thumbnail concepts, script outlines, and competitive positioning recommendations. Claude identifies content gaps where demand exceeds supply.",
    status: "beta",
    techStack: ["YouTube Data API", "Whisper API", "Claude API", "Node.js"],
    category: "video",
    icon: "play-circle",
    color: "#DC2626",
    metrics: [
      { label: "Trends Tracked", value: "67" },
      { label: "Briefs Generated", value: "24" },
    ],
    configFields: [
      { id: "niche_keywords", label: "Niche Keywords", type: "textarea", placeholder: "mental health therapy\nanxiety treatment\nEMDR therapy", required: true, helpText: "Keywords defining your YouTube niche." },
      { id: "competitor_channels", label: "Competitor Channels", type: "textarea", placeholder: "UCxxxxxxxx\nUCyyyyyyyy", helpText: "YouTube channel IDs to monitor." },
      { id: "min_views", label: "Min Views Threshold", type: "number", placeholder: "10000", defaultValue: 10000, helpText: "Only analyze videos above this view count." },
      { id: "lookback_days", label: "Lookback Period", type: "number", placeholder: "14", defaultValue: 14 },
      { id: "briefs_per_run", label: "Briefs to Generate", type: "number", placeholder: "3", defaultValue: 3 },
      { id: "include_scripts", label: "Generate Script Outlines", type: "toggle", defaultValue: true },
    ],
    runLogs: [
      { id: "r1", timestamp: "2026-03-11T10:00:00Z", status: "success", duration: "8m 34s", summary: "Analyzed 45 trending videos, generated 3 video briefs with scripts", details: ["YouTube API: 45 videos trending in mental health niche", "Transcript analysis: Top 15 videos transcribed via Whisper", "Pattern extraction: Hook-in-first-5s used by 80% of top performers", "Content gaps: 'EMDR for children' — high search, low competition", "Briefs: 3 generated with 5 title options each", "Scripts: 3 outline scripts (8-12 min format)"] },
    ],
    schedule: "Weekly (Thursday 10:00 AM)",
    lastRun: "Yesterday",
    nextRun: "Thursday 10:00 AM",
  },
  {
    id: "utm-campaign-tracker",
    name: "UTM Campaign Tracker",
    blueprint: 21,
    description:
      "Generates consistent UTM-tagged URLs for all campaigns, tracks performance across channels, and produces unified attribution reports combining GA4 + ad platform data.",
    longDescription:
      "Campaign attribution management system. Generates standardized UTM parameters for all marketing links using configurable naming conventions. Tracks UTM-tagged URLs across GA4, ad platforms, and email tools. Aggregates data into unified attribution reports showing true channel contribution, first-touch vs last-touch attribution comparison, and cross-channel journey analysis. Claude identifies the highest-performing channel combinations and recommends budget allocation shifts.",
    status: "active",
    techStack: ["GA4 Data API", "Google Sheets API", "Claude API", "Bitly API"],
    category: "analytics",
    icon: "link",
    color: "#F97316",
    metrics: [
      { label: "URLs Tracked", value: "1.2K" },
      { label: "Campaigns Active", value: "18" },
    ],
    configFields: [
      { id: "campaign_name", label: "Campaign Name", type: "text", placeholder: "spring-2026-launch", required: true },
      { id: "base_url", label: "Base URL", type: "url", placeholder: "https://yoursite.com/landing-page", required: true },
      { id: "channels", label: "Channels to Generate", type: "select", options: ["All Channels", "Paid + Social", "Email + Social", "Custom"], defaultValue: "All Channels" },
      { id: "url_shortener", label: "URL Shortener", type: "select", options: ["Bitly", "Short.io", "None (Full URL)"], defaultValue: "Bitly" },
      { id: "naming_convention", label: "Naming Convention", type: "select", options: ["Lowercase Hyphens", "Lowercase Underscores", "CamelCase"], defaultValue: "Lowercase Hyphens" },
      { id: "sheet_export", label: "Export to Google Sheet", type: "toggle", defaultValue: true, helpText: "Add UTM URLs to shared tracking sheet." },
    ],
    runLogs: [
      { id: "r1", timestamp: "2026-03-12T09:30:00Z", status: "success", duration: "1m 22s", summary: "Generated 24 UTM URLs across 6 channels, shortened via Bitly, added to tracking sheet", details: ["Campaign: spring-2026-launch", "URLs: 24 generated (4 per channel × 6 channels)", "Channels: Google Ads, Meta Ads, LinkedIn, Twitter, Email, Organic Social", "Bitly: 24 short URLs created", "Google Sheets: URLs + parameters added to 'Campaign Tracker' sheet"] },
    ],
    schedule: "Manual",
    lastRun: "3 hours ago",
    nextRun: "Manual trigger",
  },
  {
    id: "competitor-ad-monitor",
    name: "Competitor Ad Monitor",
    blueprint: 22,
    description:
      "Continuously monitors competitor ad activity across Meta, Google, and LinkedIn. Detects new creatives, messaging shifts, and budget changes with AI-powered strategic analysis.",
    longDescription:
      "Competitive advertising intelligence system. Monitors Meta Ad Library, Google Ads Transparency Center, and LinkedIn Ad Library for competitor ad activity. Detects new creatives, tracks messaging themes over time, estimates budget shifts from impression volume changes, and captures landing page screenshots via Playwright. Claude analyzes strategic implications and generates actionable intelligence briefs — identifying competitor positioning shifts, new audience targeting, and creative fatigue patterns.",
    status: "active",
    techStack: ["Meta Ad Library API", "Playwright", "Claude Vision", "Supabase"],
    category: "ads",
    icon: "eye",
    color: "#F59E0B",
    metrics: [
      { label: "Competitors Tracked", value: "12" },
      { label: "Ads Captured", value: "847" },
    ],
    configFields: [
      { id: "competitor_pages", label: "Competitor Facebook Pages", type: "textarea", placeholder: "competitor1\ncompetitor2\ncompetitor3", required: true, helpText: "Facebook page usernames to monitor." },
      { id: "platforms", label: "Platforms to Monitor", type: "select", options: ["Meta + Google + LinkedIn", "Meta Only", "Google Only", "Meta + Google"], defaultValue: "Meta + Google + LinkedIn" },
      { id: "capture_landing_pages", label: "Capture Landing Pages", type: "toggle", defaultValue: true, helpText: "Screenshot competitor landing pages linked from ads." },
      { id: "alert_on_new", label: "Alert on New Creatives", type: "toggle", defaultValue: true, helpText: "Slack alert when competitors launch new ads." },
      { id: "analysis_depth", label: "Analysis Depth", type: "select", options: ["Quick Scan", "Standard", "Deep Analysis (with Vision)"], defaultValue: "Standard" },
      { id: "alert_channel", label: "Alert Slack Channel", type: "text", placeholder: "#competitive-intel" },
    ],
    runLogs: [
      { id: "r1", timestamp: "2026-03-12T07:00:00Z", status: "success", duration: "8m 56s", summary: "Scanned 12 competitors: 7 new ads detected, 2 messaging shifts flagged, 1 budget increase estimated", details: ["Meta Ad Library: 12 pages scanned, 7 new creatives found", "Google Transparency: 4 new search ads detected", "Landing pages: 7 screenshots captured via Playwright", "Claude Vision: Creative analysis complete on 7 new ads", "Messaging shift: CompetitorA pivoted to 'insurance accepted' messaging", "Budget alert: CompetitorB estimated +40% spend increase", "Slack: Intelligence brief sent to #competitive-intel"] },
    ],
    schedule: "Daily at 7:00 AM",
    lastRun: "5 hours ago",
    nextRun: "Tomorrow 7:00 AM",
  },
  {
    id: "cro-ab-test-engine",
    name: "CRO A/B Test Engine",
    blueprint: 23,
    description:
      "Analyzes landing pages for conversion bottlenecks, generates A/B test hypotheses with Claude, creates variant copy/layout, and tracks results with statistical significance calculation.",
    longDescription:
      "Conversion rate optimization automation. Analyzes landing page performance data from GA4 and heatmap tools, identifies conversion bottlenecks (high bounce sections, low-scroll depth, form abandonment). Claude generates prioritized A/B test hypotheses using the ICE framework (Impact, Confidence, Effort), creates variant copy for headlines, CTAs, social proof sections, and form layouts. Integrates with VWO/Optimizely to deploy tests and monitors until statistical significance is reached.",
    status: "beta",
    techStack: ["GA4 Data API", "Claude API", "VWO API", "Hotjar API"],
    category: "funnel",
    icon: "split",
    color: "#8B5CF6",
    metrics: [
      { label: "Tests Run", value: "18" },
      { label: "Avg Lift", value: "+14.3%" },
    ],
    configFields: [
      { id: "landing_page_url", label: "Landing Page URL", type: "url", placeholder: "https://yoursite.com/landing", required: true },
      { id: "testing_tool", label: "Testing Platform", type: "select", options: ["VWO", "Optimizely", "Google Optimize", "Manual Implementation"], defaultValue: "VWO" },
      { id: "test_elements", label: "Elements to Test", type: "select", options: ["Headlines + CTAs", "Full Page Layout", "Form Fields", "Social Proof Placement", "All Elements"], defaultValue: "Headlines + CTAs" },
      { id: "min_sample_size", label: "Min Sample Size", type: "number", placeholder: "1000", defaultValue: 1000, helpText: "Visitors per variant before declaring results." },
      { id: "confidence_level", label: "Statistical Confidence", type: "select", options: ["90%", "95%", "99%"], defaultValue: "95%" },
      { id: "max_variants", label: "Max Variants Per Test", type: "number", placeholder: "3", defaultValue: 3, helpText: "Including control." },
    ],
    runLogs: [
      { id: "r1", timestamp: "2026-03-11T14:00:00Z", status: "success", duration: "5m 18s", summary: "Analyzed /intake page: 3 bottlenecks found, 2 A/B tests created with variant copy", details: ["GA4: /intake page — 62% bounce, 3.2% conversion, 45% scroll depth", "Bottleneck 1: Hero headline weak CTR (below fold attention drop)", "Bottleneck 2: Form too long (6 fields, 34% abandonment)", "Bottleneck 3: No social proof above fold", "Test 1: Hero headline — 3 variants (empathy, urgency, benefit-led)", "Test 2: Short form (3 fields) vs long form (6 fields)", "VWO: Both tests deployed, targeting 1,000 visitors each"] },
    ],
    schedule: "Manual",
    lastRun: "Yesterday",
    nextRun: "Manual trigger",
  },
  {
    id: "brand-mention-radar",
    name: "Brand Mention Radar",
    blueprint: 24,
    description:
      "Real-time monitoring of brand mentions across web, social, forums, and news. AI-powered sentiment classification with instant alerts for negative mentions and PR opportunities.",
    longDescription:
      "Comprehensive brand monitoring system. Tracks brand mentions across Twitter/X, Reddit, Hacker News, Google News, industry forums, and review sites in real-time. Claude classifies each mention by sentiment, intent (praise, complaint, question, comparison), and urgency. High-priority mentions (negative with high reach, journalist inquiries, viral potential) trigger instant Slack alerts. Generates daily digests with mention volume trends, sentiment shifts, and recommended responses for the community management team.",
    status: "active",
    techStack: ["Twitter API", "Reddit API", "Google Alerts", "Claude API", "Slack API"],
    category: "monitoring",
    icon: "radar",
    color: "#0EA5E9",
    metrics: [
      { label: "Mentions/Day", value: "34" },
      { label: "Response Time", value: "<15m" },
    ],
    configFields: [
      { id: "brand_terms", label: "Brand Terms to Monitor", type: "textarea", placeholder: "Your Brand\n@yourbrand\nyourbrand.com\nCEO Name", required: true, helpText: "All variations of brand name. One per line." },
      { id: "platforms", label: "Monitoring Platforms", type: "select", options: ["All Platforms", "Social Only", "News + Forums", "Reviews Only"], defaultValue: "All Platforms" },
      { id: "alert_urgency", label: "Alert Threshold", type: "select", options: ["All Mentions", "Negative Only", "High-Reach Only", "Negative + High-Reach"], defaultValue: "Negative + High-Reach" },
      { id: "slack_channel", label: "Alert Channel", type: "text", placeholder: "#brand-mentions" },
      { id: "auto_draft_response", label: "Auto-Draft Responses", type: "toggle", defaultValue: true, helpText: "Generate suggested responses for negative mentions." },
      { id: "digest_frequency", label: "Digest Frequency", type: "select", options: ["Real-time only", "Daily Digest", "Weekly Digest", "Daily + Weekly"], defaultValue: "Daily Digest" },
    ],
    runLogs: [
      { id: "r1", timestamp: "2026-03-12T11:30:00Z", status: "success", duration: "2m 08s", summary: "Scanned 6 platforms: 34 mentions found, 2 negative flagged, 1 PR opportunity detected", details: ["Twitter/X: 18 mentions (15 positive, 2 neutral, 1 negative)", "Reddit: 6 mentions (4 positive, 2 questions)", "Google News: 3 articles mentioning brand", "Review sites: 5 new reviews (avg 4.3 stars)", "Forums: 2 mentions in industry threads", "Alert: Negative tweet from account with 45K followers — response drafted", "PR: Healthcare industry blog mentioned brand positively — outreach drafted"] },
    ],
    schedule: "Every 2 hours",
    lastRun: "45 minutes ago",
    nextRun: "In 75 minutes",
  },
  {
    id: "ai-search-visibility",
    name: "AI Search Visibility (LLMO)",
    blueprint: 25,
    description:
      "Monitors brand presence across AI search platforms (ChatGPT, Claude, Perplexity, Google AI Overviews). Tracks citation frequency, identifies gaps, and optimizes content for AI visibility.",
    longDescription:
      "Large Language Model Optimization (LLMO) tool. Systematically queries major AI platforms (ChatGPT, Claude, Perplexity, Google AI Overviews, Bing Copilot) with industry-relevant questions to measure how often your brand is cited vs competitors. Identifies content gaps where competitors are cited but you're not, recommends schema markup and structured data enhancements, and generates AI-friendly FAQ content designed to be cited by language models. Tracks visibility score over time.",
    status: "beta",
    techStack: ["OpenAI API", "Anthropic API", "Perplexity API", "Ahrefs API", "Supabase"],
    category: "seo",
    icon: "brain",
    color: "#08AE67",
    metrics: [
      { label: "Queries Monitored", value: "120" },
      { label: "Citation Rate", value: "23%" },
    ],
    configFields: [
      { id: "brand_name", label: "Brand Name", type: "text", placeholder: "Your Brand", required: true },
      { id: "competitors", label: "Competitor Brands", type: "textarea", placeholder: "Competitor 1\nCompetitor 2\nCompetitor 3", required: true },
      { id: "industry_queries", label: "Industry Queries to Test", type: "textarea", placeholder: "best therapy practice management software\nhow to find a therapist near me\nmental health marketing strategies", required: true, helpText: "Questions your target audience asks AI. One per line." },
      { id: "ai_platforms", label: "AI Platforms to Monitor", type: "select", options: ["All Platforms", "ChatGPT + Claude + Perplexity", "Google AI Overviews Only", "Custom"], defaultValue: "All Platforms" },
      { id: "auto_optimize", label: "Generate Optimization Content", type: "toggle", defaultValue: true, helpText: "Auto-create FAQ and structured content for AI citation." },
      { id: "tracking_frequency", label: "Monitoring Frequency", type: "select", options: ["Weekly", "Bi-Weekly", "Monthly"], defaultValue: "Monthly" },
    ],
    runLogs: [
      { id: "r1", timestamp: "2026-03-10T09:00:00Z", status: "success", duration: "12m 45s", summary: "Queried 5 AI platforms with 120 questions: brand cited 23% vs competitor avg 31%. 8 content gaps identified.", details: ["ChatGPT: Brand cited in 28/120 queries (23%)", "Claude: Brand cited in 22/120 queries (18%)", "Perplexity: Brand cited in 34/120 queries (28%)", "Google AI Overviews: Brand cited in 18/120 queries (15%)", "Bing Copilot: Brand cited in 26/120 queries (22%)", "Competitor avg citation rate: 31% (gap: -8%)", "Content gaps: 8 topics where competitors cited, we're not", "Generated: 8 FAQ sections optimized for AI citation"] },
    ],
    schedule: "Monthly (1st Monday)",
    lastRun: "2 days ago",
    nextRun: "April 6, 2026",
  },
  {
    id: "budget-pacing-optimizer",
    name: "Budget Pacing Optimizer",
    blueprint: 26,
    description:
      "Monitors ad spend pacing across all platforms in real-time, alerts on over/under-spend, and auto-adjusts daily budgets to hit monthly targets with optimal allocation.",
    longDescription:
      "Cross-platform budget management system. Connects to Meta Ads, Google Ads, LinkedIn Ads, and TikTok Ads APIs to pull real-time spend data. Compares actual spend against monthly targets, calculates daily pacing requirements, and alerts on significant over/under-spend. Claude analyzes ROAS by platform and recommends budget reallocation from underperforming channels to top performers. Can auto-adjust daily budgets via platform APIs to maintain target pacing.",
    status: "active",
    techStack: ["Meta Ads API", "Google Ads API", "LinkedIn Ads API", "Claude API", "Slack API"],
    category: "ads",
    icon: "wallet",
    color: "#F59E0B",
    metrics: [
      { label: "Monthly Budget", value: "$48.5K" },
      { label: "Pacing Accuracy", value: "97.2%" },
    ],
    configFields: [
      { id: "monthly_budget", label: "Monthly Budget ($)", type: "number", placeholder: "50000", required: true },
      { id: "platforms", label: "Platforms to Track", type: "select", options: ["Meta + Google + LinkedIn", "Meta + Google", "All Platforms", "Custom"], defaultValue: "Meta + Google + LinkedIn" },
      { id: "pacing_tolerance", label: "Pacing Tolerance (%)", type: "number", placeholder: "10", defaultValue: 10, helpText: "Alert when spend deviates by this percentage." },
      { id: "auto_adjust", label: "Auto-Adjust Budgets", type: "toggle", defaultValue: false, helpText: "Automatically redistribute daily budgets. Requires platform API write access." },
      { id: "rebalance_frequency", label: "Rebalance Frequency", type: "select", options: ["Daily", "Every 3 Days", "Weekly"], defaultValue: "Daily" },
      { id: "alert_channel", label: "Budget Alert Channel", type: "text", placeholder: "#budget-alerts" },
    ],
    runLogs: [
      { id: "r1", timestamp: "2026-03-12T09:00:00Z", status: "success", duration: "2m 34s", summary: "Budget pacing at 98.4% of target. Meta overspending +8%, LinkedIn underspending -15%. Rebalance recommended.", details: ["Meta Ads: $22,400 spent / $21,000 target (106.7%) — ROAS 3.8x", "Google Ads: $15,200 spent / $15,500 target (98.1%) — ROAS 4.2x", "LinkedIn Ads: $6,800 spent / $8,000 target (85.0%) — ROAS 2.1x", "Total: $44,400 / $44,500 target (99.8% pacing)", "Recommendation: Shift $1,200 from LinkedIn to Google (higher ROAS)", "Alert: LinkedIn underpacing by 15% — sent to #budget-alerts"] },
    ],
    schedule: "Daily at 9:00 AM",
    lastRun: "3 hours ago",
    nextRun: "Tomorrow 9:00 AM",
  },
  {
    id: "testimonial-collector",
    name: "Testimonial Collector",
    blueprint: 27,
    description:
      "Automates testimonial collection from happy customers via triggered emails, formats responses into social proof assets, and maintains a curated testimonial database.",
    longDescription:
      "Customer testimonial automation pipeline. Triggers personalized testimonial request emails when positive signals are detected (high NPS score, 5-star review, support ticket resolved positively, renewal completed). Uses Claude to generate customized request emails with specific prompts based on the customer's experience. Collected testimonials are automatically formatted into multiple asset types: website widgets, social media quotes, case study drafts, and video script prompts. All testimonials stored in a searchable database with tags, sentiment scores, and usage tracking.",
    status: "beta",
    techStack: ["SendGrid API", "Claude API", "Typeform API", "Supabase", "Airtable API"],
    category: "leads",
    icon: "star",
    color: "#10B981",
    metrics: [
      { label: "Testimonials Collected", value: "86" },
      { label: "Response Rate", value: "32%" },
    ],
    configFields: [
      { id: "trigger_source", label: "Trigger Source", type: "select", options: ["NPS Survey (9-10)", "5-Star Review", "Support Ticket Resolved", "Renewal/Upsell", "Manual Trigger"], defaultValue: "NPS Survey (9-10)", required: true },
      { id: "email_template", label: "Email Style", type: "select", options: ["Casual & Warm", "Professional", "Quick Survey", "Video Request"], defaultValue: "Casual & Warm" },
      { id: "collection_method", label: "Collection Method", type: "select", options: ["Typeform Survey", "Email Reply", "Video Upload", "Google Form"], defaultValue: "Typeform Survey" },
      { id: "auto_format", label: "Auto-Format Assets", type: "toggle", defaultValue: true, helpText: "Generate social cards, website widgets, and case study drafts." },
      { id: "storage", label: "Storage Destination", type: "select", options: ["Supabase", "Airtable", "Google Sheets", "Notion"], defaultValue: "Supabase" },
      { id: "approval_required", label: "Require Approval", type: "toggle", defaultValue: true, helpText: "Human approval before publishing testimonials." },
    ],
    runLogs: [
      { id: "r1", timestamp: "2026-03-12T10:00:00Z", status: "success", duration: "1m 48s", summary: "Triggered 4 testimonial requests (2 NPS 10s, 1 5-star review, 1 renewal). 1 response already received.", details: ["Trigger detected: 2 NPS scores of 10, 1 new 5-star Google review, 1 annual renewal", "Claude: 4 personalized request emails generated", "SendGrid: 4 emails sent with Typeform links", "Response: 1 testimonial received (Sarah M., 142 words)", "Auto-formatted: Social card + website widget generated", "Stored in Supabase testimonials table with tags"] },
    ],
    schedule: "Real-time (event-driven)",
    lastRun: "2 hours ago",
    nextRun: "On next trigger event",
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
  email: "Email",
  analytics: "Analytics",
  leads: "Lead Gen",
  monitoring: "Monitoring",
  video: "Video",
};

export const statusLabels: Record<string, { label: string; color: string }> = {
  active: { label: "Active", color: "#08AE67" },
  beta: { label: "Beta", color: "#F59E0B" },
  development: { label: "In Development", color: "#6B7280" },
};
