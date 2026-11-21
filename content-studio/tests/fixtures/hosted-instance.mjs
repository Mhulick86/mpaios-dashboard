/**
 * One hosted studio "function instance" for tests/hosted.test.mjs. Several of these run as separate processes and
 * share a fake Blob store over HTTP, the way separate Vercel instances share real Blob storage.
 */
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { createHostedStudio } from '../../hosted.mjs';

const BLOB = process.env.FAKE_BLOB_URL;
const blob = {
  async get(path, { ifNoneMatch } = {}) {
    const r = await fetch(`${BLOB}/${path}`, { headers: ifNoneMatch ? { 'if-none-match': ifNoneMatch } : {} });
    if (r.status === 404) return null;
    if (r.status === 304) return { statusCode: 304, stream: null, blob: { etag: ifNoneMatch } };
    return { statusCode: 200, stream: r.body, blob: { etag: r.headers.get('etag') } };
  },
  async put(path, body, opts = {}) {
    const r = await fetch(`${BLOB}/${path}`, { method: 'PUT', body, headers: { ...(opts.ifMatch ? { 'if-match': opts.ifMatch } : {}), 'x-allow-overwrite': opts.allowOverwrite ? '1' : '0' } });
    if (r.status === 412) { const e = new Error('Precondition failed: ETag mismatch.'); e.name = 'BlobPreconditionFailedError'; throw e; }
    if (r.status === 409) throw new Error('This blob already exists.');
    return { etag: r.headers.get('etag') };
  },
  async del(path) { await fetch(`${BLOB}/${path}`, { method: 'DELETE' }); }
};
// FAKE_S3_URL: run on the S3 store instead (tests/s3-store.test.mjs).
const storage = process.env.FAKE_S3_URL ? (await import('../../s3-store.mjs')).createS3Store({ endpoint: process.env.FAKE_S3_URL, bucket: 'studio', accessKeyId: 'test-key', secretAccessKey: 'test-secret' }) : blob;
const seed = JSON.parse(readFileSync(new URL('../../knowledge/seed.json', import.meta.url), 'utf8'));
const studio = createHostedStudio({ blob: storage, seed, cookiePath: '/', minStartMs: 1000 });

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const chunks = []; for await (const c of req) chunks.push(c);
  const body = Buffer.concat(chunks);
  const cookie = /(?:^|;\s*)maios_studio=([^;]+)/.exec(req.headers.cookie || '')?.[1] || '';
  const reply = await studio.handle({
    method: req.method, path: url.pathname, query: url.searchParams, host: req.headers['x-test-host'] || 'studio.example.com', cookie,
    header: (n) => { const v = req.headers[n.toLowerCase()]; return typeof v === 'string' ? v : ''; }, body: async () => body
  });
  const headers = reply.json !== undefined ? { 'Content-Type': 'application/json', ...reply.headers } : reply.headers;
  res.writeHead(reply.status, headers); res.end(reply.json !== undefined ? JSON.stringify(reply.json) : reply.body);
  studio.background({ deadline: Date.now() + 120000 }).catch((e) => console.error(e));
}).listen(0, '127.0.0.1', function () { process.stdout.write(`PORT ${this.address().port}\n`); });
