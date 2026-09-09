/**
 * Server-side store for integration connections (public.integration_connections).
 * Tokens are encrypted before they touch Supabase and decrypted only here.
 * All calls go through the caller's own Supabase client, so RLS (admin-only)
 * still applies.
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decrypt, encrypt } from "./crypto";
import { clientCredentials, refreshAccessToken, type TokenSet } from "./oauth";
import { getIntegration, type IntegrationId } from "./registry";

const TABLE = "integration_connections";
const DEFAULT_ACCOUNT = "default";

interface Row {
  id: string;
  organization_id: string;
  provider: string;
  account_id: string;
  account_name: string | null;
  scopes: string[];
  access_token_enc: string;
  refresh_token_enc: string | null;
  expires_at: string | null;
  metadata: Record<string, unknown>;
  connected_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConnectionPublic {
  id: string;
  provider: IntegrationId;
  accountId: string;
  accountName: string | null;
  scopes: string[];
  expiresAt: string | null;
  metadata: Record<string, unknown>;
  connectedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Connection extends ConnectionPublic {
  accessToken: string;
  refreshToken: string | null;
}

const PUBLIC_COLUMNS = "id,organization_id,provider,account_id,account_name,scopes,expires_at,metadata,connected_by,created_at,updated_at";

function toPublic(r: Omit<Row, "access_token_enc" | "refresh_token_enc">): ConnectionPublic {
  return {
    id: r.id,
    provider: r.provider as IntegrationId,
    accountId: r.account_id,
    accountName: r.account_name,
    scopes: r.scopes || [],
    expiresAt: r.expires_at,
    metadata: r.metadata || {},
    connectedBy: r.connected_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** The single tenant for now: the caller's organization, falling back to marketing-powered. */
export async function currentOrganizationId(supabase: SupabaseClient, userId: string): Promise<string> {
  const { data: profile } = await supabase.from("profiles").select("organization_id").eq("id", userId).maybeSingle();
  const fromProfile = (profile as { organization_id?: string | null } | null)?.organization_id;
  if (fromProfile) return fromProfile;
  const { data: org } = await supabase.from("organizations").select("id").eq("slug", "marketing-powered").maybeSingle();
  const id = (org as { id?: string } | null)?.id;
  if (!id) throw new Error("No organization found; run supabase/migrations first");
  return id;
}

export async function listConnections(supabase: SupabaseClient): Promise<ConnectionPublic[]> {
  const { data, error } = await supabase.from(TABLE).select(PUBLIC_COLUMNS).order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data || []) as Omit<Row, "access_token_enc" | "refresh_token_enc">[]).map(toPublic);
}

export async function getConnection(supabase: SupabaseClient, provider: IntegrationId, accountId?: string | null): Promise<Connection | null> {
  let q = supabase.from(TABLE).select("*").eq("provider", provider);
  q = accountId ? q.eq("account_id", accountId) : q.order("created_at", { ascending: true }).limit(1);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const row = (data as Row[] | null)?.[0];
  if (!row) return null;
  return {
    ...toPublic(row),
    accessToken: decrypt(row.access_token_enc),
    refreshToken: row.refresh_token_enc ? decrypt(row.refresh_token_enc) : null,
  };
}

export async function upsertConnection(
  supabase: SupabaseClient,
  input: {
    userId: string;
    provider: IntegrationId;
    accountId?: string | null;
    accountName?: string | null;
    scopes?: string[];
    tokens: TokenSet;
    metadata?: Record<string, unknown>;
  }
): Promise<ConnectionPublic> {
  const organization_id = await currentOrganizationId(supabase, input.userId);
  const row = {
    organization_id,
    provider: input.provider,
    account_id: input.accountId || DEFAULT_ACCOUNT,
    account_name: input.accountName ?? null,
    scopes: input.scopes ?? (input.tokens.scope ? input.tokens.scope.split(/[ ,]+/).filter(Boolean) : []),
    access_token_enc: encrypt(input.tokens.accessToken),
    refresh_token_enc: input.tokens.refreshToken ? encrypt(input.tokens.refreshToken) : null,
    expires_at: input.tokens.expiresAt ?? null,
    metadata: input.metadata ?? {},
    connected_by: input.userId,
  };
  const { data, error } = await supabase
    .from(TABLE)
    .upsert(row, { onConflict: "organization_id,provider,account_id" })
    .select(PUBLIC_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return toPublic(data as Omit<Row, "access_token_enc" | "refresh_token_enc">);
}

/** Persist refreshed tokens without touching metadata. */
async function saveTokens(supabase: SupabaseClient, id: string, tokens: TokenSet): Promise<void> {
  const patch: Record<string, unknown> = {
    access_token_enc: encrypt(tokens.accessToken),
    expires_at: tokens.expiresAt ?? null,
  };
  if (tokens.refreshToken) patch.refresh_token_enc = encrypt(tokens.refreshToken);
  const { error } = await supabase.from(TABLE).update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteConnection(supabase: SupabaseClient, provider: IntegrationId, accountId?: string | null): Promise<number> {
  let q = supabase.from(TABLE).delete({ count: "exact" }).eq("provider", provider);
  if (accountId) q = q.eq("account_id", accountId);
  const { error, count } = await q;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export type RefreshFn = (refreshToken: string) => Promise<TokenSet>;

/**
 * Returns a usable access token, refreshing (and persisting) it first when it
 * expires within the next minute. `customRefresh` lets a provider module
 * replace the standard refresh_token grant.
 */
export async function getValidAccessToken(
  supabase: SupabaseClient,
  provider: IntegrationId,
  accountId?: string | null,
  customRefresh?: RefreshFn
): Promise<{ accessToken: string; connection: Connection }> {
  const connection = await getConnection(supabase, provider, accountId);
  if (!connection) throw new Error(`${provider} is not connected`);
  const def = getIntegration(provider);
  const expiresSoon = connection.expiresAt ? new Date(connection.expiresAt).getTime() - Date.now() < 60_000 : false;
  if (!expiresSoon || !def?.oauth) return { accessToken: connection.accessToken, connection };
  if (!connection.refreshToken) {
    throw new Error(`${def.name} access token expired and no refresh token is available; reconnect it from the Integrations page`);
  }
  const tokens = customRefresh
    ? await customRefresh(connection.refreshToken)
    : await refreshAccessToken(def, { refreshToken: connection.refreshToken, ...clientCredentials(def) });
  await saveTokens(supabase, connection.id, tokens);
  return {
    accessToken: tokens.accessToken,
    connection: { ...connection, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken ?? connection.refreshToken, expiresAt: tokens.expiresAt ?? null },
  };
}
