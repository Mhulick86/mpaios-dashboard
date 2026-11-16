// The hosted runtime (MAIOS on Vercel): several instances sharing one database snapshot in Blob storage.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createMockModel } from '../scripts/mock-model.mjs';
import { waitFor } from './helpers.mjs';

/** In-memory stand-in for Vercel Blob with ETags and conditional writes. Single-threaded, so each write is atomic. */
function fakeBlob() {
  const files = new Map(); let n = 0; const stats = { conflicts: 0, puts: 0 };
  const server = http.createServer(async (req, res) => {
    const key = req.url.slice(1), cur = files.get(key);
    if (req.method === 'GET') {
      if (!cur) { res.writeHead(404); return res.end(); }
      if (req.headers['if-none-match'] === cur.etag) { res.writeHead(304, { etag: cur.etag }); return res.end(); }
      res.writeHead(200, { etag: cur.etag }); return res.end(cur.data);
    }
    if (req.method === 'DELETE') { files.delete(key); res.writeHead(204); return res.end(); }
    const chunks = []; for await (const c of req) chunks.push(c);
    const ifMatch = req.headers['if-match'];
    if (ifMatch && (!cur || cur.etag !== ifMatch)) { stats.conflicts++; res.writeHead(412); return res.end(); }
    if (!ifMatch && cur && req.headers['x-allow-overwrite'] !== '1') { stats.conflicts++; res.writeHead(409); return res.end(); }
    const data = Buffer.concat(chunks); const etag = `"${++n}-${createHash('sha1').update(data).digest('hex').slice(0, 8)}"`;
    files.set(key, { data, etag }); stats.puts++;
    res.writeHead(200, { etag }); res.end();
  });
  return { files, stats, server, listen: () => new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server.address().port))) };
}

async function instance(t, env) {
  const child = spawn(process.execPath, [fileURLToPath(new URL('./fixtures/hosted-instance.mjs', import.meta.url))], { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  let err = ''; child.stderr.on('data', (c) => { err += c; });
  t.after(() => child.kill('SIGTERM'));
  const port = await new Promise((ok, no) => {
    let out = ''; child.stdout.on('data', (c) => { out += c; const m = /PORT (\d+)/.exec(out); if (m) ok(Number(m[1])); });
    child.on('exit', (code) => no(new Error(`instance exited ${code}: ${err}`)));
  });
  let cookie = '';
  async function api(path, method = 'GET', body, { host } = {}) {
    const r = await fetch(`http://127.0.0.1:${port}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...(host ? { 'x-test-host': host } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    const set = r.headers.get('set-cookie'); if (set) cookie = set.split(';')[0];
    const data = await r.json();
    if (!r.ok) { const e = new Error(`${r.status}: ${data.error}`); e.status = r.status; e.data = data; throw e; }
    return data;
  }
  return { api, port, logs: () => err, setCookie: (c) => { cookie = c; }, cookie: () => cookie };
}

test('hosted: passcode gate, cloud-style generation in the background, and no lost writes across instances', async (t) => {
  const blob = fakeBlob(); const blobPort = await blob.listen(); t.after(() => blob.server.close());
  const mock = createMockModel({ delayMs: 2 }); const modelPort = await mock.listen(0); t.after(() => mock.close());
  const env = {
    FAKE_BLOB_URL: `http://127.0.0.1:${blobPort}`, STUDIO_SECRET_KEY: randomBytes(32).toString('base64'), STUDIO_HOSTED: '1',
    LM_STUDIO_BASE_URL: `http://127.0.0.1:${modelPort}/v1`, STUDIO_MODEL_BRIEF: 'lmstudio:auto', STUDIO_MODEL_DRAFT: 'lmstudio:auto',
    STUDIO_MODEL_GRAPHICS: 'lmstudio:auto', STUDIO_MODEL_QA: 'lmstudio:auto', ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '', GEMINI_API_KEY: '', GOOGLE_AI_API_KEY: '', GOOGLE_API_KEY: '',
    AUTO_GENERATE_ON_MOVE: 'true', JOB_RETRY_BASE_MS: '200', STUDIO_PASSCODE: 'correct horse battery', STUDIO_BUILD_TOKEN: 'build-token-0123456789abcdefghij'
  };
  const [a, b] = await Promise.all([instance(t, env), instance(t, env)]);

  // Every address is locked, including *.vercel.app hosts: nothing is trusted by host name.
  await assert.rejects(a.api('/api/bootstrap'), (e) => e.status === 401 && e.data.auth.passcodeSet === true);
  await assert.rejects(a.api('/api/bootstrap', 'GET', undefined, { host: 'mpaios.vercel.app' }), /401/);
  await assert.rejects(a.api('/api/session/passcode', 'POST', { passcode: 'a brand new passcode' }, { host: 'mpaios.vercel.app' }), /403/);
  await assert.rejects(a.api('/api/session', 'POST', { passcode: 'wrong passcode' }), /401/);
  await a.api('/api/session', 'POST', { passcode: 'correct horse battery' });
  assert.ok(a.cookie().startsWith('maios_studio=v1.'));
  b.setCookie(a.cookie()); // the same browser talking to another instance
  // Changing the passcode signs every other browser out; the browser that changed it stays in.
  const old = a.cookie();
  await b.api('/api/session/passcode', 'POST', { passcode: 'second team passcode' });
  await assert.rejects(a.api('/api/bootstrap'), /401/);
  await assert.rejects(a.api('/api/session', 'POST', { passcode: 'correct horse battery' }), /401/);
  await a.api('/api/session', 'POST', { passcode: 'second team passcode' });
  assert.notEqual(a.cookie(), old);
  const boot = await b.api('/api/bootstrap');
  assert.equal(boot.settings.hosted, true); assert.equal(boot.ai.hosted, true);
  assert.ok(!boot.ai.models.some((m) => m.id.startsWith('lmstudio')), 'local models are not offered when hosted');
  await assert.rejects(a.api('/api/ai', 'PATCH', { stages: { draft: 'lmstudio:auto' } }), /only available when the studio runs on your own computer/);

  // The site builder's token opens the ship queue and image downloads, and nothing else.
  const port = a.port;
  const asBuilder = (path, token = 'build-token-0123456789abcdefghij') => fetch(`http://127.0.0.1:${port}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal((await asBuilder('/api/ship/queue')).status, 200);
  assert.equal((await asBuilder('/api/bootstrap')).status, 401, 'the builder token is not a passcode');
  assert.equal((await asBuilder('/api/ship/queue', 'build-token-0123456789abcdefghiX')).status, 401);

  // A provider key is stored encrypted and only its last 4 characters ever come back.
  const ai = await a.api('/api/ai', 'PATCH', { provider: 'openai', key: 'sk-test-abcdefghijklmnop1234' });
  assert.equal(ai.providers.find((p) => p.id === 'openai').last4, '1234');
  const dbFile = blob.files.get('studio/content-studio.sqlite').data;
  assert.ok(!dbFile.includes('sk-test-abcdefghijklmnop1234'), 'the key is not stored in plain text');
  assert.ok(!JSON.stringify(await b.api('/api/export')).includes('abcdefghijklmnop'));

  // Commission on one instance, run the whole pipeline in the background, watch it from the other.
  const { tasks: [task] } = await a.api('/api/commission', 'POST', { topic: 'Owned measurement for hospital marketing teams', outputs: ['website'], voice: 'company', audience: 'Hospital CMOs', objective: 'Explain ownership economics', primary_keyword: 'owned measurement', word_count: 600, graphics_count: 1 });
  await b.api(`/api/tasks/${task.id}/pipeline`, 'POST', {});
  // Meanwhile, both instances take comments at the same time. Every one of them must survive.
  const writes = [];
  for (let i = 0; i < 12; i++) writes.push((i % 2 ? a : b).api(`/api/tasks/${task.id}/comment`, 'POST', { text: `Concurrent note ${i}` }));
  await Promise.all(writes);
  const done = await waitFor(async () => {
    const d = await (Math.random() < 0.5 ? a : b).api(`/api/tasks/${task.id}`);
    return ['brief', 'draft', 'graphics', 'qa'].every((k) => d.artifacts.some((x) => x.kind === k)) && !d.jobs.some((j) => ['queued', 'running'].includes(j.status)) ? d : false;
  }, 60000, 300);
  const notes = done.comments.filter((c) => c.body.startsWith('Concurrent note')).map((c) => c.body).sort();
  assert.equal(notes.length, 12, `lost comments: ${a.logs()}${b.logs()}`);
  assert.equal(new Set(done.artifacts.map((x) => x.kind + x.version)).size, done.artifacts.length, 'no stage was saved twice');
  assert.ok(done.jobs.every((j) => j.status === 'done'), JSON.stringify(done.jobs.map((j) => [j.kind, j.status, j.error])));
  assert.ok(blob.stats.conflicts > 0, 'the test actually produced concurrent writes');
  assert.ok(![...blob.files.keys()].some((k) => k.startsWith('studio/live/')), 'live output is cleaned up');
});

test('hosted: a cancel through one instance stops a generation running on another', async (t) => {
  const blob = fakeBlob(); const blobPort = await blob.listen(); t.after(() => blob.server.close());
  const mock = createMockModel({ delayMs: 120 }); const modelPort = await mock.listen(0); t.after(() => mock.close());
  const env = {
    FAKE_BLOB_URL: `http://127.0.0.1:${blobPort}`, STUDIO_SECRET_KEY: randomBytes(32).toString('base64'), STUDIO_HOSTED: '1',
    LM_STUDIO_BASE_URL: `http://127.0.0.1:${modelPort}/v1`, STUDIO_MODEL_BRIEF: 'lmstudio:auto', STUDIO_MODEL_DRAFT: 'lmstudio:auto', AUTO_GENERATE_ON_MOVE: 'false', STUDIO_PASSCODE: 'cancel test passcode'
  };
  const [a, b] = await Promise.all([instance(t, env), instance(t, env)]);
  await a.api('/api/session', 'POST', { passcode: 'cancel test passcode' }); b.setCookie(a.cookie());
  const host = {};
  const { tasks: [task] } = await a.api('/api/commission', 'POST', { topic: 'Cancel me', outputs: ['website'], voice: 'company', word_count: 600 }, host);
  await a.api(`/api/tasks/${task.id}/generate`, 'POST', { kind: 'draft' }, host);
  const running = await waitFor(async () => (await b.api(`/api/tasks/${task.id}/live`, 'GET', undefined, host)).jobs.find((j) => j.text.length > 20), 20000, 100);
  await b.api(`/api/jobs/${running.jobId}/cancel`, 'POST', {}, host);
  const final = await waitFor(async () => { const d = await a.api(`/api/tasks/${task.id}`, 'GET', undefined, host); return d.jobs[0].status === 'cancelled' && d; }, 15000, 200);
  await new Promise((r) => setTimeout(r, 8000)); // longer than the cancel check interval and the rest of the stream
  const after = await a.api(`/api/tasks/${task.id}`, 'GET', undefined, host);
  assert.equal(after.jobs[0].status, 'cancelled');
  assert.equal(after.artifacts.filter((x) => x.kind === 'draft').length, 0, 'a cancelled generation saves nothing');
  assert.ok(final);
});
