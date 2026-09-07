"use client";

import { RequireRole } from "@/components/RequireRole";
import { useCallback, useEffect, useMemo, useState } from "react";
import { maios, type MaiosCollection, type MaiosEtlJob, type MaiosDocument, type MaiosHit } from "@/lib/maiosClient";
import { Database, Upload, Link2, FileText, HardDrive, Loader2, CheckCircle, XCircle, Clock, Search, Plus, Lock, Globe, RefreshCw } from "lucide-react";

const inputCls = "w-full rounded-lg border border-border bg-surface px-3 py-2 text-[12px] focus:outline-none focus:border-brand-blue";
const labelCls = "block text-[11px] font-medium text-text-secondary mb-1";
const ROLE = ["", "viewer", "member", "admin", "owner"];

function DataPageInner() {
  const [collections, setCollections] = useState<MaiosCollection[]>([]);
  const [jobs, setJobs] = useState<MaiosEtlJob[]>([]);
  const [docs, setDocs] = useState<MaiosDocument[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"url" | "text" | "upload" | "nas">("url");
  const [form, setForm] = useState({ collection: "", url: "", text: "", title: "", profile: "auto", source_uri: "", record_key: "", route: false });
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<MaiosHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newCol, setNewCol] = useState({ slug: "", name: "", description: "", kind: "documents", classification: "internal", visibility: "members", min_role_level: 2 });

  const load = useCallback(async () => {
    try {
      const [c, j, d] = await Promise.all([maios<MaiosCollection[]>("/v1/collections"), maios<MaiosEtlJob[]>("/v1/etl/jobs?limit=40"), maios<MaiosDocument[]>("/v1/documents?limit=60")]);
      setCollections(c); setJobs(j); setDocs(d); setError(null);
      if (!form.collection && c.length) setForm((f) => ({ ...f, collection: c[0].slug }));
    } catch (e) { setError(e instanceof Error ? e.message : "MAIOS worker unreachable"); } finally { setLoading(false); }
  }, [form.collection]);
  useEffect(() => { load(); }, [load]);
  const active = useMemo(() => jobs.some((j) => j.status === "queued" || j.status === "running"), [jobs]);
  useEffect(() => { if (!active) return; const t = setInterval(load, 3000); return () => clearInterval(t); }, [active, load]);

  const submit = async () => {
    setSubmitting(true);
    try {
      if (mode === "upload") {
        if (!file) throw new Error("Choose a file");
        const fd = new FormData(); fd.append("collection", form.collection); if (form.title) fd.append("title", form.title); fd.append("profile", form.profile); fd.append("file", file);
        await maios("/v1/etl/upload", { method: "POST", body: fd });
      } else {
        const body: Record<string, unknown> = { collection: form.collection, title: form.title || undefined, profile: form.profile, record_key: form.record_key || undefined, route: form.route ? "auto" : undefined };
        if (mode === "url") body.url = form.url; if (mode === "text") body.text = form.text; if (mode === "nas") { body.source_type = "file"; body.source_uri = form.source_uri.startsWith("tnas://") ? form.source_uri : `tnas://${form.source_uri}`; }
        await maios("/v1/etl/jobs", { method: "POST", body: JSON.stringify(body) });
      }
      setForm((f) => ({ ...f, url: "", text: "", title: "", source_uri: "" })); setFile(null); await load();
    } catch (e) { alert((e as Error).message); } finally { setSubmitting(false); }
  };
  const search = async () => { if (!q.trim()) return; setSearching(true); try { const r = await maios<{ hits: MaiosHit[] }>("/v1/knowledge/search", { method: "POST", body: JSON.stringify({ query: q, limit: 8, include_records: true }) }); setHits(r.hits); } catch (e) { alert((e as Error).message); } finally { setSearching(false); } };
  const createCollection = async () => { try { await maios("/v1/collections", { method: "POST", body: JSON.stringify(newCol) }); setShowNew(false); setNewCol({ slug: "", name: "", description: "", kind: "documents", classification: "internal", visibility: "members", min_role_level: 2 }); await load(); } catch (e) { alert((e as Error).message); } };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-[20px] md:text-[24px] font-semibold">Data &amp; ETL</h1><p className="text-[12px] md:text-[14px] text-text-secondary mt-1">Throw anything at the ETL agent and choose which database it lands in. Access follows each collection&apos;s membership.</p></div>
        <div className="flex gap-2"><button onClick={() => maios("/v1/etl/scan", { method: "POST" }).then(load)} className="flex items-center gap-1 px-3 py-2 rounded-lg border border-border text-[12px] hover:border-brand-blue"><RefreshCw className="w-3.5 h-3.5" /> Scan NAS folders</button><button onClick={() => setShowNew((v) => !v)} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-blue text-white text-[12px] font-medium"><Plus className="w-4 h-4" /> New collection</button></div>
      </div>
      {error && <div className="mb-4 p-3 rounded-lg bg-red-500/5 border border-red-200 text-[12px] text-red-600">{error}. Is the worker running (MAIOS_WORKER_URL)?</div>}

      {showNew && <div className="mb-6 bg-surface-raised rounded-xl border border-brand-blue/40 p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div><label className={labelCls}>Slug</label><input className={inputCls} value={newCol.slug} onChange={(e) => setNewCol({ ...newCol, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} placeholder="haven-health" /></div>
        <div><label className={labelCls}>Name</label><input className={inputCls} value={newCol.name} onChange={(e) => setNewCol({ ...newCol, name: e.target.value })} /></div>
        <div><label className={labelCls}>Description</label><input className={inputCls} value={newCol.description} onChange={(e) => setNewCol({ ...newCol, description: e.target.value })} /></div>
        <div><label className={labelCls}>Kind</label><select className={inputCls} value={newCol.kind} onChange={(e) => setNewCol({ ...newCol, kind: e.target.value })}><option value="documents">documents</option><option value="records">records (tabular)</option><option value="mixed">mixed</option></select></div>
        <div><label className={labelCls}>Classification</label><select className={inputCls} value={newCol.classification} onChange={(e) => setNewCol({ ...newCol, classification: e.target.value })}>{["public", "internal", "confidential", "restricted", "regulated"].map((c) => <option key={c}>{c}</option>)}</select></div>
        <div><label className={labelCls}>Who can read</label><select className={inputCls} value={newCol.visibility === "org" ? `org:${newCol.min_role_level}` : "members"} onChange={(e) => { const v = e.target.value; if (v === "members") setNewCol({ ...newCol, visibility: "members" }); else setNewCol({ ...newCol, visibility: "org", min_role_level: Number(v.split(":")[1]) }); }}><option value="members">Only explicit members</option><option value="org:1">Everyone in the org (viewer+)</option><option value="org:2">Members and above</option><option value="org:3">Admins and owners</option></select></div>
        <div className="md:col-span-3 flex justify-end gap-2"><button onClick={() => setShowNew(false)} className="px-3 py-1.5 text-[12px] text-text-secondary">Cancel</button><button onClick={createCollection} disabled={!newCol.slug || !newCol.name} className="px-4 py-1.5 rounded-lg bg-brand-blue text-white text-[12px] font-medium disabled:opacity-50">Create</button></div>
      </div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
        {collections.map((c) => <div key={c.id} className="bg-surface-raised rounded-xl border border-border p-4">
          <div className="flex items-start justify-between gap-2"><div className="min-w-0"><h3 className="text-[13px] font-semibold truncate">{c.name}</h3><p className="text-[10px] text-text-muted font-mono">{c.slug}</p></div><Database className="w-4 h-4 text-brand-blue shrink-0" /></div>
          {c.description && <p className="text-[11px] text-text-secondary mt-2 line-clamp-2">{c.description}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[10px]"><span className="px-2 py-0.5 rounded-full bg-gray-100 text-text-secondary">{c.document_count} docs</span><span className="px-2 py-0.5 rounded-full bg-gray-100 text-text-secondary">{c.classification}</span><span className="px-2 py-0.5 rounded-full bg-gray-100 text-text-secondary inline-flex items-center gap-1">{c.visibility === "members" ? <><Lock className="w-3 h-3" /> members only</> : <><Globe className="w-3 h-3" /> org · {ROLE[c.min_role_level]}+</>}</span></div>
        </div>)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-8">
        <div className="bg-surface-raised rounded-xl border border-border p-4">
          <h2 className="text-[14px] font-semibold mb-3">Deposit into a database</h2>
          <div className="flex gap-1 mb-3">{([["url", Link2, "URL"], ["text", FileText, "Paste text / JSON"], ["upload", Upload, "Upload file"], ["nas", HardDrive, "NAS path"]] as const).map(([m, Icon, label]) => <button key={m} onClick={() => setMode(m)} className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] border ${mode === m ? "border-brand-blue text-brand-blue bg-brand-blue/5" : "border-border text-text-secondary"}`}><Icon className="w-3.5 h-3.5" /> {label}</button>)}</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><label className={labelCls}>Target collection</label><select className={inputCls} value={form.collection} onChange={(e) => setForm({ ...form, collection: e.target.value })}>{collections.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}</select></div>
            <div><label className={labelCls}>Profile</label><select className={inputCls} value={form.profile} onChange={(e) => setForm({ ...form, profile: e.target.value })}>{["auto", "document", "web", "tabular", "records", "transcript", "text"].map((p) => <option key={p}>{p}</option>)}</select></div>
            {mode === "url" && <div className="md:col-span-2"><label className={labelCls}>URL (web page or JSON API)</label><input className={inputCls} value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://…" /></div>}
            {mode === "text" && <div className="md:col-span-2"><label className={labelCls}>Text, markdown, JSON array or JSONL</label><textarea className={inputCls} rows={5} value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} /></div>}
            {mode === "upload" && <div className="md:col-span-2"><label className={labelCls}>File (pdf, docx, md, txt, html, csv, xlsx, json, audio for transcription)</label><input type="file" className="text-[12px]" onChange={(e) => setFile(e.target.files?.[0] || null)} /></div>}
            {mode === "nas" && <div className="md:col-span-2"><label className={labelCls}>Path under the knowledge root (e.g. company-kb/policies/hipaa.pdf)</label><input className={inputCls} value={form.source_uri} onChange={(e) => setForm({ ...form, source_uri: e.target.value })} /></div>}
            <div><label className={labelCls}>Title (optional)</label><input className={inputCls} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><label className={labelCls}>Record key column (tabular, optional)</label><input className={inputCls} value={form.record_key} onChange={(e) => setForm({ ...form, record_key: e.target.value })} placeholder="email" /></div>
            <div className="md:col-span-2 flex items-center justify-between"><label className="flex items-center gap-2 text-[11px] text-text-muted"><input type="checkbox" checked={form.route} onChange={(e) => setForm({ ...form, route: e.target.checked })} /> let the ETL agent pick the best collection</label><button onClick={submit} disabled={submitting || !form.collection} className="px-4 py-2 rounded-lg bg-brand-blue text-white text-[12px] font-medium disabled:opacity-50">{submitting ? "Queuing…" : "Run ETL"}</button></div>
          </div>
        </div>
        <div className="bg-surface-raised rounded-xl border border-border p-4">
          <h2 className="text-[14px] font-semibold mb-3">Ask the knowledge base</h2>
          <div className="flex gap-2 mb-3"><input className={inputCls} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} placeholder="What is our LegitScript process?" /><button onClick={search} disabled={searching} className="px-3 py-2 rounded-lg bg-brand-blue/10 text-brand-blue">{searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}</button></div>
          {hits && (hits.length ? <div className="space-y-2 max-h-80 overflow-auto">{hits.map((h, i) => <div key={h.id} className="p-2 rounded-lg bg-surface text-[11px]"><p className="font-medium">[{i + 1}] {h.document_title}{h.heading ? ` › ${h.heading}` : ""} <span className="text-text-muted">· {h.kind} · {h.score.toFixed(3)}</span></p><p className="text-text-secondary mt-1 line-clamp-4">{h.content}</p></div>)}</div> : <p className="text-[12px] text-text-muted">No results in the collections you can read.</p>)}
          <p className="text-[10px] text-text-muted mt-3">Same retrieval the orchestrator uses through its <code>search_knowledge</code> tool.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div>
          <h2 className="text-[14px] font-semibold mb-3 text-text-secondary">ETL jobs</h2>
          <div className="space-y-2">{jobs.length ? jobs.map((j) => <div key={j.id} className="bg-surface-raised rounded-xl border border-border p-3 flex items-start gap-3">
            {j.status === "completed" ? <CheckCircle className="w-4 h-4 text-brand-green mt-0.5" /> : j.status === "failed" ? <XCircle className="w-4 h-4 text-red-500 mt-0.5" /> : j.status === "running" ? <Loader2 className="w-4 h-4 text-brand-blue animate-spin mt-0.5" /> : <Clock className="w-4 h-4 text-text-muted mt-0.5" />}
            <div className="min-w-0 flex-1"><p className="text-[12px] font-medium truncate">{(j.input?.title as string) || j.source_uri || (j.input?.text ? "pasted text" : "job")}</p><p className="text-[10px] text-text-muted">{j.collection_slug} · {j.profile}{j.stage ? ` · ${j.stage}` : ""} · {new Date(j.created_at).toLocaleString()}{j.status === "completed" && j.result && <> · {String(j.result.chunks ?? 0)} chunks{Number(j.result.records) > 0 && `, ${String(j.result.records)} records`}</>}</p>{j.error && <p className="text-[10px] text-red-600 mt-1 line-clamp-2">{j.error}</p>}</div>
          </div>) : <p className="text-[12px] text-text-muted">No jobs yet.</p>}</div>
        </div>
        <div>
          <h2 className="text-[14px] font-semibold mb-3 text-text-secondary">Documents</h2>
          <div className="space-y-2">{docs.map((d) => <div key={d.id} className="bg-surface-raised rounded-xl border border-border p-3"><p className="text-[12px] font-medium truncate">{d.title}</p><p className="text-[10px] text-text-muted">{d.collection_slug} · {d.status} · {d.chunk_count ?? 0} chunks · {d.mime_type || d.source_type} · {new Date(d.updated_at).toLocaleDateString()}</p></div>)}</div>
        </div>
      </div>
    </div>
  );
}

export default function DataPage() {
  return (
    <RequireRole min="admin">
      <DataPageInner />
    </RequireRole>
  );
}
