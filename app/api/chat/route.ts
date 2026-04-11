import { streamText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { asanaFetch, AsanaProject, AsanaTask } from "@/lib/asana";
import { fetchGAOverview } from "@/lib/googleAnalytics";
import { fetchGSCOverview } from "@/lib/googleSearchConsole";
import { calculateCost } from "@/lib/observability";

export const maxDuration = 120;

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options as never)); } catch {}
        },
      },
    }
  );
}

// Search memory for relevant context (server-side)
async function buildMemoryRAGContext(query: string, userId: string): Promise<string> {
  const supabase = await getSupabase();

  // Text-based fallback search (vector search requires embedding generation)
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 3).slice(0, 5);
  if (!words.length) return "";

  const { data: memories } = await supabase
    .from("memory")
    .select("category, content, confidence")
    .eq("user_id", userId)
    .order("confidence", { ascending: false })
    .limit(10);

  if (!memories?.length) return "";

  // Score memories by keyword relevance
  const scored = memories
    .map(m => {
      const lower = m.content.toLowerCase();
      const hits = words.filter(w => lower.includes(w)).length;
      return { ...m, score: hits / words.length };
    })
    .filter(m => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  if (!scored.length) return "";

  let ctx = "\n\n## Knowledge Base (Agent 18 Memory)\n";
  for (const m of scored) {
    ctx += `- **[${m.category}]** (${(m.confidence * 100).toFixed(0)}% confidence): ${m.content.slice(0, 300)}\n`;
  }
  ctx += "\nUse these memories to provide more informed, contextual responses.\n";
  return ctx;
}

import { SYSTEM_PROMPT } from "@/lib/systemPrompt";

/* ---------- Asana task execution engine ---------- */

interface AsanaTaskDef {
  name: string;
  notes?: string;
  subtasks?: Array<{ name: string; notes?: string }>;
}

interface AsanaBoardDef {
  project_name: string;
  sections?: string[];
  tasks: AsanaTaskDef[];
}

async function executeAsanaBoard(
  pat: string,
  workspaceGid: string,
  teamGid: string | undefined,
  board: AsanaBoardDef
): Promise<string> {
  try {
    // 1. Create project
    const projectBody: Record<string, unknown> = {
      data: {
        name: board.project_name,
        workspace: workspaceGid,
        layout: "board",
        notes: `Created by MPAIOS Orchestrator — ${new Date().toLocaleString()}`,
      },
    };
    if (teamGid) {
      (projectBody.data as Record<string, unknown>).team = teamGid;
    }

    const projRes = await asanaFetch<{ gid: string; name: string }>(
      pat,
      `/projects`,
      { method: "POST", body: JSON.stringify(projectBody) }
    );
    const projectGid = projRes.data.gid;

    // 2. Create sections (columns)
    const sectionNames = board.sections?.length ? board.sections : ["To Do"];
    const sectionMap: Record<string, string> = {};
    for (const secName of sectionNames) {
      const secRes = await asanaFetch<{ gid: string }>(
        pat,
        `/projects/${projectGid}/sections`,
        { method: "POST", body: JSON.stringify({ data: { name: secName } }) }
      );
      sectionMap[secName] = secRes.data.gid;
    }
    const defaultSectionGid = sectionMap[sectionNames[0]];

    // 3. Create tasks and subtasks
    let taskCount = 0;
    let subtaskCount = 0;
    for (const taskDef of board.tasks) {
      const taskRes = await asanaFetch<{ gid: string }>(
        pat,
        `/tasks`,
        {
          method: "POST",
          body: JSON.stringify({
            data: {
              name: taskDef.name,
              notes: taskDef.notes || "",
              projects: [projectGid],
              memberships: [{ project: projectGid, section: defaultSectionGid }],
            },
          }),
        }
      );
      taskCount++;
      const taskGid = taskRes.data.gid;

      // Create subtasks
      if (taskDef.subtasks?.length) {
        for (const sub of taskDef.subtasks) {
          await asanaFetch(
            pat,
            `/tasks/${taskGid}/subtasks`,
            {
              method: "POST",
              body: JSON.stringify({
                data: { name: sub.name, notes: sub.notes || "" },
              }),
            }
          );
          subtaskCount++;
        }
      }
    }

    return `✅ **Asana project created successfully!**\n- **Project:** ${board.project_name}\n- **Columns:** ${sectionNames.join(", ")}\n- **Tasks:** ${taskCount} tasks with ${subtaskCount} subtasks\n- [Open in Asana](https://app.asana.com/0/${projectGid})`;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return `❌ **Asana error:** ${msg}`;
  }
}

function parseAndExecuteAsanaMarkers(
  text: string,
  pat: string,
  workspaceGid: string,
  teamGid: string | undefined
): { cleanText: string; executions: Promise<string>[] } {
  const pattern = /\[ASANA_CREATE\]\s*([\s\S]*?)\s*\[\/ASANA_CREATE\]/g;
  const executions: Promise<string>[] = [];
  let match;

  while ((match = pattern.exec(text)) !== null) {
    try {
      const board: AsanaBoardDef = JSON.parse(match[1]);
      executions.push(executeAsanaBoard(pat, workspaceGid, teamGid, board));
    } catch {
      executions.push(Promise.resolve("❌ **Asana error:** Could not parse task data"));
    }
  }

  // Replace markers with placeholder that will be filled with results
  const cleanText = text.replace(pattern, "{{ASANA_RESULT}}");
  return { cleanText, executions };
}

/* ---------- Asana context builder ---------- */
async function buildAsanaContext(
  pat: string,
  workspaceGid: string
): Promise<string> {
  try {
    // Fetch projects
    const projRes = await asanaFetch<AsanaProject[]>(
      pat,
      `/workspaces/${workspaceGid}/projects?opt_fields=name,archived&limit=50`
    );
    const projects = (projRes.data || []).filter((p) => !p.archived);

    if (projects.length === 0) return "";

    let ctx = "\n\n## Asana Context (Live Data)\n";
    ctx += `**Workspace projects (${projects.length}):**\n`;

    // Show all project names
    for (const p of projects) {
      ctx += `- ${p.name} (ID: ${p.gid})\n`;
    }

    // Fetch incomplete tasks for the first 5 projects
    const taskProjects = projects.slice(0, 5);
    for (const project of taskProjects) {
      try {
        const taskRes = await asanaFetch<AsanaTask[]>(
          pat,
          `/projects/${project.gid}/tasks?opt_fields=name,assignee.name,due_on,completed&completed_since=now&limit=20`
        );
        const tasks = taskRes.data || [];
        if (tasks.length > 0) {
          ctx += `\n**${project.name} — Open Tasks (${tasks.length}):**\n`;
          for (const t of tasks.slice(0, 10)) {
            const assignee = t.assignee?.name || "Unassigned";
            const due = t.due_on || "No due date";
            ctx += `  - ${t.name} | ${assignee} | Due: ${due}\n`;
          }
          if (tasks.length > 10) {
            ctx += `  - ... and ${tasks.length - 10} more tasks\n`;
          }
        }
      } catch {
        // Skip projects where tasks fail to load
      }
    }

    ctx += `\nYou can reference these projects and tasks when coordinating work. Agent 15 (Workflow Orchestrator) can create new tasks, update existing ones, and manage workflows through Asana.`;
    return ctx;
  } catch {
    return "\n\n## Asana Context\nAsana is connected but could not fetch data. The connection may need to be refreshed in Integrations settings.";
  }
}

export async function POST(req: Request) {
  const body = await req.json();
  const {
    messages,
    anthropicKey,
    openaiKey,
    googleKey,
    perplexityKey,
    provider = "anthropic",
    model = "claude-sonnet-4-20250514",
    asanaPat,
    asanaWorkspace,
    gaAccessToken,
    gaPropertyId,
    gscAccessToken,
    gscSiteUrl,
    knowledgeContext,
    customEndpoint,
    driveAccessToken,
    driveFolderId,
    selectedTool,
  } = body as {
    messages: Array<{ role: string; content: string }>;
    anthropicKey?: string;
    openaiKey?: string;
    googleKey?: string;
    perplexityKey?: string;
    provider?: string;
    model?: string;
    asanaPat?: string;
    asanaWorkspace?: string;
    gaAccessToken?: string;
    gaPropertyId?: string;
    gscAccessToken?: string;
    gscSiteUrl?: string;
    knowledgeContext?: string;
    customEndpoint?: { url: string; apiKey: string; model: string };
    driveAccessToken?: string;
    driveFolderId?: string;
    selectedTool?: string;
  };

  console.log(`[chat] provider=${provider} model=${model} customEndpoint=${customEndpoint ? JSON.stringify(customEndpoint) : "none"}`);

  // Convert to the format streamText expects
  const convertedMessages = messages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  // Determine which provider + key to use
  let modelInstance;

  if (provider === "custom" && customEndpoint) {
    // Custom OpenAI-compatible endpoint (LM Studio, Ollama, vLLM, etc.)
    // Ensure baseURL ends with /v1 — createOpenAI appends /chat/completions to it
    let baseURL = customEndpoint.url.replace(/\/+$/, "");
    if (!baseURL.endsWith("/v1")) {
      baseURL = `${baseURL}/v1`;
    }
    console.log(`[chat] Using custom baseURL: ${baseURL}`);
    const customOpenAI = createOpenAI({
      baseURL,
      apiKey: customEndpoint.apiKey || "lm-studio",
    });
    modelInstance = customOpenAI(customEndpoint.model || model || "local-model");
  } else if (provider === "anthropic" || provider === "Anthropic") {
    const key = anthropicKey;
    if (!key) {
      return new Response(
        JSON.stringify({
          error:
            "Anthropic API key not configured. Go to Settings → API Keys to add it.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    const anthropic = createAnthropic({
      apiKey: key,
      baseURL: "https://api.anthropic.com/v1",
    });
    modelInstance = anthropic(model || "claude-sonnet-4-20250514");
  } else if (provider === "google") {
    const key = googleKey;
    if (!key) {
      return new Response(
        JSON.stringify({
          error: "Google AI API key not configured. Go to Settings → API Keys to add it.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    const google = createGoogleGenerativeAI({ apiKey: key });
    modelInstance = google(model || "gemini-2.5-flash");
  } else if (provider === "perplexity") {
    const key = perplexityKey;
    if (!key) {
      return new Response(
        JSON.stringify({
          error: "Perplexity API key not configured. Go to Settings → API Keys to add it.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    // Perplexity uses OpenAI-compatible API
    const perplexity = createOpenAI({
      apiKey: key,
      baseURL: "https://api.perplexity.ai",
    });
    modelInstance = perplexity(model || "sonar-pro");
  } else {
    // Default to OpenAI for any unrecognized provider with gpt/o1/o3 models
    const key = openaiKey;
    if (!key) {
      return new Response(
        JSON.stringify({
          error: "OpenAI API key not configured. Go to Settings → API Keys to add it.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    const openai = createOpenAI({ apiKey: key });
    modelInstance = openai(model || "gpt-4o");
  }

  try {
    const startTime = Date.now();
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    // Build system prompt with optional Asana context
    let systemPrompt = SYSTEM_PROMPT;

    // Inject selected tool context
    if (selectedTool) {
      systemPrompt += `\n\n--- ACTIVE TOOL ---\nThe user has selected a specific tool to focus on: "${selectedTool}". Focus your response on this tool's capabilities and domain. Respond as the specialized agent for this tool rather than the full orchestrator. Keep responses focused and actionable for this specific tool's purpose.\n--- END TOOL CONTEXT ---\n`;
    }

    // Inject persistent memory (RAG from Supabase)
    if (user) {
      const lastUserMsg = messages.filter(m => m.role === "user").pop();
      if (lastUserMsg) {
        const memoryContext = await buildMemoryRAGContext(lastUserMsg.content, user.id);
        if (memoryContext) systemPrompt += memoryContext;
      }
    }

    // Inject knowledge base context (from client-side localStorage - legacy fallback)
    if (knowledgeContext) {
      systemPrompt += knowledgeContext;
    }

    if (asanaPat && asanaWorkspace) {
      const asanaContext = await buildAsanaContext(asanaPat, asanaWorkspace);
      systemPrompt += asanaContext;
      systemPrompt += `\n\n**ASANA IS CONNECTED AND LIVE.** When the user asks to create tasks, projects, or boards — use the [ASANA_CREATE] marker. It will execute real API calls immediately. Do NOT describe or simulate API calls in text.`;
    }

    if (gaAccessToken && gaPropertyId) {
      const gaContext = await fetchGAOverview(gaAccessToken, gaPropertyId);
      systemPrompt += gaContext;
    }

    if (gscAccessToken && gscSiteUrl) {
      const gscContext = await fetchGSCOverview(gscAccessToken, gscSiteUrl);
      systemPrompt += gscContext;
    }

    if (driveAccessToken && driveFolderId) {
      systemPrompt += `\n\n## Google Drive Context\nGoogle Drive is connected. Files and folders created by the orchestrator will be uploaded to the configured Drive folder (ID: ${driveFolderId}). Agent outputs can be saved as .md files in organized project folders within Drive.`;
    }

    // For custom/local endpoints, use streamText for better compatibility
    // LM Studio, Ollama, vLLM handle streaming more reliably than non-streaming
    if (provider === "custom" && customEndpoint) {
      const result = streamText({
        model: modelInstance,
        system: systemPrompt,
        messages: convertedMessages,
      });

      // Buffer text while streaming so we can parse Asana markers after completion
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            let fullText = "";
            for await (const chunk of result.textStream) {
              fullText += chunk;
              controller.enqueue(encoder.encode(chunk));
            }

            // After stream completes, execute any Asana markers
            if (asanaPat && asanaWorkspace && /\[ASANA_CREATE\]/.test(fullText)) {
              let teamGid: string | undefined;
              try {
                const teamsRes = await asanaFetch<Array<{ gid: string }>>(
                  asanaPat,
                  `/workspaces/${asanaWorkspace}/teams?limit=1`
                );
                teamGid = teamsRes.data?.[0]?.gid;
              } catch {}

              const { executions } = parseAndExecuteAsanaMarkers(
                fullText, asanaPat, asanaWorkspace, teamGid
              );
              if (executions.length > 0) {
                const results = await Promise.all(executions);
                // Append Asana execution results to the stream
                const summary = "\n\n---\n" + results.join("\n\n");
                controller.enqueue(encoder.encode(summary));
              }
            }

            controller.close();
          } catch (err) {
            controller.error(err);
          }
        },
      });

      return new Response(stream, {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    // Cloud providers: use streamText for real-time streaming to client
    const result = streamText({
      model: modelInstance,
      system: systemPrompt,
      messages: convertedMessages,
    });

    // Stream chunks to the client while buffering full text for post-processing
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          let fullText = "";
          for await (const chunk of result.textStream) {
            fullText += chunk;
            controller.enqueue(encoder.encode(chunk));
          }

          const latencyMs = Date.now() - startTime;

          // ── Post-stream: Execute Asana markers (REAL API calls) ──
          if (asanaPat && asanaWorkspace && /\[ASANA_CREATE\]/.test(fullText)) {
            let teamGid: string | undefined;
            try {
              const teamsRes = await asanaFetch<Array<{ gid: string }>>(
                asanaPat,
                `/workspaces/${asanaWorkspace}/teams?limit=1`
              );
              teamGid = teamsRes.data?.[0]?.gid;
            } catch {
              // Personal workspace — no team needed
            }

            const { executions } = parseAndExecuteAsanaMarkers(
              fullText, asanaPat, asanaWorkspace, teamGid
            );
            if (executions.length > 0) {
              const results = await Promise.all(executions);
              const summary = "\n\n---\n" + results.join("\n\n");
              controller.enqueue(encoder.encode(summary));
            }
          }

          // ── Post-stream: Observability (fire-and-forget) ──
          if (user) {
            // streamText usage resolves after the stream completes
            let usage: Record<string, number> | undefined;
            try { usage = await result.usage as Record<string, number> | undefined; } catch {};
            const tokensInput = usage?.promptTokens ?? usage?.inputTokens ?? Math.ceil(systemPrompt.length / 4);
            const tokensOutput = usage?.completionTokens ?? usage?.outputTokens ?? Math.ceil(fullText.length / 4);

            const cost = calculateCost(model || "unknown", tokensInput, tokensOutput);

            // Token usage tracking
            supabase.from("token_usage").insert({
              user_id: user.id,
              model: model || "unknown",
              provider: provider || "unknown",
              tokens_input: tokensInput,
              tokens_output: tokensOutput,
              cost,
              endpoint: "chat",
            }).then(() => {});

            // Audit log
            supabase.from("audit_log").insert({
              user_id: user.id,
              event_type: "chat.completion",
              resource_type: "message",
              details: { model, provider, messageCount: messages.length },
              tokens_used: tokensInput + tokensOutput,
              cost,
              model: model || "unknown",
              latency_ms: latencyMs,
            }).then(() => {});

            // Extract and log agent executions from response markers
            const agentPattern = /\[AGENT:(\d{1,2}):(activated|executing|thinking|responding|handoff|complete)\]\s*([^\[]*?)\s*\[\/AGENT\]/g;
            let agentMatch;
            const seenAgents = new Set<number>();
            while ((agentMatch = agentPattern.exec(fullText)) !== null) {
              const agentId = parseInt(agentMatch[1]);
              const action = agentMatch[2];
              const message = agentMatch[3].trim();
              if (!seenAgents.has(agentId)) {
                seenAgents.add(agentId);
                const agentNames: Record<number, string> = {
                  1:"Competitive Intel",2:"Head of Strategy",3:"Content Strategist",4:"Copywriter",5:"Creative Director",
                  6:"Landing Pages",7:"Meta Ads",8:"Google Ads",9:"Social Ads",10:"SEO Manager",11:"Social Organic",
                  12:"Brand Monitor",13:"Performance Analyst",14:"CRO Specialist",15:"Workflow Orchestrator",
                  16:"Client Reporting",17:"Budget Manager",18:"System Intelligence",19:"Client Onboarding",
                  20:"Video Producer",21:"LLMO Specialist",22:"Brand QA",23:"PR Manager",24:"Email Automation",
                  25:"Client Success",26:"Proposal Strategist",27:"Revenue Intel",28:"Data Engineer",
                  29:"Predictive Analytics",30:"Market Research",31:"Local SEO",32:"GBP Manager",33:"Community Growth",
                };
                supabase.from("agent_executions").insert({
                  agent_id: agentId,
                  agent_name: agentNames[agentId] || `Agent ${agentId}`,
                  division: agentId <= 2 || agentId === 19 ? "Strategy" : agentId <= 6 || agentId === 20 ? "Content" : agentId <= 9 ? "Paid Media" : agentId <= 12 || agentId === 21 || agentId === 23 ? "Organic" : agentId <= 14 || agentId === 22 ? "Analytics" : agentId <= 18 || agentId === 24 ? "Operations" : agentId <= 27 ? "Client Success" : agentId <= 30 ? "Data Engineering" : "Local",
                  action: message || action,
                  status: "completed",
                  tokens_used: Math.ceil((tokensInput + tokensOutput) / Math.max(seenAgents.size, 1)),
                  cost: cost / Math.max(seenAgents.size, 1),
                  latency_ms: latencyMs,
                  completed_at: new Date().toISOString(),
                }).then(() => {});
              }
            }

            // Extract and store learning markers from response
            const learningPattern = /\[LEARNING:(\w+):(\w+)\]\s*(.+?)\s*\[\/LEARNING\]/gs;
            let match;
            while ((match = learningPattern.exec(fullText)) !== null) {
              const category = match[1];
              const confidence = match[2] === "high" ? 0.9 : match[2] === "medium" ? 0.7 : 0.5;
              const parts = match[3].split("|").map(s => s.trim());
              const content = parts.length > 1 ? `${parts[0]}: ${parts[1]}` : parts[0];

              supabase.from("memory").insert({
                user_id: user.id,
                category,
                content,
                confidence,
                source_agent: 18,
                metadata: { tags: parts[2]?.split(",").map(t => t.trim()) || [] },
              }).then(({ error: memErr }) => {
                if (memErr) console.error("[chat] Failed to save learning to memory:", memErr.message, "category:", category);
              });
            }
          }

          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (error: unknown) {
    const msg =
      error instanceof Error ? error.message : "Unknown error from AI model";
    console.error("Chat API error:", error);

    // Log errors to audit
    try {
      const supabase = await getSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        supabase.from("audit_log").insert({
          user_id: user.id,
          event_type: "chat.error",
          details: { error: msg, model, provider },
        }).then(() => {});
      }
    } catch {}

    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
