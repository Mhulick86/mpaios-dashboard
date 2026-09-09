/**
 * Slack provider: workspace identity, channel listing and posting.
 *
 * Slack's OAuth is non-standard in two ways, both handled here:
 *   - oauth.v2.access answers HTTP 200 with {ok:false,error} on failure and
 *     nests the workspace under `team`, so `exchange` (and `refresh`, used only
 *     when token rotation is enabled on the app) are overridden.
 *   - Every Web API method does the same, so `ok` is checked on each response.
 *
 * The stored token is the bot token (xoxb-...); it never expires unless the
 * app opts into token rotation, in which case the refresh grant keeps it alive.
 */
import "server-only";
import { apiFetch, IntegrationApiError, type TokenSet } from "../oauth";
import type { AccountIdentity, ActionHandler, ActionParams, IntegrationProvider } from "../types";

/** Slack's Web API is unversioned; the base is overridable (SLACK_API_BASE) for test doubles only. */
const SLACK_API_BASE = (process.env.SLACK_API_BASE || "https://slack.com/api").trim().replace(/\/+$/, "");
const PROVIDER = "Slack";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
/** Slack recommends no more than 200 conversations per page. */
const PAGE_MAX = 200;
/** How far channel-name resolution will scan before asking for an id instead. */
const RESOLVE_PAGES = 5;
const MAX_TEXT_LENGTH = 40_000;
const MAX_BLOCKS = 50;
const DEFAULT_TYPES = ["public_channel", "private_channel"];
const ALL_TYPES = [...DEFAULT_TYPES, "mpim", "im"];
const CHANNEL_ID_RE = /^[CGD][A-Z0-9]{6,}$/;
const CHANNEL_NAME_RE = /^#?[a-z0-9][a-z0-9._-]{0,79}$/;
const THREAD_TS_RE = /^\d+\.\d+$/;

/** HTTP status to surface for Slack's string error codes (everything else is a 502). */
const STATUS_BY_ERROR: Record<string, number> = {
  invalid_auth: 401,
  not_authed: 401,
  token_revoked: 401,
  token_expired: 401,
  account_inactive: 401,
  invalid_refresh_token: 401,
  missing_scope: 403,
  not_allowed_token_type: 403,
  restricted_action: 403,
  ekm_access_denied: 403,
  ratelimited: 429,
  channel_not_found: 404,
  not_in_channel: 400,
  is_archived: 400,
  msg_too_long: 400,
  no_text: 400,
  invalid_blocks: 400,
  invalid_blocks_format: 400,
  invalid_arguments: 400,
  invalid_cursor: 400,
  invalid_code: 400,
  code_already_used: 400,
  bad_redirect_uri: 400,
  invalid_client_id: 400,
  bad_client_secret: 400,
  method_not_supported_for_channel_type: 400,
};
const HINTS: Record<string, string> = {
  invalid_auth: "the bot token is invalid or was revoked; reconnect Slack from the Integrations page",
  token_revoked: "the bot token was revoked; reconnect Slack from the Integrations page",
  token_expired: "the rotated bot token expired; reconnect Slack from the Integrations page",
  account_inactive: "the Slack app was uninstalled from the workspace; reconnect it",
  missing_scope: "add the scope under OAuth & Permissions in the Slack app and reinstall it",
  channel_not_found: "use the channel id, or invite the app to the channel if it is private",
  not_in_channel: "invite the app to the channel with /invite @<app name>",
  is_archived: "the channel is archived",
  invalid_blocks: "blocks must be a valid Block Kit array",
  ratelimited: "Slack rate limit hit; retry shortly",
  method_not_supported_for_channel_type: "the app cannot join private channels by itself; invite it with /invite @<app name>",
  bad_redirect_uri: "the redirect URI must match one registered under OAuth & Permissions in the Slack app",
  invalid_code: "the authorization code is invalid or expired; try connecting again",
};

// ---------------------------------------------------------------------------
// Response shapes
// ---------------------------------------------------------------------------

interface SlackResponse {
  ok?: boolean;
  error?: string;
  warning?: string;
  needed?: string;
  provided?: string;
  response_metadata?: { next_cursor?: string; messages?: string[] };
}
interface OAuthAccessResponse extends SlackResponse {
  access_token?: string;
  token_type?: string;
  scope?: string;
  bot_user_id?: string;
  app_id?: string;
  team?: { id?: string; name?: string } | null;
  enterprise?: { id?: string; name?: string } | null;
  authed_user?: { id?: string };
  refresh_token?: string;
  expires_in?: number;
  is_enterprise_install?: boolean;
}
interface AuthTestResponse extends SlackResponse {
  url?: string;
  team?: string;
  user?: string;
  team_id?: string;
  user_id?: string;
  bot_id?: string;
  enterprise_id?: string;
  is_enterprise_install?: boolean;
}
interface SlackChannel {
  id?: string;
  name?: string;
  name_normalized?: string;
  is_private?: boolean;
  is_archived?: boolean;
  is_member?: boolean;
  is_im?: boolean;
  is_mpim?: boolean;
  num_members?: number;
  created?: number;
  topic?: { value?: string };
  purpose?: { value?: string };
}
interface ConversationsListResponse extends SlackResponse {
  channels?: SlackChannel[];
}
interface PostMessageResponse extends SlackResponse {
  channel?: string;
  ts?: string;
  message?: { text?: string; ts?: string; thread_ts?: string };
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

function cursorParam(params: ActionParams): string | undefined {
  const cursor = strParam(params, "cursor");
  if (cursor && (cursor.length > 1000 || /\s/.test(cursor))) throw new IntegrationApiError('Parameter "cursor" is not a valid Slack cursor', 400);
  return cursor;
}

function typesParam(params: ActionParams): string {
  const raw = params.types;
  if (raw === undefined || raw === null || raw === "") return DEFAULT_TYPES.join(",");
  const list = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(",") : null;
  if (!list) throw new IntegrationApiError('Parameter "types" must be a comma-separated list', 400);
  const types = Array.from(new Set(list.map((t) => String(t).trim().toLowerCase()).filter(Boolean)));
  if (!types.length || types.some((t) => !ALL_TYPES.includes(t))) {
    throw new IntegrationApiError(`Parameter "types" may only contain ${ALL_TYPES.join(", ")}`, 400);
  }
  return types.join(",");
}

function channelParam(params: ActionParams): string {
  const channel = requireStr(params, "channel");
  if (!CHANNEL_ID_RE.test(channel) && !CHANNEL_NAME_RE.test(channel)) {
    throw new IntegrationApiError('Parameter "channel" must be a Slack channel id (C0123ABCD) or a #channel-name', 400);
  }
  return channel;
}

function blocksParam(params: ActionParams): Record<string, unknown>[] | undefined {
  let raw = params.blocks;
  if (raw === undefined || raw === null || raw === "") return undefined;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw) as unknown;
    } catch {
      throw new IntegrationApiError('Parameter "blocks" must be a Block Kit JSON array', 400);
    }
  }
  const valid =
    Array.isArray(raw) &&
    raw.length > 0 &&
    raw.length <= MAX_BLOCKS &&
    raw.every((b) => b && typeof b === "object" && !Array.isArray(b) && typeof (b as Record<string, unknown>).type === "string");
  if (!valid) throw new IntegrationApiError(`Parameter "blocks" must be an array of 1-${MAX_BLOCKS} Block Kit blocks, each with a "type"`, 400);
  return raw as Record<string, unknown>[];
}

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------

/** Builds the error for an {ok:false} payload without echoing anything sensitive from it. */
function slackError(method: string, res: SlackResponse): IntegrationApiError {
  const error = res.error || "unknown_error";
  const parts = [`${PROVIDER} ${method} failed: ${error}`];
  if (error === "missing_scope" && res.needed) parts.push(`needs ${res.needed}${res.provided ? ` (token has ${res.provided})` : ""}`);
  const messages = (res.response_metadata?.messages ?? []).filter((m) => typeof m === "string").slice(0, 3);
  if (messages.length) parts.push(messages.join("; "));
  const hint = HINTS[error];
  if (hint) parts.push(hint);
  return new IntegrationApiError(parts.join(" - "), STATUS_BY_ERROR[error] ?? 502, {
    ok: false,
    error,
    ...(res.needed ? { needed: res.needed } : {}),
    ...(res.provided ? { provided: res.provided } : {}),
    ...(messages.length ? { messages } : {}),
  });
}

function slackErrorCode(e: unknown): string | null {
  if (!(e instanceof IntegrationApiError)) return null;
  const details = e.details as { error?: unknown } | null | undefined;
  return details && typeof details.error === "string" ? details.error : null;
}

/** Calls a Web API method with the bot token (JSON POST works for every method used here). */
async function slackCall<T extends SlackResponse>(accessToken: string, method: string, args: Record<string, unknown> = {}): Promise<T> {
  let res: T;
  try {
    res = await apiFetch<T>(`${SLACK_API_BASE}/${method}`, {
      method: "POST",
      accessToken,
      providerName: PROVIDER,
      body: JSON.stringify(args),
    });
  } catch (e) {
    // Non-2xx responses (e.g. 429) still carry Slack's {ok:false,error} body.
    const body = e instanceof IntegrationApiError && e.details && typeof e.details === "object" ? (e.details as SlackResponse) : null;
    if (body && typeof body.error === "string") throw slackError(method, body);
    throw e;
  }
  if (!res || typeof res !== "object") throw new IntegrationApiError(`${PROVIDER} ${method} returned an unexpected response`, 502);
  if (!res.ok) throw slackError(method, res);
  return res;
}

/** oauth.v2.access for both the code exchange and (with token rotation) the refresh grant. */
async function oauthAccess(form: Record<string, string>): Promise<OAuthAccessResponse> {
  const res = await fetch(`${SLACK_API_BASE}/oauth.v2.access`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams(form).toString(),
  });
  const text = await res.text();
  let json: OAuthAccessResponse;
  try {
    json = JSON.parse(text) as OAuthAccessResponse;
  } catch {
    throw new IntegrationApiError(`${PROVIDER} oauth.v2.access returned non-JSON (${res.status})`, 502, text.slice(0, 300));
  }
  if (!res.ok || !json.ok) throw slackError("oauth.v2.access", json);
  if (!json.access_token) throw new IntegrationApiError(`${PROVIDER} oauth.v2.access did not return a bot token`, 502);
  return json;
}

function toTokenSet(json: OAuthAccessResponse, previousRefreshToken?: string | null): TokenSet {
  const expiresIn = typeof json.expires_in === "number" ? json.expires_in : Number(json.expires_in);
  return {
    accessToken: json.access_token as string,
    refreshToken: typeof json.refresh_token === "string" ? json.refresh_token : previousRefreshToken ?? null,
    expiresAt: Number.isFinite(expiresIn) && expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000).toISOString() : null,
    scope: json.scope ?? null,
    // Only identity fields: never the user token that authed_user may carry.
    raw: {
      team: json.team ?? null,
      enterprise: json.enterprise ?? null,
      bot_user_id: json.bot_user_id ?? null,
      app_id: json.app_id ?? null,
      authed_user_id: json.authed_user?.id ?? null,
      is_enterprise_install: Boolean(json.is_enterprise_install),
    },
  };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

function mapChannel(c: SlackChannel) {
  return {
    id: c.id ?? null,
    name: c.name ?? null,
    isPrivate: Boolean(c.is_private),
    isMember: Boolean(c.is_member),
    isArchived: Boolean(c.is_archived),
    numMembers: typeof c.num_members === "number" ? c.num_members : null,
    topic: c.topic?.value || null,
    purpose: c.purpose?.value || null,
    created: typeof c.created === "number" ? new Date(c.created * 1000).toISOString() : null,
  };
}

async function listChannels(
  accessToken: string,
  opts: { limit: number; types: string; excludeArchived: boolean; cursor?: string }
): Promise<{ channels: SlackChannel[]; nextCursor: string | null }> {
  const channels: SlackChannel[] = [];
  let cursor = opts.cursor;
  while (channels.length < opts.limit) {
    const res = await slackCall<ConversationsListResponse>(accessToken, "conversations.list", {
      types: opts.types,
      exclude_archived: opts.excludeArchived,
      limit: Math.min(PAGE_MAX, opts.limit - channels.length),
      ...(cursor ? { cursor } : {}),
    });
    channels.push(...(res.channels ?? []));
    cursor = res.response_metadata?.next_cursor || undefined;
    if (!cursor || !(res.channels ?? []).length) break;
  }
  return { channels: channels.slice(0, opts.limit), nextCursor: cursor ?? null };
}

/** "#general" -> "C0123ABCD" by scanning the channel list; ids pass straight through. */
async function resolveChannelId(accessToken: string, ref: string): Promise<string> {
  if (CHANNEL_ID_RE.test(ref)) return ref;
  const name = ref.replace(/^#/, "").toLowerCase();
  let cursor: string | undefined;
  for (let page = 0; page < RESOLVE_PAGES; page++) {
    const res = await slackCall<ConversationsListResponse>(accessToken, "conversations.list", {
      types: DEFAULT_TYPES.join(","),
      exclude_archived: true,
      limit: PAGE_MAX,
      ...(cursor ? { cursor } : {}),
    });
    const hit = (res.channels ?? []).find((c) => c.name === name || c.name_normalized === name);
    if (hit?.id) return hit.id;
    cursor = res.response_metadata?.next_cursor || undefined;
    if (!cursor) break;
  }
  throw new IntegrationApiError(
    `${PROVIDER} channel "${ref}" was not found among the first ${RESOLVE_PAGES * PAGE_MAX} channels; pass the channel id instead`,
    404
  );
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

async function identify({ tokens }: { tokens: TokenSet }): Promise<AccountIdentity> {
  const raw = tokens.raw ?? {};
  const team = (raw.team ?? null) as { id?: string; name?: string } | null;
  const metadata: Record<string, unknown> = {
    botUserId: raw.bot_user_id ?? null,
    appId: raw.app_id ?? null,
    enterprise: raw.enterprise ?? null,
    scope: tokens.scope ?? null,
    tokenRotation: Boolean(tokens.refreshToken),
  };
  if (team?.id) return { accountId: team.id, accountName: team.name || team.id, metadata };

  // Fallback for tokens that arrived without the oauth.v2.access payload.
  const auth = await slackCall<AuthTestResponse>(tokens.accessToken, "auth.test");
  if (!auth.team_id) throw new IntegrationApiError(`${PROVIDER} did not report a workspace for this token; try connecting again`, 502);
  return {
    accountId: auth.team_id,
    accountName: auth.team || auth.team_id,
    metadata: { ...metadata, url: auth.url ?? null, botId: auth.bot_id ?? null },
  };
}

const actions: Record<string, ActionHandler> = {
  /** auth.test: confirms the bot token and names the workspace it belongs to. */
  async test(ctx) {
    const auth = await slackCall<AuthTestResponse>(ctx.accessToken, "auth.test");
    return {
      ok: true,
      team: { id: auth.team_id ?? null, name: auth.team ?? null },
      url: auth.url ?? null,
      user: auth.user ?? null,
      userId: auth.user_id ?? null,
      botId: auth.bot_id ?? null,
      isEnterpriseInstall: Boolean(auth.is_enterprise_install),
    };
  },

  /** Channels the app can see. Params: limit (<=200), cursor, types, exclude_archived (default true). */
  async channels(ctx, params) {
    const { channels, nextCursor } = await listChannels(ctx.accessToken, {
      limit: limitParam(params),
      types: typesParam(params),
      excludeArchived: boolParam(params, "exclude_archived", true),
      cursor: cursorParam(params),
    });
    return { count: channels.length, channels: channels.map(mapChannel), nextCursor };
  },

  /**
   * Posts a message (POST only). Params: channel (id or #name) and text are required;
   * blocks, thread_ts, unfurl_links and unfurl_media are optional. Public channels the
   * app has not joined yet are joined automatically (channels:join).
   */
  async post(ctx, params, method) {
    if (method !== "POST") throw new IntegrationApiError('Slack "post" only accepts POST with a JSON body { channel, text }', 405);
    const channel = channelParam(params);
    const text = requireStr(params, "text");
    if (text.length > MAX_TEXT_LENGTH) throw new IntegrationApiError(`Parameter "text" must be at most ${MAX_TEXT_LENGTH} characters`, 400);
    const blocks = blocksParam(params);
    const threadTs = strParam(params, "thread_ts");
    if (threadTs && !THREAD_TS_RE.test(threadTs)) throw new IntegrationApiError('Parameter "thread_ts" must be a Slack message timestamp like 1700000000.000100', 400);
    const args: Record<string, unknown> = {
      channel,
      text,
      ...(blocks ? { blocks } : {}),
      ...(threadTs ? { thread_ts: threadTs } : {}),
      ...(params.unfurl_links === undefined ? {} : { unfurl_links: boolParam(params, "unfurl_links", true) }),
      ...(params.unfurl_media === undefined ? {} : { unfurl_media: boolParam(params, "unfurl_media", true) }),
    };

    let joined = false;
    let res: PostMessageResponse;
    try {
      res = await slackCall<PostMessageResponse>(ctx.accessToken, "chat.postMessage", args);
    } catch (e) {
      if (slackErrorCode(e) !== "not_in_channel") throw e;
      const channelId = await resolveChannelId(ctx.accessToken, channel);
      await slackCall(ctx.accessToken, "conversations.join", { channel: channelId });
      joined = true;
      res = await slackCall<PostMessageResponse>(ctx.accessToken, "chat.postMessage", { ...args, channel: channelId });
    }
    return {
      ok: true,
      channel: res.channel ?? null,
      ts: res.ts ?? null,
      threadTs: res.message?.thread_ts ?? threadTs ?? null,
      joined,
      ...(res.warning ? { warning: res.warning } : {}),
    };
  },
};

export const provider: IntegrationProvider = {
  id: "slack",
  async exchange({ code, redirectUri, clientId, clientSecret }) {
    const json = await oauthAccess({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri });
    return toTokenSet(json);
  },
  /** Only reached when the app has token rotation enabled (expires_in + refresh_token were issued). */
  async refresh({ refreshToken, clientId, clientSecret }) {
    const json = await oauthAccess({ client_id: clientId, client_secret: clientSecret, grant_type: "refresh_token", refresh_token: refreshToken });
    return toTokenSet(json, refreshToken);
  },
  identify,
  actions,
};
