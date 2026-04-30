"use client";

import { useState, useEffect } from "react";
import {
  Save,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Plus,
  Server,
  Brain,
  Loader2,
  Download,
  HardDrive,
} from "lucide-react";

interface CustomEndpoint {
  id: string;
  name: string;
  url: string;
  model: string;
}

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

const cloudModels = [
  "gpt-4o",
  "gpt-4o-mini",
  "gpt-4-turbo",
  "o1",
  "o3-mini",
  "claude-sonnet-4-20250514",
  "claude-3.5-haiku",
  "claude-3-opus",
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-2.5-flash-lite",
  "sonar-pro",
  "sonar",
];

export default function SettingsPage() {
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [activeTab, setActiveTab] = useState<"models" | "endpoints">("models");
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

  useEffect(() => {
    try {
      const storedEndpoints = localStorage.getItem(ENDPOINTS_KEY);
      if (storedEndpoints) setEndpoints(JSON.parse(storedEndpoints));
      const storedAssignments = localStorage.getItem(MODEL_ASSIGNMENTS_KEY);
      if (storedAssignments) setModelAssignments(JSON.parse(storedAssignments));
    } catch {}
  }, []);

  function handleSave() {
    setSaveError("");
    try {
      localStorage.setItem(ENDPOINTS_KEY, JSON.stringify(endpoints));
      localStorage.setItem(MODEL_ASSIGNMENTS_KEY, JSON.stringify(modelAssignments));

      const aiSettings = {
        endpoints,
        modelAssignments,
      };
      localStorage.setItem("ai-settings", JSON.stringify(aiSettings));

      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Unknown save error");
    }
  }

  function addEndpoint() {
    setEndpoints((prev) => [
      ...prev,
      { id: Date.now().toString(), name: "", url: "", model: "" },
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

  function addLMStudioPreset() {
    setEndpoints((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        name: "LM Studio",
        url: "http://localhost:1234/v1",
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
      const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|::1|.*\.local)(:\d+)?/i.test(ep.url);

      let modelIds: string[] = [];

      if (isLocal) {
        let baseURL = ep.url.replace(/\/+$/, "");
        if (!baseURL.endsWith("/v1")) baseURL = `${baseURL}/v1`;
        const resp = await fetch(`${baseURL}/models`);
        if (!resp.ok) {
          setEndpointErrors((prev) => ({
            ...prev,
            [epId]: `Server returned ${resp.status}. Make sure CORS is enabled in the server settings.`,
          }));
          return;
        }
        const data = await resp.json();
        modelIds = (data.data || []).map((m: { id: string }) => m.id);
      } else {
        const resp = await fetch("/api/local-models", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: ep.url }),
        });
        const data = await resp.json();
        if (!resp.ok || data.error) {
          setEndpointErrors((prev) => ({ ...prev, [epId]: data.error || `Server returned ${resp.status}` }));
          return;
        }
        modelIds = (data.models || []).map((m: { id: string }) => m.id);
      }

      if (modelIds.length === 0) {
        setEndpointErrors((prev) => ({
          ...prev,
          [epId]: "No models found. Make sure the server is running and a model is loaded.",
        }));
        return;
      }

      setAvailableModels((prev) => ({ ...prev, [epId]: modelIds }));
      if (modelIds.length > 0 && !ep.model) {
        updateEndpoint(epId, "model", modelIds[0]);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setEndpointErrors((prev) => ({
        ...prev,
        [epId]: `Connection failed: ${msg}. Make sure the server is running and CORS is enabled.`,
      }));
    } finally {
      setFetchingModels((prev) => ({ ...prev, [epId]: false }));
    }
  }

  const tabs = [
    { id: "models" as const, label: "Model Assignment", icon: Brain },
    { id: "endpoints" as const, label: "Custom Endpoints", icon: Server },
  ];

  return (
    <div className="max-w-4xl">
      <div className="flex items-start justify-between mb-6 md:mb-8 gap-3">
        <div className="min-w-0">
          <h1 className="text-[20px] md:text-[24px] font-semibold">Settings</h1>
          <p className="text-[12px] md:text-[14px] text-text-secondary mt-1">
            Model config &amp; preferences
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
              Saved
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span className="hidden sm:inline">Save</span>
              <span className="sm:hidden">Save</span>
            </>
          )}
        </button>
      </div>

      {saveError && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-[13px] text-red-600">{saveError}</p>
        </div>
      )}

      <div className="bg-surface-raised rounded-xl border border-border p-3 md:p-4 mb-6 flex items-center gap-3">
        <HardDrive className="w-5 h-5 text-brand-blue shrink-0" />
        <div className="min-w-0">
          <p className="text-[13px] font-medium">
            Provider credentials are managed by your administrator
          </p>
          <p className="text-[11px] text-text-muted">
            Model assignments and custom endpoint URLs are saved to this device
          </p>
        </div>
      </div>

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

      {activeTab === "models" && (
        <div className="space-y-4">
          <div className="bg-surface-raised rounded-xl border border-border p-4 mb-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-brand-blue" />
              <p className="text-[12px] text-text-secondary">
                Assign which model each agent group uses. Provider credentials are managed by your administrator.
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
                <optgroup label="Cloud Models">
                  {cloudModels.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </optgroup>
                {endpoints.filter((ep) => ep.model).length > 0 && (
                  <optgroup label="⚡ Local Models">
                    {endpoints
                      .filter((ep) => ep.model)
                      .map((ep) => {
                        const host = (() => {
                          try {
                            return new URL(ep.url).host;
                          } catch {
                            return ep.url;
                          }
                        })();
                        return (
                          <option key={ep.id} value={ep.model}>
                            {ep.model} — {host}
                            {ep.name ? ` (${ep.name})` : ""}
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

      {activeTab === "endpoints" && (
        <div className="space-y-4">
          <div className="bg-surface-raised rounded-xl border border-border p-4 mb-2">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-brand-blue" />
              <p className="text-[12px] text-text-secondary">
                Register custom OpenAI-compatible endpoints (Ollama, LM Studio, vLLM, etc.). Authentication is handled server-side.
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                    Model ID
                  </label>
                  <div className="flex gap-2">
                    {availableModels[ep.id]?.length ? (
                      <select
                        value={ep.model}
                        onChange={(e) => updateEndpoint(ep.id, "model", e.target.value)}
                        className="flex-1 px-3 py-2 border border-border rounded-lg text-[12px] font-mono focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue bg-white"
                      >
                        <option value="">Select a model...</option>
                        {availableModels[ep.id].map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={ep.model}
                        onChange={(e) => updateEndpoint(ep.id, "model", e.target.value)}
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
