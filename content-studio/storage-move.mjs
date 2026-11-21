/**
 * TEMPORARY: moving the studio off Supabase. Delete this file, app/api/studio/storage-move and the STUDIO_SUPABASE_*
 * environment variables once everything has been copied to the S3 bucket.
 *
 * Supabase's free plan restricted the project (storage and egress quotas), which took the studio down. The studio now
 * stores to an S3-compatible bucket (s3-store.mjs). What it had saved on Supabase gets across in two ways:
 *  - withOldStore(): while STUDIO_SUPABASE_URL is still set, anything the new bucket does not have yet is fetched from
 *    Supabase once and saved to the bucket. The studio therefore opens on its real data the first time, never on an
 *    empty board.
 *  - copyEverything(): the bulk copy behind POST /api/studio/storage-move, so Supabase can be switched off afterwards.
 * Supabase is only ever read here, never written.
 */

/** Read-only view of what the studio stored on Supabase: get(pathname) and listAssets(). */
export function createSupabaseSource({ url, key, bucket = 'studio', dbKey = 'studio/content-studio.sqlite' }) {
  url = String(url || '').trim(); key = String(key || '').trim();
  const base = url.replace(/\/+$/, '');
  // New-style secret keys (sb_secret_...) go in the apikey header only; a legacy service_role JWT also as the bearer.
  const auth = key.startsWith('sb_') ? { apikey: key } : { apikey: key, Authorization: `Bearer ${key}` };
  const objectUrl = (path) => `${base}/storage/v1/object/${bucket}/${String(path).split('/').map(encodeURIComponent).join('/')}`;
  const refuse = async (r) => {
    const body = (await r.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 200);
    if (r.status === 404 || (r.status === 400 && /not.?found/i.test(body))) return null; // no such object
    if (r.status === 402) return new Error('Supabase has restricted the old studio project (plan quotas), so the studio\'s data cannot be copied out yet. Upgrade that Supabase project until the copy is done, or remove STUDIO_SUPABASE_URL to start with an empty studio.');
    return new Error(`Reading the old studio data from Supabase failed: HTTP ${r.status} ${body}`);
  };
  async function download(path) {
    const r = await fetch(objectUrl(path), { headers: auth, cache: 'no-store' });
    if (r.ok) return r;
    const error = await refuse(r);
    if (error) throw error;
    return null;
  }
  return {
    async get(pathname) {
      let path = pathname;
      if (pathname === dbKey) { // the current snapshot is named by one row in public.studio_db
        const r = await fetch(`${base}/rest/v1/rpc/studio_db_head`, { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_key: pathname }), cache: 'no-store' });
        if (!r.ok) throw (await refuse(r)) || new Error('Supabase has no studio_db_head function; nothing to copy.');
        const rows = await r.json(); const row = Array.isArray(rows) ? rows[0] : rows;
        if (!row) return null;
        path = row.path;
      }
      const r = await download(path);
      return r ? { statusCode: 200, stream: r.body, blob: { pathname } } : null;
    },
    /** Every image and attachment, as the pathnames the studio uses (studio/assets/<name>). */
    async listAssets(prefix = 'studio/assets') {
      const names = [];
      for (let offset = 0; ; offset += 1000) {
        const r = await fetch(`${base}/storage/v1/object/list/${bucket}`, { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ prefix, limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } }), cache: 'no-store' });
        if (!r.ok) throw (await refuse(r)) || new Error('The old Supabase bucket was not found.');
        const page = await r.json();
        for (const o of page) if (o?.name && o.id) names.push(`${prefix}/${o.name}`); // folders have no id
        if (page.length < 1000) return names;
      }
    }
  };
}

const bytes = async (res) => Buffer.from(await new Response(res.stream).arrayBuffer());

/** The new store, falling back to the old one for anything not copied yet (and copying it on the way). */
export function withOldStore(store, old) {
  async function adopt(pathname) {
    const res = await old.get(pathname);
    if (!res?.stream) return false;
    try { await store.put(pathname, await bytes(res), { allowOverwrite: false, contentType: /\.sqlite$/.test(pathname) ? 'application/vnd.sqlite3' : undefined }); }
    catch (e) { if (!e?.precondition) throw e; } // another server copied it first
    return true;
  }
  return {
    ...store,
    async get(pathname, opts = {}) {
      const res = await store.get(pathname, opts);
      if (res) return res;
      return (await adopt(pathname)) ? store.get(pathname, opts) : null;
    }
  };
}

/**
 * Bulk copy: the database snapshot (only when the new store has none, unless replace) and every asset the new store
 * does not have. Stops at the deadline; run it again until `remaining` is 0.
 */
export async function copyEverything({ store, old, dbKey = 'studio/content-studio.sqlite', replace = false, deadline = Date.now() + 600000, parallel = 6 }) {
  const report = { database: 'not found on Supabase', images: 0, alreadyThere: 0, imagesFailed: 0, remaining: 0 };
  const exists = await store.has(dbKey);
  if (exists && !replace) report.database = 'kept: the new store already has the studio database (add ?replace=1 to overwrite it with the Supabase copy)';
  else {
    const src = await old.get(dbKey);
    if (src?.stream) {
      const data = await bytes(src);
      let etag = null;
      if (exists) { const current = await store.get(dbKey); await bytes(current); etag = current.blob.etag; }
      await store.put(dbKey, data, { contentType: 'application/vnd.sqlite3', ...(etag ? { ifMatch: etag, allowOverwrite: true } : { allowOverwrite: false }) });
      report.database = `copied (${data.length} bytes)`;
    }
  }
  const queue = await old.listAssets();
  let next = 0;
  await Promise.all(Array.from({ length: parallel }, async () => {
    while (next < queue.length && Date.now() < deadline) {
      const pathname = queue[next++];
      try {
        if (await store.has(pathname)) { report.alreadyThere++; continue; }
        const res = await old.get(pathname);
        if (!res?.stream) { report.imagesFailed++; continue; }
        await store.put(pathname, await bytes(res), { allowOverwrite: true });
        report.images++;
      } catch (e) { report.imagesFailed++; report.lastError = String(e?.message || e).slice(0, 300); }
    }
  }));
  report.remaining = queue.length - next;
  return report;
}
