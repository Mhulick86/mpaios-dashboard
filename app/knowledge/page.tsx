"use client";

import { useState, useEffect } from "react";
import {
  Brain,
  Search,
  Trash2,
  Edit3,
  Check,
  X,
  Filter,
  TrendingUp,
  BookOpen,
  Lightbulb,
  Target,
  BarChart3,
  Settings2,
  Workflow,
  Users,
  ChevronDown,
  ChevronRight,
  Plus,
  Clock,
  Star,
} from "lucide-react";
import {
  type KnowledgeEntry,
  type KnowledgeCategory,
  type KnowledgeStats,
  getAllEntries,
  deleteEntry,
  updateEntry,
  addEntry,
  getStats,
} from "@/lib/knowledgeBase";

/* ---------- Category config ---------- */
const CATEGORY_CONFIG: Record<
  KnowledgeCategory,
  { label: string; icon: typeof Brain; color: string }
> = {
  client_insight: { label: "Client Insights", icon: Users, color: "#2CACE8" },
  campaign_learning: { label: "Campaign Learnings", icon: TrendingUp, color: "#08AE67" },
  strategy_pattern: { label: "Strategy Patterns", icon: Target, color: "#F59E0B" },
  creative_insight: { label: "Creative Insights", icon: Lightbulb, color: "#8B5CF6" },
  performance_data: { label: "Performance Data", icon: BarChart3, color: "#EF4444" },
  platform_update: { label: "Platform Updates", icon: Settings2, color: "#6B7280" },
  process_improvement: { label: "Process Improvements", icon: Workflow, color: "#EC4899" },
  audience_insight: { label: "Audience Insights", icon: BookOpen, color: "#14B8A6" },
};

const ALL_CATEGORIES: KnowledgeCategory[] = Object.keys(CATEGORY_CONFIG) as KnowledgeCategory[];

function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

/* ---------- Component ---------- */
export default function KnowledgePage() {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [stats, setStats] = useState<KnowledgeStats | null>(null);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<KnowledgeCategory | "all">("all");
  const [filterConfidence, setFilterConfidence] = useState<string>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: "", content: "", category: "" as KnowledgeCategory, confidence: "" as "high" | "medium" | "low" });
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({
    title: "",
    content: "",
    category: "client_insight" as KnowledgeCategory,
    confidence: "medium" as "high" | "medium" | "low",
    tags: "",
  });
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());

  function refresh() {
    setEntries(getAllEntries());
    setStats(getStats());
  }

  useEffect(() => {
    refresh();
  }, []);

  /* --- Filtering --- */
  const filtered = entries.filter((e) => {
    if (filterCategory !== "all" && e.category !== filterCategory) return false;
    if (filterConfidence !== "all" && e.confidence !== filterConfidence) return false;
    if (search) {
      const lower = search.toLowerCase();
      return (
        e.title.toLowerCase().includes(lower) ||
        e.content.toLowerCase().includes(lower) ||
        e.tags.some((t) => t.toLowerCase().includes(lower)) ||
        (e.metadata?.client?.toLowerCase().includes(lower) ?? false)
      );
    }
    return true;
  });

  /* --- Actions --- */
  function handleDelete(id: string) {
    deleteEntry(id);
    refresh();
  }

  function startEdit(entry: KnowledgeEntry) {
    setEditingId(entry.id);
    setEditForm({
      title: entry.title,
      content: entry.content,
      category: entry.category,
      confidence: entry.confidence,
    });
  }

  function saveEdit() {
    if (!editingId) return;
    updateEntry(editingId, {
      title: editForm.title,
      content: editForm.content,
      category: editForm.category,
      confidence: editForm.confidence,
    });
    setEditingId(null);
    refresh();
  }

  function handleAdd() {
    if (!addForm.title.trim() || !addForm.content.trim()) return;
    addEntry({
      category: addForm.category,
      title: addForm.title.trim(),
      content: addForm.content.trim(),
      tags: addForm.tags.split(",").map((t) => t.trim()).filter(Boolean),
      confidence: addForm.confidence,
      source: { extractedAt: Date.now() },
    });
    setAddForm({ title: "", content: "", category: "client_insight", confidence: "medium", tags: "" });
    setShowAddForm(false);
    refresh();
  }

  function toggleExpand(id: string) {
    setExpandedEntries((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const confidenceBadge = (c: string) => {
    const styles = {
      high: "bg-green-50 text-green-700 border-green-200",
      medium: "bg-amber-50 text-amber-700 border-amber-200",
      low: "bg-gray-50 text-gray-500 border-gray-200",
    };
    return styles[c as keyof typeof styles] || styles.low;
  };

  /* ---------- Render ---------- */
  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start sm:items-center justify-between mb-6 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-purple-100 flex items-center justify-center shrink-0">
            <Brain className="w-4 h-4 md:w-5 md:h-5 text-purple-600" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[16px] md:text-[18px] font-bold">Knowledge Base</h1>
            <p className="text-[11px] md:text-[12px] text-text-muted truncate">
              Agent 18 — Institutional memory
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-2 rounded-lg bg-brand-blue text-white text-[12px] md:text-[13px] font-medium hover:bg-brand-blue-dark transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Add Entry</span>
          <span className="sm:hidden">Add</span>
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-6">
          <div className="bg-white rounded-xl border border-border p-3 md:p-4">
            <p className="text-[10px] md:text-[11px] font-medium text-text-muted uppercase tracking-wide">
              Total Entries
            </p>
            <p className="text-[20px] md:text-[24px] font-bold mt-1">{stats.totalEntries}</p>
          </div>
          <div className="bg-white rounded-xl border border-border p-3 md:p-4">
            <p className="text-[10px] md:text-[11px] font-medium text-text-muted uppercase tracking-wide">
              High Confidence
            </p>
            <p className="text-[20px] md:text-[24px] font-bold mt-1 text-green-600">
              {stats.byConfidence.high}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-border p-3 md:p-4">
            <p className="text-[10px] md:text-[11px] font-medium text-text-muted uppercase tracking-wide">
              Added This Week
            </p>
            <p className="text-[20px] md:text-[24px] font-bold mt-1 text-brand-blue">
              {stats.recentlyAdded}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-border p-3 md:p-4">
            <p className="text-[10px] md:text-[11px] font-medium text-text-muted uppercase tracking-wide">
              Categories Used
            </p>
            <p className="text-[20px] md:text-[24px] font-bold mt-1">
              {Object.values(stats.byCategory).filter((c) => c > 0).length}/{ALL_CATEGORIES.length}
            </p>
          </div>
        </div>
      )}

      {/* Category breakdown */}
      {stats && stats.totalEntries > 0 && (
        <div className="bg-white rounded-xl border border-border p-4 mb-6">
          <p className="text-[12px] font-semibold text-text-secondary mb-3">
            Entries by Category
          </p>
          <div className="flex flex-wrap gap-2">
            {ALL_CATEGORIES.map((cat) => {
              const config = CATEGORY_CONFIG[cat];
              const count = stats.byCategory[cat];
              if (count === 0) return null;
              const Icon = config.icon;
              return (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(filterCategory === cat ? "all" : cat)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-colors ${
                    filterCategory === cat
                      ? "border-brand-blue bg-brand-blue/5 text-brand-blue"
                      : "border-border hover:border-gray-300"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" style={{ color: config.color }} />
                  {config.label}
                  <span className="ml-1 px-1.5 py-0.5 rounded bg-gray-100 text-[10px]">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Form */}
      {showAddForm && (
        <div className="bg-white rounded-xl border border-border p-4 md:p-5 mb-6">
          <h3 className="text-[14px] font-semibold mb-3">Add Knowledge Entry</h3>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-text-muted block mb-1">
                  Category
                </label>
                <select
                  value={addForm.category}
                  onChange={(e) => setAddForm({ ...addForm, category: e.target.value as KnowledgeCategory })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-[13px]"
                >
                  {ALL_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {CATEGORY_CONFIG[cat].label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-medium text-text-muted block mb-1">
                  Confidence
                </label>
                <select
                  value={addForm.confidence}
                  onChange={(e) => setAddForm({ ...addForm, confidence: e.target.value as "high" | "medium" | "low" })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-[13px]"
                >
                  <option value="high">High — Proven/Validated</option>
                  <option value="medium">Medium — Likely/Pattern-based</option>
                  <option value="low">Low — Hypothesis/Early signal</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-[11px] font-medium text-text-muted block mb-1">
                Title
              </label>
              <input
                value={addForm.title}
                onChange={(e) => setAddForm({ ...addForm, title: e.target.value })}
                placeholder="E.g., Healthcare clients need longer review cycles"
                className="w-full px-3 py-2 border border-border rounded-lg text-[13px]"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-text-muted block mb-1">
                Content
              </label>
              <textarea
                value={addForm.content}
                onChange={(e) => setAddForm({ ...addForm, content: e.target.value })}
                placeholder="Detailed learning, insight, or data point..."
                rows={3}
                className="w-full px-3 py-2 border border-border rounded-lg text-[13px] resize-none"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-text-muted block mb-1">
                Tags (comma-separated)
              </label>
              <input
                value={addForm.tags}
                onChange={(e) => setAddForm({ ...addForm, tags: e.target.value })}
                placeholder="healthcare, compliance, timeline"
                className="w-full px-3 py-2 border border-border rounded-lg text-[13px]"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 rounded-lg border border-border text-[13px] hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={!addForm.title.trim() || !addForm.content.trim()}
                className="px-4 py-2 rounded-lg bg-brand-blue text-white text-[13px] font-medium hover:bg-brand-blue-dark disabled:opacity-40"
              >
                Save Entry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search knowledge base..."
            className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-text-muted shrink-0" />
          <select
            value={filterConfidence}
            onChange={(e) => setFilterConfidence(e.target.value)}
            className="flex-1 sm:flex-none px-3 py-2.5 border border-border rounded-lg text-[13px] bg-white"
          >
            <option value="all">All Confidence</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* Entries List */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-border">
            <Brain className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-[14px] font-medium text-text-secondary">
              {entries.length === 0
                ? "Knowledge base is empty"
                : "No entries match your filters"}
            </p>
            <p className="text-[12px] text-text-muted mt-1">
              {entries.length === 0
                ? "Start chatting with the orchestrator — learnings will be automatically extracted and stored here."
                : "Try adjusting your search or filters."}
            </p>
          </div>
        )}

        {filtered.map((entry) => {
          const config = CATEGORY_CONFIG[entry.category];
          const Icon = config.icon;
          const isExpanded = expandedEntries.has(entry.id);
          const isEditing = editingId === entry.id;

          return (
            <div
              key={entry.id}
              className="bg-white rounded-xl border border-border overflow-hidden"
            >
              {/* Entry header */}
              <div className="flex items-start gap-2 md:gap-3 px-3 md:px-4 py-3">
                <button
                  onClick={() => toggleExpand(entry.id)}
                  className="mt-0.5 shrink-0"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-text-muted" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-text-muted" />
                  )}
                </button>

                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${config.color}15` }}
                >
                  <Icon className="w-3.5 h-3.5" style={{ color: config.color }} />
                </div>

                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <input
                      value={editForm.title}
                      onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                      className="w-full px-2 py-1 border border-border rounded text-[13px] font-medium"
                    />
                  ) : (
                    <p className="text-[13px] font-medium">{entry.title}</p>
                  )}

                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor: `${config.color}12`,
                        color: config.color,
                      }}
                    >
                      {config.label}
                    </span>
                    <span
                      className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${confidenceBadge(entry.confidence)}`}
                    >
                      {entry.confidence}
                    </span>
                    {entry.metadata?.client && (
                      <span className="text-[10px] text-text-muted">
                        Client: {entry.metadata.client}
                      </span>
                    )}
                    <span className="text-[10px] text-text-muted flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {timeAgo(entry.updatedAt)}
                    </span>
                    {entry.usageCount > 0 && (
                      <span className="text-[10px] text-text-muted flex items-center gap-1">
                        <Star className="w-3 h-3" />
                        Used {entry.usageCount}x
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {isEditing ? (
                    <>
                      <button
                        onClick={saveEdit}
                        className="p-1.5 rounded-lg hover:bg-green-50 transition-colors"
                      >
                        <Check className="w-4 h-4 text-green-600" />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <X className="w-4 h-4 text-text-muted" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => startEdit(entry)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-text-muted" />
                      </button>
                      <button
                        onClick={() => handleDelete(entry.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Expanded content */}
              {isExpanded && (
                <div className="px-3 md:px-4 pb-3 border-t border-border bg-gray-50">
                  <div className="pt-3">
                    {isEditing ? (
                      <div className="space-y-2">
                        <textarea
                          value={editForm.content}
                          onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                          rows={3}
                          className="w-full px-3 py-2 border border-border rounded-lg text-[12px] resize-none"
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <select
                            value={editForm.category}
                            onChange={(e) => setEditForm({ ...editForm, category: e.target.value as KnowledgeCategory })}
                            className="px-2 py-1.5 border border-border rounded text-[12px]"
                          >
                            {ALL_CATEGORIES.map((cat) => (
                              <option key={cat} value={cat}>
                                {CATEGORY_CONFIG[cat].label}
                              </option>
                            ))}
                          </select>
                          <select
                            value={editForm.confidence}
                            onChange={(e) => setEditForm({ ...editForm, confidence: e.target.value as "high" | "medium" | "low" })}
                            className="px-2 py-1.5 border border-border rounded text-[12px]"
                          >
                            <option value="high">High</option>
                            <option value="medium">Medium</option>
                            <option value="low">Low</option>
                          </select>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[12px] text-text-secondary leading-relaxed">
                        {entry.content}
                      </p>
                    )}

                    {entry.tags.length > 0 && !isEditing && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {entry.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 rounded-full bg-gray-100 text-[10px] text-text-muted"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {entry.source.conversationTitle && !isEditing && (
                      <p className="text-[10px] text-text-muted mt-2">
                        Source: {entry.source.conversationTitle}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
