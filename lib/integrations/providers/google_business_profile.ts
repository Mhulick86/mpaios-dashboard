/**
 * Google Business Profile provider: accounts, locations, reviews and daily
 * performance for the local-growth agents.
 *
 * Four Google APIs are involved, all enabled in the Cloud project that owns
 * the shared Google OAuth client and all covered by the business.manage scope:
 *   - Account Management API           -> accounts
 *   - Business Information API         -> locations
 *   - Business Profile Performance API -> daily metrics
 *   - legacy My Business API v4        -> reviews (still the only reviews endpoint)
 *
 * Resource names: accounts look like "accounts/123", locations like
 * "locations/456"; the v4 reviews call needs the pair "accounts/123/locations/456".
 * Note that ?account= is reserved by the action route for picking the stored
 * connection, so a different Business Profile account visible to the same
 * Google user is selected with ?parent=accounts/123 (Google's own field name).
 */
import "server-only";
import { apiFetch, IntegrationApiError, type TokenSet } from "../oauth";
import type { AccountIdentity, ActionContext, ActionHandler, ActionParams, IntegrationProvider } from "../types";

/** Version of the three current Business Profile APIs; override with GBP_API_VERSION. */
const GBP_API_VERSION = (process.env.GBP_API_VERSION || "v1").trim().replace(/^\/+|\/+$/g, "");
/** Reviews only exist on the legacy My Business API; override with GBP_REVIEWS_API_VERSION. */
const GBP_REVIEWS_API_VERSION = (process.env.GBP_REVIEWS_API_VERSION || "v4").trim().replace(/^\/+|\/+$/g, "");
const ACCOUNTS_BASE = `https://mybusinessaccountmanagement.googleapis.com/${GBP_API_VERSION}`;
const INFO_BASE = `https://mybusinessbusinessinformation.googleapis.com/${GBP_API_VERSION}`;
const PERFORMANCE_BASE = `https://businessprofileperformance.googleapis.com/${GBP_API_VERSION}`;
const REVIEWS_BASE = `https://mybusiness.googleapis.com/${GBP_REVIEWS_API_VERSION}`;
const PROVIDER = "Google Business Profile";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const DEFAULT_DAYS = 30;
const MAX_DAYS = MAX_LIMIT;
/** Per-page maximums enforced by each API. */
const ACCOUNTS_PAGE_MAX = 20;
const LOCATIONS_PAGE_MAX = 100;
const REVIEWS_PAGE_MAX = 50;
const LOCATION_READ_MASK = "name,title,storefrontAddress,phoneNumbers,websiteUri,metadata,regularHours,categories";
const DEFAULT_METRICS = [
  "BUSINESS_IMPRESSIONS_DESKTOP_MAPS",
  "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
  "WEBSITE_CLICKS",
  "CALL_CLICKS",
  "BUSINESS_DIRECTION_REQUESTS",
];
const ALL_METRICS = [
  ...DEFAULT_METRICS,
  "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
  "BUSINESS_IMPRESSIONS_MOBILE_MAPS",
  "BUSINESS_CONVERSATIONS",
  "BUSINESS_BOOKINGS",
  "BUSINESS_FOOD_ORDERS",
  "BUSINESS_FOOD_MENU_CLICKS",
];
const REVIEW_ORDERINGS = ["updateTime desc", "rating", "rating desc"];
const STAR_RATINGS: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ---------------------------------------------------------------------------
// Response shapes
// ---------------------------------------------------------------------------

interface GbpAccount {
  name?: string;
  accountName?: string;
  type?: string;
  role?: string;
  verificationState?: string;
  vettedState?: string;
  accountNumber?: string;
  permissionLevel?: string;
}
interface AccountsResponse {
  accounts?: GbpAccount[];
  nextPageToken?: string;
}
interface PostalAddress {
  regionCode?: string;
  postalCode?: string;
  administrativeArea?: string;
  locality?: string;
  addressLines?: string[];
}
interface TimeOfDay {
  hours?: number;
  minutes?: number;
}
interface GbpLocation {
  name?: string;
  title?: string;
  storefrontAddress?: PostalAddress;
  phoneNumbers?: { primaryPhone?: string; additionalPhones?: string[] };
  websiteUri?: string;
  categories?: { primaryCategory?: { name?: string; displayName?: string } };
  metadata?: { placeId?: string; mapsUri?: string; newReviewUri?: string; hasVoiceOfMerchant?: boolean };
  regularHours?: { periods?: Array<{ openDay?: string; openTime?: TimeOfDay; closeDay?: string; closeTime?: TimeOfDay }> };
}
interface LocationsResponse {
  locations?: GbpLocation[];
  nextPageToken?: string;
  totalSize?: number;
}
interface Review {
  name?: string;
  reviewId?: string;
  reviewer?: { displayName?: string; profilePhotoUrl?: string; isAnonymous?: boolean };
  starRating?: string;
  comment?: string;
  createTime?: string;
  updateTime?: string;
  reviewReply?: { comment?: string; updateTime?: string };
}
interface ReviewsResponse {
  reviews?: Review[];
  averageRating?: number;
  totalReviewCount?: number;
  nextPageToken?: string;
}
interface DatedValue {
  date?: { year?: number; month?: number; day?: number };
  value?: string | number;
}
interface PerformanceResponse {
  multiDailyMetricTimeSeries?: Array<{
    dailyMetricTimeSeries?: Array<{ dailyMetric?: string; timeSeries?: { datedValues?: DatedValue[] } }>;
  }>;
}
interface GoogleErrorBody {
  error?: { code?: number; status?: string; message?: string };
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

function requireStr(params: ActionParams, key: string): string {
  const v = strParam(params, key);
  if (!v) throw new IntegrationApiError(`Missing required parameter "${key}"`, 400);
  return v;
}

function intParam(params: ActionParams, key: string, fallback: number, min: number, max: number): number {
  const v = params[key];
  if (v === undefined || v === null || v === "") return fallback;
  const n = typeof v === "number" ? v : Number(String(v).trim());
  if (!Number.isFinite(n)) throw new IntegrationApiError(`Parameter "${key}" must be a number`, 400);
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

function limitParam(params: ActionParams): number {
  return intParam(params, "limit", DEFAULT_LIMIT, 1, MAX_LIMIT);
}

function pageTokenParam(params: ActionParams): string | undefined {
  const token = strParam(params, "pageToken");
  if (token && (token.length > 2000 || /\s/.test(token))) throw new IntegrationApiError('Parameter "pageToken" is not a valid page token', 400);
  return token;
}

/** "accounts/123" or bare "123" -> "accounts/123". */
function normaliseAccount(raw: string, what: string): string {
  const trimmed = raw.trim().replace(/^\/+/, "");
  const name = /^\d+$/.test(trimmed) ? `accounts/${trimmed}` : trimmed;
  if (!/^accounts\/[A-Za-z0-9_-]+$/.test(name)) throw new IntegrationApiError(`${what} must look like "accounts/123"`, 400);
  return name;
}

/** Accepts "locations/456", "accounts/123/locations/456" or bare "456" -> "locations/456". */
function normaliseLocation(raw: string): string {
  const match = raw.match(/locations\/([A-Za-z0-9_-]+)/);
  const id = match ? match[1] : /^\d+$/.test(raw.trim()) ? raw.trim() : null;
  if (!id) throw new IntegrationApiError('Parameter "location" must look like "locations/456"', 400);
  return `locations/${id}`;
}

/** ?parent= picks another Business Profile account; ?account= is the stored connection (route-level). */
function accountParam(ctx: ActionContext, params: ActionParams): string {
  const parent = strParam(params, "parent");
  if (parent) return normaliseAccount(parent, 'Parameter "parent"');
  const account = strParam(params, "account");
  if (account) return normaliseAccount(account, 'Parameter "account"');
  return normaliseAccount(ctx.connection.accountId, 'The connected account (pass "parent" to pick another account)');
}

function metricsParam(params: ActionParams): string[] {
  const raw = params.metrics;
  if (raw === undefined || raw === null || raw === "") return DEFAULT_METRICS;
  const list = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(",") : null;
  if (!list) throw new IntegrationApiError('Parameter "metrics" must be a comma-separated list', 400);
  const metrics = Array.from(new Set(list.map((m) => String(m).trim().toUpperCase()).filter(Boolean)));
  const unknown = metrics.filter((m) => !ALL_METRICS.includes(m));
  if (!metrics.length || unknown.length) {
    throw new IntegrationApiError(`Parameter "metrics" may only contain ${ALL_METRICS.join(", ")}`, 400);
  }
  return metrics;
}

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/** start/end (YYYY-MM-DD) win; otherwise `days` (default 30) ending yesterday. */
function resolveRange(params: ActionParams): { start: string; end: string; days: number } {
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
    if (days > MAX_DAYS) throw new IntegrationApiError(`Date range must cover at most ${MAX_DAYS} days`, 400);
    return { start, end, days };
  }
  const days = intParam(params, "days", DEFAULT_DAYS, 1, MAX_DAYS);
  return { start: isoDaysAgo(days), end: isoDaysAgo(1), days };
}

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------

function buildUrl(base: string, path: string, query: Record<string, string | undefined> = {}): URL {
  const url = new URL(`${base}/${path}`);
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== "") url.searchParams.set(k, v);
  return url;
}

function describe(e: IntegrationApiError): IntegrationApiError {
  const body = (e.details ?? {}) as GoogleErrorBody;
  const status = body.error?.status;
  const code = body.error?.code;
  const hints: string[] = [];
  if (status === "RESOURCE_EXHAUSTED" || code === 429) {
    hints.push("Business Profile API quota exhausted; new Cloud projects have a quota of 0 until the Business Profile API access request is approved");
  } else if (status === "PERMISSION_DENIED" && /not been used|disabled|enable/i.test(e.message)) {
    hints.push("enable this API in the Google Cloud project that owns GOOGLE_CLIENT_ID");
  } else if (status === "PERMISSION_DENIED" || e.status === 403) {
    hints.push("the Google user must be an owner or manager of this Business Profile account or location");
  } else if (e.status === 401 || status === "UNAUTHENTICATED") {
    hints.push("the Google token was rejected; reconnect Google Business Profile from the Integrations page");
  } else if (status === "NOT_FOUND") {
    hints.push("check the account and location resource names");
  }
  const message = `${PROVIDER}: ${e.message}${hints.length ? ` (${hints.join("; ")})` : ""}`;
  return new IntegrationApiError(message, code === 429 ? 429 : e.status, e.details);
}

async function gbpGet<T>(accessToken: string, url: URL): Promise<T> {
  try {
    return await apiFetch<T>(url.toString(), { accessToken, providerName: PROVIDER });
  } catch (e) {
    throw e instanceof IntegrationApiError ? describe(e) : e;
  }
}

/** Walks pageToken pagination, sizing the last page so exactly `limit` items come back. */
async function paginate<T>(
  limit: number,
  pageMax: number,
  startToken: string | undefined,
  fetchPage: (pageSize: number, pageToken?: string) => Promise<{ items: T[]; nextPageToken?: string }>
): Promise<{ items: T[]; nextPageToken: string | null }> {
  const items: T[] = [];
  let token = startToken;
  while (items.length < limit) {
    const page = await fetchPage(Math.min(pageMax, limit - items.length), token);
    items.push(...page.items);
    token = page.nextPageToken || undefined;
    if (!token || !page.items.length) break;
  }
  return { items: items.slice(0, limit), nextPageToken: token ?? null };
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

function num(v: unknown): number {
  const n = typeof v === "number" ? v : v === undefined || v === null || v === "" ? 0 : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function pad(n: number | undefined): string {
  return String(n ?? 0).padStart(2, "0");
}

function mapAccount(a: GbpAccount) {
  return {
    name: a.name ?? null,
    accountName: a.accountName ?? null,
    type: a.type ?? null,
    role: a.role ?? null,
    verificationState: a.verificationState ?? null,
    vettedState: a.vettedState ?? null,
    permissionLevel: a.permissionLevel ?? null,
    accountNumber: a.accountNumber ?? null,
  };
}

function formatAddress(a: PostalAddress | undefined): string | null {
  if (!a) return null;
  const parts = [...(a.addressLines ?? []), a.locality, [a.administrativeArea, a.postalCode].filter(Boolean).join(" "), a.regionCode]
    .map((s) => (s || "").trim())
    .filter(Boolean);
  return parts.join(", ") || null;
}

function formatHours(hours: GbpLocation["regularHours"]): string[] {
  const time = (t: TimeOfDay | undefined) => `${pad(t?.hours)}:${pad(t?.minutes)}`;
  return (hours?.periods ?? []).map((p) => {
    const close = p.closeDay && p.closeDay !== p.openDay ? `${p.closeDay} ${time(p.closeTime)}` : time(p.closeTime);
    return `${p.openDay ?? "?"} ${time(p.openTime)}-${close}`;
  });
}

function mapLocation(l: GbpLocation) {
  return {
    name: l.name ?? null,
    title: l.title ?? null,
    address: formatAddress(l.storefrontAddress),
    phone: l.phoneNumbers?.primaryPhone ?? null,
    additionalPhones: l.phoneNumbers?.additionalPhones ?? [],
    website: l.websiteUri ?? null,
    primaryCategory: l.categories?.primaryCategory?.displayName ?? null,
    placeId: l.metadata?.placeId ?? null,
    mapsUri: l.metadata?.mapsUri ?? null,
    newReviewUri: l.metadata?.newReviewUri ?? null,
    hours: formatHours(l.regularHours),
  };
}

function mapReview(r: Review) {
  return {
    id: r.reviewId ?? null,
    name: r.name ?? null,
    rating: r.starRating ? STAR_RATINGS[r.starRating] ?? null : null,
    starRating: r.starRating ?? null,
    comment: r.comment ?? null,
    reviewer: r.reviewer?.displayName ?? null,
    anonymous: Boolean(r.reviewer?.isAnonymous),
    createTime: r.createTime ?? null,
    updateTime: r.updateTime ?? null,
    reply: r.reviewReply ? { comment: r.reviewReply.comment ?? null, updateTime: r.reviewReply.updateTime ?? null } : null,
  };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

function listAccounts(accessToken: string, limit: number, pageToken?: string) {
  return paginate<GbpAccount>(limit, ACCOUNTS_PAGE_MAX, pageToken, async (pageSize, token) => {
    const res = await gbpGet<AccountsResponse>(accessToken, buildUrl(ACCOUNTS_BASE, "accounts", { pageSize: String(pageSize), pageToken: token }));
    return { items: res.accounts ?? [], nextPageToken: res.nextPageToken };
  });
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

async function identify({ tokens }: { tokens: TokenSet }): Promise<AccountIdentity> {
  const { items } = await listAccounts(tokens.accessToken, ACCOUNTS_PAGE_MAX);
  const first = items.find((a) => a.name);
  if (!first?.name) {
    throw new IntegrationApiError(
      "This Google user has no Business Profile accounts. Connect with a user that owns or manages the business profile (or its location group).",
      400
    );
  }
  return {
    accountId: first.name,
    accountName: first.accountName || first.name,
    metadata: {
      type: first.type ?? null,
      role: first.role ?? null,
      verificationState: first.verificationState ?? null,
      accountCount: items.length,
      accounts: items.map((a) => ({ name: a.name ?? null, accountName: a.accountName ?? null, type: a.type ?? null })),
    },
  };
}

const actions: Record<string, ActionHandler> = {
  /** Cheapest round trip: how many Business Profile accounts can this token see? */
  async test(ctx) {
    const { items, nextPageToken } = await listAccounts(ctx.accessToken, ACCOUNTS_PAGE_MAX);
    return {
      ok: true,
      apiVersion: GBP_API_VERSION,
      connectedAccount: ctx.connection.accountId,
      accountCount: items.length,
      more: Boolean(nextPageToken),
      accounts: items.slice(0, 5).map(mapAccount),
    };
  },

  /** Every account (personal, location groups, organizations) the user can manage. Params: limit, pageToken. */
  async accounts(ctx, params) {
    const { items, nextPageToken } = await listAccounts(ctx.accessToken, limitParam(params), pageTokenParam(params));
    return { count: items.length, accounts: items.map(mapAccount), nextPageToken };
  },

  /** Locations under an account. Params: parent (accounts/123), limit, pageToken. */
  async locations(ctx, params) {
    const account = accountParam(ctx, params);
    let totalSize: number | null = null;
    const { items, nextPageToken } = await paginate<GbpLocation>(limitParam(params), LOCATIONS_PAGE_MAX, pageTokenParam(params), async (pageSize, token) => {
      const url = buildUrl(INFO_BASE, `${account}/locations`, { readMask: LOCATION_READ_MASK, pageSize: String(pageSize), pageToken: token });
      const res = await gbpGet<LocationsResponse>(ctx.accessToken, url);
      if (totalSize === null && typeof res.totalSize === "number") totalSize = res.totalSize;
      return { items: res.locations ?? [], nextPageToken: res.nextPageToken };
    });
    return { account, count: items.length, totalSize, locations: items.map(mapLocation), nextPageToken };
  },

  /** Reviews for one location (legacy v4). Params: location (required), parent, orderBy, limit, pageToken. */
  async reviews(ctx, params) {
    const account = accountParam(ctx, params);
    const location = normaliseLocation(requireStr(params, "location"));
    const orderBy = strParam(params, "orderBy");
    if (orderBy && !REVIEW_ORDERINGS.includes(orderBy)) {
      throw new IntegrationApiError(`Parameter "orderBy" must be one of: ${REVIEW_ORDERINGS.join(", ")}`, 400);
    }
    let averageRating: number | null = null;
    let totalReviewCount: number | null = null;
    const { items, nextPageToken } = await paginate<Review>(limitParam(params), REVIEWS_PAGE_MAX, pageTokenParam(params), async (pageSize, token) => {
      const url = buildUrl(REVIEWS_BASE, `${account}/${location}/reviews`, { pageSize: String(pageSize), pageToken: token, orderBy });
      const res = await gbpGet<ReviewsResponse>(ctx.accessToken, url);
      if (averageRating === null && typeof res.averageRating === "number") averageRating = res.averageRating;
      if (totalReviewCount === null && typeof res.totalReviewCount === "number") totalReviewCount = res.totalReviewCount;
      return { items: res.reviews ?? [], nextPageToken: res.nextPageToken };
    });
    return { account, location, averageRating, totalReviewCount, count: items.length, reviews: items.map(mapReview), nextPageToken };
  },

  /** Daily performance metrics for one location. Params: location (required), days | start+end, metrics. */
  async performance(ctx, params) {
    const location = normaliseLocation(requireStr(params, "location"));
    const range = resolveRange(params);
    const metrics = metricsParam(params);
    const url = new URL(`${PERFORMANCE_BASE}/${location}:fetchMultiDailyMetricsTimeSeries`);
    for (const metric of metrics) url.searchParams.append("dailyMetrics", metric);
    for (const [field, date] of [["start_date", range.start], ["end_date", range.end]] as const) {
      const [year, month, day] = date.split("-");
      url.searchParams.set(`dailyRange.${field}.year`, String(Number(year)));
      url.searchParams.set(`dailyRange.${field}.month`, String(Number(month)));
      url.searchParams.set(`dailyRange.${field}.day`, String(Number(day)));
    }
    const res = await gbpGet<PerformanceResponse>(ctx.accessToken, url);

    const totals: Record<string, number> = Object.fromEntries(metrics.map((m) => [m, 0]));
    const byDate = new Map<string, Record<string, number>>();
    for (const group of res.multiDailyMetricTimeSeries ?? []) {
      for (const series of group.dailyMetricTimeSeries ?? []) {
        const metric = series.dailyMetric;
        if (!metric) continue;
        for (const point of series.timeSeries?.datedValues ?? []) {
          if (!point.date?.year) continue;
          const date = `${point.date.year}-${pad(point.date.month)}-${pad(point.date.day)}`;
          const value = num(point.value);
          totals[metric] = (totals[metric] ?? 0) + value;
          const row = byDate.get(date) ?? {};
          row[metric] = (row[metric] ?? 0) + value;
          byDate.set(date, row);
        }
      }
    }
    const series = Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, values]) => ({ date, ...Object.fromEntries(metrics.map((m) => [m, values[m] ?? 0])) }));
    const impressionMetrics = metrics.filter((m) => m.startsWith("BUSINESS_IMPRESSIONS_"));
    const impressions = impressionMetrics.length ? impressionMetrics.reduce((sum, m) => sum + (totals[m] ?? 0), 0) : null;
    return {
      location,
      dateRange: { start: range.start, end: range.end, days: range.days },
      metrics,
      totals: { ...totals, ...(impressions === null ? {} : { impressions }) },
      series,
    };
  },
};

export const provider: IntegrationProvider = {
  id: "google_business_profile",
  identify,
  actions,
};
