/**
 * The cloud models MAIOS offers, in one place: the Settings dropdowns, the defaults, the cost table and the chat
 * fallbacks all read from here. When a provider retires a model, move its ID to RETIRED_MODELS with its replacement
 * so saved role assignments keep working.
 *
 * OpenAI and Google IDs and prices mirror content-studio/providers.mjs; keep the two lists in step.
 */
export type ModelProvider = "anthropic" | "openai" | "google" | "perplexity";

export interface ModelOption {
  id: string;
  label: string;
  provider: ModelProvider;
  /** US dollars per million tokens. */
  input: number;
  output: number;
  note?: string;
}

export const MODEL_CATALOG: ModelOption[] = [
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5", provider: "anthropic", input: 2, output: 10, note: "Recommended for most roles" },
  { id: "claude-opus-5-5", label: "Claude Opus 5.5", provider: "anthropic", input: 4, output: 20, note: "Higher quality reasoning and writing" },
  { id: "claude-fable-5-2", label: "Claude Fable 5.2", provider: "anthropic", input: 8, output: 40, note: "Most capable; slowest and most expensive" },
  { id: "claude-haiku-5-5", label: "Claude Haiku 5.5", provider: "anthropic", input: 0.1, output: 0.5, note: "Fast and cheap" },
  { id: "gpt-6.1-sol", label: "GPT-6.1 Sol", provider: "openai", input: 2, output: 10 },
  { id: "gpt-6.1-terra", label: "GPT-6.1 Terra", provider: "openai", input: 1, output: 5 },
  { id: "gpt-6-luna", label: "GPT-6 Luna", provider: "openai", input: 0.1, output: 0.5, note: "Fast and cheap" },
  { id: "gpt-4o", label: "GPT-4o", provider: "openai", input: 2.5, output: 10, note: "Older model" },
  { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro (preview)", provider: "google", input: 2, output: 12 },
  { id: "gemini-3.8-flash", label: "Gemini 3.8 Flash", provider: "google", input: 0.75, output: 3.75 },
  { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite", provider: "google", input: 0.3, output: 2.5, note: "Fast and cheap" },
  { id: "sonar-pro", label: "Sonar Pro", provider: "perplexity", input: 3, output: 15 },
  { id: "sonar", label: "Sonar", provider: "perplexity", input: 1, output: 1 },
];

export const PROVIDER_LABELS: Record<ModelProvider, string> = { anthropic: "Anthropic", openai: "OpenAI", google: "Google", perplexity: "Perplexity" };

export const modelsFor = (provider: string): ModelOption[] => MODEL_CATALOG.filter((m) => m.provider === provider);

/** Models that used to be offered, and what replaces each one. */
export const RETIRED_MODELS: Record<string, string> = {
  "claude-sonnet-4-20250514": "claude-sonnet-5-5",
  "claude-opus-4-20250514": "claude-opus-5-5",
  "claude-3-opus": "claude-opus-5-5",
  "claude-3.5-haiku": "claude-haiku-5-5",
  "gpt-4o-mini": "gpt-6-luna",
  "gpt-4-turbo": "gpt-6.1-sol",
  "o1": "gpt-6.1-sol",
  "o3-mini": "gpt-6.1-terra",
  "gemini-2.5-pro": "gemini-3.1-pro-preview",
  "gemini-2.5-flash": "gemini-3.8-flash",
  "gemini-2.5-flash-lite": "gemini-3.5-flash-lite",
};

/** The model to use for a saved choice: the replacement when the saved one was retired, otherwise the choice itself. */
export const currentModel = (id: string | undefined | null): string => (id && RETIRED_MODELS[id]) || id || "";

export const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-5-5";
export const DEFAULT_OPENAI_MODEL = "gpt-6.1-sol";
export const DEFAULT_GOOGLE_MODEL = "gemini-3.8-flash";

/** Which provider serves a model ID. Anything unrecognised is a custom (local) endpoint. */
export function providerOf(model: string): ModelProvider | "custom" {
  const known = MODEL_CATALOG.find((m) => m.id === model);
  if (known) return known.provider;
  if (model.startsWith("claude")) return "anthropic";
  if (model.startsWith("gpt") || model.startsWith("o1") || model.startsWith("o3")) return "openai";
  if (model.startsWith("gemini")) return "google";
  if (model.startsWith("sonar")) return "perplexity";
  return "custom";
}
