/** HTTP surface of the worker: health, webhooks, ETL, knowledge search, workflow runs, approvals. */
import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { config } from './config.ts';
import { query, one, orgId, asUser, audit } from './db.ts';
import { etlQueue, workflowQueue } from './queues.ts';
import { agents } from '../../../lib/agents.ts';
import { createEtlJob } from './etl/pipeline.ts';
import { searchKnowledge, formatCitations } from './knowledge/search.ts';
import { enqueueRun } from './workflows/runner.ts';
import { scanKbRoot } from './etl/watcher.ts';

export async function buildServer() {
  const app = Fastify({ logger: { level: 'info' }, bodyLimit: 25 * 1024 * 1024 });
  await app.register(multipart, { limits: { fileSize: 512 * 1024 * 1024 } });

  // Service auth: dashboard/API calls carry the internal key plus the acting user id.
  if (config.isProduction && (config.internalApiKey === 'change-me' || config.internalApiKey.length < 24)) {
    throw new Error('INTERNAL_API_KEY must be set to a long random value in production (see .env.example)');
  }
  app.addHook('onRequest', async (req, reply) => {
    if (req.url.startsWith('/health') || req.url.startsWith('/webhooks/')) return;
    if (req.headers['x-internal-key'] !== config.internalApiKey) return reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'missing or invalid x-internal-key' } });
    // A request without an acting user would run as service_role (bypassing the
    // knowledge ACL). Only explicitly-marked service calls may omit x-user-id.
    if (req.url.startsWith('/v1/') && !req.headers['x-user-id'] && req.headers['x-service-call'] !== '1') {
      return reply.code(401).send({ error: { code: 'NO_ACTING_USER', message: 'x-user-id is required (or x-service-call: 1 for trusted service jobs)' } });
    }
  });
  const actor = (req: any): string | null => (req.headers['x-user-id'] as string) || null;

  app.get('/health', async () => {
    const db = await one<{ now: string }>('select now()::text as now');
    const [etlCounts, wfCounts] = await Promise.all([etlQueue.getJobCounts(), workflowQueue.getJobCounts()]);
    return { ok: true, db: db?.now, queues: { etl: etlCounts, workflow: wfCounts }, embeddings: config.embeddings.model, llm: config.llm.model };
  });

  // ── Collections ────────────────────────────────────────────────────────────
  // agent_collection_access arrives with migration 0009; keep the list usable until it is applied.
  let agentAccessReady = false;
  const hasAgentAccess = async () => agentAccessReady || (agentAccessReady = !!(await one<{ ok: boolean }>(`select to_regclass('public.agent_collection_access') is not null as ok`))?.ok);
  app.get('/v1/collections', async () => {
    const org = await orgId();
    const agentIds = (await hasAgentAccess()) ? `coalesce((select array_agg(a.agent_id order by a.agent_id) from agent_collection_access a where a.collection_id = c.id), '{}'::int[])` : `'{}'::int[]`;
    return query(`select c.*, (select count(*) from documents d where d.collection_id = c.id and d.status = 'active') as document_count, ${agentIds} as agent_ids from knowledge_collections c where c.organization_id = $1 order by c.name`, [org]);
  });
  app.post('/v1/collections', async (req, reply) => {
    const body = z.object({ slug: z.string().regex(/^[a-z0-9-]+$/), name: z.string(), description: z.string().optional(), kind: z.enum(['documents', 'records', 'mixed']).default('documents'), classification: z.string().default('internal'), visibility: z.enum(['org', 'members']).default('members'), min_role_level: z.number().int().min(1).max(4).default(2), record_schema: z.record(z.any()).optional() }).parse(req.body);
    const org = await orgId();
    const row = await one(`insert into knowledge_collections (organization_id, slug, name, description, kind, classification, visibility, min_role_level, record_schema, created_by) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *`, [org, body.slug, body.name, body.description || null, body.kind, body.classification, body.visibility, body.min_role_level, body.record_schema || null, actor(req)]);
    if (actor(req)) await query(`insert into collection_members (collection_id, user_id, role, granted_by) values ($1,$2,'manager',$2) on conflict do nothing`, [row.id, actor(req)]);
    return reply.code(201).send(row);
  });
  app.post('/v1/collections/:id/members', async (req) => {
    const { id } = req.params as { id: string };
    const body = z.object({ user_id: z.string().uuid(), role: z.enum(['reader', 'contributor', 'manager']).default('reader') }).parse(req.body);
    await query(`insert into collection_members (collection_id, user_id, role, granted_by) values ($1,$2,$3,$4) on conflict (collection_id, user_id) do update set role = excluded.role`, [id, body.user_id, body.role, actor(req)]);
    return { ok: true };
  });
  app.delete('/v1/collections/:id/members/:userId', async (req) => {
    const { id, userId } = req.params as { id: string; userId: string };
    await query('delete from collection_members where collection_id = $1 and user_id = $2', [id, userId]);
    return { ok: true };
  });

  // ── Agent ↔ collection grants (migration 0009, ADR-0006) ───────────────────
  // Effective access for an agent = its grants ∩ what the acting user can read
  // (knowledge/search.ts). Reads run under the acting user so RLS applies; writes
  // are admin-only: current_role_level() >= 3 is checked inside the impersonated
  // transaction, so a member can never grant an agent anything.
  const KNOWN_AGENT_IDS = new Set<number>(agents.map((a) => a.id));
  const AGENT_ROWS = 'select agent_id, granted_by, note, created_at from agent_collection_access where collection_id = $1 order by agent_id';
  app.get('/v1/collections/:id/agents', async (req) => {
    const id = z.string().uuid().parse((req.params as any).id);
    return asUser(actor(req), async (c) => (await c.query(AGENT_ROWS, [id])).rows);
  });
  const replaceAgents = async (req: any, reply: any) => {
    const id = z.string().uuid().parse(req.params.id);
    const b = z.object({ agent_ids: z.array(z.number().int().positive()).max(200), note: z.string().max(500).optional() }).parse(req.body ?? {});
    const ids = [...new Set(b.agent_ids)].sort((x, y) => x - y);
    const unknown = ids.filter((a) => !KNOWN_AGENT_IDS.has(a));
    if (unknown.length) return reply.code(400).send({ error: { code: 'UNKNOWN_AGENT', message: `unknown agent ids: ${unknown.join(', ')} (see lib/agents.ts)` } });
    const userId = actor(req);
    const out = await asUser(userId, async (c) => {
      const level = Number((await c.query('select public.current_role_level() as level')).rows[0]?.level ?? 0);
      if (level < 3) return { status: 403 as const, rows: [] as any[] };
      if (!(await c.query('select 1 from knowledge_collections where id = $1', [id])).rowCount) return { status: 404 as const, rows: [] as any[] };
      await c.query('delete from agent_collection_access where collection_id = $1 and not (agent_id = any($2::int[]))', [id, ids]);
      if (ids.length) {
        await c.query(
          `insert into agent_collection_access (organization_id, agent_id, collection_id, granted_by, note)
           select k.organization_id, a.agent_id, k.id, (select u.id from auth.users u where u.id = $3::uuid), $4
           from knowledge_collections k, unnest($2::int[]) as a(agent_id) where k.id = $1
           on conflict (collection_id, agent_id) do nothing`, [id, ids, userId, b.note ?? null]);
      }
      return { status: 200 as const, rows: (await c.query(AGENT_ROWS, [id])).rows };
    });
    if (out.status === 403) return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'admin (role level >= 3) required to change agent access' } });
    if (out.status === 404) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'collection' } });
    await audit('collection.agents_updated', { collection_id: id, agent_ids: ids }, { resourceType: 'knowledge_collection', resourceId: id, userId });
    return { ok: true, collection_id: id, agents: out.rows };
  };
  app.put('/v1/collections/:id/agents', replaceAgents);
  app.post('/v1/collections/:id/agents', replaceAgents); // alias: the dashboard proxy (app/api/maios) forwards GET/POST/DELETE only

  // ── ETL ────────────────────────────────────────────────────────────────────
  const etlSchema = z.object({ collection: z.string(), source_type: z.enum(['file', 'url', 'text', 'api', 'transcript']).optional(), source_uri: z.string().optional(), url: z.string().url().optional(), text: z.string().optional(), title: z.string().optional(), profile: z.string().optional(), tags: z.array(z.string()).optional(), route: z.literal('auto').optional(), force: z.boolean().optional(), record_key: z.string().optional(), run_inline: z.boolean().optional() });
  app.post('/v1/etl/jobs', async (req, reply) => {
    const b = etlSchema.parse(req.body);
    const col = await one<{ id: string }>('select id from knowledge_collections where slug = $1 or id::text = $1', [b.collection]);
    if (!col) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: `collection ${b.collection}` } });
    const sourceType = b.source_type || (b.url ? 'url' : b.text ? 'text' : 'file');
    const jobId = await createEtlJob({ collectionId: col.id, sourceType, sourceUri: b.url || b.source_uri, text: b.text, title: b.title, profile: b.profile, tags: b.tags, route: b.route, force: b.force, recordKey: b.record_key, requestedBy: actor(req) });
    await etlQueue.add('etl', { jobId }, { jobId, attempts: 3, backoff: { type: 'exponential', delay: 10_000 } });
    return reply.code(202).send({ job_id: jobId, status: 'queued' });
  });
  // Multipart upload: file lands in KB_ROOT/<collection>/uploads/ then becomes a job.
  app.post('/v1/etl/upload', async (req, reply) => {
    const part = await req.file();
    if (!part) return reply.code(400).send({ error: { code: 'NO_FILE' } });
    const fields = Object.fromEntries(Object.entries(part.fields).map(([k, v]: [string, any]) => [k, v?.value]));
    const col = await one<{ id: string; slug: string }>('select id, slug from knowledge_collections where slug = $1 or id::text = $1', [fields.collection]);
    if (!col) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'collection' } });
    const safe = part.filename.replace(/[^\w.\-]+/g, '_');
    const rel = path.join(col.slug, 'uploads', `${Date.now()}-${safe}`);
    const dest = path.join(config.kbRoot, rel);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, await part.toBuffer());
    const jobId = await createEtlJob({ collectionId: col.id, sourceType: 'upload', sourceUri: `tnas://${rel}`, title: fields.title, profile: fields.profile, mimeType: part.mimetype, requestedBy: actor(req), tags: fields.tags ? String(fields.tags).split(',') : undefined });
    await etlQueue.add('etl', { jobId }, { jobId, attempts: 3, backoff: { type: 'exponential', delay: 10_000 } });
    return reply.code(202).send({ job_id: jobId, status: 'queued', stored_as: `tnas://${rel}` });
  });
  app.get('/v1/etl/jobs/:id', async (req, reply) => {
    const job = await one('select * from etl_jobs where id = $1', [(req.params as any).id]);
    return job ? job : reply.code(404).send({ error: { code: 'NOT_FOUND' } });
  });
  app.get('/v1/etl/jobs', async (req) => {
    const q = req.query as { status?: string; collection?: string; limit?: string };
    return query(`select j.*, c.slug as collection_slug from etl_jobs j join knowledge_collections c on c.id = j.collection_id where ($1::text is null or j.status = $1) and ($2::text is null or c.slug = $2) order by j.created_at desc limit $3`, [q.status || null, q.collection || null, Number(q.limit || 50)]);
  });
  app.post('/v1/etl/scan', async () => scanKbRoot());
  app.get('/v1/documents', async (req) => {
    const q = req.query as { collection?: string; limit?: string };
    return query(`select d.id, d.title, d.source_type, d.source_uri, d.mime_type, d.byte_size, d.status, d.tags, d.created_at, d.updated_at, c.slug as collection_slug, (select chunk_count from document_versions v where v.id = d.current_version_id) as chunk_count from documents d join knowledge_collections c on c.id = d.collection_id where ($1::text is null or c.slug = $1) order by d.updated_at desc limit $2`, [q.collection || null, Number(q.limit || 100)]);
  });

  // ── Knowledge search (what the orchestrator's search_knowledge tool calls) ──
  app.post('/v1/knowledge/search', async (req) => {
    // agent_id (lib/agents.ts id) applies that agent's collection allow-list on top of the acting user's access.
    const b = z.object({ query: z.string().min(1), collections: z.array(z.string()).optional(), agent_id: z.number().int().positive().optional(), limit: z.number().int().min(1).max(50).default(8), include_records: z.boolean().default(false), min_similarity: z.number().min(0).max(1).optional() }).parse(req.body);
    let collectionIds: string[] | undefined;
    if (b.collections?.length) collectionIds = (await query<{ id: string }>('select id from knowledge_collections where slug = any($1) or id::text = any($1)', [b.collections])).map((r) => r.id);
    const hits = await searchKnowledge({ query: b.query, userId: actor(req), collectionIds, agentId: b.agent_id, limit: b.limit, includeRecords: b.include_records, minSimilarity: b.min_similarity });
    return { hits, citations: formatCitations(hits) };
  });

  // ── Workflows ──────────────────────────────────────────────────────────────
  app.get('/v1/workflows', async () => {
    return query(`select w.id, w.name, w.description, w.trigger_type, w.trigger_config, w.steps, w.is_active, w.run_count, w.last_run_at, w.created_at, w.updated_at,
      coalesce((select json_agg(json_build_object('id', t.id, 'kind', t.kind, 'cron', t.cron, 'timezone', t.timezone, 'event_type', t.event_type, 'event_filter', t.event_filter, 'webhook_token', t.webhook_token, 'has_secret', t.webhook_secret is not null, 'is_active', t.is_active, 'last_fired_at', t.last_fired_at)) from workflow_triggers t where t.workflow_id = w.id), '[]'::json) as triggers,
      (select json_build_object('id', r.id, 'status', r.status, 'started_at', r.started_at, 'completed_at', r.completed_at, 'error', r.error) from workflow_runs r where r.workflow_id = w.id order by r.started_at desc limit 1) as last_run,
      (select count(*) from workflow_runs r where r.workflow_id = w.id and r.status in ('queued','running','waiting_approval')) as active_runs
      from workflows w order by w.updated_at desc`);
  });
  const wfSchema = z.object({ id: z.string().uuid().optional(), name: z.string().min(1), description: z.string().optional().nullable(), trigger_type: z.enum(['manual', 'schedule', 'event', 'webhook']).default('manual'), trigger_config: z.record(z.any()).default({}), steps: z.array(z.object({ index: z.number().int(), agent_id: z.number().int().optional(), action: z.string(), description: z.string().optional(), config: z.record(z.any()).default({}), depends_on: z.array(z.number()).optional() })), is_active: z.boolean().default(true) });
  app.post('/v1/workflows', async (req, reply) => {
    const b = wfSchema.parse(req.body);
    const org = await orgId();
    const steps = b.steps.map((s, i) => ({ ...s, index: i }));
    const row = b.id
      ? await one(`update workflows set name = $2, description = $3, trigger_type = $4, trigger_config = $5, steps = $6, is_active = $7 where id = $1 returning *`, [b.id, b.name, b.description || null, b.trigger_type, b.trigger_config, JSON.stringify(steps), b.is_active])
      : await one(`insert into workflows (organization_id, user_id, name, description, trigger_type, trigger_config, steps, is_active) values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`, [org, actor(req), b.name, b.description || null, b.trigger_type, b.trigger_config, JSON.stringify(steps), b.is_active]);
    return reply.code(b.id ? 200 : 201).send(row);
  });
  app.delete('/v1/workflows/:id', async (req) => { await query('delete from workflows where id = $1', [(req.params as any).id]); return { ok: true }; });
  app.delete('/v1/triggers/:id', async (req) => { await query('delete from workflow_triggers where id = $1', [(req.params as any).id]); return { ok: true }; });
  app.get('/v1/workflows/:id/runs', async (req) => {
    const q = req.query as { limit?: string };
    return query(`select id, status, trigger, current_step, total_steps, error, tokens_total, started_at, completed_at from workflow_runs where workflow_id = $1 order by started_at desc limit $2`, [(req.params as any).id, Number(q.limit || 20)]);
  });
  app.get('/v1/runs', async (req) => {
    const q = req.query as { status?: string; limit?: string };
    return query(`select r.id, r.workflow_id, w.name as workflow_name, r.status, r.trigger, r.current_step, r.total_steps, r.error, r.tokens_total, r.started_at, r.completed_at from workflow_runs r join workflows w on w.id = r.workflow_id where ($1::text is null or r.status = $1) order by r.started_at desc limit $2`, [q.status || null, Number(q.limit || 50)]);
  });
  app.get('/v1/approvals', async () => query(`select a.*, w.name as workflow_name from approvals a left join workflow_runs r on r.id = a.workflow_run_id left join workflows w on w.id = r.workflow_id where a.status = 'pending' order by a.created_at`));
  app.get('/v1/events', async (req) => { const q = req.query as { limit?: string }; return query('select id, event_type, payload, correlation_id, occurred_at, processed_at from workflow_events order by recorded_at desc limit $1', [Number(q.limit || 50)]); });
  app.post('/v1/workflows/:id/runs', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = z.object({ input: z.record(z.any()).default({}), idempotency_key: z.string().optional() }).parse(req.body || {});
    const runId = await enqueueRun(id, body.input, { trigger: 'manual', userId: actor(req), idempotencyKey: body.idempotency_key });
    return reply.code(202).send({ run_id: runId });
  });
  app.get('/v1/runs/:id', async (req, reply) => {
    const run = await one('select * from workflow_runs where id = $1', [(req.params as any).id]);
    if (!run) return reply.code(404).send({ error: { code: 'NOT_FOUND' } });
    const executions = await query('select id, agent_id, agent_name, action, status, error, latency_ms, tokens_used, started_at, completed_at from agent_executions where workflow_run_id = $1 order by started_at', [run.id]);
    return { ...run, executions };
  });
  app.post('/v1/runs/:id/cancel', async (req) => {
    await query(`update workflow_runs set status = 'cancelled', completed_at = now() where id = $1 and status in ('queued','running','waiting_approval','paused')`, [(req.params as any).id]);
    return { ok: true };
  });
  app.post('/v1/approvals/:id/decide', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = z.object({ decision: z.enum(['approved', 'rejected']), note: z.string().optional() }).parse(req.body);
    const ap = await one<any>(`update approvals set status = $2, decided_by = $3, decision_note = $4, decided_at = now() where id = $1 and status = 'pending' returning *`, [id, body.decision, actor(req), body.note || null]);
    if (!ap) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'no pending approval' } });
    if (ap.workflow_run_id) {
      if (body.decision === 'approved') {
        await query(`update workflow_runs set status = 'queued', current_step = current_step + 1 where id = $1`, [ap.workflow_run_id]);
        await workflowQueue.add('run', { runId: ap.workflow_run_id }, { jobId: `${ap.workflow_run_id}:resume:${id}`, attempts: 3 });
      } else {
        await query(`update workflow_runs set status = 'cancelled', error = 'rejected in approval', completed_at = now() where id = $1`, [ap.workflow_run_id]);
      }
    }
    return { ok: true, run_id: ap.workflow_run_id };
  });
  app.post('/v1/triggers', async (req, reply) => {
    const b = z.object({ workflow_id: z.string().uuid(), kind: z.enum(['schedule', 'event', 'webhook']), cron: z.string().optional(), timezone: z.string().optional(), event_type: z.string().optional(), event_filter: z.record(z.any()).optional(), with_secret: z.boolean().optional() }).parse(req.body);
    const token = b.kind === 'webhook' ? crypto.randomBytes(18).toString('base64url') : null;
    const secret = b.kind === 'webhook' && b.with_secret ? crypto.randomBytes(24).toString('hex') : null;
    const row = await one(`insert into workflow_triggers (workflow_id, kind, cron, timezone, event_type, event_filter, webhook_token, webhook_secret) values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`, [b.workflow_id, b.kind, b.cron || null, b.timezone || 'America/New_York', b.event_type || null, b.event_filter || {}, token, secret]);
    return reply.code(201).send({ ...row, webhook_url: token ? `${config.publicBaseUrl}/webhooks/${token}` : null });
  });
  app.post('/v1/events', async (req, reply) => {
    const b = z.object({ event_type: z.string(), payload: z.record(z.any()).default({}), subject: z.record(z.any()).optional() }).parse(req.body);
    const { emitEvent } = await import('./db.ts');
    await emitEvent(b.event_type, b.payload, { subject: b.subject, actor: { type: 'user', id: actor(req) } });
    return reply.code(202).send({ ok: true });
  });

  // ── Public webhooks (n8n-style inbound triggers) ────────────────────────────
  app.post('/webhooks/:token', { config: { rawBody: true } }, async (req, reply) => {
    const { token } = req.params as { token: string };
    const trig = await one<any>(`select t.* from workflow_triggers t join workflows w on w.id = t.workflow_id where t.kind = 'webhook' and t.webhook_token = $1 and t.is_active and w.is_active`, [token]);
    if (!trig) return reply.code(404).send({ ok: false });
    let sig: 'none' | 'valid' | 'invalid' = 'none';
    if (trig.webhook_secret) {
      const given = String(req.headers['x-maios-signature'] || '');
      const expected = crypto.createHmac('sha256', trig.webhook_secret).update(JSON.stringify(req.body ?? {})).digest('hex');
      sig = given && crypto.timingSafeEqual(Buffer.from(given.padEnd(expected.length)), Buffer.from(expected)) ? 'valid' : 'invalid';
      if (sig === 'invalid') { await query(`insert into webhook_inbox (provider, trigger_id, signature_status, headers, raw_payload, status) values ('workflow',$1,'invalid',$2,$3,'ignored')`, [trig.id, req.headers, req.body ?? {}]); return reply.code(401).send({ ok: false }); }
    }
    const providerEventId = (req.headers['x-event-id'] as string) || (req.body as any)?.id || null;
    const inbox = await one<{ id: string }>(`insert into webhook_inbox (provider, trigger_id, provider_event_id, signature_status, headers, raw_payload) values ('workflow',$1,$2,$3,$4,$5) on conflict (provider, provider_event_id) where provider_event_id is not null do nothing returning id`, [trig.id, providerEventId, sig, req.headers, req.body ?? {}]);
    if (!inbox) return reply.code(200).send({ ok: true, duplicate: true });
    const runId = await enqueueRun(trig.workflow_id, { webhook: req.body ?? {}, headers: { 'content-type': req.headers['content-type'] } }, { trigger: 'webhook', idempotencyKey: `webhook:${inbox.id}` });
    await query(`update webhook_inbox set status = 'processed', processed_at = now() where id = $1`, [inbox.id]);
    await query('update workflow_triggers set last_fired_at = now() where id = $1', [trig.id]);
    return reply.code(202).send({ ok: true, run_id: runId });
  });

  return app;
}
