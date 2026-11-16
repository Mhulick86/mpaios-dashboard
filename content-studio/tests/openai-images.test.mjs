// Image generation through OpenAI GPT Image (the default provider when an OpenAI key exists).
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { startStudio, waitFor } from './helpers.mjs';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
function fakeOpenAI(t, { blockAll = '' } = {}) {
  const calls = []; let inflight = 0, maxInflight = 0;
  const server = http.createServer(async (req, res) => {
    const chunks = []; for await (const c of req) chunks.push(c);
    const send = (status, value) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value)); };
    if (req.headers.authorization !== 'Bearer sk-test-openai-secret-123456') return send(401, { error: { message: 'bad key' } });
    if (req.url === '/v1/models') return send(200, { data: [{ id: 'gpt-4o' }, { id: 'gpt-image-2.5-sunburst' }, { id: 'gpt-image-2' }] });
    if (req.url === '/v1/images/generations') {
      const body = JSON.parse(Buffer.concat(chunks).toString()); calls.push(body);
      if (blockAll) return send(403, { error: { message: blockAll, code: 'organization_not_verified' } });
      if (body.model === 'gpt-image-2.6-sunburst') return send(404, { error: { message: 'The model `gpt-image-2.6-sunburst` does not exist or you do not have access to it.', code: 'model_not_found' } });
      inflight++; maxInflight = Math.max(maxInflight, inflight);
      await new Promise((r) => setTimeout(r, 60)); inflight--;
      return send(200, { created: 1, data: [{ b64_json: PNG.toString('base64') }] });
    }
    send(404, { error: { message: 'not found' } });
  });
  t.after(() => new Promise((ok) => server.close(ok)));
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok({ calls, maxInflight: () => maxInflight, env: { OPENAI_API_KEY: 'sk-test-openai-secret-123456', OPENAI_BASE_URL: `http://127.0.0.1:${server.address().port}/v1`, GEMINI_API_KEY: '', AUTO_GENERATE_ON_MOVE: 'false' } })));
}
const DRAFT = `# Owned measurement for hospital marketing teams

Hospitals that own their marketing data connect campaigns to scheduled appointments, not clicks.

## Why budgets move without evidence
Service-line leaders defend budgets with platform dashboards they cannot audit, so finance discounts every number.

## Who owns the data
When the agency owns the ad accounts and the call tracking, the hospital rents its own history. Ownership changes who can answer the board.

## Four steps to owned measurement
1. Move ad accounts and call tracking into hospital ownership.
2. Define a scheduled appointment as the conversion.
3. Connect intake records to campaigns.
4. Review the numbers monthly with finance.

## Frequently asked questions
Is this only for large systems? No.
`;
const order = () => ({ topic: 'Owned measurement for hospital marketing teams', outputs: ['website'], voice: 'company', audience: 'Hospital CMOs', word_count: 800, graphics_count: 2 });

test('OpenAI GPT Image is the default image provider, falls back to a model the key can use, and attaches the images', async (t) => {
  const o = await fakeOpenAI(t);
  const s = await startStudio(t, { env: o.env });
  const st = (await s.api('/api/integrations')).images;
  assert.deepEqual([st.provider, st.configured, st.model, st.quality], ['openai', true, 'gpt-image-2.6-sunburst', 'high']);
  const tested = await s.api('/api/integrations/gemini/test', 'POST', {});
  assert.deepEqual([tested.provider, tested.modelAvailable, tested.model], ['openai', true, 'gpt-image-2.5-sunburst'], 'the test finds the best model this key can use');

  await s.api('/api/integrations', 'PATCH', { gemini_image_count: 4 });
  const { tasks: [task] } = await s.api('/api/commission', 'POST', order());
  await s.api(`/api/tasks/${task.id}/artifact`, 'POST', { kind: 'draft', body: DRAFT });
  await s.api(`/api/tasks/${task.id}/images`, 'POST', {});
  const done = await waitFor(async () => { const x = await s.api(`/api/tasks/${task.id}`); return x.imageRun?.status === 'done' ? x : false; }, 20000);
  assert.equal(done.imageRun.done, 4); assert.equal(done.assets.filter((a) => a.name.startsWith('AI image')).length, 4);
  // Progress comes from shared task events, so any server instance and the board card can show it.
  const card = (await s.api('/api/bootstrap')).imageRuns.find((r) => r.task_id === task.id);
  assert.deepEqual([card.status, card.done, card.total, card.failed], ['done', 4, 4, 0]);
  const ok = o.calls.filter((c) => c.model === 'gpt-image-2.5-sunburst');
  assert.equal(o.calls.filter((c) => c.model === 'gpt-image-2.6-sunburst').length >= 1, true, '2.6 was tried first');
  assert.equal(ok.length, 4);
  assert.ok(ok.every((c) => c.size === '1536x1024'), 'hero, section photos and the diagram are all landscape on a website');
  assert.ok(ok.every((c) => c.quality === 'high' && c.output_format === 'png' && c.n === 1));
  // Without a graphics plan, the section content decides: photos of people, a diagram only for the numbered steps.
  const names = done.assets.map((a) => a.name).sort();
  assert.deepEqual(names, ['AI image 01 · Hero photo', 'AI image 02 · Photo · Why budgets move without evidence', 'AI image 03 · Photo · Who owns the data', 'AI image 04 · Diagram · Four steps to owned measurement']);
  const photo = ok.find((c) => c.prompt.includes('SECTION "Who owns the data"')).prompt;
  assert.match(photo, /4K/); assert.match(photo, /real people/); assert.match(photo, /SHOT: A /); assert.match(photo, /#2CACE8/);
  assert.doesNotMatch(photo, /senior brand designer/, 'photos do not get the graphic brand system');
  const diagram = ok.find((c) => c.prompt.includes('Four steps')).prompt;
  assert.match(diagram, /CREATE: one clean diagram/); assert.match(diagram, /never invent numbers/); assert.match(diagram, /correctly spelled labels/, 'OpenAI graphics may carry short labels');
  assert.ok(!ok.some((c) => /Frequently asked/.test(c.prompt.split('SHOT:')[0].split('CREATE:')[0].slice(-400))), 'FAQ sections are not illustrated');
  assert.equal(o.maxInflight(), 2, 'two images at a time');
  assert.ok(done.events.some((e) => e.event_type === 'asset' && /gpt-image-2\.5-sunburst/.test(e.details?.model || JSON.stringify(e.details))));
  const img = await fetch(`${s.origin}/api/assets/${done.assets[0].id}`); assert.equal(img.headers.get('content-type'), 'image/png');
  assert.ok(!JSON.stringify(done).includes('sk-test-openai-secret'), 'the key never reaches the browser');

  // The working model is remembered: the next set does not try 2.6 again.
  const before = o.calls.length;
  await s.api(`/api/tasks/${task.id}/images`, 'POST', {});
  await waitFor(async () => (await s.api(`/api/tasks/${task.id}`)).assets.length === 8, 20000);
  assert.ok(o.calls.slice(before).every((c) => c.model === 'gpt-image-2.5-sunburst'));

  // Provider, model and quality are settings; an explicit model is used as is.
  const saved = await s.api('/api/integrations', 'PATCH', { image_model: 'gpt-image-2.5-flare', image_quality: 'medium' });
  assert.deepEqual([saved.images.model, saved.images.quality], ['gpt-image-2.5-flare', 'medium']);
  await assert.rejects(s.api('/api/integrations', 'PATCH', { image_quality: 'ultra' }), /low, medium or high/);
  const google = await s.api('/api/integrations', 'PATCH', { image_provider: 'google' });
  assert.deepEqual([google.images.provider, google.images.configured], ['google', false], 'Gemini needs its own key');
});

test('an unverified OpenAI organization stops the image run with a clear message', async (t) => {
  const o = await fakeOpenAI(t, { blockAll: 'Your organization must be verified to use the model `gpt-image-2.6-sunburst`.' });
  const s = await startStudio(t, { env: o.env });
  const { tasks: [task] } = await s.api('/api/commission', 'POST', order());
  await s.api(`/api/tasks/${task.id}/artifact`, 'POST', { kind: 'draft', body: '# Draft\n\nBody.' });
  await s.api(`/api/tasks/${task.id}/images`, 'POST', {});
  const failed = await waitFor(async () => { const x = await s.api(`/api/tasks/${task.id}`); return x.imageRun?.status === 'failed' ? x : false; });
  assert.match(failed.imageRun.error, /verified OpenAI organization/);
  assert.ok(o.calls.length <= 2, 'stops after the first batch instead of trying every image');
  assert.ok(!JSON.stringify(failed).includes('sk-test-openai-secret'));
});

test('the graphics plan decides photo or diagram per section, and its art direction reaches the image model', async (t) => {
  const o = await fakeOpenAI(t);
  const s = await startStudio(t, { env: { ...o.env, AUTO_GENERATE_ON_MOVE: 'false' } });
  const { tasks: [task] } = await s.api('/api/commission', 'POST', { ...order(), topic: 'Owned measurement for hospital marketing teams' });
  await s.api(`/api/tasks/${task.id}/generate`, 'POST', { kind: 'draft' });
  await waitFor(async () => (await s.api(`/api/tasks/${task.id}`)).artifacts.some((a) => a.kind === 'draft'));
  await s.api(`/api/tasks/${task.id}/generate`, 'POST', { kind: 'graphics' });
  const done = await waitFor(async () => { const x = await s.api(`/api/tasks/${task.id}`); return x.imageRun?.status === 'done' ? x : false; }, 20000);
  const planPrompt = s.mock.requests.find((r) => r.stage === 'graphics').user;
  assert.match(planPrompt, /^Plan the images for this piece/); assert.match(planPrompt, /"images":\[/);
  assert.deepEqual(done.assets.map((a) => a.name).sort(), ['AI image 01 · Hero photo', 'AI image 02 · Diagram · What ownership requires', 'AI image 03 · Photo · The decision in front of the reader']);
  const sent = o.calls.filter((c) => c.model === 'gpt-image-2.5-sunburst');
  assert.match(sent.find((c) => c.prompt.includes('What ownership requires')).prompt, /ART DIRECTION FROM THE GRAPHICS PLAN: Three linked blocks/);
  assert.match(sent.find((c) => c.prompt.includes('The decision in front of the reader')).prompt, /late afternoon light/);
  // Photos only: the plan's diagram becomes a photo.
  await s.api('/api/integrations', 'PATCH', { image_style: 'photo' });
  await s.api(`/api/tasks/${task.id}/images`, 'POST', {});
  await waitFor(async () => (await s.api(`/api/tasks/${task.id}`)).assets.length === 6, 20000);
  assert.ok((await s.api(`/api/tasks/${task.id}`)).assets.some((a) => a.name === 'AI image 02 · Photo · What ownership requires'));
});
