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
 */
import { getDb, getTask, event, moveTask, PRIORITIES } from './db.mjs';
import { clamp } from './env.mjs';
import { parseShotList } from './integrations.mjs';
import { pageTarget } from './searchconsole.mjs';

const SHIP_LANE = 'mpfresh:ship_dev';
const POSTED_LANE = 'mpfresh:posted';
const DEBOUNCE_MS = () => clamp(process.env.SHIP_DEBOUNCE_MS, 0, 3600000, 300000);
const CLAIM_TTL_MS = 2 * 3600000; // a claim with no result after this long (builder crashed) returns to the queue
const SITE = () => (process.env.SITE_ORIGIN || 'https://marketingpowered.ai').replace(/\/+$/, '');
// Pages per site build, highest priority first; the rest wait for the next build.
const BATCH_LIMIT = () => clamp(process.env.SHIP_BATCH_LIMIT, 1, 200, 30);
const rank = (p) => { const i = PRIORITIES.indexOf(p); return i < 0 ? PRIORITIES.length : i; };

// The live site's pages, read from its sitemap at most hourly (refreshSiteRoutes, from the cron). A plan page whose
// worked-out address already has a live page is held, so it never replaces that page without a person deciding.
const ROUTES_KEY = 'site_routes';
function siteRoutes() {
  try { return JSON.parse(getDb().prepare('SELECT value FROM settings WHERE key=?').get(ROUTES_KEY)?.value || 'null'); } catch { return null; }
}
export async function refreshSiteRoutes({ force = false } = {}) {
  const cached = siteRoutes();
  if (!force && cached && Date.now() - Date.parse(cached.at) < 3600000) return cached;
  const r = await fetch(`${SITE()}/sitemap.xml`, { signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`Sitemap: HTTP ${r.status}`);
  const routes = [...(await r.text()).matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1].replace(/^https?:\/\/[^/]+/i, '').replace(/\/+$/, '') || '/');
  const value = { at: new Date().toISOString(), routes: [...new Set(routes)] };
  const { runtime } = await import('./runtime.mjs');
  await runtime.commit(() => getDb().prepare('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)').run(ROUTES_KEY, JSON.stringify(value)));
  return value;
}
const parse = (s) => { try { return JSON.parse(s || '{}'); } catch { return {}; } };

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
  const target = pageTarget(task);
  if (!target.path) return 'No page URL. Add "URL: /path" to the notes.';
  // Only drafts that passed QA ship, unless a person approved one anyway.
  if (!task.approved_at && !['pass', 'review'].includes(task.qa_status)) {
    return task.qa_status === 'blocked' ? 'QA failed. Redo it, or approve it anyway.' : task.qa_status === 'stale' ? 'The draft changed after QA. Run QA again.' : 'No QA pass yet. Run QA first.';
  }
  if (target.derived && target.mode !== 'refresh') {
    const live = siteRoutes();
    if (!live) return 'Checking which pages already exist on the site (a few minutes).';
    if (live.routes.includes(target.path)) return `A live page already exists at ${target.path}. To replace it, add "Mode: refresh" to the notes; to publish elsewhere, add "URL: /other-path".`;
  }
  return '';
}
const summary = (t, st) => ({ id: t.id, title: t.title, path: pageTarget(t).path, mode: pageTarget(t).mode, derived: pageTarget(t).derived, priority: t.priority, approved: !!t.approved_at, qa_status: t.qa_status || '', ...st });

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
  const readyAt = newest ? new Date(newest + DEBOUNCE_MS()).toISOString() : null;
  // Highest priority first (P0 before P1 ... website pages before blog posts); one build takes at most BATCH_LIMIT.
  waiting.sort((a, b) => rank(a.priority) - rank(b.priority) || String(a.arrived_at).localeCompare(String(b.arrived_at)));
  const batch = waiting.slice(0, BATCH_LIMIT()).map((x) => x.id);
  return { ready: waiting.length > 0 && Date.now() >= newest + DEBOUNCE_MS(), ready_at: readyAt, debounce_minutes: Math.round(DEBOUNCE_MS() / 60000), batch_limit: BATCH_LIMIT(), batch, site: SITE(), items: waiting, held, building, recent };
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
    id: task.id, title: task.title, path: target.path, mode: target.mode, derived: !!target.derived, live_url: target.path ? `${SITE()}${target.path}` : '',
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
  for (const id of ids.slice(0, BATCH_LIMIT())) {
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
  const newest = rows.filter((x) => x.st.status === 'waiting').map((x) => Date.parse(x.st.arrived_at)).reduce((a, b) => Math.max(a, b), 0);
  const readyAt = newest ? new Date(newest + DEBOUNCE_MS()).toISOString() : undefined;
  return rows.map(({ t, st }) => ({ task_id: t.id, ...st, ...(st.status === 'waiting' ? { ready_at: readyAt, held: holdReason(t) || undefined } : {}) }));
}
