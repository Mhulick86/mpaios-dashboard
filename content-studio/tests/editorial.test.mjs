import test from 'node:test';
import assert from 'node:assert/strict';
import { startStudio, waitFor } from './helpers.mjs';
import { deterministicQa } from '../qa-checks.mjs';
import { buildImagePrompts, parseShotList, suggestsGraphic, pageImageSlots } from '../integrations.mjs';

const web = { channel: 'website', content_type: 'article', word_count: 500, primary_keyword: '', voice: 'company' };
const filler = 'Treatment centers that own their reporting make faster budget decisions and keep their history when a vendor changes. '.repeat(30);

test('house editing rules: strip-outs, uncited figures, citations and links', () => {
  const draft = `# Title\n\nMeta title: Short\n\n## Section\n\n${filler}\nMike Hulick managed $50 million in spend at Haven Health. Marketing Powered AI grew leads 40%.\n\nAdmissions rose 12% in a year [1].\n`;
  const r = deterministicQa(web, draft, []);
  const all = r.review.join('\n');
  assert.match(all, /House strip-outs:.*names Mike Hulick.*"\$50 million".*"AI" in the brand name.*former employer/);
  assert.match(all, /Numeric claims need a source on file: .*40%/);
  assert(!/source on file: [^.]*12%/.test(all), 'a figure with a [n] marker in its paragraph counts as cited');
  assert.match(all, /1 other figure is cited/);
  assert.match(all, /no Sources section/);
  assert.match(all, /No internal links/); assert.doesNotMatch(all, /outbound links/, 'pages are not asked for outbound links for their own sake');

  const founder = deterministicQa({ ...web, voice: 'founder' }, `# T\n\n## S\n\n${filler}\nMike Hulick here.`, []);
  assert(!/names Mike Hulick/.test(founder.review.join('\n')), 'founder-voice pieces may name the founder');

  const good = `# Title\n\nMeta title: Short\n\n## Section\n\n${filler}\nAdmissions rose 12% in a year [1]. See [our playbook](/resources/guides/playbook/).\n\n## Sources\n\n1. [SAMHSA survey](https://www.samhsa.gov/data)\n`;
  const ok = deterministicQa(web, good, []).review.join('\n');
  for (const re of [/House strip-outs/, /Numeric claims/, /bracketed citations/, /Sources section/, /internal links/, /outbound links/]) assert(!re.test(ok), `clean draft should not raise ${re}`);
  assert.doesNotMatch(deterministicQa(web, `# T\n\n## S\n\n${filler}`, []).review.join('\n'), /bracketed citations/, 'numbered citations are optional');
  // A figure cited inline with a link to its source counts as sourced (the writer verifies and links what it states).
  const inline = deterministicQa(web, `# T\n\n## S\n\n${filler}\nAbout 48.4 million adults had a substance use disorder in 2023 ([SAMHSA NSDUH](https://www.samhsa.gov/data/report/2023-nsduh-annual-national-report)).\n`, []).review.join('\n');
  assert.doesNotMatch(inline, /Numeric claims/);
  // Working notes and placeholders would render on the live page, so they block.
  const notes = deterministicQa(web, `# T\n\n## S\n\n${filler}\nCall [PHONE: tracked number] or [Local SEO](#).\n\n## Production notes (not for publication)\n- check\n`, []);
  assert.match(notes.block.join('\n'), /Bracketed working notes.*PHONE/); assert.match(notes.block.join('\n'), /Links pointing to "#"/); assert.match(notes.block.join('\n'), /Production, editor or fact-check notes/);
});

test('images are text-free unless words are explicitly allowed', () => {
  const off = buildImagePrompts({ channel: 'website' }, 'Draft.', { brand: 'Brand.', count: 1, text: false, style: 'graphics' })[0].prompt;
  assert.match(off, /Do NOT render any words, letters, numbers/);
  const on = buildImagePrompts({ channel: 'website' }, 'Draft.', { brand: 'Brand.', count: 1, text: true, style: 'graphics' })[0].prompt;
  assert.match(on, /correctly spelled labels/); assert(!/Do NOT render/.test(on));
  // Photos never carry words, whatever the setting.
  const photo = buildImagePrompts({ channel: 'website' }, '# T\n\nIntro.', { brand: 'Brand.', count: 1, text: true, style: 'auto', photo: 'PHOTO RULES: no text.' })[0];
  assert.equal(photo.type, 'photo'); assert.match(photo.prompt, /^PHOTO RULES: no text\./); assert.doesNotMatch(photo.prompt, /labels/);
});

test('image choice per section: plan first, content as fallback, graphics capped and never the hero', () => {
  const draft = '# Owned measurement\n\nIntro text.\n\n## The budget meeting\nA CFO and a CMO argue about attribution.\n\n## Five steps\n1. One\n2. Two\n3. Three\n\n## Costs compared\n| Rented | Owned |\n|---|---|\n| $10 | $4 |\n\n## The intake desk\nAdmissions staff answer calls.\n\n## FAQ\nQ and A.';
  const opts = { brand: 'Brand.', count: 8, text: false, photo: 'Photo.' };
  // Other channels: a hero plus one image per section.
  const auto = buildImagePrompts({ channel: 'email' }, draft, { ...opts, style: 'auto' });
  assert.deepEqual(auto.map((p) => p.label), ['Hero photo', 'Photo · The budget meeting', 'Diagram · Five steps', 'Photo · Costs compared', 'Photo · The intake desk'], 'one graphic in five images; the table section falls back to a photo because of the cap; FAQ is skipped');
  assert.equal(parseShotList('no json here'), null);
  assert.equal(parseShotList('```json\n{"images":[{"type":"video","brief":"x"}]}\n```'), null, 'unknown types are dropped');
  const plan = 'Notes\n```json\n{"images":[{"section":"Hero","type":"infographic","brief":"Hero brief"},{"section":"Costs compared","type":"infographic","brief":"Bar comparison"},{"section":"Five steps","type":"diagram","brief":"Steps"},{"section":"The intake desk","type":"photo","brief":"Night shift intake"}]}\n```';
  const planned = buildImagePrompts({ channel: 'email' }, draft, { ...opts, style: 'auto', plan });
  assert.deepEqual(planned.map((p) => [p.type, p.label]), [['photo', 'Hero photo'], ['infographic', 'Infographic · Costs compared'], ['photo', 'Photo · Five steps'], ['photo', 'Photo · The intake desk']], 'the hero is always a photo and only one graphic fits in four images');
  assert.equal(planned[1].aspect, '4:5'); assert.match(planned[3].prompt, /ART DIRECTION FROM THE GRAPHICS PLAN: Night shift intake/);
  assert.ok(suggestsGraphic({ heading: 'Plain', raw: 'Just a paragraph.', body: 'Just a paragraph.' }) === null);

  // Website pages: only the images the page template shows (hero, then after the 1st, middle and second-to-last H2),
  // all landscape. Four sections give two section slots: "The budget meeting" and "Costs compared".
  assert.deepEqual(pageImageSlots(draft).slots, ['Hero', 'The budget meeting', 'Costs compared']);
  const web = buildImagePrompts({ channel: 'website' }, draft, { ...opts, style: 'auto' });
  assert.deepEqual(web.map((p) => p.label), ['Hero photo', 'Photo · The budget meeting', 'Infographic · Costs compared']);
  const webPlanned = buildImagePrompts({ channel: 'website' }, draft, { ...opts, style: 'auto', plan });
  assert.deepEqual(webPlanned.map((p) => [p.type, p.label]), [['photo', 'Hero photo'], ['photo', 'Photo · The budget meeting'], ['infographic', 'Infographic · Costs compared']], 'planned images for sections the page does not show are not generated');
  assert.equal(webPlanned[2].aspect, '3:2'); assert.match(webPlanned[2].prompt, /ART DIRECTION FROM THE GRAPHICS PLAN: Bar comparison/); assert.match(webPlanned[2].prompt, /reads on a phone screen/);
  const six = '# T\n\nLead.\n\n' + ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((h) => `## Section ${h}\nBody ${h}.`).join('\n\n') + '\n\n## Sources\nx\n\n## FAQ\ny';
  assert.deepEqual(pageImageSlots(six).slots, ['Hero', 'Section A', 'Section D', 'Section F'], 'seven sections: after the 1st, the middle (index 3) and the second-to-last');
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
  // A redo goes straight to QA once the new draft lands: Final Approval, with one QA run on the new draft.
  const qa = await waitFor(async () => { const x = await s.api(`/api/tasks/${task.id}`); return x.artifacts.some((a) => a.kind === 'qa') && !x.jobs.some((j) => ['queued', 'running'].includes(j.status)) ? x : false; });
  assert.equal(qa.lane_id, 'mpfresh:final_approval', 'returned to drafting, then sent to QA when the new draft landed');
  assert.equal(qa.artifacts.filter((a) => a.kind === 'qa').length, 1, 'exactly one QA run');
  assert.equal(done.artifacts.filter((a) => a.kind === 'draft').length, 2, 'the earlier draft is kept as a version');
  const sent = JSON.stringify(s.mock.requests.slice(before));
  assert.match(sent, /Cut the second section and cite the 40% figure/, 'the note reaches the model');
  assert.match(sent, /Original draft\./, 'the model revises the current draft rather than starting over');
});
