/**
 * LinkedIn Ads — Marketing API (versioned REST endpoints, Rest.li 2.0 protocol).
 * Docs: https://learn.microsoft.com/en-us/linkedin/marketing/
 *
 * OAuth is the standard authorization-code flow, so the generic helpers in
 * lib/integrations/oauth.ts do the code exchange and the refresh_token grant
 * (LinkedIn only issues refresh tokens once "programmatic refresh" is enabled
 * for the app). Every API request must carry `LinkedIn-Version` (YYYYMM) and
 * `X-Restli-Protocol-Version: 2.0.0`.
 *
 * Action params (query string on GET, JSON body on POST):
 *   account / adAccount   ad account id or sponsoredAccount URN (defaults to the connected account)
 *   limit                 page size — default 50, max 200
 *   pageToken             continuation token returned by a previous accounts/campaigns call
 *   days | start, end     analytics window — default last 30 days, max 365 (YYYY-MM-DD, UTC)
 */
import "server-only";
import { apiFetch, IntegrationApiError } from "../oauth";
import type { AccountIdentity, ActionContext, ActionHandler, ActionParams, IntegrationProvider } from "../types";

const PROVIDER = "LinkedIn Ads";
/** Marketing API version header (YYYYMM). LinkedIn supports each version for ~12 months; bump via env. */
const API_VERSION = process.env.LINKEDIN_API_VERSION || "202506";
const BASE = (process.env.LINKEDIN_API_BASE || "https://api.linkedin.com/rest").replace(/\/+$/, "");
const RESTLI_HEADERS: Record<string, string> = { "LinkedIn-Version": API_VERSION, "X-Restli-Protocol-Version": "2.0.0" };
const ANALYTICS_FIELDS = ["dateRange", "impressions", "clicks", "costInLocalCurrency", "externalWebsiteConversions", "pivotValues"];
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
    if (days > MAX_DAYS) throw new IntegrationApiError(`Date range must cover at most ${MAX_DAYS} days`, 400);
    return { start: isoDay(startDate), end: isoDay(endDate), days };
  }
  const days = optInt(params, "days", DEFAULT_DAYS, 1, MAX_DAYS);
  const endDate = todayUtc();
  return { start: isoDay(addDays(endDate, -(days - 1))), end: isoDay(endDate), days };
}

function adAccountParam(ctx: ActionContext, params: ActionParams): string {
  const raw = optString(params, "adAccount") ?? optString(params, "ad_account") ?? optString(params, "account") ?? ctx.connection.accountId;
  const id = raw.replace(/^urn:li:sponsoredAccount:/i, "");
  if (!/^\d{1,20}$/.test(id)) {
    throw new IntegrationApiError(
      `LinkedIn ad account id must be numeric (got "${raw}"); pick one from the accounts action and pass adAccount=<id>`,
      400
    );
  }
  return id;
}

/* -------------------------------- API calls -------------------------------- */

async function linkedinGet(accessToken: string, pathAndQuery: string): Promise<Json> {
  const data = await apiFetch<unknown>(`${BASE}${pathAndQuery}`, { accessToken, providerName: PROVIDER, headers: RESTLI_HEADERS });
  return rec(data);
}

const nextPageToken = (data: Json): string | null => str(rec(data.metadata).nextPageToken);

function toAccount(e: unknown) {
  const a = rec(e);
  return {
    id: str(a.id) ?? "",
    name: str(a.name) ?? "",
    currency: str(a.currency),
    status: str(a.status),
    type: str(a.type),
    test: a.test === true,
    reference: str(a.reference),
  };
}
type Account = ReturnType<typeof toAccount>;

/** GET /adAccounts?q=search — every ad account the member can access. */
async function searchAccounts(accessToken: string, pageSize: number, pageToken?: string): Promise<{ accounts: Account[]; nextPageToken: string | null }> {
  const qs = new URLSearchParams({ q: "search", pageSize: String(pageSize) });
  if (pageToken) qs.set("pageToken", pageToken);
  const data = await linkedinGet(accessToken, `/adAccounts?${qs.toString()}`);
  return { accounts: arr(data.elements).map(toAccount).filter((a) => a.id), nextPageToken: nextPageToken(data) };
}

function money(v: unknown): { amount: number | null; currencyCode: string | null } | null {
  const m = rec(v);
  return "amount" in m || "currencyCode" in m ? { amount: num(m.amount), currencyCode: str(m.currencyCode) } : null;
}

const epochToIso = (v: unknown): string | null => {
  const n = num(v);
  return n === null ? null : new Date(n).toISOString();
};

function toCampaign(e: unknown) {
  const c = rec(e);
  const schedule = rec(c.runSchedule);
  return {
    id: str(c.id) ?? "",
    name: str(c.name) ?? "",
    status: str(c.status),
    type: str(c.type),
    objectiveType: str(c.objectiveType),
    format: str(c.format),
    costType: str(c.costType),
    dailyBudget: money(c.dailyBudget),
    totalBudget: money(c.totalBudget),
    unitCost: money(c.unitCost),
    runSchedule: { start: epochToIso(schedule.start), end: epochToIso(schedule.end) },
    campaignGroup: str(c.campaignGroup),
    account: str(c.account),
  };
}

function ymd(d: Json): string | null {
  const y = num(d.year);
  const m = num(d.month);
  const day = num(d.day);
  if (y === null || m === null || day === null) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function toAnalyticsRow(e: unknown) {
  const r = rec(e);
  const pivot = str(arr(r.pivotValues)[0]);
  return {
    date: ymd(rec(rec(r.dateRange).start)),
    campaignId: pivot ? pivot.slice(pivot.lastIndexOf(":") + 1) : null,
    campaignUrn: pivot,
    impressions: num(r.impressions) ?? 0,
    clicks: num(r.clicks) ?? 0,
    costInLocalCurrency: num(r.costInLocalCurrency) ?? 0,
    externalWebsiteConversions: num(r.externalWebsiteConversions) ?? 0,
  };
}

/** Rest.li 2.0 date literal, e.g. (year:2025,month:1,day:31). Parentheses and colons must stay unencoded. */
function restliDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `(year:${y},month:${m},day:${d})`;
}

/* --------------------------------- actions --------------------------------- */

const testAction: ActionHandler = async (ctx) => {
  const { accounts } = await searchAccounts(ctx.accessToken, 25);
  return { ok: true, accounts: accounts.length, connectedAccount: ctx.connection.accountId, apiVersion: API_VERSION };
};

const accountsAction: ActionHandler = async (ctx, params) => {
  const limit = limitParam(params);
  const result = await searchAccounts(ctx.accessToken, limit, optString(params, "pageToken"));
  return { accounts: result.accounts, count: result.accounts.length, limit, nextPageToken: result.nextPageToken };
};

const campaignsAction: ActionHandler = async (ctx, params) => {
  const account = adAccountParam(ctx, params);
  const limit = limitParam(params);
  const qs = new URLSearchParams({ q: "search", pageSize: String(limit) });
  const pageToken = optString(params, "pageToken");
  if (pageToken) qs.set("pageToken", pageToken);
  const data = await linkedinGet(ctx.accessToken, `/adAccounts/${account}/adCampaigns?${qs.toString()}`);
  const list = arr(data.elements).map(toCampaign);
  return { account, campaigns: list, count: list.length, limit, nextPageToken: nextPageToken(data) };
};

const analyticsAction: ActionHandler = async (ctx, params) => {
  const account = adAccountParam(ctx, params);
  const limit = limitParam(params);
  const range = dateWindow(params);
  // Rest.li 2.0 query syntax: dateRange/List literals go through verbatim; only the URN colons are %-encoded.
  const query =
    "q=analytics&pivot=CAMPAIGN&timeGranularity=DAILY" +
    `&dateRange=(start:${restliDate(range.start)},end:${restliDate(range.end)})` +
    `&accounts=List(urn%3Ali%3AsponsoredAccount%3A${account})` +
    `&fields=${ANALYTICS_FIELDS.join(",")}`;
  const data = await linkedinGet(ctx.accessToken, `/adAnalytics?${query}`);
  const rows = arr(data.elements)
    .map(toAnalyticsRow)
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "") || (a.campaignId ?? "").localeCompare(b.campaignId ?? ""));
  const summary = rows.reduce(
    (acc, r) => ({
      impressions: acc.impressions + r.impressions,
      clicks: acc.clicks + r.clicks,
      costInLocalCurrency: acc.costInLocalCurrency + r.costInLocalCurrency,
      externalWebsiteConversions: acc.externalWebsiteConversions + r.externalWebsiteConversions,
    }),
    { impressions: 0, clicks: 0, costInLocalCurrency: 0, externalWebsiteConversions: 0 }
  );
  summary.costInLocalCurrency = Math.round(summary.costInLocalCurrency * 100) / 100;
  return {
    account,
    dateRange: { start: range.start, end: range.end, days: range.days },
    pivot: "CAMPAIGN",
    timeGranularity: "DAILY",
    summary,
    rows: rows.slice(0, limit),
    count: Math.min(rows.length, limit),
    total: rows.length,
    truncated: rows.length > limit,
  };
};

/* --------------------------------- provider -------------------------------- */

export const provider: IntegrationProvider = {
  id: "linkedin_ads",
  async identify({ tokens }): Promise<AccountIdentity> {
    const { accounts } = await searchAccounts(tokens.accessToken, 25);
    const first = accounts[0];
    if (!first) {
      throw new IntegrationApiError(
        "LinkedIn returned no ad accounts for this member. Ask an ad account admin to give your LinkedIn user access (Viewer or above), then reconnect.",
        502
      );
    }
    return {
      accountId: first.id,
      accountName: first.name || `Ad account ${first.id}`,
      metadata: { accounts, apiVersion: API_VERSION },
    };
  },
  actions: {
    test: testAction,
    accounts: accountsAction,
    campaigns: campaignsAction,
    analytics: analyticsAction,
  },
};
