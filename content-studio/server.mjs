import http from 'node:http';
import { existsSync, mkdirSync, writeFileSync, statSync, createReadStream } from 'node:fs';
import { resolve, join, extname, normalize, basename } from 'node:path';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { ROOT, DATA_DIR, VERSION } from './env.mjs';
import {
  getDb, getBootstrap, getTask, commission, updateTask, moveTask, addComment, addArtifact, approveTask,
  markPublished, queueJob, taskStats, exportData, event, getBrandProfiles, saveBrandProfiles,
  startPipeline, retryJob, getJob, setQaStatus, requestRevision, STAGES
} from './db.mjs';
import { workerTick, modelCatalog, inspectTaskPrompt, cancelJob, liveOutput, workerInfo } from './agents.mjs';
import {
  initKnowledge, knowledgeStats, listKnowledge, getKnowledge, saveKnowledge, setKnowledgeEnabled, knowledgeHistory,
  importKnowledge, listAgents, saveAgent, listPlaybooks, getKnowledgeUsage
} from './knowledge.mjs';
import { subscribe, publish } from './events.mjs';
import {
  ensureIntegrationSchema, integrationStatus, saveIntegrationSettings, testGemini, startImageGeneration, imageRun,
  googleAuthStart, googleAuthFinish, disconnectGoogle, syncDoc, taskDocs, allDocs, afterArtifact
} from './integrations.mjs';

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 4173);
const TOKEN = process.env.MAIOS_API_TOKEN || '';
// One or more allowed browser origins, comma separated (for example the MAIOS site and Content Studio's own site).
const CORS_ORIGINS = (process.env.CORS_ORIGIN || '').split(',').map((o) => o.trim().replace(/\/$/, '')).filter(Boolean);
if (!['127.0.0.1', 'localhost', '::1'].includes(HOST) && !TOKEN) {
  console.error('SECURITY: MAIOS_API_TOKEN is required when binding outside loopback.'); process.exit(1);
}
const ASSET_DIR = join(DATA_DIR, 'assets');
const PUBLIC_DIR = resolve(join(ROOT, 'public'));
mkdirSync(ASSET_DIR, { recursive: true });
getDb();
initKnowledge();
ensureIntegrationSchema();

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.json': 'application/json' };
const UPLOAD_TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'application/pdf': 'pdf' };
const ARTIFACT_TITLES = { brief: 'Editorial brief', draft: 'Content draft', graphics: 'Graphics directions', qa: 'Editorial QA report' };
// The UI is plain same-origin modules and styles; it may call a separately hosted API when configured in Settings.
const PAGE_HEADERS = {
  'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self' http: https:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
};

class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }

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
function result(res, status, value, extra = {}) {
  const body = JSON.stringify(value);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra }); res.end(body);
}
function fail(res, status, message) { result(res, status, { error: message }); }
function authorized(req) {
  if (!TOKEN) return true;
  const actual = req.headers['x-maios-token'];
  if (typeof actual !== 'string') return false;
  const a = Buffer.from(actual), b = Buffer.from(TOKEN);
  return a.length === b.length && timingSafeEqual(a, b);
}
async function parseBody(req, max = 4 * 1024 * 1024) {
  const chunks = []; let len = 0;
  for await (const chunk of req) { len += chunk.length; if (len > max) throw new HttpError(413, `Request exceeds ${Math.round(max / 1048576)} MB.`); chunks.push(chunk); }
  const text = Buffer.concat(chunks).toString('utf8');
  let value;
  try { value = text ? JSON.parse(text) : {}; } catch { throw new HttpError(400, 'Invalid JSON body.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, 'JSON body must be an object.');
  return value;
}
function guardText(s, min = 1, max = 12000) { if (typeof s !== 'string' || s.trim().length < min || s.length > max) throw new HttpError(400, `Text must contain ${min}-${max} characters.`); return s.trim(); }
// eslint-disable-next-line no-control-regex
const actorFrom = (req) => { const raw = req.headers['x-maios-actor']; let name = typeof raw === 'string' ? raw : ''; try { name = decodeURIComponent(name); } catch { } return name.replace(/[\u0000-\u001f]/g, '').trim().slice(0, 80) || 'Mike'; };
const query = (req) => new URL(req.url, `http://${req.headers.host || 'localhost'}`).searchParams;

function handleAsset(res, id) {
  const rec = getDb().prepare('SELECT * FROM assets WHERE id=?').get(id);
  if (!rec) return fail(res, 404, 'Asset not found.');
  const path = resolve(ASSET_DIR, basename(rec.path));
  if (!path.startsWith(resolve(ASSET_DIR) + '/') || !existsSync(path)) return fail(res, 404, 'File not found.');
  res.writeHead(200, { 'Content-Type': rec.mime, 'Content-Length': statSync(path).size, 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox", 'Cache-Control': 'private, max-age=3600' });
  createReadStream(path).pipe(res);
}
/** Server-Sent Events: board changes, job status and model output as it is written. */
const streams = new Set();
function handleEvents(req, res) {
  res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  const send = (type, data) => res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
  send('hello', { version: VERSION });
  const off = subscribe(send);
  const beat = setInterval(() => res.write(': keep-alive\n\n'), 20000);
  streams.add(res);
  req.on('close', () => { off(); clearInterval(beat); streams.delete(res); });
}

const escapeHtml = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** Google sends the browser back here after consent. No token header is possible on a redirect; the single-use state value is the proof. */
async function handleGoogleCallback(req, res) {
  const q = query(req); let ok = true, message = 'Google is connected. New drafts will get a Google Doc link automatically.';
  try { const status = await googleAuthFinish({ code: q.get('code'), state: q.get('state'), error: q.get('error') }); if (status.google.email) message = `Connected as ${status.google.email}. New drafts will get a Google Doc link automatically.`; }
  catch (e) { ok = false; message = String(e?.message || e); }
  const page = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MAIOS · Google connection</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0c1018;color:#e6ebf4;font:15px/1.6 system-ui,sans-serif}main{max-width:460px;padding:32px;border:1px solid #2c3547;border-radius:16px;background:#141a25}h1{font-size:20px;margin:0 0 10px}a{color:#8fd6f7}</style></head><body><main><h1>${ok ? 'Google connected' : 'Google was not connected'}</h1><p>${escapeHtml(message)}</p><p><a href="/">Back to the Content Studio</a></p></main></body></html>`;
  res.writeHead(ok ? 200 : 400, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'" });
  res.end(page);
}
const taskDetail = (id) => ({ ...getTask(id), docs: taskDocs(id), imageRun: imageRun(id) });

async function handleApi(req, res, path) {
  if ((req.method || 'GET') === 'GET' && path === '/api/google/callback') return handleGoogleCallback(req, res);
  if (!authorized(req)) return fail(res, 401, 'API authorization required. Add the access token in Studio Settings.');
  const method = req.method || 'GET';
  const actor = actorFrom(req);
  if (method === 'GET' && path === '/api/events') return handleEvents(req, res);
  if (method === 'GET' && path === '/api/health') return result(res, 200, { ok: true, version: VERSION, stats: taskStats(), knowledge: knowledgeStats(), worker: workerInfo(), backend: 'local-sqlite-fts5-and-node' });
  if (method === 'GET' && path === '/api/bootstrap') return result(res, 200, { ...getBootstrap(), docs: allDocs(), integrations: integrationStatus(), stats: taskStats(), settings: { autoGenerate: process.env.AUTO_GENERATE_ON_MOVE !== 'false', lmStudioBaseUrl: process.env.LM_STUDIO_BASE_URL || 'http://127.0.0.1:1234/v1', worker: workerInfo() } });
  if (method === 'GET' && path === '/api/models') return result(res, 200, await modelCatalog({ fresh: true }));
  if (method === 'GET' && path === '/api/brand') return result(res, 200, getBrandProfiles());
  if (method === 'PATCH' && path === '/api/brand') return result(res, 200, saveBrandProfiles(await parseBody(req)));
  if (method === 'GET' && path === '/api/integrations') return result(res, 200, integrationStatus());
  if (method === 'PATCH' && path === '/api/integrations') return result(res, 200, saveIntegrationSettings(await parseBody(req)));
  if (method === 'POST' && path === '/api/integrations/gemini/test') return result(res, 200, await testGemini());
  // The redirect must be a loopback address on this machine: that is the only kind Google accepts for a desktop client.
  if (method === 'POST' && path === '/api/google/start') return result(res, 200, googleAuthStart(`http://127.0.0.1:${PORT}/api/google/callback`));
  if (method === 'POST' && path === '/api/google/disconnect') return result(res, 200, disconnectGoogle());
  if (method === 'GET' && path === '/api/export') return result(res, 200, { ...exportData(), knowledge: getDb().prepare('SELECT * FROM knowledge_items').all(), agents: listAgents(), playbooks: listPlaybooks() }, { 'Content-Disposition': 'attachment; filename="maios-content-studio-export.json"' });

  // Knowledge Base API: editable, source-tagged and indexed locally with SQLite FTS5.
  if (method === 'GET' && path === '/api/knowledge/stats') return result(res, 200, knowledgeStats());
  if (method === 'GET' && path === '/api/knowledge') {
    const q = query(req);
    return result(res, 200, listKnowledge({ q: q.get('q') || '', category: q.get('category') || '', scope: q.get('scope') || '', limit: q.get('limit') || 100, offset: q.get('offset') || 0 }));
  }
  if (method === 'POST' && path === '/api/knowledge') return result(res, 201, saveKnowledge(await parseBody(req), actor));
  if (method === 'POST' && path === '/api/knowledge/import') return result(res, 201, importKnowledge(await parseBody(req, 2 * 1024 * 1024), actor));
  if (method === 'GET' && path === '/api/agents') return result(res, 200, listAgents());
  if (method === 'GET' && path === '/api/playbooks') return result(res, 200, listPlaybooks());
  const knowledgeMatch = path.match(/^\/api\/knowledge\/([a-f0-9-]{36})(?:\/(history|enabled))?$/);
  if (knowledgeMatch) {
    const [, id, action] = knowledgeMatch;
    if (action === 'history' && method === 'GET') return result(res, 200, knowledgeHistory(id));
    if (action === 'enabled' && method === 'PATCH') return result(res, 200, setKnowledgeEnabled(id, (await parseBody(req)).enabled));
    if (!action && method === 'GET') { const record = getKnowledge(id); if (!record) return fail(res, 404, 'Knowledge record not found.'); return result(res, 200, record); }
    if (!action && method === 'PATCH') return result(res, 200, saveKnowledge({ ...await parseBody(req), id }, actor));
  }
  const agentMatch = path.match(/^\/api\/agents\/(brief|draft|graphics|qa)$/);
  if (agentMatch && method === 'PATCH') return result(res, 200, saveAgent(agentMatch[1], await parseBody(req), actor));

  if (method === 'POST' && path === '/api/commission') {
    const payload = await parseBody(req); return result(res, 201, commission({ ...payload, actor }));
  }
  if (method === 'POST' && path === '/api/demo/clear') {
    const db = getDb(); const count = db.prepare('SELECT count(*) n FROM tasks WHERE demo=1').get().n;
    db.prepare('DELETE FROM tasks WHERE demo=1').run(); return result(res, 200, { ok: true, removed: count });
  }
  const assetRead = path.match(/^\/api\/assets\/([a-f0-9-]{36})$/);
  if (assetRead && method === 'GET') return handleAsset(res, assetRead[1]);

  const jobMatch = path.match(/^\/api\/jobs\/([a-f0-9-]{36})\/(cancel|retry)$/);
  if (jobMatch && method === 'POST') {
    const [, id, action] = jobMatch;
    if (!getJob(id)) return fail(res, 404, 'Job not found.');
    return result(res, 200, { job: action === 'cancel' ? cancelJob(id) : retryJob(id) });
  }
  const campaignMatch = path.match(/^\/api\/campaigns\/([a-f0-9-]{36})\/pipeline$/);
  if (campaignMatch && method === 'POST') {
    const ids = getDb().prepare('SELECT id FROM tasks WHERE campaign_id=? AND archived=0').all(campaignMatch[1]).map((x) => x.id);
    if (!ids.length) return fail(res, 404, 'Campaign not found.');
    return result(res, 202, { jobs: ids.map((id) => startPipeline(id, null, actor)) });
  }

  const matched = path.match(/^\/api\/tasks\/([a-f0-9-]{36})(?:\/(move|comment|generate|pipeline|approve|publish|asset|archive|restore|artifact|context|sources|live|images|doc|revise))?$/);
  if (matched) {
    const [, id, action] = matched;
    if (!getTask(id)) return fail(res, 404, 'Task not found.');
    if (!action && method === 'GET') return result(res, 200, taskDetail(id));
    if (action === 'revise' && method === 'POST') { const body = await parseBody(req); return result(res, 202, { job: requestRevision(id, guardText(body.note, 3, 4000), actor) }); }
    if (action === 'images' && method === 'POST') return result(res, 202, { run: startImageGeneration(id, actor) });
    if (action === 'doc' && method === 'POST') { const body = await parseBody(req); return result(res, 200, await syncDoc(id, String(body.kind || 'draft'), actor)); }
    if (action === 'context' && method === 'GET') return result(res, 200, inspectTaskPrompt(id, query(req).get('kind') || 'draft'));
    if (action === 'sources' && method === 'GET') return result(res, 200, getKnowledgeUsage(id));
    if (action === 'live' && method === 'GET') return result(res, 200, { jobs: liveOutput(id) });
    if (!action && method === 'PATCH') return result(res, 200, updateTask(id, await parseBody(req), actor));
    if (action === 'move' && method === 'POST') {
      const body = await parseBody(req); const moved = moveTask(id, guardText(body.laneId, 2, 100), actor);
      const job = moved.autoAction ? queueJob(id, moved.autoAction) : null;
      return result(res, 200, { task: moved.task, autoQueued: job });
    }
    if (action === 'comment' && method === 'POST') {
      const body = await parseBody(req); return result(res, 201, addComment(id, guardText(body.text, 1, 12000), String(body.author || actor).slice(0, 100)));
    }
    if (action === 'artifact' && method === 'POST') {
      const body = await parseBody(req);
      const kind = String(body.kind || '');
      if (!STAGES.includes(kind)) throw new HttpError(400, 'Invalid artifact type.');
      addArtifact(id, kind, ARTIFACT_TITLES[kind], guardText(body.body, 1, 150000), 'manual', '', actor);
      if (kind === 'qa') setQaStatus(id, 'manual');
      afterArtifact(id, kind);
      return result(res, 201, taskDetail(id));
    }
    if (action === 'generate' && method === 'POST') {
      const body = await parseBody(req); return result(res, 202, { job: queueJob(id, guardText(body.kind, 2, 20), { fresh: body.fresh === true }) });
    }
    if (action === 'pipeline' && method === 'POST') {
      const body = await parseBody(req); return result(res, 202, { job: startPipeline(id, body.from || null, actor) });
    }
    if (action === 'approve' && method === 'POST') return result(res, 200, approveTask(id, actor));
    if (action === 'publish' && method === 'POST') {
      const body = await parseBody(req); return result(res, 200, markPublished(id, guardText(body.url, 8, 2000), actor));
    }
    if ((action === 'archive' || action === 'restore') && method === 'POST') {
      const archived = action === 'archive' ? 1 : 0;
      getDb().prepare('UPDATE tasks SET archived=?,updated_at=? WHERE id=?').run(archived, new Date().toISOString(), id);
      event(id, action === 'archive' ? 'archived' : 'restored', archived ? 'Task archived' : 'Task restored', actor);
      return result(res, 200, { ok: true });
    }
    if (action === 'asset' && method === 'POST') {
      const body = await parseBody(req, 8 * 1024 * 1024);
      const mime = String(body.mime || '');
      if (mime === 'image/svg+xml') throw new HttpError(400, 'SVG uploads are disabled for security. Use PNG or WEBP for creative assets.');
      if (!UPLOAD_TYPES[mime]) throw new HttpError(400, 'Only PNG, JPEG, WEBP and PDF attachments are supported.');
      const base64 = String(body.data || '');
      if (!/^[A-Za-z0-9+/=\r\n]+$/.test(base64) || base64.length > 7 * 1024 * 1024) throw new HttpError(400, 'Invalid or oversized asset (max 5 MB).');
      const bin = Buffer.from(base64, 'base64'); if (bin.length > 5 * 1024 * 1024 || bin.length < 10) throw new HttpError(400, 'Asset must be between 10 bytes and 5 MB.');
      const name = guardText(String(body.name || 'Creative asset'), 1, 200);
      const idAsset = randomUUID(), fileName = `${idAsset}.${UPLOAD_TYPES[mime]}`;
      writeFileSync(join(ASSET_DIR, fileName), bin, { flag: 'wx' });
      getDb().prepare('INSERT INTO assets (id,task_id,name,mime,path,size,created_at) VALUES (?,?,?,?,?,?,?)')
        .run(idAsset, id, name, mime, fileName, bin.length, new Date().toISOString());
      event(id, 'asset', 'Creative asset attached', actor, { name });
      return result(res, 201, getTask(id));
    }
  }
  return fail(res, 404, 'Endpoint not found.');
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
  let path; try { path = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`).pathname; } catch { return fail(res, 400, 'Invalid URL.'); }
  try {
    if (path.startsWith('/api/')) {
      await handleApi(req, res, path);
      // Knowledge, agent and brand edits do not raise task events; tell other open tabs something changed.
      if (req.method !== 'GET' && res.statusCode < 400) publish('changed', { path });
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return fail(res, 405, 'Method not allowed.');
    return servePublic(res, path);
  } catch (e) {
    // Plain Errors are validation messages meant for the operator. Anything else (TypeError, SQLite codes) is a bug: log it.
    const unexpected = !(e instanceof HttpError) && (e?.code || e?.constructor !== Error);
    if (unexpected) console.error('API Error:', e);
    if (res.headersSent) return res.end();
    return fail(res, e?.status || (unexpected ? 500 : 400), String(e?.message || e));
  }
});
server.listen(PORT, HOST, () => {
  console.log(`\nMAIOS Content Studio v${VERSION}: http://${HOST}:${PORT}`);
  console.log(`SQLite: ${join(DATA_DIR, 'content-studio.sqlite')}`);
  console.log(`Model server: ${process.env.LM_STUDIO_BASE_URL || 'http://127.0.0.1:1234/v1'}`);
  console.log('No n8n, no cloud model required.\n');
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
