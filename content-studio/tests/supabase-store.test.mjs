// The studio on Supabase storage: the snapshot swap never loses a write across servers, and images round-trip.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { createSupabaseStore, PreconditionFailed } from '../supabase-store.mjs';

/** In-memory stand-in for the two Supabase pieces the store uses: the studio_db RPCs and a Storage bucket. */
function fakeSupabase(t) {
  const objects = new Map(), db = new Map(), stats = { swaps: 0, refused: 0 };
  const server = http.createServer(async (req, res) => {
    const chunks = []; for await (const c of req) chunks.push(c);
    const body = Buffer.concat(chunks);
    const send = (status, data, type = 'application/json') => { res.writeHead(status, { 'Content-Type': type }); res.end(type === 'application/json' ? JSON.stringify(data) : data); };
    if (req.headers.apikey !== 'sb_secret_test') return send(401, { message: 'bad key' });
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/rest/v1/rpc/studio_db_head') { const a = JSON.parse(body); const row = db.get(a.p_key); return send(200, row ? [row] : []); }
    if (url.pathname === '/rest/v1/rpc/studio_db_swap') {
      const a = JSON.parse(body), cur = db.get(a.p_key);
      if (a.p_old_etag === null) { if (cur) { stats.refused++; return send(200, { ok: false }); } db.set(a.p_key, { etag: a.p_new_etag, path: a.p_path }); stats.swaps++; return send(200, { ok: true, old_path: null }); }
      if (!cur || cur.etag !== a.p_old_etag) { stats.refused++; return send(200, { ok: false }); }
      db.set(a.p_key, { etag: a.p_new_etag, path: a.p_path }); stats.swaps++; return send(200, { ok: true, old_path: cur.path });
    }
    const m = /^\/storage\/v1\/object\/studio(?:\/(.+))?$/.exec(url.pathname);
    if (!m) return send(404, { message: 'no route' });
    const path = m[1] ? decodeURIComponent(m[1]) : '';
    if (req.method === 'POST') { if (objects.has(path) && req.headers['x-upsert'] !== 'true') return send(400, { statusCode: '409', error: 'Duplicate' }); objects.set(path, body); return send(200, { Key: `studio/${path}` }); }
    if (req.method === 'GET') return objects.has(path) ? send(200, objects.get(path), 'application/octet-stream') : send(400, { statusCode: '404', error: 'not_found', message: 'Object not found' });
    if (req.method === 'DELETE') { for (const p of JSON.parse(body).prefixes || []) objects.delete(p); return send(200, []); }
    send(405, {});
  });
  t.after(() => new Promise((ok) => server.close(ok)));
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok({ url: `http://127.0.0.1:${server.address().port}`, objects, db, stats })));
}

test('Supabase store: create, read, 304, refused stale save, swap, and images', async (t) => {
  const f = await fakeSupabase(t);
  const s = createSupabaseStore({ url: f.url, key: 'sb_secret_test' });
  const key = 'studio/content-studio.sqlite';
  assert.equal(await s.get(key), null, 'no database yet');
  const first = await s.put(key, Buffer.from('v1'), { allowOverwrite: false });
  const got = await s.get(key); assert.equal(Buffer.from(await new Response(got.stream).arrayBuffer()).toString(), 'v1'); assert.equal(got.blob.etag, first.etag);
  assert.equal((await s.get(key, { ifNoneMatch: first.etag })).statusCode, 304);
  await assert.rejects(s.put(key, Buffer.from('other'), { allowOverwrite: false }), PreconditionFailed, 'a second create is refused');
  const second = await s.put(key, Buffer.from('v2'), { ifMatch: first.etag, allowOverwrite: true });
  await assert.rejects(s.put(key, Buffer.from('stale'), { ifMatch: first.etag, allowOverwrite: true }), PreconditionFailed, 'a save from a stale copy is refused');
  assert.equal(Buffer.from(await new Response((await s.get(key)).stream).arrayBuffer()).toString(), 'v2');
  assert.equal([...f.objects.keys()].filter((k) => k.startsWith('db/')).length, 1, 'replaced and refused snapshots are removed');
  assert.notEqual(second.etag, first.etag);
  await s.put('studio/assets/a.png', Buffer.from('png'), { allowOverwrite: false });
  assert.equal(Buffer.from(await new Response((await s.get('studio/assets/a.png')).stream).arrayBuffer()).toString(), 'png');
  assert.equal(await s.get('studio/assets/missing.png'), null);
});

test('hosted studio on Supabase: two servers writing at once lose nothing', async (t) => {
  const f = await fakeSupabase(t);
  const env = { FAKE_SUPABASE_URL: f.url, STUDIO_SECRET_KEY: randomBytes(32).toString('base64'), STUDIO_HOSTED: '1', STUDIO_SYNC_TTL_MS: '0', STUDIO_PASSCODE: 'supabase test passcode', AUTO_GENERATE_ON_MOVE: 'false' };
  const start = () => new Promise((ok, no) => {
    const child = spawn(process.execPath, [fileURLToPath(new URL('./fixtures/hosted-instance.mjs', import.meta.url))], { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    t.after(() => child.kill('SIGTERM'));
    let out = '', err = ''; child.stderr.on('data', (c) => { err += c; });
    child.stdout.on('data', (c) => { out += c; const m = /PORT (\d+)/.exec(out); if (m) ok(Number(m[1])); });
    child.on('exit', (code) => no(new Error(`instance exited ${code}: ${err}`)));
  });
  const [pa, pb] = await Promise.all([start(), start()]);
  let cookie = '';
  const api = async (port, path, method = 'GET', body) => {
    const r = await fetch(`http://127.0.0.1:${port}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    const set = r.headers.get('set-cookie'); if (set) cookie = set.split(';')[0];
    const data = await r.json(); if (!r.ok) throw new Error(`${r.status} ${data.error}`); return data;
  };
  await api(pa, '/api/session', 'POST', { passcode: 'supabase test passcode' });
  await Promise.all(Array.from({ length: 10 }, (_, i) => api(i % 2 ? pa : pb, '/api/commission', 'POST', { topic: `Supabase topic ${i}`, outputs: ['website'] })));
  for (const port of [pa, pb]) {
    const topics = (await api(port, '/api/bootstrap')).tasks.map((x) => x.topic).filter((x) => x.startsWith('Supabase topic'));
    assert.equal(topics.length, 10, 'every task from both servers is there');
  }
  assert.ok(f.stats.refused >= 0 && f.stats.swaps >= 10);
});
