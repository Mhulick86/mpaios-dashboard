"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  tools,
  statusLabels,
  toolCategories,
  type Tool,
  type ToolConfigField,
  type ToolRunLog,
} from "@/lib/tools";
import {
  Rocket,
  Target,
  Search,
  Heart,
  Database,
  Film,
  MapPin,
  Cpu,
  ArrowLeft,
  Play,
  Square,
  Settings2,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Calendar,
  Zap,
  Code2,
  RotateCcw,
  Download,
  ExternalLink,
  Activity,
  FileText,
  Image,
  Video,
  Globe,
  Copy,
  Eye,
  Package,
} from "lucide-react";

interface OutputArtifact {
  id: string;
  label: string;
  type: "file" | "link" | "preview" | "code";
  icon: "file" | "image" | "video" | "globe" | "code" | "package";
  filename?: string;
  size?: string;
  url?: string;
  previewContent?: string;
}

const outputIconMap: Record<string, React.ElementType> = {
  file: FileText,
  image: Image,
  video: Video,
  globe: Globe,
  code: Code2,
  package: Package,
};

const iconMap: Record<string, React.ElementType> = {
  rocket: Rocket,
  target: Target,
  search: Search,
  heart: Heart,
  database: Database,
  film: Film,
  "map-pin": MapPin,
};

const statusIconMap: Record<string, React.ElementType> = {
  success: CheckCircle2,
  error: XCircle,
  running: Loader2,
  queued: Clock,
};

const statusColorMap: Record<string, string> = {
  success: "#08AE67",
  error: "#EF4444",
  running: "#2CACE8",
  queued: "#F59E0B",
};

function ConfigFieldInput({
  field,
  value,
  onChange,
}: {
  field: ToolConfigField;
  value: string | number | boolean;
  onChange: (val: string | number | boolean) => void;
}) {
  switch (field.type) {
    case "text":
    case "url":
      return (
        <div>
          <label className="block text-[12px] font-medium text-text-secondary mb-1.5">
            {field.label}
            {field.required && <span className="text-red-400 ml-0.5">*</span>}
          </label>
          <input
            type={field.type === "url" ? "url" : "text"}
            placeholder={field.placeholder}
            value={value as string}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg bg-white border border-border text-[13px] focus:outline-none focus:border-brand-blue/50 focus:ring-1 focus:ring-brand-blue/20"
          />
          {field.helpText && (
            <p className="text-[11px] text-text-muted mt-1">{field.helpText}</p>
          )}
        </div>
      );
    case "number":
      return (
        <div>
          <label className="block text-[12px] font-medium text-text-secondary mb-1.5">
            {field.label}
            {field.required && <span className="text-red-400 ml-0.5">*</span>}
          </label>
          <input
            type="number"
            placeholder={field.placeholder}
            value={value as number}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-full px-3 py-2.5 rounded-lg bg-white border border-border text-[13px] focus:outline-none focus:border-brand-blue/50 focus:ring-1 focus:ring-brand-blue/20"
          />
          {field.helpText && (
            <p className="text-[11px] text-text-muted mt-1">{field.helpText}</p>
          )}
        </div>
      );
    case "textarea":
      return (
        <div>
          <label className="block text-[12px] font-medium text-text-secondary mb-1.5">
            {field.label}
            {field.required && <span className="text-red-400 ml-0.5">*</span>}
          </label>
          <textarea
            placeholder={field.placeholder}
            value={value as string}
            onChange={(e) => onChange(e.target.value)}
            rows={4}
            className="w-full px-3 py-2.5 rounded-lg bg-white border border-border text-[13px] focus:outline-none focus:border-brand-blue/50 focus:ring-1 focus:ring-brand-blue/20 resize-none"
          />
          {field.helpText && (
            <p className="text-[11px] text-text-muted mt-1">{field.helpText}</p>
          )}
        </div>
      );
    case "select":
      return (
        <div>
          <label className="block text-[12px] font-medium text-text-secondary mb-1.5">
            {field.label}
          </label>
          <select
            value={value as string}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg bg-white border border-border text-[13px] focus:outline-none focus:border-brand-blue/50 focus:ring-1 focus:ring-brand-blue/20 appearance-none"
          >
            {field.options?.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          {field.helpText && (
            <p className="text-[11px] text-text-muted mt-1">{field.helpText}</p>
          )}
        </div>
      );
    case "toggle":
      return (
        <div className="flex items-center justify-between py-1">
          <div>
            <label className="block text-[12px] font-medium text-text-secondary">
              {field.label}
            </label>
            {field.helpText && (
              <p className="text-[11px] text-text-muted mt-0.5">
                {field.helpText}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => onChange(!(value as boolean))}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              value ? "bg-brand-blue" : "bg-gray-200"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                value ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      );
    default:
      return null;
  }
}

export default function ToolDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [tool, setTool] = useState<Tool | null>(null);
  const [config, setConfig] = useState<Record<string, string | number | boolean>>({});
  const [activeTab, setActiveTab] = useState<"config" | "logs" | "schedule" | "output">("config");
  const [isRunning, setIsRunning] = useState(false);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [runLogs, setRunLogs] = useState<ToolRunLog[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [outputArtifacts, setOutputArtifacts] = useState<OutputArtifact[]>([]);
  const [previewArtifact, setPreviewArtifact] = useState<OutputArtifact | null>(null);

  useEffect(() => {
    const found = tools.find((t) => t.id === params.id);
    if (found) {
      setTool(found);
      setRunLogs(found.runLogs);
      // Initialize config from defaults
      const defaults: Record<string, string | number | boolean> = {};
      found.configFields.forEach((f) => {
        if (f.defaultValue !== undefined) {
          defaults[f.id] = f.defaultValue;
        } else {
          defaults[f.id] = f.type === "toggle" ? false : f.type === "number" ? 0 : "";
        }
      });
      setConfig(defaults);
    }
  }, [params.id]);

  if (!tool) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 text-text-muted mx-auto mb-3" />
          <p className="text-[14px] text-text-muted">Tool not found</p>
          <Link
            href="/tools"
            className="text-[13px] text-brand-blue hover:underline mt-2 inline-block"
          >
            Back to Tools
          </Link>
        </div>
      </div>
    );
  }

  const Icon = iconMap[tool.icon] || Cpu;
  const status = statusLabels[tool.status];
  const category = toolCategories[tool.category];

  // Tool-specific output artifacts
  const getOutputArtifacts = (toolId: string): OutputArtifact[] => {
    const outputs: Record<string, OutputArtifact[]> = {
      "vibe-marketing-funnel": [
        { id: "lp-a", label: "Landing Page — Modern Minimal", type: "link", icon: "globe", url: "#", previewContent: "<!DOCTYPE html>\n<html>\n<head><title>LP Variant A</title></head>\n<body>\n  <header class=\"hero\">\n    <h1>Transform Your Mental Health Practice</h1>\n    <p>Join 2,400+ providers who streamlined intake</p>\n    <a href=\"#\" class=\"cta-btn\">Get Started Free</a>\n  </header>\n  <!-- 12 sections, 1,420 words -->\n</body>\n</html>" },
        { id: "lp-b", label: "Landing Page — Healthcare Trust", type: "link", icon: "globe", url: "#", previewContent: "<!DOCTYPE html>\n<html>\n<head><title>LP Variant B</title></head>\n<body>\n  <header class=\"hero trust-layout\">\n    <h1>HIPAA-Compliant Patient Intake</h1>\n    <p>Trusted by 500+ behavioral health clinics</p>\n    <a href=\"#\" class=\"cta-btn\">Book a Demo</a>\n  </header>\n  <!-- 8 sections, 1,180 words -->\n</body>\n</html>" },
        { id: "vid-1", label: "Remotion Video — 9:16 (Stories/Reels)", type: "file", icon: "video", filename: "funnel-video-9x16.mp4", size: "4.2 MB" },
        { id: "vid-2", label: "Remotion Video — 1:1 (Feed)", type: "file", icon: "video", filename: "funnel-video-1x1.mp4", size: "3.8 MB" },
        { id: "vid-3", label: "Remotion Video — 16:9 (YouTube)", type: "file", icon: "video", filename: "funnel-video-16x9.mp4", size: "5.1 MB" },
        { id: "analysis", label: "Competitor Analysis Report", type: "file", icon: "file", filename: "competitor-analysis-2026-03-12.json", size: "48 KB" },
      ],
      "gtm-ad-bidding": [
        { id: "ads-report", label: "Campaign Performance Report", type: "file", icon: "file", filename: "campaign-report-2026-03-12.csv", size: "12 KB" },
        { id: "creative-1", label: "Ad Creative — Image #1 (Pain Point)", type: "file", icon: "image", filename: "ad-creative-pain-point-1.png", size: "340 KB" },
        { id: "creative-2", label: "Ad Creative — Carousel Set", type: "file", icon: "image", filename: "ad-carousel-set.zip", size: "1.2 MB" },
        { id: "pain-points", label: "Pain Points Extract (47 entries)", type: "file", icon: "file", filename: "pain-points-2026-03-12.json", size: "28 KB", previewContent: "[\n  {\n    \"source\": \"r/therapy\",\n    \"text\": \"intake forms take forever\",\n    \"sentiment\": -0.72,\n    \"frequency\": 14\n  },\n  {\n    \"source\": \"twitter\",\n    \"text\": \"why cant I book online\",\n    \"sentiment\": -0.65,\n    \"frequency\": 9\n  }\n  // ... 45 more entries\n]" },
        { id: "fb-link", label: "Facebook Ads Manager → Campaign", type: "link", icon: "globe", url: "#" },
      ],
      "seo-content-machine": [
        { id: "article-1", label: "Article: \"Best Anxiety Therapists in Dallas\"", type: "preview", icon: "file", filename: "anxiety-therapists-dallas.md", size: "8.4 KB", previewContent: "# Best Anxiety Therapists in Dallas (2026)\n\nFinding the right anxiety therapist in Dallas can feel\noverwhelming. This guide covers what to look for,\ninsurance options, and the top-rated providers...\n\n## What to Look for in an Anxiety Therapist\n...\n\n## Top 8 Anxiety Therapists in Dallas\n...\n\n*2,180 words | Reading time: 9 min*" },
        { id: "article-2", label: "Article: \"Online Therapy vs In-Person\"", type: "preview", icon: "file", filename: "online-vs-inperson-therapy.md", size: "7.2 KB" },
        { id: "hero-1", label: "Hero Image — Anxiety Therapists", type: "file", icon: "image", filename: "hero-anxiety-dallas-1200x630.png", size: "820 KB" },
        { id: "hero-2", label: "Hero Image — Online vs In-Person", type: "file", icon: "image", filename: "hero-online-therapy-1200x630.png", size: "780 KB" },
        { id: "kw-report", label: "Keyword Opportunities Report", type: "file", icon: "file", filename: "keyword-opportunities-2026-03-12.csv", size: "6 KB" },
        { id: "wp-link", label: "WordPress Drafts → Review Queue", type: "link", icon: "globe", url: "#" },
      ],
      "social-proof-engine": [
        { id: "widget-popup", label: "Widget — Notification Popup (embed code)", type: "code", icon: "code", previewContent: "<script src=\"https://cdn.proof.io/widget.js\"\n  data-widget-id=\"sp_28f4a\"\n  data-position=\"bottom-left\"\n  data-delay=\"3000\">\n</script>\n\n<!-- Shows: \"Sarah from Dallas just booked\n     an appointment — 2 minutes ago\" -->" },
        { id: "widget-carousel", label: "Widget — Review Carousel (embed code)", type: "code", icon: "code", previewContent: "<div id=\"proof-carousel\" data-widget=\"sp_carousel_19c\">\n  <!-- Auto-populated with 12 testimonials -->\n  <!-- Avg rating: 4.7 stars -->\n</div>\n<script src=\"https://cdn.proof.io/carousel.js\"></script>" },
        { id: "case-study", label: "Case Study Draft", type: "preview", icon: "file", filename: "case-study-draft-2026-03-12.md", size: "4.8 KB", previewContent: "# How [Brand] Increased Bookings 34% with\n# Streamlined Patient Intake\n\n## The Challenge\nPatients were abandoning the intake process...\n\n## The Solution\nImplemented digital forms with insurance verification...\n\n## Results\n- 34% increase in completed bookings\n- 68% reduction in intake time\n- 4.8 star average patient satisfaction\n\n*Draft — 1,240 words*" },
        { id: "mentions-csv", label: "All Mentions Export", type: "file", icon: "file", filename: "mentions-2026-03-12.csv", size: "18 KB" },
      ],
      "data-enrichment-pipeline": [
        { id: "enriched-csv", label: "Enriched Leads Export", type: "file", icon: "file", filename: "enriched-leads-2026-03-12.csv", size: "124 KB" },
        { id: "scoring-report", label: "ICP Scoring Report", type: "file", icon: "file", filename: "icp-scores-2026-03-12.csv", size: "42 KB", previewContent: "lead_id,company,score,reasoning\nL001,Serenity Wellness,92,\"Mental health, 12 employees, TX, accepts insurance\"\nL002,MindBridge Therapy,88,\"Behavioral health, 8 employees, TX\"\nL003,Dallas Auto Parts,14,\"Automotive, not healthcare vertical\"\nL004,Recovery Path Clinic,85,\"Substance abuse, 22 employees, TX\"\n... 238 more rows" },
        { id: "validation-report", label: "Email Validation Report", type: "file", icon: "file", filename: "email-validation-2026-03-12.csv", size: "16 KB" },
        { id: "hubspot-link", label: "HubSpot → New Leads Pipeline", type: "link", icon: "globe", url: "#" },
      ],
      "ig-reels-generator": [
        { id: "reel-pack-1", label: "Reel Pack #1 — \"5 Signs You Need Therapy\"", type: "file", icon: "package", filename: "reel-pack-1-signs-therapy.zip", size: "8.4 MB" },
        { id: "reel-pack-2", label: "Reel Pack #2 — \"Therapy Myths Debunked\"", type: "file", icon: "package", filename: "reel-pack-2-myths.zip", size: "7.9 MB" },
        { id: "reel-pack-3", label: "Reel Pack #3 — \"What Happens in Session\"", type: "file", icon: "package", filename: "reel-pack-3-session.zip", size: "9.1 MB" },
        { id: "storyboard", label: "Storyboards JSON (all 5 reels)", type: "code", icon: "code", filename: "storyboards-2026-03-12.json", size: "12 KB", previewContent: "[\n  {\n    \"reel_id\": 1,\n    \"hook\": \"Are you ignoring these 5 warning signs?\",\n    \"body\": [\"Persistent sadness\", \"Sleep changes\", ...],\n    \"cta\": \"Save this for later ↓\",\n    \"slides\": 5,\n    \"bg_style\": \"Gradient Abstract\"\n  }\n  // ... 4 more reels\n]" },
        { id: "frames-preview", label: "Frame Previews (15 PNGs)", type: "file", icon: "image", filename: "frame-previews.zip", size: "22 MB" },
      ],
      "seo-directory": [
        { id: "directory-link", label: "Live Directory Site → Preview", type: "link", icon: "globe", url: "#" },
        { id: "sitemap", label: "Sitemap (352 URLs)", type: "file", icon: "file", filename: "sitemap.xml", size: "34 KB" },
        { id: "listings-export", label: "Cleaned Listings Export", type: "file", icon: "file", filename: "directory-listings-2026-03-12.csv", size: "86 KB" },
        { id: "images-zip", label: "Curated Images (654 passed QA)", type: "file", icon: "image", filename: "directory-images.zip", size: "142 MB" },
        { id: "schema-sample", label: "Schema.org Markup Sample", type: "code", icon: "code", previewContent: "{\n  \"@context\": \"https://schema.org\",\n  \"@type\": \"LocalBusiness\",\n  \"name\": \"Serenity Wellness Center\",\n  \"address\": {\n    \"@type\": \"PostalAddress\",\n    \"streetAddress\": \"4521 Oak Lawn Ave\",\n    \"addressLocality\": \"Dallas\",\n    \"addressRegion\": \"TX\"\n  },\n  \"aggregateRating\": {\n    \"ratingValue\": \"4.8\",\n    \"reviewCount\": \"127\"\n  }\n}" },
      ],
    };
    return outputs[toolId] || [];
  };

  // Tool-specific simulation messages
  const getRunSimulation = (t: Tool) => {
    const sims: Record<string, { steps: [number, string, string][]; final: { duration: string; summary: string; details: string[] } }> = {
      "vibe-marketing-funnel": {
        steps: [
          [2000, "Launching stealth Playwright browser with anti-detect fingerprint...", "8s..."],
          [4000, "Scraping competitor pages via residential proxy rotation...", "22s..."],
          [6000, "Running Claude Vision analysis on page layouts + CTAs...", "48s..."],
          [8000, "Generating landing page variants with React + shadcn/ui...", "1m 12s..."],
        ],
        final: {
          duration: "1m 42s",
          summary: "Analyzed 3 competitor pages, generated 2 LP variants + 3 video assets",
          details: [
            "Stealth mode: Anti-detect fingerprint applied (Chrome 122, macOS)",
            "Proxy: Residential IP rotation enabled — 3 unique IPs used",
            "Scraped 3 competitor pages (0 Cloudflare blocks) ✓",
            "Claude Vision analysis — 92% CTA confidence score",
            "Generated LP variant A (Modern Minimal) — 1,340 words",
            "Generated LP variant B (Healthcare Trust) — 1,180 words",
            "Rendered 3 Remotion videos (15s each, 1080x1920)",
          ],
        },
      },
      "gtm-ad-bidding": {
        steps: [
          [2000, "Mining Reddit threads and Twitter conversations via Perplexity API...", "14s..."],
          [4000, "Extracting pain points and generating ad creatives...", "32s..."],
          [7000, "Deploying ads to Facebook and evaluating live campaign performance...", "1m 05s..."],
        ],
        final: {
          duration: "2m 18s",
          summary: "Mined 34 pain points, created 4 ads, paused 1 underperformer, scaled 2 winners",
          details: [
            "Perplexity API: Scraped 18 Reddit threads, 24 Twitter conversations",
            "Extracted 34 unique pain points (de-duped from 61 raw)",
            "Generated 4 ad creatives (2 image, 2 carousel)",
            "Deployed to Facebook Ads account ✓",
            "Auto-paused: 1 ad (CPA $57.80 > $45 threshold)",
            "Auto-scaled: 2 ads (+20% budget, avg ROAS 5.2x)",
          ],
        },
      },
      "seo-content-machine": {
        steps: [
          [2000, "Querying Ahrefs API for keyword opportunities (KD<20, Vol>500)...", "10s..."],
          [4500, "Scraping top 10 SERP results with Playwright...", "38s..."],
          [7000, "Running Claude content gap analysis and generating articles...", "1m 24s..."],
          [9000, "Creating DALL-E hero images and publishing to WordPress...", "2m 02s..."],
        ],
        final: {
          duration: "2m 38s",
          summary: "Found 8 keyword opportunities, published 2 articles to WordPress",
          details: [
            "Ahrefs API: 8 opportunities found (KD<20, Vol>500)",
            "SERP scraped for top 2 keywords (20 pages total)",
            "Claude gap analysis identified 5 content gaps",
            "Generated 2 articles (avg 2,200 words each)",
            "DALL-E 3: Created 2 hero images (1200x630)",
            "Published 2 drafts to WordPress (pending review) ✓",
          ],
        },
      },
      "social-proof-engine": {
        steps: [
          [2000, "Connecting to Twitter API, Reddit API, Google Reviews...", "6s..."],
          [4500, "Scanning 4 platforms for brand mentions and sentiment...", "28s..."],
          [7000, "Filtering positive testimonials (sentiment > 0.7)...", "52s..."],
          [9000, "Generating embeddable social proof widgets...", "1m 18s..."],
        ],
        final: {
          duration: "1m 48s",
          summary: "Found 31 mentions, captured 12 testimonials, generated 3 proof widgets + 1 case study draft",
          details: [
            "Twitter/X: 14 mentions found (9 positive, 3 neutral, 2 negative)",
            "Reddit: 8 mentions found (6 positive, 2 neutral)",
            "Google Reviews: 6 new reviews (avg 4.6 stars)",
            "G2: 3 new reviews (avg 4.8 stars)",
            "Sentiment filter: 12 testimonials passed (score > 0.7)",
            "Widget gen: 2 notification popups + 1 review carousel created",
            "Claude case study: 1 draft generated from 4 clustered success signals",
            "Supabase: All widgets and testimonials stored ✓",
          ],
        },
      },
      "data-enrichment-pipeline": {
        steps: [
          [2000, "Importing and deduplicating lead CSV (245 rows)...", "8s..."],
          [4000, "Validating emails and enriching with Clearbit firmographics...", "32s..."],
          [6500, "Running Claude ICP scoring on 198 enriched leads...", "58s..."],
          [8500, "Syncing qualified leads to HubSpot CRM...", "1m 22s..."],
        ],
        final: {
          duration: "1m 44s",
          summary: "Processed 245 leads: 198 enriched, 189 valid emails, 142 synced to HubSpot (ICP >= 70)",
          details: [
            "CSV imported: 245 raw leads",
            "Deduplication: 12 duplicates removed → 233 unique",
            "Email validation: 189/233 valid (81.1%)",
            "Clearbit enrichment: 198/233 matched (85.0%)",
            "Claude ICP scoring: avg score 64.2, median 68",
            "Leads above threshold (ICP >= 70): 142 qualified",
            "HubSpot sync: 142 leads pushed to 'New Leads' pipeline ✓",
            "Enrichment report saved to /exports/enrichment-2026-03-12.csv",
          ],
        },
      },
      "ig-reels-generator": {
        steps: [
          [2000, "Scanning Obsidian vault for tagged notes (#content-idea, #reel)...", "5s..."],
          [4500, "Extracting topic clusters and generating Claude storyboards...", "34s..."],
          [7000, "Creating DALL-E 3 background images (1080x1920)...", "1m 08s..."],
          [9500, "Compositing text overlays with Pillow and exporting asset packs...", "1m 42s..."],
        ],
        final: {
          duration: "2m 06s",
          summary: "Scanned vault, extracted 5 topics, generated 5 Reel asset packs (15 frames total)",
          details: [
            "Vault scan: 234 notes found, 89 tagged with target tags",
            "Topic extraction: 5 new high-value clusters identified",
            "Claude storyboards: 5 JSON scripts generated (hook → body → CTA)",
            "DALL-E 3: 15 background images rendered (3 per Reel, 1080x1920)",
            "Pillow compositing: 15 text-overlay frames exported as PNG",
            "Font: DM Sans Bold applied with brand color overlay",
            "Output: 5 asset packs saved to /exports/reels-2026-03-12/",
            "Ready for IG upload via Creator Studio ✓",
          ],
        },
      },
      "seo-directory": {
        steps: [
          [2000, "Cleaning business CSV with Pandas (412 rows)...", "10s..."],
          [5000, "Crawling business websites via BrightData proxies (async batch)...", "1m 24s..."],
          [8000, "Running Claude Vision image curation and quality scoring...", "2m 38s..."],
          [11000, "Building Next.js directory pages with ISR + Schema.org...", "3m 52s..."],
        ],
        final: {
          duration: "4m 28s",
          summary: "Processed 340 listings across 12 cities, generated directory site with 352 pages",
          details: [
            "CSV cleaned: 340 valid listings from 412 raw rows (72 rejected)",
            "Web crawl: 298/340 sites responded (87.6%) via BrightData proxy",
            "Claude Vision: 892 images scored, 654 passed quality threshold (73.3%)",
            "Supabase: 340 listings + 654 images stored",
            "Next.js: Generated 12 city pages + 340 listing detail pages",
            "Schema.org: LocalBusiness markup applied to all listings",
            "Sitemap: 352 URLs generated and submitted",
            "ISR: Revalidation set to 3600s for all pages ✓",
          ],
        },
      },
    };
    return sims[t.id] || {
      steps: [
        [2000, "Processing inputs and connecting to APIs...", "12s..."],
        [4000, "Running main pipeline tasks...", "28s..."],
      ],
      final: {
        duration: "1m 42s",
        summary: "Pipeline completed successfully. All tasks processed.",
        details: [
          "Configuration validated ✓",
          "API connections established ✓",
          "Main pipeline executed ✓",
          "Results stored and synced ✓",
        ],
      },
    };
  };

  const handleRun = () => {
    setIsRunning(true);
    setActiveTab("logs");

    const sim = getRunSimulation(tool);

    const newLog: ToolRunLog = {
      id: `run-${Date.now()}`,
      timestamp: new Date().toISOString(),
      status: "running",
      duration: "0s...",
      summary: "Initializing pipeline...",
    };
    setRunLogs((prev) => [newLog, ...prev]);

    // Simulate tool-specific progress steps
    sim.steps.forEach(([delay, msg, dur]) => {
      setTimeout(() => {
        setRunLogs((prev) =>
          prev.map((l) =>
            l.id === newLog.id
              ? { ...l, summary: msg, duration: dur }
              : l
          )
        );
      }, delay);
    });

    // Complete after last step + buffer
    const lastStepDelay = sim.steps[sim.steps.length - 1]?.[0] ?? 4000;
    setTimeout(() => {
      setIsRunning(false);
      setRunLogs((prev) =>
        prev.map((l) =>
          l.id === newLog.id
            ? {
                ...l,
                status: "success" as const,
                duration: sim.final.duration,
                summary: sim.final.summary,
                details: sim.final.details,
              }
            : l
        )
      );
      setOutputArtifacts(getOutputArtifacts(tool.id));
      setActiveTab("output");
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 4000);
    }, lastStepDelay + 2000);
  };

  const handleRetry = (failedLog: ToolRunLog) => {
    setIsRunning(true);
    setActiveTab("logs");

    // Remove the original failed entry and replace with a running retry
    const retryLog: ToolRunLog = {
      id: `retry-${Date.now()}`,
      timestamp: new Date().toISOString(),
      status: "running",
      duration: "0s...",
      summary: `Retrying with Stealth + Proxy rotation...`,
    };
    setRunLogs((prev) =>
      [retryLog, ...prev.filter((l) => l.id !== failedLog.id)]
    );

    setTimeout(() => {
      setRunLogs((prev) =>
        prev.map((l) =>
          l.id === retryLog.id
            ? { ...l, summary: "Stealth fingerprint applied — rotating to new residential proxy...", duration: "6s..." }
            : l
        )
      );
    }, 2000);

    setTimeout(() => {
      setRunLogs((prev) =>
        prev.map((l) =>
          l.id === retryLog.id
            ? { ...l, summary: "Cloudflare challenge detected → solving with stealth bypass...", duration: "14s..." }
            : l
        )
      );
    }, 4000);

    setTimeout(() => {
      setRunLogs((prev) =>
        prev.map((l) =>
          l.id === retryLog.id
            ? { ...l, summary: "Cloudflare passed ✓ — scraping page content...", duration: "22s..." }
            : l
        )
      );
    }, 6000);

    setTimeout(() => {
      setIsRunning(false);
      setRunLogs((prev) =>
        prev.map((l) =>
          l.id === retryLog.id
            ? {
                ...l,
                status: "success" as const,
                duration: "1m 38s",
                summary: "Retry succeeded — Cloudflare bypassed with stealth mode + proxy rotation",
                details: [
                  "Stealth mode: Anti-detect fingerprint applied (Chrome 122, macOS)",
                  "Proxy: Rotated to residential IP (new region)",
                  "Cloudflare challenge detected → auto-solved in 2.1s",
                  "Page fully loaded and scraped ✓",
                  "Claude Vision analysis complete — 89% CTA confidence",
                  "Generated 1 LP variant + 1 video asset",
                ],
              }
            : l
        )
      );
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 4000);
    }, 8000);
  };

  const handleStop = () => {
    setIsRunning(false);
    setRunLogs((prev) =>
      prev.map((l) =>
        l.status === "running"
          ? { ...l, status: "error" as const, summary: "Run cancelled by user", duration: l.duration.replace("...", "") }
          : l
      )
    );
  };

  const handleSaveConfig = () => {
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  return (
    <div>
      {/* Success toast */}
      {showSuccess && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg bg-brand-green text-white text-[13px] font-medium shadow-lg animate-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4" />
          Operation completed successfully
        </div>
      )}

      {/* Back button + Header */}
      <div className="mb-6">
        <Link
          href="/tools"
          className="inline-flex items-center gap-1.5 text-[12px] text-text-muted hover:text-brand-blue transition-colors mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Tools
        </Link>

        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${tool.color}15` }}
            >
              <Icon className="w-7 h-7" style={{ color: tool.color }} />
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-[20px] md:text-[24px] font-semibold">
                  {tool.name}
                </h1>
                <span
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium"
                  style={{
                    backgroundColor: `${status.color}15`,
                    color: status.color,
                  }}
                >
                  {status.label}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-gray-100 text-[10px] font-medium text-text-muted uppercase tracking-wide">
                  Blueprint {tool.blueprint}
                </span>
              </div>
              <p className="text-[13px] text-text-secondary mt-1.5 max-w-2xl leading-relaxed">
                {tool.longDescription}
              </p>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <span className="px-2.5 py-1 rounded-lg bg-surface text-[11px] font-medium text-text-muted border border-border">
                  {category}
                </span>
                {tool.techStack.map((tech) => (
                  <span
                    key={tech}
                    className="px-2 py-0.5 rounded-md bg-surface text-[10px] text-text-muted font-medium border border-border"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {isRunning ? (
              <button
                onClick={handleStop}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-red-500 text-white text-[13px] font-medium hover:bg-red-600 transition-colors"
              >
                <Square className="w-4 h-4" />
                Stop
              </button>
            ) : (
              <button
                onClick={handleRun}
                disabled={tool.status === "development"}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-blue text-white text-[13px] font-medium hover:bg-brand-blue-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Play className="w-4 h-4" />
                Run Now
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Metrics bar */}
      {tool.metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {tool.metrics.map((m) => (
            <div
              key={m.label}
              className="bg-surface-raised rounded-xl border border-border p-4"
            >
              <div className="text-[10px] text-text-muted uppercase tracking-wide mb-1">
                {m.label}
              </div>
              <div className="text-[22px] font-semibold">{m.value}</div>
            </div>
          ))}
          <div className="bg-surface-raised rounded-xl border border-border p-4">
            <div className="text-[10px] text-text-muted uppercase tracking-wide mb-1">
              Schedule
            </div>
            <div className="text-[14px] font-semibold">{tool.schedule}</div>
            <div className="text-[11px] text-text-muted mt-0.5">
              Next: {tool.nextRun}
            </div>
          </div>
          <div className="bg-surface-raised rounded-xl border border-border p-4">
            <div className="text-[10px] text-text-muted uppercase tracking-wide mb-1">
              Last Run
            </div>
            <div className="text-[14px] font-semibold">{tool.lastRun}</div>
            <div className="text-[11px] text-text-muted mt-0.5">
              {runLogs[0]?.duration || "—"}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border mb-6">
        {(
          [
            { id: "config", label: "Configuration", icon: Settings2 },
            { id: "logs", label: "Run History", icon: Activity },
            { id: "schedule", label: "Schedule", icon: Calendar },
            { id: "output", label: "Output", icon: Package },
          ] as const
        ).map((tab) => {
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-[13px] font-medium border-b-2 transition-colors -mb-px ${
                activeTab === tab.id
                  ? "border-brand-blue text-brand-blue"
                  : "border-transparent text-text-muted hover:text-text-primary"
              }`}
            >
              <TabIcon className="w-4 h-4" />
              {tab.label}
              {tab.id === "logs" && runLogs.some((l) => l.status === "running") && (
                <span className="w-2 h-2 rounded-full bg-brand-blue animate-pulse" />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === "config" && (
        <div className="bg-surface-raised rounded-xl border border-border p-5 md:p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[16px] font-semibold">Tool Configuration</h2>
            <button
              onClick={handleSaveConfig}
              className="px-4 py-2 rounded-lg bg-brand-blue text-white text-[12px] font-medium hover:bg-brand-blue-dark transition-colors"
            >
              Save Configuration
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {tool.configFields.map((field) => (
              <div
                key={field.id}
                className={
                  field.type === "textarea" ? "md:col-span-2" : ""
                }
              >
                <ConfigFieldInput
                  field={field}
                  value={config[field.id] ?? ""}
                  onChange={(val) =>
                    setConfig((prev) => ({ ...prev, [field.id]: val }))
                  }
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "logs" && (
        <div className="space-y-3">
          {runLogs.length === 0 ? (
            <div className="bg-surface-raised rounded-xl border border-border p-12 text-center">
              <Clock className="w-8 h-8 text-text-muted mx-auto mb-3" />
              <p className="text-[14px] text-text-muted">
                No runs yet. Configure the tool and click Run Now.
              </p>
            </div>
          ) : (
            runLogs.map((log) => {
              const LogIcon = statusIconMap[log.status] || Clock;
              const logColor = statusColorMap[log.status] || "#6B7280";
              const isExpanded = expandedLog === log.id;

              return (
                <div
                  key={log.id}
                  className="bg-surface-raised rounded-xl border border-border overflow-hidden"
                >
                  <button
                    onClick={() =>
                      setExpandedLog(isExpanded ? null : log.id)
                    }
                    className="w-full p-4 md:p-5 text-left hover:bg-surface/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                          style={{ backgroundColor: `${logColor}15` }}
                        >
                          <LogIcon
                            className={`w-4 h-4 ${
                              log.status === "running" ? "animate-spin" : ""
                            }`}
                            style={{ color: logColor }}
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium leading-snug">
                            {log.summary}
                          </p>
                          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                            <span className="text-[11px] text-text-muted">
                              {new Date(log.timestamp).toLocaleString()}
                            </span>
                            <span
                              className="text-[11px] font-medium"
                              style={{ color: logColor }}
                            >
                              {log.status === "running"
                                ? "Running"
                                : log.status === "queued"
                                  ? "Queued"
                                  : log.status === "error"
                                    ? "Failed"
                                    : "Completed"}
                            </span>
                            <span className="text-[11px] text-text-muted">
                              Duration: {log.duration}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        {log.status === "error" && !isRunning && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRetry(log);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-medium hover:bg-amber-100 transition-colors"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Retry with Stealth
                          </button>
                        )}
                        {log.details && (
                          <>
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-text-muted" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-text-muted" />
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </button>

                  {isExpanded && log.details && (
                    <div className="px-5 pb-5 pt-0">
                      <div className="bg-gray-50 rounded-lg p-4 border border-border">
                        <p className="text-[11px] font-medium text-text-muted uppercase tracking-wide mb-2">
                          Execution Details
                        </p>
                        <div className="space-y-1.5">
                          {log.details.map((detail, i) => (
                            <div
                              key={i}
                              className={`flex items-start gap-2 text-[12px] ${
                                detail.startsWith("⚠")
                                  ? "text-amber-700 bg-amber-50 -mx-2 px-2 py-1 rounded-md border border-amber-200"
                                  : "text-text-secondary"
                              }`}
                            >
                              <span className="text-text-muted shrink-0 font-mono text-[10px] mt-0.5">
                                {String(i + 1).padStart(2, "0")}
                              </span>
                              <span className="font-mono">{detail}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {activeTab === "schedule" && (
        <div className="bg-surface-raised rounded-xl border border-border p-5 md:p-6">
          <h2 className="text-[16px] font-semibold mb-5">Run Schedule</h2>
          <div className="space-y-5">
            <div>
              <label className="block text-[12px] font-medium text-text-secondary mb-1.5">
                Schedule Type
              </label>
              <select
                defaultValue={tool.schedule?.includes("Daily") ? "daily" : tool.schedule?.includes("Weekly") ? "weekly" : tool.schedule?.includes("Every") ? "interval" : "manual"}
                className="w-full px-3 py-2.5 rounded-lg bg-white border border-border text-[13px] focus:outline-none focus:border-brand-blue/50"
              >
                <option value="manual">Manual (Run on demand)</option>
                <option value="interval">Interval (Every X hours)</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="cron">Custom Cron Expression</option>
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-medium text-text-secondary mb-1.5">
                Run Time
              </label>
              <input
                type="time"
                defaultValue="08:00"
                className="w-full px-3 py-2.5 rounded-lg bg-white border border-border text-[13px] focus:outline-none focus:border-brand-blue/50"
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-text-secondary mb-1.5">
                Timezone
              </label>
              <select
                defaultValue="America/Chicago"
                className="w-full px-3 py-2.5 rounded-lg bg-white border border-border text-[13px] focus:outline-none focus:border-brand-blue/50"
              >
                <option value="America/New_York">Eastern Time (ET)</option>
                <option value="America/Chicago">Central Time (CT)</option>
                <option value="America/Denver">Mountain Time (MT)</option>
                <option value="America/Los_Angeles">Pacific Time (PT)</option>
                <option value="UTC">UTC</option>
              </select>
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <label className="block text-[12px] font-medium text-text-secondary">
                  Send Notification on Completion
                </label>
                <p className="text-[11px] text-text-muted mt-0.5">
                  Get notified via email/Slack when a run finishes.
                </p>
              </div>
              <button
                type="button"
                className="relative inline-flex h-6 w-11 items-center rounded-full bg-brand-blue transition-colors"
              >
                <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-6 shadow-sm" />
              </button>
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <label className="block text-[12px] font-medium text-text-secondary">
                  Retry on Failure
                </label>
                <p className="text-[11px] text-text-muted mt-0.5">
                  Automatically retry up to 2 times if a run fails.
                </p>
              </div>
              <button
                type="button"
                className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200 transition-colors"
              >
                <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-1 shadow-sm" />
              </button>
            </div>
            <div className="pt-2">
              <button className="px-4 py-2 rounded-lg bg-brand-blue text-white text-[12px] font-medium hover:bg-brand-blue-dark transition-colors">
                Save Schedule
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === "output" && (
        <div className="bg-surface-raised rounded-xl border border-border p-5 md:p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[16px] font-semibold">Output Artifacts</h2>
            {outputArtifacts.length > 0 && (
              <span className="text-[11px] text-text-muted bg-surface-overlay px-2 py-1 rounded-full">
                {outputArtifacts.length} items
              </span>
            )}
          </div>

          {outputArtifacts.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-10 h-10 text-text-muted mx-auto mb-3 opacity-40" />
              <p className="text-[13px] text-text-muted">No output yet.</p>
              <p className="text-[11px] text-text-muted mt-1">
                Run the tool to generate output artifacts.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {outputArtifacts.map((artifact) => {
                const ArtifactIcon = outputIconMap[artifact.icon] || Package;
                return (
                  <div
                    key={artifact.id}
                    className="bg-surface-overlay rounded-lg border border-border p-4 hover:border-brand-blue/40 transition-colors group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-brand-blue/10 flex items-center justify-center flex-shrink-0">
                        <ArtifactIcon className="w-4 h-4 text-brand-blue" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-text-primary truncate">
                          {artifact.label}
                        </p>
                        {artifact.filename && (
                          <p className="text-[11px] text-text-muted mt-0.5 font-mono truncate">
                            {artifact.filename}
                          </p>
                        )}
                        {artifact.size && (
                          <p className="text-[10px] text-text-muted mt-0.5">
                            {artifact.size}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/60">
                      {artifact.type === "file" && (
                        <button className="flex items-center gap-1.5 text-[11px] text-brand-blue hover:text-brand-blue-dark font-medium transition-colors">
                          <Download className="w-3.5 h-3.5" />
                          Download
                        </button>
                      )}
                      {artifact.type === "link" && artifact.url && (
                        <button
                          onClick={() => window.open(artifact.url, "_blank")}
                          className="flex items-center gap-1.5 text-[11px] text-brand-blue hover:text-brand-blue-dark font-medium transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Open
                        </button>
                      )}
                      {artifact.type === "code" && artifact.previewContent && (
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(artifact.previewContent || "");
                          }}
                          className="flex items-center gap-1.5 text-[11px] text-brand-blue hover:text-brand-blue-dark font-medium transition-colors"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          Copy
                        </button>
                      )}
                      {artifact.previewContent && (
                        <button
                          onClick={() => setPreviewArtifact(artifact)}
                          className="flex items-center gap-1.5 text-[11px] text-text-muted hover:text-text-primary font-medium transition-colors ml-auto"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Preview
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Preview Modal */}
      {previewArtifact && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setPreviewArtifact(null)}
        >
          <div
            className="bg-surface-raised rounded-xl border border-border w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                {(() => {
                  const ModalIcon = outputIconMap[previewArtifact.icon] || Package;
                  return <ModalIcon className="w-4 h-4 text-brand-blue" />;
                })()}
                <h3 className="text-[14px] font-semibold">{previewArtifact.label}</h3>
              </div>
              <div className="flex items-center gap-2">
                {previewArtifact.previewContent && (
                  <button
                    onClick={() =>
                      navigator.clipboard.writeText(previewArtifact.previewContent || "")
                    }
                    className="flex items-center gap-1 text-[11px] text-text-muted hover:text-text-primary px-2 py-1 rounded-md hover:bg-surface-overlay transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copy
                  </button>
                )}
                <button
                  onClick={() => setPreviewArtifact(null)}
                  className="text-text-muted hover:text-text-primary p-1 rounded-md hover:bg-surface-overlay transition-colors"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-4 overflow-auto flex-1">
              <pre className="text-[12px] leading-relaxed text-text-secondary font-mono whitespace-pre-wrap bg-surface-overlay rounded-lg p-4 border border-border/60">
                {previewArtifact.previewContent}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
