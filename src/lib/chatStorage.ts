/* ---------- Chat Storage Utility ---------- */
/* Persists conversations to localStorage       */

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  agentActivity?: AgentActivity[];
  timestamp: number;
}

export interface AgentActivity {
  agentId: number;
  agentName: string;
  action: "activated" | "thinking" | "responding" | "handoff" | "complete";
  message?: string;
  targetAgent?: string;
  timestamp: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = "mpaios_conversations";
const ACTIVE_CONV_KEY = "mpaios_active_conversation";

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ---------- Read/Write helpers ---------- */

export function getAllConversations(): Conversation[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const convos: Conversation[] = JSON.parse(stored);
    return convos.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export function getConversation(id: string): Conversation | null {
  const all = getAllConversations();
  return all.find((c) => c.id === id) || null;
}

export function saveConversation(conv: Conversation): void {
  const all = getAllConversations();
  const idx = all.findIndex((c) => c.id === conv.id);
  if (idx >= 0) {
    all[idx] = conv;
  } else {
    all.push(conv);
  }
  // Keep only last 50 conversations
  const trimmed = all.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 50);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

export function deleteConversation(id: string): void {
  const all = getAllConversations();
  const filtered = all.filter((c) => c.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  // If this was the active conversation, clear it
  if (getActiveConversationId() === id) {
    clearActiveConversation();
  }
}

export function createConversation(title?: string): Conversation {
  const now = Date.now();
  return {
    id: uid(),
    title: title || "New Conversation",
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

/* ---------- Active conversation tracking ---------- */

export function getActiveConversationId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_CONV_KEY);
  } catch {
    return null;
  }
}

export function setActiveConversation(id: string): void {
  localStorage.setItem(ACTIVE_CONV_KEY, id);
}

export function clearActiveConversation(): void {
  localStorage.removeItem(ACTIVE_CONV_KEY);
}

/* ---------- Title generation ---------- */

export function generateTitle(firstMessage: string): string {
  // Take first 60 chars of the user's first message as title
  const cleaned = firstMessage
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .replace(/---\n📎 FILE:[\s\S]*$/g, "")
    .replace(/\[Attached file:.*?\]/g, "")
    .trim();
  if (cleaned.length <= 60) return cleaned;
  return cleaned.slice(0, 57) + "...";
}

/* ---------- Agent activity parsing ---------- */

// The orchestrator will embed structured markers in its response:
// [AGENT:XX:STATUS] message [/AGENT]
// We parse these out to show in the activity panel

export interface ParsedResponse {
  cleanContent: string;
  activities: AgentActivity[];
}

const AGENT_NAMES: Record<number, string> = {
  1: "Competitive Intelligence Analyst",
  2: "Head of Strategy & Campaign Planning",
  3: "Authority Content Strategist",
  4: "Authority Copywriter",
  5: "Ad Creative Director",
  6: "Landing Page Architect",
  7: "Meta Ads Performance Manager",
  8: "Google Ads Performance Manager",
  9: "Social Media Advertising Specialist",
  10: "SEO & Organic Growth Manager",
  11: "Social Media Organic Manager",
  12: "Brand Sentiment & Reputation Monitor",
  13: "Campaign Performance Analyst",
  14: "Conversion Rate Optimization Specialist",
  15: "Workflow Orchestrator & Task Manager",
  16: "Client Reporting & Insights Compiler",
  17: "Budget & Financial Operations Manager",
  18: "System Intelligence & Memory Agent",
};

export function parseAgentActivity(content: string): ParsedResponse {
  const activities: AgentActivity[] = [];
  let cleanContent = content;

  // Parse structured markers: [AGENT:05:activated] Analyzing creative brief [/AGENT]
  const agentRegex =
    /\[AGENT:(\d{1,2}):(activated|thinking|responding|handoff|complete)\]\s*([^\[]*?)\s*\[\/AGENT\]/g;

  let match;
  while ((match = agentRegex.exec(content)) !== null) {
    const agentId = parseInt(match[1]);
    const action = match[2] as AgentActivity["action"];
    const message = match[3].trim();

    activities.push({
      agentId,
      agentName: AGENT_NAMES[agentId] || `Agent ${agentId}`,
      action,
      message: message || undefined,
      timestamp: Date.now(),
    });

    // Remove the marker from display content
    cleanContent = cleanContent.replace(match[0], "");
  }

  // Parse handoff markers: [HANDOFF:05>06] Creative brief passed to Landing Page Architect [/HANDOFF]
  const handoffRegex =
    /\[HANDOFF:(\d{1,2})>(\d{1,2})\]\s*([^\[]*?)\s*\[\/HANDOFF\]/g;

  while ((match = handoffRegex.exec(content)) !== null) {
    const fromId = parseInt(match[1]);
    const toId = parseInt(match[2]);
    const message = match[3].trim();

    activities.push({
      agentId: fromId,
      agentName: AGENT_NAMES[fromId] || `Agent ${fromId}`,
      action: "handoff",
      message: message || undefined,
      targetAgent: AGENT_NAMES[toId] || `Agent ${toId}`,
      timestamp: Date.now(),
    });

    cleanContent = cleanContent.replace(match[0], "");
  }

  // Fallback: detect agent mentions in natural text if no structured markers found
  if (activities.length === 0) {
    const mentionRegex =
      /Agent\s+(\d{1,2})\s*[-–—]\s*([\w\s&]+?)(?:\s*(?:would|will|is|can|should|to)\b)/gi;

    while ((match = mentionRegex.exec(content)) !== null) {
      const agentId = parseInt(match[1]);
      if (agentId >= 1 && agentId <= 18) {
        // Avoid duplicate agents
        if (!activities.find((a) => a.agentId === agentId)) {
          activities.push({
            agentId,
            agentName: AGENT_NAMES[agentId] || `Agent ${agentId}`,
            action: "activated",
            timestamp: Date.now(),
          });
        }
      }
    }

    // Also try simpler pattern: "Agent XX" or "Agent XX ("
    const simpleRegex = /\bAgent\s+(\d{1,2})\b/gi;
    while ((match = simpleRegex.exec(content)) !== null) {
      const agentId = parseInt(match[1]);
      if (agentId >= 1 && agentId <= 18) {
        if (!activities.find((a) => a.agentId === agentId)) {
          activities.push({
            agentId,
            agentName: AGENT_NAMES[agentId] || `Agent ${agentId}`,
            action: "activated",
            timestamp: Date.now(),
          });
        }
      }
    }
  }

  // Clean up extra whitespace from removed markers
  cleanContent = cleanContent.replace(/\n{3,}/g, "\n\n").trim();

  return { cleanContent, activities };
}
