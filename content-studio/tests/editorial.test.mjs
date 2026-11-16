import test from 'node:test';
import assert from 'node:assert/strict';
import { startStudio, waitFor } from './helpers.mjs';
import { deterministicQa } from '../qa-checks.mjs';
import { buildImagePrompts } from '../integrations.mjs';

const web = { channel: 'website', content_type: 'article', word_count: 500, primary_keyword: '', voice: 'company' };
const filler = 'Treatment centers that own their reporting make faster budget decisions and keep their history when a vendor changes. '.repeat(30);

test('house editing rules: strip-outs, uncited figures, citations and links', () => {
  const draft = `# Title\n\nMeta title: Short\n\n## Section\n\n${filler}\nMike Hulick managed $50 million in spend at Haven Health. Marketing Powered AI grew leads 40%.\nAdmissions rose 12% in a year [1].\n`;
  const r = deterministicQa(web, draft, []);
  const all = r.review.join('\n');
  assert.match(all, /House strip-outs:.*names Mike Hulick.*"\$50 million".*"AI" in the brand name.*former employer/);
  assert.match(all, /Numeric claims need a source on file: .*40%/);
  assert(!/source on file: [^.]*12%/.test(all), 'a figure with a [n] marker on its line counts as cited');
  assert.match(all, /1 other figure is cited/);
  assert.match(all, /no Sources section/);
  assert.match(all, /No internal links/); assert.match(all, /No outbound links/);

  const founder = deterministicQa({ ...web, voice: 'founder' }, `# T\n\n## S\n\n${filler}\nMike Hulick here.`, []);
  assert(!/names Mike Hulick/.test(founder.review.join('\n')), 'founder-voice pieces may name the founder');

  const good = `# Title\n\nMeta title: Short\n\n## Section\n\n${filler}\nAdmissions rose 12% in a year [1]. See [our playbook](/resources/guides/playbook/).\n\n## Sources\n\n1. [SAMHSA survey](https://www.samhsa.gov/data)\n`;
  const ok = deterministicQa(web, good, []).review.join('\n');
  for (const re of [/House strip-outs/, /Numeric claims/, /bracketed citations/, /Sources section/, /internal links/, /outbound links/]) assert(!re.test(ok), `clean draft should not raise ${re}`);
  assert.match(deterministicQa(web, `# T\n\n## S\n\n${filler}`, []).review.join('\n'), /No bracketed citations/);
});

test('images are text-free unless words are explicitly allowed', () => {
  const off = buildImagePrompts({ channel: 'website' }, 'Draft.', { brand: 'Brand.', count: 1, text: false })[0].prompt;
  assert.match(off, /Do NOT render any words, letters, numbers/);
  const on = buildImagePrompts({ channel: 'website' }, 'Draft.', { brand: 'Brand.', count: 1, text: true })[0].prompt;
  assert.match(on, /short realistic on-brand text/); assert(!/Do NOT render/.test(on));
});

test('send back for revision: note is kept, card returns to drafting, approval is withdrawn, a revised draft is written', async (t) => {
  const s = await startStudio(t);
  const { tasks: [task] } = await s.api('/api/commission', 'POST', { topic: 'Owned measurement for hospital groups', outputs: ['website'], word_count: 300, graphics_count: 0 });
  await assert.rejects(s.api(`/api/tasks/${task.id}/revise`, 'POST', { note: 'Tighten the intro.' }), /no draft to revise/);
  await s.api(`/api/tasks/${task.id}/artifact`, 'POST', { kind: 'draft', body: '# First\n\nOriginal draft.' });
  await s.api(`/api/tasks/${task.id}/move`, 'POST', { laneId: 'mpfresh:graphics' });
  await waitFor(async () => { const x = await s.api(`/api/tasks/${task.id}`); return !x.jobs.some((j) => ['queued', 'running'].includes(j.status)); });
  await assert.rejects(s.api(`/api/tasks/${task.id}/revise`, 'POST', { note: '' }), /Text must contain/);

  const before = s.mock.requests.length;
  await s.api(`/api/tasks/${task.id}/revise`, 'POST', { note: 'Cut the second section and cite the 40% figure.' }, { 'X-MAIOS-Actor': 'Emily' });
  const done = await waitFor(async () => { const x = await s.api(`/api/tasks/${task.id}`); return x.artifacts.filter((a) => a.kind === 'draft').length === 2 ? x : false; });
  assert(done.comments.some((c) => c.author === 'Emily' && /Revision requested: Cut the second section/.test(c.body)));
  assert(done.events.some((e) => e.event_type === 'revision' && e.actor === 'Emily'));
  assert.equal(done.approved_at, null);
  assert.equal(done.lane_id, 'mpfresh:draft_complete', 'returned to drafting, then advanced when the new draft landed');
  assert.equal(done.artifacts.filter((a) => a.kind === 'draft').length, 2, 'the earlier draft is kept as a version');
  const sent = JSON.stringify(s.mock.requests.slice(before));
  assert.match(sent, /Cut the second section and cite the 40% figure/, 'the note reaches the model');
  assert.match(sent, /Original draft\./, 'the model revises the current draft rather than starting over');
});
