/** Cron scheduler + event bus listener. Replaces n8n schedule/event triggers. */
import parser from 'cron-parser';
import pg from 'pg';
import { config } from '../config.ts';
import { query } from '../db.ts';
import { enqueueRun } from './runner.ts';

export async function tickSchedules(now = new Date()): Promise<number> {
  const rows = await query<any>(`select t.*, w.is_active as wf_active from workflow_triggers t join workflows w on w.id = t.workflow_id where t.kind = 'schedule' and t.is_active and w.is_active and t.cron is not null`);
  let fired = 0;
  const minute = new Date(now); minute.setSeconds(0, 0);
  for (const t of rows) {
    try {
      const it = parser.parseExpression(t.cron, { currentDate: new Date(minute.getTime() - 60_000), tz: t.timezone || 'UTC' });
      const next = it.next().toDate();
      if (next.getTime() !== minute.getTime()) continue;
      await enqueueRun(t.workflow_id, { scheduled_for: minute.toISOString() }, { trigger: 'schedule', idempotencyKey: `sched:${t.id}:${minute.toISOString()}` });
      await query('update workflow_triggers set last_fired_at = now() where id = $1', [t.id]);
      fired++;
    } catch (e) { console.error('[scheduler] trigger', t.id, (e as Error).message); }
  }
  return fired;
}

function matches(filter: Record<string, unknown>, payload: Record<string, unknown>): boolean {
  return Object.entries(filter || {}).every(([k, v]) => JSON.stringify((payload as any)[k]) === JSON.stringify(v));
}

export async function processEvent(eventId: string): Promise<number> {
  const [ev] = await query<any>('select * from workflow_events where id = $1 and processed_at is null', [eventId]);
  if (!ev) return 0;
  const triggers = await query<any>(`select t.* from workflow_triggers t join workflows w on w.id = t.workflow_id where t.kind = 'event' and t.is_active and w.is_active and t.event_type = $1`, [ev.event_type]);
  let fired = 0;
  for (const t of triggers) {
    if (!matches(t.event_filter, ev.payload)) continue;
    await enqueueRun(t.workflow_id, { event: ev }, { trigger: `event:${ev.event_type}`, idempotencyKey: `event:${t.id}:${ev.id}`, correlationId: ev.correlation_id });
    await query('update workflow_triggers set last_fired_at = now() where id = $1', [t.id]);
    fired++;
  }
  await query('update workflow_events set processed_at = now() where id = $1', [eventId]);
  return fired;
}

/** LISTEN maios_events (pg_notify from the insert trigger) with a periodic sweep for anything missed. */
export async function startEventListener() {
  const client = new pg.Client({ connectionString: config.databaseUrl });
  await client.connect();
  await client.query('listen maios_events');
  client.on('notification', async (msg) => {
    try { const { id } = JSON.parse(msg.payload || '{}'); if (id) await processEvent(id); } catch (e) { console.error('[events]', (e as Error).message); }
  });
  client.on('error', (e) => console.error('[events] connection error', e.message));
  const sweep = async () => {
    const pending = await query<{ id: string }>('select id from workflow_events where processed_at is null order by recorded_at limit 100');
    for (const p of pending) await processEvent(p.id).catch((e) => console.error('[events sweep]', e.message));
  };
  await sweep();
  setInterval(sweep, 60_000);
  return client;
}

export function startScheduler() {
  const run = () => tickSchedules().then((n) => { if (n) console.log(`[scheduler] fired ${n}`); }).catch((e) => console.error('[scheduler]', e.message));
  const msToNextMinute = 60_000 - (Date.now() % 60_000);
  setTimeout(() => { run(); setInterval(run, 60_000); }, msToNextMinute);
}
