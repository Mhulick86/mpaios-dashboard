"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Database,
  Table2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Search,
  AlertCircle,
  Loader2,
  MessageSquare,
  Brain,
  Zap,
  BarChart3,
  FileText,
  Clock,
  MapPin,
  Star,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/lib/supabase/auth-context";
import { createClient } from "@/lib/supabase/client";

interface TableConfig {
  name: string;
  label: string;
  icon: React.ElementType;
  description: string;
  defaultSort: string;
  columns: string[];
}

const TABLES: TableConfig[] = [
  {
    name: "conversations",
    label: "Conversations",
    icon: MessageSquare,
    description: "Chat sessions and conversation history",
    defaultSort: "updated_at",
    columns: ["id", "title", "model", "message_count", "total_tokens", "total_cost", "is_archived", "created_at", "updated_at"],
  },
  {
    name: "messages",
    label: "Messages",
    icon: FileText,
    description: "Individual chat messages with agent/tool data",
    defaultSort: "created_at",
    columns: ["id", "conversation_id", "role", "content", "agent_id", "tokens_input", "tokens_output", "model", "latency_ms", "created_at"],
  },
  {
    name: "memory",
    label: "Knowledge Base",
    icon: Brain,
    description: "Persistent learnings extracted by Agent 18",
    defaultSort: "created_at",
    columns: ["id", "category", "content", "confidence", "source_agent", "access_count", "created_at", "updated_at"],
  },
  {
    name: "agent_executions",
    label: "Agent Executions",
    icon: Zap,
    description: "Individual agent task runs and performance",
    defaultSort: "completed_at",
    columns: ["id", "agent_id", "agent_name", "division", "action", "status", "tokens_used", "cost", "latency_ms", "completed_at"],
  },
  {
    name: "token_usage",
    label: "Token Usage",
    icon: BarChart3,
    description: "LLM API call costs by model and provider",
    defaultSort: "created_at",
    columns: ["id", "model", "provider", "tokens_input", "tokens_output", "cost", "endpoint", "created_at"],
  },
  {
    name: "audit_log",
    label: "Audit Log",
    icon: Clock,
    description: "System event trail for all significant actions",
    defaultSort: "created_at",
    columns: ["id", "event_type", "resource_type", "resource_id", "tokens_used", "cost", "model", "latency_ms", "created_at"],
  },
  {
    name: "workflows",
    label: "Workflows",
    icon: Zap,
    description: "Automation pipeline definitions",
    defaultSort: "updated_at",
    columns: ["id", "name", "description", "pipeline_id", "trigger_type", "is_active", "run_count", "last_run_at", "created_at"],
  },
  {
    name: "workflow_runs",
    label: "Workflow Runs",
    icon: RefreshCw,
    description: "Execution history of workflow pipelines",
    defaultSort: "started_at",
    columns: ["id", "workflow_id", "status", "trigger", "current_step", "total_steps", "tokens_total", "cost_total", "started_at", "completed_at"],
  },
  {
    name: "evaluations",
    label: "Evaluations",
    icon: Star,
    description: "Quality scoring and user feedback on responses",
    defaultSort: "created_at",
    columns: ["id", "conversation_id", "thumbs", "rating", "feedback_text", "quality_scores", "auto_metrics", "created_at"],
  },
  {
    name: "local_seo_scans",
    label: "Local SEO Scans",
    icon: MapPin,
    description: "Geographic ranking grid scan results",
    defaultSort: "created_at",
    columns: ["id", "business_name", "keyword", "grid_size", "avg_rank", "top_rank", "visibility", "total_points", "created_at"],
  },
];

function formatCell(value: unknown, column: string): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";

  // Format dates
  if (column.endsWith("_at") || column === "created_at" || column === "updated_at") {
    try {
      return new Date(value as string).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return String(value);
    }
  }

  // Format costs
  if (column === "cost" || column === "total_cost" || column === "cost_total") {
    return `$${Number(value).toFixed(4)}`;
  }

  // Format confidence
  if (column === "confidence" || column === "visibility") {
    return `${(Number(value) * 100).toFixed(0)}%`;
  }

  // Truncate long content
  if (typeof value === "string" && value.length > 120) {
    return value.slice(0, 120) + "...";
  }

  // Format objects/arrays
  if (typeof value === "object") {
    const s = JSON.stringify(value);
    return s.length > 80 ? s.slice(0, 80) + "..." : s;
  }

  return String(value);
}

export default function DatabasePage() {
  const { user } = useAuth();
  const [supabase] = useState(() => createClient());
  const [authReady, setAuthReady] = useState(false);

  const [activeTable, setActiveTable] = useState<TableConfig>(TABLES[0]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rowCount, setRowCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);
  const [tableCounts, setTableCounts] = useState<Record<string, number>>({});
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const PAGE_SIZE = 50;

  // Fetch row counts for all tables
  const fetchCounts = useCallback(async () => {
    if (!user) return;
    const counts: Record<string, number> = {};
    const missing: string[] = [];
    for (const t of TABLES) {
      const { count, error: err } = await supabase
        .from(t.name)
        .select("*", { count: "exact", head: true });
      if (err) {
        console.warn(`[database] Table "${t.name}":`, err.message);
        counts[t.name] = -1; // Mark as error
        missing.push(t.name);
      } else {
        counts[t.name] = count || 0;
      }
    }
    setTableCounts(counts);
    if (missing.length > 0) {
      console.warn(`[database] Missing or inaccessible tables: ${missing.join(", ")}`);
    }
  }, [user, supabase]);

  // Fetch rows for active table
  const fetchRows = useCallback(async () => {
    if (!user || !authReady) return;
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from(activeTable.name)
        .select("*", { count: "exact" })
        .order(activeTable.defaultSort, { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      // Simple content search
      if (searchQuery.trim()) {
        const sq = searchQuery.trim();
        // Search in the most likely text column for each table
        const searchCol =
          activeTable.name === "conversations" ? "title" :
          activeTable.name === "messages" ? "content" :
          activeTable.name === "memory" ? "content" :
          activeTable.name === "agent_executions" ? "action" :
          activeTable.name === "audit_log" ? "event_type" :
          activeTable.name === "workflows" ? "name" :
          activeTable.name === "local_seo_scans" ? "keyword" :
          null;
        if (searchCol) {
          query = query.ilike(searchCol, `%${sq}%`);
        }
      }

      const { data, count, error: err } = await query;
      if (err) throw new Error(err.message);
      setRows(data || []);
      setRowCount(count || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [user, authReady, supabase, activeTable, page, searchQuery]);

  // Wait for Supabase auth session to be ready before querying
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setAuthReady(true);
      } else {
        // Listen for auth state change
        const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
          if (session) setAuthReady(true);
        });
        return () => listener.subscription.unsubscribe();
      }
    });
  }, [supabase]);

  useEffect(() => {
    if (authReady) fetchCounts();
  }, [authReady, fetchCounts]);

  useEffect(() => {
    setPage(0);
    setExpandedRow(null);
  }, [activeTable]);

  useEffect(() => {
    if (authReady) fetchRows();
  }, [authReady, fetchRows]);

  const totalRows = Object.values(tableCounts).filter(c => c >= 0).reduce((a, b) => a + b, 0);
  const totalPages = Math.ceil(rowCount / PAGE_SIZE);

  return (
    <div className="max-w-[1400px]">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-3">
        <div>
          <h1 className="text-[20px] md:text-[24px] font-semibold">Database</h1>
          <p className="text-[12px] md:text-[14px] text-text-secondary mt-1">
            Browse all stored data across {TABLES.length} tables &middot; {totalRows.toLocaleString()} total rows
          </p>
        </div>
        <button
          onClick={() => { fetchCounts(); fetchRows(); }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border hover:bg-gray-50 transition-colors text-[12px] font-medium"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      <div className="flex gap-4 md:gap-6">
        {/* Table Selector Sidebar */}
        <div className="w-56 md:w-64 shrink-0 space-y-1">
          {TABLES.map((t) => {
            const Icon = t.icon;
            const isActive = activeTable.name === t.name;
            const count = tableCounts[t.name];
            return (
              <button
                key={t.name}
                onClick={() => setActiveTable(t)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-colors ${
                  isActive
                    ? "bg-brand-blue/10 text-brand-blue border border-brand-blue/20"
                    : "hover:bg-gray-50 text-text-secondary"
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-brand-blue" : "text-gray-400"}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-[12px] font-medium truncate ${isActive ? "text-brand-blue" : ""}`}>
                    {t.label}
                  </p>
                </div>
                {count !== undefined && (
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                    count === -1
                      ? "bg-red-100 text-red-400"
                      : isActive
                        ? "bg-brand-blue/20 text-brand-blue"
                        : "bg-gray-100 text-gray-400"
                  }`}>
                    {count === -1 ? "—" : count.toLocaleString()}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Data Panel */}
        <div className="flex-1 min-w-0">
          {/* Table Header */}
          <div className="bg-surface-raised rounded-xl border border-border p-4 mb-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Table2 className="w-4 h-4 text-brand-blue" />
                <h2 className="text-[14px] font-semibold">{activeTable.label}</h2>
                <span className="text-[11px] text-text-muted">
                  {rowCount.toLocaleString()} rows
                </span>
              </div>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
                  placeholder={`Search ${activeTable.label.toLowerCase()}...`}
                  className="pl-8 pr-3 py-1.5 border border-border rounded-lg text-[12px] w-56 focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue"
                />
              </div>
            </div>
            <p className="text-[11px] text-text-muted mt-1">{activeTable.description}</p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-[12px] text-red-700 mb-3">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          {/* Table doesn't exist */}
          {tableCounts[activeTable.name] === -1 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[13px] font-medium text-amber-800">Table &quot;{activeTable.name}&quot; not found</p>
                  <p className="text-[11px] text-amber-600 mt-1">
                    This table hasn&apos;t been created in your Supabase database yet. Create it in the Supabase Dashboard → SQL Editor, or it will be auto-created when data is first written.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="bg-surface-raised rounded-xl border border-border overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-brand-blue" />
              </div>
            ) : rows.length === 0 ? (
              <div className="text-center py-20 text-text-muted text-[13px]">
                <Database className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                No data found
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b border-border bg-gray-50/50">
                      <th className="w-8 px-2 py-2.5"></th>
                      {activeTable.columns.map((col) => (
                        <th
                          key={col}
                          className="px-3 py-2.5 text-left font-semibold text-text-muted uppercase tracking-wider whitespace-nowrap"
                        >
                          {col.replace(/_/g, " ")}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => {
                      const rowId = String(row.id || idx);
                      const isExpanded = expandedRow === rowId;
                      return (
                        <>
                          <tr
                            key={rowId}
                            className={`border-b border-border/50 hover:bg-brand-blue/5 cursor-pointer transition-colors ${
                              idx % 2 === 0 ? "" : "bg-gray-50/30"
                            }`}
                            onClick={() => setExpandedRow(isExpanded ? null : rowId)}
                          >
                            <td className="px-2 py-2 text-center">
                              {isExpanded ? (
                                <ChevronDown className="w-3 h-3 text-gray-400 inline" />
                              ) : (
                                <ChevronRight className="w-3 h-3 text-gray-400 inline" />
                              )}
                            </td>
                            {activeTable.columns.map((col) => (
                              <td key={col} className="px-3 py-2 whitespace-nowrap max-w-[200px] truncate font-mono">
                                {formatCell(row[col], col)}
                              </td>
                            ))}
                          </tr>
                          {isExpanded && (
                            <tr key={`${rowId}-detail`} className="bg-gray-50">
                              <td colSpan={activeTable.columns.length + 1} className="px-6 py-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                                  {Object.entries(row).map(([key, val]) => (
                                    <div key={key} className="flex gap-2">
                                      <span className="font-semibold text-text-muted shrink-0 min-w-[120px]">
                                        {key}:
                                      </span>
                                      <span className="font-mono text-text-primary break-all">
                                        {val === null ? "null" : typeof val === "object" ? JSON.stringify(val, null, 2) : String(val)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                <span className="text-[11px] text-text-muted">
                  Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, rowCount)} of {rowCount.toLocaleString()}
                </span>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setPage(Math.max(0, page - 1))}
                    disabled={page === 0}
                    className="px-2.5 py-1 rounded border border-border text-[11px] font-medium hover:bg-gray-50 disabled:opacity-30"
                  >
                    Prev
                  </button>
                  <span className="px-2.5 py-1 text-[11px] text-text-muted">
                    {page + 1} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                    disabled={page >= totalPages - 1}
                    className="px-2.5 py-1 rounded border border-border text-[11px] font-medium hover:bg-gray-50 disabled:opacity-30"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
