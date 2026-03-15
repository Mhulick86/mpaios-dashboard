"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Mail,
  RefreshCw,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
  Zap,
  Settings2,
  FolderOpen,
  Play,
  Pause,
} from "lucide-react";
import Link from "next/link";
import {
  INTEGRATIONS_STORAGE_KEY,
  type IntegrationsConfig,
  defaultIntegrations,
} from "@/lib/asana";
import type { MailAnalysis, MailUrgency, MailCategory } from "@/lib/gemini";

/* ---------- Types ---------- */

interface ProcessedTask {
  fileId: string;
  fileName: string;
  analysis: MailAnalysis;
  task: { gid: string; name: string; notes?: string; due_on?: string };
  processedAt: string;
}

/* ---------- Storage ---------- */

const MAIL_TASKS_KEY = "mpaios_mail_tasks";
const PROCESSED_IDS_KEY = "mpaios_mail_processed_ids";

function loadTasks(): ProcessedTask[] {
  try {
    const stored = localStorage.getItem(MAIL_TASKS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveTasks(tasks: ProcessedTask[]) {
  localStorage.setItem(MAIL_TASKS_KEY, JSON.stringify(tasks));
}

function loadProcessedIds(): string[] {
  try {
    const stored = localStorage.getItem(PROCESSED_IDS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveProcessedIds(ids: string[]) {
  localStorage.setItem(PROCESSED_IDS_KEY, JSON.stringify(ids));
}

/* ---------- Kanban columns ---------- */

const URGENCY_COLUMNS: { key: MailUrgency; label: string; color: string; bgColor: string; borderColor: string }[] = [
  { key: "Critical", label: "Critical", color: "text-red-600", bgColor: "bg-red-50", borderColor: "border-red-200" },
  { key: "High", label: "High", color: "text-orange-600", bgColor: "bg-orange-50", borderColor: "border-orange-200" },
  { key: "Medium", label: "Medium", color: "text-yellow-600", bgColor: "bg-yellow-50", borderColor: "border-yellow-200" },
  { key: "Low", label: "Low", color: "text-green-600", bgColor: "bg-green-50", borderColor: "border-green-200" },
];

const CATEGORY_COLORS: Record<string, string> = {
  "Invoice / Bill": "bg-red-100 text-red-700",
  "Legal / Contract": "bg-purple-100 text-purple-700",
  "Government / Tax": "bg-blue-100 text-blue-700",
  "Insurance": "bg-teal-100 text-teal-700",
  "Medical / Health": "bg-green-100 text-green-700",
  "Banking / Financial": "bg-orange-100 text-orange-700",
  "Subscription / Service": "bg-sky-100 text-sky-700",
  "Personal Correspondence": "bg-emerald-100 text-emerald-700",
  "Marketing / Promotional": "bg-violet-100 text-violet-700",
  "Other": "bg-gray-100 text-gray-700",
};

/* ---------- Card Component ---------- */

function TaskCard({ task }: { task: ProcessedTask }) {
  const [expanded, setExpanded] = useState(false);
  const { analysis, fileName } = task;

  return (
    <div className="bg-white rounded-lg border border-border p-3 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="text-[13px] font-semibold leading-snug flex-1">
          {analysis.title}
        </h4>
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1 rounded hover:bg-gray-100 transition-colors shrink-0"
        >
          {expanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
          )}
        </button>
      </div>

      {/* Category badge */}
      <div className="flex items-center gap-1.5 flex-wrap mb-2">
        <span
          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
            CATEGORY_COLORS[analysis.category] || "bg-gray-100 text-gray-700"
          }`}
        >
          {analysis.category}
        </span>
        {analysis.sender && (
          <span className="text-[10px] text-text-muted truncate max-w-[120px]">
            from {analysis.sender}
          </span>
        )}
      </div>

      {/* Summary */}
      <p className="text-[12px] text-text-secondary leading-relaxed mb-2">
        {analysis.summary}
      </p>

      {/* File info */}
      <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
        <FileText className="w-3 h-3" />
        <span className="truncate">{fileName}</span>
      </div>

      {/* Due date */}
      {task.task.due_on && (
        <div className="flex items-center gap-1.5 text-[11px] text-text-muted mt-1">
          <Clock className="w-3 h-3" />
          <span>Due: {new Date(task.task.due_on).toLocaleDateString()}</span>
        </div>
      )}

      {/* Expanded details */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-border space-y-2">
          <div>
            <p className="text-[11px] font-semibold text-text-secondary mb-0.5">
              Action Required
            </p>
            <p className="text-[12px] text-text-primary">
              {analysis.actionRequired}
            </p>
          </div>
          {analysis.keyDetails.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-text-secondary mb-0.5">
                Key Details
              </p>
              <ul className="space-y-0.5">
                {analysis.keyDetails.map((d, i) => (
                  <li key={i} className="text-[11px] text-text-secondary flex gap-1.5">
                    <span className="text-text-muted shrink-0">•</span>
                    {d}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <a
            href={`https://app.asana.com/0/0/${task.task.gid}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-brand-blue hover:underline font-medium mt-1"
          >
            View in Asana <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}
    </div>
  );
}

/* ---------- Main Page ---------- */

export default function MailKanbanPage() {
  const [config, setConfig] = useState<IntegrationsConfig>(defaultIntegrations());
  const [tasks, setTasks] = useState<ProcessedTask[]>([]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [autoPolling, setAutoPolling] = useState(false);
  const [filterCategory, setFilterCategory] = useState<MailCategory | "All">("All");

  // Load config & tasks
  useEffect(() => {
    try {
      const stored = localStorage.getItem(INTEGRATIONS_STORAGE_KEY);
      if (stored) {
        setConfig({ ...defaultIntegrations(), ...JSON.parse(stored) });
      }
    } catch { /* ignore */ }
    setTasks(loadTasks());
  }, []);

  // Check automation readiness
  const isReady =
    config.googleDrive?.connected &&
    config.gemini?.connected &&
    config.asana?.connected &&
    config.mailAutomation?.asanaProjectGid;

  // Process new files
  const processFiles = useCallback(async () => {
    if (!isReady || processing) return;

    setProcessing(true);
    setError(null);
    setLastResult(null);

    try {
      const processedIds = loadProcessedIds();

      const res = await fetch("/api/mail-automation/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driveAccessToken: config.googleDrive.accessToken,
          folderId: config.googleDrive.folderId,
          geminiApiKey: config.gemini.apiKey,
          asanaPat: config.asana.pat,
          asanaProjectGid: config.mailAutomation.asanaProjectGid,
          processedFileIds: processedIds,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Processing failed");

      if (data.processed > 0) {
        const newTasks: ProcessedTask[] = data.tasks.map(
          (t: { fileId: string; fileName: string; analysis: MailAnalysis; task: { gid: string; name: string; notes?: string; due_on?: string } }) => ({
            ...t,
            processedAt: new Date().toISOString(),
          })
        );

        const updatedTasks = [...newTasks, ...tasks];
        setTasks(updatedTasks);
        saveTasks(updatedTasks);

        const updatedIds = [...processedIds, ...data.newProcessedIds];
        saveProcessedIds(updatedIds);

        setLastResult(`Processed ${data.processed} new file${data.processed > 1 ? "s" : ""}`);
      } else {
        setLastResult("No new files found");
      }

      if (data.errors?.length > 0) {
        setError(
          `${data.errors.length} file${data.errors.length > 1 ? "s" : ""} failed: ${data.errors[0].error}`
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Processing failed");
    } finally {
      setProcessing(false);
    }
  }, [isReady, processing, config, tasks]);

  // Auto polling
  useEffect(() => {
    if (!autoPolling || !isReady) return;

    const interval = setInterval(
      processFiles,
      (config.mailAutomation?.pollIntervalMinutes || 5) * 60 * 1000
    );

    return () => clearInterval(interval);
  }, [autoPolling, isReady, processFiles, config.mailAutomation?.pollIntervalMinutes]);

  // Group tasks by urgency
  const tasksByUrgency = URGENCY_COLUMNS.map((col) => ({
    ...col,
    tasks: tasks.filter(
      (t) =>
        t.analysis.urgency === col.key &&
        (filterCategory === "All" || t.analysis.category === filterCategory)
    ),
  }));

  // All categories present in tasks
  const categories = Array.from(new Set(tasks.map((t) => t.analysis.category)));

  // Not configured state
  if (!isReady) {
    return (
      <div className="max-w-2xl mx-auto mt-12">
        <div className="bg-surface-raised rounded-xl border border-border p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-brand-blue/10 flex items-center justify-center mx-auto mb-4">
            <Mail className="w-8 h-8 text-brand-blue" />
          </div>
          <h1 className="text-[20px] font-semibold mb-2">Mail Automation</h1>
          <p className="text-[14px] text-text-secondary mb-6 max-w-md mx-auto">
            Automatically scan mail from Google Drive, analyze with Gemini AI,
            and create categorized tasks in Asana.
          </p>

          <div className="space-y-3 text-left max-w-sm mx-auto mb-6">
            <SetupItem
              label="Google Drive"
              done={!!config.googleDrive?.connected}
              hint="Connect & select mail folder"
            />
            <SetupItem
              label="Gemini AI"
              done={!!config.gemini?.connected}
              hint="API key for document analysis"
            />
            <SetupItem
              label="Asana"
              done={!!config.asana?.connected}
              hint="Connected for task creation"
            />
            <SetupItem
              label="Asana Project"
              done={!!config.mailAutomation?.asanaProjectGid}
              hint="Select target project for tasks"
            />
          </div>

          <Link
            href="/integrations"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-blue text-white text-[13px] font-medium hover:bg-brand-blue-dark transition-colors"
          >
            <Settings2 className="w-4 h-4" />
            Configure Integrations
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-3">
        <div>
          <h1 className="text-[20px] md:text-[24px] font-semibold flex items-center gap-2">
            <Mail className="w-6 h-6 text-brand-blue" />
            Mail Kanban
          </h1>
          <p className="text-[12px] md:text-[14px] text-text-secondary mt-1">
            Scanned mail from{" "}
            <span className="font-medium">{config.googleDrive.folderName || "Drive folder"}</span>
            {" → "}Gemini AI analysis → Asana tasks
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Auto-poll toggle */}
          <button
            onClick={() => setAutoPolling(!autoPolling)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-colors border ${
              autoPolling
                ? "bg-brand-green/10 border-brand-green/30 text-brand-green"
                : "bg-gray-50 border-border text-text-secondary hover:bg-gray-100"
            }`}
          >
            {autoPolling ? (
              <><Pause className="w-3.5 h-3.5" /> Auto: ON</>
            ) : (
              <><Play className="w-3.5 h-3.5" /> Auto: OFF</>
            )}
          </button>

          {/* Manual scan */}
          <button
            onClick={processFiles}
            disabled={processing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-blue text-white text-[13px] font-medium hover:bg-brand-blue-dark transition-colors disabled:opacity-50"
          >
            {processing ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Scanning...</>
            ) : (
              <><RefreshCw className="w-4 h-4" /> Scan Now</>
            )}
          </button>
        </div>
      </div>

      {/* Status messages */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-[12px] text-red-700 mb-4">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}
      {lastResult && !error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-brand-green/10 border border-brand-green/20 text-[12px] text-brand-green mb-4">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> {lastResult}
        </div>
      )}

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        <StatCard label="Total Items" value={tasks.length} icon={FileText} />
        <StatCard
          label="Critical"
          value={tasks.filter((t) => t.analysis.urgency === "Critical").length}
          icon={AlertTriangle}
          color="text-red-600"
        />
        <StatCard
          label="High"
          value={tasks.filter((t) => t.analysis.urgency === "High").length}
          icon={AlertTriangle}
          color="text-orange-600"
        />
        <StatCard
          label="Medium"
          value={tasks.filter((t) => t.analysis.urgency === "Medium").length}
          icon={Clock}
          color="text-yellow-600"
        />
        <StatCard
          label="Low"
          value={tasks.filter((t) => t.analysis.urgency === "Low").length}
          icon={CheckCircle2}
          color="text-green-600"
        />
      </div>

      {/* Category filter */}
      {categories.length > 0 && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="text-[11px] font-medium text-text-muted uppercase tracking-wider">
            Filter:
          </span>
          <button
            onClick={() => setFilterCategory("All")}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
              filterCategory === "All"
                ? "bg-brand-blue text-white"
                : "bg-gray-100 text-text-secondary hover:bg-gray-200"
            }`}
          >
            All ({tasks.length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                filterCategory === cat
                  ? "bg-brand-blue text-white"
                  : `${CATEGORY_COLORS[cat] || "bg-gray-100 text-gray-700"} hover:opacity-80`
              }`}
            >
              {cat} ({tasks.filter((t) => t.analysis.category === cat).length})
            </button>
          ))}
        </div>
      )}

      {/* Kanban columns */}
      {tasks.length === 0 ? (
        <div className="bg-surface-raised rounded-xl border border-border p-12 text-center">
          <FolderOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-[14px] text-text-secondary font-medium mb-1">
            No mail processed yet
          </p>
          <p className="text-[12px] text-text-muted mb-4">
            Click &quot;Scan Now&quot; to check your Drive folder for new documents
          </p>
          <button
            onClick={processFiles}
            disabled={processing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-blue text-white text-[13px] font-medium hover:bg-brand-blue-dark transition-colors disabled:opacity-50"
          >
            <Zap className="w-4 h-4" /> Run First Scan
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {tasksByUrgency.map((col) => (
            <div key={col.key} className="min-w-0">
              {/* Column header */}
              <div
                className={`flex items-center justify-between px-3 py-2.5 rounded-t-xl ${col.bgColor} border ${col.borderColor} border-b-0`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${
                      col.key === "Critical"
                        ? "bg-red-500"
                        : col.key === "High"
                          ? "bg-orange-500"
                          : col.key === "Medium"
                            ? "bg-yellow-500"
                            : "bg-green-500"
                    }`}
                  />
                  <span className={`text-[13px] font-semibold ${col.color}`}>
                    {col.label}
                  </span>
                </div>
                <span
                  className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${col.bgColor} ${col.color}`}
                >
                  {col.tasks.length}
                </span>
              </div>

              {/* Column body */}
              <div
                className={`border ${col.borderColor} border-t-0 rounded-b-xl p-2 space-y-2 min-h-[200px] bg-gray-50/50`}
              >
                {col.tasks.length === 0 ? (
                  <div className="flex items-center justify-center h-[180px] text-[12px] text-text-muted">
                    No items
                  </div>
                ) : (
                  col.tasks.map((task) => (
                    <TaskCard key={task.fileId} task={task} />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Small components ---------- */

function SetupItem({
  label,
  done,
  hint,
}: {
  label: string;
  done: boolean;
  hint: string;
}) {
  return (
    <div className="flex items-center gap-3">
      {done ? (
        <CheckCircle2 className="w-5 h-5 text-brand-green shrink-0" />
      ) : (
        <div className="w-5 h-5 rounded-full border-2 border-gray-300 shrink-0" />
      )}
      <div>
        <p className={`text-[13px] font-medium ${done ? "text-brand-green" : "text-text-primary"}`}>
          {label}
        </p>
        <p className="text-[11px] text-text-muted">{hint}</p>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color?: string;
}) {
  return (
    <div className="bg-surface-raised rounded-xl border border-border p-3">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-4 h-4 ${color || "text-text-muted"}`} />
        <span className="text-[11px] text-text-muted font-medium">{label}</span>
      </div>
      <p className={`text-[20px] font-bold ${color || "text-text-primary"}`}>
        {value}
      </p>
    </div>
  );
}
