/**
 * Generic OAuth 2.0 authorization-code helpers driven by the registry entry.
 * Providers with non-standard endpoints (TikTok, Slack) override the relevant
 * step in their provider module instead.
 */
import "server-only";
import type { IntegrationDefinition, OAuth2Config } from "./registry";

export interface TokenSet {
  accessToken: string;
  refreshToken?: string | null;
  /** ISO timestamp; null when the platform does not expire tokens. */
  expiresAt?: string | null;
  scope?: string | null;
  /** Anything else the token endpoint returned that a provider may need later. */
  raw?: Record<string, unknown>;
}

export class IntegrationConfigError extends Error {
  missing: string[];
  constructor(missing: string[]) {
    super(`Missing environment variables: ${missing.join(", ")}`);
    this.name = "IntegrationConfigError";
    this.missing = missing;
  }
}

export class IntegrationApiError extends Error {
  status: number;
  details?: unknown;
  constructor(message: string, status = 502, details?: unknown) {
    super(message);
    this.name = "IntegrationApiError";
    this.status = status;
    this.details = details;
  }
}

export function requireOAuth(def: IntegrationDefinition): OAuth2Config {
  if (!def.oauth) throw new IntegrationApiError(`${def.name} does not use OAuth`, 400);
  return def.oauth;
}

/** Reads client id/secret from the env vars named in the definition. */
export function clientCredentials(def: IntegrationDefinition): { clientId: string; clientSecret: string } {
  const oauth = requireOAuth(def);
  const clientId = process.env[oauth.clientIdEnv];
  const clientSecret = process.env[oauth.clientSecretEnv];
  const missing = [
    ...(clientId ? [] : [oauth.clientIdEnv]),
    ...(clientSecret ? [] : [oauth.clientSecretEnv]),
    ...def.requiredEnv.filter((n) => n !== oauth.clientIdEnv && n !== oauth.clientSecretEnv && !process.env[n]),
  ];
  if (missing.length) throw new IntegrationConfigError(missing);
  return { clientId: clientId!, clientSecret: clientSecret! };
}

export function buildAuthorizeUrl(
  def: IntegrationDefinition,
  args: { clientId: string; redirectUri: string; state: string }
): string {
  const oauth = requireOAuth(def);
  const params = new URLSearchParams({
    client_id: args.clientId,
    redirect_uri: args.redirectUri,
    response_type: "code",
    state: args.state,
    ...(oauth.extraAuthorizeParams || {}),
  });
  if (oauth.scopes.length) params.set("scope", oauth.scopes.join(oauth.scopeSeparator));
  return `${oauth.authorizeUrl}?${params.toString()}`;
}

/** Normalises a standard token response ({access_token, refresh_token, expires_in, scope}). */
export function tokensFromResponse(json: Record<string, unknown>, previousRefreshToken?: string | null): TokenSet {
  const accessToken = typeof json.access_token === "string" ? json.access_token : "";
  if (!accessToken) throw new IntegrationApiError("Token response did not include access_token", 502, json);
  const expiresIn = typeof json.expires_in === "number" ? json.expires_in : Number(json.expires_in);
  return {
    accessToken,
    refreshToken: typeof json.refresh_token === "string" ? json.refresh_token : previousRefreshToken ?? null,
    expiresAt: Number.isFinite(expiresIn) && expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000).toISOString() : null,
    scope: typeof json.scope === "string" ? json.scope : null,
    raw: json,
  };
}

async function tokenRequest(def: IntegrationDefinition, body: Record<string, string>, creds: { clientId: string; clientSecret: string }): Promise<Record<string, unknown>> {
  const oauth = requireOAuth(def);
  const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" };
  const form = new URLSearchParams(body);
  if (oauth.tokenAuth === "basic") {
    headers.Authorization = "Basic " + Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString("base64");
  } else {
    form.set("client_id", creds.clientId);
    form.set("client_secret", creds.clientSecret);
  }
  const res = await fetch(oauth.tokenUrl, { method: "POST", headers, body: form });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    throw new IntegrationApiError(`${def.name} token endpoint returned non-JSON (${res.status})`, 502, text.slice(0, 300));
  }
  if (!res.ok) {
    const msg = (json.error_description as string) || (json.error as string) || `${def.name} token request failed (${res.status})`;
    throw new IntegrationApiError(msg, 502, json);
  }
  return json;
}

export async function exchangeCode(
  def: IntegrationDefinition,
  args: { code: string; redirectUri: string; clientId: string; clientSecret: string }
): Promise<TokenSet> {
  const json = await tokenRequest(def, { grant_type: "authorization_code", code: args.code, redirect_uri: args.redirectUri }, args);
  return tokensFromResponse(json);
}

export async function refreshAccessToken(
  def: IntegrationDefinition,
  args: { refreshToken: string; clientId: string; clientSecret: string }
): Promise<TokenSet> {
  const json = await tokenRequest(def, { grant_type: "refresh_token", refresh_token: args.refreshToken }, args);
  return tokensFromResponse(json, args.refreshToken);
}

/** Small helper for provider modules: JSON fetch with bearer auth and uniform errors. */
export async function apiFetch<T = unknown>(
  url: string,
  init: RequestInit & { accessToken?: string; providerName?: string } = {}
): Promise<T> {
  const { accessToken, providerName, headers, ...rest } = init;
  const res = await fetch(url, {
    ...rest,
    headers: {
      Accept: "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(rest.body && !(rest.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...(headers as Record<string, string> | undefined),
    },
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const d = (data ?? {}) as Record<string, unknown>;
    const err = d.error as Record<string, unknown> | string | undefined;
    const message =
      (typeof err === "object" && err && typeof err.message === "string" && err.message) ||
      (typeof err === "string" && err) ||
      (typeof d.message === "string" && d.message) ||
      (typeof d.error_description === "string" && d.error_description) ||
      `${providerName || "Provider"} API error (${res.status})`;
    throw new IntegrationApiError(message, res.status === 401 || res.status === 403 ? res.status : 502, data);
  }
  return data as T;
}
