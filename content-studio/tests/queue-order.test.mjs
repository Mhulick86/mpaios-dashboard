// Queue order: work already in progress (QA, graphics, drafts) starts before new briefs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('drafts, graphics and QA are picked before older briefs; oldest first within a stage', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'maios-queue-'));
  process.env.DATA_DIR = dir; process.env.NO_DEMO_SEED = '1';
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const db = await import(`../db.mjs?queue=${Date.now()}`);
  db.useDatabaseFile(join(dir, 'q.sqlite'));
  const make = (topic) => db.commission({ topic, outputs: ['website'] }).tasks[0].id;
  const [a, b, c, d] = ['Alpha topic', 'Bravo topic', 'Charlie topic', 'Delta topic'].map(make);
  db.queueJob(a, 'brief'); db.queueJob(b, 'brief');
  // Make a draft and a QA job that are newer than both briefs.
  db.addArtifact(c, 'draft', 'Draft', '# Draft', 'manual', '', 'Mike'); db.queueJob(c, 'draft');
  db.addArtifact(d, 'draft', 'Draft', '# Draft', 'manual', '', 'Mike'); db.queueJob(d, 'qa');
  const order = []; let job;
  while ((job = db.nextJob())) { order.push(`${job.kind}:${db.getTask(job.task_id).topic}`); db.finishJob(job.id, 'done'); }
  assert.deepEqual(order, ['qa:Delta topic', 'draft:Charlie topic', 'brief:Alpha topic', 'brief:Bravo topic']);
});
