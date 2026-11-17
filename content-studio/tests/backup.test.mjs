// The backup provider: when OpenAI is out of credit, text and images move to xAI (Grok) straight away.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { startStudio, waitFor } from './helpers.mjs';

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const DRAFT = '**Meta title:** Owned measurement\n**Meta description:** A test page.\n\n# Owned measurement\n\nA short lead paragraph.\n\n## Why it matters\nBudgets move on evidence.\n\n## What to do first\nPick one service line.\n\n[Request an acquisition audit](/get-started/request-an-audit)';

/** One server plays both providers: OpenAI (key sk-...) has no credit, xAI (key xai-...) works. */
function fakeProviders(t) {
  const calls = { openai: [], xai: [] };
  const server = http.createServer(async (req, res) => {
    const chunks = []; for await (const c of req) chunks.push(c);
    const body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
    const who = String(req.headers.authorization || '').includes('xai-') ? 'xai' : 'openai';
    calls[who].push({ path: req.url, body });
    if (who === 'openai') {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: { message: 'You have no credits remaining. Add credits to continue using the API.', code: 'insufficient_quota' } }));
    }
    if (req.url.endsWith('/images/generations')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ data: [{ b64_json: PNG, mime_type: 'image/png' }] }));
    }
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    const send = (o) => res.write(`data: ${JSON.stringify(o)}\n\n`);
    // Like Grok: a line of narration in its own message before searching, then the page in the next message.
    send({ type: 'response.output_text.delta', item_id: 'msg_a', output_index: 0, delta: "I'll verify the policy pages first, then write the page." });
    send({ type: 'response.output_text.delta', item_id: 'msg_b', output_index: 2, delta: DRAFT });
    send({ type: 'response.completed', response: { model: body.model, output: [{ type: 'message' }], usage: { input_tokens: 900, output_tokens: 200 } } });
    res.end();
  });
  t.after(() => new Promise((ok) => server.close(ok)));
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => {
    const base = `http://127.0.0.1:${server.address().port}/v1`;
    ok({ calls, env: {
      OPENAI_API_KEY: 'sk-test-backup-1234', OPENAI_BASE_URL: base, XAI_API_KEY: 'xai-test-backup-1234', XAI_BASE_URL: base,
      STUDIO_MODEL_BRIEF: 'openai:gpt-test', STUDIO_MODEL_DRAFT: 'openai:gpt-test', STUDIO_MODEL_QA: 'openai:gpt-test', STUDIO_MODEL_GRAPHICS: 'openai:gpt-test',
      STUDIO_WEB_RESEARCH: '0', AUTO_GENERATE_ON_MOVE: 'false'
    } });
  }));
}
const order = { topic: 'Owned measurement for treatment centers', outputs: ['website'], primary_keyword: 'owned measurement', word_count: 400 };

test('out of credit on OpenAI: the job continues on Grok right away, and later jobs go straight to Grok', async (t) => {
  const p = await fakeProviders(t);
  const s = await startStudio(t, { env: p.env });
  const ai = await s.api('/api/ai');
  assert.equal(ai.backup.provider, 'xai', 'xAI is the backup automatically once its key exists');
  assert.ok(ai.providers.some((x) => x.id === 'xai' && x.configured)); assert.ok(ai.models.some((m) => m.id === 'xai:grok-4.7'));
  const { tasks: [task] } = await s.api('/api/commission', 'POST', order);
  await s.api(`/api/tasks/${task.id}/generate`, 'POST', { kind: 'draft' });
  const done = await waitFor(async () => { const x = await s.api(`/api/tasks/${task.id}`); return x.artifacts.some((a) => a.kind === 'draft') ? x : false; }, 20000);
  assert.match(done.artifacts.find((a) => a.kind === 'draft').model, /^xai\/grok-4\.7/);
  assert.match(done.artifacts.find((a) => a.kind === 'draft').body, /^\*\*Meta title:\*\* Owned measurement/, 'the narration before the page is not saved');
  assert.ok(done.events.some((e) => e.event_type === 'switched' && /OpenAI is out of credit: this draft continues on xAI/.test(e.message)));
  assert.equal(p.calls.xai[0].body.reasoning?.effort, 'medium', 'Grok 4.7 gets a reasoning effort'); assert.equal(p.calls.xai[0].body.tools, undefined);
  // OpenAI stays on the watch list (checked every 6 hours); new work for its stages goes straight to the backup.
  assert.deepEqual((await s.api('/api/bootstrap')).credit.map((c) => [c.provider, c.jobs]), [['openai', 0]]);
  const openaiCalls = p.calls.openai.length;
  await s.api(`/api/tasks/${task.id}/generate`, 'POST', { kind: 'qa' });
  await waitFor(async () => (await s.api(`/api/tasks/${task.id}`)).artifacts.some((a) => a.kind === 'qa'), 20000);
  assert.equal(p.calls.openai.length, openaiCalls, 'no call to the provider that is out of credit');
});

test('out of credit on OpenAI images: the remaining images are made with Grok Imagine', async (t) => {
  const p = await fakeProviders(t);
  const s = await startStudio(t, { env: p.env });
  const { tasks: [task] } = await s.api('/api/commission', 'POST', order);
  await s.api(`/api/tasks/${task.id}/artifact`, 'POST', { kind: 'draft', body: DRAFT });
  await s.api(`/api/tasks/${task.id}/images`, 'POST', {});
  const done = await waitFor(async () => { const x = await s.api(`/api/tasks/${task.id}`); return x.imageRun?.status === 'done' ? x : false; }, 20000);
  assert.equal(done.imageRun.done, done.imageRun.total); assert.equal(done.imageRun.failed, 0);
  assert.ok(done.events.some((e) => e.event_type === 'switched' && /remaining images use xAI Grok Imagine/.test(e.message)));
  const sent = p.calls.xai.filter((c) => c.path.endsWith('/images/generations'));
  assert.ok(sent.length >= 1 && sent.every((c) => c.body.model === 'grok-imagine-image-2.0' && c.body.response_format === 'b64_json'));
  assert.deepEqual(sent.map((c) => c.body.aspect_ratio).sort(), ['16:9', '3:2'], 'a wide hero, then a 3:2 section image');
  assert.ok(done.events.some((e) => e.event_type === 'asset' && /grok-imagine-image-2\.0/.test(JSON.stringify(e.details))));
});
