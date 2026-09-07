/**
 * Model gateway: one internal API for embeddings, chat, and transcription.
 * Primary backend is LM Studio (OpenAI-compatible) on the Mac / Mac Studio over Tailscale.
 * Fallbacks: Ollama (embeddings, chat) and Anthropic (chat) when configured.
 */
import { config } from '../config.ts';

export interface ChatMessage { role: 'system' | 'user' | 'assistant'; content: string }
export interface ChatResult { text: string; model: string; provider: string; tokensInput: number; tokensOutput: number; latencyMs: number }

async function postJson(url: string, body: unknown, headers: Record<string, string> = {}, timeoutMs = 120_000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), signal: ctl.signal });
    if (!res.ok) throw new Error(`${url} -> ${res.status} ${(await res.text()).slice(0, 300)}`);
    return res.json();
  } finally { clearTimeout(t); }
}

export async function embed(texts: string[]): Promise<number[][]> {
  if (!texts.length) return [];
  const out: number[][] = [];
  const batch = 32;
  for (let i = 0; i < texts.length; i += batch) {
    const slice = texts.slice(i, i + batch).map((t) => t.slice(0, 8000));
    let vectors: number[][] | null = null;
    try {
      const data = await postJson(`${config.embeddings.baseUrl}/embeddings`, { model: config.embeddings.model, input: slice }, { authorization: `Bearer ${config.embeddings.apiKey}` });
      vectors = (data.data as { embedding: number[]; index: number }[]).sort((a, b) => a.index - b.index).map((d) => d.embedding);
    } catch (e) {
      if (!config.embeddings.ollamaUrl) throw e;
      const data = await postJson(`${config.embeddings.ollamaUrl}/api/embed`, { model: 'nomic-embed-text', input: slice });
      vectors = data.embeddings as number[][];
    }
    for (const v of vectors!) {
      if (v.length !== config.embeddings.dim) throw new Error(`embedding dim ${v.length} != configured ${config.embeddings.dim}`);
      out.push(v);
    }
  }
  return out;
}

export async function chat(messages: ChatMessage[], opts: { model?: string; temperature?: number; maxTokens?: number; json?: boolean } = {}): Promise<ChatResult> {
  const model = opts.model || config.llm.model;
  const started = Date.now();
  if (model.startsWith('claude') && config.llm.anthropicKey) {
    const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
    const data = await postJson('https://api.anthropic.com/v1/messages', {
      model, max_tokens: opts.maxTokens || 4096, temperature: opts.temperature ?? 0.3, system: system || undefined,
      messages: messages.filter((m) => m.role !== 'system').map((m) => ({ role: m.role, content: m.content })),
    }, { 'x-api-key': config.llm.anthropicKey, 'anthropic-version': '2023-06-01' }, 300_000);
    return { text: data.content?.map((c: { text?: string }) => c.text || '').join('') || '', model, provider: 'anthropic', tokensInput: data.usage?.input_tokens || 0, tokensOutput: data.usage?.output_tokens || 0, latencyMs: Date.now() - started };
  }
  const body: Record<string, unknown> = { model, messages, temperature: opts.temperature ?? 0.3, max_tokens: opts.maxTokens || 4096, stream: false };
  if (opts.json) body.response_format = { type: 'json_object' };
  const data = await postJson(`${config.llm.baseUrl}/chat/completions`, body, { authorization: `Bearer ${config.llm.apiKey}` }, 600_000);
  return { text: data.choices?.[0]?.message?.content || '', model: data.model || model, provider: 'lmstudio', tokensInput: data.usage?.prompt_tokens || 0, tokensOutput: data.usage?.completion_tokens || 0, latencyMs: Date.now() - started };
}

/** Speech to text through LM Studio's OpenAI-compatible audio endpoint (whisper models). */
export async function transcribe(filePath: string): Promise<string> {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const form = new FormData();
  form.append('model', config.transcriptionModel);
  form.append('file', new Blob([fs.readFileSync(filePath)]), path.basename(filePath));
  const res = await fetch(`${config.llm.baseUrl}/audio/transcriptions`, { method: 'POST', headers: { authorization: `Bearer ${config.llm.apiKey}` }, body: form });
  if (!res.ok) throw new Error(`transcription failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return data.text as string;
}
