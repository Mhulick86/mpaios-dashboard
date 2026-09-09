/**
 * Pinterest Ads — Pinterest API v5 (bearer auth).
 * Docs: https://developers.pinterest.com/docs/api/v5/
 *
 * OAuth is standard: authorization-code exchange and refresh_token grant
 * against /v5/oauth/token with the app id/secret as HTTP Basic credentials
 * (registry tokenAuth "basic"), all handled by lib/integrations/oauth.ts.
 *
 * Action params (query string on GET, JSON body on POST):
 *   account / adAccount   ad account id (defaults to the connected ad account)
 *   limit                 page size — default 50, max 200
 *   bookmark              continuation bookmark returned by a previous accounts/campaigns call
 *   status                campaigns filter: comma-separated ACTIVE,PAUSED,ARCHIVED (API default ACTIVE,PAUSED)
 *   days | start, end     analytics window — default last 30 days, max 90 (Pinterest limit; YYYY-MM-DD, UTC)
 */
import "server-only";
import { apiFetch, IntegrationApiError } from "../oauth";
import type { AccountIdentity, ActionContext, ActionHandler, ActionParams, IntegrationProvider } from "../types";

const PROVIDER = "Pinterest Ads";
/** API version segment of every endpoint path. */
const API_VERSION = process.env.PINTEREST_API_VERSION || "v5";
const BASE = (process.env.PINTEREST_API_BASE || `https://api.pinterest.com/${API_VERSION}`).replace(/\/+$/, "");
const ANALYTICS_COLUMNS = ["SPEND_IN_DOLLAR", "IMPRESSION_1", "CLICKTHROUGH_1", "TOTAL_CONVERSIONS"];
const CAMPAIGN_STATUSES = ["ACTIVE", "PAUSED", "ARCHIVED"];
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const DEFAULT_DAYS = 30;
/** Pinterest rejects ad account analytics windows longer than 90 days. */
const MAX_DAYS = 90;
const DAY_MS = 86_400_000;

type Json = Record<string, unknown>;

/* ------------------------------ param helpers ------------------------------ */

const rec = (v: unknown): Json => (v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Json) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | null => (typeof v === "string" ? v : typeof v === "number" ? String(v) : null);
const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

function optString(params: ActionParams, key: string): string | undefined {
  const v = params[key];
  if (v === undefined || v === null) return undefined;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v !== "string") throw new IntegrationApiError(`Parameter "${key}" must be a string`, 400);
  const t = v.trim();
  return t || undefined;
}

function optInt(params: ActionParams, key: string, fallback: number, min: number, max: number): number {
  const v = params[key];
  if (v === undefined || v === null || v === "") return fallback;
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.trim()) : NaN;
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new IntegrationApiError(`Parameter "${key}" must be an integer between ${min} and ${max}`, 400);
  }
  return n;
}

const limitParam = (params: ActionParams): number => optInt(params, "limit", DEFAULT_LIMIT, 1, MAX_LIMIT);

const isoDay = (d: Date): string => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number): Date => new Date(d.getTime() + n * DAY_MS);
function todayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
function parseDay(key: string, value: string): Date {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00Z`) : new Date(NaN);
  if (Number.isNaN(d.getTime()) || isoDay(d) !== value) {
    throw new IntegrationApiError(`Parameter "${key}" must be a valid date in YYYY-MM-DD format`, 400);
  }
  return d;
}

/** Resolves `days` (default 30) or an explicit `start`/`end` pair into an inclusive UTC date window. */
function dateWindow(params: ActionParams): { start: string; end: string; days: number } {
  const start = optString(params, "start");
  const end = optString(params, "end");
  if (start || end) {
    const endDate = end ? parseDay("end", end) : todayUtc();
    const startDate = start ? parseDay("start", start) : addDays(endDate, -(DEFAULT_DAYS - 1));
    const days = Math.round((endDate.getTime() - startDate.getTime()) / DAY_MS) + 1;
    if (days < 1) throw new IntegrationApiError(`"start" must be on or before "end"`, 400);
    if (days > MAX_DAYS) throw new IntegrationApiError(`Pinterest analytics windows can cover at most ${MAX_DAYS} days`, 400);
    return { start: isoDay(startDate), end: isoDay(endDate), days };
  }
  const days = optInt(params, "days", DEFAULT_DAYS, 1, MAX_DAYS);
  const endDate = todayUtc();
  return { start: isoDay(addDays(endDate, -(days - 1))), end: isoDay(endDate), days };
}

function adAccountParam(ctx: ActionContext, params: ActionParams): string {
  const id = optString(params, "adAccount") ?? optString(params, "ad_account") ?? optString(params, "account") ?? ctx.connection.accountId;
  if (!/^\d{1,32}$/.test(id)) {
    throw new IntegrationApiError(
      `Pinterest ad account id must be numeric (got "${id}"); this connection may have no ad accounts — pick one from the accounts action and pass adAccount=<id>`,
      400
    );
  }
  return id;
}

/* -------------------------------- API calls -------------------------------- */

async function pinterestGet(accessToken: string, pathAndQuery: string): Promise<unknown> {
  return apiFetch<unknown>(`${BASE}${pathAndQuery}`, { accessToken, providerName: PROVIDER });
}

function toUser(data: unknown) {
  const u = rec(data);
  return {
    id: str(u.id),
    username: str(u.username),
    business_name: str(u.business_name),
    account_type: str(u.account_type),
    website_url: str(u.website_url),
  };
}

function toAdAccount(e: unknown) {
  const a = rec(e);
  return {
    id: str(a.id) ?? "",
    name: str(a.name) ?? "",
    currency: str(a.currency),
    country: str(a.country),
    owner: str(rec(a.owner).username),
    permissions: arr(a.permissions).map((p) => str(p) ?? "").filter(Boolean),
  };
}
type AdAccount = ReturnType<typeof toAdAccount>;

/** GET /ad_accounts — ad accounts the user owns or has been granted access to. */
async function listAdAccounts(accessToken: string, pageSize: number, bookmark?: string): Promise<{ adAccounts: AdAccount[]; bookmark: string | null }> {
  const qs = new URLSearchParams({ page_size: String(pageSize) });
  if (bookmark) qs.set("bookmark", bookmark);
  const data = rec(await pinterestGet(accessToken, `/ad_accounts?${qs.toString()}`));
  return { adAccounts: arr(data.items).map(toAdAccount).filter((a) => a.id), bookmark: str(data.bookmark) };
}

const epochSecondsToIso = (v: unknown): string | null => {
  const n = num(v);
  return n === null ? null : new Date(n * 1000).toISOString();
};

/** Spend caps are returned in micro-currency (1,000,000 = one unit of the ad account currency); epoch times become ISO strings. */
function toCampaign(e: unknown) {
  const c = rec(e);
  return {
    id: str(c.id) ?? "",
    name: str(c.name) ?? "",
    status: str(c.status),
    summary_status: str(c.summary_status),
    objective_type: str(c.objective_type),
    daily_spend_cap: num(c.daily_spend_cap),
    lifetime_spend_cap: num(c.lifetime_spend_cap),
    start_time: epochSecondsToIso(c.start_time),
    end_time: epochSecondsToIso(c.end_time),
    created_time: epochSecondsToIso(c.created_time),
    updated_time: epochSecondsToIso(c.updated_time),
  };
}

function toAnalyticsRow(e: unknown) {
  const r = rec(e);
  return {
    date: str(r.DATE),
    SPEND_IN_DOLLAR: num(r.SPEND_IN_DOLLAR) ?? 0,
    IMPRESSION_1: num(r.IMPRESSION_1) ?? 0,
    CLICKTHROUGH_1: num(r.CLICKTHROUGH_1) ?? 0,
    TOTAL_CONVERSIONS: num(r.TOTAL_CONVERSIONS) ?? 0,
  };
}

/* --------------------------------- actions --------------------------------- */

const testAction: ActionHandler = async (ctx) => {
  const user = toUser(await pinterestGet(ctx.accessToken, "/user_account"));
  return { ok: true, user, connectedAccount: ctx.connection.accountId, apiVersion: API_VERSION };
};

const accountsAction: ActionHandler = async (ctx, params) => {
  const limit = limitParam(params);
  const result = await listAdAccounts(ctx.accessToken, limit, optString(params, "bookmark"));
  return { accounts: result.adAccounts, count: result.adAccounts.length, limit, bookmark: result.bookmark };
};

const campaignsAction: ActionHandler = async (ctx, params) => {
  const account = adAccountParam(ctx, params);
  const limit = limitParam(params);
  const qs = new URLSearchParams({ page_size: String(limit) });
  const bookmark = optString(params, "bookmark");
  if (bookmark) qs.set("bookmark", bookmark);
  const status = optString(params, "status");
  if (status) {
    const statuses = status.toUpperCase().split(",").map((s) => s.trim()).filter(Boolean);
    const bad = statuses.find((s) => !CAMPAIGN_STATUSES.includes(s));
    if (bad || !statuses.length) throw new IntegrationApiError(`Parameter "status" must be one or more of ${CAMPAIGN_STATUSES.join(", ")}`, 400);
    qs.set("entity_statuses", statuses.join(","));
  }
  const data = rec(await pinterestGet(ctx.accessToken, `/ad_accounts/${account}/campaigns?${qs.toString()}`));
  const list = arr(data.items).map(toCampaign);
  return {
    account,
    campaigns: list,
    count: list.length,
    limit,
    bookmark: str(data.bookmark),
    units: "daily_spend_cap and lifetime_spend_cap are in micro-currency (1,000,000 = 1 unit of the ad account currency)",
  };
};

const analyticsAction: ActionHandler = async (ctx, params) => {
  const account = adAccountParam(ctx, params);
  const limit = limitParam(params);
  const range = dateWindow(params);
  const qs = new URLSearchParams({
    start_date: range.start,
    end_date: range.end,
    columns: ANALYTICS_COLUMNS.join(","),
    granularity: "DAY",
  });
  const data = await pinterestGet(ctx.accessToken, `/ad_accounts/${account}/analytics?${qs.toString()}`);
  const rows = arr(Array.isArray(data) ? data : rec(data).items)
    .map(toAnalyticsRow)
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  const summary = rows.reduce(
    (acc, r) => ({
      SPEND_IN_DOLLAR: acc.SPEND_IN_DOLLAR + r.SPEND_IN_DOLLAR,
      IMPRESSION_1: acc.IMPRESSION_1 + r.IMPRESSION_1,
      CLICKTHROUGH_1: acc.CLICKTHROUGH_1 + r.CLICKTHROUGH_1,
      TOTAL_CONVERSIONS: acc.TOTAL_CONVERSIONS + r.TOTAL_CONVERSIONS,
    }),
    { SPEND_IN_DOLLAR: 0, IMPRESSION_1: 0, CLICKTHROUGH_1: 0, TOTAL_CONVERSIONS: 0 }
  );
  summary.SPEND_IN_DOLLAR = Math.round(summary.SPEND_IN_DOLLAR * 100) / 100;
  return {
    account,
    dateRange: { start: range.start, end: range.end, days: range.days },
    granularity: "DAY",
    columns: ANALYTICS_COLUMNS,
    summary,
    rows: rows.slice(0, limit),
    count: Math.min(rows.length, limit),
    total: rows.length,
    truncated: rows.length > limit,
  };
};

/* --------------------------------- provider -------------------------------- */

export const provider: IntegrationProvider = {
  id: "pinterest_ads",
  async identify({ tokens }): Promise<AccountIdentity> {
    const user = toUser(await pinterestGet(tokens.accessToken, "/user_account"));
    const { adAccounts } = await listAdAccounts(tokens.accessToken, 25);
    const first = adAccounts[0];
    const fallback = user.username || "pinterest";
    return {
      accountId: first?.id || fallback,
      accountName: first?.name || fallback,
      metadata: { username: user.username, businessName: user.business_name, adAccounts, apiVersion: API_VERSION },
    };
  },
  actions: {
    test: testAction,
    accounts: accountsAction,
    campaigns: campaignsAction,
    analytics: analyticsAction,
  },
};
