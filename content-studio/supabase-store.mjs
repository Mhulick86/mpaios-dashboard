/**
 * Content Studio storage on Supabase, offering the three calls hosted.mjs makes on Vercel Blob: get, put and del.
 *
 * Files (images and the database snapshot) live in a private Storage bucket. The database snapshot's current version
 * is one row in public.studio_db: a save uploads the new snapshot under a new name, then swaps the row only if it still
 * points at the version this server read (studio_db_swap). Two servers can therefore never overwrite each other's
 * changes; the loser gets an error, reloads and runs its change again, exactly as with Blob's ifMatch.
 *
 * Needs STUDIO_SUPABASE_URL and STUDIO_SUPABASE_SECRET_KEY (a secret or service_role key, server side only). The SQL it
 * relies on is in content-studio/supabase-schema.sql.
 */
import { randomUUID } from 'node:crypto';

export class PreconditionFailed extends Error { constructor() { super('The studio database changed on another server; reloading.'); this.precondition = true; } }

export function createSupabaseStore({ url, key, bucket = 'studio', dbKey = 'studio/content-studio.sqlite' }) {
  if (!url || !key) throw new Error('Supabase storage needs STUDIO_SUPABASE_URL and STUDIO_SUPABASE_SECRET_KEY.');
  const base = String(url).replace(/\/+$/, '');
  // New-style secret keys (sb_secret_...) go in the apikey header only; a legacy service_role JWT also as the bearer.
  const auth = String(key).startsWith('sb_') ? { apikey: key } : { apikey: key, Authorization: `Bearer ${key}` };
  const objectUrl = (path) => `${base}/storage/v1/object/${bucket}/${String(path).split('/').map(encodeURIComponent).join('/')}`;
  const fail = async (what, r) => new Error(`Supabase ${what} failed: HTTP ${r.status} ${(await r.text().catch(() => '')).slice(0, 200)}`);

  async function rpc(fn, args) {
    const r = await fetch(`${base}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
    if (!r.ok) throw await fail(fn, r);
    const text = await r.text();
    return text ? JSON.parse(text) : null;
  }
  async function download(path) {
    const r = await fetch(objectUrl(path), { headers: auth });
    if (r.ok) return r;
    const body = await r.text().catch(() => '');
    if (r.status === 404 || (r.status === 400 && /not.?found/i.test(body))) return null;
    throw new Error(`Supabase Storage read failed: HTTP ${r.status} ${body.slice(0, 200)}`);
  }
  async function upload(path, data, { upsert = false, contentType = 'application/octet-stream' } = {}) {
    const r = await fetch(objectUrl(path), { method: 'POST', headers: { ...auth, 'Content-Type': contentType, 'x-upsert': upsert ? 'true' : 'false' }, body: data });
    if (!r.ok) throw await fail('Storage write', r);
  }
  async function remove(path) {
    await fetch(`${base}/storage/v1/object/${bucket}`, { method: 'DELETE', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: [path] }) }).catch(() => { });
  }

  return {
    async get(pathname, opts = {}) {
      if (pathname === dbKey) {
        const rows = await rpc('studio_db_head', { p_key: pathname });
        const row = Array.isArray(rows) ? rows[0] : rows;
        if (!row) return null;
        if (opts.ifNoneMatch && opts.ifNoneMatch === row.etag) return { statusCode: 304 };
        const r = await download(row.path);
        return r ? { statusCode: 200, stream: r.body, blob: { etag: row.etag, pathname } } : null;
      }
      const r = await download(pathname);
      return r ? { statusCode: 200, stream: r.body, blob: { etag: r.headers.get('etag') || '', pathname } } : null;
    },
    async put(pathname, data, opts = {}) {
      if (pathname === dbKey) {
        const etag = randomUUID(), path = `db/${etag}.sqlite`;
        await upload(path, data, { contentType: 'application/vnd.sqlite3' });
        let out;
        try { out = await rpc('studio_db_swap', { p_key: pathname, p_old_etag: opts.ifMatch || null, p_new_etag: etag, p_path: path }); }
        catch (e) { await remove(path); throw e; }
        if (!out?.ok) { await remove(path); throw new PreconditionFailed(); }
        if (out.old_path) await remove(out.old_path); // the version it replaced
        return { etag, pathname };
      }
      await upload(pathname, data, { upsert: opts.allowOverwrite === true, contentType: opts.contentType });
      return { etag: randomUUID(), pathname };
    },
    async del(pathname) { await remove(pathname); }
  };
}
