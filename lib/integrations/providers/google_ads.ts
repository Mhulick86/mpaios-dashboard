/**
 * Google Ads provider: account discovery plus campaign and daily account
 * metrics through the Google Ads REST API (GAQL via googleAds:search).
 *
 * Every request carries the developer token (GOOGLE_ADS_DEVELOPER_TOKEN) and,
 * when set, GOOGLE_ADS_LOGIN_CUSTOMER_ID (the agency manager / MCC id, digits
 * only) as the login-customer-id header so client accounts under that manager
 * can be read. Tokens arrive through ctx.accessToken; nothing here is logged.
 *
 * Money comes back from Google in micros; every row carries both the raw
 * micros and the value in the account currency (micros / 1e6).
 */
import "server-only";
import { apiFetch, IntegrationApiError, IntegrationConfigError, type TokenSet } from "../oauth";
import type { AccountIdentity, ActionContext, ActionHandler, ActionParams, IntegrationProvider } from "../types";

/** Google Ads API version; override with GOOGLE_ADS_API_VERSION (e.g. "v21"). */
const GOOGLE_ADS_API_VERSION = (process.env.GOOGLE_ADS_API_VERSION || "v20").trim().replace(/^\/+|\/+$/g, "");
const BASE_URL = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}`;
const PROVIDER = "Google Ads";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const DEFAULT_DAYS = 30;
/** Campaign totals may span up to a year; daily rows are a list and capped like one. */
const MAX_CAMPAIGN_RANGE_DAYS = 366;
const MAX_DAILY_ROWS = MAX_LIMIT;
const CONCURRENCY = 4;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** GAQL only defines these relative ranges (there is no LAST_90_DAYS); other spans use an explicit BETWEEN. */
const DURING_KEYWORDS: Record<number, string> = { 7: "LAST_7_DAYS", 14: "LAST_14_DAYS", 30: "LAST_30_DAYS" };
const CAMPAIGN_STATUSES = ["ENABLED", "PAUSED", "REMOVED"];
const CUSTOMER_QUERY =
  "SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.time_zone, customer.manager, customer.status FROM customer";

// ---------------------------------------------------------------------------
// Response shapes (REST returns camelCase; int64 fields arrive as strings)
// ---------------------------------------------------------------------------

interface MetricsFields {
  impressions?: string | number;
  clicks?: string | number;
  costMicros?: string | number;
  conversions?: number;
  conversionsValue?: number;
}
interface CustomerFields {
  id?: string;
  descriptiveName?: string;
  currencyCode?: string;
  timeZone?: string;
  manager?: boolean;
  status?: string;
}
interface CustomerRow {
  customer?: CustomerFields;
}
interface CustomerClientRow {
  customerClient?: CustomerFields & { level?: string | number };
}
interface CampaignRow {
  campaign?: { id?: string; name?: string; status?: string; advertisingChannelType?: string };
  campaignBudget?: { amountMicros?: string };
  metrics?: MetricsFields;
}
interface DailyRow {
  segments?: { date?: string };
  metrics?: MetricsFields;
}
interface SearchResponse<T> {
  results?: T[];
}
interface AdsErrorBody {
  error?: {
    message?: string;
    status?: string;
    details?: Array<{ errors?: Array<{ errorCode?: Record<string, string>; message?: string }> }>;
  };
}
interface CustomerSummary {
  id: string;
  name: string;
  descriptiveName: string | null;
  currencyCode: string | null;
  timeZone: string | null;
  manager: boolean;
  status: string | null;
}
interface AccountRow extends CustomerSummary {
  /** direct = the Google user has access itself; client = reached through a manager account. */
  access: "direct" | "client";
  parentId: string | null;
  error?: string;
}
interface DateRange {
  start: string;
  end: string;
  days: number;
  /** Set when the range maps onto a GAQL relative keyword. */
  during: string | null;
}

// ---------------------------------------------------------------------------
// Parameter validation
// ---------------------------------------------------------------------------

function strParam(params: ActionParams, key: string): string | undefined {
  const v = params[key];
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string" && typeof v !== "number") throw new IntegrationApiError(`Parameter "${key}" must be a string`, 400);
  const s = String(v).trim();
  return s || undefined;
}

function intParam(params: ActionParams, key: string, fallback: number, min: number, max: number): number {
  const v = params[key];
  if (v === undefined || v === null || v === "") return fallback;
  const n = typeof v === "number" ? v : Number(String(v).trim());
  if (!Number.isFinite(n)) throw new IntegrationApiError(`Parameter "${key}" must be a number`, 400);
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

function enumParam(params: ActionParams, key: string, allowed: string[]): string | undefined {
  const v = strParam(params, key);
  if (!v) return undefined;
  const upper = v.toUpperCase();
  if (!allowed.includes(upper)) throw new IntegrationApiError(`Parameter "${key}" must be one of ${allowed.join(", ")}`, 400);
  return upper;
}

function limitParam(params: ActionParams): number {
  return intParam(params, "limit", DEFAULT_LIMIT, 1, MAX_LIMIT);
}

/** Accepts 1234567890, 123-456-7890 or customers/1234567890 and returns the digits (safe to interpolate). */
function normaliseCustomerId(raw: string, what: string): string {
  const digits = raw.trim().replace(/^customers\//, "").replace(/-/g, "");
  if (!/^\d{1,20}$/.test(digits)) {
    throw new IntegrationApiError(`${what} must be a Google Ads customer id such as 123-456-7890`, 400);
  }
  return digits;
}

function formatCustomerId(id: string): string {
  return /^\d{10}$/.test(id) ? `${id.slice(0, 3)}-${id.slice(3, 6)}-${id.slice(6)}` : id;
}

function customerParam(ctx: ActionContext, params: ActionParams): string {
  const explicit = strParam(params, "customer");
  return explicit
    ? normaliseCustomerId(explicit, 'Parameter "customer"')
    : normaliseCustomerId(ctx.connection.accountId, 'The connected account id (pass "customer" to pick another account)');
}

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/**
 * start/end (YYYY-MM-DD) win; otherwise `days` (default 30) ending yesterday,
 * which matches the semantics of GAQL's LAST_N_DAYS keywords.
 */
function resolveRange(params: ActionParams, maxDays: number): DateRange {
  const start = strParam(params, "start");
  const end = strParam(params, "end");
  if (start || end) {
    if (!start || !end) throw new IntegrationApiError('Pass both "start" and "end" (YYYY-MM-DD), or "days"', 400);
    for (const [key, value] of [["start", start], ["end", end]] as const) {
      if (!DATE_RE.test(value) || Number.isNaN(Date.parse(value))) {
        throw new IntegrationApiError(`Parameter "${key}" must be a date formatted YYYY-MM-DD`, 400);
      }
    }
    const days = Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000) + 1;
    if (days < 1) throw new IntegrationApiError('"start" must not be after "end"', 400);
    if (days > maxDays) throw new IntegrationApiError(`Date range must cover at most ${maxDays} days`, 400);
    return { start, end, days, during: null };
  }
  const days = intParam(params, "days", DEFAULT_DAYS, 1, maxDays);
  return { start: isoDaysAgo(days), end: isoDaysAgo(1), days, during: DURING_KEYWORDS[days] ?? null };
}

// ---------------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------------

function num(v: unknown): number {
  const n = typeof v === "number" ? v : v === undefined || v === null || v === "" ? 0 : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function round(n: number, places: number): number {
  const f = 10 ** places;
  return Math.round(n * f) / f;
}

function mapMetrics(m: MetricsFields | undefined) {
  const impressions = num(m?.impressions);
  const clicks = num(m?.clicks);
  const costMicros = num(m?.costMicros);
  const cost = costMicros / 1_000_000;
  const conversions = round(num(m?.conversions), 2);
  const conversionsValue = round(num(m?.conversionsValue), 2);
  return {
    impressions,
    clicks,
    costMicros,
    cost,
    conversions,
    conversionsValue,
    ctr: impressions ? round(clicks / impressions, 4) : 0,
    averageCpc: clicks ? round(cost / clicks, 2) : 0,
    costPerConversion: conversions ? round(cost / conversions, 2) : 0,
    roas: cost ? round(conversionsValue / cost, 2) : 0,
  };
}

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------

function loginCustomerId(): string | null {
  const digits = (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || "").replace(/\D/g, "");
  return digits || null;
}

function adsHeaders(withLoginCustomer: boolean): Record<string, string> {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim();
  if (!developerToken) throw new IntegrationConfigError(["GOOGLE_ADS_DEVELOPER_TOKEN"]);
  const headers: Record<string, string> = { "developer-token": developerToken };
  const login = loginCustomerId();
  if (withLoginCustomer && login) headers["login-customer-id"] = login;
  return headers;
}

function adsFailures(e: IntegrationApiError): Array<{ code: string | undefined; message: string | undefined }> {
  const body = (e.details ?? {}) as AdsErrorBody;
  return (body.error?.details ?? [])
    .flatMap((d) => d.errors ?? [])
    .map((f) => ({ code: Object.values(f.errorCode ?? {})[0], message: f.message }));
}

/** Rewrites Google's generic top-level message into the GoogleAdsFailure detail plus a fix hint. */
function describe(e: IntegrationApiError): IntegrationApiError {
  const failures = adsFailures(e);
  const codes = failures.map((f) => f.code).filter((c): c is string => typeof c === "string");
  const hints: string[] = [];
  if (codes.some((c) => c.startsWith("DEVELOPER_TOKEN"))) {
    hints.push("check GOOGLE_ADS_DEVELOPER_TOKEN and its access level in the Google Ads API Center");
  }
  if (codes.includes("USER_PERMISSION_DENIED")) {
    hints.push("the Google user cannot access this customer; for accounts under an agency manager set GOOGLE_ADS_LOGIN_CUSTOMER_ID to the manager id");
  }
  if (codes.includes("REQUESTED_METRICS_FOR_MANAGER")) {
    hints.push("metrics cannot be read from a manager (MCC) account; pass customer=<client account id>");
  }
  if (codes.includes("CUSTOMER_NOT_FOUND") || codes.includes("INVALID_CUSTOMER_ID")) hints.push("check the customer id");
  if (e.status === 401) hints.push("the Google token was rejected; reconnect Google Ads from the Integrations page");
  const detail = failures.map((f) => [f.code, f.message].filter(Boolean).join(": ")).filter(Boolean);
  const message = `${PROVIDER}: ${detail.length ? detail.join("; ") : e.message}${hints.length ? ` (${hints.join("; ")})` : ""}`;
  return new IntegrationApiError(message, e.status, e.details);
}

async function adsRequest<T>(accessToken: string, path: string, body?: unknown, opts: { loginCustomer?: boolean } = {}): Promise<T> {
  const attempt = (withLogin: boolean) =>
    apiFetch<T>(`${BASE_URL}/${path}`, {
      accessToken,
      providerName: PROVIDER,
      method: body === undefined ? "GET" : "POST",
      headers: adsHeaders(withLogin),
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  const withLogin = opts.loginCustomer !== false && loginCustomerId() !== null;
  try {
    return await attempt(withLogin);
  } catch (e) {
    if (!(e instanceof IntegrationApiError)) throw e;
    // A configured manager id that does not sit above this customer is rejected outright;
    // fall back to the user's own access before giving up.
    if (withLogin && adsFailures(e).some((f) => f.code === "USER_PERMISSION_DENIED")) {
      try {
        return await attempt(false);
      } catch {
        /* report the original error below */
      }
    }
    throw describe(e);
  }
}

async function search<T>(accessToken: string, customer: string, query: string): Promise<T[]> {
  const res = await adsRequest<SearchResponse<T>>(accessToken, `customers/${customer}/googleAds:search`, { query });
  return res.results ?? [];
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Request failed";
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Customer ids the OAuth user can reach directly (no login-customer-id: this call is about the user). */
async function listAccessibleCustomers(accessToken: string): Promise<string[]> {
  const res = await adsRequest<{ resourceNames?: string[] }>(accessToken, "customers:listAccessibleCustomers", undefined, { loginCustomer: false });
  return (res.resourceNames ?? []).map((n) => n.replace(/^customers\//, "")).filter((id) => /^\d+$/.test(id));
}

function summarise(c: CustomerFields, fallbackId: string): CustomerSummary {
  const id = c.id ? String(c.id) : fallbackId;
  return {
    id,
    name: c.descriptiveName || `Google Ads ${formatCustomerId(id)}`,
    descriptiveName: c.descriptiveName ?? null,
    currencyCode: c.currencyCode ?? null,
    timeZone: c.timeZone ?? null,
    manager: Boolean(c.manager),
    status: c.status ?? null,
  };
}

async function customerDetails(accessToken: string, id: string): Promise<CustomerSummary> {
  const rows = await search<CustomerRow>(accessToken, id, CUSTOMER_QUERY);
  return summarise(rows[0]?.customer ?? {}, id);
}

/** Accounts under a manager (up to two levels deep, e.g. MCC -> sub-MCC -> client). */
async function listClientAccounts(accessToken: string, managerId: string, limit: number): Promise<AccountRow[]> {
  const query =
    "SELECT customer_client.id, customer_client.descriptive_name, customer_client.currency_code, customer_client.time_zone, " +
    `customer_client.manager, customer_client.status, customer_client.level FROM customer_client WHERE customer_client.level <= 2 LIMIT ${limit + 1}`;
  const rows = await search<CustomerClientRow>(accessToken, managerId, query);
  return rows
    .map((r) => r.customerClient ?? {})
    .filter((c) => c.id && String(c.id) !== managerId)
    .map((c) => ({ ...summarise(c, String(c.id)), access: "client" as const, parentId: managerId }));
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

async function identify({ tokens }: { tokens: TokenSet }): Promise<AccountIdentity> {
  const customers = await listAccessibleCustomers(tokens.accessToken);
  if (!customers.length) {
    throw new IntegrationApiError(
      "This Google user has no accessible Google Ads accounts. Connect with a user that can open at least one Google Ads account (or the agency manager account).",
      400
    );
  }
  const primary = customers[0];
  let accountName = `Google Ads ${formatCustomerId(primary)}`;
  const metadata: Record<string, unknown> = {
    accessibleCustomers: customers,
    apiVersion: GOOGLE_ADS_API_VERSION,
    loginCustomerId: loginCustomerId(),
  };
  try {
    const details = await customerDetails(tokens.accessToken, primary);
    accountName = details.name;
    Object.assign(metadata, {
      descriptiveName: details.descriptiveName,
      currencyCode: details.currencyCode,
      timeZone: details.timeZone,
      manager: details.manager,
      status: details.status,
    });
  } catch {
    // Best effort: a test-only developer token or a pending API access level can reject this query
    // while the connection itself is still valid.
  }
  return { accountId: primary, accountName, metadata };
}

const actions: Record<string, ActionHandler> = {
  /** Cheapest possible round trip: which customers can this token see? */
  async test(ctx) {
    const customers = await listAccessibleCustomers(ctx.accessToken);
    return {
      ok: true,
      apiVersion: GOOGLE_ADS_API_VERSION,
      loginCustomerId: loginCustomerId(),
      connectedCustomer: ctx.connection.accountId,
      customers,
    };
  },

  /** Details for every accessible customer, expanding manager accounts into their client accounts. */
  async accounts(ctx, params) {
    const limit = limitParam(params);
    const direct = (await listAccessibleCustomers(ctx.accessToken)).slice(0, limit);
    const groups = await mapLimit(direct, CONCURRENCY, async (id): Promise<AccountRow[]> => {
      try {
        const row: AccountRow = { ...(await customerDetails(ctx.accessToken, id)), access: "direct", parentId: null };
        if (!row.manager) return [row];
        try {
          return [row, ...(await listClientAccounts(ctx.accessToken, id, limit))];
        } catch (e) {
          return [{ ...row, error: `Could not list client accounts: ${errorMessage(e)}` }];
        }
      } catch (e) {
        return [
          {
            id,
            name: `Google Ads ${formatCustomerId(id)}`,
            descriptiveName: null,
            currencyCode: null,
            timeZone: null,
            manager: false,
            status: null,
            access: "direct",
            parentId: null,
            error: errorMessage(e),
          },
        ];
      }
    });
    const seen = new Set<string>();
    const accounts: AccountRow[] = [];
    for (const row of groups.flat()) {
      if (seen.has(row.id) || accounts.length >= limit) continue;
      seen.add(row.id);
      accounts.push(row);
    }
    return { count: accounts.length, accessibleCustomers: direct, accounts };
  },

  /** Campaigns with period totals, most spend first. Params: customer, days | start+end, status, limit. */
  async campaigns(ctx, params) {
    const customer = customerParam(ctx, params);
    const limit = limitParam(params);
    const range = resolveRange(params, MAX_CAMPAIGN_RANGE_DAYS);
    const status = enumParam(params, "status", CAMPAIGN_STATUSES);
    const where = [
      range.during ? `segments.date DURING ${range.during}` : `segments.date BETWEEN '${range.start}' AND '${range.end}'`,
      ...(status ? [`campaign.status = '${status}'`] : []),
    ].join(" AND ");
    const query =
      "SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type, campaign_budget.amount_micros, " +
      "metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value " +
      `FROM campaign WHERE ${where} ORDER BY metrics.cost_micros DESC LIMIT ${limit}`;
    const rows = await search<CampaignRow>(ctx.accessToken, customer, query);
    const campaigns = rows.map((r) => {
      const budgetMicros = num(r.campaignBudget?.amountMicros);
      return {
        id: r.campaign?.id ?? null,
        name: r.campaign?.name ?? null,
        status: r.campaign?.status ?? null,
        channelType: r.campaign?.advertisingChannelType ?? null,
        budgetMicros,
        budget: budgetMicros / 1_000_000,
        ...mapMetrics(r.metrics),
      };
    });
    return {
      customer,
      dateRange: { start: range.start, end: range.end, days: range.days, gaql: range.during ?? "BETWEEN" },
      count: campaigns.length,
      campaigns,
    };
  },

  /** Account-level totals per day plus a rollup. Params: customer, days | start+end. */
  async metrics(ctx, params) {
    const customer = customerParam(ctx, params);
    const range = resolveRange(params, MAX_DAILY_ROWS);
    const query =
      "SELECT segments.date, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value " +
      `FROM customer WHERE segments.date BETWEEN '${range.start}' AND '${range.end}' ORDER BY segments.date ASC LIMIT ${range.days}`;
    const rows = await search<DailyRow>(ctx.accessToken, customer, query);
    const daily = rows.map((r) => ({ date: r.segments?.date ?? null, ...mapMetrics(r.metrics) }));
    const sums = daily.reduce(
      (acc, d) => ({
        impressions: acc.impressions + d.impressions,
        clicks: acc.clicks + d.clicks,
        costMicros: acc.costMicros + d.costMicros,
        conversions: acc.conversions + d.conversions,
        conversionsValue: acc.conversionsValue + d.conversionsValue,
      }),
      { impressions: 0, clicks: 0, costMicros: 0, conversions: 0, conversionsValue: 0 }
    );
    return {
      customer,
      dateRange: { start: range.start, end: range.end, days: range.days },
      totals: mapMetrics(sums),
      daily,
    };
  },
};

export const provider: IntegrationProvider = {
  id: "google_ads",
  identify,
  actions,
};
