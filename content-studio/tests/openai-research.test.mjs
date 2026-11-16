// OpenAI writer and QA verify claims with the Responses API web_search tool; briefs do not search.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { startStudio, waitFor } from './helpers.mjs';

function fakeOpenAI(t, { rejectTools = false } = {}) {
  const calls = [];
  const server = http.createServer(async (req, res) => {
    const chunks = []; for await (const c of req) chunks.push(c);
    const body = JSON.parse(Buffer.concat(chunks).toString() || '{}'); calls.push(body);
    if (rejectTools && body.tools) { res.writeHead(400, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: { message: "Tool 'web_search' is not supported with this model." } })); }
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    const send = (o) => res.write(`data: ${JSON.stringify(o)}\n\n`);
    if (body.tools) { send({ type: 'response.web_search_call.completed', item_id: 'ws_1' }); send({ type: 'response.web_search_call.completed', item_id: 'ws_2' }); }
    const text = body.input.startsWith('Review the current draft') ? 'Verdict: PASS\n\nAll claims verified.' : '**Meta title:** Test\n**Meta description:** Test page.\n\n# Owned measurement\n\nAbout 48.4 million adults had a substance use disorder in 2023 ([SAMHSA](https://www.samhsa.gov/data)).\n';
    send({ type: 'response.output_text.delta', delta: text });
    send({ type: 'response.completed', response: { model: body.model, output: body.tools ? [{ type: 'web_search_call' }, { type: 'web_search_call' }, { type: 'message' }] : [{ type: 'message' }] } });
    res.end();
  });
  t.after(() => new Promise((ok) => server.close(ok)));
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok({ calls, env: { OPENAI_API_KEY: 'sk-test-openai-research-1234', OPENAI_BASE_URL: `http://127.0.0.1:${server.address().port}/v1`, STUDIO_MODEL_BRIEF: 'openai:gpt-test', STUDIO_MODEL_DRAFT: 'openai:gpt-test', STUDIO_MODEL_QA: 'openai:gpt-test', AUTO_GENERATE_ON_MOVE: 'false' } })));
}
const order = { topic: 'Owned measurement for treatment centers', outputs: ['website'], primary_keyword: 'owned measurement', word_count: 400 };

test('OpenAI: the writer and QA search the web, briefs do not, and the history records it', async (t) => {
  const o = await fakeOpenAI(t);
  const s = await startStudio(t, { env: o.env });
  const { tasks: [task] } = await s.api('/api/commission', 'POST', order);
  for (const kind of ['brief', 'draft', 'qa']) {
    await s.api(`/api/tasks/${task.id}/generate`, 'POST', { kind });
    await waitFor(async () => (await s.api(`/api/tasks/${task.id}`)).artifacts.some((a) => a.kind === kind), 15000);
  }
  const [brief, draft, qa] = o.calls;
  assert.equal(brief.tools, undefined, 'briefs do not search');
  assert.deepEqual(draft.tools, [{ type: 'web_search' }]); assert.deepEqual(qa.tools, [{ type: 'web_search' }]);
  assert.match(draft.instructions, /You verify your own claims/); assert.match(draft.instructions, /APPROVED PROOF POINTS/);
  const d = await s.api(`/api/tasks/${task.id}`);
  assert.ok(d.events.some((e) => e.event_type === 'research' && /Claims verified with 2 web searches/.test(e.message)));
  assert.ok(d.events.some((e) => e.event_type === 'research' && /QA checked with 2 web searches/.test(e.message)));
  assert.notEqual(d.qa_status, 'blocked', 'an inline-cited figure does not block');
});

test('OpenAI: a model that rejects web search still writes, without research', async (t) => {
  const o = await fakeOpenAI(t, { rejectTools: true });
  const s = await startStudio(t, { env: o.env });
  const { tasks: [task] } = await s.api('/api/commission', 'POST', order);
  await s.api(`/api/tasks/${task.id}/generate`, 'POST', { kind: 'draft' });
  await waitFor(async () => (await s.api(`/api/tasks/${task.id}`)).artifacts.some((a) => a.kind === 'draft'), 15000);
  assert.ok(o.calls[0].tools && !o.calls[1].tools, 'retried without the tool');
});
