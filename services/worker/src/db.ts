import pg from 'pg';
import { config } from './config.ts';

export const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 10 });

export async function query<T = any>(text: string, params: unknown[] = []): Promise<T[]> {
  const res = await pool.query(text, params);
  return res.rows as T[];
}

export async function one<T = any>(text: string, params: unknown[] = []): Promise<T | undefined> {
  return (await query<T>(text, params))[0];
}

/** Run a callback inside a transaction that impersonates a Supabase user, so
 *  RLS and the security-definer search functions evaluate auth.uid() correctly. */
export async function asUser<T>(userId: string | null, fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    if (userId) {
      await client.query(`select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claim.role', 'authenticated', true)`, [userId]);
    } else {
      await client.query(`select set_config('request.jwt.claim.role', 'service_role', true)`);
    }
    const out = await fn(client);
    await client.query('commit');
    return out;
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }
}

export function toVector(v: number[]): string {
  return '[' + v.map((x) => (Number.isFinite(x) ? x.toFixed(7) : '0')).join(',') + ']';
}

export async function orgId(): Promise<string> {
  const row = await one<{ id: string }>('select id from organizations where slug = $1', [config.orgSlug]);
  if (!row) throw new Error(`organization ${config.orgSlug} not found`);
  return row.id;
}

export async function emitEvent(eventType: string, payload: Record<string, unknown>, opts: { subject?: Record<string, unknown>; correlationId?: string; causationId?: string; actor?: Record<string, unknown> } = {}) {
  const org = await orgId();
  await query(
    `insert into workflow_events (event_type, tenant_id, actor, subject, payload, correlation_id, causation_id)
     values ($1,$2,$3,$4,$5,coalesce($6::uuid, gen_random_uuid()),$7)`,
    [eventType, org, opts.actor || { type: 'service', id: 'worker' }, opts.subject || {}, payload, opts.correlationId || null, opts.causationId || null],
  );
}

export async function audit(eventType: string, details: Record<string, unknown>, extra: { resourceType?: string; resourceId?: string; userId?: string | null; correlationId?: string } = {}) {
  await query(
    `insert into audit_log (user_id, event_type, resource_type, resource_id, details, correlation_id) values ($1,$2,$3,$4,$5,$6)`,
    [extra.userId || null, eventType, extra.resourceType || null, extra.resourceId || null, details, extra.correlationId || null],
  );
}
