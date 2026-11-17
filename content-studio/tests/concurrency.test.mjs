// Hosted concurrency: up to 8 generations at once on xAI (Grok), 4 on each other provider.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('Grok runs 8 jobs at once, other providers 4, and the overall limit still applies', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'maios-conc-'));
  Object.assign(process.env, { DATA_DIR: dir, NO_DEMO_SEED: '1', XAI_API_KEY: 'xai-test-concurrency-1234', OPENAI_API_KEY: 'sk-test-concurrency-1234', STUDIO_MODEL_DRAFT: 'xai:grok-4.7', STUDIO_MODEL_BRIEF: 'openai:gpt-test' });
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const db = await import('../db.mjs');
  db.useDatabaseFile(join(dir, 'c.sqlite'));
  const { claimNext } = await import('../credit.mjs');
  const make = (i) => db.commission({ topic: `Concurrency topic ${i}`, outputs: ['website'] }).tasks[0].id;
  for (let i = 0; i < 12; i++) db.queueJob(make(`d${i}`), 'draft');
  for (let i = 0; i < 6; i++) db.queueJob(make(`b${i}`), 'brief');
  const started = [];
  let job; while ((job = claimNext(16))) started.push(job.kind);
  assert.equal(started.filter((k) => k === 'draft').length, 8, 'eight Grok drafts at once');
  assert.equal(started.filter((k) => k === 'brief').length, 4, 'four OpenAI briefs at once');
  // One finishes: one more of that provider's work can start.
  const running = db.getDb().prepare("SELECT id FROM jobs WHERE status='running' AND kind='draft' LIMIT 1").get();
  db.finishJob(running.id, 'done');
  assert.equal(claimNext(16)?.kind, 'draft');
  assert.equal(claimNext(16), null);
  // The overall limit wins when it is lower.
  assert.equal(claimNext(5), null);
});
