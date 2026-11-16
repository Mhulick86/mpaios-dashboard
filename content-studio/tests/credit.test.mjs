// Credit cutoffs pause work instead of failing it; a few-token probe on a timer resumes it once credit is back.
// QA does not pay for a model review when the automatic checks already fail the draft.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { startStudio, waitFor } from './helpers.mjs';

function fakeOpenAI(t) {
  const state = { out: true, calls: [] };
  const server = http.createServer(async (req, res) => {
    const chunks = []; for await (const c of req) chunks.push(c);
    const body = JSON.parse(Buffer.concat(chunks).toString() || '{}'); state.calls.push(body);
    if (state.out) {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: { message: 'You exceeded your current quota, please check your plan and billing details.', type: 'insufficient_quota', code: 'insufficient_quota' } }));
    }
    if (!body.stream) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ id: 'resp_probe', status: 'incomplete' })); }
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    const send = (o) => res.write(`data: ${JSON.stringify(o)}\n\n`);
    send({ type: 'response.output_text.delta', delta: '**Meta title:** Owned measurement\n**Meta description:** A test page.\n\n# Owned measurement\n\nA short lead paragraph.\n\n## Why it matters\nBudgets move on evidence.\n\n[Request an acquisition audit](/get-started/request-an-audit)' });
    send({ type: 'response.completed', response: { model: body.model, output: [{ type: 'message' }], usage: { input_tokens: 1234, output_tokens: 321, input_tokens_details: { cached_tokens: 1000 }, output_tokens_details: { reasoning_tokens: 100 } } } });
    res.end();
  });
  t.after(() => new Promise((ok) => server.close(ok)));
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok({
    state,
    env: {
      OPENAI_API_KEY: 'sk-test-credit-1234', OPENAI_BASE_URL: `http://127.0.0.1:${server.address().port}/v1`,
      STUDIO_MODEL_BRIEF: 'openai:gpt-test', STUDIO_MODEL_DRAFT: 'openai:gpt-test', STUDIO_MODEL_QA: 'openai:gpt-test', STUDIO_MODEL_GRAPHICS: 'openai:gpt-test',
      STUDIO_WEB_RESEARCH: '0', AUTO_GENERATE_ON_MOVE: 'false', CREDIT_CHECK_MS: '1500', CREDIT_TICK_MS: '400'
    }
  })));
}
const order = { topic: 'Owned measurement for treatment centers', outputs: ['website'], primary_keyword: 'owned measurement', word_count: 400 };

test('a credit cutoff pauses the job, probes on a timer, and resumes the work by itself', async (t) => {
  const o = await fakeOpenAI(t);
  const s = await startStudio(t, { env: o.env });
  const { tasks: [task] } = await s.api('/api/commission', 'POST', order);
  await s.api(`/api/tasks/${task.id}/generate`, 'POST', { kind: 'draft' });
  const paused = await waitFor(async () => { const x = await s.api(`/api/tasks/${task.id}`); return x.events.some((e) => e.event_type === 'paused') ? x : false; }, 15000);
  const job = paused.jobs.find((j) => j.kind === 'draft');
  assert.equal(job.status, 'queued', 'paused, not failed'); assert.match(job.error, /^Paused \(openai\): OpenAI is out of credit/);
  const credit = (await s.api('/api/bootstrap')).credit;
  assert.deepEqual(credit.map((c) => [c.provider, c.jobs]), [['openai', 1]]);
  // While the account is still out of credit, the check is a request of a few tokens, and the job keeps waiting.
  await waitFor(() => o.state.calls.some((c) => !c.stream && c.max_output_tokens === 16), 10000);
  assert.equal((await s.api(`/api/tasks/${task.id}`)).artifacts.some((a) => a.kind === 'draft'), false);
  o.state.out = false; // credit added
  const done = await waitFor(async () => { const x = await s.api(`/api/tasks/${task.id}`); return x.artifacts.some((a) => a.kind === 'draft') ? x : false; }, 20000);
  assert.ok(done.events.some((e) => e.event_type === 'resumed' && /OpenAI has credit again/.test(e.message)));
  assert.deepEqual((await s.api('/api/bootstrap')).credit, [], 'the watch clears once the work is released');
  const generated = done.events.find((e) => e.event_type === 'generated');
  assert.deepEqual(generated.details.usage, { input_tokens: 1234, output_tokens: 321, cached_input_tokens: 1000, reasoning_tokens: 100 }, 'token usage is recorded per job');
});

test('QA does not call the model when the automatic checks already fail the draft', async (t) => {
  const o = await fakeOpenAI(t); o.state.out = false;
  const s = await startStudio(t, { env: o.env });
  const { tasks: [task] } = await s.api('/api/commission', 'POST', order);
  await s.api(`/api/tasks/${task.id}/artifact`, 'POST', { kind: 'draft', body: '# Owned measurement\n\nLead paragraph.\n\n## Why\n[VERIFY] 40% of budgets are wasted.\n\n## Next\nTalk to us.' });
  await s.api(`/api/tasks/${task.id}/generate`, 'POST', { kind: 'qa' });
  const done = await waitFor(async () => { const x = await s.api(`/api/tasks/${task.id}`); return x.artifacts.some((a) => a.kind === 'qa') ? x : false; }, 15000);
  assert.equal(o.state.calls.length, 0, 'no model call');
  const qa = done.artifacts.find((a) => a.kind === 'qa');
  assert.match(qa.body, /Model review skipped/); assert.match(qa.body, /BLOCK: .*VERIFY/); assert.equal(done.qa_status, 'blocked');
});

test('every out-of-credit wording seen from the providers is recognized, and nothing else', async () => {
  const { CREDIT_ERROR } = await import('../providers.mjs');
  for (const m of ['OpenAI error: You have no credits remaining. Add credits to continue using the API.', 'You exceeded your current quota, please check your plan and billing details.', '{"error":{"code":"insufficient_quota"}}', 'Your credit balance is too low to access the Anthropic API.'])
    assert.match(m, CREDIT_ERROR);
  for (const m of ['The model declined this request.', 'OpenAI error: The server had an error processing your request.', 'Rate limit reached for requests per minute.'])
    assert.doesNotMatch(m, CREDIT_ERROR);
});
