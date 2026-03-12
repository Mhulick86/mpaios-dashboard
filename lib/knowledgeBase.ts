/* ------------------------------------------------------------------ */
/* Knowledge Base — persistent memory shared across all agents         */
/* Stores learnings, client insights, patterns, and improvements       */
/* extracted from conversations so the system gets smarter over time.  */
/* ------------------------------------------------------------------ */

export type KnowledgeCategory =
  | "client_insight"       // Client preferences, brand voice, goals
  | "campaign_learning"    // What worked / didn't in campaigns
  | "strategy_pattern"     // Recurring strategic patterns
  | "creative_insight"     // Creative approaches, messaging that resonated
  | "performance_data"     // Benchmarks, KPIs, conversion data
  | "platform_update"      // Platform changes, new features, policy shifts
  | "process_improvement"  // Workflow / agent coordination learnings
  | "audience_insight";    // Audience behavior, demographics, preferences

export interface KnowledgeEntry {
  id: string;
  category: KnowledgeCategory;
  title: string;
  content: string;
  tags: string[];
  confidence: "high" | "medium" | "low";
  source: {
    conversationId?: string;
    conversationTitle?: string;
    extractedAt: number;
  };
  metadata?: {
    client?: string;
    vertical?: string;
    channel?: string;
    agentId?: number;
  };
  createdAt: number;
  updatedAt: number;
  usageCount: number; // how many times injected into context
}

const STORAGE_KEY = "mpaios_knowledge_base";

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ---------- CRUD operations ---------- */

export function getAllEntries(): KnowledgeEntry[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as KnowledgeEntry[];
  } catch {
    return [];
  }
}

function saveAll(entries: KnowledgeEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function addEntry(
  entry: Omit<KnowledgeEntry, "id" | "createdAt" | "updatedAt" | "usageCount">
): KnowledgeEntry {
  const all = getAllEntries();
  const now = Date.now();
  const newEntry: KnowledgeEntry = {
    ...entry,
    id: uid(),
    createdAt: now,
    updatedAt: now,
    usageCount: 0,
  };

  // Check for near-duplicate titles — update instead of create
  const existing = all.find(
    (e) =>
      e.category === entry.category &&
      e.title.toLowerCase() === entry.title.toLowerCase()
  );
  if (existing) {
    existing.content = entry.content;
    existing.tags = [...new Set([...existing.tags, ...entry.tags])];
    existing.confidence = entry.confidence;
    existing.updatedAt = now;
    if (entry.metadata) {
      existing.metadata = { ...existing.metadata, ...entry.metadata };
    }
    saveAll(all);
    return existing;
  }

  all.push(newEntry);
  // Keep max 500 entries — prune oldest low-confidence first
  if (all.length > 500) {
    all.sort((a, b) => {
      if (a.confidence !== b.confidence) {
        const rank = { high: 3, medium: 2, low: 1 };
        return rank[b.confidence] - rank[a.confidence];
      }
      return b.updatedAt - a.updatedAt;
    });
    all.length = 500;
  }

  saveAll(all);
  return newEntry;
}

export function updateEntry(
  id: string,
  updates: Partial<Pick<KnowledgeEntry, "title" | "content" | "category" | "tags" | "confidence" | "metadata">>
): KnowledgeEntry | null {
  const all = getAllEntries();
  const entry = all.find((e) => e.id === id);
  if (!entry) return null;

  Object.assign(entry, updates, { updatedAt: Date.now() });
  saveAll(all);
  return entry;
}

export function deleteEntry(id: string): boolean {
  const all = getAllEntries();
  const filtered = all.filter((e) => e.id !== id);
  if (filtered.length === all.length) return false;
  saveAll(filtered);
  return true;
}

export function incrementUsage(ids: string[]): void {
  const all = getAllEntries();
  for (const entry of all) {
    if (ids.includes(entry.id)) {
      entry.usageCount++;
    }
  }
  saveAll(all);
}

/* ---------- Query / Search ---------- */

export function searchEntries(query: string): KnowledgeEntry[] {
  const all = getAllEntries();
  const lower = query.toLowerCase();
  return all.filter(
    (e) =>
      e.title.toLowerCase().includes(lower) ||
      e.content.toLowerCase().includes(lower) ||
      e.tags.some((t) => t.toLowerCase().includes(lower)) ||
      (e.metadata?.client?.toLowerCase().includes(lower) ?? false) ||
      (e.metadata?.vertical?.toLowerCase().includes(lower) ?? false) ||
      (e.metadata?.channel?.toLowerCase().includes(lower) ?? false)
  );
}

export function getEntriesByCategory(category: KnowledgeCategory): KnowledgeEntry[] {
  return getAllEntries().filter((e) => e.category === category);
}

export function getEntriesByClient(client: string): KnowledgeEntry[] {
  const lower = client.toLowerCase();
  return getAllEntries().filter(
    (e) => e.metadata?.client?.toLowerCase().includes(lower)
  );
}

/* ---------- Context builder for system prompt ---------- */

/**
 * Builds a condensed knowledge base summary to inject into the system prompt.
 * Prioritizes: high confidence, recently updated, frequently used.
 * Returns max ~2000 tokens worth of context.
 */
export function buildKnowledgeContext(
  relevantQuery?: string,
  maxEntries = 30
): string {
  let entries = getAllEntries();
  if (entries.length === 0) return "";

  // If there's a query, boost relevance-matched entries
  if (relevantQuery) {
    const lower = relevantQuery.toLowerCase();
    const words = lower.split(/\s+/).filter((w) => w.length > 3);

    entries = entries
      .map((e) => {
        let score = 0;
        // Confidence weight
        score += e.confidence === "high" ? 30 : e.confidence === "medium" ? 20 : 10;
        // Recency weight (entries updated in last 7 days get a boost)
        const daysSinceUpdate = (Date.now() - e.updatedAt) / (1000 * 60 * 60 * 24);
        score += Math.max(0, 20 - daysSinceUpdate);
        // Usage weight
        score += Math.min(e.usageCount * 2, 20);
        // Relevance weight
        for (const word of words) {
          if (e.title.toLowerCase().includes(word)) score += 15;
          if (e.content.toLowerCase().includes(word)) score += 10;
          if (e.tags.some((t) => t.toLowerCase().includes(word))) score += 12;
          if (e.metadata?.client?.toLowerCase().includes(word)) score += 20;
          if (e.metadata?.vertical?.toLowerCase().includes(word)) score += 15;
          if (e.metadata?.channel?.toLowerCase().includes(word)) score += 12;
        }
        return { entry: e, score };
      })
      .sort((a, b) => b.score - a.score)
      .map((r) => r.entry);
  } else {
    // Default: sort by confidence then recency
    entries.sort((a, b) => {
      const rank = { high: 3, medium: 2, low: 1 };
      if (rank[a.confidence] !== rank[b.confidence]) {
        return rank[b.confidence] - rank[a.confidence];
      }
      return b.updatedAt - a.updatedAt;
    });
  }

  const selected = entries.slice(0, maxEntries);
  if (selected.length === 0) return "";

  // Track which entries we're using
  incrementUsage(selected.map((e) => e.id));

  // Build the context string
  const CATEGORY_LABELS: Record<KnowledgeCategory, string> = {
    client_insight: "Client Insight",
    campaign_learning: "Campaign Learning",
    strategy_pattern: "Strategy Pattern",
    creative_insight: "Creative Insight",
    performance_data: "Performance Data",
    platform_update: "Platform Update",
    process_improvement: "Process Improvement",
    audience_insight: "Audience Insight",
  };

  // Group by category
  const grouped = new Map<KnowledgeCategory, KnowledgeEntry[]>();
  for (const entry of selected) {
    const group = grouped.get(entry.category) || [];
    group.push(entry);
    grouped.set(entry.category, group);
  }

  let ctx = "\n\n## Knowledge Base (Agent 18 — Institutional Memory)\n";
  ctx += `*${entries.length} total entries | Showing ${selected.length} most relevant*\n\n`;

  for (const [category, items] of grouped) {
    ctx += `### ${CATEGORY_LABELS[category]}\n`;
    for (const item of items) {
      const meta: string[] = [];
      if (item.metadata?.client) meta.push(`Client: ${item.metadata.client}`);
      if (item.metadata?.vertical) meta.push(`Vertical: ${item.metadata.vertical}`);
      if (item.metadata?.channel) meta.push(`Channel: ${item.metadata.channel}`);
      const metaStr = meta.length > 0 ? ` (${meta.join(", ")})` : "";
      ctx += `- **${item.title}**${metaStr} [${item.confidence}]: ${item.content}\n`;
    }
    ctx += "\n";
  }

  ctx += `Use this knowledge to inform your responses. When you discover new insights, patterns, or learnings during this conversation, output them as learning markers so they are captured for future use.\n`;

  return ctx;
}

/* ---------- Learning extraction from LLM responses ---------- */

/**
 * Parse [LEARNING:category] content [/LEARNING] markers from assistant responses.
 * Returns extracted entries ready to be saved.
 */
export interface ExtractedLearning {
  category: KnowledgeCategory;
  title: string;
  content: string;
  tags: string[];
  confidence: "high" | "medium" | "low";
  metadata?: {
    client?: string;
    vertical?: string;
    channel?: string;
    agentId?: number;
  };
}

const VALID_CATEGORIES: KnowledgeCategory[] = [
  "client_insight",
  "campaign_learning",
  "strategy_pattern",
  "creative_insight",
  "performance_data",
  "platform_update",
  "process_improvement",
  "audience_insight",
];

export function parseLearnings(content: string): {
  learnings: ExtractedLearning[];
  cleanContent: string;
} {
  const learnings: ExtractedLearning[] = [];
  let cleanContent = content;

  // Match: [LEARNING:category:confidence] title | content | tags [/LEARNING]
  // Flexible: handles newlines, extra whitespace, backtick wrapping, and optional tags section
  const regex =
    /\[LEARNING:([\w_]+):(high|medium|low)\]\s*([^|]+?)\s*\|\s*([\s\S]*?)\s*(?:\|\s*([\s\S]*?))?\s*\[\/LEARNING\]/g;

  let match;
  while ((match = regex.exec(content)) !== null) {
    const rawCategory = match[1] as KnowledgeCategory;
    const confidence = match[2] as "high" | "medium" | "low";
    const title = match[3].trim();
    const body = match[4].trim();
    const tagsStr = match[5]?.trim() || "";

    // Validate category
    if (!VALID_CATEGORIES.includes(rawCategory)) continue;

    const tags = tagsStr
      ? tagsStr.split(",").map((t) => t.trim()).filter(Boolean)
      : [];

    learnings.push({
      category: rawCategory,
      title,
      content: body,
      tags,
      confidence,
    });

    cleanContent = cleanContent.replace(match[0], "");
  }

  // Clean up extra whitespace
  cleanContent = cleanContent.replace(/\n{3,}/g, "\n\n").trim();

  return { learnings, cleanContent };
}

/**
 * Save extracted learnings to the knowledge base.
 */
export function saveLearnings(
  learnings: ExtractedLearning[],
  conversationId?: string,
  conversationTitle?: string
): KnowledgeEntry[] {
  const saved: KnowledgeEntry[] = [];
  for (const learning of learnings) {
    const entry = addEntry({
      category: learning.category,
      title: learning.title,
      content: learning.content,
      tags: learning.tags,
      confidence: learning.confidence,
      source: {
        conversationId,
        conversationTitle,
        extractedAt: Date.now(),
      },
      metadata: learning.metadata,
    });
    saved.push(entry);
  }
  return saved;
}

/* ---------- Stats ---------- */

export interface KnowledgeStats {
  totalEntries: number;
  byCategory: Record<KnowledgeCategory, number>;
  byConfidence: Record<string, number>;
  recentlyAdded: number; // last 7 days
  mostUsed: KnowledgeEntry[];
}

export function getStats(): KnowledgeStats {
  const all = getAllEntries();
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  const byCategory = {} as Record<KnowledgeCategory, number>;
  for (const cat of VALID_CATEGORIES) {
    byCategory[cat] = all.filter((e) => e.category === cat).length;
  }

  const byConfidence = {
    high: all.filter((e) => e.confidence === "high").length,
    medium: all.filter((e) => e.confidence === "medium").length,
    low: all.filter((e) => e.confidence === "low").length,
  };

  return {
    totalEntries: all.length,
    byCategory,
    byConfidence,
    recentlyAdded: all.filter((e) => e.createdAt > sevenDaysAgo).length,
    mostUsed: [...all].sort((a, b) => b.usageCount - a.usageCount).slice(0, 5),
  };
}
