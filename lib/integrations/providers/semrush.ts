/**
 * Semrush — Analytics API (API-key platform, no OAuth).
 * Docs: https://developer.semrush.com/api/
 *
 * Reports come back as CSV with ";" separators and a header row; failures are
 * plain-text bodies such as "ERROR 50 :: NOTHING FOUND" (usually with HTTP
 * 200), so these calls use fetch directly instead of apiFetch. Every returned
 * line costs API units (10 per line for the reports below). The key is only
 * ever placed in the request URL, never in error messages or details.
 *
 * Action params (query string on GET, JSON body on POST):
 *   domain      required for domain_overview (host name, e.g. example.com)
 *   phrase      required for keyword_overview (the keyword to look up)
 *   database    Semrush regional database code — default "us" (e.g. uk, ca, au, mobile-us)
 *   limit       max rows returned — default 50, max 200
 */
import "server-only";
import { IntegrationApiError } from "../oauth";
import type { AccountIdentity, ActionHandler, ActionParams, IntegrationProvider } from "../types";

const PROVIDER = "Semrush";
const API_URL = `${(process.env.SEMRUSH_API_URL || "https://api.semrush.com/").replace(/\/+$/, "")}/`;
const UNITS_URL = process.env.SEMRUSH_UNITS_URL || "https://www.semrush.com/users/countapiunits.html";
const DEFAULT_DATABASE = "us";
/** Dn domain, Rk rank, Or organic keywords, Ot organic traffic, Oc organic cost, Ad/At/Ac the AdWords equivalents. */
const DOMAIN_COLUMNS = "Dn,Rk,Or,Ot,Oc,Ad,At,Ac";
/** Ph phrase, Nq search volume, Cp CPC, Co competition, Nr number of results. */
const KEYWORD_COLUMNS = "Ph,Nq,Cp,Co,Nr";
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const NOTHING_FOUND = 50;
/** HTTP status to surface for Semrush's numeric error codes; anything else is a 502. */
const ERROR_STATUS: Record<number, number> = {
  120: 401, // WRONG KEY - ID PAIR
  130: 403, // API DISABLED
  131: 429, // LIMIT EXCEEDED
  132: 402, // API UNITS BALANCE IS ZERO
  133: 403, // DB ACCESS DENIED
  134: 429, // TOTAL LIMIT REACHED
  135: 403, // API REPORT TYPE DISABLED
};

type Cell = string | number | null;
type Row = Record<string, Cell>;

/* ------------------------------ param helpers ------------------------------ */

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

/** Accepts a bare host or a full URL and returns the lower-cased host name. */
function domainParam(params: ActionParams): string {
  const raw = optString(params, "domain");
  if (!raw) throw new IntegrationApiError('Parameter "domain" is required (e.g. domain=example.com)', 400);
  const host = raw
    .toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, "")
    .split(/[/?#]/)[0]
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");
  if (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9-]{2,63}$/.test(host)) {
    throw new IntegrationApiError(`"${raw}" is not a valid domain name (expected something like example.com)`, 400);
  }
  return host;
}

function phraseParam(params: ActionParams): string {
  const phrase = optString(params, "phrase")?.replace(/\s+/g, " ");
  if (!phrase) throw new IntegrationApiError('Parameter "phrase" is required (the keyword to look up)', 400);
  if (phrase.length > 255) throw new IntegrationApiError('Parameter "phrase" must be at most 255 characters', 400);
  return phrase;
}

function databaseParam(params: ActionParams): string {
  const db = (optString(params, "database") ?? DEFAULT_DATABASE).toLowerCase();
  if (!/^[a-z]{2,6}(?:-[a-z]{2,3})?$/.test(db)) {
    throw new IntegrationApiError(`"${db}" is not a valid Semrush database code (examples: us, uk, ca, au, de, mobile-us)`, 400);
  }
  return db;
}

/* -------------------------------- API calls -------------------------------- */

async function semrushFetch(url: string): Promise<{ ok: boolean; status: number; text: string }> {
  let res: Response;
  try {
    res = await fetch(url, { headers: { Accept: "text/csv, text/plain;q=0.9, */*;q=0.1" } });
  } catch (e) {
    // Deliberately omits the URL: it carries the API key.
    throw new IntegrationApiError(`Could not reach ${PROVIDER}: ${e instanceof Error ? e.message : "network error"}`, 502);
  }
  return { ok: res.ok, status: res.status, text: (await res.text()).trim() };
}

/** GET countapiunits.html — plain-text number of API units left; anything else means the key is not valid. */
async function countUnits(apiKey: string): Promise<number> {
  const res = await semrushFetch(`${UNITS_URL}?key=${encodeURIComponent(apiKey)}`);
  if (res.ok && /^\d+(\.\d+)?$/.test(res.text)) return Number(res.text);
  throw new IntegrationApiError(
    "Semrush rejected this API key. Copy it from Semrush → Subscription info → API units, and make sure your plan includes API access.",
    401,
    res.text.startsWith("ERROR") ? res.text.slice(0, 200) : undefined
  );
}

function parseError(text: string): { code: number; message: string } | null {
  const m = /^ERROR\s+(\d+)\s*::\s*([^\r\n]*)/.exec(text);
  return m ? { code: Number(m[1]), message: m[2].trim() } : null;
}

function toCell(raw: string): Cell {
  const t = raw.trim().replace(/^"(.*)"$/, "$1");
  if (t === "" || t.toLowerCase() === "n/a") return null;
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : t;
}

/** Semrush CSV: ";"-separated, first line is the header (column names, not the export_columns codes). */
function parseCsv(text: string): { header: string[]; rows: Row[] } {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return { header: [], rows: [] };
  const header = lines[0].split(";").map((h) => h.trim());
  const rows = lines.slice(1).map((line) => {
    const cells = line.split(";");
    const row: Row = {};
    header.forEach((h, i) => {
      row[h] = toCell(cells[i] ?? "");
    });
    return row;
  });
  return { header, rows };
}

interface Report {
  header: string[];
  rows: Row[];
  found: boolean;
  message: string | null;
}

/** Runs one Analytics API report. ERROR 50 (nothing found) is an empty result; other ERROR bodies throw. */
async function report(apiKey: string, query: Record<string, string>): Promise<Report> {
  const qs = Object.entries({ ...query, key: apiKey })
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
  const res = await semrushFetch(`${API_URL}?${qs}`);
  const err = parseError(res.text);
  if (err) {
    if (err.code === NOTHING_FOUND) return { header: [], rows: [], found: false, message: err.message };
    const status = err.code < NOTHING_FOUND ? 400 : ERROR_STATUS[err.code] ?? 502;
    throw new IntegrationApiError(`Semrush error ${err.code}: ${err.message}`, status, { code: err.code });
  }
  if (!res.ok) throw new IntegrationApiError(`${PROVIDER} API error (${res.status})`, 502, res.text.slice(0, 300));
  const { header, rows } = parseCsv(res.text);
  return { header, rows, found: rows.length > 0, message: null };
}

async function validateApiKey(apiKey: string): Promise<AccountIdentity> {
  const key = apiKey.trim();
  if (!key) throw new IntegrationApiError("Enter a Semrush API key", 400);
  const unitsLeft = await countUnits(key);
  return {
    accountId: "semrush",
    accountName: `Semrush (${unitsLeft} units left)`,
    metadata: { unitsLeft, checkedAt: new Date().toISOString() },
  };
}

/* --------------------------------- actions --------------------------------- */

const testAction: ActionHandler = async (ctx) => {
  const unitsLeft = await countUnits(ctx.accessToken);
  return { ok: true, unitsLeft };
};

const domainOverviewAction: ActionHandler = async (ctx, params) => {
  const domain = domainParam(params);
  const database = databaseParam(params);
  const limit = limitParam(params);
  const result = await report(ctx.accessToken, { type: "domain_ranks", export_columns: DOMAIN_COLUMNS, domain, database });
  return {
    domain,
    database,
    columns: result.header,
    rows: result.rows.slice(0, limit),
    count: Math.min(result.rows.length, limit),
    found: result.found,
    message: result.message,
  };
};

const keywordOverviewAction: ActionHandler = async (ctx, params) => {
  const phrase = phraseParam(params);
  const database = databaseParam(params);
  const limit = limitParam(params);
  const result = await report(ctx.accessToken, { type: "phrase_this", export_columns: KEYWORD_COLUMNS, phrase, database });
  return {
    phrase,
    database,
    columns: result.header,
    rows: result.rows.slice(0, limit),
    count: Math.min(result.rows.length, limit),
    found: result.found,
    message: result.message,
  };
};

/* --------------------------------- provider -------------------------------- */

export const provider: IntegrationProvider = {
  id: "semrush",
  validateApiKey,
  // API-key platform: the stored "token" is the key itself.
  identify: ({ tokens }) => validateApiKey(tokens.accessToken),
  actions: {
    test: testAction,
    domain_overview: domainOverviewAction,
    keyword_overview: keywordOverviewAction,
  },
};
