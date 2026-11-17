// Stages set to "Local team" are left for the worker on a team member's Mac: the studio does not run them itself.
// The worker claims a job with its finished prompt, keeps it alive, and reports the result or a failure.
import test from 'node:test';
import assert from 'node:assert/strict';
import { startStudio, waitFor, sleep } from './helpers.mjs';

const order = { topic: 'Owned measurement for treatment centers', outputs: ['website'], primary_keyword: 'owned measurement', word_count: 400 };
const env = { STUDIO_MODEL_BRIEF: 'local:team', STUDIO_MODEL_QA: 'local:team', AUTO_GENERATE_ON_MOVE: 'false' };
const BRIEF = '## Editorial brief\n\nAudience: admissions directors. Angle: budgets move on evidence. Sections: why it matters, what to measure, how to start.';

test('a local-team stage waits for the worker, which claims it and saves the result on the card', async (t) => {
  const s = await startStudio(t, { env });
  const { tasks: [task] } = await s.api('/api/commission', 'POST', order);
  await s.api(`/api/tasks/${task.id}/generate`, 'POST', { kind: 'brief' });
  await sleep(1200); // long enough for the studio's own runner to have taken it, if it were going to
  assert.equal((await s.api(`/api/tasks/${task.id}`)).jobs.find((j) => j.kind === 'brief').status, 'queued', 'the studio leaves it for the worker');
  assert.equal(s.mock.requests?.length || 0, 0, 'no model was called by the studio');

  const claim = await s.api('/api/worker/claim', 'POST', {});
  assert.equal(claim.job.kind, 'brief'); assert.equal(claim.task.id, task.id);
  assert.ok(claim.prompt.system.length > 200 && claim.prompt.user.includes('Owned measurement'), 'the finished prompt comes with the job');
  assert.equal((await s.api('/api/worker/claim', 'POST', {})).job, null, 'a claimed job is not handed out twice');

  const beat = await s.api(`/api/worker/jobs/${claim.job.id}/progress`, 'POST', { text: 'Local team: writing the brief' });
  assert.equal(beat.status, 'running');
  await s.api(`/api/worker/jobs/${claim.job.id}/done`, 'POST', { output: BRIEF, model: 'lead', usage: { input_tokens: 900, output_tokens: 120 }, research: { searches: 0, fetches: 0 } });

  const after = await s.api(`/api/tasks/${task.id}`);
  const artifact = after.artifacts.find((a) => a.kind === 'brief');
  assert.match(artifact.body, /Editorial brief/); assert.equal(artifact.model, 'local/lead');
  assert.equal(after.jobs.find((j) => j.kind === 'brief').status, 'done');
  await assert.rejects(s.api(`/api/worker/jobs/${claim.job.id}/done`, 'POST', { output: BRIEF }), /409/, 'a finished job cannot be reported twice');
});

test('a worker failure is recorded, a retryable one goes back in the queue, and a cancelled job refuses its result', async (t) => {
  const s = await startStudio(t, { env: { ...env, JOB_RETRY_BASE_MS: '100' } });
  const { tasks: [task] } = await s.api('/api/commission', 'POST', order);
  await s.api(`/api/tasks/${task.id}/generate`, 'POST', { kind: 'brief' });
  const first = await s.api('/api/worker/claim', 'POST', {});
  await s.api(`/api/worker/jobs/${first.job.id}/failed`, 'POST', { error: 'LM Studio is not answering', transient: true });
  let job = (await s.api(`/api/tasks/${task.id}`)).jobs.find((j) => j.kind === 'brief');
  assert.equal(job.status, 'queued'); assert.match(job.error, /Local team: LM Studio is not answering/);

  const second = await waitFor(async () => { const c = await s.api('/api/worker/claim', 'POST', {}); return c.job ? c : false; }, 8000);
  await s.api(`/api/jobs/${second.job.id}/cancel`, 'POST', {});
  await assert.rejects(s.api(`/api/worker/jobs/${second.job.id}/done`, 'POST', { output: BRIEF }), /409/);
  assert.equal((await s.api(`/api/tasks/${task.id}`)).artifacts.filter((a) => a.kind === 'brief').length, 0, 'nothing was saved');

  await s.api(`/api/tasks/${task.id}/generate`, 'POST', { kind: 'brief' });
  const third = await s.api('/api/worker/claim', 'POST', {});
  await s.api(`/api/worker/jobs/${third.job.id}/failed`, 'POST', { error: 'The model returned no text.' });
  job = (await s.api(`/api/tasks/${task.id}`)).jobs.filter((j) => j.kind === 'brief')[0];
  assert.equal(job.status, 'failed');
});

test('stages on a cloud model are never handed to the worker, and Local team is offered in Settings', async (t) => {
  const s = await startStudio(t, { env: { AUTO_GENERATE_ON_MOVE: 'false', STUDIO_MODEL_BRIEF: 'lmstudio:auto' } });
  const ai = await s.api('/api/ai');
  assert.ok(ai.models.some((m) => m.id === 'local:team'), 'Local team is a choice for every stage');
  const { tasks: [task] } = await s.api('/api/commission', 'POST', order);
  await s.api(`/api/tasks/${task.id}/generate`, 'POST', { kind: 'brief' });
  const claim = await s.api('/api/worker/claim', 'POST', {});
  assert.equal(claim.job, null); assert.match(claim.reason, /No stage is set to the local team/);
  await waitFor(async () => (await s.api(`/api/tasks/${task.id}`)).artifacts.some((a) => a.kind === 'brief'), 15000);
});
