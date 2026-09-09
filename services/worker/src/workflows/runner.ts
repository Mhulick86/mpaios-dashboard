/** Durable execution of a workflow_runs row. Resumable: current_step and step_results live in PostgreSQL. */
import { query, one, audit, emitEvent } from '../db.ts';
import { executeStep, type StepDef } from './steps.ts';
import { notifySlack } from '../providers/slack.ts';

export async function runWorkflow(runId: string): Promise<'completed' | 'failed' | 'paused'> {
  const run = await one<any>('select * from workflow_runs where id = $1', [runId]);
  if (!run) throw new Error(`run ${runId} not found`);
  if (['completed', 'cancelled'].includes(run.status)) return run.status;
  const wf = await one<any>('select * from workflows where id = $1', [run.workflow_id]);
  if (!wf) throw new Error(`workflow ${run.workflow_id} missing`);
  const steps: StepDef[] = (wf.steps || []).slice().sort((a: StepDef, b: StepDef) => a.index - b.index);
  const results: Record<string, unknown>[] = Array.isArray(run.step_results) ? run.step_results : [];
  let tokens = Number(run.tokens_total || 0), cost = Number(run.cost_total || 0);
  await query(`update workflow_runs set status = 'running', attempt = attempt + 1, total_steps = $2 where id = $1`, [runId, steps.length]);
  const collectionIds: string[] | undefined = wf.trigger_config?.collection_ids;

  for (let i = run.current_step || 0; i < steps.length; i++) {
    const step = steps[i];
    if (results[i] && (results[i] as any).status === 'completed') continue;
    await query('update workflow_runs set current_step = $2 where id = $1', [runId, i]);
    const exec = await one<{ id: string }>(
      `insert into agent_executions (workflow_run_id, agent_id, agent_name, action, status, input) values ($1,$2,$3,$4,'running',$5) returning id`,
      [runId, step.agent_id || 0, step.config?.type || `Agent ${step.agent_id}`, step.action, { input: run.input, config: step.config }]);
    const t0 = Date.now();
    try {
      const out = await executeStep(step, { runId, workflowId: wf.id, userId: run.user_id, input: run.input || {}, results, correlationId: run.correlation_id, collectionIds });
      const latency = Date.now() - t0;
      const stepTokens = (out.tokensInput || 0) + (out.tokensOutput || 0);
      tokens += stepTokens;
      results[i] = { stepIndex: i, status: out.pause ? 'paused' : 'completed', output: out.output, latency, model: out.model };
      await query(`update agent_executions set status = $2, output = $3, latency_ms = $4, tokens_used = $5, completed_at = now() where id = $1`, [exec!.id, out.pause ? 'queued' : 'completed', out.output, latency, stepTokens]);
      await query('update workflow_runs set step_results = $2, tokens_total = $3 where id = $1', [runId, JSON.stringify(results), tokens]);
      if (out.pause === 'approval') {
        await query(`update workflow_runs set status = 'waiting_approval' where id = $1`, [runId]);
        await notifySlack(`MAIOS: workflow "${wf.name}" is waiting for approval (run ${runId}).`);
        return 'paused';
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results[i] = { stepIndex: i, status: 'failed', error: message, latency: Date.now() - t0 };
      await query(`update agent_executions set status = 'failed', error = $2, completed_at = now() where id = $1`, [exec!.id, message]);
      if (step.config?.optional) { await query('update workflow_runs set step_results = $2 where id = $1', [runId, JSON.stringify(results)]); continue; }
      await query(`update workflow_runs set status = 'failed', step_results = $2, error = $3, tokens_total = $4, cost_total = $5, completed_at = now() where id = $1`, [runId, JSON.stringify(results), `Step ${i} (${step.action}) failed: ${message}`, tokens, cost]);
      await emitEvent('workflow.failed', { run_id: runId, workflow_id: wf.id, step: i, error: message }, { correlationId: run.correlation_id });
      await audit('workflow.failed', { run_id: runId, step: i, error: message }, { resourceType: 'workflow_run', resourceId: runId, correlationId: run.correlation_id });
      throw err;
    }
  }
  const output = results.length ? (results[results.length - 1] as any).output : {};
  await query(`update workflow_runs set status = 'completed', step_results = $2, output = $3, tokens_total = $4, cost_total = $5, completed_at = now() where id = $1`, [runId, JSON.stringify(results), output, tokens, cost]);
  await query(`update workflows set run_count = run_count + 1, last_run_at = now() where id = $1`, [wf.id]);
  await emitEvent('workflow.succeeded', { run_id: runId, workflow_id: wf.id, steps: steps.length, tokens }, { correlationId: run.correlation_id });
  await audit('workflow.completed', { run_id: runId, steps: steps.length, tokens }, { resourceType: 'workflow_run', resourceId: runId, userId: run.user_id, correlationId: run.correlation_id });
  return 'completed';
}

/** Create a run and enqueue it. Idempotent on idempotency_key. */
export async function enqueueRun(workflowId: string, input: Record<string, unknown>, opts: { trigger?: string; userId?: string | null; idempotencyKey?: string; correlationId?: string } = {}): Promise<string> {
  const { workflowQueue } = await import('../queues.ts');
  const row = await one<{ id: string }>(
    `insert into workflow_runs (workflow_id, user_id, status, trigger, input, idempotency_key, correlation_id)
     values ($1,$2,'queued',$3,$4,$5,coalesce($6::uuid, gen_random_uuid()))
     on conflict (idempotency_key) do update set idempotency_key = excluded.idempotency_key returning id`,
    [workflowId, opts.userId || null, opts.trigger || 'manual', input, opts.idempotencyKey || null, opts.correlationId || null]);
  await workflowQueue.add('run', { runId: row!.id }, { jobId: row!.id, attempts: 3, backoff: { type: 'exponential', delay: 15_000 }, removeOnComplete: 500, removeOnFail: 1000 });
  return row!.id;
}
