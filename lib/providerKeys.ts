/**
 * Server-side resolution of model-provider API keys.
 *
 * Product rule: only administrators (role level >= 3) may bring their own
 * provider keys or point MAIOS at a custom / LAN endpoint. Every other signed-in
 * member has no way to enter keys, so their requests ALWAYS use the keys
 * configured in the server environment:
 *
 *   ANTHROPIC_API_KEY, OPENAI_API_KEY, GOOGLE_AI_API_KEY (or GOOGLE_API_KEY),
 *   PERPLEXITY_API_KEY
 *
 * Never import from client components: it reads process.env.
 */
import "server-only";

export type ProviderName = "anthropic" | "openai" | "google" | "perplexity" | "custom";

/** Default model per provider, used when a request omits the model or is re-routed. */
export const DEFAULT_MODELS: Record<Exclude<ProviderName, "custom">, string> = {
  anthropic: "claude-sonnet-4-20250514",
  openai: "gpt-4o",
  google: "gemini-2.5-flash",
  perplexity: "sonar-pro",
};

/** Environment variable names consulted for each provider, in priority order. */
const ENV_VAR_NAMES: Record<Exclude<ProviderName, "custom">, readonly string[]> = {
  anthropic: ["ANTHROPIC_API_KEY"],
  openai: ["OPENAI_API_KEY"],
  google: ["GOOGLE_AI_API_KEY", "GOOGLE_API_KEY"],
  perplexity: ["PERPLEXITY_API_KEY"],
};

/** Order in which providers are tried when picking a server-side default. */
const PROVIDER_PRIORITY: readonly Exclude<ProviderName, "custom">[] = ["anthropic", "openai", "google", "perplexity"];

/**
 * Canonical provider name for whatever the client sent. Unknown values map to
 * "openai" because the chat route has always treated unrecognised providers
 * (gpt-*, o1, o3, ...) as OpenAI-compatible.
 */
export function normalizeProvider(provider: string | null | undefined): ProviderName {
  const p = (provider || "anthropic").trim().toLowerCase();
  if (p === "custom") return "custom";
  if (p === "anthropic" || p === "claude") return "anthropic";
  if (p === "google" || p === "gemini") return "google";
  if (p === "perplexity") return "perplexity";
  return "openai";
}

/** The provider key configured in the server environment, if any. */
export function envProviderKey(provider: string | null | undefined): string | undefined {
  const name = normalizeProvider(provider);
  if (name === "custom") return undefined;
  for (const envVar of ENV_VAR_NAMES[name]) {
    const value = process.env[envVar];
    if (value && value.trim()) return value.trim();
  }
  return undefined;
}

/**
 * Resolve the API key to use for a request.
 *
 * - Admins may use the key they supplied from the browser (their own key from
 *   Settings -> API Keys), falling back to the server environment.
 * - Non-admins ALWAYS get the environment key. Any client-supplied key is ignored.
 *
 * Returns undefined when no usable key exists; callers should respond 400.
 */
export function resolveProviderKey(provider: string, clientKey: string | undefined, isAdmin: boolean): string | undefined {
  const envKey = envProviderKey(provider);
  if (!isAdmin) return envKey;
  const own = typeof clientKey === "string" ? clientKey.trim() : "";
  return own || envKey;
}

/** Only admins may route requests to provider "custom" (LM Studio, Ollama, vLLM, LAN endpoints). */
export function allowCustomEndpoint(isAdmin: boolean): boolean {
  return isAdmin;
}

/**
 * First cloud provider with a key in the server environment, with its default
 * model. Used to re-route non-admin requests that name a provider the server
 * cannot serve (e.g. a stale "custom" selection left in the browser).
 */
export function firstConfiguredProvider(): { provider: Exclude<ProviderName, "custom">; model: string } | undefined {
  for (const provider of PROVIDER_PRIORITY) {
    if (envProviderKey(provider)) return { provider, model: DEFAULT_MODELS[provider] };
  }
  return undefined;
}

/** Human-readable name of the env var(s) an administrator must set for a provider. */
export function providerEnvVarHint(provider: string | null | undefined): string {
  const name = normalizeProvider(provider);
  if (name === "custom") return "a custom endpoint";
  return ENV_VAR_NAMES[name].join(" or ");
}

/** Error message returned to users whose request cannot be served by any provider. */
export const NO_PROVIDER_MESSAGE = "No model provider configured for your account; ask an administrator";
