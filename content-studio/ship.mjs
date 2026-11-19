/**
 * Ship to dev: hand finished pages to the site builder (a Claude Code session working in the Marketing-Powered/mp-site
 * repository), in batches.
 *
 *   1. A card moved to MP FRESH > Ship to dev waits in the ship queue.
 *   2. The batch is ready once no card has arrived for SHIP_DEBOUNCE_MS (5 minutes), so pages moved together ship
 *      together.
 *   3. The builder claims the batch (POST /api/ship/claim), downloads each package (GET /api/ship/:id: final draft,
 *      metadata, images), builds the pages, merges and pushes, then reports each page done or failed.
 *
 * Everything is recorded as task events, so every server instance and the board see the same state. A failed page
 * stays failed until someone moves the card out of Ship to dev and back, so a broken page is not retried forever.
 *
 * Starting the builder: the builder only looks at the queue when something wakes it. shipWake() does that once per
 * ready batch by calling the builder's scheduled-task fire URL (SITE_BUILDER_FIRE_URL with SITE_BUILDER_FIRE_TOKEN).
 * The hosted cron and the local server call it every few minutes. "Build now" on the board (shipBuildNow) makes the
 * waiting cards ready without the quiet period and wakes the builder straight away.
 */
import { getDb, getTask, event, moveTask } from './db.mjs';
import { clamp } from './env.mjs';
import { parseShotList } from './integrations.mjs';
import { pageTarget } from './searchconsole.mjs';
import { runtime } from './runtime.mjs';

const SHIP_LANE = 'mpfresh:ship_dev';
const POSTED_LANE = 'mpfresh:posted';
const DEBOUNCE_MS = () => clamp(process.env.SHIP_DEBOUNCE_MS, 0, 3600000, 300000);
const CLAIM_TTL_MS = 2 * 3600000; // a claim with no result after this long (builder crashed) returns to the queue
const SITE = () => (process.env.SITE_ORIGIN || 'https://marketingpowered.ai').replace(/\/+$/, '');
const parse = (s) => { try { return JSON.parse(s || '{}'); } catch { return {}; } };
const setting = (key) => getDb().prepare('SELECT value FROM settings WHERE key=?').get(key)?.value || '';
const saveSetting = (key, value) => getDb().prepare('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)').run(key, String(value));
const BUILD_NOW_KEY = 'ship:build_now'; // when someone last pressed Build now
const WAKE_KEY = 'ship:wake';           // the last time the builder was woken, and for which batch
/** When the waiting batch becomes ready: the quiet period after its newest arrival, or at once if Build now was pressed since. */
function batchTiming(newest) {
  if (!newest) return { readyAt: null, ready: false, forced: false };
  const pressed = Date.parse(setting(BUILD_NOW_KEY)) || 0;
  const forced = pressed >= newest;
  const at = forced ? pressed : newest + DEBOUNCE_MS();
  return { readyAt: new Date(at).toISOString(), ready: Date.now() >= at, forced };
}

function shipEvents(taskId) {
  return getDb().prepare("SELECT event_type,message,details,created_at,actor FROM events WHERE task_id=? AND event_type IN ('moved','ship_started','shipped','ship_failed') ORDER BY created_at DESC LIMIT 60")
    .all(taskId).map((e) => ({ ...e, details: parse(e.details) }));
}
/** Where a task in Ship to dev stands: waiting, building, shipped or failed (since it last arrived in the lane). */
export function shipState(task) {
  if (!task || task.lane_id !== SHIP_LANE) return null;
  const events = shipEvents(task.id);
  const arrived = events.find((e) => e.event_type === 'moved' && e.details.to === SHIP_LANE);
  const arrivedAt = arrived?.created_at || task.updated_at;
  const latest = events.find((e) => e.event_type !== 'moved' && e.created_at >= arrivedAt);
  if (latest?.event_type === 'shipped') return { status: 'shipped', arrived_at: arrivedAt, at: latest.created_at, url: latest.details.url || '', commit: latest.details.commit || '' };
  if (latest?.event_type === 'ship_failed') return { status: 'failed', arrived_at: arrivedAt, at: latest.created_at, error: latest.message.replace(/^Site build failed: /, '') };
  if (latest?.event_type === 'ship_started' && Date.now() - Date.parse(latest.created_at) < CLAIM_TTL_MS) return { status: 'building', arrived_at: arrivedAt, at: latest.created_at, batch: latest.details.batch || '' };
  return { status: 'waiting', arrived_at: arrivedAt };
}
function holdReason(task) {
  if (!task.artifacts.some((a) => a.kind === 'draft')) return 'No draft to build.';
  if (!pageTarget(task).path) return 'No page URL. Add "URL: /path" to the notes.';
  return '';
}
const summary = (t, st) => ({ id: t.id, title: t.title, path: pageTarget(t).path, mode: pageTarget(t).mode, priority: t.priority, approved: !!t.approved_at, qa_status: t.qa_status || '', ...st });

/** The queue the builder polls. ready=true once the newest arrival is SHIP_DEBOUNCE_MS old. */
export function shipQueue() {
  const tasks = getDb().prepare('SELECT id FROM tasks WHERE lane_id=? AND archived=0').all(SHIP_LANE).map((r) => getTask(r.id));
  const waiting = [], held = [], building = [], recent = [];
  for (const t of tasks) {
    const st = shipState(t); if (!st) continue;
    if (st.status === 'waiting') { const why = holdReason(t); (why ? held : waiting).push({ ...summary(t, st), ...(why ? { held: why } : {}) }); }
    else if (st.status === 'building') building.push(summary(t, st));
    else recent.push(summary(t, st));
  }
  const newest = waiting.map((x) => Date.parse(x.arrived_at)).reduce((a, b) => Math.max(a, b), 0);
  const timing = batchTiming(newest);
  return { ready: timing.ready, ready_at: timing.readyAt, ...(timing.forced ? { build_now: true } : {}), debounce_minutes: Math.round(DEBOUNCE_MS() / 60000), site: SITE(), items: waiting, held, building, recent };
}

/** Everything the builder needs for one page. Image files are fetched from /api/assets/:id with the same token. */
export function shipPackage(id) {
  const task = getTask(id); if (!task) throw new Error('Task not found.');
  const target = pageTarget(task);
  const latest = (kind) => task.artifacts.filter((a) => a.kind === kind).sort((a, b) => b.version - a.version)[0] || null;
  const draft = latest('draft'), qa = latest('qa'), brief = latest('brief'), plan = latest('graphics');
  // Images from the most recent image run (a regenerated set replaces the older one), then any uploaded images.
  const runStart = getDb().prepare("SELECT created_at FROM events WHERE task_id=? AND event_type='images' AND message LIKE 'Generating %' ORDER BY created_at DESC LIMIT 1").get(id)?.created_at || '';
  const shots = parseShotList(plan?.body || '') || [];
  const altFor = (name) => {
    const section = name.replace(/^AI image \d+ · /, '').replace(/^(Hero photo|Photo · |Infographic · |Diagram · )/, (m) => (m === 'Hero photo' ? 'Hero' : ''));
    return shots.find((s) => s.section.toLowerCase() === section.toLowerCase())?.alt || '';
  };
  const images = task.assets.filter((a) => a.mime.startsWith('image/') && (!a.name.startsWith('AI image') || a.created_at >= runStart))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((a) => ({ id: a.id, name: a.name, mime: a.mime, size: a.size, source: a.name.startsWith('AI image') ? 'generated' : 'uploaded', alt: altFor(a.name), download: `/api/assets/${a.id}` }));
  return {
    id: task.id, title: task.title, path: target.path, mode: target.mode, live_url: target.path ? `${SITE()}${target.path}` : '',
    priority: task.priority, primary_keyword: task.primary_keyword, secondary_keywords: task.secondary_keywords, audience: task.audience,
    cta: task.cta, content_type: task.content_type, approved: !!task.approved_at, qa_status: task.qa_status || '',
    ship: shipState(task), held: holdReason(task) || null,
    draft: draft ? { version: draft.version, created_at: draft.created_at, markdown: draft.body } : null,
    qa: qa ? { version: qa.version, verdict: (qa.body.match(/Verdict:\s*(PASS|REVIEW|FAIL)/i)?.[1] || '').toUpperCase(), report: qa.body.slice(0, 6000) } : null,
    brief_excerpt: brief ? brief.body.slice(0, 4000) : '',
    notes: task.instructions || '',
    images
  };
}

/** The builder takes the ready tasks it will build now. Only waiting, unheld tasks can be claimed. */
export function shipClaim(ids, batch, actor = 'MP site builder') {
  if (!Array.isArray(ids) || !ids.length) throw new Error('Nothing to claim.');
  const claimed = [], skipped = [];
  for (const id of ids.slice(0, 50)) {
    const task = getTask(String(id)); const st = shipState(task);
    if (!task || st?.status !== 'waiting' || holdReason(task)) { skipped.push({ id, reason: !task ? 'not found' : holdReason(task) || `status ${st?.status || 'not in Ship to dev'}` }); continue; }
    event(task.id, 'ship_started', 'Site build started', actor, { batch: String(batch || '').slice(0, 80) });
    claimed.push(task.id);
  }
  return { claimed, skipped };
}
/**
 * A page is live: record it, put the live link on the first line of the card's notes, and move the card to Posted.
 * The site build is the publish step, so the live URL is recorded whether or not the card was approved in the studio.
 */
export function shipDone(id, { commit = '', url = '', notes = '' } = {}, actor = 'MP site builder') {
  const task = getTask(id); if (!task) throw new Error('Task not found.');
  const live = String(url || '') || (pageTarget(task).path ? `${SITE()}${pageTarget(task).path}` : '');
  event(id, 'shipped', `Built on the site${commit ? ` (${String(commit).slice(0, 12)})` : ''}`, actor, { commit: String(commit).slice(0, 64), url: live, notes: String(notes).slice(0, 2000) });
  if (/^https?:\/\/\S+$/.test(live)) {
    const rest = String(task.instructions || '').replace(/^Live page: \S+\n*/, '');
    const now = new Date().toISOString();
    getDb().prepare('UPDATE tasks SET published_at=?,published_url=?,instructions=?,updated_at=?,rev=rev+1 WHERE id=?').run(now, live.slice(0, 2000), `Live page: ${live}\n\n${rest}`.slice(0, 15000), now, id);
    event(id, 'published', `Live page: ${live}`, actor, { url: live, approved: !!task.approved_at });
  }
  if (task.board_id === 'mpfresh') moveTask(id, POSTED_LANE, actor, false);
  return { status: 'shipped', url: live, lane: getTask(id).lane_id };
}
export function shipFailed(id, reason = '', actor = 'MP site builder') {
  const task = getTask(id); if (!task) throw new Error('Task not found.');
  event(id, 'ship_failed', `Site build failed: ${String(reason || 'no reason given').slice(0, 1500)}`, actor);
  return shipState(getTask(id));
}
/** One line per Ship to dev card for the board. */
export function shipSummaries() {
  const rows = getDb().prepare('SELECT id FROM tasks WHERE lane_id=? AND archived=0').all(SHIP_LANE).map((r) => { const t = getTask(r.id); return { t, st: shipState(t) }; }).filter((x) => x.st);
  // The whole batch waits for the newest arrival, so every waiting card shows the same start time.
  // Held cards are never built, so they do not hold the batch back either (the same rule as shipQueue).
  const held = new Map(rows.filter((x) => x.st.status === 'waiting').map((x) => [x.t.id, holdReason(x.t)]));
  const newest = rows.filter((x) => x.st.status === 'waiting' && !held.get(x.t.id)).map((x) => Date.parse(x.st.arrived_at)).reduce((a, b) => Math.max(a, b), 0);
  const readyAt = batchTiming(newest).readyAt || undefined;
  return rows.map(({ t, st }) => ({ task_id: t.id, ...st, ...(st.status === 'waiting' ? { ready_at: readyAt, held: held.get(t.id) || undefined } : {}) }));
}

// ---------- Starting the builder ----------
const wakeTarget = () => ({ url: (process.env.SITE_BUILDER_FIRE_URL || '').trim(), token: (process.env.SITE_BUILDER_FIRE_TOKEN || '').trim() });
/** Can the studio start the builder itself? Without this the builder finds a ready batch at its own next check. */
export const wakeConfigured = () => { const { url, token } = wakeTarget(); return /^https?:\/\/\S+$/.test(url) && token.length >= 16; };
// A batch the builder did not take is announced again after this long (the first call may have been lost).
const REWAKE_MS = () => clamp(process.env.SITE_BUILDER_REWAKE_MS, 1000, 86400000, 1800000);

/** For the board: whether the studio can start the builder, and how the last attempt went. */
export function shipBuilderStatus() {
  const last = parse(setting(WAKE_KEY));
  return { auto_start: wakeConfigured(), last_started_at: last.ok ? last.at : null, last_error: last.error || '' };
}

/**
 * Wake the builder if a batch is ready and it has not been told about this batch yet. Safe to call often and from
 * several servers: the decision is saved in the same commit that makes it, so only one of them makes the call.
 * Nothing is sent while the builder is already building; the cards that arrived meanwhile go out when it finishes.
 */
export async function shipWake() {
  if (!wakeConfigured()) return { woke: false, reason: 'not configured' };
  const plan = await runtime.commit(() => {
    const q = shipQueue();
    if (!q.ready || !q.items.length) return { skip: q.items.length ? 'waiting for the quiet period' : 'nothing waiting', ready_at: q.ready_at };
    if (q.building.length) return { skip: 'a build is running' };
    const key = `${q.ready_at}|${q.items.length}`, last = parse(setting(WAKE_KEY));
    if (last.key === key && Date.now() - Date.parse(last.at) < REWAKE_MS()) return { skip: 'already started for this batch' };
    saveSetting(WAKE_KEY, JSON.stringify({ key, at: new Date().toISOString(), pages: q.items.length, ok: true }));
    return { key, pages: q.items.length };
  });
  if (plan.skip) return { woke: false, reason: plan.skip, ready_at: plan.ready_at || null };
  const { url, token } = wakeTarget();
  try {
    const res = await fetch(url, {
      method: 'POST', signal: AbortSignal.timeout(20000),
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01', 'anthropic-beta': process.env.SITE_BUILDER_FIRE_BETA || 'experimental-cc-routine-2026-04-01' },
      body: JSON.stringify({ text: `Content Studio: ${plan.pages} page${plan.pages === 1 ? '' : 's'} ready in Ship to dev.` })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    return { woke: true, pages: plan.pages };
  } catch (e) {
    // Forget the batch so the next check tries again, and keep the reason for the board.
    const error = String(e?.message || e).slice(0, 300);
    console.error('Site builder could not be started:', error);
    await runtime.commit(() => saveSetting(WAKE_KEY, JSON.stringify({ key: '', at: new Date().toISOString(), pages: plan.pages, ok: false, error })));
    return { woke: false, reason: error };
  }
}

/** "Build now" on the Ship to dev column: skip the quiet period for the cards waiting now and start the builder. */
export function shipBuildNow() {
  const q = shipQueue();
  if (!q.items.length) throw new Error(q.building.length ? 'These pages are already being built.' : q.held.length ? 'Every waiting card is held. Fix the reason shown on each card first.' : 'Nothing in Ship to dev is waiting to be built.');
  saveSetting(BUILD_NOW_KEY, new Date().toISOString());
  if (!q.building.length) runtime.defer(() => shipWake());
  // starts: now (builder is being started), after_current (a build is running; these go next), next_check (the studio
  // cannot start the builder itself, so it finds them at its own next check).
  return { pages: q.items.length, held: q.held.length, starts: !wakeConfigured() ? 'next_check' : q.building.length ? 'after_current' : 'now' };
}
