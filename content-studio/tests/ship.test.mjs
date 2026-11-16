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
  assert.deepEqual(q.recent.map((x) => [x.path, x.status]).sort(), [['/resources/page-a', 'shipped'], ['/resources/page-b', 'failed']]);
  assert.equal(q.items.length, 0, 'a failed page is not retried on its own');
  const ev = (await s.api(`/api/tasks/${a}`)).events.map((e) => e.message);
  assert.ok(ev.includes('Site build started') && ev.some((m) => /Built on the site \(abc1234def/.test(m)));

  // Moving the failed card out and back puts it in the next batch.
  await s.api(`/api/tasks/${b}/move`, 'POST', { laneId: 'mpfresh:final_approval' });
  await s.api(`/api/tasks/${b}/move`, 'POST', { laneId: 'mpfresh:ship_dev' });
  assert.equal((await s.api('/api/ship/queue')).items[0].id, b);
});
