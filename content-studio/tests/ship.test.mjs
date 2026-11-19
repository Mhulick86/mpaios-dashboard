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
    // Only drafts with a QA pass ship.
    await s.api(`/api/tasks/${task.id}/artifact`, 'POST', { kind: 'qa', body: 'Verdict: PASS\n\nNo issues.' });
    await s.api(`/api/tasks/${task.id}/qa-recheck`, 'POST', {});
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

test('plan pages: address from the slug, held without a QA pass or when a live page has that address, batches by priority', async (t) => {
  const http = await import('node:http');
  const sitemap = http.createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'application/xml' }); res.end('<urlset><url><loc>https://site.example/resources/existing-page</loc></url></urlset>'); });
  await new Promise((ok) => sitemap.listen(0, '127.0.0.1', ok)); t.after(() => sitemap.close());
  const s = await startStudio(t, { env: { SHIP_DEBOUNCE_MS: '0', SHIP_BATCH_LIMIT: '2', AUTO_GENERATE_ON_MOVE: 'false', SITE_ORIGIN: `http://127.0.0.1:${sitemap.address().port}` } });
  const make = async (title, slug, type, priority, qa = 'PASS') => {
    const { tasks: [task] } = await s.api('/api/commission', 'POST', { topic: title, outputs: ['website'], content_type: type, instructions: `SEO PLAN: test.\nSUGGESTED URL SLUG: ${slug}` });
    await s.api(`/api/tasks/${task.id}`, 'PATCH', { title, priority });
    await s.api(`/api/tasks/${task.id}/artifact`, 'POST', { kind: 'draft', body: `# ${title}\n\n**Meta title:** ${title}\n\n## Section one\nBody text.` });
    if (qa) { await s.api(`/api/tasks/${task.id}/artifact`, 'POST', { kind: 'qa', body: `Verdict: ${qa}\n\nReport.` }); await s.api(`/api/tasks/${task.id}/qa-recheck`, 'POST', {}); }
    await s.api(`/api/tasks/${task.id}/move`, 'POST', { laneId: 'mpfresh:ship_dev' });
    return task.id;
  };
  const landing = await make('Google ads agency', 'google-ads-agency', 'landing', 'P1');
  const guide = await make('Healthcare marketing guide', 'healthcare-marketing', 'guide', 'P0');
  const low = await make('Local SEO cost', 'local-seo-cost', 'article', 'P2');
  const noQa = await make('No QA yet', 'no-qa-yet', 'article', 'P0', '');
  const failed = await make('Failed QA', 'failed-qa', 'article', 'P0', 'FAIL');
  const clash = await make('Existing page', 'existing-page', 'article', 'P0');
  const q = await waitFor(async () => { const x = await s.api('/api/ship/queue'); return x.held.some((h) => /live page already exists/.test(h.held)) ? x : false; }, 10000, 200);
  const where = Object.fromEntries([...q.items, ...q.held].map((x) => [x.id, x.path]));
  assert.equal(where[landing], '/services/google-ads-agency', 'landing pages go under /services/');
  assert.equal(where[guide], '/resources/healthcare-marketing', 'guides and articles go under /resources/');
  const heldFor = Object.fromEntries(q.held.map((x) => [x.id, x.held]));
  assert.match(heldFor[noQa], /No QA pass yet/); assert.match(heldFor[failed], /QA failed/);
  assert.match(heldFor[clash], /A live page already exists at \/resources\/existing-page/);
  assert.deepEqual(q.items.map((x) => x.id), [guide, landing, low], 'highest priority first');
  assert.deepEqual(q.batch, [guide, landing], 'one build takes at most SHIP_BATCH_LIMIT pages');
  const claim = await s.api('/api/ship/claim', 'POST', { ids: [guide, landing, low], batch: 'b1' });
  assert.deepEqual(claim.claimed, [guide, landing], 'the claim stops at the batch limit');
  assert.equal((await s.api(`/api/ship/${guide}`)).derived, true);
});
