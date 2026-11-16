import http from 'node:http';
import { existsSync, statSync, createReadStream } from 'node:fs';
import { resolve, join, extname, normalize } from 'node:path';
import { timingSafeEqual } from 'node:crypto';
import { ROOT, DATA_DIR, VERSION } from './env.mjs';
import { getDb } from './db.mjs';
import { workerTick } from './agents.mjs';
import { initKnowledge } from './knowledge.mjs';
import { subscribe, publish } from './events.mjs';
import { ensureIntegrationSchema } from './integrations.mjs';
import { handleApi, googleCallback, errorReply } from './core.mjs';

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 4173);
const TOKEN = process.env.MAIOS_API_TOKEN || '';
// One or more allowed browser origins, comma separated (for example the MAIOS site and Content Studio's own site).
const CORS_ORIGINS = (process.env.CORS_ORIGIN || '').split(',').map((o) => o.trim().replace(/\/$/, '')).filter(Boolean);
if (!['127.0.0.1', 'localhost', '::1'].includes(HOST) && !TOKEN) {
  console.error('SECURITY: MAIOS_API_TOKEN is required when binding outside loopback.'); process.exit(1);
}
const PUBLIC_DIR = resolve(join(ROOT, 'public'));
getDb();
initKnowledge();
ensureIntegrationSchema();

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.json': 'application/json' };
// The UI is plain same-origin modules and styles; it may call a separately hosted API when configured in Settings.
const PAGE_HEADERS = {
  'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self' http: https:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
};

function addCors(req, res) {
  const origin = req.headers.origin || '';
  if (origin && CORS_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    // X-MAIOS-Actor is sent on every UI request; leaving it out here fails every cross-origin preflight.
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, X-MAIOS-Token, X-MAIOS-Actor');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
    // Chrome sends this preflight question when a hosted page (the Vercel UI) calls a backend on the same machine or LAN.
    if (req.headers['access-control-request-private-network']) res.setHeader('Access-Control-Allow-Private-Network', 'true');
    res.setHeader('Access-Control-Max-Age', '600');
  }
}
function send(res, reply) {
  if (reply.json !== undefined) {
    res.writeHead(reply.status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...reply.headers });
    return res.end(JSON.stringify(reply.json));
  }
  res.writeHead(reply.status, reply.headers || {}); res.end(reply.body);
}
const fail = (res, status, message) => send(res, { status, json: { error: message } });
function authorized(req) {
  if (!TOKEN) return true;
  const actual = req.headers['x-maios-token'];
  if (typeof actual !== 'string') return false;
  const a = Buffer.from(actual), b = Buffer.from(TOKEN);
  return a.length === b.length && timingSafeEqual(a, b);
}
/** Node request -> the server-independent request shape core.mjs expects. */
function toRequest(req, url) {
  let cached;
  return {
    method: req.method || 'GET', path: url.pathname, query: url.searchParams,
    header: (name) => { const v = req.headers[name.toLowerCase()]; return typeof v === 'string' ? v : ''; },
    async body(max) {
      if (cached) return cached;
      const chunks = []; let len = 0;
      for await (const chunk of req) { len += chunk.length; if (len > max) return (cached = Buffer.alloc(max + 1)); chunks.push(chunk); }
      return (cached = Buffer.concat(chunks));
    }
  };
}

/** Server-Sent Events: board changes, job status and model output as it is written. */
const streams = new Set();
function handleEvents(req, res) {
  res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  const write = (type, data) => res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
  write('hello', { version: VERSION });
  const off = subscribe(write);
  const beat = setInterval(() => res.write(': keep-alive\n\n'), 20000);
  streams.add(res);
  req.on('close', () => { off(); clearInterval(beat); streams.delete(res); });
}

function servePublic(res, pathname) {
  let requested = pathname === '/' ? '/index.html' : pathname;
  try { requested = decodeURIComponent(requested); } catch { return fail(res, 400, 'Invalid path.'); }
  const path = resolve(PUBLIC_DIR, '.' + normalize(requested));
  if (!path.startsWith(PUBLIC_DIR + '/')) return fail(res, 403, 'Forbidden path.');
  if (!existsSync(path) || !statSync(path).isFile()) return fail(res, 404, 'Not found.');
  // no-cache = always revalidate, so an upgraded UI is never mixed with stale scripts.
  res.writeHead(200, { 'Content-Type': MIME[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-cache', ...PAGE_HEADERS });
  createReadStream(path).pipe(res);
}
const server = http.createServer(async (req, res) => {
  addCors(req, res);
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  let url; try { url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`); } catch { return fail(res, 400, 'Invalid URL.'); }
  const path = url.pathname;
  try {
    if (path.startsWith('/api/')) {
      if (req.method === 'GET' && path === '/api/google/callback') return send(res, await googleCallback(url.searchParams));
      if (!authorized(req)) return fail(res, 401, 'API authorization required. Add the access token in Studio Settings.');
      if (req.method === 'GET' && path === '/api/events') return handleEvents(req, res);
      const reply = await handleApi(toRequest(req, url), { googleRedirect: `http://127.0.0.1:${PORT}/api/google/callback` });
      send(res, reply);
      // Knowledge, agent and brand edits do not raise task events; tell other open tabs something changed.
      if (req.method !== 'GET' && reply.status < 400) publish('changed', { path });
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return fail(res, 405, 'Method not allowed.');
    return servePublic(res, path);
  } catch (e) {
    if (res.headersSent) return res.end();
    return send(res, errorReply(e));
  }
});
server.listen(PORT, HOST, () => {
  console.log(`\nMAIOS Content Studio v${VERSION}: http://${HOST}:${PORT}`);
  console.log(`SQLite: ${join(DATA_DIR, 'content-studio.sqlite')}`);
  console.log('Models: set provider keys and the model for each stage in Settings > AI models & API keys.\n');
});
const tick = () => workerTick().catch((err) => console.error('Worker:', err));
// Start work the moment a job is queued; the interval only picks up delayed retries and restarts.
subscribe((type, data) => { if (type === 'job' && data.status === 'queued') setImmediate(tick); });
const timer = setInterval(tick, 3000);
timer.unref();
tick();
function shutdown() {
  clearInterval(timer);
  for (const res of streams) res.end();
  server.close(() => process.exit(0));
  server.closeAllConnections?.();
  setTimeout(() => process.exit(0), 1500).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
