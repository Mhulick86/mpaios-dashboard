"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Brain,
  Search,
  Trash2,
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
  Database,
} from "lucide-react";
import {
  getMemories,
  deleteMemory,
  storeMemory,
  getMemoryStats,
  searchMemory,
} from "@/lib/memory";
import type { Memory, MemoryCategory } from "@/lib/supabase/types";

const CATEGORY_CONFIG: Record<
  MemoryCategory,
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
  agent_learning: { label: "Agent Learnings", icon: Brain, color: "#0EA5E9" },
  user_preference: { label: "User Preferences", icon: Star, color: "#F97316" },
};

const ALL_CATEGORIES = Object.keys(CATEGORY_CONFIG) as MemoryCategory[];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function KnowledgePage() {
  const [entries, setEntries] = useState<Memory[]>([]);
  const [stats, setStats] = useState<{ total: number; byCategory: Record<string, number>; avgConfidence: number } | null>(null);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<MemoryCategory | "all">("all");
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [addForm, setAddForm] = useState({
    content: "",
    category: "client_insight" as MemoryCategory,
    confidence: 0.8,
  });

  const refresh = useCallback(async () => {
    const [mems, st] = await Promise.all([
      getMemories({ category: filterCategory === "all" ? undefined : filterCategory, limit: 100 }),
      getMemoryStats(),
    ]);
    setEntries(mems);
    setStats(st);
    setLoading(false);
  }, [filterCategory]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleSearch = async () => {
    if (!search.trim()) { refresh(); return; }
    setLoading(true);
    const results = await searchMemory({
      query: search,
      category: filterCategory === "all" ? undefined : filterCategory,
      limit: 50,
    });
    setEntries(results);
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    await deleteMemory(id);
    refresh();
  };

  const handleAdd = async () => {
    if (!addForm.content.trim()) return;
    await storeMemory({
      category: addForm.category,
      content: addForm.content.trim(),
      confidence: addForm.confidence,
    });
    setAddForm({ content: "", category: "client_insight", confidence: 0.8 });
    setShowAddForm(false);
    refresh();
  };

  const confidenceBadge = (c: number) => {
    if (c >= 0.8) return "bg-green-50 text-green-700 border-green-200";
    if (c >= 0.5) return "bg-amber-50 text-amber-700 border-amber-200";
    return "bg-gray-50 text-gray-500 border-gray-200";
  };

  const confidenceLabel = (c: number) => c >= 0.8 ? "high" : c >= 0.5 ? "medium" : "low";

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
            <p className="text-[11px] md:text-[12px] text-text-muted truncate flex items-center gap-1">
              <Database className="w-3 h-3" />
              Agent 18 — Supabase pgvector persistent memory
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
          <div className="bg-surface-raised rounded-xl border border-border p-3 md:p-4">
            <p className="text-[10px] md:text-[11px] font-medium text-text-muted uppercase tracking-wide">Total Memories</p>
            <p className="text-[20px] md:text-[24px] font-bold mt-1">{stats.total}</p>
          </div>
          <div className="bg-surface-raised rounded-xl border border-border p-3 md:p-4">
            <p className="text-[10px] md:text-[11px] font-medium text-text-muted uppercase tracking-wide">Avg Confidence</p>
            <p className="text-[20px] md:text-[24px] font-bold mt-1 text-brand-green">
              {(stats.avgConfidence * 100).toFixed(0)}%
            </p>
          </div>
          <div className="bg-surface-raised rounded-xl border border-border p-3 md:p-4">
            <p className="text-[10px] md:text-[11px] font-medium text-text-muted uppercase tracking-wide">Categories</p>
            <p className="text-[20px] md:text-[24px] font-bold mt-1 text-brand-blue">
              {Object.values(stats.byCategory).filter(c => c > 0).length}
            </p>
          </div>
          <div className="bg-surface-raised rounded-xl border border-border p-3 md:p-4">
            <p className="text-[10px] md:text-[11px] font-medium text-text-muted uppercase tracking-wide">Storage</p>
            <p className="text-[20px] md:text-[24px] font-bold mt-1">Supabase</p>
          </div>
        </div>
      )}

      {/* Category Filters */}
      {stats && stats.total > 0 && (
        <div className="bg-surface-raised rounded-xl border border-border p-4 mb-6">
          <p className="text-[12px] font-semibold text-text-secondary mb-3">Filter by Category</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilterCategory("all")}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-colors ${filterCategory === "all" ? "border-brand-blue bg-brand-blue/5 text-brand-blue" : "border-border hover:border-gray-300"}`}
            >
              All ({stats.total})
            </button>
            {ALL_CATEGORIES.map(cat => {
              const config = CATEGORY_CONFIG[cat];
              const count = stats.byCategory[cat] || 0;
              if (count === 0) return null;
              const Icon = config.icon;
              return (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(filterCategory === cat ? "all" : cat)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-colors ${filterCategory === cat ? "border-brand-blue bg-brand-blue/5 text-brand-blue" : "border-border hover:border-gray-300"}`}
                >
                  <Icon className="w-3.5 h-3.5" style={{ color: config.color }} />
                  {config.label}
                  <span className="ml-1 px-1.5 py-0.5 rounded bg-gray-100 text-[10px]">{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Form */}
      {showAddForm && (
        <div className="bg-surface-raised rounded-xl border border-border p-4 md:p-5 mb-6">
          <h3 className="text-[14px] font-semibold mb-3">Add Knowledge Entry</h3>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-text-muted block mb-1">Category</label>
                <select
                  value={addForm.category}
                  onChange={e => setAddForm({ ...addForm, category: e.target.value as MemoryCategory })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-[13px]"
                >
                  {ALL_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{CATEGORY_CONFIG[cat].label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-medium text-text-muted block mb-1">Confidence</label>
                <select
                  value={addForm.confidence}
                  onChange={e => setAddForm({ ...addForm, confidence: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-[13px]"
                >
                  <option value="0.9">High (90%)</option>
                  <option value="0.7">Medium (70%)</option>
                  <option value="0.5">Low (50%)</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-[11px] font-medium text-text-muted block mb-1">Content</label>
              <textarea
                value={addForm.content}
                onChange={e => setAddForm({ ...addForm, content: e.target.value })}
                placeholder="Detailed learning, insight, or data point..."
                rows={3}
                className="w-full px-3 py-2 border border-border rounded-lg text-[13px] resize-none"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowAddForm(false)} className="px-4 py-2 rounded-lg border border-border text-[13px] hover:bg-gray-50">Cancel</button>
              <button
                onClick={handleAdd}
                disabled={!addForm.content.trim()}
                className="px-4 py-2 rounded-lg bg-brand-blue text-white text-[13px] font-medium hover:bg-brand-blue-dark disabled:opacity-40"
              >
                Save Entry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="flex gap-2 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()}
            placeholder="Semantic search across memories..."
            className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
          />
        </div>
        <button onClick={handleSearch} className="px-4 py-2.5 bg-brand-blue text-white rounded-lg text-[13px] font-medium hover:bg-brand-blue-dark">
          Search
        </button>
      </div>

      {/* Entries */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-6 h-6 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          {entries.length === 0 && (
            <div className="text-center py-12 bg-surface-raised rounded-xl border border-border">
              <Brain className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-[14px] font-medium text-text-secondary">
                {search ? "No memories match your search" : "Memory is empty"}
              </p>
              <p className="text-[12px] text-text-muted mt-1">
                Start chatting with the orchestrator — learnings are automatically extracted and stored here via Supabase.
              </p>
            </div>
          )}

          {entries.map(entry => {
            const config = CATEGORY_CONFIG[entry.category] || CATEGORY_CONFIG.agent_learning;
            const Icon = config.icon;
            const isExpanded = expandedEntries.has(entry.id);

            return (
              <div key={entry.id} className="bg-surface-raised rounded-xl border border-border overflow-hidden">
                <div className="flex items-start gap-2 md:gap-3 px-3 md:px-4 py-3">
                  <button onClick={() => {
                    setExpandedEntries(prev => {
                      const next = new Set(prev);
                      if (next.has(entry.id)) next.delete(entry.id); else next.add(entry.id);
                      return next;
                    });
                  }} className="mt-0.5 shrink-0">
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-text-muted" /> : <ChevronRight className="w-4 h-4 text-text-muted" />}
                  </button>

                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${config.color}15` }}>
                    <Icon className="w-3.5 h-3.5" style={{ color: config.color }} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium line-clamp-1">{entry.content.split(".")[0] || entry.content.slice(0, 80)}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: `${config.color}12`, color: config.color }}>
                        {config.label}
                      </span>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${confidenceBadge(entry.confidence)}`}>
                        {confidenceLabel(entry.confidence)} ({(entry.confidence * 100).toFixed(0)}%)
                      </span>
                      {entry.source_agent && (
                        <span className="text-[10px] text-text-muted">Agent {String(entry.source_agent).padStart(2, "0")}</span>
                      )}
                      <span className="text-[10px] text-text-muted flex items-center gap-1">
                        <Clock className="w-3 h-3" />{timeAgo(entry.created_at)}
                      </span>
                      {entry.access_count > 0 && (
                        <span className="text-[10px] text-text-muted flex items-center gap-1">
                          <Star className="w-3 h-3" />Used {entry.access_count}x
                        </span>
                      )}
                    </div>
                  </div>

                  <button onClick={() => handleDelete(entry.id)} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors shrink-0">
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </button>
                </div>

                {isExpanded && (
                  <div className="px-3 md:px-4 pb-3 border-t border-border bg-gray-50/50 pt-3">
                    <p className="text-[12px] text-text-secondary leading-relaxed whitespace-pre-wrap">{entry.content}</p>
                    {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {((entry.metadata as Record<string, unknown>)?.tags as string[] || []).map((tag: string) => (
                          <span key={tag} className="px-2 py-0.5 rounded-full bg-gray-100 text-[10px] text-text-muted">{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
