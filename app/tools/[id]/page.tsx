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
} from "lucide-react";

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
  const [activeTab, setActiveTab] = useState<"config" | "logs" | "schedule">("config");
  const [isRunning, setIsRunning] = useState(false);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [runLogs, setRunLogs] = useState<ToolRunLog[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);

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
    </div>
  );
}
