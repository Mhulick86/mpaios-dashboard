/**
 * Content Studio storage on any S3-compatible bucket (Cloudflare R2, AWS S3, MinIO), offering the calls hosted.mjs
 * makes on Vercel Blob: get, put and del.
 *
 * The database snapshot is one object. A save sends If-Match with the version this server read, and the first save
 * sends If-None-Match: *, so two servers can never overwrite each other's changes: the loser gets PreconditionFailed,
 * reloads and runs its change again, exactly as with Blob's ifMatch. The bucket must honour conditional writes
 * (R2 and AWS S3 do).
 *
 * Needs STUDIO_S3_ENDPOINT (for R2: https://<account id>.r2.cloudflarestorage.com), STUDIO_S3_BUCKET,
 * STUDIO_S3_ACCESS_KEY_ID and STUDIO_S3_SECRET_ACCESS_KEY. STUDIO_S3_REGION is optional (default "auto", right for R2).
 * Requests are signed here (AWS Signature Version 4) so the studio needs no SDK.
 */
import { createHash, createHmac } from 'node:crypto';

export class PreconditionFailed extends Error { constructor() { super('The studio database changed on another server; reloading.'); this.precondition = true; } }

const hmac = (key, text) => createHmac('sha256', key).update(text).digest();
const sha256 = (text) => createHash('sha256').update(text).digest('hex');
const encodeSegment = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());

/** Authorization headers for one request. Exported for the tests. */
export function signS3({ method, host, path, region, accessKeyId, secretAccessKey, now = new Date() }) {
  const amzDate = now.toISOString().replace(/[-:]|\.\d{3}/g, ''); // 20260102T030405Z
  const day = amzDate.slice(0, 8);
  const payload = 'UNSIGNED-PAYLOAD'; // the connection is HTTPS; the body is not hashed twice
  const signed = 'host;x-amz-content-sha256;x-amz-date';
  const canonical = [method, path, '', `host:${host}`, `x-amz-content-sha256:${payload}`, `x-amz-date:${amzDate}`, '', signed, payload].join('\n');
  const scope = `${day}/${region}/s3/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonical)].join('\n');
  const key = hmac(hmac(hmac(hmac('AWS4' + secretAccessKey, day), region), 's3'), 'aws4_request');
  const signature = createHmac('sha256', key).update(toSign).digest('hex');
  return {
    'x-amz-date': amzDate,
    'x-amz-content-sha256': payload,
    Authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signed}, Signature=${signature}`
  };
}

export function createS3Store({ endpoint, bucket, accessKeyId, secretAccessKey, region = 'auto' }) {
  // Pasted values often carry a trailing space or line break, which makes every signature wrong.
  [endpoint, bucket, accessKeyId, secretAccessKey, region] = [endpoint, bucket, accessKeyId, secretAccessKey, region].map((v) => String(v || '').trim());
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) throw new Error('Studio storage needs STUDIO_S3_ENDPOINT, STUDIO_S3_BUCKET, STUDIO_S3_ACCESS_KEY_ID and STUDIO_S3_SECRET_ACCESS_KEY.');
  const base = new URL(/^https?:\/\//i.test(endpoint) ? endpoint : `https://${endpoint}`);
  const root = base.pathname.replace(/\/+$/, '');
  region ||= 'auto';

  async function request(method, pathname, { headers = {}, body } = {}) {
    const path = `${root}/${encodeSegment(bucket)}/${String(pathname).split('/').map(encodeSegment).join('/')}`;
    const auth = signS3({ method, host: base.host, path, region, accessKeyId, secretAccessKey });
    return fetch(`${base.origin}${path}`, { method, headers: { ...auth, ...headers }, body, cache: 'no-store' });
  }
  // Small replies are read to the end rather than cancelled: inside Next, fetch hands back a teed body, and cancelling
  // one side of a tee never settles.
  const drain = (r) => r?.arrayBuffer().catch(() => { });
  const fail = async (what, r) => new Error(`Studio storage ${what} failed: HTTP ${r.status} ${(await r.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 200)}`);

  return {
    async get(pathname, opts = {}) {
      const r = await request('GET', pathname, { headers: opts.ifNoneMatch ? { 'If-None-Match': opts.ifNoneMatch } : {} });
      if (r.status === 304) return { statusCode: 304, stream: null, blob: { etag: opts.ifNoneMatch, pathname } };
      if (r.status === 404) { await drain(r); return null; }
      if (!r.ok) throw await fail('read', r);
      return { statusCode: 200, stream: r.body, blob: { etag: r.headers.get('etag') || '', pathname } };
    },
    async put(pathname, data, opts = {}) {
      const headers = { 'Content-Type': opts.contentType || 'application/octet-stream' };
      if (opts.ifMatch) headers['If-Match'] = opts.ifMatch;
      else if (opts.allowOverwrite !== true) headers['If-None-Match'] = '*';
      const r = await request('PUT', pathname, { headers, body: data });
      // 412: someone else saved first. 409: S3's answer when two conditional writes land at the same moment.
      if (r.status === 412 || r.status === 409) { await drain(r); throw new PreconditionFailed(); }
      if (!r.ok) throw await fail('write', r);
      await drain(r);
      return { etag: r.headers.get('etag') || '', pathname };
    },
    /** Is this object there? Used by the one-off copy from the old store so a second run skips what it already copied. */
    async has(pathname) {
      const r = await request('HEAD', pathname);
      if (r.status === 404) return false;
      if (!r.ok) throw await fail('check', r);
      return true;
    },
    async del(pathname) { await drain(await request('DELETE', pathname).catch(() => null)); }
  };
}
