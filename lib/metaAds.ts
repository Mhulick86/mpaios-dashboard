// ─── Meta (Facebook/Instagram) Marketing API Integration ───
//
// Uses Graph API v21.0 + Facebook Login for Business (OAuth 2.0).
// Scopes: ads_read, ads_management, business_management, read_insights.
//
// Hard rule (system.md line 77): we never activate campaigns. Any created
// campaign is forced to status=PAUSED. Human review gates the rest.

export const META_API_VERSION = "v21.0";
export const META_GRAPH_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

export const META_OAUTH_SCOPES = [
  "ads_read",
  "ads_management",
  "business_management",
  "read_insights",
  "pages_show_list",
];

/* ---------- Types ---------- */

export interface MetaAdAccount {
  id: string;           // "act_123456"
  account_id: string;   // "123456"
  name: string;
  currency: string;
  timezone_name: string;
  account_status: number; // 1=active, 2=disabled, 3=unsettled, 7=pending risk review, etc.
  amount_spent?: string;
  balance?: string;
  business?: { id: string; name: string };
}

export type CampaignStatus = "ACTIVE" | "PAUSED" | "DELETED" | "ARCHIVED";
export type EffectiveStatus = CampaignStatus | "PENDING_REVIEW" | "DISAPPROVED" | "PREAPPROVED" | "PENDING_BILLING_INFO" | "IN_PROCESS" | "WITH_ISSUES";

export interface MetaCampaign {
  id: string;
  name: string;
  status: CampaignStatus;
  effective_status?: EffectiveStatus;
  objective: string;            // e.g. "OUTCOME_TRAFFIC", "OUTCOME_LEADS"
  buying_type?: string;
  special_ad_categories?: string[];
  daily_budget?: string;        // minor units (cents)
  lifetime_budget?: string;
  start_time?: string;
  stop_time?: string;
  created_time?: string;
  updated_time?: string;
}

export interface MetaAdSet {
  id: string;
  name: string;
  campaign_id: string;
  status: CampaignStatus;
  effective_status?: EffectiveStatus;
  daily_budget?: string;
  lifetime_budget?: string;
  optimization_goal?: string;
  billing_event?: string;
  bid_strategy?: string;
  targeting?: Record<string, unknown>;
  start_time?: string;
  end_time?: string;
}

export interface MetaAd {
  id: string;
  name: string;
  adset_id: string;
  campaign_id: string;
  status: CampaignStatus;
  effective_status?: EffectiveStatus;
  creative?: { id: string };
  created_time?: string;
  updated_time?: string;
}

export interface MetaInsight {
  date_start?: string;
  date_stop?: string;
  campaign_id?: string;
  campaign_name?: string;
  adset_id?: string;
  adset_name?: string;
  ad_id?: string;
  ad_name?: string;
  impressions?: string;
  reach?: string;
  clicks?: string;
  spend?: string;
  cpc?: string;
  cpm?: string;
  ctr?: string;
  frequency?: string;
  actions?: Array<{ action_type: string; value: string }>;
  action_values?: Array<{ action_type: string; value: string }>;
  cost_per_action_type?: Array<{ action_type: string; value: string }>;
  conversions?: Array<{ action_type: string; value: string }>;
}

export interface MetaCustomAudience {
  id: string;
  name: string;
  description?: string;
  approximate_count_lower_bound?: number;
  approximate_count_upper_bound?: number;
  subtype?: string;
  customer_file_source?: string;
  delivery_status?: { code: number; description: string };
  operation_status?: { code: number; description: string };
  time_created?: number;
  time_updated?: number;
}

export interface MetaMe {
  id: string;
  name: string;
  email?: string;
}

export interface MetaPagedResponse<T> {
  data: T[];
  paging?: {
    cursors?: { before?: string; after?: string };
    next?: string;
    previous?: string;
  };
}

export interface MetaAdsConfig {
  accessToken: string;     // long-lived user token
  expiresAt: number | null; // ms epoch; null = unknown
  userId: string;
  userName: string;
  accountId: string;       // "act_..." — the selected ad account
  accountName: string;
  currency: string;
  connected: boolean;
  connectedAt: string | null;
}

export function defaultMetaAdsConfig(): MetaAdsConfig {
  return {
    accessToken: "",
    expiresAt: null,
    userId: "",
    userName: "",
    accountId: "",
    accountName: "",
    currency: "",
    connected: false,
    connectedAt: null,
  };
}

/* ---------- Fetch helper ---------- */

export async function metaFetch<T = unknown>(
  accessToken: string,
  path: string,
  params: Record<string, string | number | undefined | string[]> = {},
  init: RequestInit = {}
): Promise<T> {
  const url = new URL(path.startsWith("http") ? path : `${META_GRAPH_BASE}${path.startsWith("/") ? path : `/${path}`}`);
  url.searchParams.set("access_token", accessToken);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    url.searchParams.set(k, Array.isArray(v) ? JSON.stringify(v) : String(v));
  }

  const res = await fetch(url.toString(), {
    ...init,
    headers: { Accept: "application/json", ...(init.headers || {}) },
  });

  const text = await res.text();
  let parsed: unknown;
  try { parsed = text ? JSON.parse(text) : {}; } catch { parsed = { raw: text }; }

  if (!res.ok) {
    const err = (parsed as { error?: { message?: string; code?: number; error_subcode?: number; type?: string } }).error;
    const msg = err?.message || `Meta Graph API error (${res.status})`;
    const suffix = err?.code ? ` [code ${err.code}${err.error_subcode ? `/${err.error_subcode}` : ""}]` : "";
    throw new Error(`${msg}${suffix}`);
  }

  return parsed as T;
}

/* ---------- List helpers ---------- */

export async function listAdAccounts(accessToken: string): Promise<MetaAdAccount[]> {
  const data = await metaFetch<MetaPagedResponse<MetaAdAccount>>(accessToken, "/me/adaccounts", {
    fields: "id,account_id,name,currency,timezone_name,account_status,amount_spent,balance,business{id,name}",
    limit: "100",
  });
  return data.data;
}

export async function getMe(accessToken: string): Promise<MetaMe> {
  return metaFetch<MetaMe>(accessToken, "/me", { fields: "id,name,email" });
}

export async function listCampaigns(accessToken: string, adAccountId: string, limit = 50): Promise<MetaCampaign[]> {
  const data = await metaFetch<MetaPagedResponse<MetaCampaign>>(accessToken, `/${adAccountId}/campaigns`, {
    fields: "id,name,status,effective_status,objective,buying_type,special_ad_categories,daily_budget,lifetime_budget,start_time,stop_time,created_time,updated_time",
    limit,
  });
  return data.data;
}

export async function listAdSets(accessToken: string, adAccountId: string, limit = 50): Promise<MetaAdSet[]> {
  const data = await metaFetch<MetaPagedResponse<MetaAdSet>>(accessToken, `/${adAccountId}/adsets`, {
    fields: "id,name,campaign_id,status,effective_status,daily_budget,lifetime_budget,optimization_goal,billing_event,bid_strategy,start_time,end_time",
    limit,
  });
  return data.data;
}

export async function listAds(accessToken: string, adAccountId: string, limit = 50): Promise<MetaAd[]> {
  const data = await metaFetch<MetaPagedResponse<MetaAd>>(accessToken, `/${adAccountId}/ads`, {
    fields: "id,name,adset_id,campaign_id,status,effective_status,creative{id},created_time,updated_time",
    limit,
  });
  return data.data;
}

export interface InsightsOptions {
  level?: "account" | "campaign" | "adset" | "ad";
  datePreset?: string;      // "last_7d" | "last_30d" | "last_90d" | "this_month" | ...
  timeIncrement?: string;   // "1" for daily, "7", "monthly"
  breakdowns?: string[];    // e.g. ["age", "gender"]
  limit?: number;
}

export async function getInsights(
  accessToken: string,
  adAccountId: string,
  opts: InsightsOptions = {}
): Promise<MetaInsight[]> {
  const level = opts.level || "account";
  const datePreset = opts.datePreset || "last_30d";
  const data = await metaFetch<MetaPagedResponse<MetaInsight>>(accessToken, `/${adAccountId}/insights`, {
    level,
    date_preset: datePreset,
    fields: [
      "impressions",
      "reach",
      "clicks",
      "spend",
      "cpc",
      "cpm",
      "ctr",
      "frequency",
      "actions",
      "action_values",
      "cost_per_action_type",
      level === "campaign" ? "campaign_id,campaign_name" : "",
      level === "adset" ? "adset_id,adset_name,campaign_id,campaign_name" : "",
      level === "ad" ? "ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name" : "",
    ].filter(Boolean).join(","),
    time_increment: opts.timeIncrement,
    breakdowns: opts.breakdowns?.join(","),
    limit: opts.limit ?? 200,
  });
  return data.data;
}

export async function listAudiences(accessToken: string, adAccountId: string): Promise<MetaCustomAudience[]> {
  const data = await metaFetch<MetaPagedResponse<MetaCustomAudience>>(accessToken, `/${adAccountId}/customaudiences`, {
    fields: "id,name,description,approximate_count_lower_bound,approximate_count_upper_bound,subtype,customer_file_source,delivery_status,operation_status,time_created,time_updated",
    limit: "100",
  });
  return data.data;
}

/* ---------- Create campaign (DRAFT ONLY) ---------- */

export interface CreateCampaignInput {
  name: string;
  objective: string; // e.g. "OUTCOME_TRAFFIC", "OUTCOME_LEADS", "OUTCOME_SALES", "OUTCOME_AWARENESS", "OUTCOME_ENGAGEMENT", "OUTCOME_APP_PROMOTION"
  special_ad_categories?: string[]; // required by API; pass [] if none
  daily_budget_cents?: number;      // optional; minor units
  lifetime_budget_cents?: number;   // optional; minor units
  buying_type?: "AUCTION" | "RESERVED";
}

// Always creates as PAUSED. Activation must be done by a human in Ads Manager
// (system.md line 77 prohibits auto-activation).
export async function createCampaignDraft(
  accessToken: string,
  adAccountId: string,
  input: CreateCampaignInput
): Promise<{ id: string }> {
  const body = new URLSearchParams();
  body.set("access_token", accessToken);
  body.set("name", input.name);
  body.set("objective", input.objective);
  body.set("status", "PAUSED"); // <-- non-negotiable
  body.set("special_ad_categories", JSON.stringify(input.special_ad_categories || []));
  if (input.buying_type) body.set("buying_type", input.buying_type);
  if (input.daily_budget_cents != null) body.set("daily_budget", String(input.daily_budget_cents));
  if (input.lifetime_budget_cents != null) body.set("lifetime_budget", String(input.lifetime_budget_cents));

  const res = await fetch(`${META_GRAPH_BASE}/${adAccountId}/campaigns`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message || `Meta Graph API error (${res.status})`;
    const code = data?.error?.code;
    throw new Error(code ? `${msg} [code ${code}]` : msg);
  }
  return { id: data.id as string };
}

/* ---------- Overview markdown (used by orchestrator context) ---------- */

export async function fetchMetaOverview(accessToken: string, adAccountId: string): Promise<string> {
  const [campaigns, insights] = await Promise.all([
    listCampaigns(accessToken, adAccountId, 10).catch((e) => {
      throw new Error(`Campaigns: ${e instanceof Error ? e.message : String(e)}`);
    }),
    getInsights(accessToken, adAccountId, { level: "account", datePreset: "last_30d" }).catch(() => [] as MetaInsight[]),
  ]);

  const totals = insights[0] || {};
  const lines: string[] = [];
  lines.push(`### Meta Ads — ${adAccountId} (last 30d)`);
  lines.push("");
  if (insights.length) {
    lines.push(`- **Spend:** ${totals.spend ?? "—"}`);
    lines.push(`- **Impressions:** ${totals.impressions ?? "—"}`);
    lines.push(`- **Clicks:** ${totals.clicks ?? "—"}`);
    lines.push(`- **CTR:** ${totals.ctr ?? "—"}%`);
    lines.push(`- **CPC:** ${totals.cpc ?? "—"}`);
    lines.push(`- **CPM:** ${totals.cpm ?? "—"}`);
    lines.push(`- **Reach:** ${totals.reach ?? "—"}`);
  } else {
    lines.push("_No insights for the last 30 days._");
  }
  lines.push("");
  lines.push(`#### Recent campaigns (${campaigns.length})`);
  if (campaigns.length === 0) {
    lines.push("_No campaigns found._");
  } else {
    for (const c of campaigns.slice(0, 10)) {
      const budget = c.daily_budget
        ? `$${(Number(c.daily_budget) / 100).toFixed(2)}/day`
        : c.lifetime_budget
          ? `$${(Number(c.lifetime_budget) / 100).toFixed(2)} lifetime`
          : "no budget set";
      lines.push(`- **${c.name}** — ${c.status} · ${c.objective} · ${budget}`);
    }
  }
  return lines.join("\n");
}
