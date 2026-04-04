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
} from "lucide-react";

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
  {
    id: "openai",
    label: "OpenAI",
    provider: "OpenAI",
    envVar: "OPENAI_API_KEY",
    value: "",
    description: "Powers GPT-4o agents for strategy, copywriting, and analysis",
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
    description: "Powers Claude agents for orchestration, content, and reasoning",
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
    description: "Powers Gemini agents for multimodal analysis and search grounding",
    docsUrl: "https://aistudio.google.com/apikey",
    models: ["gemini-2.0-flash", "gemini-2.0-pro", "gemini-1.5-pro"],
    required: false,
  },
  {
    id: "perplexity",
    label: "Perplexity",
    provider: "Perplexity",
    envVar: "PERPLEXITY_API_KEY",
    value: "",
    description: "Real-time web search for competitive intelligence and trend analysis",
    docsUrl: "https://docs.perplexity.ai",
    models: ["sonar-pro", "sonar"],
    required: false,
  },
  {
    id: "stability",
    label: "Stability AI",
    provider: "Stability",
    envVar: "STABILITY_API_KEY",
    value: "",
    description: "Image generation for ad creatives, social assets, and landing pages",
    docsUrl: "https://platform.stability.ai/account/keys",
    models: ["stable-diffusion-xl", "stable-image-core"],
    required: false,
  },
  {
    id: "serp",
    label: "SerpAPI",
    provider: "SerpAPI",
    envVar: "SERPAPI_KEY",
    value: "",
    description: "Search engine results for SEO analysis and keyword research",
    docsUrl: "https://serpapi.com/manage-api-key",
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
  | "operations";

const agentRoles: { role: AgentRole; label: string; description: string }[] = [
  { role: "orchestrator", label: "Orchestrator", description: "Central routing and coordination" },
  { role: "strategy", label: "Strategy & Intelligence", description: "Agents 1-2" },
  { role: "content", label: "Content & Copywriting", description: "Agents 3-4" },
  { role: "creative", label: "Creative & Landing Pages", description: "Agents 5-6" },
  { role: "ads", label: "Paid Media", description: "Agents 7-9" },
  { role: "seo", label: "Organic & Social", description: "Agents 10-12" },
  { role: "analytics", label: "Analytics & CRO", description: "Agents 13-14" },
  { role: "operations", label: "Operations & Infra", description: "Agents 15-18" },
];

export default function SettingsPage() {
  const [keys, setKeys] = useState<ApiKeyConfig[]>(defaultKeys);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState(false);
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
    const keyMap: Record<string, string> = {};
    keys.forEach((k) => {
      if (k.value) keyMap[k.id] = k.value;
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(keyMap));
    localStorage.setItem(ENDPOINTS_KEY, JSON.stringify(endpoints));
    localStorage.setItem(MODEL_ASSIGNMENTS_KEY, JSON.stringify(modelAssignments));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
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

  const allModels = keys.flatMap((k) => k.models).filter(Boolean);
  const configuredCount = keys.filter((k) => k.value).length;

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
          className={`px-3 md:px-4 py-2 text-[12px] md:text-[13px] font-medium rounded-lg transition-all flex items-center gap-2 shrink-0 ${
            saved
              ? "bg-brand-green text-white"
              : "bg-brand-blue text-white hover:bg-brand-blue-dark"
          }`}
        >
          {saved ? (
            <>
              <CheckCircle2 className="w-4 h-4" />
              Saved
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span className="hidden sm:inline">Save Changes</span>
              <span className="sm:hidden">Save</span>
            </>
          )}
        </button>
      </div>

      {/* Status bar */}
      <div className="bg-surface-raised rounded-xl border border-border p-3 md:p-4 mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <Shield className="w-5 h-5 text-brand-blue shrink-0" />
          <div className="min-w-0">
            <p className="text-[12px] md:text-[13px] font-medium">
              {configuredCount}/{keys.length} providers configured
            </p>
            <p className="text-[10px] md:text-[11px] text-text-muted truncate">
              Keys stored locally — never sent to any server
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
                {allModels.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
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
                  <input
                    type="text"
                    value={ep.model}
                    onChange={(e) =>
                      updateEndpoint(ep.id, "model", e.target.value)
                    }
                    placeholder="llama3.1:70b"
                    className="w-full px-3 py-2 border border-border rounded-lg text-[12px] font-mono focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue"
                  />
                </div>
              </div>
            </div>
          ))}

          <button
            onClick={addEndpoint}
            className="w-full border-2 border-dashed border-gray-200 rounded-xl py-4 flex items-center justify-center gap-2 hover:border-brand-blue/40 hover:bg-brand-blue/5 transition-all text-[13px] font-medium text-text-muted"
          >
            <Plus className="w-4 h-4" />
            Add Custom Endpoint
          </button>
        </div>
      )}
    </div>
  );
}
