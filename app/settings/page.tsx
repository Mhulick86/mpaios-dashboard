"use client";

import { useState, useEffect } from "react";
import {
  Key,
  Eye,
  EyeOff,
  Save,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Plus,
  Server,
  Brain,
  Shield,
  RefreshCw,
  Loader2,
  Download,
  HardDrive,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface ApiKeyConfig {
  id: string;
  label: string;
  provider: string;
  envVar: string;
  value: string;
  description: string;
  docsUrl: string;
  models: string[];
  required: boolean;
}

interface CustomEndpoint {
  id: string;
  name: string;
  url: string;
  apiKey: string;
  model: string;
}

const defaultKeys: ApiKeyConfig[] = [
  // ── LLM Providers ──
  {
    id: "openai",
    label: "OpenAI",
    provider: "OpenAI",
    envVar: "OPENAI_API_KEY",
    value: "",
    description: "GPT-4o for strategy, copywriting, and analysis",
    docsUrl: "https://platform.openai.com/api-keys",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "o1", "o3-mini"],
    required: true,
  },
  {
    id: "anthropic",
    label: "Anthropic",
    provider: "Anthropic",
    envVar: "ANTHROPIC_API_KEY",
    value: "",
    description: "Claude for orchestration, content, and reasoning",
    docsUrl: "https://console.anthropic.com/settings/keys",
    models: ["claude-sonnet-4-20250514", "claude-3.5-haiku", "claude-3-opus"],
    required: true,
  },
  {
    id: "google",
    label: "Google AI (Gemini)",
    provider: "Google",
    envVar: "GOOGLE_API_KEY",
    value: "",
    description: "Gemini for multimodal analysis and search grounding",
    docsUrl: "https://aistudio.google.com/apikey",
    models: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.5-flash-lite"],
    required: false,
  },
  {
    id: "perplexity",
    label: "Perplexity",
    provider: "Perplexity",
    envVar: "PERPLEXITY_API_KEY",
    value: "",
    description: "Real-time web search for competitive intel and LLMO audits",
    docsUrl: "https://docs.perplexity.ai",
    models: ["sonar-pro", "sonar"],
    required: false,
  },
  // ── SEO & Search ──
  {
    id: "ahrefs",
    label: "Ahrefs",
    provider: "Ahrefs",
    envVar: "AHREFS_API_KEY",
    value: "",
    description: "Backlink analysis, keyword research, site audits, competitor SEO (Agents 03, 10, 30)",
    docsUrl: "https://ahrefs.com/api",
    models: [],
    required: false,
  },
  {
    id: "serp",
    label: "SerpAPI",
    provider: "SerpAPI",
    envVar: "SERPAPI_KEY",
    value: "",
    description: "SERP scraping for rank tracking and local pack monitoring (Agents 10, 31)",
    docsUrl: "https://serpapi.com/manage-api-key",
    models: [],
    required: false,
  },
  {
    id: "dataforseo",
    label: "DataForSEO",
    provider: "DataForSEO",
    envVar: "DATAFORSEO_API_KEY",
    value: "",
    description: "GEO grid rank tracking, local SERP data, Google Maps rankings (Agent 31)",
    docsUrl: "https://dataforseo.com/apis",
    models: [],
    required: false,
  },
  // ── Advertising Platforms ──
  {
    id: "meta",
    label: "Meta Marketing API",
    provider: "Meta",
    envVar: "META_ACCESS_TOKEN",
    value: "",
    description: "Facebook & Instagram ad creation, optimization, audience building (Agent 07)",
    docsUrl: "https://developers.facebook.com/docs/marketing-apis/",
    models: [],
    required: false,
  },
  {
    id: "google_ads",
    label: "Google Ads API",
    provider: "Google",
    envVar: "GOOGLE_ADS_DEVELOPER_TOKEN",
    value: "",
    description: "Search, Display, PMax, YouTube ad management (Agent 08)",
    docsUrl: "https://developers.google.com/google-ads/api/docs/start",
    models: [],
    required: false,
  },
  // ── Local & Maps ──
  {
    id: "google_places",
    label: "Google Places / Maps API",
    provider: "Google",
    envVar: "GOOGLE_PLACES_API_KEY",
    value: "",
    description: "GBP data, local business info, geo-grid scanning, map rankings (Agents 31, 32)",
    docsUrl: "https://console.cloud.google.com/apis/library/places-backend.googleapis.com",
    models: [],
    required: false,
  },
  // ── Email & CRM ──
  {
    id: "sendgrid",
    label: "SendGrid",
    provider: "SendGrid",
    envVar: "SENDGRID_API_KEY",
    value: "",
    description: "Email sending, nurture sequences, deliverability tracking (Agent 24)",
    docsUrl: "https://app.sendgrid.com/settings/api_keys",
    models: [],
    required: false,
  },
  {
    id: "hubspot",
    label: "HubSpot CRM",
    provider: "HubSpot",
    envVar: "HUBSPOT_API_KEY",
    value: "",
    description: "CRM sync, contact management, deal tracking, client lifecycle (Agents 25, 26)",
    docsUrl: "https://developers.hubspot.com/docs/api/private-apps",
    models: [],
    required: false,
  },
  // ── Creative & Media ──
  {
    id: "stability",
    label: "Stability AI",
    provider: "Stability",
    envVar: "STABILITY_API_KEY",
    value: "",
    description: "AI image generation for ad creatives and social assets (Agent 05)",
    docsUrl: "https://platform.stability.ai/account/keys",
    models: ["stable-diffusion-xl", "stable-image-core"],
    required: false,
  },
  {
    id: "canva",
    label: "Canva Connect API",
    provider: "Canva",
    envVar: "CANVA_API_KEY",
    value: "",
    description: "Design asset creation, brand templates, social graphics (Agent 05)",
    docsUrl: "https://www.canva.dev/docs/connect/",
    models: [],
    required: false,
  },
  // ── Analytics & Monitoring ──
  {
    id: "stripe",
    label: "Stripe",
    provider: "Stripe",
    envVar: "STRIPE_SECRET_KEY",
    value: "",
    description: "Payment data, revenue tracking, MRR/LTV calculations (Agent 27)",
    docsUrl: "https://dashboard.stripe.com/apikeys",
    models: [],
    required: false,
  },
  {
    id: "slack",
    label: "Slack Webhook",
    provider: "Slack",
    envVar: "SLACK_WEBHOOK_URL",
    value: "",
    description: "Real-time notifications, alerts, agent status updates",
    docsUrl: "https://api.slack.com/messaging/webhooks",
    models: [],
    required: false,
  },
  // ── MarTech Integrations ──
  {
    id: "semrush",
    label: "Semrush",
    provider: "Semrush",
    envVar: "SEMRUSH_API_KEY",
    value: "",
    description: "Keyword research, domain analytics, position tracking, site audits (Agents 03, 10, 30)",
    docsUrl: "https://www.semrush.com/api-analytics/",
    models: [],
    required: false,
  },
  {
    id: "mailchimp",
    label: "Mailchimp",
    provider: "Mailchimp",
    envVar: "MAILCHIMP_API_KEY",
    value: "",
    description: "Email campaigns, audience management, automations, analytics (Agent 24)",
    docsUrl: "https://mailchimp.com/developer/marketing/api/",
    models: [],
    required: false,
  },
  {
    id: "klaviyo",
    label: "Klaviyo",
    provider: "Klaviyo",
    envVar: "KLAVIYO_API_KEY",
    value: "",
    description: "Advanced email/SMS marketing, behavioral flows, customer segmentation (Agent 24)",
    docsUrl: "https://developers.klaviyo.com/en",
    models: [],
    required: false,
  },
  {
    id: "zapier",
    label: "Zapier Webhooks",
    provider: "Zapier",
    envVar: "ZAPIER_WEBHOOK_URL",
    value: "",
    description: "Connect to 6,000+ apps via webhooks — trigger Zaps from agent actions",
    docsUrl: "https://zapier.com/apps/webhook/integrations",
    models: [],
    required: false,
  },
  {
    id: "hotjar",
    label: "Hotjar",
    provider: "Hotjar",
    envVar: "HOTJAR_API_KEY",
    value: "",
    description: "Heatmaps, session recordings, user feedback for CRO analysis (Agent 14)",
    docsUrl: "https://www.hotjar.com/",
    models: [],
    required: false,
  },
  {
    id: "intercom",
    label: "Intercom",
    provider: "Intercom",
    envVar: "INTERCOM_ACCESS_TOKEN",
    value: "",
    description: "Live chat, customer messaging, support tickets, product tours (Agent 25)",
    docsUrl: "https://developers.intercom.com/docs",
    models: [],
    required: false,
  },
  {
    id: "twilio",
    label: "Twilio",
    provider: "Twilio",
    envVar: "TWILIO_AUTH_TOKEN",
    value: "",
    description: "SMS marketing, WhatsApp, voice calls, two-factor auth (Agent 24)",
    docsUrl: "https://www.twilio.com/docs/usage/api",
    models: [],
    required: false,
  },
  {
    id: "segment",
    label: "Segment",
    provider: "Segment",
    envVar: "SEGMENT_WRITE_KEY",
    value: "",
    description: "Customer data platform — unified event tracking, audience sync, data routing (Agent 28)",
    docsUrl: "https://segment.com/docs/connections/sources/",
    models: [],
    required: false,
  },
  {
    id: "mixpanel",
    label: "Mixpanel",
    provider: "Mixpanel",
    envVar: "MIXPANEL_TOKEN",
    value: "",
    description: "Product analytics, funnel analysis, retention, user behavior tracking (Agent 13, 14)",
    docsUrl: "https://developer.mixpanel.com/reference/overview",
    models: [],
    required: false,
  },
  {
    id: "salesforce",
    label: "Salesforce",
    provider: "Salesforce",
    envVar: "SALESFORCE_ACCESS_TOKEN",
    value: "",
    description: "CRM, lead management, opportunity tracking, marketing cloud (Agents 25, 26, 27)",
    docsUrl: "https://developer.salesforce.com/docs/apis",
    models: [],
    required: false,
  },
  {
    id: "linkedin",
    label: "LinkedIn Marketing API",
    provider: "LinkedIn",
    envVar: "LINKEDIN_ACCESS_TOKEN",
    value: "",
    description: "LinkedIn Ads, company pages, lead gen forms, audience targeting (Agent 09)",
    docsUrl: "https://learn.microsoft.com/en-us/linkedin/marketing/",
    models: [],
    required: false,
  },
  {
    id: "tiktok",
    label: "TikTok Business API",
    provider: "TikTok",
    envVar: "TIKTOK_ACCESS_TOKEN",
    value: "",
    description: "TikTok Ads, Spark Ads, audience management, conversion tracking (Agent 09)",
    docsUrl: "https://business-api.tiktok.com/portal/docs",
    models: [],
    required: false,
  },
  {
    id: "wordpress",
    label: "WordPress REST API",
    provider: "WordPress",
    envVar: "WORDPRESS_APP_PASSWORD",
    value: "",
    description: "Publish posts, manage pages, update SEO metadata, media uploads (Agents 04, 10)",
    docsUrl: "https://developer.wordpress.org/rest-api/",
    models: [],
    required: false,
  },
  {
    id: "webflow",
    label: "Webflow",
    provider: "Webflow",
    envVar: "WEBFLOW_API_TOKEN",
    value: "",
    description: "CMS management, publish pages, update collections, site analytics (Agent 06)",
    docsUrl: "https://developers.webflow.com/data/reference/",
    models: [],
    required: false,
  },
];

const STORAGE_KEY = "mpaios_api_keys";
const ENDPOINTS_KEY = "mpaios_custom_endpoints";
const MODEL_ASSIGNMENTS_KEY = "mpaios_model_assignments";

type AgentRole =
  | "orchestrator"
  | "strategy"
  | "content"
  | "creative"
  | "ads"
  | "seo"
  | "analytics"
  | "operations"
  | "client_success"
  | "data_engineering"
  | "local_community";

const agentRoles: { role: AgentRole; label: string; description: string }[] = [
  { role: "orchestrator", label: "Orchestrator", description: "Central routing and coordination" },
  { role: "strategy", label: "Strategy & Intelligence", description: "Agents 01-02, 19" },
  { role: "content", label: "Content & Copywriting", description: "Agents 03-06, 20" },
  { role: "creative", label: "Creative & Landing Pages", description: "Agents 05-06" },
  { role: "ads", label: "Paid Media", description: "Agents 07-09" },
  { role: "seo", label: "Organic & Authority", description: "Agents 10-12, 21, 23" },
  { role: "analytics", label: "Analytics & Optimization", description: "Agents 13-14, 22" },
  { role: "operations", label: "Operations & Infra", description: "Agents 15-18, 24" },
  { role: "client_success", label: "Client Success & Revenue", description: "Agents 25-27" },
  { role: "data_engineering", label: "Data Engineering & Intelligence", description: "Agents 28-30" },
  { role: "local_community", label: "Local & Community Growth", description: "Agents 31-33" },
];

export default function SettingsPage() {
  const [keys, setKeys] = useState<ApiKeyConfig[]>(defaultKeys);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [activeTab, setActiveTab] = useState<"keys" | "models" | "endpoints">("keys");
  const [endpoints, setEndpoints] = useState<CustomEndpoint[]>([]);
  const [modelAssignments, setModelAssignments] = useState<Record<AgentRole, string>>({
    orchestrator: "claude-sonnet-4-20250514",
    strategy: "gpt-4o",
    content: "claude-sonnet-4-20250514",
    creative: "gpt-4o",
    ads: "gpt-4o",
    seo: "gpt-4o-mini",
    analytics: "gpt-4o",
    operations: "claude-3.5-haiku",
    client_success: "gpt-4o",
    data_engineering: "gpt-4o-mini",
    local_community: "gpt-4o-mini",
  });

  // Load from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, string>;
        setKeys((prev) =>
          prev.map((k) => ({ ...k, value: parsed[k.id] || "" }))
        );
      }
      const storedEndpoints = localStorage.getItem(ENDPOINTS_KEY);
      if (storedEndpoints) setEndpoints(JSON.parse(storedEndpoints));
      const storedAssignments = localStorage.getItem(MODEL_ASSIGNMENTS_KEY);
      if (storedAssignments) setModelAssignments(JSON.parse(storedAssignments));
    } catch {}
  }, []);

  function handleSave() {
    setSaveError("");

    try {
      // Build key map
      const keyMap: Record<string, string> = {};
      keys.forEach((k) => {
        if (k.value.trim()) keyMap[k.id] = k.value.trim();
      });

      // 1. Hard save to localStorage — multiple keys for compatibility
      localStorage.setItem(STORAGE_KEY, JSON.stringify(keyMap));
      localStorage.setItem(ENDPOINTS_KEY, JSON.stringify(endpoints));
      localStorage.setItem(MODEL_ASSIGNMENTS_KEY, JSON.stringify(modelAssignments));

      // Unified ai-settings key (used by chat API and orchestrator)
      const aiSettings = {
        providers: {
          openai: { apiKey: keyMap.openai || "" },
          anthropic: { apiKey: keyMap.anthropic || "" },
          google: { apiKey: keyMap.google || "" },
          perplexity: { apiKey: keyMap.perplexity || "" },
          OpenAI: { apiKey: keyMap.openai || "" },
          Anthropic: { apiKey: keyMap.anthropic || "" },
        },
        keys: keyMap,
        endpoints,
        modelAssignments,
      };
      localStorage.setItem("ai-settings", JSON.stringify(aiSettings));

      // Verify the save actually worked
      const verify = localStorage.getItem(STORAGE_KEY);
      if (!verify) {
        throw new Error("localStorage.setItem succeeded but getItem returned null");
      }

      const verifiedKeys = JSON.parse(verify);
      const savedCount = Object.keys(verifiedKeys).length;

      console.log(`[Settings] Saved ${savedCount} API keys to localStorage`);
      console.log(`[Settings] Keys saved:`, Object.keys(verifiedKeys));

      // 2. Try Supabase save (non-blocking, fire-and-forget)
      try {
        const supabase = createClient();
        supabase.auth.getUser().then(({ data: { user } }) => {
          if (user) {
            supabase.from("profiles").update({
              preferences: {
                api_keys_configured: Object.keys(keyMap),
                model_assignments: modelAssignments,
                endpoints_count: endpoints.length,
                last_saved: new Date().toISOString(),
              },
            }).eq("id", user.id).then(() => {
              console.log("[Settings] Also saved to Supabase");
            });
          }
        });
      } catch {
        // Supabase is optional
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 4000);

    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown save error";
      console.error("[Settings] Save failed:", msg);
      setSaveError(msg);
    }
  }

  function toggleVisibility(id: string) {
    setVisibleKeys((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function updateKey(id: string, value: string) {
    setKeys((prev) => prev.map((k) => (k.id === id ? { ...k, value } : k)));
  }

  function addEndpoint() {
    setEndpoints((prev) => [
      ...prev,
      { id: Date.now().toString(), name: "", url: "", apiKey: "", model: "" },
    ]);
  }

  function updateEndpoint(id: string, field: keyof CustomEndpoint, value: string) {
    setEndpoints((prev) =>
      prev.map((e) => (e.id === id ? { ...e, [field]: value } : e))
    );
  }

  function removeEndpoint(id: string) {
    setEndpoints((prev) => prev.filter((e) => e.id !== id));
  }

  const cloudModels = keys.flatMap((k) => k.models).filter(Boolean);
  const localModels = endpoints.filter((ep) => ep.model).map((ep) => ep.model);
  const allModels = [...cloudModels, ...localModels];
  const configuredCount = keys.filter((k) => k.value).length;

  function addLMStudioPreset() {
    setEndpoints((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        name: "LM Studio",
        url: "http://localhost:1234/v1",
        apiKey: "lm-studio",
        model: "",
      },
    ]);
  }

  const [fetchingModels, setFetchingModels] = useState<Record<string, boolean>>({});
  const [availableModels, setAvailableModels] = useState<Record<string, string[]>>({});
  const [endpointErrors, setEndpointErrors] = useState<Record<string, string>>({});

  async function fetchModelsForEndpoint(epId: string) {
    const ep = endpoints.find((e) => e.id === epId);
    if (!ep?.url) return;

    setFetchingModels((prev) => ({ ...prev, [epId]: true }));
    setEndpointErrors((prev) => ({ ...prev, [epId]: "" }));
    try {
      // Detect local endpoints — call directly from browser instead of
      // routing through Vercel (which can't reach localhost)
      const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|::1|.*\.local)(:\d+)?/i.test(ep.url);

      let modelIds: string[] = [];

      if (isLocal) {
        let baseURL = ep.url.replace(/\/+$/, "");
        if (!baseURL.endsWith("/v1")) baseURL = `${baseURL}/v1`;
        const resp = await fetch(`${baseURL}/models`, {
          headers: ep.apiKey ? { Authorization: `Bearer ${ep.apiKey}` } : {},
        });
        if (!resp.ok) {
          setEndpointErrors((prev) => ({ ...prev, [epId]: `Server returned ${resp.status}. Make sure CORS is enabled in LM Studio Server Settings.` }));
          return;
        }
        const data = await resp.json();
        modelIds = (data.data || []).map((m: { id: string }) => m.id);
      } else {
        // Remote endpoints — use server-side proxy
        const resp = await fetch("/api/local-models", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: ep.url, apiKey: ep.apiKey || undefined }),
        });
        const data = await resp.json();
        if (!resp.ok || data.error) {
          setEndpointErrors((prev) => ({ ...prev, [epId]: data.error || `Server returned ${resp.status}` }));
          return;
        }
        modelIds = (data.models || []).map((m: { id: string }) => m.id);
      }

      if (modelIds.length === 0) {
        setEndpointErrors((prev) => ({ ...prev, [epId]: "No models found. Make sure the server is running and a model is loaded." }));
        return;
      }

      setAvailableModels((prev) => ({ ...prev, [epId]: modelIds }));
      if (modelIds.length > 0 && !ep.model) {
        updateEndpoint(epId, "model", modelIds[0]);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setEndpointErrors((prev) => ({ ...prev, [epId]: `Connection failed: ${msg}. Make sure the server is running and CORS is enabled.` }));
    } finally {
      setFetchingModels((prev) => ({ ...prev, [epId]: false }));
    }
  }

  const tabs = [
    { id: "keys" as const, label: "API Keys", icon: Key },
    { id: "models" as const, label: "Model Assignment", icon: Brain },
    { id: "endpoints" as const, label: "Custom Endpoints", icon: Server },
  ];

  return (
    <div className="max-w-4xl">
      <div className="flex items-start justify-between mb-6 md:mb-8 gap-3">
        <div className="min-w-0">
          <h1 className="text-[20px] md:text-[24px] font-semibold">Settings</h1>
          <p className="text-[12px] md:text-[14px] text-text-secondary mt-1">
            API keys, model config & preferences
          </p>
        </div>
        <button
          onClick={handleSave}
          className={`px-3 md:px-5 py-2.5 text-[12px] md:text-[13px] font-semibold rounded-lg transition-all flex items-center gap-2 shrink-0 shadow-sm ${
            saved
              ? "bg-brand-green text-white shadow-brand-green/20"
              : "bg-brand-blue text-white hover:bg-brand-blue-dark shadow-brand-blue/20"
          }`}
        >
          {saved ? (
            <>
              <CheckCircle2 className="w-4 h-4" />
              Saved to Device + Cloud
            </>
          ) : (
            <>
              <HardDrive className="w-4 h-4" />
              <span className="hidden sm:inline">Hard Save</span>
              <span className="sm:hidden">Save</span>
            </>
          )}
        </button>
      </div>

      {/* Save error */}
      {saveError && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-[13px] text-red-600">{saveError}</p>
        </div>
      )}

      {/* Save success with details */}
      {saved && (
        <div className="bg-brand-green/10 border border-brand-green/20 rounded-xl p-4 mb-4">
          <p className="text-[13px] text-brand-green font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Saved! {configuredCount} API keys stored to localStorage.
          </p>
          <p className="text-[11px] text-text-muted mt-1">
            Keys configured: {keys.filter(k => k.value.trim()).map(k => k.label).join(", ") || "None"}
          </p>
        </div>
      )}

      {/* Status bar */}
      <div className="bg-surface-raised rounded-xl border border-border p-3 md:p-4 mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <Shield className="w-5 h-5 text-brand-blue shrink-0" />
          <div className="min-w-0">
            <p className="text-[12px] md:text-[13px] font-medium">
              {configuredCount}/{keys.length} providers configured
            </p>
            <p className="text-[10px] md:text-[11px] text-text-muted truncate">
              Keys stored in browser localStorage — never sent to any server
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {keys.map((k) => (
            <div
              key={k.id}
              title={k.label}
              className={`w-2 h-2 md:w-2.5 md:h-2.5 rounded-full ${
                k.value
                  ? "bg-brand-green"
                  : k.required
                    ? "bg-red-400"
                    : "bg-gray-300"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-surface-raised rounded-lg border border-border p-1 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 md:gap-2 px-2 md:px-4 py-2 md:py-2.5 rounded-md text-[11px] md:text-[13px] font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-brand-blue text-white"
                  : "text-text-secondary hover:bg-gray-100"
              }`}
            >
              <Icon className="w-3.5 h-3.5 md:w-4 md:h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.label.split(" ")[0]}</span>
            </button>
          );
        })}
      </div>

      {/* API Keys Tab */}
      {activeTab === "keys" && (
        <div className="space-y-4">
          {keys.map((keyConfig) => (
            <div
              key={keyConfig.id}
              className="bg-surface-raised rounded-xl border border-border p-5"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      keyConfig.value
                        ? "bg-brand-green/10"
                        : keyConfig.required
                          ? "bg-red-50"
                          : "bg-gray-100"
                    }`}
                  >
                    <Key
                      className={`w-5 h-5 ${
                        keyConfig.value
                          ? "text-brand-green"
                          : keyConfig.required
                            ? "text-red-400"
                            : "text-gray-400"
                      }`}
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-[14px] font-semibold">
                        {keyConfig.label}
                      </h3>
                      {keyConfig.required && (
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-50 text-red-500">
                          Required
                        </span>
                      )}
                      {keyConfig.value && (
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-brand-green/10 text-brand-green">
                          Configured
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-text-secondary mt-0.5">
                      {keyConfig.description}
                    </p>
                  </div>
                </div>
                <a
                  href={keyConfig.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-brand-blue hover:text-brand-blue-dark font-medium shrink-0"
                >
                  Get API Key →
                </a>
              </div>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={visibleKeys.has(keyConfig.id) ? "text" : "password"}
                    value={keyConfig.value}
                    onChange={(e) => updateKey(keyConfig.id, e.target.value)}
                    placeholder={`Enter ${keyConfig.envVar}`}
                    className="w-full px-3 py-2.5 pr-10 border border-border rounded-lg text-[13px] font-mono focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue bg-white"
                  />
                  <button
                    onClick={() => toggleVisibility(keyConfig.id)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
                  >
                    {visibleKeys.has(keyConfig.id) ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {keyConfig.value && (
                  <button
                    onClick={() => updateKey(keyConfig.id, "")}
                    className="px-3 py-2 border border-border rounded-lg hover:bg-red-50 hover:border-red-200 transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                )}
              </div>

              {keyConfig.models.length > 0 && (
                <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] text-text-muted">Models:</span>
                  {keyConfig.models.map((m) => (
                    <span
                      key={m}
                      className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-gray-100 text-text-secondary"
                    >
                      {m}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Model Assignment Tab */}
      {activeTab === "models" && (
        <div className="space-y-4">
          <div className="bg-surface-raised rounded-xl border border-border p-4 mb-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-brand-blue" />
              <p className="text-[12px] text-text-secondary">
                Assign which model each agent group uses. Ensure the
                corresponding API key is configured.
              </p>
            </div>
          </div>

          {agentRoles.map((role) => (
            <div
              key={role.role}
              className="bg-surface-raised rounded-xl border border-border p-4 md:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4"
            >
              <div className="min-w-0">
                <h3 className="text-[13px] md:text-[14px] font-semibold">{role.label}</h3>
                <p className="text-[11px] md:text-[12px] text-text-muted mt-0.5">
                  {role.description}
                </p>
              </div>
              <select
                value={modelAssignments[role.role]}
                onChange={(e) =>
                  setModelAssignments((prev) => ({
                    ...prev,
                    [role.role]: e.target.value,
                  }))
                }
                className="w-full sm:w-auto px-3 py-2 border border-border rounded-lg text-[12px] md:text-[13px] font-mono focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue bg-white sm:min-w-[220px]"
              >
                {cloudModels.length > 0 && (
                  <optgroup label="Cloud Models">
                    {cloudModels.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </optgroup>
                )}
                {endpoints.filter((ep) => ep.model).length > 0 && (
                  <optgroup label="⚡ Local Models">
                    {endpoints.filter((ep) => ep.model).map((ep) => {
                      const host = (() => { try { return new URL(ep.url).host; } catch { return ep.url; } })();
                      return (
                        <option key={ep.id} value={ep.model}>
                          {ep.model} — {host}{ep.name ? ` (${ep.name})` : ""}
                        </option>
                      );
                    })}
                  </optgroup>
                )}
              </select>
            </div>
          ))}
        </div>
      )}

      {/* Custom Endpoints Tab */}
      {activeTab === "endpoints" && (
        <div className="space-y-4">
          <div className="bg-surface-raised rounded-xl border border-border p-4 mb-2">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-brand-blue" />
              <p className="text-[12px] text-text-secondary">
                Add custom OpenAI-compatible endpoints (Ollama, LM Studio,
                vLLM, Azure OpenAI, etc.)
              </p>
            </div>
          </div>

          {endpoints.map((ep) => (
            <div
              key={ep.id}
              className="bg-surface-raised rounded-xl border border-border p-5 space-y-3"
            >
              <div className="flex items-center justify-between">
                <input
                  type="text"
                  value={ep.name}
                  onChange={(e) => updateEndpoint(ep.id, "name", e.target.value)}
                  placeholder="Endpoint name (e.g. Local Ollama)"
                  className="text-[14px] font-semibold bg-transparent border-none focus:outline-none placeholder:text-gray-300 flex-1"
                />
                <button
                  onClick={() => removeEndpoint(ep.id)}
                  className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4 text-red-400" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-text-muted mb-1">
                    Base URL
                  </label>
                  <input
                    type="text"
                    value={ep.url}
                    onChange={(e) => updateEndpoint(ep.id, "url", e.target.value)}
                    placeholder="http://localhost:11434/v1"
                    className="w-full px-3 py-2 border border-border rounded-lg text-[12px] font-mono focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-text-muted mb-1">
                    API Key (if needed)
                  </label>
                  <input
                    type="password"
                    value={ep.apiKey}
                    onChange={(e) =>
                      updateEndpoint(ep.id, "apiKey", e.target.value)
                    }
                    placeholder="Optional"
                    className="w-full px-3 py-2 border border-border rounded-lg text-[12px] font-mono focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-text-muted mb-1">
                    Model ID
                  </label>
                  <div className="flex gap-2">
                    {availableModels[ep.id]?.length ? (
                      <select
                        value={ep.model}
                        onChange={(e) =>
                          updateEndpoint(ep.id, "model", e.target.value)
                        }
                        className="flex-1 px-3 py-2 border border-border rounded-lg text-[12px] font-mono focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue bg-white"
                      >
                        <option value="">Select a model...</option>
                        {availableModels[ep.id].map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={ep.model}
                        onChange={(e) =>
                          updateEndpoint(ep.id, "model", e.target.value)
                        }
                        placeholder="llama3.1:70b"
                        className="flex-1 px-3 py-2 border border-border rounded-lg text-[12px] font-mono focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue"
                      />
                    )}
                    <button
                      onClick={() => fetchModelsForEndpoint(ep.id)}
                      disabled={!ep.url || fetchingModels[ep.id]}
                      className="px-3 py-2 border border-border rounded-lg text-[11px] font-medium hover:bg-brand-blue/5 hover:border-brand-blue/40 transition-colors disabled:opacity-40 flex items-center gap-1.5 shrink-0"
                      title="Fetch available models from server"
                    >
                      {fetchingModels[ep.id] ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5" />
                      )}
                      {fetchingModels[ep.id] ? "Loading..." : "Fetch"}
                    </button>
                  </div>
                  {endpointErrors[ep.id] && (
                    <p className="text-[11px] text-red-500 mt-1">{endpointErrors[ep.id]}</p>
                  )}
                </div>
              </div>
            </div>
          ))}

          <div className="flex gap-3">
            <button
              onClick={addEndpoint}
              className="flex-1 border-2 border-dashed border-gray-200 rounded-xl py-4 flex items-center justify-center gap-2 hover:border-brand-blue/40 hover:bg-brand-blue/5 transition-all text-[13px] font-medium text-text-muted"
            >
              <Plus className="w-4 h-4" />
              Add Custom Endpoint
            </button>
            <button
              onClick={addLMStudioPreset}
              className="border-2 border-dashed border-purple-200 rounded-xl py-4 px-6 flex items-center justify-center gap-2 hover:border-purple-400 hover:bg-purple-50 transition-all text-[13px] font-medium text-purple-600"
            >
              <Server className="w-4 h-4" />
              LM Studio Preset
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
