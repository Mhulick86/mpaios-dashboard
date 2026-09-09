"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { agents } from "@/lib/agents";
import { maios, STEP_TYPES, type MaiosStep, type MaiosWorkflow, type MaiosRun, type MaiosCollection, type StepType } from "@/lib/maiosClient";
import { RequireRole } from "@/components/RequireRole";
import { Workflow as WorkflowIcon, Play, Trash2, Clock, CheckCircle, XCircle, Loader2, Plus, ChevronDown, ChevronUp, Pencil, Copy, Webhook, CalendarClock, Radio, ShieldCheck, ArrowUp, ArrowDown, X } from "lucide-react";

const ACTIVE = new Set(["queued", "running", "waiting_approval", "paused"]);
const emptyStep = (type: StepType = "agent"): MaiosStep => ({ index: 0, action: "", config: { type, ...(type === "agent" ? { use_knowledge: true, max_tokens: 800 } : {}) }, ...(type === "agent" ? { agent_id: 2 } : {}) });

function StatusIcon({ status }: { status: string }) {
  if (status === "completed") return <CheckCircle className="w-4 h-4 text-brand-green" />;
  if (status === "failed" || status === "cancelled") return <XCircle className="w-4 h-4 text-red-500" />;
  if (status === "running") return <Loader2 className="w-4 h-4 text-brand-blue animate-spin" />;
  if (status === "waiting_approval") return <ShieldCheck className="w-4 h-4 text-amber-500" />;
  return <Clock className="w-4 h-4 text-text-muted" />;
}

const inputCls = "w-full rounded-lg border border-border bg-surface px-3 py-2 text-[12px] focus:outline-none focus:border-brand-blue";
const labelCls = "block text-[11px] font-medium text-text-secondary mb-1";

/**
 * Workflows, runs, approvals and collections are admin-only on the MAIOS proxy
 * (see MEMBER_MAIOS_PATHS in lib/access.ts), so the page is gated the same way.
 */
export default function WorkflowsPage() {
  return (
    <RequireRole min="admin">
      <WorkflowsContent />
    </RequireRole>
  );
}

function WorkflowsContent() {
  const [workflows, setWorkflows] = useState<MaiosWorkflow[]>([]);
  const [runs, setRuns] = useState<MaiosRun[]>([]);
  const [approvals, setApprovals] = useState<Array<{ id: string; workflow_name: string; risk_class: string; proposed_action: unknown; created_at: string }>>([]);
  const [collections, setCollections] = useState<MaiosCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<MaiosWorkflow> | null>(null);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [runDetail, setRunDetail] = useState<MaiosRun | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [wf, rs, ap, cols] = await Promise.all([maios<MaiosWorkflow[]>("/v1/workflows"), maios<MaiosRun[]>("/v1/runs?limit=30"), maios<typeof approvals>("/v1/approvals"), maios<MaiosCollection[]>("/v1/collections")]);
      setWorkflows(wf); setRuns(rs); setApprovals(ap); setCollections(cols); setError(null);
    } catch (e) { setError(e instanceof Error ? e.message : "MAIOS worker unreachable"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const hasActive = useMemo(() => runs.some((r) => ACTIVE.has(r.status)), [runs]);
  useEffect(() => { if (!hasActive) return; const t = setInterval(load, 4000); return () => clearInterval(t); }, [hasActive, load]);
  useEffect(() => { if (!expandedRun) { setRunDetail(null); return; } let alive = true; const fetchDetail = () => maios<MaiosRun>(`/v1/runs/${expandedRun}`).then((d) => alive && setRunDetail(d)).catch(() => {}); fetchDetail(); const t = setInterval(fetchDetail, 4000); return () => { alive = false; clearInterval(t); }; }, [expandedRun]);

  const runNow = async (id: string) => { setBusy(id); try { await maios(`/v1/workflows/${id}/runs`, { method: "POST", body: JSON.stringify({ input: {} }) }); await load(); } catch (e) { alert((e as Error).message); } finally { setBusy(null); } };
  const remove = async (id: string) => { if (!confirm("Delete this workflow and its run history?")) return; await maios(`/v1/workflows/${id}`, { method: "DELETE" }); await load(); };
  const decide = async (id: string, decision: "approved" | "rejected") => { await maios(`/v1/approvals/${id}/decide`, { method: "POST", body: JSON.stringify({ decision }) }); await load(); };

  const save = async (draft: Partial<MaiosWorkflow>, trigger: { kind: string; cron?: string; timezone?: string; event_type?: string }) => {
    const body = { id: draft.id, name: draft.name, description: draft.description, trigger_type: trigger.kind, trigger_config: draft.trigger_config || {}, steps: (draft.steps || []).map((s, i) => ({ ...s, index: i })), is_active: draft.is_active ?? true };
    const saved = await maios<MaiosWorkflow>("/v1/workflows", { method: "POST", body: JSON.stringify(body) });
    if (trigger.kind !== "manual") {
      const existing = (draft.triggers || []).find((t) => t.kind === trigger.kind);
      if (!existing || existing.cron !== (trigger.cron || null) || existing.event_type !== (trigger.event_type || null)) {
        if (existing) await maios(`/v1/triggers/${existing.id}`, { method: "DELETE" });
        await maios("/v1/triggers", { method: "POST", body: JSON.stringify({ workflow_id: saved.id, kind: trigger.kind, cron: trigger.cron, timezone: trigger.timezone, event_type: trigger.event_type }) });
      }
    }
    setEditing(null); await load();
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[20px] md:text-[24px] font-semibold">Workflows</h1>
          <p className="text-[12px] md:text-[14px] text-text-secondary mt-1">Durable automations on the MAIOS engine &middot; {workflows.length} workflows &middot; {runs.filter((r) => ACTIVE.has(r.status)).length} active runs</p>
        </div>
        <button onClick={() => setEditing({ name: "", description: "", trigger_type: "manual", steps: [emptyStep("search_knowledge"), emptyStep("agent")], trigger_config: {} })} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-blue text-white text-[12px] font-medium hover:opacity-90"><Plus className="w-4 h-4" /> New workflow</button>
      </div>
      {error && <div className="mb-4 p-3 rounded-lg bg-red-500/5 border border-red-200 text-[12px] text-red-600">{error}. Is the worker running (MAIOS_WORKER_URL)?</div>}

      {approvals.length > 0 && (
        <div className="mb-8">
          <h2 className="text-[14px] font-semibold mb-3 text-text-secondary">Waiting for your approval</h2>
          <div className="space-y-2">{approvals.map((a) => (
            <div key={a.id} className="bg-surface-raised rounded-xl border border-amber-200 p-4 flex items-start justify-between gap-4">
              <div><p className="text-[13px] font-semibold">{a.workflow_name || "Workflow"} &middot; <span className="text-[11px] font-normal text-text-muted">{a.risk_class}</span></p><pre className="mt-1 text-[11px] text-text-secondary whitespace-pre-wrap max-h-32 overflow-auto">{JSON.stringify(a.proposed_action, null, 2)}</pre></div>
              <div className="flex gap-2 shrink-0"><button onClick={() => decide(a.id, "approved")} className="px-3 py-1.5 rounded-lg bg-brand-green/10 text-brand-green text-[12px] font-medium">Approve</button><button onClick={() => decide(a.id, "rejected")} className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-600 text-[12px] font-medium">Reject</button></div>
            </div>))}</div>
        </div>
      )}

      {editing && <WorkflowEditor draft={editing} collections={collections} onCancel={() => setEditing(null)} onSave={save} />}

      <div className="mb-8">
        <h2 className="text-[14px] font-semibold mb-3 text-text-secondary">Workflows</h2>
        {workflows.length ? <div className="space-y-3">{workflows.map((wf) => (
          <div key={wf.id} className="bg-surface-raised rounded-xl border border-border p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <WorkflowIcon className="w-5 h-5 text-brand-blue shrink-0" />
                <div className="min-w-0">
                  <h3 className="text-[13px] font-semibold truncate">{wf.name}{!wf.is_active && <span className="ml-2 text-[10px] text-text-muted">(inactive)</span>}</h3>
                  <p className="text-[11px] text-text-muted">{wf.steps.length} steps &middot; {wf.trigger_type} &middot; {wf.run_count} runs{wf.last_run && <> &middot; last {wf.last_run.status}</>}{wf.active_runs > 0 && <> &middot; {wf.active_runs} active</>}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => runNow(wf.id)} disabled={busy === wf.id} title="Run now" className="p-2 rounded-lg bg-brand-blue/10 text-brand-blue hover:bg-brand-blue/20 disabled:opacity-50">{busy === wf.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}</button>
                <button onClick={() => setEditing(wf)} title="Edit" className="p-2 rounded-lg text-text-muted hover:text-brand-blue hover:bg-brand-blue/10"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => remove(wf.id)} title="Delete" className="p-2 rounded-lg text-text-muted hover:text-red-600 hover:bg-red-500/10"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {wf.steps.map((s, i) => <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-text-secondary">{i + 1}. {(s.config?.type as string) || "agent"}{s.agent_id ? ` · ${agents.find((a) => a.id === s.agent_id)?.shortName || `Agent ${s.agent_id}`}` : ""}</span>)}
            </div>
            {wf.triggers.length > 0 && <div className="mt-3 space-y-1">{wf.triggers.map((t) => (
              <div key={t.id} className="flex items-center gap-2 text-[11px] text-text-secondary">
                {t.kind === "webhook" ? <Webhook className="w-3.5 h-3.5" /> : t.kind === "schedule" ? <CalendarClock className="w-3.5 h-3.5" /> : <Radio className="w-3.5 h-3.5" />}
                {t.kind === "schedule" && <span>cron <code className="bg-gray-100 px-1 rounded">{t.cron}</code> {t.timezone}</span>}
                {t.kind === "event" && <span>on event <code className="bg-gray-100 px-1 rounded">{t.event_type}</code></span>}
                {t.kind === "webhook" && <><code className="bg-gray-100 px-1 rounded truncate max-w-[60vw]">{`${process.env.NEXT_PUBLIC_MAIOS_PUBLIC_URL || ""}/webhooks/${t.webhook_token}`}</code><button onClick={() => navigator.clipboard.writeText(`${process.env.NEXT_PUBLIC_MAIOS_PUBLIC_URL || window.location.origin}/webhooks/${t.webhook_token}`)} className="p-1 text-text-muted hover:text-brand-blue"><Copy className="w-3 h-3" /></button></>}
                {t.last_fired_at && <span className="text-text-muted">· last fired {new Date(t.last_fired_at).toLocaleString()}</span>}
              </div>))}</div>}
          </div>))}</div>
        : <div className="bg-surface-raised rounded-xl border border-border p-8 text-center"><WorkflowIcon className="w-8 h-8 text-text-muted mx-auto mb-3" /><p className="text-[13px] text-text-secondary">No workflows yet. Create one above.</p></div>}
      </div>

      <div>
        <h2 className="text-[14px] font-semibold mb-3 text-text-secondary">Recent runs</h2>
        {runs.length ? <div className="space-y-2">{runs.map((run) => (
          <div key={run.id} className="bg-surface-raised rounded-xl border border-border">
            <div className="flex items-center justify-between p-4 cursor-pointer" onClick={() => setExpandedRun(expandedRun === run.id ? null : run.id)}>
              <div className="flex items-center gap-3"><StatusIcon status={run.status} /><div><p className="text-[12px] font-medium">{run.workflow_name} &middot; {run.status.replace("_", " ")} &middot; step {Math.min(run.current_step + 1, run.total_steps)}/{run.total_steps}</p><p className="text-[10px] text-text-muted">{run.trigger} &middot; {new Date(run.started_at).toLocaleString()}{run.tokens_total > 0 && ` · ${run.tokens_total.toLocaleString()} tokens`}</p></div></div>
              <div className="flex items-center gap-2">{ACTIVE.has(run.status) && <button onClick={(e) => { e.stopPropagation(); maios(`/v1/runs/${run.id}/cancel`, { method: "POST" }).then(load); }} className="text-[11px] text-text-muted hover:text-red-600">cancel</button>}{expandedRun === run.id ? <ChevronUp className="w-4 h-4 text-text-muted" /> : <ChevronDown className="w-4 h-4 text-text-muted" />}</div>
            </div>
            {expandedRun === run.id && runDetail && runDetail.id === run.id && (
              <div className="px-4 pb-4 border-t border-border pt-3 space-y-3">
                {(runDetail.executions || []).map((ex) => <div key={ex.id} className="flex items-center gap-2 text-[12px]"><StatusIcon status={ex.status} /><span className="font-medium">{ex.agent_name}</span><span className="text-text-secondary truncate">{ex.action}</span>{ex.latency_ms != null && <span className="text-text-muted ml-auto shrink-0">{ex.latency_ms} ms</span>}</div>)}
                {(runDetail.step_results || []).map((sr, i) => { const out = sr.output as Record<string, unknown> | undefined; const text = out && (typeof out.text === "string" ? out.text : out.citations ? String(out.citations) : JSON.stringify(out, null, 2)); return text ? <details key={i} className="text-[11px]"><summary className="cursor-pointer text-text-secondary">Step {i + 1} output</summary><pre className="mt-1 p-2 rounded-lg bg-surface whitespace-pre-wrap max-h-64 overflow-auto">{String(text).slice(0, 4000)}</pre></details> : null; })}
                {run.error && <div className="p-2 rounded-lg bg-red-500/5 text-[12px] text-red-600">{run.error}</div>}
              </div>)}
          </div>))}</div>
        : <p className="text-[13px] text-text-muted bg-surface-raised rounded-xl border border-border p-6 text-center">No runs yet.</p>}
      </div>
    </div>
  );
}

function WorkflowEditor({ draft, collections, onCancel, onSave }: { draft: Partial<MaiosWorkflow>; collections: MaiosCollection[]; onCancel: () => void; onSave: (d: Partial<MaiosWorkflow>, trigger: { kind: string; cron?: string; timezone?: string; event_type?: string }) => Promise<void> }) {
  const [d, setD] = useState<Partial<MaiosWorkflow>>({ ...draft, steps: (draft.steps || []).map((s) => ({ ...s, config: { ...(s.config || {}) } })) });
  const existing = (draft.triggers || [])[0];
  const [kind, setKind] = useState<string>(draft.trigger_type || "manual");
  const [cron, setCron] = useState(existing?.cron || "0 8 * * 1-5");
  const [tz, setTz] = useState(existing?.timezone || "America/New_York");
  const [eventType, setEventType] = useState(existing?.event_type || "etl.job.completed");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const steps = d.steps || [];
  const setStep = (i: number, patch: Partial<MaiosStep>) => setD({ ...d, steps: steps.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const setCfg = (i: number, key: string, value: unknown) => setStep(i, { config: { ...steps[i].config, [key]: value } });
  const move = (i: number, dir: -1 | 1) => { const j = i + dir; if (j < 0 || j >= steps.length) return; const arr = [...steps]; [arr[i], arr[j]] = [arr[j], arr[i]]; setD({ ...d, steps: arr }); };

  const submit = async () => { setSaving(true); setErr(null); try { await onSave(d, { kind, cron, timezone: tz, event_type: eventType }); } catch (e) { setErr((e as Error).message); } finally { setSaving(false); } };

  return (
    <div className="mb-8 bg-surface-raised rounded-xl border border-brand-blue/40 p-5">
      <div className="flex items-center justify-between mb-4"><h2 className="text-[15px] font-semibold">{d.id ? "Edit workflow" : "New workflow"}</h2><button onClick={onCancel} className="p-1 text-text-muted hover:text-text-primary"><X className="w-4 h-4" /></button></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <div><label className={labelCls}>Name</label><input className={inputCls} value={d.name || ""} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="Lead intake brief" /></div>
        <div><label className={labelCls}>Description</label><input className={inputCls} value={d.description || ""} onChange={(e) => setD({ ...d, description: e.target.value })} /></div>
        <div><label className={labelCls}>Trigger</label><select className={inputCls} value={kind} onChange={(e) => setKind(e.target.value)}><option value="manual">Manual</option><option value="schedule">Schedule (cron)</option><option value="webhook">Webhook (inbound HTTP)</option><option value="event">Event (internal bus)</option></select></div>
        {kind === "schedule" && <div className="grid grid-cols-2 gap-2"><div><label className={labelCls}>Cron</label><input className={inputCls} value={cron} onChange={(e) => setCron(e.target.value)} /></div><div><label className={labelCls}>Timezone</label><input className={inputCls} value={tz} onChange={(e) => setTz(e.target.value)} /></div></div>}
        {kind === "event" && <div><label className={labelCls}>Event type</label><input className={inputCls} value={eventType} onChange={(e) => setEventType(e.target.value)} placeholder="crm.lead.created" /></div>}
        {kind === "webhook" && <div className="text-[11px] text-text-muted self-end pb-2">A unique webhook URL is generated on save. Send JSON; it is available to steps as {"{{input.webhook.*}}"}.</div>}
        <div><label className={labelCls}>Default knowledge collections (comma slugs, optional)</label><input className={inputCls} value={((d.trigger_config?.collection_slugs as string[]) || []).join(",")} onChange={(e) => { const slugs = e.target.value.split(",").map((s) => s.trim()).filter(Boolean); setD({ ...d, trigger_config: { ...(d.trigger_config || {}), collection_slugs: slugs, collection_ids: collections.filter((c) => slugs.includes(c.slug)).map((c) => c.id) } }); }} placeholder={collections.map((c) => c.slug).join(", ")} /></div>
      </div>

      <h3 className="text-[12px] font-semibold text-text-secondary mb-2">Steps</h3>
      <div className="space-y-3">
        {steps.map((s, i) => { const type = (s.config.type as StepType) || "agent"; return (
          <div key={i} className="rounded-lg border border-border p-3 bg-surface">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[11px] font-semibold text-text-muted w-5">{i + 1}.</span>
              <select className={inputCls + " max-w-[260px]"} value={type} onChange={(e) => setStep(i, { ...emptyStep(e.target.value as StepType), action: s.action })}>{STEP_TYPES.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}</select>
              <input className={inputCls} placeholder="Action name (shown in run history)" value={s.action} onChange={(e) => setStep(i, { action: e.target.value })} />
              <button onClick={() => move(i, -1)} className="p-1 text-text-muted"><ArrowUp className="w-4 h-4" /></button><button onClick={() => move(i, 1)} className="p-1 text-text-muted"><ArrowDown className="w-4 h-4" /></button>
              <button onClick={() => setD({ ...d, steps: steps.filter((_, j) => j !== i) })} className="p-1 text-text-muted hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {type === "agent" && <>
                <div><label className={labelCls}>Agent</label><select className={inputCls} value={s.agent_id || 2} onChange={(e) => setStep(i, { agent_id: Number(e.target.value) })}>{agents.map((a) => <option key={a.id} value={a.id}>{String(a.id).padStart(2, "0")} · {a.name}</option>)}</select></div>
                <div><label className={labelCls}>Model (blank = default local)</label><input className={inputCls} value={(s.config.model as string) || ""} onChange={(e) => setCfg(i, "model", e.target.value || undefined)} placeholder="claude-sonnet-4-20250514 or local model id" /></div>
                <div className="md:col-span-2"><label className={labelCls}>Prompt (templates: {"{{input.x}}"}, {"{{steps.0.output.citations}}"}, {"{{prev.text}}"})</label><textarea className={inputCls} rows={3} value={(s.config.prompt as string) || ""} onChange={(e) => setCfg(i, "prompt", e.target.value)} placeholder="Leave blank to use the action + description + previous outputs" /></div>
                <div><label className={labelCls}>Description</label><input className={inputCls} value={s.description || ""} onChange={(e) => setStep(i, { description: e.target.value })} /></div>
                <div className="flex items-end gap-3"><label className="flex items-center gap-2 text-[12px]"><input type="checkbox" checked={s.config.use_knowledge !== false} onChange={(e) => setCfg(i, "use_knowledge", e.target.checked)} /> auto-retrieve knowledge</label><label className="flex items-center gap-2 text-[12px]">max tokens <input type="number" className={inputCls + " w-24"} value={(s.config.max_tokens as number) || 800} onChange={(e) => setCfg(i, "max_tokens", Number(e.target.value))} /></label></div>
              </>}
              {type === "search_knowledge" && <>
                <div className="md:col-span-2"><label className={labelCls}>Query (templated)</label><input className={inputCls} value={(s.config.query as string) || ""} onChange={(e) => setCfg(i, "query", e.target.value)} placeholder="client onboarding {{input.webhook.vertical}}" /></div>
                <div><label className={labelCls}>Collections</label><select multiple className={inputCls} value={(s.config.collection_slugs as string[]) || []} onChange={(e) => { const slugs = Array.from(e.target.selectedOptions).map((o) => o.value); setStep(i, { config: { ...s.config, collection_slugs: slugs, collection_ids: collections.filter((c) => slugs.includes(c.slug)).map((c) => c.id) } }); }}>{collections.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}</select></div>
                <div className="flex items-end gap-3"><label className="text-[12px]">limit <input type="number" className={inputCls + " w-20"} value={(s.config.limit as number) || 6} onChange={(e) => setCfg(i, "limit", Number(e.target.value))} /></label><label className="flex items-center gap-2 text-[12px]"><input type="checkbox" checked={!!s.config.include_records} onChange={(e) => setCfg(i, "include_records", e.target.checked)} /> include records</label></div>
              </>}
              {type === "etl.ingest" && <>
                <div><label className={labelCls}>Collection</label><select className={inputCls} value={(s.config.collection as string) || ""} onChange={(e) => setCfg(i, "collection", e.target.value)}><option value="">choose…</option>{collections.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}</select></div>
                <div><label className={labelCls}>Profile</label><select className={inputCls} value={(s.config.profile as string) || "auto"} onChange={(e) => setCfg(i, "profile", e.target.value)}>{["auto", "document", "web", "tabular", "records", "transcript", "text"].map((p) => <option key={p}>{p}</option>)}</select></div>
                <div><label className={labelCls}>URL or NAS path (tnas://…)</label><input className={inputCls} value={(s.config.url as string) || (s.config.source_uri as string) || ""} onChange={(e) => setCfg(i, e.target.value.startsWith("http") ? "url" : "source_uri", e.target.value)} placeholder="https://… or {{input.webhook.url}}" /></div>
                <div><label className={labelCls}>Or inline text (templated)</label><input className={inputCls} value={(s.config.text as string) || ""} onChange={(e) => setCfg(i, "text", e.target.value)} placeholder="{{prev.text}}" /></div>
              </>}
              {type === "asana.create_task" && <>
                <div><label className={labelCls}>Task name</label><input className={inputCls} value={(s.config.name as string) || ""} onChange={(e) => setCfg(i, "name", e.target.value)} /></div>
                <div><label className={labelCls}>Project GID</label><input className={inputCls} value={(s.config.project_gid as string) || ""} onChange={(e) => setCfg(i, "project_gid", e.target.value)} /></div>
                <div className="md:col-span-2"><label className={labelCls}>Notes (templated)</label><textarea className={inputCls} rows={2} value={(s.config.notes as string) || ""} onChange={(e) => setCfg(i, "notes", e.target.value)} placeholder="{{prev.text}}" /></div>
              </>}
              {type === "asana.create_project" && <>
                <div><label className={labelCls}>Project name</label><input className={inputCls} value={(s.config.name as string) || ""} onChange={(e) => setCfg(i, "name", e.target.value)} /></div>
                <div><label className={labelCls}>Sections (comma)</label><input className={inputCls} value={((s.config.sections as string[]) || []).join(",")} onChange={(e) => setCfg(i, "sections", e.target.value.split(",").map((x) => x.trim()).filter(Boolean))} placeholder="To Do, In Progress, Done" /></div>
              </>}
              {type === "slack.notify" && <div className="md:col-span-2"><label className={labelCls}>Message (templated)</label><textarea className={inputCls} rows={2} value={(s.config.text as string) || ""} onChange={(e) => setCfg(i, "text", e.target.value)} /></div>}
              {type === "http.request" && <>
                <div><label className={labelCls}>URL</label><input className={inputCls} value={(s.config.url as string) || ""} onChange={(e) => setCfg(i, "url", e.target.value)} /></div>
                <div><label className={labelCls}>Method</label><select className={inputCls} value={(s.config.method as string) || "POST"} onChange={(e) => setCfg(i, "method", e.target.value)}>{["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => <option key={m}>{m}</option>)}</select></div>
                <div className="md:col-span-2"><label className={labelCls}>JSON body (templated)</label><textarea className={inputCls} rows={2} value={typeof s.config.body === "string" ? (s.config.body as string) : JSON.stringify(s.config.body || {}, null, 0)} onChange={(e) => { try { setCfg(i, "body", JSON.parse(e.target.value)); } catch { setCfg(i, "body", e.target.value); } }} /></div>
              </>}
              {type === "emit_event" && <>
                <div><label className={labelCls}>Event type</label><input className={inputCls} value={(s.config.event_type as string) || ""} onChange={(e) => setCfg(i, "event_type", e.target.value)} placeholder="crm.lead.briefed" /></div>
                <div><label className={labelCls}>Payload JSON (templated)</label><input className={inputCls} value={JSON.stringify(s.config.payload || {})} onChange={(e) => { try { setCfg(i, "payload", JSON.parse(e.target.value)); } catch { /* keep typing */ } }} /></div>
              </>}
              {type === "wait_approval" && <>
                <div><label className={labelCls}>Risk class</label><select className={inputCls} value={(s.config.risk_class as string) || "provider_write"} onChange={(e) => setCfg(i, "risk_class", e.target.value)}>{["provider_write", "external_communication", "destructive", "financial"].map((r) => <option key={r}>{r}</option>)}</select></div>
                <div><label className={labelCls}>Proposed action (JSON, templated)</label><input className={inputCls} value={JSON.stringify(s.config.proposed_action || {})} onChange={(e) => { try { setCfg(i, "proposed_action", JSON.parse(e.target.value)); } catch { /* typing */ } }} /></div>
              </>}
              {type === "transform" && <div className="md:col-span-2"><label className={labelCls}>Output JSON (templated)</label><input className={inputCls} value={JSON.stringify(s.config.output || {})} onChange={(e) => { try { setCfg(i, "output", JSON.parse(e.target.value)); } catch { /* typing */ } }} /></div>}
              <div className="md:col-span-2"><label className="flex items-center gap-2 text-[11px] text-text-muted"><input type="checkbox" checked={!!s.config.optional} onChange={(e) => setCfg(i, "optional", e.target.checked)} /> optional (a failure here doesn&apos;t fail the run)</label></div>
            </div>
          </div>); })}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button onClick={() => setD({ ...d, steps: [...steps, emptyStep("agent")] })} className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-[12px] hover:border-brand-blue"><Plus className="w-3.5 h-3.5" /> Add step</button>
        <div className="ml-auto flex items-center gap-2">{err && <span className="text-[11px] text-red-600">{err}</span>}<button onClick={onCancel} className="px-3 py-1.5 rounded-lg text-[12px] text-text-secondary">Cancel</button><button onClick={submit} disabled={saving || !d.name || !steps.length} className="px-4 py-1.5 rounded-lg bg-brand-blue text-white text-[12px] font-medium disabled:opacity-50">{saving ? "Saving…" : "Save workflow"}</button></div>
      </div>
    </div>
  );
}
