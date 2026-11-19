// Ship to dev: batching, packages for the site builder, and results back on the card.
import test from 'node:test';
import assert from 'node:assert/strict';
import { startStudio, waitFor, sleep } from './helpers.mjs';

test('cards moved to Ship to dev wait for a quiet period, then ship as one batch with full packages', async (t) => {
  const s = await startStudio(t, { env: { SHIP_DEBOUNCE_MS: '1500', AUTO_GENERATE_ON_MOVE: 'false', SITE_ORIGIN: 'https://site.example' } });
  const make = async (title, url) => {
    const { tasks: [task] } = await s.api('/api/commission', 'POST', { topic: `${title} topic`, outputs: ['website'], primary_keyword: 'owned measurement', instructions: url ? `Mode: new\nURL: ${url}\nPriority Group: P1` : '' });
    await s.api(`/api/tasks/${task.id}`, 'PATCH', { title });
    await s.api(`/api/tasks/${task.id}/artifact`, 'POST', { kind: 'draft', body: `# ${title}\n\n**Meta title:** ${title}\n\n## Section one\nBody text.` });
    return task.id;
  };
  const a = await make('P1- /resources/page-a', '/resources/page-a');
  const b = await make('P1- /resources/page-b', '/resources/page-b');
  const noUrl = await make('Untitled idea', '');
  await s.api(`/api/tasks/${a}/move`, 'POST', { laneId: 'mpfresh:ship_dev' });
  let q = await s.api('/api/ship/queue');
  assert.equal(q.ready, false, 'not ready while the quiet period runs'); assert.equal(q.items.length, 1);
  await sleep(700);
  await s.api(`/api/tasks/${b}/move`, 'POST', { laneId: 'mpfresh:ship_dev' });
  await s.api(`/api/tasks/${noUrl}/move`, 'POST', { laneId: 'mpfresh:ship_dev' });
  await sleep(1000);
  assert.equal((await s.api('/api/ship/queue')).ready, false, 'a new arrival restarts the wait for the whole batch');
  q = await waitFor(async () => { const x = await s.api('/api/ship/queue'); return x.ready ? x : false; }, 5000, 150);
  assert.deepEqual(q.items.map((x) => x.path).sort(), ['/resources/page-a', '/resources/page-b']);
  assert.equal(q.held.length, 1); assert.match(q.held[0].held, /No page URL/);
  const board = await s.api('/api/bootstrap');
  assert.equal(board.ship.find((x) => x.task_id === a).status, 'waiting');

  const pkg = await s.api(`/api/ship/${a}`);
  assert.deepEqual([pkg.path, pkg.mode, pkg.live_url, pkg.draft.version], ['/resources/page-a', 'new', 'https://site.example/resources/page-a', 1]);
  assert.match(pkg.draft.markdown, /## Section one/); assert.deepEqual(pkg.images, []);

  const claim = await s.api('/api/ship/claim', 'POST', { ids: [a, b, noUrl], batch: 'test-batch' });
  assert.deepEqual(claim.claimed.sort(), [a, b].sort()); assert.equal(claim.skipped[0].id, noUrl);
  assert.equal((await s.api('/api/ship/claim', 'POST', { ids: [a] })).claimed.length, 0, 'a claimed page cannot be claimed twice');
  assert.equal((await s.api('/api/ship/queue')).building.length, 2);

  await s.api(`/api/ship/${a}/done`, 'POST', { commit: 'abc1234def', url: 'https://site.example/resources/page-a' });
  await s.api(`/api/ship/${b}/failed`, 'POST', { reason: 'next build failed on page-b' });
  q = await s.api('/api/ship/queue');
  assert.deepEqual(q.recent.map((x) => [x.path, x.status]), [['/resources/page-b', 'failed']]);
  // A built page moves to Posted, with the live link recorded and on the first line of its notes.
  const posted = await s.api(`/api/tasks/${a}`);
  assert.equal(posted.lane_id, 'mpfresh:posted'); assert.equal(posted.published_url, 'https://site.example/resources/page-a');
  assert.match(posted.instructions, /^Live page: https:\/\/site\.example\/resources\/page-a\n\nMode: new/);
  assert.ok((await s.api('/api/bootstrap')).lanes.some((l) => l.id === 'mpfresh:posted' && l.name === 'Posted'));
  assert.equal(q.items.length, 0, 'a failed page is not retried on its own');
  const ev = (await s.api(`/api/tasks/${a}`)).events.map((e) => e.message);
  assert.ok(ev.includes('Site build started') && ev.some((m) => /Built on the site \(abc1234def/.test(m)));

  // Moving the failed card out and back puts it in the next batch.
  await s.api(`/api/tasks/${b}/move`, 'POST', { laneId: 'mpfresh:final_approval' });
  await s.api(`/api/tasks/${b}/move`, 'POST', { laneId: 'mpfresh:ship_dev' });
  assert.equal((await s.api('/api/ship/queue')).items[0].id, b);
});

/** Stand-in for the builder's scheduled-task fire URL. */
async function fakeBuilder(t) {
  const { createServer } = await import('node:http');
  const fires = []; const state = { failNext: 0 };
  const server = createServer(async (req, res) => {
    const chunks = []; for await (const c of req) chunks.push(c);
    fires.push({ auth: req.headers.authorization, beta: req.headers['anthropic-beta'], body: JSON.parse(Buffer.concat(chunks).toString() || '{}') });
    if (state.failNext > 0) { state.failNext--; res.writeHead(500); return res.end('builder unavailable'); }
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"type":"routine_fire"}');
  });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  t.after(() => server.close());
  return { fires, state, url: `http://127.0.0.1:${server.address().port}/fire` };
}
const page = async (s, title, url) => {
  const { tasks: [task] } = await s.api('/api/commission', 'POST', { topic: `${title} topic`, outputs: ['website'], instructions: `Mode: new\nURL: ${url}` });
  await s.api(`/api/tasks/${task.id}/artifact`, 'POST', { kind: 'draft', body: `# ${title}\n\n## Section one\nBody text.` });
  return task.id;
};
const toShip = (s, id) => s.api(`/api/tasks/${id}/move`, 'POST', { laneId: 'mpfresh:ship_dev' });

test('the studio starts the site builder once per ready batch, and Build now skips the wait', async (t) => {
  const builder = await fakeBuilder(t);
  const s = await startStudio(t, { env: { SHIP_DEBOUNCE_MS: '1500', SHIP_WAKE_TICK_MS: '150', AUTO_GENERATE_ON_MOVE: 'false', SITE_BUILDER_FIRE_URL: builder.url, SITE_BUILDER_FIRE_TOKEN: 'test-fire-token-0123456789', SITE_BUILDER_REWAKE_MS: '60000' } });
  const a = await page(s, 'Page A', '/resources/wake-a');
  await toShip(s, a);
  await sleep(600);
  assert.equal(builder.fires.length, 0, 'not started during the quiet period');
  await waitFor(() => builder.fires.length === 1, 5000, 100);
  assert.equal(builder.fires[0].auth, 'Bearer test-fire-token-0123456789');
  assert.ok(builder.fires[0].beta); assert.match(builder.fires[0].body.text, /1 page ready/);
  await sleep(700);
  assert.equal(builder.fires.length, 1, 'one start per batch, however often the check runs');
  let board = await s.api('/api/bootstrap');
  assert.equal(board.shipBuilder.auto_start, true); assert.ok(board.shipBuilder.last_started_at);

  // A second card restarts the quiet period; Build now makes the whole batch ready and starts the builder at once.
  const b = await page(s, 'Page B', '/resources/wake-b');
  await toShip(s, b);
  assert.equal((await s.api('/api/ship/queue')).ready, false);
  const now = await s.api('/api/ship/build-now', 'POST', {});
  assert.deepEqual([now.pages, now.starts], [2, 'now']);
  const q = await s.api('/api/ship/queue');
  assert.equal(q.ready, true); assert.equal(q.build_now, true);
  await waitFor(() => builder.fires.length === 2, 1000, 50);
  assert.match(builder.fires[1].body.text, /2 pages ready/);

  // While a build runs the builder is not called again; cards that arrive meanwhile go out when it finishes.
  await s.api('/api/ship/claim', 'POST', { ids: [a, b], batch: 'wake-test' });
  const c = await page(s, 'Page C', '/resources/wake-c');
  await toShip(s, c);
  assert.equal((await s.api('/api/ship/build-now', 'POST', {})).starts, 'after_current');
  await sleep(700);
  assert.equal(builder.fires.length, 2);
  await s.api(`/api/ship/${a}/done`, 'POST', { commit: 'abc1234' });
  await s.api(`/api/ship/${b}/done`, 'POST', { commit: 'abc1234' });
  await waitFor(() => builder.fires.length === 3, 3000, 50);

  // A start that fails is shown on the board and tried again at the next check.
  await s.api('/api/ship/claim', 'POST', { ids: [c], batch: 'wake-test-2' });
  await s.api(`/api/ship/${c}/done`, 'POST', { commit: 'abc1234' });
  await assert.rejects(s.api('/api/ship/build-now', 'POST', {}), /Nothing in Ship to dev is waiting/);
  builder.state.failNext = 1;
  const d = await page(s, 'Page D', '/resources/wake-d');
  await toShip(s, d);
  await s.api('/api/ship/build-now', 'POST', {});
  await waitFor(() => builder.fires.length === 5, 4000, 50);
  board = await waitFor(async () => { const x = await s.api('/api/bootstrap'); return x.shipBuilder.last_error === '' ? x : false; }, 3000, 100);
  assert.ok(board.shipBuilder.last_started_at);
  assert.ok(/could not be started: HTTP 500/.test(s.logs.stderr), 'the failed start is logged');
});

test('Build now without a builder connection still makes the batch ready for the next check', async (t) => {
  const s = await startStudio(t, { env: { SHIP_DEBOUNCE_MS: '600000', AUTO_GENERATE_ON_MOVE: 'false', SITE_BUILDER_FIRE_URL: '', SITE_BUILDER_FIRE_TOKEN: '' } });
  const a = await page(s, 'Page A', '/resources/manual-a');
  await toShip(s, a);
  assert.equal((await s.api('/api/ship/queue')).ready, false);
  assert.equal((await s.api('/api/bootstrap')).shipBuilder.auto_start, false);
  assert.deepEqual(await s.api('/api/ship/build-now', 'POST', {}), { pages: 1, held: 0, starts: 'next_check' });
  assert.equal((await s.api('/api/ship/queue')).ready, true);
  // A card that arrives after the press waits for its own quiet period (or another press).
  const b = await page(s, 'Page B', '/resources/manual-b');
  await toShip(s, b);
  assert.equal((await s.api('/api/ship/queue')).ready, false);
});
