import { makeKnowledgeUI } from './knowledge-ui.js';
import { renderMarkdown, countWords } from './markdown.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const html = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dateFmt = (s) => s ? new Date(s.length === 10 ? s + 'T12:00:00' : s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'No deadline';
const stampFmt = (s) => s ? new Date(s).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
const initials = (s) => String(s || 'U').split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0].toUpperCase()).join('');
const titleCase = (s) => String(s || '').replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const num = (n) => Number(n || 0).toLocaleString('en-US');
const store = { get: (k, fallback = '') => { try { return localStorage.getItem(k) ?? fallback; } catch { return fallback; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } } };

const STAGES = ['brief', 'draft', 'graphics', 'qa'];
const prettyKind = { brief: 'Brief', draft: 'Draft', graphics: 'Graphics', qa: 'QA Review' };
const stageVerb = { brief: 'Writing the brief', draft: 'Writing the draft', graphics: 'Planning graphics', qa: 'Running QA' };
const kindIcon = { article: '▤', guide: '▤', landing: '◨', founder_post: '✦', company_post: '◈', carousel: '▥' };
const channelLabel = { website: 'Website', linkedin: 'LinkedIn', facebook: 'Facebook', instagram: 'Instagram', gbp: 'Google Business', x: 'X' };
const laneColors = ['#6f8296', '#2cace8', '#5fc0ee', '#3d9bd6', '#45b9c4', '#e0a35a', '#f0bb6b', '#08ae67'];
const QA_LABEL = { pass: ['QA pass', 'ok'], review: ['QA pass', 'ok'], blocked: ['QA fail', 'bad'], stale: ['QA stale', 'dim'], manual: ['QA manual', 'ok'] };
const REVIEW_LANES = /final_approval|graphic_review|content_review|plan_review/;
const assetObjectURLs = new Map();

const state = {
  data: { boards: [], lanes: [], tasks: [], jobs: [], artifactCounts: [], assetCounts: [], commentCounts: [], stats: {}, settings: {} },
  board: store.get('maios_board', 'mpfresh'), view: 'board', layout: 'board', search: '', priority: 'all', showDemo: true,
  selected: null, selectedTask: null, taskTab: 'overview', artifactTab: 'draft', artifactVersion: null, editingArtifact: false,
  rawView: store.get('maios_raw') === '1', model: { connected: false, models: [] }, live: new Map(), liveConnected: false, drag: null
};

// ---------- API ----------
// Served by MAIOS (at /studio/, on Vercel or `next dev`): the backend is MAIOS itself at /api/studio, with the database
// in Vercel Blob and generation on cloud models. Served by the studio's own local server (at /): same origin, or a
// remote API URL saved in Settings.
const HOSTED = location.pathname.startsWith('/studio/');
function baseUrl() { if (HOSTED) return '/api/studio'; const saved = store.get('maios_api_url'); return saved ? saved.replace(/\/$/, '') : ''; }
function token() { try { return sessionStorage.getItem('maios_token') || ''; } catch { return ''; } }
function actor() { return store.get('maios_actor', 'Mike').trim() || 'Mike'; }
const authHeaders = () => ({ 'X-MAIOS-Token': token(), 'X-MAIOS-Actor': encodeURIComponent(actor()) });
async function api(path, opts = {}) {
  const req = { method: opts.method || 'GET', headers: { Accept: 'application/json', ...authHeaders() }, cache: 'no-store' };
  if (opts.body !== undefined) { req.headers['Content-Type'] = 'application/json'; req.body = JSON.stringify(opts.body); }
  let r;
  try { r = await fetch(baseUrl() + path, req); } catch { throw new Error(HOSTED ? 'Unable to reach MAIOS. Check your connection and try again.' : 'Unable to reach the MAIOS backend. Check Settings > API connection and that the local server is running.'); }
  let body; try { body = await r.json(); } catch { throw new Error(`Backend returned a non-JSON response (HTTP ${r.status}).${HOSTED ? '' : ' Check API URL.'}`); }
  if (r.status === 401 && body.auth) authGate(body.auth);
  if (!r.ok) throw new Error(body.error || `Request failed (${r.status})`);
  return body;
}
function toast(message, type = 'good') {
  const el = document.createElement('div'); el.className = 'toast ' + type; el.textContent = message; $('#toastContainer').appendChild(el);
  setTimeout(() => el.remove(), type === 'error' ? 8000 : 4200);
}
let lastBoardSig = '';
async function refresh(showError = true, force = false) {
  try {
    const data = await api('/api/bootstrap'), sig = JSON.stringify(data);
    state.data = data;
    // Live events arrive in bursts. Rebuilding an identical board resets scroll and swallows clicks, so skip it.
    if (force || sig !== lastBoardSig) { lastBoardSig = sig; render(); }
    paintSync();
    return state.data;
  } catch (e) { if (showError) { toast(e.message, 'error'); settingsModal(true); } return null; }
}
let refreshTimer = null, drawerTimer = null;
const scheduleRefresh = (ms = 150) => { clearTimeout(refreshTimer); refreshTimer = setTimeout(() => refresh(false), ms); };
function scheduleDrawerReload(ms = 200) {
  clearTimeout(drawerTimer);
  drawerTimer = setTimeout(() => {
    if (!state.selected || state.editingArtifact || state.dirty) return;
    const focused = document.activeElement;
    // Never yank a form out from under someone who is typing in it.
    if (focused && $('#taskDrawer').contains(focused) && ['TEXTAREA', 'INPUT', 'SELECT'].includes(focused.tagName)) return scheduleDrawerReload(1500);
    openTask(state.selected, true);
  }, ms);
}
function paintSync() {
  const el = $('#lastSync'); if (!el) return;
  const time = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  el.innerHTML = HOSTED ? `<span class="live-dot on"></span>Synced ${time} · auto-refresh` : state.liveConnected ? '<span class="live-dot on"></span>Live updates on' : `Synced ${time} · reconnecting`;
}
async function refreshModel() {
  try { state.model = await api('/api/models'); } catch (e) { state.model = { connected: false, error: e.message, models: [], ai: state.model.ai }; }
  const card = $('#workerCard'); if (!card) return;
  const stages = state.model.ai?.stages || {};
  $('.worker-pulse', card).className = 'worker-pulse ' + (state.model.connected ? 'online' : 'offline');
  $('strong', card).textContent = 'AI models';
  $('small', card).textContent = state.model.connected ? `Writer: ${modelLabel(stages.draft)}` : state.model.ai ? 'Add an API key in Settings' : 'Unavailable';
  card.title = state.model.ai ? `${STAGES.map((s) => `${prettyKind[s]}: ${modelLabel(stages[s])}`).join('\n')}\n\nClick to change models or API keys.` : (state.model.error || '');
}
const modelLabel = (id) => (state.model.ai?.models || []).find((m) => m.id === id)?.label || String(id || '').replace(/^[a-z]+:/, '') || 'not set';
const STAGE_LABEL = { brief: 'Brief', draft: 'Draft (writer)', graphics: 'Graphics plan', qa: 'QA review' };

// ---------- Hosted access: passcode on the public address ----------
let gateOpen = false;
function authGate(info) {
  state.auth = info;
  if (gateOpen) return; gateOpen = true;
  $('#settingsBackdrop').hidden = false; $('#settingsModal').hidden = false;
  $('#settingsModal').innerHTML = info.passcodeSet
    ? `<div class="eyebrow">CONTENT STUDIO</div><h2>Enter the studio passcode</h2><p>Content Studio holds your AI provider keys, so it asks for the team passcode. This browser stays signed in for 90 days.</p>
      <form id="signInForm"><div class="settings-field"><label>PASSCODE</label><input type="password" name="passcode" autocomplete="current-password" required autofocus /></div><div class="settings-actions"><button type="submit" class="button primary">Open the studio</button></div></form>`
    : `<div class="eyebrow">CONTENT STUDIO</div><h2>Access is not configured</h2><p>Content Studio holds your AI provider keys, so it only opens with a passcode, and none is configured on this deployment. Add <code>STUDIO_PASSCODE</code> (at least 8 characters) to the Vercel project environment and redeploy.</p>
      <div class="settings-actions"><button class="button primary" id="authRetry">Try again</button></div>`;
}

// ---------- Live updates (Server-Sent Events over fetch, so the access token stays in a header) ----------
let eventsCtl = null;
async function connectEvents() {
  let delay = 1000;
  for (;;) {
    eventsCtl = new AbortController();
    try {
      const r = await fetch(baseUrl() + '/api/events', { headers: { Accept: 'text/event-stream', ...authHeaders() }, cache: 'no-store', signal: eventsCtl.signal });
      if (!r.ok || !r.body) throw new Error('events unavailable');
      const reader = r.body.getReader(), decoder = new TextDecoder(); let buffer = '';
      delay = 1000;
      for (;;) {
        const { value, done } = await reader.read(); if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let cut;
        while ((cut = buffer.indexOf('\n\n')) >= 0) {
          const block = buffer.slice(0, cut); buffer = buffer.slice(cut + 2);
          const type = block.match(/^event: (.*)$/m)?.[1], data = block.match(/^data: (.*)$/m)?.[1];
          if (type && data) { try { onServerEvent(type, JSON.parse(data)); } catch (e) { console.error('event', e); } }
        }
      }
    } catch { /* fall through to reconnect */ }
    if (state.liveConnected) { state.liveConnected = false; paintSync(); }
    await sleep(delay); delay = Math.min(delay * 2, 15000);
  }
}
function onServerEvent(type, d) {
  if (type === 'hello') { state.liveConnected = true; paintSync(); scheduleRefresh(0); refreshModel(); return; }
  if (type === 'progress') {
    const current = state.live.get(d.jobId) ?? '';
    if (d.offset > current.length) { seedLive(d.taskId); return; } // joined mid-stream: fetch what was missed
    state.live.set(d.jobId, current.slice(0, d.offset) + d.delta);
    paintLive(d.jobId, d.taskId);
    return;
  }
  if (type === 'job') {
    if (['done', 'failed', 'cancelled'].includes(d.status)) state.live.delete(d.jobId);
    scheduleRefresh(); if (d.taskId === state.selected) scheduleDrawerReload();
    return;
  }
  if (type === 'task') { scheduleRefresh(); if (d.taskId === state.selected) scheduleDrawerReload(); return; }
  if (type === 'changed') { scheduleRefresh(); if (/\/api\/(knowledge|agents|brand)/.test(d.path || '')) kbUi.initialize(); }
}
/** Hosted: no event stream on Vercel functions, so poll the board and, while something runs, the live output. */
function startPolling() {
  let lastJobs = '';
  const active = () => state.data.jobs.some((j) => ['queued', 'running'].includes(j.status)) || (state.data.imageRuns || []).some((r) => r.status === 'running');
  const tick = async () => {
    try {
      if (document.visibilityState !== 'hidden' && !gateOpen) {
        await refresh(false);
        if (state.view === 'activity' && active()) renderRuns();
        if (state.selected) {
          const sig = state.data.jobs.filter((j) => j.task_id === state.selected).map((j) => j.id + j.status).join();
          const run = imageRunFor(state.selected);
          const imgSig = run ? `${run.status}${run.done}${run.failed}` : '';
          if (sig + imgSig !== lastJobs) { lastJobs = sig + imgSig; scheduleDrawerReload(0); }
          if (state.data.jobs.some((j) => j.task_id === state.selected && j.status === 'running')) await seedLive(state.selected);
        }
      }
    } catch { /* next tick */ }
    setTimeout(tick, active() ? 2500 : 8000);
  };
  setTimeout(tick, 2500);
}
async function seedLive(taskId) {
  try { for (const j of (await api(`/api/tasks/${taskId}/live`)).jobs) { state.live.set(j.jobId, j.text); paintLive(j.jobId, taskId); } } catch { /* job already finished */ }
}
function paintLive(jobId, taskId) {
  if (state.selected !== taskId) return;
  const box = $(`#liveOutput[data-job="${jobId}"]`); if (!box) return;
  const text = state.live.get(jobId) ?? '';
  const pinned = box.scrollHeight - box.scrollTop - box.clientHeight < 60;
  box.textContent = text || 'Waiting for the first words from the model…';
  if (pinned) box.scrollTop = box.scrollHeight;
  const count = $('#liveCount'); if (count) count.textContent = text ? `${num(countWords(text))} words` : '';
}

// ---------- Derived data ----------
function getBoard() { return state.data.boards.find((x) => x.id === state.board) || state.data.boards[0]; }
function lanes() { return state.data.lanes.filter((x) => x.board_id === state.board).sort((a, b) => a.sort_order - b.sort_order); }
function taskView() {
  const q = state.search.toLowerCase();
  return state.data.tasks.filter((t) => t.board_id === state.board && (state.showDemo || !t.demo) &&
    (state.priority === 'all' || t.priority === state.priority) &&
    (!q || [t.title, t.topic, t.primary_keyword, t.owner, t.channel, t.objective].some((v) => String(v || '').toLowerCase().includes(q))));
}
function artifactKinds(id) { return state.data.artifactCounts.filter((x) => x.task_id === id).map((x) => x.kind); }
function activeJob(id) { return state.data.jobs.find((x) => x.task_id === id && x.status === 'running') || state.data.jobs.find((x) => x.task_id === id && x.status === 'queued'); }
const commentCount = (id) => state.data.commentCounts?.find((x) => x.task_id === id)?.count || 0;
const isOverdue = (t) => t.due_date && !t.published_at && !/ship_dev|posted|ready_post/.test(t.lane_id) && t.due_date < new Date().toISOString().slice(0, 10);
const qaChip = (t, cls = 'card-tag') => { const q = QA_LABEL[t.qa_status]; return q ? `<span class="${cls} qa-${q[1]}">${q[0]}</span>` : ''; };

// ---------- Board ----------
const imageRunFor = (taskId) => (state.data.imageRuns || []).find((r) => r.task_id === taskId);
function shipChip(t) {
  const sh = (state.data.ship || []).find((x) => x.task_id === t.id); if (!sh) return '';
  if (sh.status === 'waiting') {
    if (sh.held) return `<span class="card-tag qa-warn" title="${html(sh.held)}">Held: not built</span>`;
    const mins = Math.ceil((Date.parse(sh.ready_at) - Date.now()) / 60000);
    return `<span class="card-tag running" title="Pages moved here are built together, 5 minutes after the last one arrives">${mins > 0 ? `Site build in ${mins} min` : 'Waiting for the site builder'}</span>`;
  }
  if (sh.status === 'building') return '<span class="card-tag running"><span class="live-dot on"></span>Building on the site</span>';
  if (sh.status === 'shipped') return t.published_url ? '' : `<span class="card-tag qa-ok" title="${html(sh.url || '')}">Built on the site</span>`;
  if (sh.status === 'failed') return `<span class="card-tag qa-bad" title="${html(sh.error || '')}">Site build failed</span>`;
  return '';
}
function imageChip(t) {
  const r = imageRunFor(t.id); if (!r) return '';
  if (r.status === 'running') return `<span class="card-tag running"><span class="live-dot on"></span>Creating images ${Math.min(r.total, r.done + r.failed)}/${r.total}</span>`;
  if (r.status === 'done' && /graphics|graphic_review/.test(t.lane_id)) return `<span class="card-tag qa-ok">${r.done} image${r.done === 1 ? '' : 's'} to review</span>`;
  if (r.status === 'failed' && /graphics|graphic_review/.test(t.lane_id)) return '<span class="card-tag qa-bad">Images failed</span>';
  return '';
}
function cardMarkup(t) {
  const done = artifactKinds(t.id), job = activeJob(t.id), notes = commentCount(t.id);
  return `<article class="task-card ${job?.status === 'running' ? 'is-running' : ''}" draggable="true" data-task-id="${html(t.id)}" tabindex="0" role="button" aria-label="Open ${html(t.title)}">
    <div class="card-top"><span class="card-type"><span class="type-dot">${kindIcon[t.content_type] || '▤'}</span>${html(titleCase(t.content_type))}</span><span class="badge ${html(t.priority)}">${html(t.priority)}</span></div>
    <h3>${html(t.title)}</h3>
    <div class="card-tags"><span class="card-tag">${html(channelLabel[t.channel] || t.channel)}</span>${t.voice === 'founder' ? '<span class="card-tag">Founder voice</span>' : ''}${t.demo ? '<span class="card-tag sample">SAMPLE</span>' : ''}${job ? '' : imageChip(t)}${shipChip(t)}${job ? `<span class="card-tag running"><span class="live-dot on"></span>${html(job.status === 'running' ? stageVerb[job.kind] : prettyKind[job.kind] + ' queued')}${job.options?.chain ? ' · autopilot' : ''}</span>` : ''}${qaChip(t)}${t.approved_at ? '<span class="card-tag qa-ok">✓ Approved</span>' : ''}${t.published_url ? '<span class="card-tag qa-ok">Live</span>' : ''}</div>
    <div class="card-footer"><div class="card-owner"><span class="avatar ${t.owner === 'Mike' ? 'gold' : t.owner === 'Emily' ? 'teal' : ''}">${html(initials(t.owner))}</span><span>${html(t.owner)}</span></div><div class="card-progress" title="Brief / Draft / Graphics / QA">${STAGES.map((k) => `<span class="progress-mark ${done.includes(k) ? 'done' : ''} ${job?.kind === k ? 'active' : ''}" title="${prettyKind[k]}"></span>`).join('')}</div><span class="card-time ${isOverdue(t) ? 'overdue' : ''}">${notes ? `<span title="${notes} comment${notes > 1 ? 's' : ''}">✎ ${notes}</span> ` : ''}${t.due_date ? html(dateFmt(t.due_date)) : notes ? '' : '⋯'}</span></div>
  </article>`;
}
function render() {
  const board = getBoard(); if (!board) return;
  const names = {
    knowledge: ['Knowledge Library', 'Source-tagged intelligence for every content agent'],
    instructions: ['Agent Instructions', 'Original MPAIOS roles, editable specialists and production playbooks'],
    queue: ['Review Queue', 'Everything waiting on a human decision, across both boards'],
    activity: ['Agent Runs', 'Every generation job: live, queued, finished and failed']
  };
  const [name, subtitle] = names[state.view] || [board.name, board.subtitle];
  $('#boardTitle').innerHTML = html(name) + ' <span class="title-spark">✦</span>';
  $('#boardSubtitle').textContent = subtitle;
  $('#boardToolbar').hidden = state.view !== 'board';
  $('#metrics').hidden = ['queue', 'activity'].includes(state.view);
  $('#commissionBtn').innerHTML = state.view === 'knowledge' ? '＋ Add knowledge' : '<span class="button-plus">＋</span> Commission content';
  $$('.nav-link').forEach((b) => b.classList.toggle('active', b.dataset.view === state.view));
  $('.main').classList.toggle('is-board', state.view === 'board' && state.layout === 'board');
  renderSideBoards(); renderMetrics(); renderMain();
}
function renderSideBoards() {
  $('#boardSwitcher').innerHTML = state.data.boards.map((b) => { const n = state.data.tasks.filter((t) => t.board_id === b.id).length; return `<button class="board-item ${state.board === b.id && state.view === 'board' ? 'active' : ''}" data-board-id="${html(b.id)}"><span class="board-color" style="background:${html(b.color)}"></span><span>${html(b.name)}</span><span class="board-count">${n}</span></button>`; }).join('');
  $('#reviewNavCount').textContent = state.data.tasks.filter((t) => REVIEW_LANES.test(t.lane_id)).length;
  const inFlight = state.data.jobs.filter((j) => ['queued', 'running'].includes(j.status)).length;
  const runs = $('#runsNavCount'); if (runs) { runs.textContent = inFlight; runs.hidden = !inFlight; }
}
function renderMetrics() {
  if (['knowledge', 'instructions'].includes(state.view)) { $('#metrics').innerHTML = kbUi.metricsMarkup(); return; }
  const t = state.data.tasks.filter((x) => x.board_id === state.board && (state.showDemo || !x.demo));
  const review = t.filter((x) => REVIEW_LANES.test(x.lane_id)).length;
  const ready = t.filter((x) => /ship_dev|posted|ready_post/.test(x.lane_id)).length;
  const active = t.filter((x) => !/(backlog|post_plan|ship_dev|posted|ready_post)$/.test(x.lane_id)).length;
  const blocked = t.filter((x) => x.qa_status === 'blocked').length;
  const vals = [
    ['TOTAL CONTENT', t.length, 'All cards on this board', '▦'],
    ['IN PRODUCTION', active, 'Across active workflow stages', '✧'],
    ['NEEDS REVIEW', review, blocked ? `${blocked} blocked by QA` : 'Waiting on an approval gate', '◉'],
    [state.board === 'mpfresh' ? 'SHIP TO DEV' : 'READY TO POST', ready, 'Content in delivery lane', '↗']
  ];
  $('#metrics').innerHTML = vals.map(([label, n, sub, icon]) => `<div class="metric"><div class="metric-top"><span>${html(label)}</span><span class="metric-icon">${icon}</span></div><div class="metric-value">${n}</div><div class="metric-foot">${html(sub)}</div></div>`).join('');
}
function renderMain() {
  $('#tabBoard').classList.toggle('active', state.layout === 'board'); $('#tabList').classList.toggle('active', state.layout === 'list');
  const showBoard = state.view === 'board' && state.layout === 'board';
  $('#board').hidden = !showBoard; $('#listView').hidden = showBoard;
  if (state.view === 'knowledge') return kbUi.renderKnowledge();
  if (state.view === 'instructions') return kbUi.renderInstructions();
  if (state.view === 'queue') return renderQueue();
  if (state.view === 'activity') return renderRuns();
  if (state.layout === 'list') renderList(); else renderBoard();
}
function renderBoard() {
  // Never rebuild the board under a card that is being dragged; redraw once the drag ends.
  if (state.drag) { state.renderPending = true; return; }
  // Work paused by a credit cutoff, and when MAIOS checks again.
  const credit = state.data.credit || [], cb = $('#creditBanner');
  if (cb) {
    cb.hidden = !credit.length;
    cb.innerHTML = credit.map((c) => `<strong>${html(c.label)} is out of credit.</strong> ${c.jobs} job${c.jobs === 1 ? '' : 's'}${c.images ? ` and ${c.images} image run${c.images === 1 ? '' : 's'}` : ''} paused. MAIOS checks every 6 hours and resumes them automatically (next check ${html(stampFmt(c.next_check))}). Add credit, or switch the stage's model in Settings, to resume sooner.`).join('<br>');
  }
  const tasks = taskView();
  const scrolls = new Map($$('.kanban-column', $('#board')).map((col) => [col.dataset.laneId, $('.column-body', col)?.scrollTop || 0]));
  $('#board').innerHTML = lanes().map((l, i) => {
    const items = tasks.filter((t) => t.lane_id === l.id);
    return `<section class="kanban-column" data-lane-id="${html(l.id)}"><div class="column-head"><span class="column-kicker" style="background:${l.slug === 'posted' ? '#08ae67' : laneColors[i % laneColors.length]}"></span><strong>${html(l.name)}</strong>${l.auto_action ? `<span class="lane-auto" title="Dropping a card here queues the ${html(l.auto_action)} stage">✦ ${html(l.auto_action)}</span>` : ''}<span class="column-count">${items.length}</span><button class="column-add" data-add-lane="${html(l.id)}" title="Commission content">+</button></div><div class="column-body">${items.length ? items.map(cardMarkup).join('') : '<div class="empty-column"><strong>Nothing here yet</strong>Drop a card to move it into this stage.</div>'}</div></section>`;
  }).join('');
  for (const col of $$('.kanban-column', $('#board'))) { const top = scrolls.get(col.dataset.laneId); if (top) $('.column-body', col).scrollTop = top; }
}
const laneName = (id) => state.data.lanes.find((l) => l.id === id)?.name || '';
function renderList() {
  const rows = taskView();
  $('#listView').innerHTML = `<table class="data-table"><thead><tr><th>CONTENT</th><th>STAGE</th><th>CHANNEL</th><th>QA</th><th>PRIORITY</th><th>OWNER</th><th>DUE</th></tr></thead><tbody>${rows.map((t) => `<tr><td><button class="task-link" data-task-id="${html(t.id)}">${html(t.title)}</button>${docChip(t.id)}${t.demo ? ' <span class="demo-chip">SAMPLE</span>' : ''}</td><td>${html(laneName(t.lane_id))}</td><td>${html(channelLabel[t.channel] || t.channel)}</td><td>${qaChip(t, 'chip') || '<span class="muted">–</span>'}</td><td><span class="badge ${html(t.priority)}">${html(t.priority)}</span></td><td>${html(t.owner)}</td><td class="${isOverdue(t) ? 'overdue' : ''}">${html(dateFmt(t.due_date))}</td></tr>`).join('') || '<tr><td colspan="7" class="muted">No content matches these filters.</td></tr>'}</tbody></table>`;
}
function renderQueue() {
  const review = state.data.tasks.filter((t) => REVIEW_LANES.test(t.lane_id)).sort((a, b) => a.priority.localeCompare(b.priority));
  $('#listView').innerHTML = `<div class="section-intro"><p>Editorial, graphics and final approval checkpoints across both production boards. Nothing ships without a person approving it here.</p></div><table class="data-table"><thead><tr><th>CONTENT</th><th>APPROVAL STAGE</th><th>QA</th><th>OWNER</th><th>REVIEWER</th><th>PRIORITY</th></tr></thead><tbody>${review.map((t) => `<tr><td><button class="task-link" data-task-id="${html(t.id)}">${html(t.title)}</button>${docChip(t.id)}</td><td>${html(laneName(t.lane_id))}</td><td>${qaChip(t, 'chip') || '<span class="muted">Not run</span>'}</td><td>${html(t.owner)}</td><td>${html(t.reviewer)}</td><td><span class="badge ${html(t.priority)}">${html(t.priority)}</span></td></tr>`).join('') || '<tr><td colspan="6" class="muted">Nothing is waiting for review.</td></tr>'}</tbody></table>`;
}
function duration(j) {
  if (!j.started_at) return '';
  const ms = (j.finished_at ? new Date(j.finished_at) : new Date()) - new Date(j.started_at);
  return ms < 60000 ? `${Math.max(1, Math.round(ms / 1000))}s` : `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}
function renderRuns() {
  const jobs = state.data.jobs, w = state.data.settings?.worker || {};
  $('#listView').innerHTML = `<div class="section-intro"><p>Local model jobs run in application code, not n8n. ${w.concurrency || 1} at a time, streaming ${w.streaming === false ? 'off' : 'on'}. A job that cannot reach the model server waits and retries up to ${w.maxAttempts || 3} times before failing.</p></div><table class="data-table"><thead><tr><th>CONTENT</th><th>STAGE</th><th>STATUS</th><th>MODEL</th><th>STARTED</th><th>TOOK</th><th>DETAIL</th><th></th></tr></thead><tbody>${jobs.map((j) => {
    const t = state.data.tasks.find((x) => x.id === j.task_id);
    const action = ['queued', 'running'].includes(j.status) ? `<button class="mini-link" data-cancel-job="${html(j.id)}">Stop</button>` : ['failed', 'cancelled'].includes(j.status) ? `<button class="mini-link" data-retry-job="${html(j.id)}">Retry</button>` : '';
    return `<tr><td><button class="task-link" data-task-id="${html(j.task_id)}">${html(t?.title || 'Archived task')}</button></td><td>${html(prettyKind[j.kind] || j.kind)}${j.options?.chain ? ' <span class="chip dim">autopilot</span>' : ''}</td><td><span class="chip job-${html(j.status)}">${j.status === 'running' ? '<span class="live-dot on"></span>' : ''}${html(j.status)}</span></td><td>${html(j.model || '')}</td><td>${html(stampFmt(j.started_at || j.created_at))}</td><td>${html(duration(j))}</td><td class="job-error">${html(j.error || '')}</td><td>${action}</td></tr>`;
  }).join('') || '<tr><td colspan="8" class="muted">No model jobs yet. Commission content or drag a card into an automated stage.</td></tr>'}</tbody></table>`;
}

// ---------- Task drawer ----------
async function openTask(id, preserve = false) {
  try {
    const before = preserve && state.selected === id ? JSON.stringify(state.selectedTask) : '';
    if (!preserve) { state.revising = false; state.taskTab = 'overview'; state.artifactTab = 'draft'; state.artifactVersion = null; state.editingArtifact = false; }
    state.selected = id;
    const fresh = await api('/api/tasks/' + id);
    if (state.selected !== id) return;
    // A background reload that found nothing new must not touch the pop-out: redrawing drops text selection and open menus.
    if (before && before === JSON.stringify(fresh) && !$('#taskDrawer').hidden) return;
    state.selectedTask = fresh; state.dirty = false;
    $('#drawerBackdrop').hidden = false; $('#taskDrawer').hidden = false;
    renderDrawer(!preserve);
    const running = state.selectedTask.jobs.find((j) => j.status === 'running');
    if (running) { if (state.live.has(running.id)) paintLive(running.id, id); else seedLive(id); }
  } catch (e) { toast(e.message, 'error'); }
}
function closeDrawer() { state.selected = null; state.selectedTask = null; $('#drawerBackdrop').hidden = true; $('#taskDrawer').hidden = true; if (location.hash.startsWith('#task=')) history.replaceState(null, '', location.pathname + location.search); }
function selectHtml(items, value) { return items.map((v) => `<option value="${html(v)}" ${v === value ? 'selected' : ''}>${html(v)}</option>`).join(''); }
function field(name, label, value, type = 'text', isFull = false) {
  const id = 'tf_' + name;
  if (type === 'textarea') return `<div class="detail-field ${isFull ? 'full' : ''}"><label class="field-label" for="${id}">${html(label)}</label><textarea id="${id}" name="${name}" rows="3">${html(value)}</textarea></div>`;
  if (type === 'select_priority') return `<div class="detail-field"><label class="field-label" for="${id}">${html(label)}</label><select name="${name}" id="${id}">${selectHtml(['P0', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'BP0', 'BP1', 'BP2', 'BP3'], value)}</select></div>`;
  if (type === 'select_voice') return `<div class="detail-field"><label class="field-label" for="${id}">${html(label)}</label><select name="${name}" id="${id}"><option value="company" ${value === 'company' ? 'selected' : ''}>Company</option><option value="founder" ${value === 'founder' ? 'selected' : ''}>Founder</option></select></div>`;
  return `<div class="detail-field ${isFull ? 'full' : ''}"><label class="field-label" for="${id}">${html(label)}</label><input id="${id}" name="${name}" type="${type}" value="${html(value ?? '')}" /></div>`;
}
function stepperMarkup(t, job) {
  const has = (k) => t.artifacts.some((a) => a.kind === k);
  const labels = { brief: 'Brief', draft: has('draft') ? 'Revise draft' : 'Write draft', graphics: 'Graphics plan', qa: 'Run QA' };
  const open = t.comments.filter((c) => c.created_at > (t.artifacts.find((a) => a.kind === 'draft')?.created_at || '')).length;
  return `<div class="stepper">${STAGES.map((k, i) => {
    const running = job?.kind === k, skipped = k === 'graphics' && !t.graphics_count && !has(k);
    const stateCls = running ? 'running' : has(k) ? 'done' : skipped ? 'skipped' : '';
    const hint = k === 'draft' && has('draft') ? `Revises the current draft${open ? ` using ${open} open comment${open > 1 ? 's' : ''}` : ''} and the latest QA findings` : `Generate the ${prettyKind[k].toLowerCase()} with ${html(modelLabel(state.model.ai?.stages?.[k]))}`;
    return `<button class="step ${stateCls}" data-generate="${k}" title="${html(hint)}" ${job ? 'disabled' : ''}><span class="step-n">${running ? '<span class="live-dot on"></span>' : has(k) ? '✓' : i + 1}</span><span class="step-label">${labels[k]}</span>${k === 'draft' && open && has('draft') ? `<span class="step-note">${open} note${open > 1 ? 's' : ''}</span>` : ''}</button>`;
  }).join('<span class="step-line"></span>')}</div>`;
}
function renderDrawer(resetScroll = false) {
  const t = state.selectedTask; if (!t) return;
  // Switching tabs or reloading the same task keeps the reader where they were instead of jumping to the top.
  const sameTask = !resetScroll && $('#taskDrawer').dataset.taskId === t.id;
  const keepTop = sameTask ? $('#taskDrawer .drawer-scroll')?.scrollTop || 0 : 0;
  const liveBox = sameTask ? $('#liveOutput') : null, keepLive = liveBox ? liveBox.scrollTop : 0;
  const stage = state.data.lanes.find((x) => x.id === t.lane_id);
  const stages = state.data.lanes.filter((x) => x.board_id === t.board_id).sort((a, b) => a.sort_order - b.sort_order);
  const job = t.jobs.find((x) => x.status === 'running') || t.jobs.find((x) => x.status === 'queued');
  const last = t.jobs[0], lastFailed = !job && last && ['failed', 'cancelled'].includes(last.status) ? last : null;
  const canApprove = /final_approval|graphic_review/.test(t.lane_id) && !t.approved_at;
  const live = job?.status === 'running' ? (state.live.get(job.id) ?? '') : '';
  $('#taskDrawer').dataset.taskId = t.id;
  $('#taskDrawer').innerHTML = `<div class="drawer-header"><div class="drawer-eyebrow">CONTENT RECORD / ${html(t.board_id.toUpperCase())} ${t.demo ? ' · SAMPLE' : ''}</div><div class="drawer-actions"><button class="icon-btn" id="copyTaskLink" title="Copy link">⧉</button><button class="icon-btn" id="closeDrawer" aria-label="Close task">✕</button></div></div><div class="drawer-scroll">
  <h2 class="detail-title">${html(t.title)}</h2>${t.published_url ? `<div class="live-page-link"><span class="live-dot on"></span>Live page: <a href="${html(safeUrl(t.published_url))}" target="_blank" rel="noopener noreferrer">${html(t.published_url)}</a></div>` : ''}<div class="detail-state"><span class="stage-pill">${html(stage?.name || '')}</span><span class="badge ${html(t.priority)}">${html(t.priority)}</span>${qaChip(t, 'chip')}${t.approved_at ? '<span class="chip qa-ok">✓ Approved</span>' : ''}${t.published_url ? '<span class="chip qa-ok">Live</span>' : ''}<span class="badge">${html(channelLabel[t.channel] || t.channel)}</span>${isOverdue(t) ? '<span class="chip qa-bad">Overdue</span>' : ''}${(t.docs || []).filter((d) => d.kind === 'draft').map((d) => `<a class="doc-link" href="${html(safeUrl(d.url))}" target="_blank" rel="noopener noreferrer">Google Doc ↗</a>`).join('')}</div>
  <div class="detail-section"><h4>Production controls</h4>
  ${stepperMarkup(t, job)}
  <div class="detail-commands" style="margin-top:12px">${job ? `<button class="command-btn red" data-cancel-job="${html(job.id)}">■ Stop ${job.options?.chain ? 'autopilot' : 'generation'}</button>` : `<button class="command-btn primary" data-action="pipeline" title="Runs every remaining stage in order, then stops for human approval">▶ Run autopilot</button>`}${canApprove && t.qa_status === 'blocked'
      ? `<button class="command-btn green" data-action="approve-override" title="QA failed. Approve the draft as it is and send it to Ship to dev; the override is recorded.">✓ Approve anyway</button><button class="command-btn primary" data-action="redo-qa" ${job ? 'disabled' : ''} title="Rewrites the draft to fix the issues in the QA report. QA runs again when you move it back to Final Approval.">↻ Redo with QA fixes</button>`
      : `<button class="command-btn green" data-action="approve" ${canApprove ? '' : 'disabled'} title="${canApprove ? 'Requires a QA report newer than the draft' : t.approved_at ? 'Already approved' : 'Move the card to an approval lane first'}">✓ Approve & advance</button>`}<button class="command-btn" data-action="revise-open" ${job || !t.artifacts.some((a) => a.kind === 'draft') ? 'disabled' : ''} title="Sends the card back to drafting with your note. The next draft must address it.">↩ Send back for revision</button><button class="command-btn" data-action="comment-jump">↳ Leave feedback</button><button class="command-btn red ghost" data-action="archive">Archive</button></div>
  ${state.revising && !job ? `<form id="reviseForm" class="integration-note"><label class="field-label" for="reviseNote">What needs to change?</label><textarea id="reviseNote" name="note" rows="3" required minlength="3" maxlength="4000" class="brand-rules" placeholder="e.g. Cut the second section, add a citation for the 40% figure, and make the opening less salesy."></textarea><div style="margin-top:8px"><button class="command-btn primary" type="submit">Send back and redraft</button><button class="command-btn" type="button" data-action="revise-cancel">Cancel</button></div><span class="field-hint">The card returns to drafting, approval is withdrawn, and the current draft stays in version history.</span></form>` : ''}
  ${job?.status === 'running' ? `<div class="live-box"><div class="live-head"><span><span class="live-dot on"></span>${html(stageVerb[job.kind])}${job.options?.chain ? ' · autopilot' : ''}</span><span id="liveCount">${live ? num(countWords(live)) + ' words' : ''}</span></div><pre id="liveOutput" data-job="${html(job.id)}">${html(live || 'Waiting for the first words from the model…')}</pre></div>` : ''}
  ${job?.status === 'queued' ? `<div class="run-message">◌ ${html(prettyKind[job.kind])} is queued${job.error ? `. ${html(job.error)}` : '. It starts as soon as a generation slot is free.'}</div>` : ''}
  ${lastFailed ? `<div class="run-message failed">${html(prettyKind[lastFailed.kind])} ${html(lastFailed.status)}: ${html(lastFailed.error || 'Unknown error')} <button class="mini-link" data-retry-job="${html(lastFailed.id)}">Retry${lastFailed.options?.chain ? ' and resume autopilot' : ''}</button></div>` : ''}
  <div class="detail-grid" style="margin-top:14px"><div class="detail-field full"><label class="field-label" for="detailStage">Move to workflow stage</label><select id="detailStage">${stages.map((x) => `<option value="${html(x.id)}" ${t.lane_id === x.id ? 'selected' : ''}>${html(x.name)}${x.auto_action ? '  •  triggers ' + x.auto_action : ''}</option>`).join('')}</select></div></div>
  </div>
  <div class="detail-section"><div class="artifact-tabs"><button class="artifact-tab ${state.taskTab === 'overview' ? 'active' : ''}" data-task-tab="overview">Details</button>${STAGES.map((k) => `<button class="artifact-tab ${state.taskTab === 'artifact' && state.artifactTab === k ? 'active' : ''}" data-artifact-tab="${k}">${prettyKind[k]} ${t.artifacts.some((a) => a.kind === k) ? '●' : ''}</button>`).join('')}<button class="artifact-tab ${state.taskTab === 'files' ? 'active' : ''}" data-task-tab="files">Assets (${t.assets.length})</button><button class="artifact-tab ${state.taskTab === 'activity' ? 'active' : ''}" data-task-tab="activity">Activity${t.comments.length ? ` (${t.comments.length})` : ''}</button><button class="artifact-tab ${state.taskTab === 'knowledge' ? 'active' : ''}" data-task-tab="knowledge">◈ Knowledge</button></div><div id="drawerTabContent">${renderDrawerTab(t)}</div></div>
  ${t.related.length ? `<div class="detail-section"><h4>Other campaign deliverables</h4>${t.related.map((r) => `<button class="command-btn" style="margin:0 5px 5px 0" data-related-id="${html(r.id)}">${html(channelLabel[r.channel] || r.channel)}: ${html(r.title.slice(0, 35))} ↗</button>`).join('')}<div style="margin-top:6px"><button class="mini-link" data-action="campaign-pipeline">▶ Run autopilot for the whole campaign (${t.related.length + 1} deliverables)</button></div></div>` : ''}
  <div class="detail-section"><h4>Publication record</h4><div class="approval-note">Publishing is not automatic. Approved tasks can be sent to development or your authorized scheduler. Record the live URL to close the feedback loop.</div><div class="detail-field" style="margin-top:12px"><label class="field-label" for="liveUrl">Live publication URL</label><input id="liveUrl" type="url" value="${html(t.published_url || '')}" placeholder="https://..." ${t.approved_at ? '' : 'disabled title="Approve the content first"'} /></div><div class="detail-commands" style="margin-top:10px"><button class="command-btn" id="savePublication" ${t.approved_at ? '' : 'disabled'}>Record as published</button>${t.published_url ? `<a class="command-btn" href="${html(safeUrl(t.published_url))}" target="_blank" rel="noopener noreferrer">Open published post ↗</a>` : ''}</div></div>
 </div>`;
  if (keepTop) $('#taskDrawer .drawer-scroll').scrollTop = keepTop;
  if (keepLive && $('#liveOutput')) $('#liveOutput').scrollTop = keepLive;
  if (state.taskTab === 'files' || (state.taskTab === 'artifact' && state.artifactTab === 'graphics')) hydrateAssetPreviews();
  if (state.taskTab === 'knowledge') kbUi.renderTaskKnowledge(t);
}
async function assetBlob(id) {
  const response = await fetch(baseUrl() + '/api/assets/' + id, { headers: authHeaders() });
  if (!response.ok) throw new Error('Asset is unavailable.');
  return response.blob();
}
async function hydrateAssetPreviews() {
  for (const img of $$('[data-asset-preview]', $('#taskDrawer'))) {
    const id = img.dataset.assetPreview;
    if (assetObjectURLs.has(id)) { img.src = assetObjectURLs.get(id); continue; }
    try { const u = URL.createObjectURL(await assetBlob(id)); assetObjectURLs.set(id, u); if (img.isConnected) img.src = u; }
    catch { img.style.display = 'none'; }
  }
}
function safeUrl(url) { try { const x = new URL(url); return ['http:', 'https:'].includes(x.protocol) ? x.href : '#'; } catch { return '#'; } }
function currentArtifact(t = state.selectedTask) {
  const versions = t.artifacts.filter((x) => x.kind === state.artifactTab).sort((a, b) => b.version - a.version);
  return { versions, artifact: versions.find((v) => v.version === state.artifactVersion) || versions[0] };
}
// ---------- Integrations: Google Docs review links and Gemini images ----------
const integ = () => state.data.integrations || { gemini: {}, google: {} };
const docFor = (taskId, kind = 'draft') => (state.data.docs || []).find((d) => d.task_id === taskId && d.kind === kind);
const docChip = (taskId) => { const d = docFor(taskId); return d ? ` <a class="table-doc" href="${html(safeUrl(d.url))}" target="_blank" rel="noopener noreferrer">Google Doc ↗</a>` : ''; };
function docPanel(t, kind, latestVersion) {
  if (!['brief', 'draft'].includes(kind)) return '';
  const doc = (t.docs || []).find((d) => d.kind === kind), g = integ().google;
  if (doc) {
    const stale = doc.version < latestVersion;
    return `<div class="integration-note"><a class="doc-link" href="${html(safeUrl(doc.url))}" target="_blank" rel="noopener noreferrer">Open Google Doc ↗</a> <button class="mini-link" id="copyDocLink" data-url="${html(doc.url)}" style="margin-left:8px">Copy link</button><br/>${stale ? `The document still shows v${doc.version}. <button class="mini-link" data-action="make-doc" style="text-decoration:underline">Update it to v${latestVersion}</button>` : `Up to date with v${doc.version}.`} ${doc.shared ? 'Anyone with the link can comment.' : 'Private to your Google account until you share it from Google Docs.'}</div>`;
  }
  if (g.connected) return `<div class="integration-note">No Google Doc for this ${html(prettyKind[kind].toLowerCase())} yet.<br/><button class="command-btn" data-action="make-doc">Create Google Doc review link</button></div>`;
  return `<div class="integration-note">Want a Google Doc link for reviewers? Connect your Google account once in Settings.<br/><button class="command-btn" data-action="open-settings">Open Settings</button></div>`;
}
function imagePanel(t) {
  const g = integ().gemini, run = t.imageRun, images = t.assets.filter((a) => a.mime.startsWith('image/') && a.name.startsWith('AI image'));
  const grid = images.length ? `<div class="image-grid">${images.map((a) => `<figure><img data-asset-preview="${html(a.id)}" data-view-asset="${html(a.id)}" alt="${html(a.name)}" title="Open full size" /><figcaption title="${html(a.name)}">${html(a.name)}</figcaption></figure>`).join('')}</div>` : '';
  if (!g.configured) return `<div class="integration-note">To generate real images for this piece, add ${g.provider === 'google' ? 'a Google (Gemini)' : 'an OpenAI'} key under Settings > AI models & API keys.<br/><button class="command-btn" data-action="open-settings">Open Settings</button></div>${grid}`;
  const running = run?.status === 'running';
  const status = running ? `<span class="live-dot on"></span>Generating image ${Math.min(run.total, run.done + run.failed + 1)} of ${run.total} with ${html(g.model)}…`
    : run?.status === 'failed' ? `Image generation failed: ${html(run.error)}`
      : run?.status === 'done' ? `${run.done} of ${run.total} images attached${run.failed ? `; ${run.failed} failed: ${html(run.error)}` : ''}.`
        : images.length ? `${images.length} generated image${images.length > 1 ? 's' : ''} attached. They are also in the Assets tab.` : !t.artifacts.some((a) => a.kind === 'draft') ? 'Images are generated from the draft. Write the draft first.' : `Creates up to ${g.count} images from the current draft with ${html(g.model)}: ${g.style === 'graphics' ? 'the brand graphics set' : g.style === 'photo' ? 'a hero photo and a realistic photo for each section' : 'a hero photo, then a realistic photo of the people involved for each section, or an infographic or diagram where a section explains steps, a comparison or numbers'}.`;
  return `<div class="integration-note ${run?.status === 'failed' ? 'bad' : ''}">${status}<br/><button class="command-btn" data-action="make-images" ${running ? 'disabled' : ''}>${images.length ? 'Generate another set' : `Generate images with ${html(g.providerLabel || 'AI')}`}</button></div>${grid}`;
}
function integrationSettingsMarkup() {
  const { gemini: ai = {}, google: g = {} } = integ();
  const dot = (on) => `<span class="live-dot ${on ? 'on' : ''}"></span>`;
  return `<form id="integrationsForm">
  <div class="settings-section"><h3>Image generation · ${html(ai.providerLabel || 'AI images')}</h3><p>Generates a set of on-brand graphics from each draft and attaches them to the task. OpenAI GPT Image is the default: Anthropic's Claude models cannot create images. Images are billed per image by the provider; high quality costs roughly four times medium.</p>
   <div class="status-line">${dot(ai.configured)}${ai.configured ? `${html(ai.providerLabel)} key ready · model ${html(ai.model)}${ai.provider === 'openai' ? ` · ${html(ai.quality)} quality` : ''}` : `Needs ${ai.provider === 'google' ? 'a Google (Gemini)' : 'an OpenAI'} key: add it under AI models & API keys above`}</div>
   <div class="settings-field"><label>IMAGE PROVIDER</label><select name="image_provider">${(ai.providers || []).map((p) => `<option value="${html(p.id)}" ${p.id === ai.provider ? 'selected' : ''}>${html(p.label)}${p.id === 'openai' ? ' (recommended)' : ''}${p.keyReady ? '' : ' · no key yet'}</option>`).join('')}</select><span class="field-hint">Changing the provider and pressing Save switches the model list below.</span></div>
   <div class="settings-field" hidden><label>GEMINI API KEY</label><input type="password" autocomplete="off" name="gemini_api_key" placeholder="${ai.configured ? 'Saved. Paste a new key to replace it' : 'Paste the key from aistudio.google.com/apikey'}" /><span class="field-hint">Create one at <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">aistudio.google.com/apikey</a>. Stored only in this studio's local database.</span></div>
   <div class="settings-field"><label>IMAGE MODEL</label><input name="image_model" list="imageModelList" value="${html(ai.model || '')}" placeholder="${ai.provider === 'google' ? 'gemini-3.1-flash-image' : 'gpt-image-2.6-sunburst'}" /><datalist id="imageModelList">${(ai.suggestions || []).map((m) => `<option value="${html(m)}"></option>`).join('')}</datalist><span class="field-hint">${ai.provider === 'google' ? 'A Gemini image model ID.' : 'gpt-image-2.6-sunburst is OpenAI\'s most capable image model; the -flare versions are faster. Leave as is to fall back automatically if your account cannot use it yet.'}</span></div>
   ${ai.provider === 'openai' ? `<div class="settings-field"><label>QUALITY</label><select name="image_quality">${['high', 'medium', 'low'].map((q) => `<option value="${q}" ${q === ai.quality ? 'selected' : ''}>${q[0].toUpperCase() + q.slice(1)}${q === 'high' ? ' (best for published pages)' : q === 'low' ? ' (drafts)' : ''}</option>`).join('')}</select></div>` : ''}
   <div class="settings-field"><label>IMAGES PER PIECE (1 TO ${ai.maxCount || 8})</label><input type="number" name="gemini_image_count" min="1" max="${ai.maxCount || 8}" value="${ai.count || 8}" /><span class="field-hint">The most images one piece gets: a hero plus one per main section of the draft.</span></div>
   <div class="settings-field"><label>WHAT TO CREATE</label><select name="image_style">${(ai.styles || []).map((x) => `<option value="${html(x.id)}" ${x.id === ai.style ? 'selected' : ''}>${html(x.label)}${x.id === 'auto' ? ' (recommended)' : ''}</option>`).join('')}</select><span class="field-hint">Photos and graphics where they fit: the graphics plan picks a realistic photo of the people involved for most sections, and an infographic or diagram only where a section explains steps, a comparison or numbers (at most one in three, never the hero).</span></div>
   <div class="settings-field"><label>PHOTO DIRECTION SENT WITH EVERY PHOTO</label><textarea name="image_photo_style" rows="7" class="brand-rules">${html(ai.photoStyle || '')}</textarea><span class="field-hint">How photos should look: real 4K camera, natural light, candid people, healthcare sensitivity, nothing that looks AI-made.</span></div>
   <label class="check-line"><input type="checkbox" name="gemini_image_text" ${ai.text ? 'checked' : ''} /><span>Allow short labels inside infographics and diagrams (never in photos). On by default with OpenAI, which spells reliably; text-free graphics leave space for a designer to add headlines.</span></label>
   <div class="settings-field"><label>BRAND SYSTEM FOR INFOGRAPHICS AND DIAGRAMS</label><textarea name="image_brand_system" rows="7" class="brand-rules">${html(ai.brandSystem || '')}</textarea><span class="field-hint">Carried over from the MP FRESH graphics workflow in n8n.</span></div>
   <label class="check-line"><input type="checkbox" name="gemini_auto" ${ai.auto !== false ? 'checked' : ''} /><span>Generate images automatically whenever a graphics plan is written</span></label>
   <div class="settings-actions"><button type="button" class="button ghost" id="geminiTest" ${ai.configured ? '' : 'disabled'}>Test key</button><button type="submit" class="button primary">Save</button></div>
  </div>
  ${g.available === false ? '' : `<div class="settings-section"><h3>Review links · Google Docs</h3><p>Creates a Google Doc in your own Drive for every draft and keeps the same link up to date as the draft is revised.</p>
   <div class="status-line">${dot(g.connected)}${g.connected ? `Connected${g.email ? ' as ' + html(g.email) : ''}` : g.clientConfigured ? 'Client saved. Not connected yet' : 'Not set up'}</div>
   ${g.connected ? '' : `<ol><li>Create a project at <a href="https://console.cloud.google.com/projectcreate" target="_blank" rel="noopener noreferrer">console.cloud.google.com/projectcreate</a>.</li><li><a href="https://console.cloud.google.com/apis/enableflow;apiid=drive.googleapis.com" target="_blank" rel="noopener noreferrer">Enable the Google Drive API</a> for it.</li><li>Open <a href="https://console.developers.google.com/auth/branding" target="_blank" rel="noopener noreferrer">Google Auth platform</a>, click Get started, name the app MAIOS. For Audience choose <strong>Internal</strong> if you use Google Workspace. Otherwise choose External and then press <strong>Publish app</strong> on the Audience page, or the sign-in expires every 7 days.</li><li>Under <a href="https://console.developers.google.com/auth/clients" target="_blank" rel="noopener noreferrer">Clients</a>, click Create client, choose <strong>Desktop app</strong>, and copy the client ID and secret into the boxes below.</li><li>Press Save, then Connect Google account.</li></ol>`}
   <div class="settings-field"><label>GOOGLE CLIENT ID</label><input name="google_client_id" autocomplete="off" placeholder="${g.clientConfigured ? 'Saved. Paste a new one to replace it' : '1234567890-abc.apps.googleusercontent.com'}" /></div>
   <div class="settings-field"><label>GOOGLE CLIENT SECRET</label><input type="password" autocomplete="off" name="google_client_secret" placeholder="${g.clientConfigured ? 'Saved. Paste a new one to replace it' : 'GOCSPX-...'}" /></div>
   <label class="check-line"><input type="checkbox" name="google_auto" ${g.auto !== false ? 'checked' : ''} /><span>Create or update the Google Doc automatically whenever a draft is saved</span></label>
   <label class="check-line"><input type="checkbox" name="google_share" ${g.share ? 'checked' : ''} /><span>Let anyone with the link comment (otherwise each document stays private until you share it)</span></label>
   <div class="settings-actions">${g.connected ? '<button type="button" class="button ghost" id="googleDisconnect">Disconnect Google</button>' : `<button type="button" class="button ghost" id="googleConnect" ${g.clientConfigured ? '' : 'disabled title="Save the client ID and secret first"'}>Connect Google account</button>`}<button type="submit" class="button primary">Save</button></div>
  </div>`}</form>`;
}
function aiSettingsMarkup() {
  const ai = state.model.ai || state.data.ai; if (!ai) return '';
  const dot = (on) => `<span class="live-dot ${on ? 'on' : ''}"></span>`;
  const sel = ai.providers.some((p) => p.id === state.aiProvider) ? state.aiProvider : (ai.providers.find((p) => !p.configured) || ai.providers[0]).id;
  const p = ai.providers.find((x) => x.id === sel);
  const source = (x) => x.source === 'saved' ? `key saved ····${html(x.last4)}` : x.source === 'environment' ? 'using the key from the Vercel project environment' : 'no key yet';
  const keyed = (provider) => provider === 'lmstudio' || ai.providers.find((x) => x.id === provider)?.configured;
  const providerName = (id) => ai.providers.find((x) => x.id === id)?.label || (id === 'lmstudio' ? 'Local' : id);
  const stageSelect = (stage) => {
    const current = ai.stages[stage], known = ai.models.some((m) => m.id === current);
    const groups = [...new Set(ai.models.map((m) => m.provider))].map((prov) => `<optgroup label="${html(providerName(prov))}${keyed(prov) ? '' : ' (add a key first)'}">${ai.models.filter((m) => m.provider === prov).map((m) => `<option value="${html(m.id)}" ${m.id === current ? 'selected' : ''}>${html(m.label)} · ${html(m.price)}${m.id === ai.defaults[stage] ? ' · recommended' : ''}</option>`).join('')}</optgroup>`).join('');
    return `<div class="settings-field"><label>${html(STAGE_LABEL[stage].toUpperCase())}</label><select class="stage-model" name="${stage}">${groups}${known ? '' : `<option value="${html(current)}" selected>${html(current)} (custom)</option>`}<option value="__custom">Other model ID…</option></select>${keyed(current.split(':')[0]) ? '' : `<span class="field-hint bad-hint">No ${html(providerName(current.split(':')[0]))} key yet, so this stage cannot run.</span>`}</div>`;
  };
  return `<div class="settings-section" id="aiSection"><h3>AI models &amp; API keys</h3><p>Every generation goes to the model chosen for its stage below${HOSTED ? ', running on MAIOS servers, not this computer' : ''}. Pick a provider, paste its API key once, and it is stored encrypted on the server and reused for every run. The key is never shown again, only its last 4 characters.</p>
   <div class="provider-status">${ai.providers.map((x) => `<div class="status-line">${dot(x.configured)}<strong>${html(x.label)}</strong>&nbsp;· ${source(x)}</div>`).join('')}</div>
   <form id="aiKeyForm" autocomplete="off">
    <div class="settings-field"><label>PROVIDER</label><select name="provider" id="aiProvider">${ai.providers.map((x) => `<option value="${html(x.id)}" ${x.id === sel ? 'selected' : ''}>${html(x.label)}${x.configured ? ' · ready' : ''}</option>`).join('')}</select></div>
    <div class="settings-field"><label>${html(p.label.toUpperCase())} API KEY</label><input type="password" name="key" autocomplete="new-password" spellcheck="false" placeholder="${p.source === 'saved' ? 'Saved. Paste a new key to replace it' : html(p.keyHint)}" /><span class="field-hint">Create one at <a href="${html(p.docs)}" target="_blank" rel="noopener noreferrer">${html(p.docs.replace(/^https?:\/\//, ''))}</a>. Encrypted with AES-256 before it is stored${p.source === 'environment' ? '; a saved key takes priority over the environment key' : ''}.</span></div>
    <div class="settings-actions">${p.source === 'saved' ? '<button type="button" class="button ghost" id="aiKeyRemove">Remove key</button>' : ''}<button type="button" class="button ghost" id="aiKeyTest" ${p.configured ? '' : 'disabled'}>Test key</button><button type="submit" class="button primary">Save key</button></div>
   </form>
   <form id="aiModelsForm"><h3 style="margin-top:18px">Model for each stage</h3><p>Prices are per million input / output tokens. A typical 1,500-word page through all four stages costs a few cents on the recommended models.</p>
    ${STAGES.map(stageSelect).join('')}
    <div class="settings-actions"><button type="button" class="button ghost" id="aiModelsReset">Use recommended</button><button type="submit" class="button primary">Save models</button></div>
   </form></div>`;
}
function searchConsoleMarkup() {
  const g = { ...(state.data.searchConsole || {}), ...(state.gsc || {}) };
  if (!state.data.searchConsole && !state.gsc) return '';
  const dot = (on) => `<span class="live-dot ${on ? 'on' : ''}"></span>`;
  const sites = g.sites?.length ? g.sites : (g.site ? [g.site] : []);
  const link = (href, text) => `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`;
  return `<div class="settings-section" id="gscSection"><h3>Search Console · free keyword data for briefs</h3><p>Each brief gets the searches the page already appears for, with clicks and positions, and the searches on its topic across the site, straight from Google. No Semrush units needed. Read-only, through a Google service account.</p>
   <div class="status-line">${dot(g.configured && g.site)}${g.configured ? `Connected as ${html(g.email)}${g.site ? ` · ${html(g.site)}` : ' · pick a property below'}` : 'Not connected'}</div>
   ${g.hint ? `<p class="field-hint bad-hint">${html(g.hint)}</p>` : ''}
   ${g.configured ? '' : `<ol><li>${link('https://console.cloud.google.com/apis/library/searchconsole.googleapis.com', 'Enable the Google Search Console API')} in a Google Cloud project (create one if asked).</li><li>Open ${link('https://console.cloud.google.com/iam-admin/serviceaccounts', 'Service accounts')}, click <strong>Create service account</strong> (name it maios-search-console, skip the roles), open it, then <strong>Keys &gt; Add key &gt; Create new key &gt; JSON</strong>. A .json file downloads.</li><li>In ${link('https://search.google.com/search-console/users', 'Search Console &gt; Settings &gt; Users and permissions')}, click <strong>Add user</strong>, paste the service account's email (it ends in iam.gserviceaccount.com) and choose <strong>Restricted</strong>.</li><li>Open the .json file in a text editor, copy all of it, paste it below and press Save key.</li></ol>`}
   <form id="gscKeyForm" autocomplete="off"><div class="settings-field"><label>SERVICE ACCOUNT JSON KEY</label><textarea name="key" rows="4" spellcheck="false" class="brand-rules" placeholder="${g.configured ? 'Saved. Paste a new key file to replace it' : 'Paste the whole JSON key file'}"></textarea><span class="field-hint">Checked with Google, then encrypted before it is stored. It is never shown again.</span></div>
    <div class="settings-actions">${g.source === 'saved' ? '<button type="button" class="button ghost" id="gscRemove">Disconnect</button>' : ''}<button type="button" class="button ghost" id="gscTest" ${g.configured ? '' : 'disabled'}>Test</button><button type="submit" class="button primary">Save key</button></div></form>
   ${g.configured && sites.length ? `<form id="gscSiteForm"><div class="settings-field"><label>PROPERTY</label><select name="site">${sites.map((s) => `<option value="${html(s)}" ${s === g.site ? 'selected' : ''}>${html(s)}</option>`).join('')}</select></div><div class="settings-actions"><button type="submit" class="button primary">Use this property</button></div></form>` : ''}
  </div>`;
}
function passcodeMarkup() {
  if (!HOSTED) return '';
  const a = state.auth || {}, dot = (on) => `<span class="live-dot ${on ? 'on' : ''}"></span>`;
  return `<div class="settings-section"><h3>Studio passcode</h3><p>Everyone opening the studio needs this passcode once per browser (sessions last 90 days).</p>
   <div class="status-line">${dot(a.passcodeSet)}${a.passcodeSet ? 'Passcode set' : 'No passcode configured'}${a.signedIn ? ' · this browser is signed in' : ''}</div>
   <form id="passcodeForm" autocomplete="off"><div class="settings-field"><label>${a.passcodeSet ? 'NEW PASSCODE' : 'PASSCODE'}</label><input type="password" name="passcode" minlength="8" autocomplete="new-password" placeholder="At least 8 characters" /><span class="field-hint">Share it with the team. Changing it signs every browser out.</span></div>
   <div class="settings-actions">${a.signedIn ? '<button type="button" class="button ghost" id="signOut">Sign out</button>' : ''}<button type="submit" class="button primary">${a.passcodeSet ? 'Change passcode' : 'Set passcode'}</button></div></form></div>`;
}
function renderDrawerTab(t) {
  if (state.taskTab === 'knowledge') return '<div id="taskKnowledgeArea"></div>';
  if (state.taskTab === 'overview') return `<form id="taskEditForm"><div class="detail-grid">${field('title', 'Content title', t.title, 'text', true)}${field('priority', 'Priority', t.priority, 'select_priority')}${field('voice', 'Voice', t.voice, 'select_voice')}${field('owner', 'Owner', t.owner)}${field('reviewer', 'Reviewer', t.reviewer)}${field('due_date', 'Due date', t.due_date || '', 'date')}${field('primary_keyword', 'Primary keyword', t.primary_keyword)}${field('topic', 'Core topic', t.topic, 'text', true)}${field('objective', 'Business objective', t.objective, 'textarea', true)}${field('audience', 'Target audience / ICP', t.audience, 'textarea', true)}${field('secondary_keywords', 'Secondary keywords (comma separated)', t.secondary_keywords.join(', '), 'text', true)}${field('word_count', 'Target word count', t.word_count, 'number')}${field('graphics_count', 'Graphics requested', t.graphics_count, 'number')}${field('cta', 'CTA / destination', t.cta, 'text', true)}${field('source_urls', 'Reference URLs (one per line)', t.source_urls.join('\n'), 'textarea', true)}${field('instructions', 'Additional writer / designer instructions', t.instructions, 'textarea', true)}</div><div style="margin-top:14px"><button type="submit" class="button primary">Save commission details</button></div></form>`;
  if (state.taskTab === 'artifact') {
    const kind = state.artifactTab, { versions, artifact: a } = currentArtifact(t);
    if (!a) return `<div class="artifact-card"><div class="artifact-empty"><strong>No ${html(prettyKind[kind])} yet.</strong><br/>Use the production controls above to generate it with the AI model chosen for this stage, or start with a manually written version.<br/><button class="command-btn" style="margin-top:15px" id="manualArtifact">+ Write manually</button></div></div>${kind === 'graphics' ? imagePanel(t) : ''}`;
    const latest = a.version === versions[0].version;
    const picker = versions.length > 1 ? `<select id="artifactVersion" class="version-pick" aria-label="Version">${versions.map((v) => `<option value="${v.version}" ${v.version === a.version ? 'selected' : ''}>v${v.version}${v === versions[0] ? ' (latest)' : ''}</option>`).join('')}</select>` : `v${a.version}`;
    const body = state.editingArtifact
      ? `<form id="artifactEditForm"><textarea name="body" class="artifact-edit" spellcheck="true">${html(a.body)}</textarea><div class="edit-bar"><button class="button primary" type="submit">Save as new version</button><span id="editCount" class="muted">${num(countWords(a.body))} words · ${num(a.body.length)} characters</span></div></form>`
      : state.rawView ? `<pre class="artifact-body">${html(a.body)}</pre>` : `<div class="md artifact-body">${renderMarkdown(a.body)}</div>`;
    const extra = kind === 'draft' && !state.editingArtifact ? `<div class="artifact-foot"><span>Not happy with this direction?</span><button class="mini-link" data-generate="draft" data-fresh="1">Rewrite from scratch, ignoring this draft</button></div>` : '';
    return `<div class="artifact-card"><div class="artifact-toolbar"><span>${html(prettyKind[kind])} · ${picker} · ${html(a.model === 'manual' ? 'Written by hand' : a.model || 'Manual')} · ${html(stampFmt(a.created_at))} · ${num(countWords(a.body))} words</span><div class="tools"><button class="mini-link" id="toggleRaw">${state.rawView ? 'Formatted' : 'Markdown'}</button><button class="mini-link" id="copyArtifact">Copy</button><button class="mini-link" id="downloadArtifact">Download</button><button class="mini-link" id="editArtifact">${state.editingArtifact ? 'Cancel edit' : latest ? 'Edit' : 'Restore as new version'}</button></div></div>${!latest && !state.editingArtifact ? `<div class="version-note">You are viewing an older version. Approval and QA always use the latest (v${versions[0].version}).</div>` : ''}${body}${extra}</div>${state.editingArtifact ? '' : docPanel(t, kind, versions[0].version)}${kind === 'graphics' && !state.editingArtifact ? imagePanel(t) : ''}`;
  }
  if (state.taskTab === 'files') return `<div class="approval-note">Attach approved graphics and source assets. Supported: PNG, JPG, WEBP and PDF, up to ${HOSTED ? 3 : 5} MB each. The graphics plan stage writes directions; Gemini image generation (Graphics tab) makes the image files.</div><div style="margin:15px 0"><input type="file" id="assetInput" accept="image/png,image/jpeg,image/webp,application/pdf" /></div>${t.assets.map((a) => `<div class="file-row">${a.mime.startsWith('image/') ? `<img data-asset-preview="${html(a.id)}" alt="${html(a.name)}" />` : '<span>PDF</span>'}<span>${html(a.name)}<br/><small class="muted">${Math.round(a.size / 1024)} KB</small></span><button class="mini-link" data-view-asset="${html(a.id)}">View ↗</button></div>`).join('')}`;
  if (state.taskTab === 'activity') return `<div><h4>Reviewer comments</h4><p class="muted small">Comments posted after the latest draft are sent to the model as requirements the next time the draft is revised.</p>${t.comments.map((c) => `<div class="comment"><strong>${html(c.author)}</strong><time>${html(stampFmt(c.created_at))}</time><p>${html(c.body)}</p></div>`).join('') || '<p class="muted small">No reviewer comments yet.</p>'}<form id="commentForm"><textarea name="text" placeholder="Write specific feedback or a revision request..." class="artifact-edit comment-box" required></textarea><div class="edit-bar"><button class="button primary" type="submit">Post comment</button><label class="inline-check"><input type="checkbox" name="revise" ${t.artifacts.some((a) => a.kind === 'draft') ? '' : 'disabled'} /> and revise the draft now</label></div></form><h4 style="margin-top:25px">Task history</h4>${t.events.map((e) => `<div class="timeline-item"><div class="timeline-dot ${html(e.event_type)}"></div><div class="timeline-content"><strong>${html(e.message)}</strong>${e.details?.error ? `<span class="job-error">${html(e.details.error)}</span>` : ''}<small>${html(e.actor)} · ${html(stampFmt(e.created_at))}</small></div></div>`).join('')}</div>`;
  return '';
}

// ---------- Modals ----------
function modalClose() { $('#commissionBackdrop').hidden = true; $('#commissionModal').hidden = true; }
function commissionModal(preferredLane, requestedPlaybook) {
  const selectedOutput = preferredLane ? (preferredLane.startsWith('social') ? 'linkedin' : 'website') : state.board === 'mpfresh' ? 'website' : 'linkedin';
  $('#commissionBackdrop').hidden = false; $('#commissionModal').hidden = false;
  $('#commissionModal').innerHTML = `<div class="modal-header"><div><div class="eyebrow">NEW PRODUCTION ORDER</div><h2>Commission content</h2><p>One idea, multiple deliverables, independently reviewed and shipped.</p></div><button class="icon-btn" id="closeCommission" aria-label="Close">✕</button></div>
 <form id="commissionForm"><div class="modal-content"><div class="modal-form">
 ${kbUi.commissionedSelect()}
 <div class="modal-field full"><label>TOPIC OR WORKING HEADLINE *</label><input name="topic" required minlength="5" maxlength="220" placeholder="e.g. Why owned AI infrastructure changes the economics of marketing" autofocus /></div>
 <div class="modal-field"><label>CONTENT VOICE</label><select name="voice"><option value="company">Marketing Powered company</option><option value="founder">Founder / executive thought leadership</option></select></div>
 <div class="modal-field"><label>WEBSITE FORMAT</label><select name="content_type"><option value="article">Authority article</option><option value="guide">Resource guide</option><option value="landing">Landing / service page</option></select></div>
 <div class="modal-field full"><label>CHANNELS / DELIVERABLES *</label><div class="channel-grid">${[['website', 'Website'], ['linkedin', 'LinkedIn'], ['facebook', 'Facebook'], ['instagram', 'Instagram'], ['gbp', 'Google Profile'], ['x', 'X / Twitter']].map(([v, label]) => `<label class="channel-option"><input type="checkbox" name="outputs" value="${v}" ${v === selectedOutput ? 'checked' : ''}/>${label}</label>`).join('')}</div></div>
 <div class="modal-field full"><label>BUSINESS OBJECTIVE</label><textarea name="objective" placeholder="What should the content establish, explain, or convert?">Build authority and qualified demand.</textarea></div>
 <div class="modal-field full"><label>TARGET AUDIENCE</label><input name="audience" placeholder="CMOs, CEOs, hospital operators, healthcare executives" value="Marketing decision makers and business operators" /></div>
 <div class="modal-field"><label>PRIMARY KEYWORD</label><input name="primary_keyword" placeholder="e.g. data sovereignty" /></div>
 <div class="modal-field"><label>SECONDARY KEYWORDS</label><input name="secondary_keywords" placeholder="comma-separated" /></div>
 <div class="modal-field"><label>PRIORITY</label><select name="priority"><option value="P2">P2 · Normal</option><option value="P1">P1 · High</option><option value="P0">P0 · Critical</option><option value="P3">P3 · Low</option><option value="P4">P4</option><option value="P5">P5</option><option value="P6">P6</option><option value="BP0">BP0 · Blog critical</option><option value="BP1">BP1 · Blog high</option><option value="BP2">BP2 · Blog normal</option><option value="BP3">BP3 · Blog low</option></select></div>
 <div class="modal-field"><label>ASSIGNEE</label><select name="owner"><option>Emily</option><option>Rimsha</option><option>Mike</option><option>Jason</option><option>Unassigned</option></select></div>
 <div class="modal-field"><label>TARGET WEBSITE WORD COUNT</label><input type="number" name="word_count" value="1500" min="100" max="6000" /></div>
 <div class="modal-field"><label>GRAPHICS PER DELIVERABLE</label><input type="number" name="graphics_count" value="3" min="0" max="10" /></div>
 <div class="modal-field"><label>REVIEWER</label><select name="reviewer"><option>Mike</option><option>Emily</option><option>Susmita</option></select></div>
 <div class="modal-field"><label>DUE DATE</label><input type="date" name="due_date" /></div>
 <div class="modal-field full"><label>CTA / DESTINATION</label><input name="cta" placeholder="e.g. Read the guide, request an audit, visit /cards/" /></div>
 <div class="modal-field full"><label>REFERENCE URLS</label><textarea name="source_urls" rows="2" placeholder="One source URL per line. They are references, not automatically crawled."></textarea></div>
 <div class="modal-field full"><label>ADDITIONAL INSTRUCTIONS</label><textarea name="instructions" rows="3" placeholder="Specific evidence, visual direction, claims to avoid, tone, internal links, etc."></textarea></div>
 </div><div class="modal-side"><div class="eyebrow">THE PRODUCTION MODEL</div><h3>Built like MP FRESH.</h3><p>Each selected output becomes a separate content card, linked under one campaign ID. Website content enters MP FRESH; social derivatives enter the Social Media board.</p><div class="process-mini">${[['01', 'Commission'], ['02', 'Research & editorial brief'], ['03', 'Model-assisted writing'], ['04', 'Graphics directions & assets'], ['05', 'QA & human approval'], ['06', 'Development / publishing handoff']].map(([n, label]) => `<div class="process-step"><span>${n}</span>${label}</div>`).join('')}</div>
 <label class="autopilot-opt"><input type="checkbox" name="autostart" /><span><strong>Start autopilot immediately</strong>Brief, draft, graphics plan and QA run back to back on the models chosen in Settings, then every deliverable waits in its approval lane for a person.</span></label>
 <p style="margin-top:14px">Generation uses the AI model chosen for each stage in Settings. Publishing never happens automatically.</p></div></div>
 <div class="modal-footer"><span>Nothing is published without approval.</span><div><button type="button" class="button ghost" id="cancelCommission">Cancel</button><button type="submit" class="button primary">＋ Create production order</button></div></div></form>`;
  if (requestedPlaybook) kbUi.applyPlaybook(requestedPlaybook);
}
function settingsModal(open) {
  if (gateOpen) return; // the passcode screen uses the same modal and cannot be dismissed
  $('#settingsBackdrop').hidden = !open; $('#settingsModal').hidden = !open;
  if (!open) return;
  const settingsTop = $('#settingsModal').scrollTop;
  $('#settingsModal').innerHTML = `<div style="display:flex;align-items:start;justify-content:space-between"><div><div class="eyebrow">${HOSTED ? 'CONTENT STUDIO IN MAIOS' : 'SYSTEM CONNECTION'}</div><h2>Workspace settings</h2><p>${HOSTED ? 'Runs inside MAIOS: the board, knowledge base and files are stored in private Vercel storage, and generation uses the cloud models below. Nothing runs on this computer.' : 'This studio runs on your own computer. Generation still uses the cloud models chosen below unless a stage is set to LM Studio.'}</p></div><button class="icon-btn" id="settingsClose">✕</button></div>
 <form id="settingsForm"><div class="settings-field"><label>YOUR NAME</label><input name="actor" value="${html(actor())}" maxlength="80" placeholder="Shown on comments, approvals and history" /><span class="field-hint">Recorded as the actor on everything you do from this browser.</span></div>
 ${HOSTED ? '' : `<div class="settings-field"><label>BACKEND API URL</label><input name="url" value="${html(baseUrl())}" placeholder="Local: leave empty. Remote: https://api.example.com" /><span class="field-hint">Leave empty when the UI and backend run together locally.</span></div>
 <div class="settings-field"><label>BACKEND ACCESS TOKEN</label><input type="password" autocomplete="off" name="token" value="${html(token())}" placeholder="Required for publicly exposed backend" /><span class="field-hint">Held in this tab's session storage, not embedded in the site.</span></div>`}
 <div class="settings-actions"><button type="button" class="button ghost" id="settingsCancel">Cancel</button><button type="submit" class="button primary">${HOSTED ? 'Save' : 'Save & connect'}</button></div></form>
 ${aiSettingsMarkup()}${searchConsoleMarkup()}${passcodeMarkup()}${integrationSettingsMarkup()}<div class="settings-help">${HOSTED ? '<strong>How it runs:</strong> generations run on MAIOS servers and keep going if you close this tab. A scheduled check every 5 minutes picks up anything left in the queue.' : '<strong>Local model (optional):</strong> to use LM Studio for a stage, load an instruct model, enable its Local Server and pick "LM Studio (local model)" for that stage above.'}<br/><br/><strong>Current state:</strong> ${html(state.model.connected ? 'Ready. Writer model: ' + modelLabel(state.model.ai?.stages?.draft) : 'A stage is set to a provider with no API key')} · studio v${html(state.data.version || '')}.<br/><br/><button class="command-btn" id="clearDemo">Remove sample tasks</button></div><div class="brand-settings"><div class="eyebrow" style="margin-top:25px">CONTENT INTELLIGENCE</div><h3 style="font-size:14px;margin-bottom:3px">Voice and QA profiles</h3><p>Editable operating rules injected into the model prompt for every job. Based on Marketing Powered's historical content standards.</p><form id="brandForm">${[['company', 'Company voice'], ['founder', 'Founder voice'], ['visual', 'Visual creative'], ['qa', 'Quality assurance']].map(([key, label]) => `<div class="settings-field"><label>${label}</label><textarea data-brand-key="${key}" name="${key}" rows="5" class="brand-rules" placeholder="Loading rules..."></textarea></div>`).join('')}<button class="button primary" type="submit">Save profiles</button></form></div>`;
  $('#settingsModal').scrollTop = settingsTop;
  api('/api/brand').then((x) => { for (const [key, value] of Object.entries(x)) { const el = $(`[data-brand-key="${key}"]`, $('#settingsModal')); if (el) el.value = value; } }).catch(() => { });
}

// ---------- Actions ----------
async function changeTaskStage(id, laneId) {
  try {
    const out = await api('/api/tasks/' + id + '/move', { method: 'POST', body: { laneId } });
    toast('Moved to ' + (laneName(laneId) || 'stage') + (out.autoQueued ? ' · ' + out.autoQueued.kind + ' queued' : ''));
    await refresh(false); if (state.selected === id) await openTask(id, true);
  } catch (e) { toast(e.message, 'error'); await refresh(false); }
}
async function taskAction(path, body, message) {
  const id = state.selected;
  try {
    const res = await api('/api/tasks/' + id + '/' + path, { method: 'POST', body });
    toast(message || 'Saved');
    await refresh(false); if (state.selected === id) await openTask(id, true);
    return res;
  } catch (e) { toast(e.message, 'error'); return null; }
}
async function jobAction(id, action) {
  try { await api(`/api/jobs/${id}/${action}`, { method: 'POST', body: {} }); toast(action === 'cancel' ? 'Stopping…' : 'Queued again'); await refresh(false); if (state.selected) await openTask(state.selected, true); }
  catch (e) { toast(e.message, 'error'); }
}
async function onTaskSave(form) {
  const t = state.selectedTask, body = Object.fromEntries(new FormData(form).entries());
  body.secondary_keywords = String(body.secondary_keywords || '').split(',').map((x) => x.trim()).filter(Boolean);
  body.source_urls = String(body.source_urls || '').split('\n').map((x) => x.trim()).filter(Boolean);
  body.word_count = Number(body.word_count); body.graphics_count = Number(body.graphics_count);
  try { await api('/api/tasks/' + t.id, { method: 'PATCH', body }); toast('Commission details saved.'); await refresh(false); await openTask(t.id, true); } catch (e) { toast(e.message, 'error'); }
}
function handleAssetUpload(input) {
  const file = input.files?.[0]; if (!file) return;
  const maxMb = HOSTED ? 3 : 5;
  if (file.size > maxMb * 1024 * 1024) return toast(`Maximum attachment size is ${maxMb} MB.`, 'error');
  const id = state.selected, reader = new FileReader();
  reader.onload = async () => { try { await api(`/api/tasks/${id}/asset`, { method: 'POST', body: { name: file.name, mime: file.type, data: String(reader.result).split(',')[1] } }); toast('Asset attached.'); await openTask(id, true); } catch (e) { toast(e.message, 'error'); } };
  reader.readAsDataURL(file);
}
function download(name, text, type = 'text/markdown') {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}
const slug = (s) => String(s || 'content').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'content';
function goBoard(boardId) { if (boardId) { state.board = boardId; store.set('maios_board', boardId); } state.view = 'board'; render(); }

function installListeners() {
  $('#commissionBtn').addEventListener('click', () => state.view === 'knowledge' ? kbUi.openKnowledge(null) : commissionModal());
  $('#refreshBtn').addEventListener('click', () => { refresh(true, true); refreshModel(); });
  $('#settingsBtn').addEventListener('click', () => settingsModal(true)); $('#settingsTopBtn').addEventListener('click', () => settingsModal(true));
  $('#howItWorks').addEventListener('click', () => { state.view = 'instructions'; render(); });
  $('#taskSearch').addEventListener('input', (e) => { state.search = e.target.value; renderMain(); });
  $('#priorityFilter').addEventListener('change', (e) => { state.priority = e.target.value; renderMain(); });
  $('#demoToggle').addEventListener('click', () => { state.showDemo = !state.showDemo; $('#demoToggle').classList.toggle('active', state.showDemo); $('#demoToggle').textContent = state.showDemo ? '◉ Samples' : '○ Samples'; render(); });
  $('#tabBoard').addEventListener('click', () => { state.layout = 'board'; state.view = 'board'; render(); });
  $('#tabList').addEventListener('click', () => { state.layout = 'list'; state.view = 'board'; render(); });
  $('#exportBtn').addEventListener('click', async () => { try { download(`maios-content-export-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(await api('/api/export'), null, 2), 'application/json'); toast('Data export downloaded.'); } catch (e) { toast(e.message, 'error'); } });
  $('#drawerBackdrop').addEventListener('click', closeDrawer); $('#commissionBackdrop').addEventListener('click', modalClose); $('#settingsBackdrop').addEventListener('click', () => settingsModal(false));
  window.addEventListener('hashchange', () => { if (location.hash.startsWith('#task=')) openTask(location.hash.slice(6)); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { if (!$('#settingsModal').hidden) return settingsModal(false); if (!$('#commissionModal').hidden) return modalClose(); if (!$('#knowledgeDrawer').hidden) return; closeDrawer(); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); goBoard(); $('#taskSearch').focus(); }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList?.contains('task-card')) { e.preventDefault(); openTask(e.target.dataset.taskId); }
  });
  document.addEventListener('click', async (e) => {
    const boardBtn = e.target.closest('[data-board-id]'); if (boardBtn) return goBoard(boardBtn.dataset.boardId);
    const navBtn = e.target.closest('[data-view]'); if (navBtn) { state.view = navBtn.dataset.view; if (state.view === 'knowledge') await kbUi.loadKnowledge(); render(); return; }
    const cancel = e.target.closest('[data-cancel-job]'); if (cancel) return jobAction(cancel.dataset.cancelJob, 'cancel');
    const retry = e.target.closest('[data-retry-job]'); if (retry) return jobAction(retry.dataset.retryJob, 'retry');
    const taskBtn = e.target.closest('[data-task-id]'); if (taskBtn && !taskBtn.closest('#taskDrawer')) return openTask(taskBtn.dataset.taskId);
    const addBtn = e.target.closest('[data-add-lane]'); if (addBtn) return commissionModal(addBtn.dataset.addLane);
    if (e.target.id === 'closeDrawer') return closeDrawer();
    if (['closeCommission', 'cancelCommission'].includes(e.target.id)) return modalClose();
    if (['settingsClose', 'settingsCancel'].includes(e.target.id)) return settingsModal(false);
    if (e.target.closest?.('#workerCard')) return settingsModal(true);
    if (e.target.id === 'authRetry') return location.reload();
    if (e.target.id === 'aiKeyTest') { const provider = $('#aiProvider').value; try { await api('/api/ai/test', { method: 'POST', body: { provider } }); toast('The key works.'); } catch (err) { toast(err.message, 'error'); } return; }
    if (e.target.id === 'aiKeyRemove') { const provider = $('#aiProvider').value; if (!confirm('Remove the saved key for this provider? Stages that use it stop working until a new key is added.')) return; try { state.model.ai = await api('/api/ai', { method: 'PATCH', body: { provider, clear: true } }); await refreshModel(); settingsModal(true); toast('Key removed.'); } catch (err) { toast(err.message, 'error'); } return; }
    if (e.target.id === 'aiModelsReset') { try { state.model.ai = await api('/api/ai', { method: 'PATCH', body: { stages: { ...state.model.ai.defaults } } }); await refreshModel(); settingsModal(true); toast('Recommended models restored.'); } catch (err) { toast(err.message, 'error'); } return; }
    if (e.target.id === 'gscTest') { try { state.gsc = await api('/api/searchconsole/test', { method: 'POST', body: {} }); settingsModal(true); toast(state.gsc.sample ? `Search Console works. Top searches: ${state.gsc.sample.slice(0, 3).join(', ') || 'none yet'}.` : (state.gsc.hint || 'Key works.'), state.gsc.ok ? 'good' : 'error'); } catch (err) { toast(err.message, 'error'); } return; }
    if (e.target.id === 'gscRemove') { if (!confirm('Disconnect Search Console? Briefs will no longer include its data.')) return; try { state.gsc = await api('/api/searchconsole', { method: 'PATCH', body: { clear: true } }); await refresh(false, true); settingsModal(true); toast('Search Console disconnected.'); } catch (err) { toast(err.message, 'error'); } return; }
    if (e.target.id === 'signOut') { try { await api('/api/session', { method: 'DELETE' }); location.reload(); } catch (err) { toast(err.message, 'error'); } return; }
    const tab = e.target.closest('[data-task-tab]'); if (tab) { state.dirty = false; state.taskTab = tab.dataset.taskTab; state.editingArtifact = false; renderDrawer(); return; }
    const atab = e.target.closest('[data-artifact-tab]'); if (atab) { state.dirty = false; state.taskTab = 'artifact'; state.artifactTab = atab.dataset.artifactTab; state.artifactVersion = null; state.editingArtifact = false; renderDrawer(); return; }
    const gen = e.target.closest('[data-generate]');
    if (gen) {
      const kind = gen.dataset.generate, fresh = gen.dataset.fresh === '1';
      if (fresh && !confirm('Write a new draft from scratch? The current draft stays in version history.')) return;
      return taskAction('generate', { kind, fresh }, `${prettyKind[kind]} queued`);
    }
    const action = e.target.closest('[data-action]');
    if (action) {
      const what = action.dataset.action;
      if (what === 'approve') return taskAction('approve', {}, 'Content approved');
      if (what === 'approve-override') { if (!confirm('QA failed on this draft. Approve it anyway and send it to Ship to dev? The override is recorded on the card.')) return; return taskAction('approve', { override: true }, 'Approved anyway. Moving to Ship to dev'); }
      if (what === 'redo-qa') {
        try { await api(`/api/tasks/${state.selected}/revise`, { method: 'POST', body: { note: 'Fix every issue in the latest QA report: verify each flagged claim yourself and cite it inline, or rewrite or cut it; remove all [VERIFY] markers, placeholders and internal notes; keep the page complete.' } }); toast('Redoing the draft with the QA fixes.'); await refresh(false); await openTask(state.selected, true); }
        catch (err) { toast(err.message, 'error'); }
        return;
      }
      if (what === 'pipeline') return taskAction('pipeline', {}, 'Autopilot started. It stops at human approval.');
      if (what === 'campaign-pipeline') { try { const out = await api(`/api/campaigns/${state.selectedTask.campaign_id}/pipeline`, { method: 'POST', body: {} }); toast(`Autopilot started for ${out.jobs.length} deliverables.`); await refresh(false); await openTask(state.selected, true); } catch (err) { toast(err.message, 'error'); } return; }
      if (what === 'comment-jump') { state.taskTab = 'activity'; renderDrawer(); $('#commentForm textarea')?.focus(); return; }
      if (what === 'open-settings') return settingsModal(true);
      if (what === 'revise-open') { state.revising = true; renderDrawer(); $('#reviseNote')?.focus(); return; }
      if (what === 'revise-cancel') { state.revising = false; state.dirty = false; renderDrawer(); return; }
      if (what === 'make-doc') {
        action.disabled = true; const id = state.selected;
        try { const out = await api(`/api/tasks/${id}/doc`, { method: 'POST', body: { kind: state.artifactTab } }); toast(out.created ? 'Google Doc created.' : 'Google Doc updated.'); await refresh(false); if (state.selected === id) await openTask(id, true); }
        catch (err) { toast(err.message, 'error'); action.disabled = false; }
        return;
      }
      if (what === 'make-images') {
        action.disabled = true; const id = state.selected;
        try { const out = await api(`/api/tasks/${id}/images`, { method: 'POST', body: {} }); toast(`Generating ${out.run.total} image${out.run.total > 1 ? 's' : ''}. They appear here as each one finishes.`); if (state.selected === id) await openTask(id, true); }
        catch (err) { toast(err.message, 'error'); action.disabled = false; }
        return;
      }
      if (what === 'archive') { if (confirm('Archive this task? Its artifacts are kept and it can be restored from the database.')) { await taskAction('archive', {}, 'Task archived'); closeDrawer(); } return; }
    }
    const related = e.target.closest('[data-related-id]'); if (related) return openTask(related.dataset.relatedId);
    if (e.target.id === 'savePublication') return taskAction('publish', { url: $('#liveUrl').value.trim() }, 'Publication recorded');
    if (e.target.id === 'copyTaskLink') { await navigator.clipboard?.writeText(`${location.origin}${location.pathname}#task=${state.selected}`); toast('Task link copied.'); return; }
    const viewAsset = e.target.closest('[data-view-asset]');
    if (viewAsset) { try { const id = viewAsset.dataset.viewAsset; let u = assetObjectURLs.get(id); if (!u) { u = URL.createObjectURL(await assetBlob(id)); assetObjectURLs.set(id, u); } window.open(u, '_blank', 'noopener,noreferrer'); } catch (err) { toast(err.message, 'error'); } return; }
    if (e.target.id === 'toggleRaw') { state.rawView = !state.rawView; store.set('maios_raw', state.rawView ? '1' : '0'); renderDrawer(); return; }
    if (e.target.id === 'copyArtifact') { const { artifact } = currentArtifact(); if (artifact) { await navigator.clipboard?.writeText(artifact.body); toast('Copied as Markdown.'); } return; }
    if (e.target.id === 'downloadArtifact') { const { artifact } = currentArtifact(); if (artifact) download(`${slug(state.selectedTask.title)}-${artifact.kind}-v${artifact.version}.md`, artifact.body); return; }
    if (e.target.id === 'editArtifact') { state.editingArtifact = !state.editingArtifact; renderDrawer(); return; }
    if (e.target.id === 'manualArtifact') { state.editingArtifact = true; renderManualArtifact(); return; }
    if (e.target.id === 'copyDocLink') { await navigator.clipboard?.writeText(e.target.dataset.url); toast('Google Doc link copied.'); return; }
    if (e.target.id === 'geminiTest') { try { const out = await api('/api/integrations/gemini/test', { method: 'POST', body: {} }); toast(out.modelAvailable ? `Key works. ${out.model} is available.` : `Key works, but ${out.model} is not in this key's model list. Available image models: ${out.imageModels.join(', ') || 'none'}.`, out.modelAvailable ? 'good' : 'error'); } catch (err) { toast(err.message, 'error'); } return; }
    if (e.target.id === 'googleConnect') { try { const out = await api('/api/google/start', { method: 'POST', body: {} }); location.href = out.url; } catch (err) { toast(err.message, 'error'); } return; }
    if (e.target.id === 'googleDisconnect') { if (!confirm('Disconnect Google? Existing documents stay in your Drive; new drafts stop getting links.')) return; try { await api('/api/google/disconnect', { method: 'POST', body: {} }); await refresh(false, true); settingsModal(true); toast('Google disconnected.'); } catch (err) { toast(err.message, 'error'); } return; }
    if (e.target.id === 'clearDemo') { if (!confirm('Remove all example cards? Commissioned and imported cards will remain.')) return; try { const out = await api('/api/demo/clear', { method: 'POST', body: {} }); toast(`${out.removed} example cards removed.`); settingsModal(false); await refresh(); } catch (err) { toast(err.message, 'error'); } return; }
  });
  document.addEventListener('submit', async (e) => {
    if (e.target.id === 'commissionForm') {
      e.preventDefault(); const fd = new FormData(e.target);
      const payload = Object.fromEntries([...fd.entries()].filter(([k]) => !['outputs', 'autostart'].includes(k)));
      payload.outputs = fd.getAll('outputs'); payload.autostart = fd.has('autostart');
      payload.secondary_keywords = String(fd.get('secondary_keywords') || '').split(',').map((s) => s.trim()).filter(Boolean);
      payload.source_urls = String(fd.get('source_urls') || '').split('\n').map((s) => s.trim()).filter(Boolean);
      payload.word_count = Number(fd.get('word_count')); payload.graphics_count = Number(fd.get('graphics_count'));
      try {
        const out = await api('/api/commission', { method: 'POST', body: payload }); modalClose();
        toast(`Created ${out.tasks.length} deliverable${out.tasks.length > 1 ? 's' : ''}${out.autoQueued ? ' · autopilot started' : ''}.`);
        await refresh(false);
        const first = out.tasks.find((t) => t.board_id === state.board) || out.tasks[0];
        goBoard(first.board_id); await openTask(first.id);
      } catch (err) { toast(err.message, 'error'); }
      return;
    }
    if (e.target.id === 'taskEditForm') { e.preventDefault(); await onTaskSave(e.target); return; }
    if (e.target.id === 'artifactEditForm') {
      e.preventDefault(); const text = String(new FormData(e.target).get('body') || ''), id = state.selected;
      try { await api(`/api/tasks/${id}/artifact`, { method: 'POST', body: { kind: state.artifactTab, body: text } }); state.editingArtifact = false; state.artifactVersion = null; toast(state.artifactTab === 'draft' ? 'New draft version saved. Rerun QA before approval.' : 'New version saved.'); await refresh(false); await openTask(id, true); } catch (err) { toast(err.message, 'error'); }
      return;
    }
    if (e.target.id === 'commentForm') {
      e.preventDefault(); const fd = new FormData(e.target), id = state.selected;
      try {
        await api(`/api/tasks/${id}/comment`, { method: 'POST', body: { text: String(fd.get('text') || ''), author: actor() } });
        if (fd.has('revise')) { await api(`/api/tasks/${id}/generate`, { method: 'POST', body: { kind: 'draft' } }); toast('Comment posted. Revising the draft with your feedback.'); } else toast('Comment added.');
        await refresh(false); await openTask(id, true);
      } catch (err) { toast(err.message, 'error'); }
      return;
    }
    if (e.target.id === 'reviseForm') {
      e.preventDefault(); const id = state.selected, note = String(new FormData(e.target).get('note') || '').trim();
      try { await api(`/api/tasks/${id}/revise`, { method: 'POST', body: { note } }); state.revising = false; state.dirty = false; toast('Sent back for revision. A new draft is being written.'); await refresh(false); if (state.selected === id) await openTask(id, true); }
      catch (err) { toast(err.message, 'error'); }
      return;
    }
    if (e.target.id === 'integrationsForm') {
      e.preventDefault(); const fd = new FormData(e.target);
      const providerChanged = fd.get('image_provider') !== integ().gemini?.provider;
      const body = { gemini_api_key: fd.get('gemini_api_key'), image_provider: fd.get('image_provider') || undefined, ...(providerChanged ? {} : { image_model: fd.get('image_model') ?? undefined, image_quality: fd.get('image_quality') ?? undefined }), gemini_auto: fd.has('gemini_auto'), gemini_image_count: Number(fd.get('gemini_image_count')), gemini_image_text: fd.has('gemini_image_text'), image_brand_system: fd.get('image_brand_system'), image_style: fd.get('image_style') ?? undefined, image_photo_style: fd.get('image_photo_style') ?? undefined, google_client_id: fd.get('google_client_id'), google_client_secret: fd.get('google_client_secret'), google_auto: fd.has('google_auto'), google_share: fd.has('google_share') };
      try { await api('/api/integrations', { method: 'PATCH', body }); await refresh(false, true); settingsModal(true); toast('Integration settings saved.'); } catch (err) { toast(err.message, 'error'); }
      return;
    }
    if (e.target.id === 'signInForm') {
      e.preventDefault();
      try { state.auth = await api('/api/session', { method: 'POST', body: { passcode: String(new FormData(e.target).get('passcode') || '') } }); gateOpen = false; settingsModal(false); await start(); }
      catch (err) { toast(err.message, 'error'); }
      return;
    }
    if (e.target.id === 'passcodeForm') {
      e.preventDefault();
      try { state.auth = await api('/api/session/passcode', { method: 'POST', body: { passcode: String(new FormData(e.target).get('passcode') || '') } }); settingsModal(true); toast('Passcode saved. Share it with the team for the public MAIOS address.'); }
      catch (err) { toast(err.message, 'error'); }
      return;
    }
    if (e.target.id === 'aiKeyForm') {
      e.preventDefault(); const fd = new FormData(e.target), provider = String(fd.get('provider')), key = String(fd.get('key') || '').trim();
      if (!key) return toast('Paste the API key first.', 'error');
      try {
        state.model.ai = await api('/api/ai', { method: 'PATCH', body: { provider, key } }); state.aiProvider = provider;
        await refreshModel(); settingsModal(true);
        try { await api('/api/ai/test', { method: 'POST', body: { provider } }); toast('Key saved and verified.'); } catch (err) { toast(`Key saved, but the test failed: ${err.message}`, 'error'); }
      } catch (err) { toast(err.message, 'error'); }
      return;
    }
    if (e.target.id === 'gscKeyForm') {
      e.preventDefault(); const key = String(new FormData(e.target).get('key') || '').trim();
      if (!key) return toast('Paste the JSON key file first.', 'error');
      try { state.gsc = await api('/api/searchconsole', { method: 'PATCH', body: { key } }); await refresh(false, true); settingsModal(true); toast(state.gsc.hint || `Connected as ${state.gsc.email}${state.gsc.site ? ` to ${state.gsc.site}` : ''}.`, state.gsc.hint ? 'error' : 'good'); }
      catch (err) { toast(err.message, 'error'); }
      return;
    }
    if (e.target.id === 'gscSiteForm') {
      e.preventDefault();
      try { const out = await api('/api/searchconsole', { method: 'PATCH', body: { site: String(new FormData(e.target).get('site') || '') } }); state.gsc = { ...state.gsc, ...out }; await refresh(false, true); settingsModal(true); toast(`Briefs will use ${out.site}.`); }
      catch (err) { toast(err.message, 'error'); }
      return;
    }
    if (e.target.id === 'aiModelsForm') {
      e.preventDefault();
      const stages = Object.fromEntries($$('select.stage-model', e.target).map((x) => [x.name, x.value]).filter(([, v]) => v && v !== '__custom'));
      try { state.model.ai = await api('/api/ai', { method: 'PATCH', body: { stages } }); await refreshModel(); settingsModal(true); toast('Models saved. New generations use them.'); } catch (err) { toast(err.message, 'error'); }
      return;
    }
    if (e.target.id === 'brandForm') { e.preventDefault(); try { await api('/api/brand', { method: 'PATCH', body: Object.fromEntries(new FormData(e.target).entries()) }); toast('Voice and QA profiles saved.'); } catch (err) { toast(err.message, 'error'); } return; }
    if (e.target.id === 'settingsForm') {
      e.preventDefault(); const fd = new FormData(e.target); const url = String(fd.get('url') || '').trim().replace(/\/$/, '');
      if (url && !/^https?:\/\//i.test(url)) return toast('Use a full http:// or https:// API URL.', 'error');
      if (/:1234(\/|$)/.test(url) || /\/v1\/?$/.test(url)) return toast('That looks like the LM Studio address. Enter the Content Studio backend instead, usually http://127.0.0.1:4173 (the server started with node server.mjs).', 'error');
      store.set('maios_api_url', url); store.set('maios_actor', String(fd.get('actor') || '').trim() || 'Mike');
      try { sessionStorage.setItem('maios_token', String(fd.get('token') || '')); } catch { /* private mode */ }
      settingsModal(false); paintIdentity(); eventsCtl?.abort(); await refresh(); await refreshModel();
    }
  });
  document.addEventListener('change', async (e) => {
    if (e.target.id === 'detailStage') await changeTaskStage(state.selected, e.target.value);
    if (e.target.id === 'aiProvider') { state.aiProvider = e.target.value; settingsModal(true); }
    if (e.target.matches?.('select.stage-model') && e.target.value === '__custom') {
      const id = (prompt('Model ID as provider:model, for example anthropic:claude-opus-5-5, openai:gpt-6.1-sol or google:gemini-3.8-flash') || '').trim();
      if (!id) { e.target.value = state.model.ai?.stages?.[e.target.name] || ''; return; }
      const opt = document.createElement('option'); opt.value = id; opt.textContent = `${id} (custom)`; e.target.insertBefore(opt, e.target.lastElementChild); e.target.value = id;
    }
    if (e.target.id === 'assetInput') handleAssetUpload(e.target);
    if (e.target.id === 'artifactVersion') { state.artifactVersion = Number(e.target.value); state.editingArtifact = false; renderDrawer(); }
  });
  document.addEventListener('input', (e) => {
    if (e.target.closest?.('#taskEditForm, #commentForm, #reviseForm')) state.dirty = true;
    if (e.target.matches?.('#artifactEditForm textarea')) { const c = $('#editCount'); if (c) c.textContent = `${num(countWords(e.target.value))} words · ${num(e.target.value.length)} characters`; }
  });
  // Native HTML drag/drop keeps the interface dependency-free.
  document.addEventListener('dragstart', (e) => { const card = e.target.closest?.('.task-card'); if (!card) return; state.drag = card.dataset.taskId; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', state.drag); card.classList.add('dragging'); });
  document.addEventListener('dragend', () => { $$('.kanban-column').forEach((x) => x.classList.remove('drag-over')); $$('.task-card').forEach((x) => x.classList.remove('dragging')); state.drag = null; if (state.renderPending) { state.renderPending = false; render(); } });
  document.addEventListener('dragover', (e) => { const lane = e.target.closest?.('.kanban-column'); if (lane && state.drag) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; lane.classList.add('drag-over'); } });
  document.addEventListener('dragleave', (e) => { const lane = e.target.closest?.('.kanban-column'); if (lane && !lane.contains(e.relatedTarget)) lane.classList.remove('drag-over'); });
  document.addEventListener('drop', async (e) => { const lane = e.target.closest?.('.kanban-column'); if (!lane || !state.drag) return; e.preventDefault(); const id = e.dataTransfer.getData('text/plain') || state.drag; if (id) await changeTaskStage(id, lane.dataset.laneId); });
}
function renderManualArtifact() {
  const area = $('#drawerTabContent'); if (!area) return;
  area.innerHTML = `<div class="artifact-card"><form id="artifactEditForm"><textarea name="body" class="artifact-edit" placeholder="Write or paste a ${html(prettyKind[state.artifactTab])} here. Markdown is supported." required></textarea><div class="edit-bar"><button class="button primary" type="submit">Save first version</button><span id="editCount" class="muted">0 words</span></div></form></div>`;
  $('textarea', area).focus();
}
function paintIdentity() {
  const av = $('.user-avatar'); if (av) av.textContent = initials(actor());
  const who = $('#whoAmI'); if (who) who.textContent = actor();
}
const kbUi = makeKnowledgeUI({ api, html, toast, commissionModal });
async function boot() {
  installListeners(); kbUi.install(); paintIdentity();
  const pill = $('#enginePill'); if (pill && HOSTED) pill.textContent = 'MAIOS CLOUD ENGINE';
  if (HOSTED) {
    try { state.auth = await api('/api/session'); } catch (e) { toast(e.message, 'error'); }
    if (state.auth && !state.auth.ok) return authGate(state.auth); // signing in calls start()
  }
  await start();
}
let started = false;
async function start() {
  if (started) return; started = true;
  await kbUi.initialize();
  const d = await refresh(false); await refreshModel();
  if (!d) { settingsModal(true); toast(HOSTED ? 'Could not load the studio. Reload the page, or check Settings.' : 'Connect your local MAIOS backend to get started.', 'error'); }
  else if (!state.model.connected && state.model.ai) { settingsModal(true); toast('Add an API key for the models below to start generating.', 'error'); }
  if (location.hash.startsWith('#task=')) openTask(location.hash.slice(6));
  if (HOSTED) startPolling(); else connectEvents();
  // Safety net only: live events (local) or polling (hosted) normally keep everything current.
  setInterval(() => { if (document.visibilityState === 'hidden' || gateOpen) return; if (!HOSTED && !state.liveConnected) refresh(false); refreshModel(); if (!HOSTED && state.view === 'activity' && state.data.jobs.some((j) => j.status === 'running')) renderRuns(); }, 15000);
}
boot();
