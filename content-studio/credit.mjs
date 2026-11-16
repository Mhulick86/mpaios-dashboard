/**
 * Credit cutoffs. When a provider says the account is out of credit, the work is paused rather than failed:
 *
 *   - a generation job stays queued, with run_after pushed to the next check and an error starting "Paused (<provider>): ";
 *   - an image run that stopped on the cutoff is remembered on the provider's watch entry;
 *   - the provider goes on the watch list (settings key "credit_watch").
 *
 * The cron (every 5 minutes, hosted) or the local worker calls creditWatchTick(). Every 6 hours per paused provider it
 * sends a request of a few tokens (providers.creditProbe). When the provider answers, every paused job is released at
 * once and every cut-off image run starts again. Paused jobs whose stage now uses another provider (someone switched the
 * model in Settings) are released straight away.
 */
import { getDb, getTask, event } from './db.mjs';
import { runtime } from './runtime.mjs';
import { clamp } from './env.mjs';
import { creditProbe, stageModel, CREDIT_ERROR } from './providers.mjs';

const KEY = 'credit_watch';
export const CHECK_MS = () => clamp(process.env.CREDIT_CHECK_MS, 1000, 86400000, 6 * 3600000); // 6 hours; shorter only in tests
const LABEL = { openai: 'OpenAI', anthropic: 'Anthropic', google: 'Google' };
const stamp = () => new Date().toISOString();
const providerOf = (stage) => String(stageModel(stage) || '').split(':')[0];
export const pausedPrefix = (provider) => `Paused (${provider}): `;

function read() {
  try { return JSON.parse(getDb().prepare('SELECT value FROM settings WHERE key=?').get(KEY)?.value || '{}'); } catch { return {}; }
}
function write(state) { getDb().prepare('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)').run(KEY, JSON.stringify(state)); }
const pausedJobs = (provider) => getDb().prepare("SELECT id,task_id,kind FROM jobs WHERE status='queued' AND error LIKE ?").all(`${pausedPrefix(provider)}%`);

/** For the board: which providers are paused, since when, the next check, and how much work is waiting. */
export function creditStatus() {
  return Object.entries(read().providers || {}).map(([provider, p]) => ({
    provider, label: LABEL[provider] || provider, since: p.since, next_check: p.next_check, last_check: p.last_check || null,
    jobs: pausedJobs(provider).length, images: (p.images || []).length
  }));
}

/** Put a provider on the watch list (call inside a commit). Returns the time of the next check. */
export function pauseProvider(provider, { model = '', imagesFor = '' } = {}) {
  const state = read(); state.providers ||= {};
  const p = state.providers[provider] ||= { since: stamp(), next_check: new Date(Date.now() + CHECK_MS()).toISOString(), model: '', images: [] };
  if (model) p.model = model;
  if (imagesFor && !p.images.includes(imagesFor)) p.images.push(imagesFor);
  write(state);
  return p.next_check;
}

/** A generation job hit a cutoff: keep it queued until the next check (call inside a commit). */
export function pauseJob(job, provider, model = '') {
  const next = pauseProvider(provider, { model });
  getDb().prepare("UPDATE jobs SET status='queued',started_at=NULL,run_after=?,error=? WHERE id=?")
    .run(next, `${pausedPrefix(provider)}${LABEL[provider] || provider} is out of credit. Checking every 6 hours; this resumes automatically.`, job.id);
  event(job.task_id, 'paused', `${job.kind} paused: ${LABEL[provider] || provider} is out of credit. MAIOS checks every 6 hours and resumes it automatically.`, 'MAIOS', { provider, jobId: job.id, next_check: next });
  return next;
}

let startImages = null; // set by integrations.mjs (avoids an import cycle)
export function onImageResume(fn) { startImages = fn; }

/**
 * Work stopped by a credit cutoff before this module existed: failed jobs whose error is a credit error, with no later
 * successful run of the same stage on that task, are adopted into the watch (once).
 */
function adoptEarlierCutoffs() {
  const db = getDb();
  // v2: OpenAI's "You have no credits remaining" wording was missed by the first pass.
  if (db.prepare("SELECT value FROM settings WHERE key='credit_watch_adopted_v2'").get()) return 0;
  const failed = db.prepare("SELECT * FROM jobs WHERE status='failed' AND error IS NOT NULL ORDER BY created_at DESC").all().filter((j) => CREDIT_ERROR.test(j.error));
  let n = 0; const seen = new Set();
  for (const j of failed) {
    const key = `${j.task_id}:${j.kind}`; if (seen.has(key)) continue; seen.add(key);
    const later = db.prepare("SELECT 1 FROM jobs WHERE task_id=? AND kind=? AND created_at>? AND status IN ('done','queued','running') LIMIT 1").get(j.task_id, j.kind, j.created_at);
    if (later || !getTask(j.task_id)) continue;
    const provider = /anthropic|credit balance is too low/i.test(j.error) ? 'anthropic' : 'openai';
    pauseJob(j, provider);
    n++;
  }
  // Image runs whose most recent run ended on a credit or quota error restart too.
  const runs = db.prepare("SELECT task_id, message FROM events WHERE event_type='images' AND id IN (SELECT id FROM events e2 WHERE e2.event_type='images' AND e2.task_id=events.task_id ORDER BY created_at DESC LIMIT 1)").all();
  for (const r of runs) {
    if (/Image generation failed: .*(quota|credit|billing)/i.test(r.message) && getTask(r.task_id) && !(read().providers?.openai?.images || []).includes(r.task_id)) { pauseProvider('openai', { imagesFor: r.task_id }); n++; }
  }
  db.prepare("INSERT OR REPLACE INTO settings (key,value) VALUES ('credit_watch_adopted_v2',?)").run(stamp());
  return n;
}

/** Called from the cron or worker loop. Probes due providers (network) and releases or reschedules their work. */
export async function creditWatchTick() {
  await runtime.commit(() => {
    adoptEarlierCutoffs();
    // A paused job whose stage now runs on a provider that is not paused (the model was changed) goes ahead now.
    const state = read(), paused = new Set(Object.keys(state.providers || {}));
    for (const provider of ['openai', 'anthropic', 'google']) {
      for (const j of pausedJobs(provider)) {
        const now = providerOf(j.kind);
        if (now !== provider && !paused.has(now)) getDb().prepare('UPDATE jobs SET run_after=?,error=NULL WHERE id=?').run(stamp(), j.id);
      }
    }
    // A provider with nothing left waiting (its jobs moved to another provider) needs no more checks.
    let changed = false;
    for (const [provider, p] of Object.entries(state.providers || {})) {
      if (!pausedJobs(provider).length && !(p.images || []).length) { delete state.providers[provider]; changed = true; }
    }
    if (changed) write(state);
  });
  const due = Object.entries(read().providers || {}).filter(([, p]) => Date.parse(p.next_check) <= Date.now());
  const results = [];
  for (const [provider, p] of due) {
    const probe = await creditProbe(provider, p.model).catch((e) => ({ ok: false, message: String(e?.message || e) }));
    const released = await runtime.commit(() => {
      const state = read(), entry = state.providers?.[provider]; if (!entry) return null;
      if (!probe.ok) {
        entry.last_check = stamp(); entry.last_result = String(probe.message || '').slice(0, 300);
        entry.next_check = new Date(Date.now() + CHECK_MS()).toISOString();
        getDb().prepare('UPDATE jobs SET run_after=? WHERE status=\'queued\' AND error LIKE ?').run(entry.next_check, `${pausedPrefix(provider)}%`);
        write(state);
        return null;
      }
      const jobs = pausedJobs(provider);
      getDb().prepare('UPDATE jobs SET run_after=?,error=NULL WHERE status=\'queued\' AND error LIKE ?').run(stamp(), `${pausedPrefix(provider)}%`);
      for (const taskId of new Set(jobs.map((j) => j.task_id))) event(taskId, 'resumed', `${LABEL[provider] || provider} has credit again: paused work resumed.`, 'MAIOS', { provider });
      const images = entry.images || [];
      for (const taskId of images) {
        try { if (getTask(taskId) && startImages) { startImages(taskId, 'MAIOS'); event(taskId, 'resumed', `${LABEL[provider] || provider} has credit again: image generation restarted.`, 'MAIOS', { provider }); } }
        catch (e) { event(taskId, 'warning', `Could not restart image generation: ${String(e?.message || e).slice(0, 200)}`, 'MAIOS'); }
      }
      delete state.providers[provider]; write(state);
      return { jobs: jobs.length, images: images.length };
    });
    results.push({ provider, ok: probe.ok, ...(released || {}) });
  }
  return results;
}
