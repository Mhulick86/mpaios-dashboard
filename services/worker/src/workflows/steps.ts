/**
 * Step executors for the durable workflow engine. A workflow's `steps` (jsonb) keeps the
 * dashboard's shape { index, agent_id, action, description, config, depends_on } and adds
 * `config.type` to select the executor:
 *   agent (default)      run an MPAIOS agent prompt through the model gateway
 *   search_knowledge     retrieve from the knowledge base with access control
 *   etl.ingest           deposit a source into a collection
 *   asana.create_task    TaskProvider write
 *   asana.create_project TaskProvider write
 *   slack.notify         NotificationProvider write
 *   http.request         call an external URL (allowlist enforced)
 *   emit_event           publish a canonical event (fan-out to other workflows)
 *   wait_approval        pause the run until a human approves in the dashboard
 *   transform            pure JS-free templating of previous outputs
 */
import { chat } from '../model/gateway.ts';
import { searchKnowledge, formatCitations } from '../knowledge/search.ts';
import { asanaProvider } from '../providers/asana.ts';
import { notifySlack } from '../providers/slack.ts';
import { createEtlJob, runEtlJob } from '../etl/pipeline.ts';
import { emitEvent, one, query } from '../db.ts';
import { AGENT_PROMPTS } from '../../../../lib/agentPrompts.ts';
import { agents } from '../../../../lib/agents.ts';

export interface StepDef { index: number; agent_id?: number; action: string; description?: string; config?: Record<string, any>; depends_on?: number[] }
export interface StepContext { runId: string; workflowId: string; userId: string | null; input: Record<string, unknown>; results: Record<string, unknown>[]; correlationId: string; collectionIds?: string[] }
export interface StepOutcome { output: Record<string, unknown>; tokensInput?: number; tokensOutput?: number; model?: string; pause?: 'approval' }

const ALLOWED_HOSTS = (process.env.HTTP_STEP_ALLOWLIST || '').split(',').map((s) => s.trim()).filter(Boolean);

/** Very small template engine: {{input.x}}, {{steps.2.output.text}}, {{prev.text}} */
export function render(template: unknown, ctx: StepContext): unknown {
  if (typeof template === 'string') {
    return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, expr: string) => {
      const path = expr.split('.');
      let cur: any = path[0] === 'input' ? ctx.input : path[0] === 'steps' ? ctx.results : path[0] === 'prev' ? ctx.results[ctx.results.length - 1] : undefined;
      for (const p of path.slice(1)) cur = cur?.[p];
      return cur === undefined || cur === null ? '' : typeof cur === 'string' ? cur : JSON.stringify(cur);
    });
  }
  if (Array.isArray(template)) return template.map((t) => render(t, ctx));
  if (template && typeof template === 'object') return Object.fromEntries(Object.entries(template).map(([k, v]) => [k, render(v, ctx)]));
  return template;
}

export async function executeStep(step: StepDef, ctx: StepContext): Promise<StepOutcome> {
  const cfg = (render(step.config || {}, ctx) as Record<string, any>) || {};
  const type = cfg.type || (step.agent_id ? 'agent' : 'transform');
  switch (type) {
    case 'agent': {
      const agent = agents.find((a: any) => a.id === step.agent_id);
      const system = AGENT_PROMPTS[step.agent_id as number] || 'You are an MPAIOS specialist agent.';
      let knowledge = '';
      if (cfg.use_knowledge !== false) {
        try {
          const hits = await searchKnowledge({ query: `${step.action} ${step.description || ''} ${JSON.stringify(ctx.input).slice(0, 500)}`, userId: ctx.userId, collectionIds: ctx.collectionIds, limit: 6 });
          if (hits.length) knowledge = `\n\n## Company knowledge (cite by [n])\n${formatCitations(hits)}`;
        } catch (e) { knowledge = `\n\n(knowledge search unavailable: ${(e as Error).message})`; }
      }
      const user = cfg.prompt || `Execute workflow step: ${step.action}\n\nDescription: ${step.description || ''}\n\nContext from previous steps:\n${JSON.stringify(ctx.results.slice(-3), null, 2).slice(0, 6000)}\n\nWorkflow input:\n${JSON.stringify(ctx.input, null, 2).slice(0, 4000)}`;
      const r = await chat([{ role: 'system', content: system + knowledge }, { role: 'user', content: user }], { model: cfg.model, temperature: cfg.temperature, maxTokens: cfg.max_tokens });
      return { output: { text: r.text, agentId: step.agent_id, agentName: agent?.shortName || agent?.name, action: step.action }, tokensInput: r.tokensInput, tokensOutput: r.tokensOutput, model: r.model };
    }
    case 'search_knowledge': {
      const hits = await searchKnowledge({ query: cfg.query || String(ctx.input.query || ''), userId: ctx.userId, collectionIds: cfg.collection_ids || ctx.collectionIds, limit: cfg.limit || 8, includeRecords: !!cfg.include_records });
      return { output: { hits, citations: formatCitations(hits) } };
    }
    case 'etl.ingest': {
      const col = await one<{ id: string }>('select id from knowledge_collections where slug = $1 or id::text = $1', [cfg.collection]);
      if (!col) throw new Error(`collection ${cfg.collection} not found`);
      const jobId = await createEtlJob({ collectionId: col.id, sourceType: cfg.source_type || (cfg.url ? 'url' : cfg.text ? 'text' : 'file'), sourceUri: cfg.url || cfg.source_uri, text: cfg.text, title: cfg.title, profile: cfg.profile, requestedBy: ctx.userId, route: cfg.route, idempotencyKey: `run:${ctx.runId}:step:${step.index}` });
      await runEtlJob(jobId);
      const job = await one('select status, result, error from etl_jobs where id = $1', [jobId]);
      return { output: { job_id: jobId, ...job } };
    }
    case 'asana.create_task': {
      const t = await asanaProvider.createTask({ name: cfg.name, notes: cfg.notes, projectGid: cfg.project_gid, sectionGid: cfg.section_gid, dueOn: cfg.due_on, assigneeGid: cfg.assignee_gid, canonicalType: 'workflow_run', canonicalId: ctx.runId, idempotencyKey: `run:${ctx.runId}:step:${step.index}` });
      return { output: t };
    }
    case 'asana.create_project': {
      const p = await asanaProvider.createProject({ name: cfg.name, notes: cfg.notes, sections: cfg.sections, teamGid: cfg.team_gid });
      for (const task of cfg.tasks || []) await asanaProvider.createTask({ name: task.name, notes: task.notes, projectGid: p.gid, sectionGid: p.sections[task.section] || Object.values(p.sections)[0], idempotencyKey: `run:${ctx.runId}:step:${step.index}:task:${task.name}` });
      return { output: p };
    }
    case 'slack.notify': {
      const ok = await notifySlack(cfg.text || cfg.message || '');
      return { output: { delivered: ok } };
    }
    case 'http.request': {
      const url = new URL(cfg.url);
      if (ALLOWED_HOSTS.length && !ALLOWED_HOSTS.includes(url.hostname)) throw new Error(`host ${url.hostname} not in HTTP_STEP_ALLOWLIST`);
      const res = await fetch(url, { method: cfg.method || 'POST', headers: { 'content-type': 'application/json', ...(cfg.headers || {}) }, body: cfg.body ? JSON.stringify(cfg.body) : undefined });
      const text = await res.text();
      let json: unknown = null; try { json = JSON.parse(text); } catch { /* not json */ }
      if (!res.ok) throw new Error(`http.request ${res.status}: ${text.slice(0, 300)}`);
      return { output: { status: res.status, body: json ?? text.slice(0, 4000) } };
    }
    case 'emit_event': {
      await emitEvent(cfg.event_type, cfg.payload || {}, { correlationId: ctx.correlationId, causationId: ctx.runId, subject: { type: 'workflow_run', id: ctx.runId } });
      return { output: { emitted: cfg.event_type } };
    }
    case 'wait_approval': {
      await query(`insert into approvals (workflow_run_id, risk_class, proposed_action, evidence) values ($1,$2,$3,$4)`, [ctx.runId, cfg.risk_class || 'provider_write', cfg.proposed_action || { step: step.action }, { previous: ctx.results.slice(-1) }]);
      return { output: { waiting: true }, pause: 'approval' };
    }
    case 'transform':
    default:
      return { output: cfg.output ?? { value: cfg.value ?? null } };
  }
}
