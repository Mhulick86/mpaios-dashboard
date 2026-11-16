import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { startStudio, waitFor, collectEvents } from './helpers.mjs';

const order = (extra = {}) => ({ topic: 'Owned measurement for regional hospital groups', outputs: ['website'], voice: 'company', audience: 'Hospital CMOs', objective: 'Explain ownership', primary_keyword: 'owned measurement', word_count: 300, graphics_count: 1, ...extra });
const kinds = (task) => [...new Set(task.artifacts.map((a) => a.kind))].sort();

test('autopilot runs every stage, streams output live, and stops at the human gate', async (t) => {
  const s = await startStudio(t);
  const sse = collectEvents(s.origin);
  await waitFor(() => sse.events.some((e) => e.type === 'hello'));
  const created = await s.api('/api/commission', 'POST', order({ outputs: ['website', 'linkedin'], autostart: true }), { 'X-MAIOS-Actor': 'Emily' });
  assert.equal(created.autoQueued, 2);
  const [web, social] = ['website', 'linkedin'].map((c) => created.tasks.find((x) => x.channel === c));
  const doneWeb = await waitFor(async () => { const x = await s.api(`/api/tasks/${web.id}`); return x.lane_id === 'mpfresh:final_approval' && x.artifacts.some((a) => a.kind === 'qa') ? x : false; });
  const doneSocial = await waitFor(async () => { const x = await s.api(`/api/tasks/${social.id}`); return x.lane_id === 'social:final_approval' && x.artifacts.some((a) => a.kind === 'qa') ? x : false; });
  assert.deepEqual(kinds(doneWeb), ['brief', 'draft', 'graphics', 'qa']);
  assert.deepEqual(kinds(doneSocial), ['brief', 'draft', 'graphics', 'qa']);
  assert(!doneWeb.approved_at, 'autopilot must never approve');
  assert(doneWeb.events.some((e) => e.event_type === 'pipeline' && /Waiting for human approval/.test(e.message)));
  assert(doneWeb.events.some((e) => e.event_type === 'created' && e.actor === 'Emily'), 'actor header is recorded');
  assert(['review', 'pass'].includes(doneWeb.qa_status));
  assert(s.mock.requests.every((r) => r.stream === true), 'generation requests use streaming');

  // Progress deltas reassemble into exactly the saved draft.
  await waitFor(() => sse.events.some((e) => e.type === 'job' && e.data.taskId === social.id && e.data.kind === 'qa' && e.data.status === 'done'));
  await sse.close();
  const draftJob = doneWeb.jobs.find((j) => j.kind === 'draft');
  let text = '';
  for (const e of sse.events.filter((x) => x.type === 'progress' && x.data.jobId === draftJob.id)) text = text.slice(0, e.data.offset) + e.data.delta;
  assert.equal(text.trim(), doneWeb.artifacts.find((a) => a.kind === 'draft').body);
  assert(sse.events.filter((x) => x.type === 'progress' && x.data.jobId === draftJob.id).length > 1, 'output arrived in more than one chunk');

  // Human approval then works, and a live URL can only be recorded through the gated action.
  const patched = await s.api(`/api/tasks/${web.id}`, 'PATCH', { published_url: 'https://evil.example/bypass', priority: 'P0' });
  assert.equal(patched.published_url, null); assert.equal(patched.priority, 'P0');
  await assert.rejects(s.api(`/api/tasks/${web.id}`, 'PATCH', { priority: 'URGENT' }), /Priority/);
  const approved = await s.api(`/api/tasks/${web.id}/approve`, 'POST', {});
  assert.equal(approved.lane_id, 'mpfresh:ship_dev'); assert(approved.approved_at);
  assert(!s.logs.stderr.includes('Error'), s.logs.stderr);
});

test('QA gate blocks unresolved [VERIFY] markers and a FAIL verdict; reasoning is stripped', async (t) => {
  const s = await startStudio(t);
  const { tasks: [task] } = await s.api('/api/commission', 'POST', order({ topic: 'UNVERIFIED THINKCASE attribution savings for clinics' }));
  await s.api(`/api/tasks/${task.id}/pipeline`, 'POST', {});
  let done = await waitFor(async () => { const x = await s.api(`/api/tasks/${task.id}`); return x.lane_id === 'mpfresh:final_approval' && x.artifacts.some((a) => a.kind === 'qa') ? x : false; });
  assert.equal(done.qa_status, 'blocked');
  assert(done.artifacts.every((a) => !/<think>|private reasoning/.test(a.body)), 'reasoning blocks never reach artifacts');
  const qa = done.artifacts.find((a) => a.kind === 'qa');
  assert.match(qa.body, /- BLOCK: 1 unresolved \[VERIFY\] marker/);
  await assert.rejects(s.api(`/api/tasks/${task.id}/approve`, 'POST', {}), /blocking issues/);

  // Editor resolves the claim by hand: QA goes stale, approval refuses until QA is rerun.
  const draft = done.artifacts.find((a) => a.kind === 'draft');
  const fixed = await s.api(`/api/tasks/${task.id}/artifact`, 'POST', { kind: 'draft', body: draft.body.replace(/\n\n\[VERIFY\][^\n]*/, '') });
  assert.equal(fixed.qa_status, 'stale');
  await assert.rejects(s.api(`/api/tasks/${task.id}/approve`, 'POST', {}), /draft changed after QA/);
  await s.api(`/api/tasks/${task.id}/generate`, 'POST', { kind: 'qa' });
  done = await waitFor(async () => { const x = await s.api(`/api/tasks/${task.id}`); return x.artifacts.filter((a) => a.kind === 'qa').length === 2 && !x.jobs.some((j) => ['queued', 'running'].includes(j.status)) ? x : false; });
  assert.equal(done.qa_status, 'review');
  assert((await s.api(`/api/tasks/${task.id}/approve`, 'POST', {})).approved_at);

  const { tasks: [bad] } = await s.api('/api/commission', 'POST', order({ topic: 'FAILCASE unsupported client outcome story' }));
  await s.api(`/api/tasks/${bad.id}/pipeline`, 'POST', {});
  const failed = await waitFor(async () => { const x = await s.api(`/api/tasks/${bad.id}`); return x.artifacts.some((a) => a.kind === 'qa') && x.lane_id === 'mpfresh:final_approval' ? x : false; });
  assert.equal(failed.qa_status, 'blocked');
  assert.match(failed.artifacts.find((a) => a.kind === 'qa').body, /BLOCK: The editorial QA model rated the draft FAIL/);
  await assert.rejects(s.api(`/api/tasks/${bad.id}/approve`, 'POST', {}), /blocking issues/);
  // A documented human override exists: a manual QA sign-off.
  await s.api(`/api/tasks/${bad.id}/artifact`, 'POST', { kind: 'qa', body: 'Manual sign-off: source for the outcome is on file with the client approval email.' });
  assert((await s.api(`/api/tasks/${bad.id}/approve`, 'POST', {})).approved_at);
});

test('reviewer feedback and QA findings drive a revision instead of a blind rewrite', async (t) => {
  const s = await startStudio(t, { env: { AUTO_GENERATE_ON_MOVE: 'false' } });
  const { tasks: [task] } = await s.api('/api/commission', 'POST', order({ outputs: ['linkedin'] }));
  const first = await s.api(`/api/tasks/${task.id}/context?kind=draft`);
  assert.equal(first.mode, 'new'); assert(!first.user.includes('CURRENT DRAFT'));
  await s.api(`/api/tasks/${task.id}/generate`, 'POST', { kind: 'draft' });
  await waitFor(async () => (await s.api(`/api/tasks/${task.id}`)).artifacts.some((a) => a.kind === 'draft'));
  await s.api(`/api/tasks/${task.id}/generate`, 'POST', { kind: 'qa' });
  await waitFor(async () => (await s.api(`/api/tasks/${task.id}`)).artifacts.some((a) => a.kind === 'qa'));
  await s.api(`/api/tasks/${task.id}/comment`, 'POST', { text: 'Open with the finance angle, not the technology.', author: 'Emily' });

  const ctx = await s.api(`/api/tasks/${task.id}/context?kind=draft`);
  assert.equal(ctx.mode, 'revise'); assert.equal(ctx.openFeedback, 1);
  assert(ctx.user.startsWith('Revise the CURRENT DRAFT'));
  assert(ctx.user.includes('REVIEWER FEEDBACK TO ADDRESS') && ctx.user.includes('Emily: Open with the finance angle'));
  assert(ctx.user.includes('LATEST QA FINDINGS ON THE CURRENT DRAFT') && ctx.user.includes('CURRENT DRAFT:'));

  await s.api(`/api/tasks/${task.id}/generate`, 'POST', { kind: 'draft' });
  const revised = await waitFor(async () => { const x = await s.api(`/api/tasks/${task.id}`); return x.artifacts.filter((a) => a.kind === 'draft').length === 2 ? x : false; });
  assert.equal(s.mock.requests.at(-1).stage, 'revise');
  assert(s.mock.requests.at(-1).user.includes('Open with the finance angle'));
  assert.match(revised.artifacts.find((a) => a.kind === 'draft').body, /This revision addresses the reviewer feedback/);
  // The comment predates the new draft, so it is now considered handled; "fresh" ignores the old draft entirely.
  assert.equal((await s.api(`/api/tasks/${task.id}/context?kind=draft`)).openFeedback, 0);
  await s.api(`/api/tasks/${task.id}/generate`, 'POST', { kind: 'draft', fresh: true });
  await waitFor(async () => (await s.api(`/api/tasks/${task.id}`)).artifacts.filter((a) => a.kind === 'draft').length === 3);
  assert.equal(s.mock.requests.at(-1).stage, 'draft');
  assert(!s.mock.requests.at(-1).user.includes('CURRENT DRAFT'));
});

test('a running generation can be cancelled and retried', async (t) => {
  const s = await startStudio(t, { env: { AUTO_GENERATE_ON_MOVE: 'false' } });
  const { tasks: [task] } = await s.api('/api/commission', 'POST', order({ topic: 'SLOWCASE long running generation' }));
  const { job } = await s.api(`/api/tasks/${task.id}/pipeline`, 'POST', {});
  assert.equal(job.options.chain, true);
  await waitFor(async () => (await s.api(`/api/tasks/${task.id}/live`)).jobs.some((j) => j.jobId === job.id && j.text.length > 0));
  await s.api(`/api/jobs/${job.id}/cancel`, 'POST', {});
  const stopped = await waitFor(async () => { const x = await s.api(`/api/tasks/${task.id}`); return x.jobs[0].status === 'cancelled' ? x : false; });
  assert.equal(stopped.artifacts.length, 0, 'a cancelled generation saves nothing');
  assert.equal(stopped.jobs.length, 1, 'cancelling stops the autopilot chain');
  await assert.rejects(s.api(`/api/jobs/${job.id}/cancel`, 'POST', {}), /Only queued or running/);
  const retried = await s.api(`/api/jobs/${job.id}/retry`, 'POST', {});
  assert.equal(retried.job.kind, 'brief'); assert.equal(retried.job.options.chain, true, 'retry keeps autopilot');
  await s.api(`/api/jobs/${retried.job.id}/cancel`, 'POST', {});
});

test('jobs wait and retry while the model server is offline, then fail clearly', async (t) => {
  const s = await startStudio(t, { model: false, env: { JOB_RETRY_BASE_MS: '150', JOB_MAX_ATTEMPTS: '2', AUTO_GENERATE_ON_MOVE: 'false' } });
  const { tasks: [task] } = await s.api('/api/commission', 'POST', order());
  await s.api(`/api/tasks/${task.id}/generate`, 'POST', { kind: 'brief' });
  const waiting = await waitFor(async () => { const j = (await s.api(`/api/tasks/${task.id}`)).jobs[0]; return j.status === 'queued' && j.attempts === 1 ? j : false; }, 8000, 20);
  assert.match(waiting.error, /Retrying in/);
  const failed = await waitFor(async () => { const j = (await s.api(`/api/tasks/${task.id}`)).jobs[0]; return j.status === 'failed' ? j : false; });
  assert.equal(failed.attempts, 2); assert.match(failed.error, /Model server unavailable|Could not reach/);
  assert.equal((await s.api('/api/models')).connected, false);
});

test('token auth, CORS preflight for the split Vercel deployment, and static hardening', async (t) => {
  const s = await startStudio(t, { env: { MAIOS_API_TOKEN: 'test-secret-token', CORS_ORIGIN: 'https://studio.example.com' } });
  const pre = await fetch(s.origin + '/api/bootstrap', { method: 'OPTIONS', headers: { Origin: 'https://studio.example.com', 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'x-maios-actor,x-maios-token' } });
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get('access-control-allow-origin'), 'https://studio.example.com');
  const allowed = pre.headers.get('access-control-allow-headers').toLowerCase();
  for (const h of ['x-maios-actor', 'x-maios-token', 'content-type']) assert(allowed.includes(h), `${h} must be allowed`);
  const pna = await fetch(s.origin + '/api/bootstrap', { method: 'OPTIONS', headers: { Origin: 'https://studio.example.com', 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Private-Network': 'true' } });
  assert.equal(pna.headers.get('access-control-allow-private-network'), 'true', 'hosted UI may reach a backend on the same machine');
  assert.equal(pre.headers.get('access-control-allow-private-network'), null);
  const other = await fetch(s.origin + '/api/bootstrap', { method: 'OPTIONS', headers: { Origin: 'https://attacker.example' } });
  const otherPna = await fetch(s.origin + '/api/bootstrap', { method: 'OPTIONS', headers: { Origin: 'https://attacker.example', 'Access-Control-Request-Private-Network': 'true' } });
  assert.equal(otherPna.headers.get('access-control-allow-private-network'), null, 'other origins get no private-network grant');
  assert.equal(other.headers.get('access-control-allow-origin'), null);
  assert.equal((await fetch(s.origin + '/api/bootstrap')).status, 401);
  assert.equal((await fetch(s.origin + '/api/events')).status, 401);
  assert.equal((await fetch(s.origin + '/api/bootstrap', { headers: { 'X-MAIOS-Token': 'wrong-secret-token' } })).status, 401);
  const boot = await s.api('/api/bootstrap');
  assert.equal(boot.version, '0.4.0'); assert.equal(boot.settings.worker.streaming, true);

  const page = await fetch(s.origin + '/');
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-security-policy'), /script-src 'self'/);
  assert.equal(page.headers.get('x-frame-options'), 'DENY');
  for (const p of ['/..%2f..%2fpackage.json', '/%2e%2e/%2e%2e/server.mjs', '/../knowledge/seed.json', '/%E0%A4%A']) {
    const r = await fetch(s.origin + p); assert(r.status >= 400, `${p} must not be served`); await r.arrayBuffer();
  }
  await assert.rejects(s.api('/api/commission', 'POST', []), /400/);
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>').toString('base64');
  const { tasks: [task] } = await s.api('/api/commission', 'POST', order());
  await assert.rejects(s.api(`/api/tasks/${task.id}/asset`, 'POST', { name: 'x.svg', mime: 'image/svg+xml', data: svg }), /SVG uploads are disabled/);
});

test('knowledge search is ranked full-text with highlighted snippets', async (t) => {
  const s = await startStudio(t);
  const hits = await s.api('/api/knowledge?q=data%20sovereign&limit=10');
  assert.equal(hits.ranked, true); assert(hits.total > 0);
  assert(hits.items.some((x) => /\[\[[^\]]+\]\]/.test(x.snippet)), 'matches are marked for highlighting');
  const scoped = await s.api('/api/knowledge?q=attribution&category=historical_draft&limit=50');
  assert(scoped.items.length > 0 && scoped.items.every((x) => x.category === 'historical_draft'));
  const literal = await s.api('/api/knowledge?q=%232CACE8');
  assert(literal.total > 0, 'punctuation-heavy queries still match');
  assert.equal((await s.api('/api/knowledge?q=zzzqqqxxnotaword')).total, 0);
});

test('a v0.2 database upgrades in place', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'maios-migrate-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const db = new DatabaseSync(join(dir, 'content-studio.sqlite'));
  db.exec(`CREATE TABLE boards (id TEXT PRIMARY KEY, name TEXT NOT NULL, subtitle TEXT, color TEXT NOT NULL);
    CREATE TABLE lanes (id TEXT PRIMARY KEY, board_id TEXT NOT NULL, slug TEXT NOT NULL, name TEXT NOT NULL, sort_order INTEGER NOT NULL, auto_action TEXT DEFAULT '', UNIQUE(board_id, slug));
    CREATE TABLE tasks (id TEXT PRIMARY KEY, board_id TEXT NOT NULL, lane_id TEXT NOT NULL, campaign_id TEXT, title TEXT NOT NULL, content_type TEXT NOT NULL DEFAULT 'article', channel TEXT NOT NULL DEFAULT 'website', brand TEXT NOT NULL DEFAULT 'Marketing Powered', priority TEXT NOT NULL DEFAULT 'P2', owner TEXT NOT NULL DEFAULT 'Unassigned', reviewer TEXT NOT NULL DEFAULT 'Mike', topic TEXT NOT NULL DEFAULT '', objective TEXT NOT NULL DEFAULT '', audience TEXT NOT NULL DEFAULT '', primary_keyword TEXT NOT NULL DEFAULT '', secondary_keywords TEXT NOT NULL DEFAULT '', source_urls TEXT NOT NULL DEFAULT '', due_date TEXT, word_count INTEGER NOT NULL DEFAULT 900, graphics_count INTEGER NOT NULL DEFAULT 3, voice TEXT NOT NULL DEFAULT 'company', cta TEXT NOT NULL DEFAULT '', instructions TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL, approved_at TEXT, published_at TEXT, published_url TEXT, rev INTEGER NOT NULL DEFAULT 1, sort_order INTEGER NOT NULL DEFAULT 0, demo INTEGER NOT NULL DEFAULT 0, archived INTEGER NOT NULL DEFAULT 0, asana_gid TEXT UNIQUE);
    CREATE TABLE jobs (id TEXT PRIMARY KEY, task_id TEXT NOT NULL, kind TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'queued', attempts INTEGER NOT NULL DEFAULT 0, error TEXT, model TEXT, run_after TEXT NOT NULL, created_at TEXT NOT NULL, started_at TEXT, finished_at TEXT);
    CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    INSERT INTO settings VALUES ('seeded','yes');
    INSERT INTO boards VALUES ('mpfresh','MP FRESH','Website content production','#8e6cf4');
    INSERT INTO lanes VALUES ('mpfresh:backlog','mpfresh','backlog','Backlog',0,'');
    INSERT INTO tasks (id,board_id,lane_id,title,topic,created_at,updated_at) VALUES ('11111111-1111-4111-8111-111111111111','mpfresh','mpfresh:backlog','Legacy v0.2 card','Legacy v0.2 card topic','2026-10-01T00:00:00.000Z','2026-10-01T00:00:00.000Z');`);
  db.close();
  const s = await startStudio(t, { dataDir: dir });
  const boot = await s.api('/api/bootstrap');
  assert.equal(boot.tasks.length, 1); assert.equal(boot.tasks[0].title, 'Legacy v0.2 card'); assert.equal(boot.tasks[0].qa_status, null);
  assert.equal(boot.lanes.length, 16, 'missing lanes are filled in');
  await s.api('/api/tasks/11111111-1111-4111-8111-111111111111/pipeline', 'POST', {});
  const done = await waitFor(async () => { const x = await s.api('/api/tasks/11111111-1111-4111-8111-111111111111'); return x.lane_id === 'mpfresh:final_approval' && x.artifacts.some((a) => a.kind === 'qa') ? x : false; });
  assert.deepEqual(kinds(done), ['brief', 'draft', 'graphics', 'qa']);
});
