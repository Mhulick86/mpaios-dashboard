/**
 * HubSpot provider: hub identity plus read-only CRM lists (contacts,
 * companies, deals) so the client-success agents see pipeline context.
 *
 * OAuth is the standard authorization-code flow; the registry's token
 * endpoint handles both exchange and refresh (access tokens last 30 minutes,
 * refresh tokens do not expire), so nothing is overridden here.
 */
import "server-only";
import { apiFetch, IntegrationApiError, type TokenSet } from "../oauth";
import type { AccountIdentity, ActionContext, ActionHandler, ActionParams, IntegrationProvider } from "../types";

const HUBSPOT_API_BASE = "https://api.hubapi.com";
/** CRM objects API version; override with HUBSPOT_CRM_API_VERSION. */
const HUBSPOT_CRM_API_VERSION = (process.env.HUBSPOT_CRM_API_VERSION || "v3").trim().replace(/^\/+|\/+$/g, "");
const PROVIDER = "HubSpot";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
/** HubSpot's own per-page ceiling for CRM list endpoints. */
const PAGE_MAX = 100;
const MAX_PROPERTIES = 50;
const PROPERTY_RE = /^[A-Za-z0-9_]+$/;

/** Default property sets per object type (HubSpot always adds hs_object_id, createdate, lastmodifieddate). */
const OBJECT_PROPERTIES: Record<CrmObjectType, string[]> = {
  contacts: ["firstname", "lastname", "email", "company", "lifecyclestage"],
  companies: ["name", "domain", "industry", "numberofemployees"],
  deals: ["dealname", "amount", "dealstage", "pipeline", "closedate"],
};
type CrmObjectType = "contacts" | "companies" | "deals";

// ---------------------------------------------------------------------------
// Response shapes
// ---------------------------------------------------------------------------

/** GET /oauth/v1/access-tokens/{token}. Also carries the token itself, which must never be echoed. */
interface TokenInfo {
  hub_id?: number;
  hub_domain?: string;
  user?: string;
  user_id?: number;
  app_id?: number;
  scopes?: string[];
  token_type?: string;
  expires_in?: number;
}
interface AccountDetails {
  portalId?: number;
  timeZone?: string;
  companyCurrency?: string;
  additionalCurrencies?: string[];
  utcOffset?: string;
  uiDomain?: string;
  dataHostingLocation?: string;
  accountType?: string;
}
interface CrmObject {
  id: string;
  properties?: Record<string, string | null>;
  createdAt?: string;
  updatedAt?: string;
  archived?: boolean;
}
interface CrmListResponse {
  results?: CrmObject[];
  paging?: { next?: { after?: string } };
}
interface HubSpotErrorBody {
  category?: string;
  message?: string;
  errors?: Array<{ message?: string }>;
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

function boolParam(params: ActionParams, key: string, fallback: boolean): boolean {
  const v = params[key];
  if (v === undefined || v === null || v === "") return fallback;
  if (typeof v === "boolean") return v;
  const s = String(v).trim().toLowerCase();
  if (["true", "1", "yes"].includes(s)) return true;
  if (["false", "0", "no"].includes(s)) return false;
  throw new IntegrationApiError(`Parameter "${key}" must be true or false`, 400);
}

function limitParam(params: ActionParams): number {
  return intParam(params, "limit", DEFAULT_LIMIT, 1, MAX_LIMIT);
}

function afterParam(params: ActionParams): string | undefined {
  const after = strParam(params, "after");
  if (after && (after.length > 500 || /\s/.test(after))) throw new IntegrationApiError('Parameter "after" is not a valid paging cursor', 400);
  return after;
}

/** Optional override of the property list: comma-separated string or JSON array of internal property names. */
function propertiesParam(params: ActionParams, fallback: string[]): string[] {
  const raw = params.properties;
  if (raw === undefined || raw === null || raw === "") return fallback;
  const list = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(",") : null;
  if (!list) throw new IntegrationApiError('Parameter "properties" must be a comma-separated list of property names', 400);
  const names = Array.from(new Set(list.map((p) => String(p).trim()).filter(Boolean)));
  if (!names.length || names.length > MAX_PROPERTIES || names.some((n) => !PROPERTY_RE.test(n))) {
    throw new IntegrationApiError(`Parameter "properties" must hold 1-${MAX_PROPERTIES} HubSpot internal property names (letters, digits, underscores)`, 400);
  }
  return names;
}

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------

function describe(e: IntegrationApiError): IntegrationApiError {
  const body = (e.details ?? {}) as HubSpotErrorBody;
  const hints: string[] = [];
  if (e.status === 401) hints.push("the access token was rejected; reconnect HubSpot from the Integrations page");
  if (body.category === "MISSING_SCOPES" || e.status === 403) hints.push("grant the missing scope to the HubSpot app, then reconnect so the new scope is authorised");
  if (body.category === "RATE_LIMITS") hints.push("HubSpot rate limit hit; retry shortly");
  const extra = (body.errors ?? []).map((x) => x.message).filter(Boolean).join("; ");
  const message = `${PROVIDER}: ${e.message}${extra ? ` - ${extra}` : ""}${hints.length ? ` (${hints.join("; ")})` : ""}`;
  return new IntegrationApiError(message, body.category === "RATE_LIMITS" ? 429 : e.status, e.details);
}

async function hubspotGet<T>(accessToken: string, url: URL): Promise<T> {
  try {
    return await apiFetch<T>(url.toString(), { accessToken, providerName: PROVIDER });
  } catch (e) {
    throw e instanceof IntegrationApiError ? describe(e) : e;
  }
}

function buildUrl(path: string, query: Record<string, string | undefined> = {}): URL {
  const url = new URL(`${HUBSPOT_API_BASE}${path}`);
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== "") url.searchParams.set(k, v);
  return url;
}

/** Walks `after` cursors, sizing the last page so exactly `limit` rows come back. */
async function paginate<T>(
  limit: number,
  startAfter: string | undefined,
  fetchPage: (pageSize: number, after?: string) => Promise<{ items: T[]; nextAfter?: string }>
): Promise<{ items: T[]; nextAfter: string | null }> {
  const items: T[] = [];
  let after = startAfter;
  while (items.length < limit) {
    const page = await fetchPage(Math.min(PAGE_MAX, limit - items.length), after);
    items.push(...page.items);
    after = page.nextAfter || undefined;
    if (!after || !page.items.length) break;
  }
  return { items: items.slice(0, limit), nextAfter: after ?? null };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

async function tokenInfo(accessToken: string): Promise<TokenInfo> {
  return hubspotGet<TokenInfo>(accessToken, buildUrl(`/oauth/v1/access-tokens/${encodeURIComponent(accessToken)}`));
}

/** Everything about the hub that is safe to return (the raw response also contains the token). */
function hubSummary(info: TokenInfo) {
  return {
    hubId: info.hub_id === undefined || info.hub_id === null ? null : String(info.hub_id),
    hubDomain: info.hub_domain ?? null,
    user: info.user ?? null,
    userId: info.user_id ?? null,
    appId: info.app_id ?? null,
    scopes: info.scopes ?? [],
    tokenType: info.token_type ?? null,
    expiresIn: info.expires_in ?? null,
  };
}

function flatten(o: CrmObject) {
  return {
    ...(o.properties ?? {}),
    id: o.id,
    createdAt: o.createdAt ?? null,
    updatedAt: o.updatedAt ?? null,
    archived: Boolean(o.archived),
  };
}

async function listObjects(ctx: ActionContext, params: ActionParams, type: CrmObjectType) {
  const properties = propertiesParam(params, OBJECT_PROPERTIES[type]);
  const archived = boolParam(params, "archived", false);
  const { items, nextAfter } = await paginate<CrmObject>(limitParam(params), afterParam(params), async (pageSize, after) => {
    const url = buildUrl(`/crm/${HUBSPOT_CRM_API_VERSION}/objects/${type}`, {
      limit: String(pageSize),
      after,
      properties: properties.join(","),
      archived: archived ? "true" : undefined,
    });
    const res = await hubspotGet<CrmListResponse>(ctx.accessToken, url);
    return { items: res.results ?? [], nextAfter: res.paging?.next?.after };
  });
  return { object: type, count: items.length, properties, results: items.map(flatten), nextAfter };
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

async function identify({ tokens }: { tokens: TokenSet }): Promise<AccountIdentity> {
  const info = await tokenInfo(tokens.accessToken);
  if (info.hub_id === undefined || info.hub_id === null) {
    throw new IntegrationApiError("HubSpot did not report a hub (portal) id for this token; try connecting again", 502);
  }
  return {
    accountId: String(info.hub_id),
    accountName: info.hub_domain || `HubSpot ${info.hub_id}`,
    metadata: {
      user: info.user ?? null,
      userId: info.user_id ?? null,
      appId: info.app_id ?? null,
      scopes: info.scopes ?? [],
    },
  };
}

const actions: Record<string, ActionHandler> = {
  /** Validates the token and reports which hub it belongs to. */
  async test(ctx) {
    return { ok: true, hub: hubSummary(await tokenInfo(ctx.accessToken)) };
  },

  /** Hub identity plus portal details (time zone, currency) when the token can read them. */
  async account(ctx) {
    const hub = hubSummary(await tokenInfo(ctx.accessToken));
    let details: AccountDetails | null = null;
    let detailsError: string | null = null;
    try {
      details = await hubspotGet<AccountDetails>(ctx.accessToken, buildUrl("/account-info/v3/details"));
    } catch (e) {
      detailsError = e instanceof Error ? e.message : "Could not read account details";
    }
    return { ok: true, hub, details, detailsError };
  },

  /** Params for the three lists: limit (<=200), after (cursor), properties (override), archived. */
  contacts: (ctx, params) => listObjects(ctx, params, "contacts"),
  companies: (ctx, params) => listObjects(ctx, params, "companies"),
  deals: (ctx, params) => listObjects(ctx, params, "deals"),
};

export const provider: IntegrationProvider = {
  id: "hubspot",
  identify,
  actions,
};
