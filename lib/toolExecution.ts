/**
 * Tool Execution Layer
 * Real API actions with execution feedback loops
 */

import { createClient } from "@/lib/supabase/client";
import { logAuditEvent } from "@/lib/observability";
import { storeMemory } from "@/lib/memory";

const supabase = createClient();

export interface ToolDefinition {
  id: string;
  name: string;
  category: string;
  description: string;
  parameters: ToolParameter[];
  execute: (params: Record<string, unknown>) => Promise<ToolResult>;
}

export interface ToolParameter {
  name: string;
  type: "string" | "number" | "boolean" | "object" | "array";
  required: boolean;
  description: string;
  default?: unknown;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  metadata?: Record<string, unknown>;
}

// ── Tool Registry ──

const toolRegistry = new Map<string, ToolDefinition>();

export function registerTool(tool: ToolDefinition) {
  toolRegistry.set(tool.id, tool);
}

export function getTool(id: string): ToolDefinition | undefined {
  return toolRegistry.get(id);
}

export function getAllTools(): ToolDefinition[] {
  return Array.from(toolRegistry.values());
}

// ── Tool Execution with Feedback Loop ──

export async function executeTool(
  toolId: string,
  params: Record<string, unknown>,
  context?: { agentId?: number; conversationId?: string; workflowRunId?: string }
): Promise<ToolResult> {
  const tool = toolRegistry.get(toolId);
  if (!tool) return { success: false, error: `Tool ${toolId} not found` };

  const startTime = Date.now();

  try {
    // Validate required parameters
    for (const param of tool.parameters) {
      if (param.required && !(param.name in params)) {
        return { success: false, error: `Missing required parameter: ${param.name}` };
      }
    }

    // Execute the tool
    const result = await tool.execute(params);
    const latencyMs = Date.now() - startTime;

    // Log execution
    await logAuditEvent({
      eventType: "tool.executed",
      resourceType: "tool",
      resourceId: toolId,
      details: {
        toolName: tool.name,
        success: result.success,
        latencyMs,
        agentId: context?.agentId,
      },
      latencyMs,
    });

    // Store learning if successful
    if (result.success && context?.agentId) {
      await storeMemory({
        category: "process_improvement",
        content: `Tool "${tool.name}" executed successfully for action with params: ${JSON.stringify(Object.keys(params))}. Result type: ${typeof result.data}`,
        confidence: 0.6,
        sourceAgent: context.agentId,
        sourceConversation: context.conversationId,
      });
    }

    return result;
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    const errorMsg = err instanceof Error ? err.message : "Tool execution failed";

    await logAuditEvent({
      eventType: "tool.failed",
      resourceType: "tool",
      resourceId: toolId,
      details: { toolName: tool.name, error: errorMsg, latencyMs },
      latencyMs,
    });

    return { success: false, error: errorMsg };
  }
}

// ── Built-in Tools ──

// Google Analytics fetch tool
registerTool({
  id: "google-analytics-fetch",
  name: "Fetch Google Analytics Data",
  category: "analytics",
  description: "Fetches GA4 overview data including users, sessions, pageviews",
  parameters: [
    { name: "accessToken", type: "string", required: true, description: "OAuth access token" },
    { name: "propertyId", type: "string", required: true, description: "GA4 property ID" },
    { name: "dateRange", type: "string", required: false, description: "Date range (default: 30d)", default: "30d" },
  ],
  execute: async (params) => {
    const res = await fetch("/api/google-analytics/overview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!res.ok) return { success: false, error: `GA API error: ${res.status}` };
    const data = await res.json();
    return { success: true, data };
  },
});

// Google Search Console fetch tool
registerTool({
  id: "google-search-console-fetch",
  name: "Fetch Search Console Data",
  category: "seo",
  description: "Fetches GSC data including queries, pages, impressions, clicks",
  parameters: [
    { name: "accessToken", type: "string", required: true, description: "OAuth access token" },
    { name: "siteUrl", type: "string", required: true, description: "Site URL in GSC" },
  ],
  execute: async (params) => {
    const res = await fetch("/api/google-search-console/overview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!res.ok) return { success: false, error: `GSC API error: ${res.status}` };
    const data = await res.json();
    return { success: true, data };
  },
});

// Asana task creation tool
registerTool({
  id: "asana-create-task",
  name: "Create Asana Task",
  category: "project-management",
  description: "Creates a new task in Asana",
  parameters: [
    { name: "pat", type: "string", required: true, description: "Personal access token" },
    { name: "projectGid", type: "string", required: true, description: "Project GID" },
    { name: "name", type: "string", required: true, description: "Task name" },
    { name: "notes", type: "string", required: false, description: "Task notes" },
    { name: "dueOn", type: "string", required: false, description: "Due date (YYYY-MM-DD)" },
  ],
  execute: async (params) => {
    const res = await fetch("/api/asana/tasks/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pat: params.pat,
        projectGid: params.projectGid,
        name: params.name,
        notes: params.notes,
        dueOn: params.dueOn,
      }),
    });
    if (!res.ok) return { success: false, error: `Asana API error: ${res.status}` };
    const data = await res.json();
    return { success: true, data };
  },
});

// Google Drive upload tool
registerTool({
  id: "google-drive-upload",
  name: "Upload to Google Drive",
  category: "storage",
  description: "Uploads a file to Google Drive",
  parameters: [
    { name: "accessToken", type: "string", required: true, description: "OAuth access token" },
    { name: "fileName", type: "string", required: true, description: "File name" },
    { name: "content", type: "string", required: true, description: "File content" },
    { name: "folderId", type: "string", required: false, description: "Parent folder ID" },
    { name: "mimeType", type: "string", required: false, description: "MIME type", default: "text/markdown" },
  ],
  execute: async (params) => {
    const res = await fetch("/api/google-drive/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!res.ok) return { success: false, error: `Drive API error: ${res.status}` };
    const data = await res.json();
    return { success: true, data };
  },
});

// Email send tool (placeholder for future integration)
registerTool({
  id: "email-send",
  name: "Send Email",
  category: "email",
  description: "Sends an email via configured email provider",
  parameters: [
    { name: "to", type: "string", required: true, description: "Recipient email" },
    { name: "subject", type: "string", required: true, description: "Email subject" },
    { name: "body", type: "string", required: true, description: "Email body (HTML)" },
  ],
  execute: async (_params) => {
    // Placeholder - integrate with SendGrid, Resend, etc.
    return {
      success: false,
      error: "Email provider not configured. Connect SendGrid or Resend in Settings > Integrations.",
    };
  },
});

// Webhook tool
registerTool({
  id: "webhook-fire",
  name: "Fire Webhook",
  category: "automation",
  description: "Sends a POST request to a webhook URL",
  parameters: [
    { name: "url", type: "string", required: true, description: "Webhook URL" },
    { name: "payload", type: "object", required: true, description: "JSON payload" },
    { name: "headers", type: "object", required: false, description: "Custom headers" },
  ],
  execute: async (params) => {
    const res = await fetch(params.url as string, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(params.headers as Record<string, string> || {}),
      },
      body: JSON.stringify(params.payload),
    });
    return {
      success: res.ok,
      data: { status: res.status, statusText: res.statusText },
      error: res.ok ? undefined : `Webhook returned ${res.status}`,
    };
  },
});
