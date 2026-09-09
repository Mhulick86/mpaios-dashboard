import 'dotenv/config';

function env(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`Missing required env ${name}`);
  return v;
}

export const config = {
  databaseUrl: env('DATABASE_URL', 'postgres://maios:maios@localhost:5433/maios'),
  redisUrl: env('REDIS_URL', 'redis://localhost:6380'),
  llm: {
    baseUrl: env('LLM_BASE_URL', 'http://localhost:1234/v1'),
    apiKey: env('LLM_API_KEY', 'lm-studio'),
    model: env('LLM_MODEL', 'qwen2.5-14b-instruct@q4_k_m'),
    anthropicKey: process.env.ANTHROPIC_API_KEY || '',
  },
  embeddings: {
    baseUrl: env('EMBEDDINGS_BASE_URL', env('LLM_BASE_URL', 'http://localhost:1234/v1')),
    apiKey: env('LLM_API_KEY', 'lm-studio'),
    model: env('EMBEDDING_MODEL', 'text-embedding-nomic-embed-text-v1.5'),
    dim: Number(env('EMBEDDING_DIM', '768')),
    ollamaUrl: process.env.OLLAMA_URL || '',
  },
  transcriptionModel: process.env.TRANSCRIPTION_MODEL || 'whisper-large-v3-turbo',
  kbRoot: process.env.KB_ROOT || '',
  kbScanIntervalSec: Number(process.env.KB_SCAN_INTERVAL_SEC || '300'),
  orgSlug: env('ORG_SLUG', 'marketing-powered'),
  httpPort: Number(env('WORKER_HTTP_PORT', '8787')),
  internalApiKey: env('INTERNAL_API_KEY', 'change-me'),
  isProduction: (process.env.NODE_ENV || '').toLowerCase() === 'production',
  publicBaseUrl: process.env.PUBLIC_BASE_URL || 'http://localhost:8787',
  asana: { pat: process.env.ASANA_PAT || '', workspaceGid: process.env.ASANA_WORKSPACE_GID || '' },
  slackWebhookUrl: process.env.SLACK_WEBHOOK_URL || '',
};
