/** Folder watcher: KB_ROOT/<collection-slug>/** on the TNAS. New or changed files become ETL jobs. */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from '../config.ts';
import { query, orgId } from '../db.ts';
import { createEtlJob } from './pipeline.ts';
import { etlQueue } from '../queues.ts';

const SKIP = new Set(['.DS_Store', 'Thumbs.db']);

export async function scanKbRoot(root = config.kbRoot): Promise<{ queued: number; seen: number }> {
  if (!root) return { queued: 0, seen: 0 };
  const org = await orgId();
  const collections = await query<{ id: string; slug: string }>('select id, slug from knowledge_collections where organization_id = $1', [org]);
  let queued = 0, seen = 0;
  for (const col of collections) {
    const dir = path.join(root, col.slug);
    let entries: string[] = [];
    try { entries = await walk(dir); } catch { continue; }
    for (const file of entries) {
      seen++;
      const rel = path.relative(root, file);
      const uri = `tnas://${rel}`;
      const stat = await fs.stat(file);
      const quick = crypto.createHash('sha1').update(`${stat.size}:${stat.mtimeMs}`).digest('hex');
      const known = await query<{ id: string }>(`select id from documents where collection_id = $1 and source_uri = $2 and status = 'active' and metadata->>'quick_hash' = $3`, [col.id, uri, quick]);
      if (known.length) continue;
      const pending = await query<{ id: string }>(`select id from etl_jobs where collection_id = $1 and source_uri = $2 and status in ('queued','running')`, [col.id, uri]);
      if (pending.length) continue;
      const jobId = await createEtlJob({ collectionId: col.id, sourceType: 'file', sourceUri: uri, idempotencyKey: `watch:${col.slug}:${rel}:${quick}` });
      await query(`update etl_jobs set input = input || $2::jsonb where id = $1`, [jobId, JSON.stringify({ quick_hash: quick })]);
      await etlQueue.add('etl', { jobId }, { jobId, attempts: 3, backoff: { type: 'exponential', delay: 10_000 } });
      queued++;
    }
  }
  return { queued, seen };
}

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name) || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p))); else out.push(p);
  }
  return out;
}
