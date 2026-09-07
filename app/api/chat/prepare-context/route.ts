/**
 * Returns the fully-prepared MPAIOS system prompt with all dynamic context
 * (Asana projects, GA data, GSC data, memory, knowledge base).
 *
 * Used by the client when calling local endpoints (LM Studio, Ollama)
 * directly from the browser — those calls bypass /api/chat so need the
 * system prompt separately.
 */

import { requireAuth } from "@/lib/apiAuth";
import { buildAccessPolicyPrompt } from "@/lib/access";
import { asanaFetch, AsanaProject, AsanaTask } from "@/lib/asana";
import { fetchGAOverview } from "@/lib/googleAnalytics";
import { fetchGSCOverview } from "@/lib/googleSearchConsole";

export const maxDuration = 30;

type AuthContext = Awaited<ReturnType<typeof requireAuth>>;
type SupabaseClient = AuthContext["supabase"];

async function buildMemoryRAGContext(supabase: SupabaseClient, query: string, userId: string): Promise<string> {
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 3).slice(0, 5);
  if (!words.length) return "";

  const { data: memories } = await supabase
    .from("memory")
    .select("category, content, confidence")
    .eq("user_id", userId)
    .order("confidence", { ascending: false })
    .limit(10);

  if (!memories?.length) return "";

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

async function buildAsanaContext(pat: string, workspaceGid: string): Promise<string> {
  try {
    const projRes = await asanaFetch<AsanaProject[]>(
      pat,
      `/workspaces/${workspaceGid}/projects?opt_fields=name,archived&limit=50`
    );
    const projects = (projRes.data || []).filter((p) => !p.archived);
    if (projects.length === 0) return "";

    let ctx = "\n\n## Asana Context (Live Data)\n";
    ctx += `**Workspace projects (${projects.length}):**\n`;
    for (const p of projects) {
      ctx += `- ${p.name} (ID: ${p.gid})\n`;
    }

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
        }
      } catch {}
    }

    ctx += `\nYou can reference these projects and tasks when coordinating work. Agent 15 (Workflow Orchestrator) can create new tasks, update existing ones, and manage workflows through Asana.`;
    ctx += `\n\n**ASANA IS CONNECTED AND LIVE.** When the user asks to create tasks, projects, or boards — use the [ASANA_CREATE] marker. It will execute real API calls immediately. Do NOT describe or simulate API calls in text.`;
    return ctx;
  } catch {
    return "";
  }
}

export async function POST(req: Request) {
  // ── Auth: same rules as /api/chat — a signed-in staff account is required. ──
  let auth: AuthContext;
  try {
    auth = await requireAuth();
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
  const { supabase, user, role, isAdmin } = auth;

  let body: Record<string, string | undefined>;
  try {
    body = (await req.json()) as Record<string, string | undefined>;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { knowledgeContext, selectedTool, lastUserMessage } = body;

  // ── Integration credentials: admins only. Members' requests never carry
  //    Asana / GA / GSC / Drive tokens, whatever the browser sent. ──
  const asanaPat = isAdmin ? body.asanaPat : undefined;
  const asanaWorkspace = isAdmin ? body.asanaWorkspace : undefined;
  const gaAccessToken = isAdmin ? body.gaAccessToken : undefined;
  const gaPropertyId = isAdmin ? body.gaPropertyId : undefined;
  const gscAccessToken = isAdmin ? body.gscAccessToken : undefined;
  const gscSiteUrl = isAdmin ? body.gscSiteUrl : undefined;
  const driveAccessToken = isAdmin ? body.driveAccessToken : undefined;
  const driveFolderId = isAdmin ? body.driveFolderId : undefined;

  const { SYSTEM_PROMPT } = await import("@/lib/systemPrompt");

  let systemPrompt = SYSTEM_PROMPT;

  if (selectedTool) {
    systemPrompt += `\n\n--- ACTIVE TOOL ---\nThe user has selected a specific tool to focus on: "${selectedTool}". Focus your response on this tool's capabilities and domain.\n--- END TOOL CONTEXT ---\n`;
  }

  if (lastUserMessage) {
    const memoryContext = await buildMemoryRAGContext(supabase, lastUserMessage, user.id);
    if (memoryContext) systemPrompt += memoryContext;
  }

  if (knowledgeContext) {
    systemPrompt += knowledgeContext;
  }

  if (asanaPat && asanaWorkspace) {
    const asanaContext = await buildAsanaContext(asanaPat, asanaWorkspace);
    systemPrompt += asanaContext;
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
    systemPrompt += `\n\n## Google Drive Context\nGoogle Drive is connected. Agent outputs can be saved to Drive folder (ID: ${driveFolderId}).`;
  }

  // Access policy goes LAST so it is the final instruction the model reads.
  systemPrompt += buildAccessPolicyPrompt(role, user.email);

  return new Response(JSON.stringify({ systemPrompt }), {
    headers: { "Content-Type": "application/json" },
  });
}
