// QA and revisions must see the whole draft: a long guide cut at 14,000 characters was failed as "truncated".
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('QA and revision prompts include the full draft of a long guide', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'maios-prompt-'));
  process.env.DATA_DIR = dir; process.env.NO_DEMO_SEED = '1';
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const db = await import('../db.mjs');
  db.useDatabaseFile(join(dir, 'p.sqlite'));
  const { inspectTaskPrompt } = await import('../agents.mjs');
  const id = db.commission({ topic: 'Healthcare marketing ROI', outputs: ['website'] }).tasks[0].id;
  const body = `# Healthcare marketing ROI\n\n${'Measure admissions, not just leads. '.repeat(800)}\n\nFINAL LINE: request an acquisition audit.`;
  assert(body.length > 25000);
  db.addArtifact(id, 'draft', 'Draft', body, 'manual', '', 'Mike');
  const qa = inspectTaskPrompt(id, 'qa');
  assert.match(qa.user, /FINAL LINE: request an acquisition audit\./);
  assert.match(qa.system + qa.user, /11\+ accounts/);
});
