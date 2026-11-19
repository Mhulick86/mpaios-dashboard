/**
 * The studio's HTTP API, independent of the server it runs in. server.mjs (a local Node server) and the MAIOS
 * route on Vercel (hosted.mjs) both turn their requests into the small shape below and send back what it returns.
 *
 *   request: { method, path, query: URLSearchParams, header(name) -> string, body(maxBytes) -> Promise<Buffer> }
 *   reply:   { status, json } | { status, body: Buffer|string, headers }
 */
import { randomUUID } from 'node:crypto';
import { VERSION } from './env.mjs';
import {
  getDb, getBootstrap, getTask, commission, updateTask, moveTask, addComment, addArtifact, approveTask,
  markPublished, queueJob, taskStats, exportData, event, getBrandProfiles, saveBrandProfiles,
  startPipeline, retryJob, getJob, setQaStatus, requestRevision, repetitionCorpus, STAGES
} from './db.mjs';
import { deterministicQa, modelVerdict, qaStatusFor } from './qa-checks.mjs';
import { modelCatalog, inspectTaskPrompt, cancelJob, liveOutput, workerInfo, workerClaim, workerProgress, workerDone, workerFailed } from './agents.mjs';
import {
  knowledgeStats, listKnowledge, getKnowledge, saveKnowledge, setKnowledgeEnabled, knowledgeHistory,
  importKnowledge, listAgents, saveAgent, listPlaybooks, getKnowledgeUsage
} from './knowledge.mjs';
import {
  integrationStatus, saveIntegrationSettings, testGemini, startImageGeneration, imageRun,
  googleAuthStart, googleAuthFinish, disconnectGoogle, syncDoc, taskDocs, allDocs, afterArtifact, recentImageRuns
} from './integrations.mjs';
import { aiStatus, saveAiSettings, testProvider } from './providers.mjs';
import { shipQueue, shipPackage, shipClaim, shipDone, shipFailed, shipSummaries } from './ship.mjs';
import { creditStatus, releaseRoutable, creditWatchTick } from './credit.mjs';
import { searchConsoleStatus, saveSearchConsole, testSearchConsole, searchConsoleContext } from './searchconsole.mjs';
import { runtime } from './runtime.mjs';
import { assets } from './assets.mjs';

const UPLOAD_TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'application/pdf': 'pdf' };
const ARTIFACT_TITLES = { brief: 'Editorial brief', draft: 'Content draft', graphics: 'Graphics directions', qa: 'Editorial QA report' };

export class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
export const json = (status, value, headers = {}) => ({ status, json: value, headers });
const fail = (status, message) => json(status, { error: message });

export async function parseJson(req, max = 4 * 1024 * 1024) {
  const buf = await req.body(max);
  if (buf.length > max) throw new HttpError(413, `Request exceeds ${Math.round(max / 1048576)} MB.`);
  const text = buf.toString('utf8');
  let value;
  try { value = text ? JSON.parse(text) : {}; } catch { throw new HttpError(400, 'Invalid JSON body.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, 'JSON body must be an object.');
  return value;
}
function guardText(s, min = 1, max = 12000) { if (typeof s !== 'string' || s.trim().length < min || s.length > max) throw new HttpError(400, `Text must contain ${min}-${max} characters.`); return s.trim(); }
// eslint-disable-next-line no-control-regex
const actorFrom = (req) => { let name = req.header('x-maios-actor') || ''; try { name = decodeURIComponent(name); } catch { } return name.replace(/[\u0000-\u001f]/g, '').trim().slice(0, 80) || 'Mike'; };

/** Plain Errors are validation messages meant for the operator. Anything else (TypeError, SQLite codes) is a bug. */
export function errorReply(e) {
  const unexpected = !(e instanceof HttpError) && (e?.code || e?.constructor !== Error) && !e?.cancelled;
  if (unexpected) console.error('API Error:', e);
  return fail(e?.status || (unexpected ? 500 : 400), String(e?.message || e));
}

async function assetReply(id) {
  const rec = getDb().prepare('SELECT * FROM assets WHERE id=?').get(id);
  if (!rec) return fail(404, 'Asset not found.');
  const data = await assets().read(rec.path);
  if (!data) return fail(404, 'File not found.');
  return { status: 200, body: data, headers: { 'Content-Type': rec.mime, 'Content-Length': String(data.length), 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox", 'Cache-Control': 'private, max-age=3600' } };
}

const escapeHtml = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** Google sends the browser back here after consent. No token header is possible on a redirect; the single-use state value is the proof. */
export async function googleCallback(query) {
  let ok = true, message = 'Google is connected. New drafts will get a Google Doc link automatically.';
  try { const status = await googleAuthFinish({ code: query.get('code'), state: query.get('state'), error: query.get('error') }); if (status.google.email) message = `Connected as ${status.google.email}. New drafts will get a Google Doc link automatically.`; }
  catch (e) { ok = false; message = String(e?.message || e); }
  const page = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MAIOS · Google connection</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0c1018;color:#e6ebf4;font:15px/1.6 system-ui,sans-serif}main{max-width:460px;padding:32px;border:1px solid #2c3547;border-radius:16px;background:#141a25}h1{font-size:20px;margin:0 0 10px}a{color:#8fd6f7}</style></head><body><main><h1>${ok ? 'Google connected' : 'Google was not connected'}</h1><p>${escapeHtml(message)}</p><p><a href="/">Back to the Content Studio</a></p></main></body></html>`;
  return { status: ok ? 200 : 400, body: page, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'" } };
}

const taskDetail = (id) => ({ ...getTask(id), docs: taskDocs(id), imageRun: imageRun(id) });
const settingsView = () => ({ autoGenerate: process.env.AUTO_GENERATE_ON_MOVE !== 'false', hosted: runtime.hosted, worker: workerInfo() });

/** Routes that only read. The hosted runtime serves these without uploading a new database snapshot. */
export const isReadOnly = (method, path) => method === 'GET' && !path.startsWith('/api/google/callback');

/**
 * @param req request in the shape described at the top of this file
 * @param ctx { googleRedirect?: string } extras only the local server can supply
 */
export async function handleApi(req, ctx = {}) {
  const { method, path, query } = req;
  const actor = actorFrom(req);
  if (method === 'GET' && path === '/api/health') return json(200, { ok: true, version: VERSION, stats: taskStats(), knowledge: knowledgeStats(), worker: workerInfo(), backend: runtime.hosted ? 'maios-hosted' : 'local-sqlite-fts5-and-node' });
  if (method === 'GET' && path === '/api/bootstrap') {
    const imageRuns = recentImageRuns();
    const jobs = getDb().prepare("SELECT status, COUNT(*) AS count FROM jobs WHERE status IN ('running', 'queued') GROUP BY status").all();
    const workload = {
      capacity: workerInfo().concurrency,
      running: jobs.find((row) => row.status === 'running')?.count || 0,
      queued: jobs.find((row) => row.status === 'queued')?.count || 0,
      images: imageRuns.filter((run) => run.status === 'running').length
    };
    return json(200, { ...getBootstrap(), docs: allDocs(), imageRuns, workload, ship: shipSummaries(), integrations: integrationStatus(), stats: taskStats(), ai: aiStatus(), searchConsole: searchConsoleStatus(), settings: settingsView(), credit: creditStatus() });
  }
  if (method === 'GET' && path === '/api/models') return json(200, await modelCatalog());

  // AI providers: keys are write-only from the browser's point of view. Status shows only whether one is set and its last 4 characters.
  if (method === 'GET' && path === '/api/ai') return json(200, aiStatus());
  // Saving a key, a backup or a stage model can give paused work somewhere to run: release it now, not at the next check.
  if (method === 'PATCH' && path === '/api/ai') { const out = saveAiSettings(await parseJson(req, 64 * 1024)); const released = releaseRoutable(); return json(200, { ...out, released }); }
  // Ship to dev: the site builder polls the queue, claims a ready batch, downloads packages and reports results.
  if (method === 'GET' && path === '/api/ship/queue') return json(200, shipQueue());
  if (method === 'POST' && path === '/api/ship/claim') { const body = await parseJson(req, 64 * 1024); return json(200, shipClaim(body.ids, body.batch, actor === 'Mike' ? 'MP site builder' : actor)); }
  const shipMatch = path.match(/^\/api\/ship\/([a-f0-9-]{36})(?:\/(done|failed))?$/);
  if (shipMatch) {
    const [, id, action] = shipMatch;
    if (!getTask(id)) return fail(404, 'Task not found.');
    if (!action && method === 'GET') return json(200, shipPackage(id));
    if (action === 'done' && method === 'POST') return json(200, shipDone(id, await parseJson(req, 16 * 1024)));
    if (action === 'failed' && method === 'POST') return json(200, shipFailed(id, (await parseJson(req, 16 * 1024)).reason));
  }
  // Search Console: service account key is write-only, like the AI keys.
  if (method === 'GET' && path === '/api/searchconsole') return json(200, searchConsoleStatus());
  if (method === 'PATCH' && path === '/api/searchconsole') return json(200, await saveSearchConsole(await parseJson(req, 32 * 1024)));
  if (method === 'POST' && path === '/api/searchconsole/test') return json(200, await testSearchConsole());
  // "Check now" on the paused banner: probe every paused provider at once instead of waiting for the 6-hourly check.
  if (method === 'POST' && path === '/api/credit/check') { const results = await creditWatchTick({ now: true }); return json(200, { results, credit: creditStatus() }); }
  if (method === 'POST' && path === '/api/ai/test') { const body = await parseJson(req, 4096); return json(200, await testProvider(String(body.provider || ''))); }

  if (method === 'GET' && path === '/api/brand') return json(200, getBrandProfiles());
  if (method === 'PATCH' && path === '/api/brand') return json(200, saveBrandProfiles(await parseJson(req)));
  if (method === 'GET' && path === '/api/integrations') return json(200, integrationStatus());
  if (method === 'PATCH' && path === '/api/integrations') return json(200, saveIntegrationSettings(await parseJson(req)));
  if (method === 'POST' && path === '/api/integrations/gemini/test') return json(200, await testGemini());
  if (method === 'POST' && path === '/api/google/start') {
    if (runtime.hosted || !ctx.googleRedirect) throw new HttpError(400, 'Google Docs sign-in is only available when the studio runs on your own computer.');
    // The redirect must be a loopback address on this machine: that is the only kind Google accepts for a desktop client.
    return json(200, googleAuthStart(ctx.googleRedirect));
  }
  if (method === 'POST' && path === '/api/google/disconnect') return json(200, disconnectGoogle());
  if (method === 'GET' && path === '/api/export') return json(200, { ...exportData(), knowledge: getDb().prepare('SELECT * FROM knowledge_items').all(), agents: listAgents(), playbooks: listPlaybooks() }, { 'Content-Disposition': 'attachment; filename="maios-content-studio-export.json"' });

  // Knowledge Base API: editable, source-tagged and indexed with SQLite FTS5.
  if (method === 'GET' && path === '/api/knowledge/stats') return json(200, knowledgeStats());
  if (method === 'GET' && path === '/api/knowledge') {
    return json(200, listKnowledge({ q: query.get('q') || '', category: query.get('category') || '', scope: query.get('scope') || '', limit: query.get('limit') || 100, offset: query.get('offset') || 0 }));
  }
  if (method === 'POST' && path === '/api/knowledge') return json(201, saveKnowledge(await parseJson(req), actor));
  if (method === 'POST' && path === '/api/knowledge/import') return json(201, importKnowledge(await parseJson(req, 2 * 1024 * 1024), actor));
  if (method === 'GET' && path === '/api/agents') return json(200, listAgents());
  if (method === 'GET' && path === '/api/playbooks') return json(200, listPlaybooks());
  const knowledgeMatch = path.match(/^\/api\/knowledge\/([a-f0-9-]{36})(?:\/(history|enabled))?$/);
  if (knowledgeMatch) {
    const [, id, action] = knowledgeMatch;
    if (action === 'history' && method === 'GET') return json(200, knowledgeHistory(id));
    if (action === 'enabled' && method === 'PATCH') return json(200, setKnowledgeEnabled(id, (await parseJson(req)).enabled));
    if (!action && method === 'GET') { const record = getKnowledge(id); if (!record) return fail(404, 'Knowledge record not found.'); return json(200, record); }
    if (!action && method === 'PATCH') return json(200, saveKnowledge({ ...await parseJson(req), id }, actor));
  }
  const agentMatch = path.match(/^\/api\/agents\/(brief|draft|graphics|qa)$/);
  if (agentMatch && method === 'PATCH') return json(200, saveAgent(agentMatch[1], await parseJson(req), actor));

  if (method === 'POST' && path === '/api/commission') return json(201, commission({ ...await parseJson(req), actor }));
  if (method === 'POST' && path === '/api/demo/clear') {
    const db = getDb(); const count = db.prepare('SELECT count(*) n FROM tasks WHERE demo=1').get().n;
    db.prepare('DELETE FROM tasks WHERE demo=1').run(); return json(200, { ok: true, removed: count });
  }
  const assetRead = path.match(/^\/api\/assets\/([a-f0-9-]{36})$/);
  if (assetRead && method === 'GET') return assetReply(assetRead[1]);

  // Local team worker: claims work for stages set to "Local team", keeps it alive while it runs, and reports the result.
  if (method === 'POST' && path === '/api/worker/claim') return json(200, await workerClaim());
  const workerMatch = path.match(/^\/api\/worker\/jobs\/([a-f0-9-]{36})\/(progress|done|failed)$/);
  if (workerMatch && method === 'POST') {
    const [, id, action] = workerMatch;
    const body = await parseJson(req, 2 * 1024 * 1024);
    const out = action === 'done' ? workerDone(id, body) : action === 'failed' ? workerFailed(id, body) : workerProgress(id, body);
    return out.error ? fail(out.error[0], out.error[1]) : json(200, out);
  }

  const jobMatch = path.match(/^\/api\/jobs\/([a-f0-9-]{36})\/(cancel|retry)$/);
  if (jobMatch && method === 'POST') {
    const [, id, action] = jobMatch;
    if (!getJob(id)) return fail(404, 'Job not found.');
    return json(200, { job: action === 'cancel' ? cancelJob(id) : retryJob(id) });
  }
  const campaignMatch = path.match(/^\/api\/campaigns\/([a-f0-9-]{36})\/pipeline$/);
  if (campaignMatch && method === 'POST') {
    const ids = getDb().prepare('SELECT id FROM tasks WHERE campaign_id=? AND archived=0').all(campaignMatch[1]).map((x) => x.id);
    if (!ids.length) return fail(404, 'Campaign not found.');
    return json(202, { jobs: ids.map((id) => startPipeline(id, null, actor)) });
  }

  const matched = path.match(/^\/api\/tasks\/([a-f0-9-]{36})(?:\/(move|comment|generate|pipeline|approve|publish|asset|archive|restore|artifact|context|sources|live|images|doc|revise|searchconsole|qa-recheck))?$/);
  if (matched) {
    const [, id, action] = matched;
    if (!getTask(id)) return fail(404, 'Task not found.');
    if (!action && method === 'GET') return json(200, taskDetail(id));
    if (action === 'revise' && method === 'POST') { const body = await parseJson(req); return json(202, { job: requestRevision(id, guardText(body.note, 3, 4000), actor) }); }
    if (action === 'images' && method === 'POST') return json(202, { run: startImageGeneration(id, actor) });
    if (action === 'doc' && method === 'POST') {
      if (runtime.hosted) throw new HttpError(400, 'Google Docs links are only available when the studio runs on your own computer.');
      const body = await parseJson(req); return json(200, await syncDoc(id, String(body.kind || 'draft'), actor));
    }
    if (action === 'context' && method === 'GET') return json(200, inspectTaskPrompt(id, query.get('kind') || 'draft'));
    if (action === 'sources' && method === 'GET') return json(200, getKnowledgeUsage(id));
    if (action === 'searchconsole' && method === 'GET') return json(200, await searchConsoleContext(getTask(id)));
    if (action === 'live' && method === 'GET') return json(200, { jobs: await liveOutput(id) });
    if (!action && method === 'PATCH') return json(200, updateTask(id, await parseJson(req), actor));
    if (action === 'move' && method === 'POST') {
      const body = await parseJson(req); const moved = moveTask(id, guardText(body.laneId, 2, 100), actor);
      const job = moved.autoAction ? queueJob(id, moved.autoAction) : null;
      return json(200, { task: moved.task, autoQueued: job });
    }
    if (action === 'comment' && method === 'POST') {
      const body = await parseJson(req); return json(201, addComment(id, guardText(body.text, 1, 12000), String(body.author || actor).slice(0, 100)));
    }
    if (action === 'artifact' && method === 'POST') {
      const body = await parseJson(req);
      const kind = String(body.kind || '');
      if (!STAGES.includes(kind)) throw new HttpError(400, 'Invalid artifact type.');
      addArtifact(id, kind, ARTIFACT_TITLES[kind], guardText(body.body, 1, 150000), 'manual', '', actor);
      if (kind === 'qa') setQaStatus(id, 'manual');
      afterArtifact(id, kind);
      return json(201, taskDetail(id));
    }
    if (action === 'generate' && method === 'POST') {
      const body = await parseJson(req); return json(202, { job: queueJob(id, guardText(body.kind, 2, 20), { fresh: body.fresh === true }) });
    }
    if (action === 'pipeline' && method === 'POST') {
      const body = await parseJson(req); return json(202, { job: startPipeline(id, body.from || null, actor) });
    }
    if (action === 'approve' && method === 'POST') { const body = await parseJson(req, 4096); return json(200, approveTask(id, actor, { override: body.override === true })); }
    // Re-score the latest QA under the current rules without a model call: fresh automatic checks plus the stored model verdict.
    if (action === 'qa-recheck' && method === 'POST') {
      const t = getTask(id), draft = t.artifacts.find((a) => a.kind === 'draft'), qa = t.artifacts.find((a) => a.kind === 'qa');
      if (!draft || !qa) throw new HttpError(400, 'There is no draft and QA report to recheck.');
      const verdict = modelVerdict(qa.body.split('## Local model review')[1] || qa.body);
      const det = deterministicQa(t, draft.body, repetitionCorpus(id));
      const { status, block } = qaStatusFor(det, verdict === 'FAIL' ? 'FAIL' : 'PASS');
      setQaStatus(id, status);
      event(id, 'qa', `QA rechecked (pass/fail rules, no model call): ${status === 'blocked' ? `FAIL: ${block.join(' ')}` : 'PASS'}`.slice(0, 900), actor);
      return json(200, { status, verdict, block });
    }
    if (action === 'publish' && method === 'POST') {
      const body = await parseJson(req); return json(200, markPublished(id, guardText(body.url, 8, 2000), actor));
    }
    if ((action === 'archive' || action === 'restore') && method === 'POST') {
      const archived = action === 'archive' ? 1 : 0;
      getDb().prepare('UPDATE tasks SET archived=?,updated_at=? WHERE id=?').run(archived, new Date().toISOString(), id);
      event(id, action === 'archive' ? 'archived' : 'restored', archived ? 'Task archived' : 'Task restored', actor);
      return json(200, { ok: true });
    }
    if (action === 'asset' && method === 'POST') {
      // Vercel accepts request bodies up to 4.5 MB, so the hosted studio takes files up to 3 MB (4 MB once base64 encoded).
      const maxMb = runtime.hosted ? 3 : 5;
      const body = await parseJson(req, runtime.hosted ? 4.4 * 1024 * 1024 : 8 * 1024 * 1024);
      const mime = String(body.mime || '');
      if (mime === 'image/svg+xml') throw new HttpError(400, 'SVG uploads are disabled for security. Use PNG or WEBP for creative assets.');
      if (!UPLOAD_TYPES[mime]) throw new HttpError(400, 'Only PNG, JPEG, WEBP and PDF attachments are supported.');
      const base64 = String(body.data || '');
      if (!/^[A-Za-z0-9+/=\r\n]+$/.test(base64) || base64.length > Math.ceil(maxMb * 1.4 * 1024 * 1024)) throw new HttpError(400, `Invalid or oversized asset (max ${maxMb} MB).`);
      const bin = Buffer.from(base64, 'base64'); if (bin.length > maxMb * 1024 * 1024 || bin.length < 10) throw new HttpError(400, `Asset must be between 10 bytes and ${maxMb} MB.`);
      const name = guardText(String(body.name || 'Creative asset'), 1, 200);
      const idAsset = randomUUID(), fileName = `${idAsset}.${UPLOAD_TYPES[mime]}`;
      await assets().write(fileName, bin);
      getDb().prepare('INSERT INTO assets (id,task_id,name,mime,path,size,created_at) VALUES (?,?,?,?,?,?,?)')
        .run(idAsset, id, name, mime, fileName, bin.length, new Date().toISOString());
      event(id, 'asset', 'Creative asset attached', actor, { name });
      return json(201, getTask(id));
    }
  }
  return fail(404, 'Endpoint not found.');
}
