"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send,
  Paperclip,
  X,
  FileText,
  Image as ImageIcon,
  File,
  Bot,
  User,
  Loader2,
  Zap,
  Sparkles,
  RotateCcw,
  AlertCircle,
  Plus,
  MessageSquare,
  Trash2,
  Clock,
} from "lucide-react";
import { AgentActivityPanel } from "@/components/AgentActivityPanel";
import { ChatChart, parseChartBlocks } from "@/components/ChatChart";
import {
  type ChatMessage,
  type AgentActivity,
  type Conversation,
  getAllConversations,
  getConversation,
  saveConversation,
  deleteConversation,
  createConversation,
  getActiveConversationId,
  setActiveConversation,
  clearActiveConversation,
  generateTitle,
  parseAgentActivity,
} from "@/lib/chatStorage";
import {
  buildKnowledgeContext,
  parseLearnings,
  saveLearnings,
} from "@/lib/knowledgeBase";

/* ---------- types ---------- */
interface FileAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  preview?: string;
  textContent?: string;
}

/* ---------- constants ---------- */
const quickPrompts = [
  "Launch a full campaign for a new SaaS client",
  "Analyze competitor ad strategies in the healthcare space",
  "Generate 5 authority content topics for a fintech brand",
  "Run a performance optimization cycle on all active campaigns",
  "Create ad creatives for a product launch",
  "Build a conversion-optimized landing page brief",
];

/* ---------- helpers ---------- */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function getFileIcon(type: string) {
  if (type.startsWith("image/")) return <ImageIcon className="w-4 h-4" />;
  if (type.includes("pdf") || type.includes("document"))
    return <FileText className="w-4 h-4" />;
  return <File className="w-4 h-4" />;
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

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

function getApiKeys() {
  try {
    const stored = localStorage.getItem("mpaios_api_keys");
    const keys = stored ? JSON.parse(stored) : {};
    const assignments = localStorage.getItem("mpaios_model_assignments");
    const models = assignments ? JSON.parse(assignments) : {};
    const orchestratorModel = models.orchestrator || "claude-sonnet-4-20250514";

    let provider = "anthropic";
    if (
      orchestratorModel.startsWith("gpt") ||
      orchestratorModel.startsWith("o1") ||
      orchestratorModel.startsWith("o3")
    ) {
      provider = "openai";
    }

    let asanaPat = "";
    let asanaWorkspace = "";
    let gaAccessToken = "";
    let gaPropertyId = "";
    let gscAccessToken = "";
    let gscSiteUrl = "";
    try {
      const integrations = localStorage.getItem("mpaios_integrations");
      if (integrations) {
        const parsed = JSON.parse(integrations);
        if (parsed.asana?.connected && parsed.asana?.pat && parsed.asana?.workspace?.gid) {
          asanaPat = parsed.asana.pat;
          asanaWorkspace = parsed.asana.workspace.gid;
        }
        if (parsed.googleAnalytics?.connected && parsed.googleAnalytics?.accessToken && parsed.googleAnalytics?.propertyId) {
          gaAccessToken = parsed.googleAnalytics.accessToken;
          gaPropertyId = parsed.googleAnalytics.propertyId;
        }
        if (parsed.googleSearchConsole?.connected && parsed.googleSearchConsole?.accessToken && parsed.googleSearchConsole?.siteUrl) {
          gscAccessToken = parsed.googleSearchConsole.accessToken;
          gscSiteUrl = parsed.googleSearchConsole.siteUrl;
        }
      }
    } catch {
      // ignore
    }

    return {
      anthropicKey: keys.anthropic || "",
      openaiKey: keys.openai || "",
      provider,
      model: orchestratorModel,
      asanaPat,
      asanaWorkspace,
      gaAccessToken,
      gaPropertyId,
      gscAccessToken,
      gscSiteUrl,
    };
  } catch {
    return {
      anthropicKey: "",
      openaiKey: "",
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      asanaPat: "",
      asanaWorkspace: "",
      gaAccessToken: "",
      gaPropertyId: "",
      gscAccessToken: "",
      gscSiteUrl: "",
    };
  }
}

/* ---------- component ---------- */
export default function ChatPage() {
  // Conversation state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [showConvList, setShowConvList] = useState(false);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);

  // Agent activity state
  const [currentActivities, setCurrentActivities] = useState<AgentActivity[]>([]);
  const [activityPanelCollapsed, setActivityPanelCollapsed] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  /* --- Load conversations on mount --- */
  useEffect(() => {
    const allConvs = getAllConversations();
    setConversations(allConvs);

    const activeId = getActiveConversationId();
    if (activeId) {
      const conv = getConversation(activeId);
      if (conv) {
        setActiveConv(conv);
        setMessages(conv.messages);
        const allActivities = conv.messages
          .filter((m) => m.agentActivity && m.agentActivity.length > 0)
          .flatMap((m) => m.agentActivity!);
        setCurrentActivities(allActivities);
        return;
      }
    }
  }, []);

  /* --- Scroll to bottom --- */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  /* --- Persist conversation --- */
  const persistConversation = useCallback(
    (msgs: ChatMessage[], activities?: AgentActivity[]) => {
      if (!activeConv) return;
      const updated: Conversation = {
        ...activeConv,
        messages: msgs,
        updatedAt: Date.now(),
      };
      if (updated.title === "New Conversation" && msgs.length > 0) {
        const firstUser = msgs.find((m) => m.role === "user");
        if (firstUser) {
          updated.title = generateTitle(firstUser.content);
        }
      }
      saveConversation(updated);
      setActiveConv(updated);
      setConversations(getAllConversations());
    },
    [activeConv]
  );

  /* --- Start new conversation --- */
  function startNewConversation() {
    if (abortRef.current) abortRef.current.abort();
    const conv = createConversation();
    saveConversation(conv);
    setActiveConversation(conv.id);
    setActiveConv(conv);
    setMessages([]);
    setCurrentActivities([]);
    setInput("");
    setApiError(null);
    setIsStreaming(false);
    setShowConvList(false);
    setConversations(getAllConversations());
  }

  /* --- Load existing conversation --- */
  function loadConversation(conv: Conversation) {
    if (abortRef.current) abortRef.current.abort();
    setActiveConversation(conv.id);
    setActiveConv(conv);
    setMessages(conv.messages);
    setInput("");
    setApiError(null);
    setIsStreaming(false);
    setShowConvList(false);
    const allActivities = conv.messages
      .filter((m) => m.agentActivity && m.agentActivity.length > 0)
      .flatMap((m) => m.agentActivity!);
    setCurrentActivities(allActivities);
  }

  /* --- Delete conversation --- */
  function handleDeleteConversation(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    deleteConversation(id);
    const updated = getAllConversations();
    setConversations(updated);
    if (activeConv?.id === id) {
      if (updated.length > 0) {
        loadConversation(updated[0]);
      } else {
        setActiveConv(null);
        setMessages([]);
        setCurrentActivities([]);
        clearActiveConversation();
      }
    }
  }

  /* --- File handling --- */
  function readFileAsText(file: globalThis.File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;

    const newAttachments: FileAttachment[] = [];
    for (const file of Array.from(files)) {
      const att: FileAttachment = {
        id: uid(),
        name: file.name,
        size: file.size,
        type: file.type,
      };

      const textTypes = ["text/", "application/json", "application/xml", ".csv", ".md", ".txt"];
      const isTextFile =
        textTypes.some((t) => file.type.includes(t)) ||
        textTypes.some((t) => file.name.endsWith(t)) ||
        file.name.endsWith(".docx") ||
        file.name.endsWith(".doc");

      if (isTextFile || file.size < 500000) {
        try {
          att.textContent = await readFileAsText(file);
        } catch {
          att.textContent = `[Could not read file: ${file.name}]`;
        }
      }

      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          setAttachments((prev) =>
            prev.map((a) =>
              a.id === att.id ? { ...a, preview: ev.target?.result as string } : a
            )
          );
        };
        reader.readAsDataURL(file);
      }

      newAttachments.push(att);
    }

    setAttachments((prev) => [...prev, ...newAttachments]);
    e.target.value = "";
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  /* --- Build message with attachments --- */
  function buildMessageContent(text: string): string {
    if (attachments.length === 0) return text;
    const fileContext = attachments
      .map((att) => {
        if (att.textContent) {
          return `\n\n---\n📎 FILE: ${att.name} (${formatFileSize(att.size)})\n\`\`\`\n${att.textContent}\n\`\`\`\n---`;
        }
        return `\n\n[Attached file: ${att.name} (${formatFileSize(att.size)}) — binary file, content not readable as text]`;
      })
      .join("\n");
    return text + fileContext;
  }

  /* --- Send message with streaming --- */
  async function sendMessage(userText: string) {
    if (isStreaming) return;

    let conv = activeConv;
    if (!conv) {
      conv = createConversation();
      saveConversation(conv);
      setActiveConversation(conv.id);
      setActiveConv(conv);
      setConversations(getAllConversations());
    }

    const fullContent = buildMessageContent(userText);
    const userMsg: ChatMessage = {
      id: uid(),
      role: "user",
      content: fullContent,
      timestamp: Date.now(),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setAttachments([]);
    setApiError(null);
    setIsStreaming(true);
    setCurrentActivities([]);

    const assistantId = uid();
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "", timestamp: Date.now() },
    ]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const apiKeys = getApiKeys();
      const latestUserMsg = updatedMessages.filter((m) => m.role === "user").pop();
      const knowledgeContext = buildKnowledgeContext(latestUserMsg?.content);

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({ role: m.role, content: m.content })),
          ...apiKeys,
          knowledgeContext,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        let errorMsg = `Request failed (${response.status})`;
        try {
          const errorData = await response.json();
          errorMsg = errorData.error || errorMsg;
        } catch {
          try {
            errorMsg = (await response.text()) || errorMsg;
          } catch {}
        }
        throw new Error(errorMsg);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream available");

      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;

        const parsed = parseAgentActivity(accumulated);
        if (parsed.activities.length > 0) {
          setCurrentActivities(parsed.activities);
        }

        const current = accumulated;
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: current } : m))
        );
      }

      const finalParsed = parseAgentActivity(accumulated);

      const { learnings, cleanContent: contentAfterLearnings } = parseLearnings(accumulated);
      if (learnings.length > 0) {
        saveLearnings(learnings, conv!.id, conv!.title);
        // Visual feedback: append a system note about extracted learnings
        const learningNote = `\n\n---\n🧠 **Agent 18 — Knowledge Base Updated** | ${learnings.length} learning${learnings.length > 1 ? "s" : ""} extracted and saved`;
        accumulated += learningNote;
      }

      const finalMessages = updatedMessages.concat([
        {
          id: assistantId,
          role: "assistant" as const,
          content: accumulated,
          agentActivity: finalParsed.activities,
          timestamp: Date.now(),
        },
      ]);
      setMessages(finalMessages);

      const updatedConv: Conversation = {
        ...conv!,
        messages: finalMessages,
        updatedAt: Date.now(),
      };
      if (updatedConv.title === "New Conversation") {
        const firstUser = finalMessages.find((m) => m.role === "user");
        if (firstUser) updatedConv.title = generateTitle(firstUser.content);
      }
      saveConversation(updatedConv);
      setActiveConv(updatedConv);
      setConversations(getAllConversations());

      if (!accumulated.trim()) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content:
                    "[No response received from the model. Check your API key in Settings.]",
                }
              : m
          )
        );
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        // User cancelled
      } else {
        const errorMessage = err instanceof Error ? err.message : "Something went wrong";
        setApiError(errorMessage);
        setMessages((prev) =>
          prev.filter((m) => m.id !== assistantId || m.content.length > 0)
        );
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }

  /* --- Form handling --- */
  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed && attachments.length === 0) return;
    sendMessage(trimmed || "(see attached files)");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const trimmed = input.trim();
      if (!trimmed && attachments.length === 0) return;
      sendMessage(trimmed || "(see attached files)");
    }
  }

  function handleQuickPrompt(prompt: string) {
    sendMessage(prompt);
  }

  function handleStop() {
    if (abortRef.current) abortRef.current.abort();
  }

  /* --- Markdown rendering --- */
  function renderContent(content: string) {
    const parsed = parseAgentActivity(content);
    const { cleanContent: withoutLearnings } = parseLearnings(parsed.cleanContent);
    const cleaned = withoutLearnings
      .replace(/\n\n---\n📎 FILE:[\s\S]*?```\n---/g, "")
      .replace(/\n\n\[Attached file:.*?\]/g, "")
      .trim();

    // Parse chart blocks first
    const segments = parseChartBlocks(cleaned);

    return segments.map((segment, segIdx) => {
      if (segment.type === "chart") {
        return <ChatChart key={`chart-${segIdx}`} chart={segment.chart} />;
      }
      return (
        <div key={`text-${segIdx}`}>{renderMarkdown(segment.content)}</div>
      );
    });
  }

  function renderMarkdown(text: string) {
    const elements: React.ReactNode[] = [];
    const lines = text.split("\n");
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // Code blocks
      if (line.trimStart().startsWith("```")) {
        const lang = line.trim().slice(3);
        const codeLines: string[] = [];
        i++;
        while (i < lines.length && !lines[i].trimStart().startsWith("```")) {
          codeLines.push(lines[i]);
          i++;
        }
        i++; // skip closing ```
        elements.push(
          <div key={elements.length} className="my-2 rounded-lg overflow-hidden border border-gray-200 bg-gray-900">
            {lang && (
              <div className="px-3 py-1 bg-gray-800 text-[10px] text-gray-400 uppercase tracking-wide">
                {lang}
              </div>
            )}
            <pre className="px-3 py-2.5 text-[11px] md:text-[12px] text-gray-100 overflow-x-auto leading-relaxed">
              <code>{codeLines.join("\n")}</code>
            </pre>
          </div>
        );
        continue;
      }

      // Headers
      if (line.startsWith("### ")) {
        elements.push(
          <h3 key={elements.length} className="font-semibold text-[14px] mt-3 mb-1">
            {renderInline(line.slice(4))}
          </h3>
        );
        i++;
        continue;
      }
      if (line.startsWith("## ")) {
        elements.push(
          <h2 key={elements.length} className="font-semibold text-[15px] mt-3 mb-1">
            {renderInline(line.slice(3))}
          </h2>
        );
        i++;
        continue;
      }
      if (line.startsWith("# ")) {
        elements.push(
          <h2 key={elements.length} className="font-bold text-[16px] mt-3 mb-1">
            {renderInline(line.slice(2))}
          </h2>
        );
        i++;
        continue;
      }

      // Bullet lists
      if (line.startsWith("- ") || line.startsWith("* ")) {
        elements.push(
          <div key={elements.length} className="flex gap-2 ml-1">
            <span className="shrink-0 mt-0.5">•</span>
            <span>{renderInline(line.slice(2))}</span>
          </div>
        );
        i++;
        continue;
      }

      // Numbered lists
      const numMatch = line.match(/^(\d+)\.\s+(.*)/);
      if (numMatch) {
        elements.push(
          <div key={elements.length} className="flex gap-2 ml-1">
            <span className="shrink-0 font-medium">{numMatch[1]}.</span>
            <span>{renderInline(numMatch[2])}</span>
          </div>
        );
        i++;
        continue;
      }

      // Empty line
      if (line.trim() === "") {
        elements.push(<div key={elements.length} className="h-2" />);
        i++;
        continue;
      }

      // Regular paragraph
      elements.push(<p key={elements.length}>{renderInline(line)}</p>);
      i++;
    }

    return elements;
  }

  function renderInline(text: string) {
    // Handle bold, inline code, and regular text
    return text.split(/(\*\*.*?\*\*|`[^`]+`)/).map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={i} className="font-semibold">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return (
          <code
            key={i}
            className="px-1.5 py-0.5 rounded bg-gray-100 text-[11px] font-mono text-pink-600"
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      return <span key={i}>{part}</span>;
    });
  }

  /* --- API key check --- */
  const hasKeys = (() => {
    try {
      const stored = localStorage.getItem("mpaios_api_keys");
      if (!stored) return false;
      const keys = JSON.parse(stored);
      return !!(keys.anthropic || keys.openai);
    } catch {
      return false;
    }
  })();

  const showQuickPrompts = messages.length === 0;

  /* ---------- render ---------- */
  return (
    <div className="flex h-[calc(100vh-64px)] md:h-[calc(100vh-64px)] -m-4 md:-m-8 -mt-16 md:-mt-8">
      {/* Conversation List Panel - desktop slide, mobile overlay */}
      {showConvList && (
        <div
          className="fixed inset-0 z-20 bg-black/30 md:hidden"
          onClick={() => setShowConvList(false)}
        />
      )}
      <div
        className={`
          ${showConvList ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
          ${showConvList ? "w-[280px] md:w-[260px]" : "w-0"}
          fixed md:static z-20 top-0 left-0 h-full md:h-auto
          transition-all duration-200 overflow-hidden border-r border-border bg-gray-50 flex flex-col shrink-0
          pt-14 md:pt-0
        `}
      >
        <div className="px-3 py-3 border-b border-border flex items-center justify-between min-w-[260px]">
          <span className="text-[12px] font-semibold text-text-secondary">Conversations</span>
          <button
            onClick={startNewConversation}
            className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors"
            title="New conversation"
          >
            <Plus className="w-4 h-4 text-text-muted" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5 min-w-[260px]">
          {conversations.length === 0 && (
            <p className="text-[11px] text-text-muted text-center py-4">No conversations yet</p>
          )}
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => loadConversation(conv)}
              className={`w-full text-left px-3 py-2 rounded-lg transition-colors group ${
                activeConv?.id === conv.id
                  ? "bg-brand-blue/10 border border-brand-blue/20"
                  : "hover:bg-gray-100"
              }`}
            >
              <div className="flex items-start justify-between gap-1">
                <p className="text-[12px] font-medium truncate flex-1">{conv.title}</p>
                <button
                  onClick={(e) => handleDeleteConversation(conv.id, e)}
                  className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 transition-all shrink-0"
                  title="Delete"
                >
                  <Trash2 className="w-3 h-3 text-red-400" />
                </button>
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <Clock className="w-3 h-3 text-text-muted" />
                <span className="text-[10px] text-text-muted">{timeAgo(conv.updatedAt)}</span>
                <span className="text-[10px] text-text-muted ml-auto">
                  {conv.messages.length} msg{conv.messages.length !== 1 ? "s" : ""}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="px-3 md:px-6 py-3 border-b border-border bg-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <button
              onClick={() => setShowConvList(!showConvList)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors shrink-0"
              title={showConvList ? "Hide conversations" : "Show conversations"}
            >
              <MessageSquare className="w-4 h-4 text-text-muted" />
            </button>
            <div className="w-8 h-8 rounded-lg bg-brand-blue/10 flex items-center justify-center shrink-0 hidden sm:flex">
              <Zap className="w-4 h-4 text-brand-blue" />
            </div>
            <div className="min-w-0">
              <h1 className="text-[13px] md:text-[14px] font-semibold truncate">MPAIOS Orchestrator</h1>
              <p className="text-[10px] md:text-[11px] text-text-muted truncate">
                {activeConv ? activeConv.title : "Routes tasks to 18 agents"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-brand-green/10">
              <div className="w-1.5 h-1.5 rounded-full bg-brand-green animate-pulse" />
              <span className="text-[10px] font-medium text-brand-green">Online</span>
            </div>
            <button
              onClick={startNewConversation}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              title="New conversation"
            >
              <RotateCcw className="w-4 h-4 text-text-muted" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 md:px-6 py-4 space-y-4 bg-surface">
          {/* Welcome */}
          {messages.length === 0 && (
            <div className="flex justify-center">
              <div className="flex items-center gap-2 px-3 md:px-4 py-2 rounded-full bg-brand-blue/10 text-[11px] md:text-[12px] font-medium text-brand-blue text-center">
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span>MPAIOS Orchestrator online. 18 agents standing by.</span>
              </div>
            </div>
          )}

          {/* API key warning */}
          {!hasKeys && messages.length === 0 && (
            <div className="flex justify-center mt-4">
              <div className="flex items-center gap-2 px-3 md:px-4 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] md:text-[12px] text-amber-700">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>
                  No API keys configured.{" "}
                  <a href="/settings" className="font-medium underline">
                    Add keys in Settings
                  </a>
                </span>
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id}>
              <div
                className={`flex gap-2 md:gap-3 ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {msg.role === "assistant" && (
                  <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-brand-blue/10 flex items-center justify-center shrink-0 mt-1">
                    <Bot className="w-3.5 h-3.5 md:w-4 md:h-4 text-brand-blue" />
                  </div>
                )}

                <div className={`max-w-[85%] md:max-w-[720px] ${msg.role === "user" ? "order-first" : ""}`}>
                  {/* Agent activity badges */}
                  {msg.role === "assistant" && msg.agentActivity && msg.agentActivity.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-1.5 ml-1">
                      {[...new Set(msg.agentActivity.map((a) => a.agentId))].map((agentId) => {
                        const activity = msg.agentActivity!.find((a) => a.agentId === agentId)!;
                        return (
                          <span
                            key={agentId}
                            className="inline-flex items-center gap-1 px-1.5 md:px-2 py-0.5 rounded-full bg-brand-blue/8 text-[9px] md:text-[10px] font-medium text-brand-blue border border-brand-blue/15"
                          >
                            <Bot className="w-2.5 h-2.5 md:w-3 md:h-3" />
                            Agent {String(agentId).padStart(2, "0")}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  <div
                    className={`rounded-2xl px-3 md:px-4 py-2.5 md:py-3 text-[12px] md:text-[13px] leading-relaxed ${
                      msg.role === "user"
                        ? "bg-brand-blue text-white rounded-br-md"
                        : "bg-white border border-border rounded-bl-md"
                    }`}
                  >
                    <div>
                      {msg.content ? renderContent(msg.content) : null}
                    </div>
                  </div>
                </div>

                {msg.role === "user" && (
                  <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-gray-800 flex items-center justify-center shrink-0 mt-1">
                    <User className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Error display */}
          {apiError && (
            <div className="flex justify-center">
              <div className="flex items-center gap-2 px-3 md:px-4 py-2.5 rounded-lg bg-red-50 border border-red-200 text-[11px] md:text-[12px] text-red-700 max-w-lg">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{apiError}</span>
              </div>
            </div>
          )}

          {/* Loading indicator */}
          {isStreaming &&
            messages.length > 0 &&
            messages[messages.length - 1]?.role === "assistant" &&
            messages[messages.length - 1]?.content === "" && (
              <div className="flex gap-2 md:gap-3">
                <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-brand-blue/10 flex items-center justify-center shrink-0">
                  <Bot className="w-3.5 h-3.5 md:w-4 md:h-4 text-brand-blue" />
                </div>
                <div className="bg-white border border-border rounded-2xl rounded-bl-md px-3 md:px-4 py-2.5 md:py-3 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-brand-blue animate-spin" />
                  <span className="text-[12px] md:text-[13px] text-text-muted">
                    Routing to agents...
                  </span>
                </div>
              </div>
            )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Prompts */}
        {showQuickPrompts && (
          <div className="px-3 md:px-6 pb-3 bg-surface">
            <p className="text-[11px] font-medium text-text-muted mb-2">Quick start</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handleQuickPrompt(prompt)}
                  className="text-left px-3 py-2.5 rounded-lg border border-border bg-white hover:border-brand-blue/40 hover:bg-brand-blue/5 transition-all text-[11px] md:text-[12px] text-text-secondary leading-snug"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Area */}
        <form onSubmit={onSubmit} className="px-3 md:px-6 py-3 border-t border-border bg-white shrink-0">
          {/* Attachment previews */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {attachments.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center gap-2 px-2 md:px-3 py-1.5 md:py-2 rounded-lg bg-gray-50 border border-border text-[11px] md:text-[12px] group"
                >
                  {att.preview ? (
                    <img
                      src={att.preview}
                      alt={att.name}
                      className="w-8 h-8 md:w-10 md:h-10 rounded object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 md:w-10 md:h-10 rounded bg-gray-100 flex items-center justify-center">
                      {getFileIcon(att.type)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-medium truncate max-w-[100px] md:max-w-[140px]">{att.name}</p>
                    <p className="text-text-muted">{formatFileSize(att.size)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAttachment(att.id)}
                    className="ml-1 p-1 rounded hover:bg-red-50 transition-colors"
                  >
                    <X className="w-3.5 h-3.5 text-red-400" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2 md:gap-3">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.md,.json"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 md:p-2.5 rounded-lg border border-border hover:bg-gray-50 hover:border-gray-300 transition-colors shrink-0 mb-0.5"
              title="Attach files"
            >
              <Paperclip className="w-4 h-4 md:w-5 md:h-5 text-text-muted" />
            </button>

            <div className="flex-1 relative">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message the orchestrator..."
                rows={1}
                className="w-full px-3 md:px-4 py-2.5 md:py-3 border border-border rounded-xl text-[13px] resize-none focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue leading-relaxed"
                style={{ maxHeight: 200 }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = "auto";
                  target.style.height = Math.min(target.scrollHeight, 200) + "px";
                }}
              />
            </div>

            {isStreaming ? (
              <button
                type="button"
                onClick={handleStop}
                className="p-2 md:p-2.5 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors shrink-0 mb-0.5"
                title="Stop generating"
              >
                <X className="w-4 h-4 md:w-5 md:h-5" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim() && attachments.length === 0}
                className="p-2 md:p-2.5 rounded-lg bg-brand-blue text-white hover:bg-brand-blue-dark transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0 mb-0.5"
              >
                <Send className="w-4 h-4 md:w-5 md:h-5" />
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Agent Activity Panel */}
      <AgentActivityPanel
        activities={currentActivities}
        isStreaming={isStreaming}
        collapsed={activityPanelCollapsed}
        onToggle={() => setActivityPanelCollapsed(!activityPanelCollapsed)}
      />
    </div>
  );
}
