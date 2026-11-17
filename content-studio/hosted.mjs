/**
 * Content Studio running inside MAIOS on Vercel: no local server, no local model.
 *
 * Vercel functions are short-lived and several can run at once, so the studio's SQLite database lives in private
 * Vercel Blob storage as one file. Every request runs inside commit(): fetch the latest file if it changed (a
 * conditional read that is nearly free when nothing changed), run the normal studio code on it, and if anything
 * was written upload the file with "only if nobody else wrote since I read it" (ifMatch). When another instance won
 * the race, reload and run the request again. Model calls happen outside commit(), so a generation that takes
 * minutes never holds the database; its result is saved in a short commit at the end (see runGeneration).
 *
 * Generations run in the background after a response (Next's after()) and from a Vercel Cron backstop. Live
 * output is written to a small blob every 1.5s while a model writes, and the board polls for it.
 *
 * Access: every address asks for the team passcode (the production *.vercel.app alias is public, so no host is
 * trusted). The first passcode comes from STUDIO_PASSCODE in the project environment; once someone changes it in
 * Settings the saved one applies. A signed, HttpOnly session cookie keeps a browser signed in for 90 days.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import { configureRuntime } from './runtime.mjs';
import { useDatabaseFile, getDb, changeCount, nextJob, getJob } from './db.mjs';
import { setKnowledgeSeed, resetKnowledge, initKnowledge } from './knowledge.mjs';
import { ensureIntegrationSchema } from './integrations.mjs';
import { handleApi, errorReply, json, parseJson, HttpError } from './core.mjs';
import { runOne, trackRunning } from './agents.mjs';
import { creditWatchTick, claimNext } from './credit.mjs';
import { passcodeHash, passcodeMatches, signSession, verifySession } from './secrets.mjs';
import { clamp } from './env.mjs';

const COOKIE = 'maios_studio';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stamp = () => new Date().toISOString();

/**
 * @param blob    { get, put, del } from @vercel/blob (injected so tests can use an in-memory store)
 * @param seed    knowledge/seed.json contents (bundled by the caller; this file cannot read files next to itself)
 * @param cookiePath  where the API is mounted, e.g. /api/studio
 */
export function createHostedStudio({ blob, seed, cookiePath = '/', prefix = 'studio', maxRunning = clamp(process.env.WORKER_CONCURRENCY, 1, 16, 8), minStartMs = 240000 }) {
  process.env.NO_DEMO_SEED ??= '1'; // a real workspace starts with an empty board
  if (seed) setKnowledgeSeed(seed);

  // ---------- Database snapshot ----------
  const DB_KEY = `${prefix}/content-studio.sqlite`;
  const dir = mkdtempSync(join(tmpdir(), 'maios-studio-'));
  let file = null, etag = null, generation = 0, persisted = 0, stale = true, checkedAt = 0;
  // Every Blob call counts against the plan's monthly operations. A copy confirmed current within SYNC_TTL_MS is used
  // as is (the board polls every few seconds); writes stay safe because an upload from a stale copy fails its ifMatch
  // and the commit then reloads and runs again.
  const SYNC_TTL_MS = clamp(process.env.STUDIO_SYNC_TTL_MS, 0, 60000, 5000);

  async function sync() {
    if (file && etag && !stale && Date.now() - checkedAt < SYNC_TTL_MS) return;
    const res = await blob.get(DB_KEY, { access: 'private', useCache: false, ...(etag && !stale ? { ifNoneMatch: etag } : {}) });
    checkedAt = Date.now();
    if (res?.statusCode === 304) return;
    if (!res && !etag && file && !stale) return; // still the first, not yet saved database
    const next = join(dir, `db-${++generation}.sqlite`);
    if (res) writeFileSync(next, Buffer.from(await new Response(res.stream).arrayBuffer()));
    useDatabaseFile(next); resetKnowledge();
    if (file) { rmSync(file, { force: true }); rmSync(file + '-journal', { force: true }); }
    file = next; etag = res ? res.blob.etag : null; stale = false;
    getDb(); initKnowledge(); ensureIntegrationSchema();
    // Opening re-applies idempotent setup (board colours, migrations), which SQLite counts as changes. Only a brand-new
    // database has to be uploaded for that alone.
    persisted = res ? changeCount() : -1;
  }
  async function persist() {
    const data = readFileSync(file);
    const opts = { access: 'private', contentType: 'application/vnd.sqlite3', addRandomSuffix: false, cacheControlMaxAge: 60 };
    const out = await blob.put(DB_KEY, data, etag ? { ...opts, allowOverwrite: true, ifMatch: etag } : { ...opts, allowOverwrite: false });
    etag = out.etag; persisted = changeCount();
  }

  // One commit at a time in this instance; other instances are handled by ifMatch.
  let chain = Promise.resolve();
  const lock = (fn) => { const run = chain.then(fn, fn); chain = run.catch(() => { }); return run; };
  const inCommit = new AsyncLocalStorage();
  const pending = new Set();
  function background(fn) {
    const p = inCommit.exit(() => Promise.resolve().then(fn)).catch((e) => console.error('Studio background task:', e));
    pending.add(p); p.finally(() => pending.delete(p));
    return p;
  }

  async function commit(fn) {
    if (inCommit.getStore()) return fn(); // nested: already inside a commit
    return lock(async () => {
      for (let attempt = 1; ; attempt++) {
        const ctx = { deferred: [] };
        await sync();
        let result, error, failed = false;
        try { result = await inCommit.run(ctx, fn); } catch (e) { error = e; failed = true; }
        const changed = changeCount() !== persisted;
        if (failed) { if (changed) stale = true; throw error; } // drop half-applied writes
        if (changed) {
          try { await persist(); }
          catch (e) {
            stale = true;
            if (attempt < 8) { await sleep(40 * attempt + Math.random() * 80); continue; } // someone else saved first: rerun on their data
            throw e;
          }
        }
        for (const task of ctx.deferred) background(task); // only the attempt that saved starts background work
        return result;
      }
    });
  }

  // ---------- Runtime hooks used by the shared studio code ----------
  const liveText = new Map(); // jobId -> latest preview text (this server only)
  const assetKey = (name) => `${prefix}/assets/${basename(name)}`;
  const readText = async (res) => (res?.stream ? new Response(res.stream).text() : undefined);
  configureRuntime({
    hosted: true,
    maxRunning,
    commit,
    defer(fn) { const ctx = inCommit.getStore(); if (ctx) ctx.deferred.push(fn); else background(fn); },
    // The live preview of a running generation stays in this server's memory. Keeping it in Blob cost an upload every
    // 1.5 seconds per running job, which used up the Blob plan's monthly operations in minutes. A board request that
    // reaches another server sees no preview text and shows the job as writing.
    live: {
      async set(jobId, text) { liveText.set(jobId, text || ''); },
      async get(jobId) { return liveText.get(jobId); },
      async remove(jobId) { liveText.delete(jobId); }
    },
    assets: {
      async write(name, buf) { await blob.put(assetKey(name), buf, { access: 'private', addRandomSuffix: false, allowOverwrite: false }); },
      async read(name) { const res = await blob.get(assetKey(name), { access: 'private' }); return res?.stream ? Buffer.from(await new Response(res.stream).arrayBuffer()) : null; }
    }
  });

  // ---------- Access ----------
  const setting = (key) => getDb().prepare('SELECT value FROM settings WHERE key=?').get(key)?.value || '';
  const initial = () => (process.env.STUDIO_PASSCODE || '').trim();
  const storedPasscode = () => setting('auth:passcode') || (initial().length >= 8 ? passcodeHash(initial()) : '');
  const cookie = (value, maxAge) => `${COOKIE}=${value}; Path=${cookiePath}; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
  // The site builder authenticates with STUDIO_BUILD_TOKEN and may only use the ship queue and download images.
  const buildToken = () => (process.env.STUDIO_BUILD_TOKEN || '').trim();
  const isBuilder = (req) => {
    const token = buildToken(); const sent = (req.header('authorization') || '').replace(/^Bearer\s+/i, '').trim();
    if (token.length < 24 || sent.length !== token.length) return false;
    let diff = 0; for (let i = 0; i < token.length; i++) diff |= token.charCodeAt(i) ^ sent.charCodeAt(i);
    return diff === 0 && (/^\/api\/ship(\/|$)/.test(req.path) || (req.method === 'GET' && /^\/api\/assets\/[a-f0-9-]{36}$/.test(req.path)));
  };
  // The local team worker authenticates with STUDIO_WORKER_TOKEN and may only use /api/worker.
  const isWorker = (req) => {
    const token = (process.env.STUDIO_WORKER_TOKEN || '').trim(); const sent = (req.header('authorization') || '').replace(/^Bearer\s+/i, '').trim();
    if (token.length < 24 || sent.length !== token.length) return false;
    let diff = 0; for (let i = 0; i < token.length; i++) diff |= token.charCodeAt(i) ^ sent.charCodeAt(i);
    return diff === 0 && /^\/api\/worker\//.test(req.path);
  };
  function access(req) {
    if (isBuilder(req)) return { ok: true, hosted: true, builder: true, passcodeSet: true, signedIn: false };
    if (isWorker(req)) return { ok: true, hosted: true, worker: true, passcodeSet: true, signedIn: false };
    const stored = storedPasscode();
    const signedIn = verifySession(req.cookie, stored);
    return { ok: signedIn, hosted: true, passcodeSet: !!stored, signedIn };
  }
  let failures = 0;
  async function sessionRoute(req) {
    if (req.method === 'GET') return json(200, access(req));
    if (req.method === 'DELETE') return json(200, { ok: true }, { 'Set-Cookie': cookie('', 0) });
    const body = await parseJson(req, 4096);
    const stored = storedPasscode();
    if (req.method === 'POST' && req.path === '/api/session') {
      if (!stored) throw new HttpError(503, 'No studio passcode is configured. Set STUDIO_PASSCODE in the Vercel project environment.');
      if (!passcodeMatches(String(body.passcode || ''), stored)) { failures++; await sleep(Math.min(5000, 400 * failures)); throw new HttpError(401, 'That passcode is not right.'); }
      failures = 0;
      return json(200, { ...access(req), signedIn: true, ok: true }, { 'Set-Cookie': cookie(signSession(stored), 90 * 86400) });
    }
    if (req.method === 'POST' && req.path === '/api/session/passcode') {
      const now = access(req);
      if (!now.signedIn) throw new HttpError(403, 'Sign in with the current passcode first.');
      const passcode = String(body.passcode || '');
      if (passcode.length < 8 || passcode.length > 200) throw new HttpError(400, 'Use at least 8 characters.');
      const hash = passcodeHash(passcode);
      getDb().prepare('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)').run('auth:passcode', hash);
      return json(200, { ...now, passcodeSet: true, signedIn: true, ok: true }, { 'Set-Cookie': cookie(signSession(hash), 90 * 86400) });
    }
    throw new HttpError(404, 'Endpoint not found.');
  }

  /**
   * One API request. req: { method, path, query, header(name), body(max), host, cookie }.
   * Returns { status, json } or { status, body, headers }.
   */
  async function handle(req) {
    try {
      return await commit(async () => {
        if (req.path === '/api/session' || req.path === '/api/session/passcode') return sessionRoute(req);
        const a = access(req);
        if (!a.ok) return json(401, { error: a.passcodeSet ? 'Enter the studio passcode to continue.' : 'No studio passcode is configured. Set STUDIO_PASSCODE in the Vercel project environment.', auth: a });
        if (req.path === '/api/events') return json(404, { error: 'Live events are not available on the hosted studio; the board polls instead.' });
        return handleApi(req);
      });
    } catch (e) { return errorReply(e); }
  }

  // ---------- Background generation ----------
  const ready = () => { try { return !!getDb().prepare("SELECT 1 FROM jobs WHERE status='queued' AND run_after<=? LIMIT 1").get(stamp()); } catch { return false; } };
  const nextDue = () => { try { return getDb().prepare("SELECT min(run_after) t FROM jobs WHERE status='queued'").get()?.t || null; } catch { return null; } };
  // Up to maxRunning generations at once overall, and no more than each provider's own limit (Grok 8, others 4).
  const claim = () => commit(() => claimNext(maxRunning));

  async function runJob(job, deadline) {
    const ctl = new AbortController();
    const untrack = trackRunning(job.id, ctl);
    // Stop before the function is killed, so the job is retried instead of left "running".
    const stop = setTimeout(() => ctl.abort(Object.assign(new Error('The generation ran past the hosting time limit; it will be retried.'), { transient: true })), Math.max(1000, deadline - Date.now() - 10000));
    // A cancel from the board lands in the database, possibly through another instance. Check for it every few seconds.
    const watch = setInterval(() => {
      commit(() => getJob(job.id)?.status).then((status) => { if (status && status !== 'running') ctl.abort(Object.assign(new Error('Cancelled by operator.'), { cancelled: true })); }).catch(() => { });
    }, 5000);
    try { await runOne(job, ctl); } finally { clearTimeout(stop); clearInterval(watch); untrack(); }
  }

  let draining = null;
  /** Run queued generations until none are left or time runs out. One drain per instance at a time. */
  function drain(deadline) {
    if (!draining) draining = (async () => {
      const active = new Set();
      for (;;) {
        while (active.size < maxRunning && deadline - Date.now() > minStartMs) {
          let job; try { job = await claim(); } catch (e) { console.error('Studio claim:', e); break; }
          if (!job) break;
          const p = runJob(job, deadline).catch((e) => console.error('Studio job:', e)).finally(() => active.delete(p));
          active.add(p);
        }
        if (active.size) { await Promise.race(active); continue; }
        // Nothing to start. Wait for a retry that is due soon, if there is time; otherwise the next request or the cron takes it.
        const due = nextDue(); const wait = due ? Date.parse(due) - Date.now() : Infinity;
        if (wait > 90000 || deadline - Date.now() - Math.max(0, wait) < minStartMs) break;
        await sleep(Math.max(250, wait + 250));
        try { await commit(() => null); } catch { break; } // refresh
      }
    })().finally(() => { draining = null; });
    return draining;
  }

  /** Call after every response (Next after()) and from the cron: start queued work and wait for background tasks. */
  async function background_({ deadline }) {
    if (ready() || nextDue()) drain(deadline);
    for (;;) {
      const work = [...pending]; if (draining) work.push(draining);
      if (!work.length) return;
      await Promise.allSettled(work);
    }
  }
  /** Cron backstop: pick up the latest database first, then work. */
  async function tick({ deadline }) {
    await commit(() => null);
    // Credit cutoffs: every 6 hours per paused provider, a few-token probe; when it answers, paused work is released.
    try { await creditWatchTick(); } catch (e) { console.error('Credit watch:', e); }
    await background_({ deadline });
    return { ok: true, at: stamp() };
  }

  return { handle, background: background_, tick, commit, drain };
}
