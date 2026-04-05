/**
 * Tool Execution Layer
 * Real API actions with execution feedback loops
 * All tools agents need to do their jobs
 */

import { createClient } from "@/lib/supabase/client";
import { logAuditEvent } from "@/lib/observability";

const supabase = createClient();

export interface ToolDefinition {
  id: string;
  name: string;
  category: string;
  description: string;
  agentIds: number[]; // which agents use this tool
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

export function getToolsForAgent(agentId: number): ToolDefinition[] {
  return getAllTools().filter(t => t.agentIds.includes(agentId));
}

// ── Tool Execution with Logging ──
export async function executeTool(
  toolId: string,
  params: Record<string, unknown>,
  context?: { agentId?: number; conversationId?: string }
): Promise<ToolResult> {
  const tool = toolRegistry.get(toolId);
  if (!tool) return { success: false, error: `Tool ${toolId} not found` };

  const startTime = Date.now();
  try {
    for (const param of tool.parameters) {
      if (param.required && !(param.name in params)) {
        return { success: false, error: `Missing required parameter: ${param.name}` };
      }
    }

    const result = await tool.execute(params);
    const latencyMs = Date.now() - startTime;

    logAuditEvent({
      eventType: "tool.executed",
      resourceType: "tool",
      resourceId: toolId,
      details: { toolName: tool.name, success: result.success, latencyMs, agentId: context?.agentId },
      latencyMs,
    });

    return result;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Tool execution failed";
    return { success: false, error: errorMsg };
  }
}

// Helper to get API key from localStorage
function getApiKey(keyId: string): string | null {
  try {
    const stored = typeof window !== "undefined" ? localStorage.getItem("mpaios_api_keys") : null;
    if (!stored) return null;
    const keys = JSON.parse(stored) as Record<string, string>;
    return keys[keyId] || null;
  } catch {
    return null;
  }
}

// Helper for API calls
async function apiCall(url: string, options?: RequestInit): Promise<ToolResult> {
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      return { success: false, error: `HTTP ${res.status}: ${errBody.slice(0, 200)}` };
    }
    const data = await res.json().catch(() => ({}));
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Request failed" };
  }
}

// ═══════════════════════════════════════════════════════
// CORE TOOLS - What agents actually need to execute
// ═══════════════════════════════════════════════════════

// ── 1. WEB RESEARCH ──
registerTool({
  id: "web-research",
  name: "Web Research & URL Analysis",
  category: "research",
  description: "Fetch and analyze web pages, extract content, check site status",
  agentIds: [1, 2, 3, 10, 19, 21, 23, 30, 31],
  parameters: [
    { name: "url", type: "string", required: true, description: "URL to fetch and analyze" },
  ],
  execute: async (params) => {
    const res = await fetch(params.url as string, {
      headers: { "User-Agent": "MarketingPowered-Bot/1.0" },
      signal: AbortSignal.timeout(10000),
    });
    const html = await res.text();
    const title = html.match(/<title>(.*?)<\/title>/i)?.[1] || "";
    const metaDesc = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"[^>]*>/i)?.[1] || "";
    const h1s = Array.from(html.matchAll(/<h1[^>]*>(.*?)<\/h1>/gi)).map(m => m[1].replace(/<[^>]*>/g, ""));
    const wordCount = html.replace(/<[^>]*>/g, " ").split(/\s+/).filter(Boolean).length;

    return {
      success: true,
      data: {
        url: params.url,
        status: res.status,
        title,
        metaDescription: metaDesc,
        h1Tags: h1s.slice(0, 5),
        wordCount,
        contentLength: html.length,
        hasHttps: (params.url as string).startsWith("https"),
      },
    };
  },
});

// ── 2. PAGESPEED INSIGHTS ──
registerTool({
  id: "pagespeed-insights",
  name: "Google PageSpeed Insights",
  category: "seo",
  description: "Analyze page speed and Core Web Vitals",
  agentIds: [10, 6, 14],
  parameters: [
    { name: "url", type: "string", required: true, description: "URL to analyze" },
    { name: "strategy", type: "string", required: false, description: "mobile or desktop", default: "mobile" },
  ],
  execute: async (params) => {
    const apiKey = getApiKey("google_places") || "";
    const strategy = params.strategy || "mobile";
    const url = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(params.url as string)}&strategy=${strategy}${apiKey ? `&key=${apiKey}` : ""}`;
    return apiCall(url);
  },
});

// ── 3. GOOGLE ANALYTICS ──
registerTool({
  id: "google-analytics-fetch",
  name: "Fetch Google Analytics Data",
  category: "analytics",
  description: "Fetches GA4 overview data including users, sessions, pageviews",
  agentIds: [13, 14, 16, 27],
  parameters: [
    { name: "accessToken", type: "string", required: true, description: "OAuth access token" },
    { name: "propertyId", type: "string", required: true, description: "GA4 property ID" },
  ],
  execute: async (params) => apiCall("/api/google-analytics/overview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  }),
});

// ── 4. GOOGLE SEARCH CONSOLE ──
registerTool({
  id: "google-search-console-fetch",
  name: "Fetch Search Console Data",
  category: "seo",
  description: "Fetches GSC data including queries, pages, impressions, clicks",
  agentIds: [3, 10, 13, 21, 31],
  parameters: [
    { name: "accessToken", type: "string", required: true, description: "OAuth access token" },
    { name: "siteUrl", type: "string", required: true, description: "Site URL in GSC" },
  ],
  execute: async (params) => apiCall("/api/google-search-console/overview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  }),
});

// ── 5. AHREFS SEO ANALYSIS ──
registerTool({
  id: "ahrefs-overview",
  name: "Ahrefs Site Analysis",
  category: "seo",
  description: "Domain rating, backlinks, organic keywords, top pages, competitors",
  agentIds: [1, 3, 10, 21, 30, 31],
  parameters: [
    { name: "target", type: "string", required: true, description: "Domain to analyze" },
    { name: "country", type: "string", required: false, description: "Country code", default: "us" },
  ],
  execute: async (params) => {
    const apiKey = getApiKey("ahrefs");
    if (!apiKey) return { success: false, error: "Ahrefs API key not configured in Settings" };
    return apiCall("/api/ahrefs/overview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey, ...params }),
    });
  },
});

// ── 6. ASANA PROJECT MANAGEMENT ──
registerTool({
  id: "asana-create-task",
  name: "Create Asana Task",
  category: "project-management",
  description: "Creates a new task in Asana",
  agentIds: [15, 16, 19, 25],
  parameters: [
    { name: "pat", type: "string", required: true, description: "Personal access token" },
    { name: "projectGid", type: "string", required: true, description: "Project GID" },
    { name: "name", type: "string", required: true, description: "Task name" },
    { name: "notes", type: "string", required: false, description: "Task notes" },
  ],
  execute: async (params) => apiCall("/api/asana/tasks/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  }),
});

// ── 7. GOOGLE DRIVE ──
registerTool({
  id: "google-drive-upload",
  name: "Upload to Google Drive",
  category: "storage",
  description: "Uploads a file to Google Drive",
  agentIds: [4, 15, 16, 18],
  parameters: [
    { name: "accessToken", type: "string", required: true, description: "OAuth access token" },
    { name: "fileName", type: "string", required: true, description: "File name" },
    { name: "content", type: "string", required: true, description: "File content" },
    { name: "folderId", type: "string", required: false, description: "Parent folder ID" },
  ],
  execute: async (params) => apiCall("/api/google-drive/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...params, mimeType: "text/markdown" }),
  }),
});

// ── 8. EMAIL SEND ──
registerTool({
  id: "email-send",
  name: "Send Email",
  category: "email",
  description: "Sends an email via SendGrid, Mailchimp, or Klaviyo",
  agentIds: [24, 25, 26],
  parameters: [
    { name: "to", type: "string", required: true, description: "Recipient email" },
    { name: "subject", type: "string", required: true, description: "Email subject" },
    { name: "body", type: "string", required: true, description: "Email body (HTML)" },
  ],
  execute: async (params) => {
    const sendgridKey = getApiKey("sendgrid");
    if (!sendgridKey) return { success: false, error: "SendGrid API key not configured. Add it in Settings." };
    return apiCall("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sendgridKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: params.to }] }],
        from: { email: "noreply@marketingpowered.ai" },
        subject: params.subject,
        content: [{ type: "text/html", value: params.body }],
      }),
    });
  },
});

// ── 9. WEBHOOK / ZAPIER ──
registerTool({
  id: "webhook-fire",
  name: "Fire Webhook",
  category: "automation",
  description: "Sends a POST request to a webhook URL (Zapier, n8n, Make, etc.)",
  agentIds: [15, 24, 28],
  parameters: [
    { name: "url", type: "string", required: true, description: "Webhook URL" },
    { name: "payload", type: "object", required: true, description: "JSON payload" },
  ],
  execute: async (params) => {
    const res = await fetch(params.url as string, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params.payload),
    });
    return { success: res.ok, data: { status: res.status }, error: res.ok ? undefined : `HTTP ${res.status}` };
  },
});

// ── 10. SLACK NOTIFICATION ──
registerTool({
  id: "slack-notify",
  name: "Send Slack Notification",
  category: "notifications",
  description: "Posts a message to Slack via webhook",
  agentIds: [12, 15, 16, 25],
  parameters: [
    { name: "message", type: "string", required: true, description: "Message text" },
    { name: "channel", type: "string", required: false, description: "Channel override" },
  ],
  execute: async (params) => {
    const webhookUrl = getApiKey("slack");
    if (!webhookUrl) return { success: false, error: "Slack webhook not configured in Settings" };
    return apiCall(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: params.message, channel: params.channel }),
    });
  },
});

// ── 11. COMPETITOR RESEARCH ──
registerTool({
  id: "competitor-analysis",
  name: "Competitor Ad & SEO Analysis",
  category: "research",
  description: "Analyzes competitor websites, ad libraries, and SEO metrics",
  agentIds: [1, 2, 30],
  parameters: [
    { name: "competitorUrl", type: "string", required: true, description: "Competitor domain" },
  ],
  execute: async (params) => {
    // Fetch competitor site
    const siteResult = await executeTool("web-research", { url: `https://${params.competitorUrl}` });
    // Fetch Ahrefs data if available
    const ahrefsResult = await executeTool("ahrefs-overview", { target: params.competitorUrl });
    return {
      success: true,
      data: {
        site: siteResult.data,
        seo: ahrefsResult.success ? ahrefsResult.data : null,
        note: ahrefsResult.success ? "Full SEO data available" : "Add Ahrefs API key for full competitor SEO data",
      },
    };
  },
});

// ── 12. CONTENT GENERATION ──
registerTool({
  id: "content-generate",
  name: "Generate Marketing Content",
  category: "content",
  description: "Generates marketing content using LLM (blog posts, ad copy, emails, etc.)",
  agentIds: [3, 4, 5, 6, 11, 20, 24],
  parameters: [
    { name: "type", type: "string", required: true, description: "Content type: blog, ad_copy, email, social, landing_page, video_script" },
    { name: "topic", type: "string", required: true, description: "Content topic or brief" },
    { name: "tone", type: "string", required: false, description: "Tone of voice", default: "professional" },
    { name: "length", type: "string", required: false, description: "short, medium, long", default: "medium" },
  ],
  execute: async (params) => {
    // This delegates to the chat API with content-specific instructions
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{
          role: "user",
          content: `Generate ${params.type} content about: ${params.topic}. Tone: ${params.tone}. Length: ${params.length}. Output the finished content only, no meta-commentary.`,
        }],
        ...getDefaultLLMConfig(),
      }),
    });
    if (!res.ok) return { success: false, error: `LLM call failed: ${res.status}` };
    const content = await res.text();
    return { success: true, data: { content, type: params.type, wordCount: content.split(/\s+/).length } };
  },
});

// ── 13. KEYWORD RESEARCH ──
registerTool({
  id: "keyword-research",
  name: "Keyword Research & Analysis",
  category: "seo",
  description: "Finds keyword opportunities, volume, difficulty, and related terms",
  agentIds: [3, 10, 21, 30],
  parameters: [
    { name: "keyword", type: "string", required: true, description: "Seed keyword" },
    { name: "country", type: "string", required: false, description: "Country code", default: "us" },
  ],
  execute: async (params) => {
    const ahrefsKey = getApiKey("ahrefs");
    if (ahrefsKey) {
      // Use Ahrefs Keywords Explorer
      try {
        const res = await fetch(`https://api.ahrefs.com/v3/keywords-explorer/overview?keyword=${encodeURIComponent(params.keyword as string)}&country=${params.country || "us"}&output=json`, {
          headers: { Authorization: `Bearer ${ahrefsKey}` },
        });
        if (res.ok) {
          const data = await res.json();
          return { success: true, data };
        }
      } catch { /* fall through */ }
    }

    const serpKey = getApiKey("serp");
    if (serpKey) {
      // Use SerpAPI
      const url = `https://serpapi.com/search.json?q=${encodeURIComponent(params.keyword as string)}&api_key=${serpKey}&engine=google&gl=${params.country || "us"}`;
      return apiCall(url);
    }

    return { success: false, error: "No SEO API key configured. Add Ahrefs or SerpAPI key in Settings." };
  },
});

// ── 14. META ADS ──
registerTool({
  id: "meta-ads-insights",
  name: "Meta Ads Insights",
  category: "advertising",
  description: "Fetch Meta (Facebook/Instagram) ad campaign performance data",
  agentIds: [7, 13],
  parameters: [
    { name: "accountId", type: "string", required: true, description: "Ad account ID" },
    { name: "dateRange", type: "string", required: false, description: "Date range", default: "last_30d" },
  ],
  execute: async (params) => {
    const token = getApiKey("meta");
    if (!token) return { success: false, error: "Meta Marketing API token not configured in Settings" };
    return apiCall(`https://graph.facebook.com/v19.0/${params.accountId}/insights?access_token=${token}&date_preset=${params.dateRange || "last_30d"}&fields=impressions,clicks,spend,cpc,ctr,conversions,cost_per_conversion`);
  },
});

// ── 15. GOOGLE ADS ──
registerTool({
  id: "google-ads-performance",
  name: "Google Ads Performance",
  category: "advertising",
  description: "Fetch Google Ads campaign performance metrics",
  agentIds: [8, 13],
  parameters: [
    { name: "customerId", type: "string", required: true, description: "Google Ads customer ID" },
  ],
  execute: async (params) => {
    const token = getApiKey("google_ads");
    if (!token) return { success: false, error: "Google Ads developer token not configured in Settings" };
    // Google Ads API requires OAuth + developer token - placeholder for the integration
    return { success: false, error: "Google Ads API requires OAuth setup. Configure in Integrations." };
  },
});

// ── 16. HUBSPOT CRM ──
registerTool({
  id: "hubspot-contacts",
  name: "HubSpot CRM Operations",
  category: "crm",
  description: "Manage contacts, deals, and companies in HubSpot",
  agentIds: [19, 25, 26, 27],
  parameters: [
    { name: "action", type: "string", required: true, description: "list_contacts, create_contact, list_deals, create_deal" },
    { name: "data", type: "object", required: false, description: "Contact/deal data" },
  ],
  execute: async (params) => {
    const apiKey = getApiKey("hubspot");
    if (!apiKey) return { success: false, error: "HubSpot API key not configured in Settings" };
    const action = params.action as string;

    if (action === "list_contacts") {
      return apiCall("https://api.hubapi.com/crm/v3/objects/contacts?limit=20", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
    }
    if (action === "list_deals") {
      return apiCall("https://api.hubapi.com/crm/v3/objects/deals?limit=20", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
    }
    if (action === "create_contact") {
      return apiCall("https://api.hubapi.com/crm/v3/objects/contacts", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ properties: params.data }),
      });
    }
    return { success: false, error: `Unknown action: ${action}` };
  },
});

// ── 17. SALESFORCE CRM ──
registerTool({
  id: "salesforce-query",
  name: "Salesforce CRM Query",
  category: "crm",
  description: "Query Salesforce leads, opportunities, accounts",
  agentIds: [25, 26, 27],
  parameters: [
    { name: "query", type: "string", required: true, description: "SOQL query" },
  ],
  execute: async (params) => {
    const token = getApiKey("salesforce");
    if (!token) return { success: false, error: "Salesforce token not configured in Settings" };
    return apiCall(`https://login.salesforce.com/services/data/v59.0/query/?q=${encodeURIComponent(params.query as string)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  },
});

// ── 18. WORDPRESS CMS ──
registerTool({
  id: "wordpress-publish",
  name: "WordPress Publish/Update",
  category: "cms",
  description: "Create or update WordPress posts and pages",
  agentIds: [4, 10, 11],
  parameters: [
    { name: "siteUrl", type: "string", required: true, description: "WordPress site URL" },
    { name: "action", type: "string", required: true, description: "create_post, list_posts, update_post" },
    { name: "data", type: "object", required: false, description: "Post data (title, content, status)" },
  ],
  execute: async (params) => {
    const appPassword = getApiKey("wordpress");
    if (!appPassword) return { success: false, error: "WordPress app password not configured in Settings" };
    const baseUrl = `${params.siteUrl}/wp-json/wp/v2`;

    if (params.action === "list_posts") {
      return apiCall(`${baseUrl}/posts?per_page=10&_fields=id,title,status,date,link`, {
        headers: { Authorization: `Basic ${btoa(`admin:${appPassword}`)}` },
      });
    }
    if (params.action === "create_post") {
      return apiCall(`${baseUrl}/posts`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`admin:${appPassword}`)}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(params.data),
      });
    }
    return { success: false, error: `Unknown action: ${params.action}` };
  },
});

// ── 19. MIXPANEL ANALYTICS ──
registerTool({
  id: "mixpanel-query",
  name: "Mixpanel Analytics Query",
  category: "analytics",
  description: "Query product analytics events, funnels, retention",
  agentIds: [13, 14, 29],
  parameters: [
    { name: "event", type: "string", required: true, description: "Event name to query" },
    { name: "from_date", type: "string", required: false, description: "Start date YYYY-MM-DD" },
    { name: "to_date", type: "string", required: false, description: "End date YYYY-MM-DD" },
  ],
  execute: async (params) => {
    const token = getApiKey("mixpanel");
    if (!token) return { success: false, error: "Mixpanel token not configured in Settings" };
    const from = params.from_date || new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
    const to = params.to_date || new Date().toISOString().split("T")[0];
    return apiCall(`https://data.mixpanel.com/api/2.0/export?from_date=${from}&to_date=${to}&event=["${params.event}"]`, {
      headers: { Authorization: `Basic ${btoa(`${token}:`)}` },
    });
  },
});

// ── 20. STRIPE REVENUE ──
registerTool({
  id: "stripe-revenue",
  name: "Stripe Revenue Data",
  category: "finance",
  description: "Fetch revenue, MRR, subscription data from Stripe",
  agentIds: [17, 27],
  parameters: [
    { name: "action", type: "string", required: true, description: "balance, charges, subscriptions, mrr" },
  ],
  execute: async (params) => {
    const key = getApiKey("stripe");
    if (!key) return { success: false, error: "Stripe key not configured in Settings" };
    const endpoints: Record<string, string> = {
      balance: "https://api.stripe.com/v1/balance",
      charges: "https://api.stripe.com/v1/charges?limit=10",
      subscriptions: "https://api.stripe.com/v1/subscriptions?limit=10&status=active",
    };
    const url = endpoints[params.action as string];
    if (!url) return { success: false, error: `Unknown action: ${params.action}` };
    return apiCall(url, { headers: { Authorization: `Bearer ${key}` } });
  },
});

// ── 21. SOCIAL MEDIA POST ──
registerTool({
  id: "social-post-draft",
  name: "Draft Social Media Post",
  category: "social",
  description: "Generates social media posts for various platforms",
  agentIds: [5, 11, 20, 23],
  parameters: [
    { name: "platform", type: "string", required: true, description: "instagram, linkedin, twitter, tiktok, facebook" },
    { name: "topic", type: "string", required: true, description: "Post topic" },
    { name: "style", type: "string", required: false, description: "educational, promotional, engagement, storytelling", default: "engagement" },
  ],
  execute: async (params) => {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{
          role: "user",
          content: `Write a ${params.platform} post about: ${params.topic}. Style: ${params.style}. Include hashtags. Platform-optimized length. Output ONLY the post text.`,
        }],
        ...getDefaultLLMConfig(),
      }),
    });
    if (!res.ok) return { success: false, error: "LLM call failed" };
    const content = await res.text();
    return { success: true, data: { post: content, platform: params.platform, charCount: content.length } };
  },
});

// ── 22. BRAND SENTIMENT MONITOR ──
registerTool({
  id: "brand-sentiment",
  name: "Brand Sentiment Check",
  category: "monitoring",
  description: "Checks brand mentions and sentiment across web",
  agentIds: [12, 23, 25],
  parameters: [
    { name: "brandName", type: "string", required: true, description: "Brand to monitor" },
  ],
  execute: async (params) => {
    const serpKey = getApiKey("serp");
    if (serpKey) {
      return apiCall(`https://serpapi.com/search.json?q="${encodeURIComponent(params.brandName as string)}"&api_key=${serpKey}&engine=google&tbm=nws&num=10`);
    }
    // Fallback: use web research
    const result = await executeTool("web-research", { url: `https://www.google.com/search?q=${encodeURIComponent(params.brandName as string)}+reviews` });
    return { success: true, data: { note: "Add SerpAPI key for full brand monitoring. Basic web check complete.", ...result.data } };
  },
});

// ── 23. LOCAL SEO SCAN ──
registerTool({
  id: "local-seo-scan",
  name: "Local SEO Grid Scan",
  category: "local-seo",
  description: "Scans local search rankings across a geographic grid",
  agentIds: [31, 32, 33],
  parameters: [
    { name: "businessName", type: "string", required: true, description: "Business name" },
    { name: "keyword", type: "string", required: true, description: "Search keyword" },
    { name: "gridSize", type: "number", required: false, description: "Grid size (5-13)", default: 7 },
  ],
  execute: async (params) => {
    // Currently uses simulated data — will use DataForSEO/SerpAPI when configured
    const dataForSeoKey = getApiKey("dataforseo");
    if (dataForSeoKey) {
      // TODO: Wire up DataForSEO Live SERP API with geo-targeting
      return { success: false, error: "DataForSEO integration coming soon. Using simulated grid for now." };
    }
    return { success: true, data: { note: "Simulated scan. Add DataForSEO key for real geo-grid data.", businessName: params.businessName, keyword: params.keyword } };
  },
});

// ── 24. GBP AUDIT ──
registerTool({
  id: "gbp-audit",
  name: "Google Business Profile Audit",
  category: "local-seo",
  description: "Audits Google Business Profile completeness and optimization",
  agentIds: [32],
  parameters: [
    { name: "businessName", type: "string", required: true, description: "Business name" },
    { name: "location", type: "string", required: false, description: "City, State" },
  ],
  execute: async (params) => {
    const placesKey = getApiKey("google_places");
    if (!placesKey) return { success: false, error: "Google Places API key not configured in Settings" };
    const query = `${params.businessName} ${params.location || ""}`.trim();
    return apiCall(`https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${placesKey}`);
  },
});

// ── 25. MEMORY STORE ──
registerTool({
  id: "memory-store",
  name: "Store Learning to Memory",
  category: "system",
  description: "Saves a learning or insight to the persistent knowledge base",
  agentIds: [18],
  parameters: [
    { name: "category", type: "string", required: true, description: "Memory category" },
    { name: "content", type: "string", required: true, description: "Learning content" },
    { name: "confidence", type: "number", required: false, description: "Confidence 0-1", default: 0.8 },
  ],
  execute: async (params) => {
    const { data, error } = await supabase.from("memory").insert({
      category: params.category,
      content: params.content,
      confidence: params.confidence || 0.8,
      source_agent: 18,
    }).select().single();
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },
});

// ── 26. TWILIO SMS ──
registerTool({
  id: "twilio-sms",
  name: "Send SMS via Twilio",
  category: "messaging",
  description: "Sends SMS messages via Twilio",
  agentIds: [24, 25],
  parameters: [
    { name: "to", type: "string", required: true, description: "Phone number (+1...)" },
    { name: "message", type: "string", required: true, description: "SMS message text" },
  ],
  execute: async (params) => {
    const authToken = getApiKey("twilio");
    if (!authToken) return { success: false, error: "Twilio auth token not configured in Settings" };
    return { success: false, error: "Twilio requires Account SID + Auth Token + From Number. Configure in Settings." };
  },
});

// ── 27. REPORT GENERATION ──
registerTool({
  id: "generate-report",
  name: "Generate Client Report",
  category: "reporting",
  description: "Compiles data from multiple sources into a formatted report",
  agentIds: [16, 22, 27],
  parameters: [
    { name: "clientName", type: "string", required: true, description: "Client name" },
    { name: "reportType", type: "string", required: true, description: "weekly, monthly, qbr" },
    { name: "sections", type: "array", required: false, description: "Report sections to include" },
  ],
  execute: async (params) => {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{
          role: "user",
          content: `Generate a ${params.reportType} marketing performance report for client "${params.clientName}". Include: executive summary, channel performance, key metrics, recommendations, and next steps. Format in professional markdown with data tables.`,
        }],
        ...getDefaultLLMConfig(),
      }),
    });
    if (!res.ok) return { success: false, error: "Report generation failed" };
    const content = await res.text();
    return { success: true, data: { report: content, type: params.reportType, client: params.clientName } };
  },
});

// ── 28. CRO AUDIT ──
registerTool({
  id: "cro-audit",
  name: "Conversion Rate Optimization Audit",
  category: "optimization",
  description: "Analyzes a page for CRO issues and recommends improvements",
  agentIds: [6, 14],
  parameters: [
    { name: "url", type: "string", required: true, description: "Page URL to audit" },
  ],
  execute: async (params) => {
    // Combine web research + PageSpeed data
    const [siteData, speedData] = await Promise.all([
      executeTool("web-research", { url: params.url }),
      executeTool("pagespeed-insights", { url: params.url }),
    ]);
    return {
      success: true,
      data: {
        site: siteData.data,
        performance: speedData.success ? speedData.data : null,
        note: "Use Hotjar API key for heatmap and session recording data",
      },
    };
  },
});

// ── Helper: Get default LLM config from localStorage ──
function getDefaultLLMConfig(): Record<string, unknown> {
  try {
    const stored = typeof window !== "undefined" ? localStorage.getItem("mpaios_api_keys") : null;
    if (!stored) return {};
    const keys = JSON.parse(stored) as Record<string, string>;
    if (keys.anthropic) return { anthropicKey: keys.anthropic, provider: "anthropic", model: "claude-sonnet-4-20250514" };
    if (keys.openai) return { openaiKey: keys.openai, provider: "openai", model: "gpt-4o" };
    return {};
  } catch {
    return {};
  }
}
