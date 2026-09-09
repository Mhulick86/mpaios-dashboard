/**
 * TikTok Ads — TikTok for Business Marketing API (v1.3).
 * Docs: https://business-api.tiktok.com/portal/docs
 *
 * Non-standard OAuth: the authorize URL takes app_id (no scope), the token
 * exchange is a JSON POST carrying the app secret, long-lived access tokens do
 * not expire and there is no refresh grant. Every API call authenticates with
 * an `Access-Token` header (not Bearer) and returns `{ code, message, data }`
 * where code 0 means success regardless of the HTTP status.
 *
 * Action params (query string on GET, JSON body on POST):
 *   account / advertiser_id  advertiser id (defaults to the connected advertiser)
 *   limit                    page size — default 50, max 200
 *   page                     1-based page for campaigns/report
 *   days | start, end        report window — default last 30 days, max 365 (YYYY-MM-DD, UTC)
 */
import "server-only";
import { apiFetch, IntegrationApiError, type TokenSet } from "../oauth";
import type { AccountIdentity, ActionContext, ActionHandler, ActionParams, IntegrationProvider } from "../types";

const PROVIDER = "TikTok Ads";
/** Marketing API version segment of every endpoint path. */
const API_VERSION = process.env.TIKTOK_API_VERSION || "v1.3";
const BASE = (process.env.TIKTOK_API_BASE || `https://business-api.tiktok.com/open_api/${API_VERSION}`).replace(/\/+$/, "");
const AUTHORIZE_URL = "https://business-api.tiktok.com/portal/auth";
/** advertiser/info accepts at most 100 ids per request. */
const MAX_ADVERTISERS_PER_CALL = 100;
const REPORT_DIMENSIONS = ["campaign_id", "stat_time_day"];
const REPORT_METRICS = ["spend", "impressions", "clicks", "conversion", "cpc", "ctr", "campaign_name"];
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const DEFAULT_DAYS = 30;
const MAX_DAYS = 365;
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
const idList = (v: unknown): string[] => arr(v).map((id) => (str(id) ?? "").trim()).filter(Boolean);

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
const pageParam = (params: ActionParams): number => optInt(params, "page", 1, 1, 10_000);

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
    if (days > MAX_DAYS) throw new IntegrationApiError(`Date range must cover at most ${MAX_DAYS} days`, 400);
    return { start: isoDay(startDate), end: isoDay(endDate), days };
  }
  const days = optInt(params, "days", DEFAULT_DAYS, 1, MAX_DAYS);
  const endDate = todayUtc();
  return { start: isoDay(addDays(endDate, -(days - 1))), end: isoDay(endDate), days };
}

/** The advertiser to query: explicit param, else the connected advertiser. Must be one the token was authorised for. */
function advertiserParam(ctx: ActionContext, params: ActionParams): string {
  const id = optString(params, "advertiser_id") ?? optString(params, "advertiserId") ?? optString(params, "account") ?? ctx.connection.accountId;
  if (!/^\d{1,32}$/.test(id)) throw new IntegrationApiError(`TikTok advertiser id must be numeric (got "${id}")`, 400);
  const authorised = idList(ctx.connection.metadata.advertiserIds);
  if (authorised.length && !authorised.includes(id)) {
    throw new IntegrationApiError(
      `Advertiser ${id} was not authorised for this TikTok connection (authorised: ${authorised.join(", ")}). Reconnect TikTok and select it on the authorization screen.`,
      400
    );
  }
  return id;
}

/* -------------------------------- API calls -------------------------------- */

/** Unwraps TikTok's `{ code, message, request_id, data }` envelope; code 0 is the only success. */
function unwrap(envelope: unknown, what: string): Json {
  const e = rec(envelope);
  const code = num(e.code);
  if (code === null) {
    throw new IntegrationApiError(`TikTok returned an unexpected response from ${what}`, 502, typeof envelope === "string" ? envelope.slice(0, 300) : envelope);
  }
  if (code !== 0) {
    const message = str(e.message) || "unknown error";
    const authProblem = (code >= 40100 && code < 40200) || /access[ _-]?token|not authorized|no permission/i.test(message);
    throw new IntegrationApiError(`TikTok ${what}: ${message} (code ${code})`, authProblem ? 401 : 502, { code, message, request_id: str(e.request_id) });
  }
  return rec(e.data);
}

type QueryValue = string | number | string[];

/** GET with the Access-Token header. Array values are JSON-encoded, as TikTok expects for list params. */
async function tiktokGet(accessToken: string, path: string, query: Record<string, QueryValue>): Promise<Json> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) qs.set(k, Array.isArray(v) ? JSON.stringify(v) : String(v));
  const envelope = await apiFetch<unknown>(`${BASE}${path}?${qs.toString()}`, {
    providerName: PROVIDER,
    headers: { "Access-Token": accessToken },
  });
  return unwrap(envelope, path);
}

function toAdvertiser(e: unknown) {
  const a = rec(e);
  return {
    advertiser_id: str(a.advertiser_id) ?? "",
    name: str(a.name) ?? "",
    status: str(a.status),
    currency: str(a.currency),
    timezone: str(a.timezone),
    company: str(a.company),
    country: str(a.country),
    role: str(a.role),
    advertiser_account_type: str(a.advertiser_account_type),
  };
}
type Advertiser = ReturnType<typeof toAdvertiser>;

/** GET /advertiser/info/ — names and settings for the given advertiser ids (batched by 100). */
async function advertiserInfo(accessToken: string, ids: string[]): Promise<Advertiser[]> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  const out: Advertiser[] = [];
  for (let i = 0; i < unique.length; i += MAX_ADVERTISERS_PER_CALL) {
    const data = await tiktokGet(accessToken, "/advertiser/info/", { advertiser_ids: unique.slice(i, i + MAX_ADVERTISERS_PER_CALL) });
    out.push(...arr(data.list).map(toAdvertiser));
  }
  return out;
}

function pageInfo(data: Json) {
  const p = rec(data.page_info);
  return { page: num(p.page), pageSize: num(p.page_size), totalNumber: num(p.total_number), totalPage: num(p.total_page) };
}

function toCampaign(e: unknown) {
  const c = rec(e);
  return {
    campaign_id: str(c.campaign_id) ?? "",
    campaign_name: str(c.campaign_name) ?? "",
    operation_status: str(c.operation_status),
    secondary_status: str(c.secondary_status),
    objective_type: str(c.objective_type),
    campaign_type: str(c.campaign_type),
    budget: num(c.budget),
    budget_mode: str(c.budget_mode),
    create_time: str(c.create_time),
    modify_time: str(c.modify_time),
  };
}

function toReportRow(e: unknown) {
  const r = rec(e);
  const d = rec(r.dimensions);
  const m = rec(r.metrics);
  const day = str(d.stat_time_day) ?? "";
  return {
    date: day.slice(0, 10) || null,
    campaign_id: str(d.campaign_id),
    campaign_name: str(m.campaign_name),
    spend: num(m.spend) ?? 0,
    impressions: num(m.impressions) ?? 0,
    clicks: num(m.clicks) ?? 0,
    conversion: num(m.conversion) ?? 0,
    cpc: num(m.cpc) ?? 0,
    ctr: num(m.ctr) ?? 0,
  };
}

/* ---------------------------------- OAuth ---------------------------------- */

/** POST /oauth2/access_token/ with a JSON body; the response also lists the advertisers the user authorised. */
async function exchange(args: { code: string; clientId: string; clientSecret: string }): Promise<TokenSet> {
  const envelope = await apiFetch<unknown>(`${BASE}/oauth2/access_token/`, {
    method: "POST",
    providerName: PROVIDER,
    body: JSON.stringify({ app_id: args.clientId, secret: args.clientSecret, auth_code: args.code }),
  });
  const data = unwrap(envelope, "oauth2/access_token");
  const accessToken = str(data.access_token);
  if (!accessToken) throw new IntegrationApiError("TikTok token response did not include access_token", 502);
  // Long-lived token: never expires and cannot be refreshed. raw carries what identify() needs.
  return {
    accessToken,
    refreshToken: null,
    expiresAt: null,
    scope: null,
    raw: { advertiser_ids: idList(data.advertiser_ids), scope: arr(data.scope) },
  };
}

/* --------------------------------- actions --------------------------------- */

const testAction: ActionHandler = async (ctx) => {
  const advertiserId = advertiserParam(ctx, {});
  const [advertiser] = await advertiserInfo(ctx.accessToken, [advertiserId]);
  if (!advertiser) throw new IntegrationApiError(`TikTok returned no details for advertiser ${advertiserId}; the token may have lost access to it`, 502);
  return { ok: true, advertiser, apiVersion: API_VERSION };
};

const accountsAction: ActionHandler = async (ctx, params) => {
  const limit = limitParam(params);
  const ids = idList(ctx.connection.metadata.advertiserIds);
  const all = ids.length ? ids : [ctx.connection.accountId];
  const accounts = await advertiserInfo(ctx.accessToken, all.slice(0, limit));
  return { accounts, count: accounts.length, total: all.length, limit, truncated: all.length > limit };
};

const campaignsAction: ActionHandler = async (ctx, params) => {
  const advertiserId = advertiserParam(ctx, params);
  const limit = limitParam(params);
  const page = pageParam(params);
  const data = await tiktokGet(ctx.accessToken, "/campaign/get/", { advertiser_id: advertiserId, page, page_size: limit });
  const list = arr(data.list).map(toCampaign);
  return { advertiserId, campaigns: list, count: list.length, limit, pageInfo: pageInfo(data) };
};

const reportAction: ActionHandler = async (ctx, params) => {
  const advertiserId = advertiserParam(ctx, params);
  const limit = limitParam(params);
  const page = pageParam(params);
  const range = dateWindow(params);
  const data = await tiktokGet(ctx.accessToken, "/report/integrated/get/", {
    advertiser_id: advertiserId,
    report_type: "BASIC",
    data_level: "AUCTION_CAMPAIGN",
    dimensions: REPORT_DIMENSIONS,
    metrics: REPORT_METRICS,
    start_date: range.start,
    end_date: range.end,
    page,
    page_size: limit,
  });
  const rows = arr(data.list)
    .map(toReportRow)
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "") || (a.campaign_id ?? "").localeCompare(b.campaign_id ?? ""));
  const totals = rows.reduce(
    (acc, r) => ({
      spend: acc.spend + r.spend,
      impressions: acc.impressions + r.impressions,
      clicks: acc.clicks + r.clicks,
      conversion: acc.conversion + r.conversion,
    }),
    { spend: 0, impressions: 0, clicks: 0, conversion: 0 }
  );
  const summary = {
    ...totals,
    spend: Math.round(totals.spend * 100) / 100,
    cpc: totals.clicks ? Math.round((totals.spend / totals.clicks) * 10_000) / 10_000 : 0,
    /** Percentage, matching TikTok's own ctr metric. */
    ctr: totals.impressions ? Math.round((totals.clicks / totals.impressions) * 1_000_000) / 10_000 : 0,
  };
  return {
    advertiserId,
    dateRange: { start: range.start, end: range.end, days: range.days },
    dataLevel: "AUCTION_CAMPAIGN",
    summary,
    rows,
    count: rows.length,
    limit,
    pageInfo: pageInfo(data),
  };
};

/* --------------------------------- provider -------------------------------- */

export const provider: IntegrationProvider = {
  id: "tiktok_ads",
  buildAuthorizeUrl({ definition, clientId, redirectUri, state }) {
    const base = definition.oauth?.authorizeUrl || AUTHORIZE_URL;
    // TikTok's portal appends an `rid` to the URL it generates for an app; set TIKTOK_AUTH_RID if TikTok insists on it.
    const rid = process.env.TIKTOK_AUTH_RID;
    return (
      `${base}?app_id=${encodeURIComponent(clientId)}&state=${encodeURIComponent(state)}&redirect_uri=${encodeURIComponent(redirectUri)}` +
      (rid ? `&rid=${encodeURIComponent(rid)}` : "")
    );
  },
  exchange: ({ code, clientId, clientSecret }) => exchange({ code, clientId, clientSecret }),
  async identify({ tokens }): Promise<AccountIdentity> {
    const ids = idList(rec(tokens.raw).advertiser_ids);
    if (!ids.length) {
      throw new IntegrationApiError(
        "TikTok did not return any advertiser accounts for this login. Select at least one advertiser account on the TikTok authorization screen and try again.",
        502
      );
    }
    const advertisers = await advertiserInfo(tokens.accessToken, ids);
    const first = advertisers.find((a) => a.advertiser_id === ids[0]) ?? advertisers[0];
    return {
      accountId: ids[0],
      accountName: first?.name || `Advertiser ${ids[0]}`,
      metadata: { advertiserIds: ids, advertisers, apiVersion: API_VERSION },
    };
  },
  actions: {
    test: testAction,
    accounts: accountsAction,
    campaigns: campaignsAction,
    report: reportAction,
  },
};
