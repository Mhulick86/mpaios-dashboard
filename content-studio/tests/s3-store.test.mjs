// The studio on an S3-compatible bucket: conditional saves never lose a write across servers, images round-trip, and
// what was saved on Supabase is carried over.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash, randomBytes } from 'node:crypto';
import { createS3Store, signS3, PreconditionFailed } from '../s3-store.mjs';
import { createSupabaseSource, withOldStore, copyEverything } from '../storage-move.mjs';

const text = async (res) => Buffer.from(await new Response(res.stream).arrayBuffer()).toString();
const listen = (t, server) => { t.after(() => new Promise((ok) => server.close(ok))); return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(`http://127.0.0.1:${server.address().port}`))); };
const readBody = async (req) => { const chunks = []; for await (const c of req) chunks.push(c); return Buffer.concat(chunks); };

/** In-memory bucket with S3's conditional semantics (If-Match, If-None-Match) and signed-request check. */
async function fakeS3(t) {
  const objects = new Map(), stats = { puts: 0, refused: 0 };
  const etagOf = (buf) => `"${createHash('md5').update(buf).digest('hex')}"`;
  const server = http.createServer(async (req, res) => {
    const body = await readBody(req);
    const send = (status, data = '', headers = {}) => { res.writeHead(status, headers); res.end(req.method === 'HEAD' ? undefined : data); };
    if (!/^AWS4-HMAC-SHA256 Credential=test-key\/\d{8}\/auto\/s3\/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=[0-9a-f]{64}$/.test(req.headers.authorization || '')) return send(403, '<Error><Code>AccessDenied</Code></Error>');
    const m = /^\/studio\/(.+)$/.exec(new URL(req.url, 'http://x').pathname);
    if (!m) return send(404);
    const key = decodeURIComponent(m[1]), cur = objects.get(key);
    if (req.method === 'PUT') {
      const ifMatch = req.headers['if-match'], ifNone = req.headers['if-none-match'];
      if ((ifNone === '*' && cur) || (ifMatch && (!cur || etagOf(cur) !== ifMatch))) { stats.refused++; return send(412, '<Error><Code>PreconditionFailed</Code></Error>'); }
      objects.set(key, body); stats.puts++; return send(200, '', { ETag: etagOf(body) });
    }
    if (req.method === 'GET' || req.method === 'HEAD') {
      if (!cur) return send(404, '<Error><Code>NoSuchKey</Code></Error>');
      if (req.headers['if-none-match'] === etagOf(cur)) return send(304, '', { ETag: etagOf(cur) });
      return send(200, cur, { ETag: etagOf(cur), 'Content-Type': 'application/octet-stream' });
    }
    if (req.method === 'DELETE') { objects.delete(key); return send(204); }
    send(405);
  });
  return { url: await listen(t, server), objects, stats };
}
const s3 = (f) => createS3Store({ endpoint: f.url, bucket: 'studio', accessKeyId: 'test-key', secretAccessKey: 'test-secret' });

/** Stand-in for the Supabase pieces the old store used: the studio_db_head RPC, object downloads and the object list. */
async function fakeSupabase(t, { restricted = false } = {}) {
  const objects = new Map(), db = new Map(), stats = { downloads: 0 };
  const server = http.createServer(async (req, res) => {
    const body = await readBody(req);
    const send = (status, data, type = 'application/json') => { res.writeHead(status, { 'Content-Type': type }); res.end(type === 'application/json' ? JSON.stringify(data) : data); };
    if (restricted) return send(402, { message: 'Service for this project is restricted due to the following violations: exceed_egress_quota.' });
    if (req.headers.apikey !== 'sb_secret_test') return send(401, { message: 'bad key' });
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/rest/v1/rpc/studio_db_head') { const row = db.get(JSON.parse(body).p_key); return send(200, row ? [row] : []); }
    if (url.pathname === '/storage/v1/object/list/studio') {
      const a = JSON.parse(body);
      const names = [...objects.keys()].filter((k) => k.startsWith(a.prefix + '/')).sort().slice(a.offset, a.offset + a.limit);
      return send(200, names.map((k) => ({ name: k.slice(a.prefix.length + 1), id: 'id-' + k })));
    }
    const m = /^\/storage\/v1\/object\/studio\/(.+)$/.exec(url.pathname);
    if (!m || req.method !== 'GET') return send(405, { message: 'the old store is read only' });
    const path = decodeURIComponent(m[1]);
    if (!objects.has(path)) return send(400, { statusCode: '404', error: 'not_found', message: 'Object not found' });
    stats.downloads++; send(200, objects.get(path), 'application/octet-stream');
  });
  return { url: await listen(t, server), objects, db, stats };
}

test('S3 request signing matches AWS Signature Version 4', () => {
  // Reference value produced by @smithy/signature-v4 for the same request.
  const h = signS3({ method: 'PUT', host: 'acct.r2.cloudflarestorage.com', path: '/studio/studio/assets/a%20b.png', region: 'auto', accessKeyId: 'AKIDEXAMPLE', secretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY', now: new Date('2026-01-02T03:04:05.000Z') });
  assert.equal(h['x-amz-date'], '20260102T030405Z');
  assert.equal(h.Authorization, 'AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20260102/auto/s3/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=60bb63ecb6062f295c99cff28e8ee9dd0d011d69ddf083eb35ffac180924c9f2');
});

test('S3 store: create, read, 304, refused stale save, replace, and images', async (t) => {
  const f = await fakeS3(t);
  const s = s3(f);
  const key = 'studio/content-studio.sqlite';
  assert.equal(await s.get(key), null, 'no database yet');
  const first = await s.put(key, Buffer.from('v1'), { allowOverwrite: false });
  const got = await s.get(key); assert.equal(await text(got), 'v1'); assert.equal(got.blob.etag, first.etag);
  assert.equal((await s.get(key, { ifNoneMatch: first.etag })).statusCode, 304);
  await assert.rejects(s.put(key, Buffer.from('other'), { allowOverwrite: false }), PreconditionFailed, 'a second create is refused');
  const second = await s.put(key, Buffer.from('v2'), { ifMatch: first.etag, allowOverwrite: true });
  await assert.rejects(s.put(key, Buffer.from('stale'), { ifMatch: first.etag, allowOverwrite: true }), PreconditionFailed, 'a save from a stale copy is refused');
  assert.equal(await text(await s.get(key)), 'v2');
  assert.notEqual(second.etag, first.etag);
  await s.put('studio/assets/a b.png', Buffer.from('png'), { allowOverwrite: false });
  assert.equal(await text(await s.get('studio/assets/a b.png')), 'png');
  assert.equal(await s.has('studio/assets/a b.png'), true);
  assert.equal(await s.has('studio/assets/missing.png'), false);
  assert.equal(await s.get('studio/assets/missing.png'), null);
  await s.del('studio/assets/a b.png');
  assert.equal(await s.get('studio/assets/a b.png'), null);
  await assert.rejects(createS3Store({ endpoint: f.url, bucket: 'studio', accessKeyId: 'wrong', secretAccessKey: 'x' }).get(key), /HTTP 403/);
});

test('hosted studio on S3: two servers writing at once lose nothing', async (t) => {
  const f = await fakeS3(t);
  const env = { FAKE_S3_URL: f.url, STUDIO_SECRET_KEY: randomBytes(32).toString('base64'), STUDIO_HOSTED: '1', STUDIO_SYNC_TTL_MS: '0', STUDIO_PASSCODE: 's3 test passcode', AUTO_GENERATE_ON_MOVE: 'false' };
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
  await api(pa, '/api/session', 'POST', { passcode: 's3 test passcode' });
  await Promise.all(Array.from({ length: 10 }, (_, i) => api(i % 2 ? pa : pb, '/api/commission', 'POST', { topic: `Bucket topic ${i}`, outputs: ['website'] })));
  for (const port of [pa, pb]) {
    const topics = (await api(port, '/api/bootstrap')).tasks.map((x) => x.topic).filter((x) => x.startsWith('Bucket topic'));
    assert.equal(topics.length, 10, 'every task from both servers is there');
  }
  assert.ok(f.stats.puts >= 10);
  assert.equal([...f.objects.keys()].filter((k) => k.endsWith('.sqlite')).length, 1, 'one snapshot object, replaced in place');
});

test('moving off Supabase: data is picked up on first use and the bulk copy finishes the rest', async (t) => {
  const f = await fakeS3(t), sb = await fakeSupabase(t);
  const key = 'studio/content-studio.sqlite';
  sb.objects.set('db/v7.sqlite', Buffer.from('the board')); sb.db.set(key, { etag: 'v7', path: 'db/v7.sqlite' });
  for (const n of ['a.jpg', 'b.jpg', 'c.jpg']) sb.objects.set(`studio/assets/${n}`, Buffer.from(`image ${n}`));
  const old = createSupabaseSource({ url: sb.url, key: 'sb_secret_test' });
  const store = withOldStore(s3(f), old);

  const db = await store.get(key);
  assert.equal(await text(db), 'the board', 'the first read brings the database over');
  assert.ok(db.blob.etag, 'and it is now a normal object in the bucket');
  assert.equal((await store.get(key, { ifNoneMatch: db.blob.etag })).statusCode, 304);
  await store.put(key, Buffer.from('the board, edited'), { ifMatch: db.blob.etag, allowOverwrite: true });
  assert.equal(await text(await store.get(key)), 'the board, edited', 'later saves stay in the bucket');
  assert.equal(await text(await store.get('studio/assets/a.jpg')), 'image a.jpg');
  assert.equal(await store.get('studio/assets/never.jpg'), null);
  const before = sb.stats.downloads;
  await store.get(key); await store.get('studio/assets/a.jpg');
  assert.equal(sb.stats.downloads, before, 'Supabase is not asked again for what was copied');

  const report = await copyEverything({ store: s3(f), old });
  assert.match(report.database, /^kept/, 'the edited database is not replaced by the old copy');
  assert.deepEqual([report.images, report.alreadyThere, report.imagesFailed, report.remaining], [2, 1, 0, 0]);
  assert.equal(await text(await s3(f).get('studio/assets/c.jpg')), 'image c.jpg');
  assert.equal(await text(await s3(f).get(key)), 'the board, edited');
  const again = await copyEverything({ store: s3(f), old });
  assert.deepEqual([again.images, again.alreadyThere], [0, 3], 'a second run copies nothing');

  const empty = await fakeS3(t);
  const fresh = await copyEverything({ store: s3(empty), old });
  assert.match(fresh.database, /^copied \(9 bytes\)/);
  assert.equal(fresh.images, 3);
});

test('moving off Supabase: a restricted project is reported plainly and never opens an empty studio', async (t) => {
  const f = await fakeS3(t), sb = await fakeSupabase(t, { restricted: true });
  const store = withOldStore(s3(f), createSupabaseSource({ url: sb.url, key: 'sb_secret_test' }));
  await assert.rejects(store.get('studio/content-studio.sqlite'), /Supabase has restricted the old studio project/);
  assert.equal(f.objects.size, 0);
});
