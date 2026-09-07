/**
 * The ETL agent. One job = one source deposited into one access-controlled collection.
 * Stages: detect -> extract -> normalize -> chunk -> embed -> load. Every stage is
 * recorded on etl_jobs so the dashboard can show progress; failures are retried by BullMQ.
 */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { query, one, toVector, emitEvent, audit, orgId } from '../db.ts';
import { detectProfile, mimeFor } from './detect.ts';
import { extract } from './extract.ts';
import { chunkText, rowToText } from './chunk.ts';
import { normalizeRows, summarizeForEmbedding, suggestCollection } from './normalize.ts';
import { embed } from '../model/gateway.ts';
import { config } from '../config.ts';

export interface EtlJobRow {
  id: string; collection_id: string; document_id: string | null; requested_by: string | null;
  source_type: string; source_uri: string | null; input: Record<string, any>; profile: string; attempt: number; correlation_id: string;
}

async function stage(jobId: string, stageName: string, progress: Record<string, unknown> = {}) {
  await query(`update etl_jobs set stage = $2, progress = progress || $3::jsonb, status = 'running', started_at = coalesce(started_at, now()) where id = $1`, [jobId, stageName, JSON.stringify({ [stageName]: { at: new Date().toISOString(), ...progress } })]);
}

/** Resolve a logical tnas:// URI or plain path to a filesystem path the worker can read. */
export function resolvePath(uri: string): string {
  if (uri.startsWith('tnas://')) return path.join(config.kbRoot || '/maios', uri.slice('tnas://'.length));
  if (uri.startsWith('file://')) return uri.slice('file://'.length);
  return uri;
}

export async function runEtlJob(jobId: string): Promise<void> {
  const job = await one<EtlJobRow>('select * from etl_jobs where id = $1', [jobId]);
  if (!job) throw new Error(`etl job ${jobId} not found`);
  const started = Date.now();
  try {
    await query('update etl_jobs set attempt = attempt + 1 where id = $1', [jobId]);
    // 1. detect
    const filePath = job.source_type === 'file' || job.source_type === 'upload' ? resolvePath(job.source_uri!) : undefined;
    const profile = detectProfile({ sourceType: job.source_type, sourceUri: job.source_uri, mimeType: job.input.mime_type, text: job.input.text, requested: job.profile });
    await stage(jobId, 'detect', { profile });

    // 2. extract
    const ex = await extract(profile, { filePath, url: job.source_type === 'url' ? job.source_uri! : undefined, text: job.input.text, title: job.input.title });
    const bytes = filePath ? await fs.readFile(filePath) : Buffer.from(ex.text ?? JSON.stringify(ex.rows ?? []), 'utf8');
    const checksum = crypto.createHash('sha256').update(bytes).digest('hex');
    await stage(jobId, 'extract', { parser: ex.meta.parser, chars: ex.text?.length ?? 0, rows: ex.rows?.length ?? 0 });

    // Optional auto-routing when the caller asked for it (input.route = 'auto').
    let collectionId = job.collection_id;
    if (job.input.route === 'auto' && ex.text) {
      const org = await orgId();
      const cols = await query<{ id: string; slug: string; name: string; description: string | null }>('select id, slug, name, description from knowledge_collections where organization_id = $1', [org]);
      const slug = await suggestCollection(ex.text, cols);
      const hit = cols.find((c) => c.slug === slug);
      if (hit) { collectionId = hit.id; await query('update etl_jobs set collection_id = $2 where id = $1', [jobId, hit.id]); }
    }
    const collection = await one<{ id: string; slug: string; record_schema: Record<string, unknown> | null; chunking: Record<string, unknown>; embedding_model: string }>('select id, slug, record_schema, chunking, embedding_model from knowledge_collections where id = $1', [collectionId]);
    if (!collection) throw new Error('target collection missing');

    // 3. document row (dedupe by checksum inside the collection)
    const title = job.input.title || ex.title || (job.source_uri ? path.basename(job.source_uri) : 'Untitled');
    const existing = await one<{ id: string; status: string }>('select id, status from documents where collection_id = $1 and checksum = $2', [collectionId, checksum]);
    let documentId = job.document_id;
    if (existing && existing.status === 'active' && !job.input.force) {
      await query(`update etl_jobs set status = 'completed', stage = 'load', document_id = $2, result = $3, completed_at = now() where id = $1`, [jobId, existing.id, { skipped: 'unchanged', document_id: existing.id }]);
      return;
    }
    if (!documentId) {
      const doc = await one<{ id: string }>(
        `insert into documents (collection_id, title, source_type, source_uri, mime_type, byte_size, checksum, metadata, status, created_by)
         values ($1,$2,$3,$4,$5,$6,$7,$8,'processing',$9)
         on conflict (collection_id, checksum) where checksum is not null do update set title = excluded.title, status = 'processing', updated_at = now()
         returning id`,
        [collectionId, title, job.source_type, job.source_uri, job.input.mime_type || (job.source_uri ? mimeFor(job.source_uri) : 'text/plain'), bytes.length, checksum, { profile, ...ex.meta, tags: job.input.tags || [] }, job.requested_by]);
      documentId = doc!.id;
      await query('update etl_jobs set document_id = $2 where id = $1', [jobId, documentId]);
    }
    const vnum = (await one<{ v: number }>('select coalesce(max(version),0)+1 as v from document_versions where document_id = $1', [documentId]))!.v;
    const version = await one<{ id: string }>(
      `insert into document_versions (document_id, version, extracted_text, extraction, chunking_version, embedding_model) values ($1,$2,$3,$4,$5,$6) returning id`,
      [documentId, vnum, ex.text ?? null, { ...ex.meta, profile, rows: ex.rows?.length ?? 0 }, 'v1-heading', collection.embedding_model]);
    const versionId = version!.id;

    // 4. normalize + load rows (tabular / records)
    let recordCount = 0;
    if (ex.rows && ex.rows.length) {
      await stage(jobId, 'normalize', { rows: ex.rows.length, schema: !!collection.record_schema });
      const rows = collection.record_schema ? await normalizeRows(ex.rows, collection.record_schema) : ex.rows;
      const keyField = job.input.record_key || collection.record_schema?.['x-record-key'] as string | undefined;
      // Replace this document's previous deposit atomically-enough: drop stale rows first (keyed rows are upserted below).
      await query('delete from records where document_id = $1', [documentId]);
      const texts = rows.map((r) => rowToText(r));
      const vectors = await embed(texts);
      for (let i = 0; i < rows.length; i++) {
        const key = keyField && rows[i][keyField] != null ? String(rows[i][keyField]) : null;
        await query(
          `insert into records (collection_id, document_id, record_key, data, summary, embedding) values ($1,$2,$3,$4,$5,$6::vector)
           on conflict (collection_id, record_key) where record_key is not null do update set data = excluded.data, summary = excluded.summary, embedding = excluded.embedding, document_id = excluded.document_id, updated_at = now()`,
          [collectionId, documentId, key, rows[i], texts[i], toVector(vectors[i])]);
        recordCount++;
      }
      await stage(jobId, 'load', { records: recordCount });
    }

    // 5. chunk + embed + load text
    let chunkCount = 0;
    if (ex.text && ex.text.trim()) {
      const chunks = chunkText(ex.text, collection.chunking as any);
      await stage(jobId, 'chunk', { chunks: chunks.length });
      const vectors = await embed(chunks.map((c) => (c.heading ? `${c.heading}\n${c.content}` : c.content)));
      await stage(jobId, 'embed', { vectors: vectors.length, model: config.embeddings.model });
      for (let i = 0; i < chunks.length; i++) {
        await query(
          `insert into chunks (collection_id, document_id, version_id, chunk_index, heading, content, token_estimate, embedding, embedding_model, metadata) values ($1,$2,$3,$4,$5,$6,$7,$8::vector,$9,$10)`,
          [collectionId, documentId, versionId, chunks[i].index, chunks[i].heading, chunks[i].content, chunks[i].tokenEstimate, toVector(vectors[i]), config.embeddings.model, { title }]);
        chunkCount++;
      }
    } else if (ex.rows?.length && !collection.record_schema) {
      // Make tabular deposits searchable as text too: one summary chunk per file.
      const sample = ex.rows.slice(0, 50).map((r) => rowToText(r)).join('\n');
      let summary: string;
      try { summary = await summarizeForEmbedding(sample); }
      catch (e) { summary = `${title}: ${ex.rows.length} rows. Columns: ${Object.keys(ex.rows[0] || {}).filter((k) => !k.startsWith('_')).join(', ')}.\n${sample.slice(0, 1500)}`; }
      const [v] = await embed([summary]);
      await query(`insert into chunks (collection_id, document_id, version_id, chunk_index, heading, content, token_estimate, embedding, embedding_model, metadata) values ($1,$2,$3,0,$4,$5,$6,$7::vector,$8,$9)`, [collectionId, documentId, versionId, title, summary, Math.ceil(summary.length / 4), toVector(v), config.embeddings.model, { title, kind: 'tabular-summary' }]);
      chunkCount = 1;
    }

    // 6. activate version, retire old chunks
    await query('delete from chunks where document_id = $1 and version_id <> $2', [documentId, versionId]);
    await query('update document_versions set chunk_count = $2 where id = $1', [versionId, chunkCount]);
    await query(`update documents set status = 'active', current_version_id = $2, updated_at = now() where id = $1`, [documentId, versionId]);
    const result = { document_id: documentId, version_id: versionId, collection_id: collectionId, chunks: chunkCount, records: recordCount, profile, ms: Date.now() - started };
    await query(`update etl_jobs set status = 'completed', stage = 'load', result = $2, completed_at = now() where id = $1`, [jobId, result]);
    await emitEvent('etl.job.completed', result, { subject: { type: 'document', id: documentId }, correlationId: job.correlation_id });
    await audit('etl.job.completed', result, { resourceType: 'etl_job', resourceId: jobId, userId: job.requested_by, correlationId: job.correlation_id });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await query(`update etl_jobs set status = 'failed', error = $2, completed_at = now() where id = $1`, [jobId, message]);
    if (job.document_id) await query(`update documents set status = 'failed' where id = $1 and status = 'processing'`, [job.document_id]);
    await emitEvent('etl.job.failed', { job_id: jobId, error: message }, { correlationId: job.correlation_id });
    throw err;
  }
}

/** Create a job row (idempotent on idempotency_key) and return its id. Caller enqueues it. */
export async function createEtlJob(input: { collectionId: string; sourceType: string; sourceUri?: string; text?: string; title?: string; profile?: string; requestedBy?: string | null; mimeType?: string; tags?: string[]; route?: 'auto'; force?: boolean; recordKey?: string; idempotencyKey?: string }): Promise<string> {
  const key = input.idempotencyKey || null;
  const row = await one<{ id: string }>(
    `insert into etl_jobs (collection_id, requested_by, source_type, source_uri, input, profile, idempotency_key) values ($1,$2,$3,$4,$5,$6,$7)
     on conflict (idempotency_key) do update set idempotency_key = excluded.idempotency_key returning id`,
    [input.collectionId, input.requestedBy || null, input.sourceType, input.sourceUri || null,
     { text: input.text, title: input.title, mime_type: input.mimeType, tags: input.tags, route: input.route, force: input.force, record_key: input.recordKey }, input.profile || 'auto', key]);
  return row!.id;
}
