/**
 * Frontier model providers for generation: Anthropic (Claude), OpenAI and Google (Gemini), plus LM Studio for
 * local-only installs. Each stage (brief, draft, graphics plan, QA) has its own model, chosen from a dropdown.
 * API keys are entered once per provider, stored encrypted in the studio database, and never returned to the
 * browser. If no key is saved, the provider's usual environment variable is used (for example the keys already
 * configured on the Vercel project).
 */
import { getDb } from './db.mjs';
import { encrypt, decrypt } from './secrets.mjs';
import { runtime } from './runtime.mjs';
import { clamp } from './env.mjs';

export const PROVIDERS = {
  anthropic: { label: 'Anthropic (Claude)', env: ['ANTHROPIC_API_KEY'], keyHint: 'sk-ant-...', docs: 'https://console.anthropic.com/settings/keys' },
  openai: { label: 'OpenAI', env: ['OPENAI_API_KEY'], keyHint: 'sk-...', docs: 'https://platform.openai.com/api-keys' },
  google: { label: 'Google (Gemini)', env: ['GEMINI_API_KEY', 'GOOGLE_AI_API_KEY', 'GOOGLE_API_KEY'], keyHint: 'AIza...', docs: 'https://aistudio.google.com/apikey' }
};
/** Curated choices for the stage dropdowns. Any other model ID can be typed in. Prices are USD per 1M tokens (Nov 2026). */
export const MODELS = [
  { id: 'anthropic:claude-sonnet-5-5', provider: 'anthropic', label: 'Claude Sonnet 5.5', price: '$2 / $10', note: 'Recommended for briefs, drafts and QA' },
  { id: 'anthropic:claude-opus-5-5', provider: 'anthropic', label: 'Claude Opus 5.5', price: '$4 / $20', note: 'Highest quality writing' },
  { id: 'anthropic:claude-haiku-5-5', provider: 'anthropic', label: 'Claude Haiku 5.5', price: '$0.10 / $0.50', note: 'Fast and cheap' },
  { id: 'openai:gpt-6.1-sol', provider: 'openai', label: 'GPT-6.1 Sol', price: '$2 / $10' },
  { id: 'openai:gpt-6.1-terra', provider: 'openai', label: 'GPT-6.1 Terra', price: '$1 / $5' },
  { id: 'openai:gpt-6-luna', provider: 'openai', label: 'GPT-6 Luna', price: '$0.10 / $0.50' },
  { id: 'openai:gpt-4o', provider: 'openai', label: 'GPT-4o', price: '$2.50 / $10', note: 'What the n8n brief used' },
  { id: 'google:gemini-3.8-flash', provider: 'google', label: 'Gemini 3.8 Flash', price: '$0.75 / $3.75' },
  { id: 'google:gemini-3.1-pro-preview', provider: 'google', label: 'Gemini 3.1 Pro (preview)', price: '$2 / $12' },
  { id: 'google:gemini-3.5-flash-lite', provider: 'google', label: 'Gemini 3.5 Flash-Lite', price: '$0.30 / $2.50' }
];
export const STAGE_DEFAULTS = { brief: 'anthropic:claude-sonnet-5-5', draft: 'anthropic:claude-sonnet-5-5', graphics: 'anthropic:claude-haiku-5-5', qa: 'anthropic:claude-sonnet-5-5' };
const STAGE_EFFORT = { brief: 'medium', draft: 'high', graphics: 'low', qa: 'medium' };
const MAX_OUTPUT = clamp(process.env.STUDIO_MAX_OUTPUT_TOKENS, 1024, 64000, 32000);
const IDLE_TIMEOUT = clamp(process.env.MODEL_IDLE_TIMEOUT_MS, 5000, 1800000, 180000);
const TOTAL_TIMEOUT = clamp(process.env.MODEL_TIMEOUT_MS, 30000, 3600000, 780000);
const OPENAI_BASE = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
const GEMINI_BASE = (process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/+$/, '');
const ANTHROPIC_BASE = process.env.ANTHROPIC_BASE_URL || undefined;
const LMSTUDIO_BASE = (process.env.LM_STUDIO_BASE_URL || 'http://127.0.0.1:1234/v1').replace(/\/+$/, '');

export class ModelUnavailable extends Error { constructor(message) { super(message); this.transient = true; } }

// ---------- settings ----------
const getSetting = (key) => getDb().prepare('SELECT value FROM settings WHERE key=?').get(key)?.value || '';
const setSetting = (key, value) => {
  if (value === '' || value == null) getDb().prepare('DELETE FROM settings WHERE key=?').run(key);
  else getDb().prepare('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)').run(key, String(value));
};
function savedKey(provider) {
  const sealed = getSetting(`cred:${provider}`);
  if (!sealed) return '';
  try { return decrypt(sealed); } catch { return ''; }
}
export function providerKey(provider) {
  const saved = savedKey(provider);
  if (saved) return saved;
  for (const name of PROVIDERS[provider]?.env || []) if (process.env[name]) return process.env[name];
  // Older Content Studio installs kept the Gemini key in plain text; still honour it.
  if (provider === 'google') return getSetting('gemini_api_key');
  return '';
}
export function stageModel(stage) { return getSetting(`model:${stage}`) || process.env[`STUDIO_MODEL_${stage.toUpperCase()}`] || STAGE_DEFAULTS[stage]; }
const parseModel = (id) => {
  const [provider, ...rest] = String(id || '').split(':');
  const model = rest.join(':');
  if (!model || !(provider in PROVIDERS || provider === 'lmstudio')) throw new Error(`Unknown model "${id}". Pick one in Settings.`);
  return { provider, model };
};

/** What the browser may know: which providers have a key (and where it came from), never the key. */
export function aiStatus() {
  const providers = Object.entries(PROVIDERS).map(([id, p]) => {
    const saved = savedKey(id), envName = p.env.find((n) => process.env[n]);
    return { id, label: p.label, keyHint: p.keyHint, docs: p.docs, configured: !!(saved || envName || (id === 'google' && getSetting('gemini_api_key'))),
      source: saved ? 'saved' : envName ? 'environment' : (id === 'google' && getSetting('gemini_api_key')) ? 'saved' : 'none', last4: saved ? saved.slice(-4) : '' };
  });
  const models = runtime.hosted ? MODELS : [...MODELS, { id: 'lmstudio:auto', provider: 'lmstudio', label: 'LM Studio (local model)', price: 'free', note: 'Only when LM Studio runs on this computer' }];
  return { providers, models, stages: Object.fromEntries(Object.keys(STAGE_DEFAULTS).map((s) => [s, stageModel(s)])), defaults: STAGE_DEFAULTS, hosted: runtime.hosted };
}
export function saveAiSettings(patch = {}) {
  if (patch.provider !== undefined) {
    const provider = String(patch.provider);
    if (!PROVIDERS[provider]) throw new Error('Unknown provider.');
    if (patch.clear === true) setSetting(`cred:${provider}`, '');
    else {
      const key = String(patch.key || '').trim();
      if (key.length < 12 || key.length > 400 || /\s/.test(key)) throw new Error('That does not look like an API key.');
      setSetting(`cred:${provider}`, encrypt(key));
      if (provider === 'google') setSetting('gemini_api_key', ''); // drop the legacy plain-text copy
    }
  }
  if (patch.stages && typeof patch.stages === 'object') {
    for (const [stage, id] of Object.entries(patch.stages)) {
      if (!(stage in STAGE_DEFAULTS)) continue;
      const value = String(id || '').trim().slice(0, 120);
      if (value) { parseModel(value); if (value.startsWith('lmstudio:') && runtime.hosted) throw new Error('LM Studio is only available when the studio runs on your own computer.'); }
      setSetting(`model:${stage}`, value === STAGE_DEFAULTS[stage] ? '' : value);
    }
  }
  return aiStatus();
}
/** Hide any key that might appear in an upstream error message. */
export function scrubKeys(message) {
  let out = String(message || '');
  for (const id of Object.keys(PROVIDERS)) { const k = providerKey(id); if (k && k.length > 8) out = out.split(k).join('[hidden]'); }
  return out;
}

// ---------- streaming helpers ----------
function timers(signal) {
  const ctl = new AbortController();
  const onOuter = () => ctl.abort(signal.reason);
  if (signal) { if (signal.aborted) throw signal.reason; signal.addEventListener('abort', onOuter, { once: true }); }
  let idle;
  const arm = () => { clearTimeout(idle); idle = setTimeout(() => ctl.abort(new Error(`The model sent nothing for ${Math.round(IDLE_TIMEOUT / 1000)}s.`)), IDLE_TIMEOUT); };
  const total = setTimeout(() => ctl.abort(new Error(`Generation exceeded ${Math.round(TOTAL_TIMEOUT / 60000)} minutes.`)), TOTAL_TIMEOUT);
  arm();
  return { signal: ctl.signal, arm, done() { clearTimeout(idle); clearTimeout(total); signal?.removeEventListener('abort', onOuter); },
    rethrow(e) { if (ctl.signal.aborted) throw (ctl.signal.reason instanceof Error ? ctl.signal.reason : new Error('Generation aborted.')); throw e; } };
}
async function* sseEvents(response, t) {
  const decoder = new TextDecoder(); let buffer = '';
  for await (const chunk of response.body) {
    t.arm(); buffer += decoder.decode(chunk, { stream: true });
    let cut;
    while ((cut = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, cut).trim(); buffer = buffer.slice(cut + 1);
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      try { yield JSON.parse(payload); } catch { /* keep-alive or partial */ }
    }
  }
}
async function httpError(r, provider) {
  let detail = ''; try { const j = await r.json(); detail = j.error?.message || j.message || JSON.stringify(j).slice(0, 300); } catch { try { detail = (await r.text()).slice(0, 300); } catch { } }
  const msg = `${PROVIDERS[provider]?.label || provider} returned HTTP ${r.status}: ${scrubKeys(detail)}`;
  if (r.status === 401 || r.status === 403) return new Error(`${msg} Check the ${PROVIDERS[provider].label} key in Settings.`);
  if (r.status === 429 || r.status >= 500) return new ModelUnavailable(msg);
  return new Error(msg);
}

// ---------- provider calls ----------
let AnthropicClass = null;
async function anthropicClient(apiKey) {
  if (!AnthropicClass) AnthropicClass = (await import('@anthropic-ai/sdk')).default;
  return new AnthropicClass({ apiKey, baseURL: ANTHROPIC_BASE, maxRetries: 2, timeout: TOTAL_TIMEOUT });
}
// Writer and QA verify claims themselves: Claude's server-side web search and fetch (dynamic filtering built in).
const RESEARCH_STAGES = new Set(['draft', 'qa']);
let researchOff = ''; // set when this Anthropic account cannot use the web tools; generation then continues without them
const researchTools = () => [
  { type: 'web_search_20260209', name: 'web_search', max_uses: clamp(process.env.STUDIO_MAX_SEARCHES, 1, 30, 10) },
  { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: clamp(process.env.STUDIO_MAX_FETCHES, 1, 30, 8) }
];
/** The finished artifact: text after the last research step, or, if the model wrote around its searches, everything from the first page line. */
function finalText(blocks, stage) {
  const text = (list) => list.filter((b) => b.type === 'text').map((b) => b.text).join('');
  const all = text(blocks);
  let last = -1; blocks.forEach((b, i) => { if (b.type === 'server_tool_use' || /_tool_result$/.test(b.type)) last = i; });
  const after = text(blocks.slice(last + 1));
  if (last < 0 || after.trim().length >= all.trim().length * 0.5) return last < 0 ? all : after;
  const start = stage === 'qa' ? all.search(/^\s*Verdict:/m) : all.search(/^\s*(\*\*Meta title|# )/m);
  return start > 0 ? all.slice(start) : all;
}
async function callAnthropic({ model, apiKey, system, user, stage, t, onText }) {
  const client = await anthropicClient(apiKey);
  const base = { model, max_tokens: MAX_OUTPUT, system, output_config: { effort: STAGE_EFFORT[stage] || 'medium' } };
  // Server-side refusal fallback where the model supports it (not Haiku).
  if (!/haiku/.test(model)) { base.betas = ['server-side-fallback-2026-07-01']; base.fallbacks = 'default'; }
  const useResearch = RESEARCH_STAGES.has(stage) && !researchOff && process.env.STUDIO_WEB_RESEARCH !== '0';
  const run = async (withTools) => {
    const messages = [{ role: 'user', content: user }];
    const blocks = []; let shown = '', final = null, searches = 0, fetches = 0;
    // A long research turn can pause (stop_reason pause_turn); sending the turn back lets the server continue it.
    for (let round = 0; round < 6; round++) {
      const stream = client.beta.messages.stream({ ...base, ...(withTools ? { tools: researchTools() } : {}), messages }, { signal: t.signal });
      for await (const ev of stream) {
        t.arm();
        if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') { shown += ev.delta.text; onText?.(shown); }
      }
      final = await stream.finalMessage();
      blocks.push(...final.content);
      for (const b of final.content) if (b.type === 'server_tool_use') { if (b.name === 'web_search') searches++; else if (b.name === 'web_fetch') fetches++; }
      if (final.stop_reason !== 'pause_turn') break;
      messages.push({ role: 'assistant', content: final.content });
    }
    if (final.stop_reason === 'refusal') throw new Error(`The model declined this request${final.stop_details?.explanation ? `: ${final.stop_details.explanation}` : '.'}`);
    return { output: finalText(blocks, stage), model: final.model || model, truncated: final.stop_reason === 'max_tokens', usage: final.usage, research: withTools ? { searches, fetches } : null };
  };
  try {
    try { return await run(useResearch); }
    catch (e) {
      // An account without web tools enabled: remember it, and write without research rather than fail every job.
      if (useResearch && e?.status === 400 && /web_(search|fetch)|server tool|tool[s]? (is|are) not|not enabled/i.test(String(e?.message))) {
        researchOff = scrubKeys(String(e.message)).slice(0, 200);
        console.error('Web research unavailable, continuing without it:', researchOff);
        return await run(false);
      }
      throw e;
    }
  } catch (e) {
    if (e?.status === 401 || e?.status === 403) throw new Error(`Anthropic rejected the API key (HTTP ${e.status}). Check it in Settings.`);
    if (e?.status === 429 || e?.status >= 500 || e?.name === 'APIConnectionError') throw new ModelUnavailable(`Anthropic is unavailable right now: ${scrubKeys(e.message)}`);
    t.rethrow(e);
  }
}
export const researchStatus = () => ({ stages: [...RESEARCH_STAGES], enabled: process.env.STUDIO_WEB_RESEARCH !== '0' && !researchOff, unavailable: researchOff });
async function callOpenAI({ model, apiKey, system, user, t, onText }) {
  let r;
  try {
    r = await fetch(`${OPENAI_BASE}/responses`, {
      method: 'POST', signal: t.signal,
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, instructions: system, input: user, max_output_tokens: MAX_OUTPUT, stream: true })
    });
  } catch (e) { if (t.signal.aborted) t.rethrow(e); throw new ModelUnavailable(`Could not reach OpenAI (${e.cause?.code || e.message}).`); }
  if (!r.ok) throw await httpError(r, 'openai');
  let text = '', truncated = false, served = model;
  try {
    for await (const ev of sseEvents(r, t)) {
      if (ev.type === 'response.output_text.delta' && typeof ev.delta === 'string') { text += ev.delta; onText?.(text); }
      else if (ev.type === 'response.completed' || ev.type === 'response.incomplete') { served = ev.response?.model || served; truncated = ev.type === 'response.incomplete'; }
      else if (ev.type === 'response.failed' || ev.type === 'error') throw new Error(`OpenAI error: ${scrubKeys(ev.response?.error?.message || ev.message || 'generation failed')}`);
    }
  } catch (e) { t.rethrow(e); }
  return { output: text, model: served, truncated };
}
async function callGemini({ model, apiKey, system, user, t, onText }) {
  let r;
  try {
    r = await fetch(`${GEMINI_BASE}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`, {
      method: 'POST', signal: t.signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: user }] }], generationConfig: { maxOutputTokens: MAX_OUTPUT } })
    });
  } catch (e) { if (t.signal.aborted) t.rethrow(e); throw new ModelUnavailable(`Could not reach Google Gemini (${e.cause?.code || e.message}).`); }
  if (!r.ok) throw await httpError(r, 'google');
  let text = '', finish = '';
  try {
    for await (const ev of sseEvents(r, t)) {
      const cand = ev.candidates?.[0];
      for (const part of cand?.content?.parts || []) if (typeof part.text === 'string' && !part.thought) { text += part.text; onText?.(text); }
      if (cand?.finishReason) finish = cand.finishReason;
      if (ev.promptFeedback?.blockReason) throw new Error(`Gemini blocked the request (${ev.promptFeedback.blockReason}).`);
    }
  } catch (e) { t.rethrow(e); }
  return { output: text, model, truncated: finish === 'MAX_TOKENS' };
}
async function callLmStudio({ model, system, user, t, onText }) {
  let r;
  try {
    let id = model;
    if (!id || id === 'auto') {
      const m = await fetch(`${LMSTUDIO_BASE}/models`, { signal: AbortSignal.timeout(6000) }).then((x) => x.json());
      id = process.env.LM_STUDIO_MODEL || m.data?.[0]?.id;
      if (!id) throw new ModelUnavailable('No model is loaded in LM Studio.');
    }
    r = await fetch(`${LMSTUDIO_BASE}/chat/completions`, {
      method: 'POST', signal: t.signal, headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({ model: id, stream: true, max_tokens: clamp(process.env.LM_STUDIO_MAX_TOKENS, 256, 32000, 3072), messages: [{ role: 'system', content: system }, { role: 'user', content: user }] })
    });
    model = id;
  } catch (e) { if (e?.transient) throw e; if (t.signal.aborted) t.rethrow(e); throw new ModelUnavailable(`LM Studio is not reachable at ${LMSTUDIO_BASE}.`); }
  if (!r.ok) throw new Error(`LM Studio HTTP ${r.status}`);
  // Some OpenAI-compatible servers ignore stream:true and answer with one JSON body.
  if (!(r.headers.get('content-type') || '').includes('text/event-stream')) {
    let body; try { body = await r.json(); } catch (e) { t.rethrow(e); }
    const c = body?.choices?.[0]; const text = String(c?.message?.content ?? '');
    if (text) onText?.(text);
    return { output: text, model, truncated: c?.finish_reason === 'length' };
  }
  let text = '', finish = '';
  try {
    for await (const ev of sseEvents(r, t)) {
      const c = ev.choices?.[0]; if (typeof c?.delta?.content === 'string') { text += c.delta.content; onText?.(text); }
      if (c?.finish_reason) finish = c.finish_reason;
    }
  } catch (e) { t.rethrow(e); }
  return { output: text, model, truncated: finish === 'length' };
}

/** Generate one stage with the model chosen for it. Streams text to onText as it arrives. */
export async function generate({ stage, system, user, signal, onText }) {
  const { provider, model } = parseModel(stageModel(stage));
  const apiKey = provider === 'lmstudio' ? '' : providerKey(provider);
  if (provider !== 'lmstudio' && !apiKey) throw new Error(`No ${PROVIDERS[provider].label} API key. Add one in Settings > AI models and keys.`);
  const t = timers(signal);
  try {
    const call = { anthropic: callAnthropic, openai: callOpenAI, google: callGemini, lmstudio: callLmStudio }[provider];
    const out = await call({ model, apiKey, system, user, stage, t, onText });
    return { ...out, research: out.research || null, model: `${provider === 'lmstudio' ? 'lmstudio' : provider}/${out.model}` };
  } finally { t.done(); }
}
/** Cheap check that a provider key works. */
export async function testProvider(provider) {
  const apiKey = providerKey(provider); if (!apiKey) throw new Error(`No ${PROVIDERS[provider]?.label || provider} key to test.`);
  const req = {
    anthropic: () => fetch(`${ANTHROPIC_BASE || 'https://api.anthropic.com'}/v1/models?limit=1`, { headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' } }),
    openai: () => fetch(`${OPENAI_BASE}/models`, { headers: { Authorization: `Bearer ${apiKey}` } }),
    google: () => fetch(`${GEMINI_BASE}/models?pageSize=1`, { headers: { 'x-goog-api-key': apiKey } })
  }[provider];
  if (!req) throw new Error('Unknown provider.');
  let r; try { r = await req(); } catch (e) { throw new Error(`Could not reach ${PROVIDERS[provider].label} (${e.cause?.code || e.message}).`); }
  if (!r.ok) throw await httpError(r, provider);
  return { ok: true, provider };
}
