/**
 * Contract every provider module in lib/integrations/providers/* implements.
 * Server-only consumers; keep this file free of runtime imports so it can be
 * type-imported anywhere.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { TokenSet } from "./oauth";
import type { IntegrationDefinition, IntegrationId } from "./registry";
import type { Connection } from "./store";

export interface ActionContext {
  supabase: SupabaseClient;
  definition: IntegrationDefinition;
  connection: Connection;
  /** Fresh (auto-refreshed) access token, or the API key for api_key platforms. */
  accessToken: string;
  userId: string;
}

export type ActionParams = Record<string, unknown>;
export type ActionHandler = (ctx: ActionContext, params: ActionParams, method: "GET" | "POST") => Promise<unknown>;

export interface AccountIdentity {
  accountId: string;
  accountName: string;
  metadata?: Record<string, unknown>;
}

export interface IntegrationProvider {
  id: IntegrationId;
  /** Override when the platform's authorize URL is non-standard (e.g. TikTok uses app_id). */
  buildAuthorizeUrl?: (args: { definition: IntegrationDefinition; clientId: string; redirectUri: string; state: string }) => string;
  /** Override when the token endpoint is non-standard (TikTok JSON body, Slack response shape). */
  exchange?: (args: { definition: IntegrationDefinition; code: string; redirectUri: string; clientId: string; clientSecret: string }) => Promise<TokenSet>;
  /** Override the refresh grant when needed. */
  refresh?: (args: { definition: IntegrationDefinition; refreshToken: string; clientId: string; clientSecret: string }) => Promise<TokenSet>;
  /** After a successful exchange: which account did we just connect? */
  identify: (args: { definition: IntegrationDefinition; tokens: TokenSet }) => Promise<AccountIdentity>;
  /** For api_key platforms: validate the key and describe the account. */
  validateApiKey?: (apiKey: string) => Promise<AccountIdentity>;
  /** Named read (or narrowly-scoped write) operations exposed at /api/integrations/<id>/<action>. */
  actions: Record<string, ActionHandler>;
}
