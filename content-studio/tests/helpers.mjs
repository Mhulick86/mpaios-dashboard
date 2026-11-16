import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { createMockModel } from '../scripts/mock-model.mjs';

export const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export async function waitFor(fn, timeout = 20000, every = 80) {
  const deadline = Date.now() + timeout; let last;
  while (Date.now() < deadline) { try { const v = await fn(); if (v) return v; } catch (e) { last = e; } await sleep(every); }
  throw new Error('Timed out waiting for state change.' + (last ? ` Last error: ${last.message}` : ''));
}
const freePort = () => new Promise((ok, no) => { const s = createServer(); s.once('error', no); s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => ok(port)); }); });

/** Start a studio (and, unless model:false, a mock model) on free ports with a throwaway data directory. */
export async function startStudio(t, { env = {}, model = true, dataDir } = {}) {
  const dir = dataDir || mkdtempSync(join(tmpdir(), 'maios-v3-'));
  const mock = model ? createMockModel({ delayMs: 1 }) : null;
  const modelPort = mock ? await mock.listen(0) : 1;
  const port = await freePort();
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), DATA_DIR: dir, NO_DEMO_SEED: '1', LM_STUDIO_BASE_URL: `http://127.0.0.1:${modelPort}/v1`, AUTO_GENERATE_ON_MOVE: 'true', MAIOS_API_TOKEN: '', CORS_ORIGIN: '', ...env }
  });
  const logs = { stderr: '', stdout: '' };
  child.stderr.on('data', (c) => { logs.stderr += c; }); child.stdout.on('data', (c) => { logs.stdout += c; });
  const origin = `http://127.0.0.1:${port}`;
  const headers = { 'Content-Type': 'application/json', ...(env.MAIOS_API_TOKEN ? { 'X-MAIOS-Token': env.MAIOS_API_TOKEN } : {}) };
  async function api(path, method = 'GET', body, extra = {}) {
    const r = await fetch(origin + path, { method, headers: { ...headers, ...extra }, body: body === undefined ? undefined : JSON.stringify(body) });
    const data = await r.json();
    if (!r.ok) { const err = new Error(`${r.status}: ${data.error}`); err.status = r.status; throw err; }
    return data;
  }
  t.after(async () => { child.kill('SIGTERM'); if (mock) await mock.close(); if (!dataDir) rmSync(dir, { recursive: true, force: true }); });
  await waitFor(async () => (await api('/api/health')).ok, 15000);
  return { api, origin, mock, logs, dir, child, headers };
}
/** Collect Server-Sent Events from the studio until closed. */
export function collectEvents(origin, headers = {}) {
  const ctl = new AbortController(), events = [];
  const done = (async () => {
    const r = await fetch(origin + '/api/events', { headers, signal: ctl.signal });
    const decoder = new TextDecoder(); let buf = '';
    try {
      for await (const chunk of r.body) {
        buf += decoder.decode(chunk, { stream: true }); let i;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const block = buf.slice(0, i); buf = buf.slice(i + 2);
          const type = block.match(/^event: (.*)$/m)?.[1], data = block.match(/^data: (.*)$/m)?.[1];
          if (type && data) events.push({ type, data: JSON.parse(data) });
        }
      }
    } catch { /* aborted */ }
  })();
  return { events, close: async () => { ctl.abort(); await done; } };
}
