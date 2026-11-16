import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DATA_DIR, VERSION } from './env.mjs';
import { runtime } from './runtime.mjs';
import { dirname } from 'node:path';
import { publish } from './events.mjs';
import { hasBlockingFinding } from './qa-checks.mjs';

const stamp = () => new Date().toISOString();
let database;
let databasePath = null; // set by useDatabaseFile (hosted runtime); default is DATA_DIR/content-studio.sqlite
/** Point the studio at a different database file. Closes the current connection; the next getDb() opens the new file. */
export function useDatabaseFile(path) { if (database) { try { database.close(); } catch { /* already closed */ } } database = undefined; databasePath = path; }
export const changeCount = () => (database ? database.prepare('SELECT total_changes() AS n').get().n : 0);
const json = (v) => JSON.stringify(v ?? null);
const fromJson = (v, fallback) => { try { return v ? JSON.parse(v) : fallback; } catch { return fallback; } };

export const STAGES = ['brief', 'draft', 'graphics', 'qa'];
const CHANNELS = ['website', 'linkedin', 'facebook', 'instagram', 'gbp', 'x'];
// MP FRESH taxonomy: P0-P6 for site pages, BP0-BP3 for blog posts and guides.
export const PRIORITIES = ['P0', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'BP0', 'BP1', 'BP2', 'BP3'];
const WEBSITE_TYPES = ['article', 'guide', 'landing'];
const str = (v, max) => String(v ?? '').slice(0, max);
const strList = (v, maxItems, maxLen) => (Array.isArray(v) ? v : []).map((x) => str(x, maxLen).trim()).filter(Boolean).slice(0, maxItems);
const dateOrNull = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : null);

const BOARDS = [
  { id: 'mpfresh', name: 'MP FRESH', subtitle: 'Website content production', color: '#2cace8', stages: [
    ['backlog', 'Backlog', ''],
    ['ready_brief', 'Ready for Brief', 'brief'],
    ['brief_complete', 'Brief Complete', ''],
    ['ready_writing', 'Ready for Writing', 'draft'],
    ['draft_complete', 'Draft Complete', ''],
    ['graphics', 'Graphics', 'graphics'],
    ['final_approval', 'Final Approval', 'qa'],
    ['ship_dev', 'Ship to dev', ''],
    ['posted', 'Posted', '']
  ] },
  { id: 'social', name: 'Social Media', subtitle: 'Social content production', color: '#08ae67', stages: [
    ['post_plan', 'Post Plan', ''],
    ['plan_review', 'Plan Review', 'brief'],
    ['content_drafting', 'Content Drafting', 'draft'],
    ['content_review', 'Content Review', ''],
    ['graphics', 'Graphics', 'graphics'],
    ['graphic_review', 'Graphic Review', 'qa'],
    ['final_approval', 'Final Approval', ''],
    ['ready_post', 'Ready to Post', '']
  ] }
];
/** Where a card should sit once each autopilot stage has finished. The last lane is always a human gate. */
export const PIPELINE_LANES = {
  mpfresh: { brief: 'mpfresh:brief_complete', draft: 'mpfresh:draft_complete', graphics: 'mpfresh:graphics', qa: 'mpfresh:final_approval' },
  social: { brief: 'social:plan_review', draft: 'social:content_review', graphics: 'social:graphic_review', qa: 'social:final_approval' }
};

const SCHEMA = `
PRAGMA foreign_keys=ON;
PRAGMA busy_timeout=4000;
CREATE TABLE IF NOT EXISTS boards (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, subtitle TEXT, color TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS lanes (
  id TEXT PRIMARY KEY, board_id TEXT NOT NULL REFERENCES boards(id), slug TEXT NOT NULL,
  name TEXT NOT NULL, sort_order INTEGER NOT NULL, auto_action TEXT DEFAULT '',
  UNIQUE(board_id, slug)
);
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY, board_id TEXT NOT NULL REFERENCES boards(id),
  lane_id TEXT NOT NULL REFERENCES lanes(id), campaign_id TEXT,
  title TEXT NOT NULL, content_type TEXT NOT NULL DEFAULT 'article', channel TEXT NOT NULL DEFAULT 'website',
  brand TEXT NOT NULL DEFAULT 'Marketing Powered', priority TEXT NOT NULL DEFAULT 'P2',
  owner TEXT NOT NULL DEFAULT 'Unassigned', reviewer TEXT NOT NULL DEFAULT 'Mike',
  topic TEXT NOT NULL DEFAULT '', objective TEXT NOT NULL DEFAULT '', audience TEXT NOT NULL DEFAULT '',
  primary_keyword TEXT NOT NULL DEFAULT '', secondary_keywords TEXT NOT NULL DEFAULT '',
  source_urls TEXT NOT NULL DEFAULT '', due_date TEXT,
  word_count INTEGER NOT NULL DEFAULT 900, graphics_count INTEGER NOT NULL DEFAULT 3,
  voice TEXT NOT NULL DEFAULT 'company', cta TEXT NOT NULL DEFAULT '',
  instructions TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  approved_at TEXT, published_at TEXT, published_url TEXT, rev INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0, demo INTEGER NOT NULL DEFAULT 0, archived INTEGER NOT NULL DEFAULT 0,
  asana_gid TEXT UNIQUE
);
CREATE INDEX IF NOT EXISTS task_by_board_lane ON tasks(board_id, lane_id, sort_order);
CREATE INDEX IF NOT EXISTS task_by_campaign ON tasks(campaign_id);
CREATE TABLE IF NOT EXISTS artifacts (
  id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  kind TEXT NOT NULL, version INTEGER NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT '', job_id TEXT, created_at TEXT NOT NULL, approved INTEGER NOT NULL DEFAULT 0,
  UNIQUE(task_id,kind,version)
);
CREATE INDEX IF NOT EXISTS artifacts_by_task ON artifacts(task_id,kind,version DESC);
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, message TEXT NOT NULL, actor TEXT NOT NULL DEFAULT 'System',
  details TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS events_by_task ON events(task_id,created_at DESC);
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  kind TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'queued',
  attempts INTEGER NOT NULL DEFAULT 0, error TEXT, model TEXT, run_after TEXT NOT NULL,
  created_at TEXT NOT NULL, started_at TEXT, finished_at TEXT
);
CREATE INDEX IF NOT EXISTS jobs_by_status ON jobs(status,run_after);
CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  name TEXT NOT NULL, mime TEXT NOT NULL, path TEXT NOT NULL, size INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS brand_profiles (name TEXT PRIMARY KEY, rules TEXT NOT NULL, updated_at TEXT NOT NULL);
`;
/** Additive, idempotent migrations so a v0.2 database opens in v0.3 without a reset. */
function migrate(db) {
  const has = (table, col) => db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === col);
  if (!has('jobs', 'options')) db.exec("ALTER TABLE jobs ADD COLUMN options TEXT NOT NULL DEFAULT '{}'");
  if (!has('tasks', 'qa_status')) db.exec('ALTER TABLE tasks ADD COLUMN qa_status TEXT');
  db.exec('CREATE INDEX IF NOT EXISTS jobs_by_task ON jobs(task_id,created_at DESC)');
  db.exec('CREATE INDEX IF NOT EXISTS comments_by_task ON comments(task_id,created_at)');
}

function taskRow(row) {
  if (!row) return null;
  return {
    ...row, secondary_keywords: fromJson(row.secondary_keywords, []),
    source_urls: fromJson(row.source_urls, []), demo: !!row.demo,
    archived: !!row.archived
  };
}
const jobRow = (row) => (row ? { ...row, options: fromJson(row.options, {}) } : null);

export function getDb() {
  if (!database) {
    const file = databasePath || resolve(DATA_DIR, 'content-studio.sqlite');
    mkdirSync(dirname(file), { recursive: true });
    database = new DatabaseSync(file);
    // The hosted runtime uploads the whole file after each write, so it keeps everything in the main file (no WAL).
    database.exec(runtime.hosted ? 'PRAGMA journal_mode=DELETE;' : 'PRAGMA journal_mode=WAL;');
    database.exec(SCHEMA);
    migrate(database);
    for (const board of BOARDS) {
      database.prepare('INSERT OR IGNORE INTO boards (id,name,subtitle,color) VALUES (?,?,?,?)')
        .run(board.id, board.name, board.subtitle, board.color);
      database.prepare('UPDATE boards SET color=? WHERE id=?').run(board.color, board.id);
      for (let i = 0; i < board.stages.length; i++) {
        const [slug, name, auto] = board.stages[i];
        database.prepare('INSERT OR IGNORE INTO lanes (id,board_id,slug,name,sort_order,auto_action) VALUES (?,?,?,?,?,?)')
          .run(`${board.id}:${slug}`, board.id, slug, name, i, auto);
      }
    }
    ensureBrandProfiles(database);
    const row = database.prepare('SELECT value FROM settings WHERE key=?').get('seeded');
    if (!row && process.env.NO_DEMO_SEED !== '1') seedData(database);
    database.prepare('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)').run('seeded', 'yes');
    // Recover jobs interrupted by a process ending. Hosted, other instances may be mid-generation, so only jobs
    // that have been "running" far longer than any generation can take are put back in the queue.
    if (runtime.hosted) database.prepare("UPDATE jobs SET status='queued',started_at=NULL,run_after=? WHERE status='running' AND started_at < ?").run(stamp(), new Date(Date.now() - 20 * 60000).toISOString());
    else database.prepare("UPDATE jobs SET status='queued',started_at=NULL,run_after=? WHERE status='running'").run(stamp());
  }
  return database;
}
const DEFAULT_PROFILES = {
  company: `Marketing Powered is an operator-led, AI-native marketing firm focused on accountable business outcomes. Lead with the experience and the commercial problem, not with the AI label. Emphasize paid media, qualified demand, first-party data, attribution, conversion systems, multi-location marketing, owned compute and data sovereignty. Expand beyond treatment and behavioral health to hospitals, healthcare organizations, professional services and other regulated markets. Use direct, compact prose and defensible evidence. No generic motivational filler, artificial urgency, repeated "follow us" endings or hashtag stuffing. Vary structure and CTA. Avoid em dashes. Do not invent case studies, client approvals or results. Distinguish estimates from measured facts.`,
  founder: `First-person strategic thought leadership with a senior operator's point of view. Core themes: marketing economics, AI infrastructure ownership, local inference, data sovereignty, specialized agents, scalable first-party intelligence, platform dependency, attribution and commercial decision making. Make an original argument, articulate the trade-off, and connect technical realities to business economics. Direct and confident, skeptical of shallow AI wrappers and fashionable claims. Avoid motivational boilerplate, obvious questions, generic follow CTAs, fake personal experiences, em dashes and unverified dollar amounts. Do not expose proprietary recipes or private data.`,
  visual: `Marketing Powered brand colors confirmed from the user's supplied 2026 brand guidelines: sky blue #2CACE8, black #000000, white #FFFFFF, green #08AE67. Font family: Just Sans Variable, in semi-bold, medium and light weights. Use the exact logo artwork only when provided, do not redraw or invent it. Do not share licensed font files. Favor substantive infographics, process diagrams, comparisons, data visualizations and polished product mockups over generic AI stock aesthetics. Each concept must earn its place in the piece. Use verified figures only. Visual readability, correct spelling and mobile cropping are mandatory. Build image briefs with exact text, canvas dimensions, negative constraints and alt text.`,
  qa: `Check originality, claim verification, legal/compliance concerns for regulated marketing, internal and external links, platform-specific formatting, source attribution, privacy and missing visuals. Flag content repeating the same idea with superficial hook changes. Detect template signatures including identical endings across posts. Every final publication requires a human approval. Never assert that a machine QA pass is a legal compliance certification.`
};
function ensureBrandProfiles(db) {
  const q = db.prepare('INSERT OR IGNORE INTO brand_profiles (name,rules,updated_at) VALUES (?,?,?)');
  for (const [name, rules] of Object.entries(DEFAULT_PROFILES)) q.run(name, rules, stamp());
}
export function getBrandProfiles() { return Object.fromEntries(getDb().prepare('SELECT name,rules FROM brand_profiles ORDER BY name').all().map((x) => [x.name, x.rules])); }
export function saveBrandProfiles(patch) {
  const db = getDb(); const allow = ['company', 'founder', 'visual', 'qa']; const stmt = db.prepare('UPDATE brand_profiles SET rules=?,updated_at=? WHERE name=?');
  for (const name of allow) if (name in patch) { const rules = String(patch[name] || '').trim(); if (rules.length < 30 || rules.length > 12000) throw new Error(`Brand profile ${name} must be 30-12000 characters.`); stmt.run(rules, stamp(), name); }
  return getBrandProfiles();
}

function seedData(db) {
  const examples = [
    ['mpfresh', 'backlog', 'How healthcare systems can build better first-party attribution', 'guide', 'website', 'P1', 'Emily', 1700, 'first-party attribution'],
    ['mpfresh', 'ready_brief', 'Owned AI infrastructure vs rented marketing intelligence', 'article', 'website', 'P1', 'Emily', 2200, 'owned AI infrastructure'],
    ['mpfresh', 'brief_complete', 'Hospital marketing conversion architecture', 'guide', 'website', 'P2', 'Emily', 1600, 'hospital marketing'],
    ['mpfresh', 'ready_writing', 'Building useful customer intelligence from fragmented data', 'article', 'website', 'P1', 'Emily', 2000, 'customer intelligence'],
    ['mpfresh', 'draft_complete', 'Local inference for regulated marketing teams', 'article', 'website', 'P2', 'Emily', 1500, 'local inference'],
    ['mpfresh', 'graphics', 'A practical guide to marketing data sovereignty', 'guide', 'website', 'P1', 'Emily', 2100, 'data sovereignty'],
    ['mpfresh', 'final_approval', 'Powered Cards: connecting physical touchpoints to measurable action', 'landing', 'website', 'P0', 'Mike', 1200, 'Google review cards'],
    ['mpfresh', 'ship_dev', 'From marketing activity to accountable revenue systems', 'article', 'website', 'P2', 'Jason', 1500, 'marketing attribution'],
    ['social', 'post_plan', 'What owning your AI stack changes for a CMO', 'founder_post', 'linkedin', 'P1', 'Rimsha', 300, 'AI ownership'],
    ['social', 'plan_review', 'The missing signals between clicks and customers', 'company_post', 'linkedin', 'P2', 'Rimsha', 200, 'lead attribution'],
    ['social', 'content_drafting', 'No more subscriptions. Only owned ingenuity.', 'founder_post', 'linkedin', 'P1', 'Emily', 350, 'owned infrastructure'],
    ['social', 'content_review', 'The problem with cheap leads', 'company_post', 'facebook', 'P2', 'Emily', 180, 'qualified leads'],
    ['social', 'graphics', 'Why a call is not a conversion', 'carousel', 'instagram', 'P2', 'Rimsha', 160, 'call tracking'],
    ['social', 'graphic_review', 'Four metrics worth tracking after the click', 'carousel', 'linkedin', 'P1', 'Rimsha', 180, 'marketing metrics'],
    ['social', 'final_approval', 'Before automating content, fix the source data', 'company_post', 'linkedin', 'P1', 'Mike', 200, 'content operations'],
    ['social', 'ready_post', 'Data sovereignty is a business decision', 'company_post', 'linkedin', 'P1', 'Mike', 210, 'data sovereignty']
  ];
  for (let i = 0; i < examples.length; i++) {
    const [board, lane, title, type, channel, priority, owner, wordCount, keyword] = examples[i];
    const id = randomUUID(), now = stamp();
    db.prepare(`INSERT INTO tasks (id,board_id,lane_id,title,content_type,channel,priority,owner,topic,primary_keyword,word_count,created_at,updated_at,sort_order,demo,objective,audience,voice) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id, board, `${board}:${lane}`, title, type, channel, priority, owner, title, keyword, wordCount, now, now, i, 1, 'Authority, visibility, and qualified demand', 'Marketing executives and business owners', type === 'founder_post' ? 'founder' : 'company');
    db.prepare('INSERT INTO events (id,task_id,event_type,message,actor,created_at) VALUES (?,?,?,?,?,?)')
      .run(randomUUID(), id, 'created', 'Sample task for exploring the board', 'System', now);
  }
}
export function getBootstrap() {
  const db = getDb();
  const boards = db.prepare('SELECT * FROM boards ORDER BY id').all();
  const lanes = db.prepare('SELECT * FROM lanes ORDER BY board_id,sort_order').all();
  const tasks = db.prepare('SELECT * FROM tasks WHERE archived=0 ORDER BY sort_order,created_at').all().map(taskRow);
  // Everything still in flight, plus recent history so the run log shows completions and failures.
  const jobs = db.prepare(`SELECT id,task_id,kind,status,attempts,created_at,started_at,finished_at,run_after,error,model,options FROM jobs
    WHERE status IN ('queued','running') OR id IN (SELECT id FROM jobs ORDER BY created_at DESC LIMIT 120)
    ORDER BY created_at DESC LIMIT 200`).all().map(jobRow);
  const assetCounts = db.prepare('SELECT task_id,COUNT(*) count FROM assets GROUP BY task_id').all();
  const artifactCounts = db.prepare('SELECT task_id,kind,COUNT(*) count FROM artifacts GROUP BY task_id,kind').all();
  const commentCounts = db.prepare('SELECT task_id,COUNT(*) count FROM comments GROUP BY task_id').all();
  return { boards, lanes, tasks, jobs, assetCounts, artifactCounts, commentCounts, version: VERSION };
}
export function getTask(id) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM tasks WHERE id=?').get(id);
  if (!row) return null;
  return {
    ...taskRow(row),
    artifacts: db.prepare('SELECT * FROM artifacts WHERE task_id=? ORDER BY created_at DESC,version DESC').all(id),
    comments: db.prepare('SELECT * FROM comments WHERE task_id=? ORDER BY created_at ASC').all(id),
    events: db.prepare('SELECT * FROM events WHERE task_id=? ORDER BY created_at DESC LIMIT 80').all(id).map((x) => ({ ...x, details: fromJson(x.details, {}) })),
    jobs: db.prepare('SELECT * FROM jobs WHERE task_id=? ORDER BY created_at DESC LIMIT 40').all(id).map(jobRow),
    assets: db.prepare('SELECT id,task_id,name,mime,size,created_at FROM assets WHERE task_id=? ORDER BY created_at DESC').all(id),
    related: row.campaign_id ? db.prepare('SELECT id,title,channel,board_id,lane_id FROM tasks WHERE campaign_id=? AND id!=? AND archived=0').all(row.campaign_id, id) : []
  };
}
export function event(taskId, type, message, actor = 'System', details = {}) {
  getDb().prepare('INSERT INTO events (id,task_id,event_type,message,actor,details,created_at) VALUES (?,?,?,?,?,?,?)')
    .run(randomUUID(), taskId, type, message, actor, json(details), stamp());
  publish('task', { taskId, type });
}
export function commission(payload) {
  const db = getDb();
  const outputs = [...new Set(Array.isArray(payload.outputs) ? payload.outputs.filter((x) => CHANNELS.includes(x)) : [])];
  if (!outputs.length) throw new Error('Select at least one output channel.');
  const topic = String(payload.topic || '').trim();
  if (topic.length < 5 || topic.length > 220) throw new Error('Topic must contain 5 to 220 characters.');
  const voice = payload.voice === 'founder' ? 'founder' : 'company';
  const priority = PRIORITIES.includes(payload.priority) ? payload.priority : 'P2';
  const websiteType = WEBSITE_TYPES.includes(payload.content_type) ? payload.content_type : 'article';
  const actor = str(payload.actor || 'Mike', 80);
  const now = stamp(), campaignId = randomUUID(), ids = [];
  const stmt = db.prepare(`INSERT INTO tasks (id,board_id,lane_id,campaign_id,title,content_type,channel,brand,priority,owner,reviewer,topic,objective,audience,primary_keyword,secondary_keywords,source_urls,due_date,word_count,graphics_count,voice,cta,instructions,created_at,updated_at,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  db.exec('BEGIN');
  try {
    for (const channel of outputs) {
      const board = channel === 'website' ? 'mpfresh' : 'social';
      const lane = board === 'mpfresh' ? 'backlog' : 'post_plan';
      const id = randomUUID();
      const type = channel === 'website' ? websiteType : (voice === 'founder' ? 'founder_post' : channel === 'instagram' ? 'carousel' : 'company_post');
      const title = topic + (outputs.length > 1 ? ` (${channel === 'website' ? 'Website' : channel.toUpperCase()})` : '');
      const wordCount = channel === 'website' ? (Number(payload.word_count) || 1500) : channel === 'linkedin' ? (voice === 'founder' ? 350 : 230) : channel === 'facebook' ? 170 : channel === 'gbp' ? 120 : channel === 'x' ? 45 : 130;
      const nextOrder = (db.prepare('SELECT COALESCE(MAX(sort_order),0)+1 n FROM tasks WHERE lane_id=?').get(`${board}:${lane}`)?.n || 1);
      stmt.run(id, board, `${board}:${lane}`, campaignId, title, type, channel, str(payload.brand || 'Marketing Powered', 80),
        priority, str(payload.owner || 'Unassigned', 80), str(payload.reviewer || 'Mike', 80), topic,
        str(payload.objective, 3000), str(payload.audience, 3000), str(payload.primary_keyword, 200),
        json(strList(payload.secondary_keywords, 30, 120)), json(strList(payload.source_urls, 30, 2000)), dateOrNull(payload.due_date),
        Math.min(6000, Math.max(20, wordCount)), Math.min(10, Math.max(0, Number(payload.graphics_count) || 0)),
        voice, str(payload.cta, 3000), str(payload.instructions, 15000), now, now, nextOrder);
      event(id, 'created', 'Commissioned from Content Studio', actor, { campaignId, channel });
      ids.push(id);
    }
    db.exec('COMMIT');
  } catch (err) { db.exec('ROLLBACK'); throw err; }
  const jobs = payload.autostart ? ids.map((id) => startPipeline(id, null, actor)) : [];
  return { campaignId, tasks: ids.map(getTask), autoQueued: jobs.length };
}
export function updateTask(id, patch, actor = 'Mike') {
  const db = getDb(), old = getTask(id); if (!old) throw new Error('Task not found.');
  // published_url is deliberately absent: a live URL may only be recorded through the approval-gated publish action.
  const allowed = ['title', 'priority', 'owner', 'reviewer', 'topic', 'objective', 'audience', 'primary_keyword', 'secondary_keywords', 'source_urls', 'due_date', 'word_count', 'graphics_count', 'voice', 'cta', 'instructions'];
  const updates = []; const args = [];
  for (const key of allowed) {
    if (!(key in patch)) continue;
    let v = patch[key];
    if (key === 'secondary_keywords') v = json(strList(v, 30, 120));
    else if (key === 'source_urls') v = json(strList(v, 30, 2000));
    else if (key === 'word_count') v = Math.min(6000, Math.max(0, Number(v) || 0));
    else if (key === 'graphics_count') v = Math.min(12, Math.max(0, Number(v) || 0));
    else if (key === 'priority') { if (!PRIORITIES.includes(v)) throw new Error('Priority must be P0 to P6, or BP0 to BP3.'); }
    else if (key === 'voice') { if (!['company', 'founder'].includes(v)) throw new Error('Voice must be company or founder.'); }
    else if (key === 'due_date') v = dateOrNull(v);
    else if (key === 'title') { v = String(v ?? '').trim().slice(0, 300); if (!v) throw new Error('Title cannot be empty.'); }
    else v = str(v, key === 'instructions' ? 15000 : 3000);
    updates.push(`${key}=?`); args.push(v);
  }
  if (!updates.length) return old;
  const fields = updates.map((v) => v.split('=')[0]);
  updates.push('updated_at=?', 'rev=rev+1'); args.push(stamp(), id);
  db.prepare(`UPDATE tasks SET ${updates.join(',')} WHERE id=?`).run(...args);
  event(id, 'updated', 'Commission details updated', actor, { fields });
  return getTask(id);
}
export function moveTask(id, laneId, actor = 'Mike', auto = true) {
  const db = getDb(); const old = getTask(id); if (!old) throw new Error('Task not found.');
  const target = db.prepare('SELECT * FROM lanes WHERE id=?').get(laneId);
  if (!target || target.board_id !== old.board_id) throw new Error('Invalid lane for this board.');
  if (old.lane_id === laneId) return { task: old, autoAction: null };
  const nextOrder = db.prepare('SELECT COALESCE(MAX(sort_order),0)+1 n FROM tasks WHERE lane_id=?').get(laneId)?.n || 1;
  db.prepare('UPDATE tasks SET lane_id=?,sort_order=?,updated_at=?,rev=rev+1 WHERE id=?').run(laneId, nextOrder, stamp(), id);
  event(id, 'moved', `Moved to ${target.name}`, actor, { from: old.lane_id, to: laneId });
  return { task: getTask(id), autoAction: auto && process.env.AUTO_GENERATE_ON_MOVE !== 'false' ? target.auto_action : null };
}
export function addComment(id, body, author) {
  const db = getDb(); if (!getTask(id)) throw new Error('Task not found.');
  const t = stamp(); db.prepare('INSERT INTO comments (id,task_id,author,body,created_at) VALUES (?,?,?,?,?)').run(randomUUID(), id, String(author || 'Mike').slice(0, 100), String(body).slice(0, 12000), t);
  event(id, 'commented', 'Comment added', author || 'Mike');
  return getTask(id);
}
const REVISION_LANES = { mpfresh: 'mpfresh:ready_writing', social: 'social:content_drafting' };
/**
 * Send a piece back for another draft. The reviewer's note becomes an open comment, which the next draft must
 * address; the card returns to the drafting lane; approval is withdrawn. Nothing is deleted.
 */
export function requestRevision(id, note, actor = 'Mike') {
  const task = getTask(id); if (!task) throw new Error('Task not found.');
  if (!task.artifacts.some((a) => a.kind === 'draft')) throw new Error('There is no draft to revise yet.');
  if (task.jobs.some((j) => ['queued', 'running'].includes(j.status))) throw new Error('A generation is already running for this task. Stop it or wait for it to finish.');
  addComment(id, `Revision requested: ${note}`, actor);
  getDb().prepare('UPDATE tasks SET approved_at=NULL WHERE id=?').run(id);
  const lane = REVISION_LANES[task.board_id];
  if (lane) moveTask(id, lane, actor, false);
  event(id, 'revision', 'Sent back for revision', actor, { note: String(note).slice(0, 300) });
  return queueJob(id, 'draft');
}
export function setQaStatus(id, status) {
  getDb().prepare('UPDATE tasks SET qa_status=? WHERE id=?').run(status, id);
}
export function addArtifact(id, kind, title, body, model = '', jobId = '', actor = 'MAIOS') {
  const db = getDb(); const n = (db.prepare('SELECT COALESCE(MAX(version),0)+1 n FROM artifacts WHERE task_id=? AND kind=?').get(id, kind)?.n || 1);
  const aid = randomUUID();
  // New copy or creative invalidates an earlier approval; a new draft also makes the last QA report stale.
  if (kind === 'draft' || kind === 'graphics') db.prepare('UPDATE tasks SET approved_at=NULL,rev=rev+1 WHERE id=?').run(id);
  if (kind === 'draft') db.prepare("UPDATE tasks SET qa_status='stale' WHERE id=? AND qa_status IS NOT NULL").run(id);
  db.prepare('INSERT INTO artifacts (id,task_id,kind,version,title,body,model,job_id,created_at) VALUES (?,?,?,?,?,?,?,?,?)').run(aid, id, kind, n, title, body, model, jobId, stamp());
  event(id, 'artifact', `${title} v${n} saved`, actor, { kind, version: n });
  return aid;
}
export function approveTask(id, actor = 'Mike', { override = false } = {}) {
  const db = getDb(), task = getTask(id); if (!task) throw new Error('Task not found.');
  if (!['final_approval', 'graphic_review'].includes(task.lane_id.split(':')[1])) throw new Error('Move the task to an approval lane first.');
  const latestDraft = task.artifacts.find((a) => a.kind === 'draft');
  if (!latestDraft) throw new Error('No draft artifact is available to approve.');
  const latestQa = task.artifacts.find((a) => a.kind === 'qa');
  if (!latestQa) throw new Error('A completed QA report is required before final approval.');
  if (latestDraft.created_at > latestQa.created_at) throw new Error('The draft changed after QA. Run QA again before approval.');
  const failed = task.qa_status === 'blocked' || hasBlockingFinding(latestQa.body);
  if (failed && !override) throw new Error('QA failed. Approve anyway if you accept the draft as it is, or redo it with the QA fixes.');
  db.prepare('UPDATE tasks SET approved_at=?,updated_at=?,rev=rev+1 WHERE id=?').run(stamp(), stamp(), id);
  event(id, 'approved', failed ? 'Approved despite a failed QA (human decision)' : 'Approved for development or publishing', actor, { draftVersion: latestDraft.version, qaVersion: latestQa.version, override: failed });
  const destination = task.board_id === 'mpfresh' ? 'mpfresh:ship_dev' : 'social:ready_post';
  moveTask(id, destination, actor, false);
  return getTask(id);
}
export function markPublished(id, url, actor = 'Mike') {
  const db = getDb(), task = getTask(id); if (!task) throw new Error('Task not found.');
  if (!task.approved_at) throw new Error('Content must be approved before marking published.');
  if (!/^https?:\/\/\S+$/i.test(url)) throw new Error('A complete live URL is required.');
  db.prepare('UPDATE tasks SET published_at=?,published_url=?,updated_at=?,rev=rev+1 WHERE id=?').run(stamp(), url.slice(0, 2000), stamp(), id);
  event(id, 'published', 'Live URL recorded', actor, { url }); return getTask(id);
}

// ---------- Durable job queue ----------
export function getJob(id) { return jobRow(getDb().prepare('SELECT * FROM jobs WHERE id=?').get(id)); }
export function queueJob(id, kind, options = {}) {
  const db = getDb(), t = getTask(id); if (!t) throw new Error('Task not found.');
  if (!STAGES.includes(kind)) throw new Error('Invalid generation stage.');
  const existing = db.prepare("SELECT * FROM jobs WHERE task_id=? AND kind=? AND status IN ('queued','running') LIMIT 1").get(id, kind);
  if (existing) return jobRow(existing);
  const clean = {};
  if (options.chain) clean.chain = true;
  if (options.fresh) clean.fresh = true;
  const jobId = randomUUID(), now = stamp();
  db.prepare('INSERT INTO jobs (id,task_id,kind,status,run_after,created_at,options) VALUES (?,?,?,?,?,?,?)').run(jobId, id, kind, 'queued', now, now, json(clean));
  event(id, 'queued', `Queued ${kind} generation${clean.chain ? ' (autopilot)' : ''}`);
  publish('job', { jobId, taskId: id, kind, status: 'queued' });
  return getJob(jobId);
}
/** Claim the oldest runnable job. A task never has two generations running at once. */
export function nextJob() {
  const db = getDb();
  // Finish work in progress before starting new work: QA, graphics and drafts go ahead of new briefs, so moving a
  // card forward is not stuck behind a large batch of briefs. Within a stage, oldest first.
  const job = db.prepare(`SELECT * FROM jobs WHERE status='queued' AND run_after<=?
    AND task_id NOT IN (SELECT task_id FROM jobs WHERE status='running')
    ORDER BY CASE kind WHEN 'qa' THEN 0 WHEN 'graphics' THEN 1 WHEN 'draft' THEN 2 ELSE 3 END, created_at ASC LIMIT 1`).get(stamp());
  if (!job) return null;
  db.prepare("UPDATE jobs SET status='running',attempts=attempts+1,started_at=?,error=NULL WHERE id=?").run(stamp(), job.id);
  publish('job', { jobId: job.id, taskId: job.task_id, kind: job.kind, status: 'running' });
  return jobRow({ ...job, status: 'running', attempts: job.attempts + 1 });
}
export function finishJob(id, status, error = '', model = '', usage = null) {
  const db = getDb(), job = db.prepare('SELECT * FROM jobs WHERE id=?').get(id); if (!job) return;
  const final = status === true ? 'done' : status === false ? 'failed' : status;
  db.prepare('UPDATE jobs SET status=?,error=?,model=?,finished_at=? WHERE id=?').run(final, String(error || '').slice(0, 1800), model, stamp(), id);
  const message = { done: `${job.kind} generation completed`, failed: `${job.kind} generation failed`, cancelled: `${job.kind} generation cancelled` }[final] || `${job.kind} ${final}`;
  // Token usage is kept with the event, so spend per stage can be read back from the task history.
  event(job.task_id, final === 'done' ? 'generated' : final, message, 'MAIOS', { jobId: id, error: final === 'done' ? '' : String(error || '').slice(0, 400), ...(usage ? { usage } : {}) });
  publish('job', { jobId: id, taskId: job.task_id, kind: job.kind, status: final });
}
/** Put a job back in the queue after a transient failure (model server offline) without losing it. */
export function requeueJob(id, delayMs, note = '') {
  const db = getDb(), job = db.prepare('SELECT * FROM jobs WHERE id=?').get(id); if (!job) return;
  db.prepare("UPDATE jobs SET status='queued',started_at=NULL,run_after=?,error=? WHERE id=?").run(new Date(Date.now() + delayMs).toISOString(), String(note).slice(0, 1800), id);
  publish('job', { jobId: id, taskId: job.task_id, kind: job.kind, status: 'queued' });
}
/** Queue a fresh attempt of a failed or cancelled job, keeping its options (so a stopped autopilot resumes). */
export function retryJob(id) {
  const job = getJob(id); if (!job) throw new Error('Job not found.');
  if (!['failed', 'cancelled'].includes(job.status)) throw new Error('Only failed or cancelled jobs can be retried.');
  return queueJob(job.task_id, job.kind, job.options);
}
/** Autopilot: run every remaining stage in order and stop at the human approval lane. */
export function startPipeline(id, from = null, actor = 'Mike') {
  const task = getTask(id); if (!task) throw new Error('Task not found.');
  const has = (kind) => task.artifacts.some((a) => a.kind === kind);
  const first = STAGES.includes(from) ? from : !has('brief') ? 'brief' : !has('draft') ? 'draft' : (task.graphics_count > 0 && !has('graphics')) ? 'graphics' : 'qa';
  event(id, 'pipeline', `Autopilot started at ${first}`, actor, { from: first });
  return queueJob(id, first, { chain: true });
}
/** Latest drafts of every other live task plus the historical archive, for the repetition check. */
export function repetitionCorpus(taskId) {
  const db = getDb(), out = [];
  for (const row of db.prepare(`SELECT t.title,a.body FROM artifacts a JOIN tasks t ON t.id=a.task_id
    WHERE a.kind='draft' AND a.task_id!=? AND t.archived=0
      AND a.version=(SELECT MAX(version) FROM artifacts WHERE task_id=a.task_id AND kind='draft')
    ORDER BY a.created_at DESC LIMIT 300`).all(taskId)) out.push({ ...row, kind: 'draft' });
  try {
    for (const row of db.prepare("SELECT title,body FROM knowledge_items WHERE category='historical_draft' AND enabled=1 LIMIT 400").all()) out.push({ ...row, kind: 'historical' });
  } catch { /* knowledge tables are created by knowledge.mjs; absent in a bare import */ }
  return out;
}
export function taskStats() {
  const db = getDb();
  return {
    total: db.prepare('SELECT count(*) n FROM tasks WHERE archived=0').get().n,
    commissioned: db.prepare('SELECT count(*) n FROM tasks WHERE demo=0 AND archived=0').get().n,
    approved: db.prepare('SELECT count(*) n FROM tasks WHERE approved_at IS NOT NULL').get().n,
    jobs: db.prepare("SELECT count(*) n FROM jobs WHERE status IN ('queued','running')").get().n
  };
}
export function exportData() {
  const db = getDb(); return { exported_at: stamp(), app: 'MAIOS Content Studio', version: VERSION, boards: db.prepare('SELECT * FROM boards').all(), lanes: db.prepare('SELECT * FROM lanes').all(), tasks: db.prepare('SELECT * FROM tasks').all().map(taskRow), artifacts: db.prepare('SELECT * FROM artifacts').all(), comments: db.prepare('SELECT * FROM comments').all(), events: db.prepare('SELECT * FROM events').all(), jobs: db.prepare('SELECT * FROM jobs').all() };
}
