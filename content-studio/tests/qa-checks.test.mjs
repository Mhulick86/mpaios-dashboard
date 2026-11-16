import test from 'node:test';
import assert from 'node:assert/strict';
import { deterministicQa, modelVerdict, formatQaReport, hasBlockingFinding, repetitionFindings } from '../qa-checks.mjs';

const social = { channel: 'linkedin', content_type: 'company_post', word_count: 60, primary_keyword: '' };
const clean = 'Most teams can report what they spent. Few can say which decision that spend supported. Ask who owns the data behind the dashboard, where the scoring model runs, and who signs off a claim before it ships. Start with one conversion path and audit it end to end before you buy another tool this quarter.';

test('a clean social draft raises nothing', () => {
  const r = deterministicQa(social, clean, []);
  assert.deepEqual(r.block, []); assert.deepEqual(r.review, []);
  assert.equal(r.metrics.words, clean.split(/\s+/).length);
});
test('unresolved markers and leaked internals block approval', () => {
  const r = deterministicQa(social, clean + '\n[VERIFY] 40% of budgets are wasted. Source?\nSee [INSERT LINK] and policy:claims.', []);
  assert(r.block.some((x) => /\[VERIFY\]/.test(x)));
  assert(r.block.some((x) => /placeholder/i.test(x)));
  assert(r.block.some((x) => /Internal knowledge-base/.test(x)));
  assert(r.review.some((x) => /Numeric claims/.test(x) && /40%/.test(x)));
  assert(deterministicQa(social, '', []).block.includes('No draft artifact exists.'));
  assert(deterministicQa(social, clean + ' SSN 123-45-6789', []).block.some((x) => /Social Security/.test(x)));
});
test('brand rules: em dashes, template CTA, hype, guarantees, chatter', () => {
  const r = deterministicQa(social, `Here is your post:\n${clean} This is a game-changer — guaranteed results. Follow Marketing Powered for more.`, []);
  const all = r.review.join('\n');
  assert.match(all, /em dash/); assert.match(all, /Follow Marketing Powered/); assert.match(all, /game-changer/);
  assert.match(all, /guarantee/); assert.match(all, /Chat-style/);
});
test('channel limits and hashtags', () => {
  const x = deterministicQa({ channel: 'x', content_type: 'company_post', word_count: 40 }, 'word '.repeat(70), []);
  assert(x.review.some((s) => /280/.test(s)));
  const tags = deterministicQa(social, clean + ' #a1 #b2 #c3 #d4 #e5 #f6', []);
  assert(tags.review.some((s) => /6 hashtags/.test(s)));
  const carousel = deterministicQa({ channel: 'instagram', content_type: 'carousel', word_count: 400 }, 'slide text '.repeat(260), []);
  assert(!carousel.review.some((s) => /character/.test(s)), 'carousel slide copy is not held to the caption limit');
});
test('website structure, metadata and keyword', () => {
  const web = { channel: 'website', content_type: 'article', word_count: 40, primary_keyword: 'data sovereignty' };
  const bad = deterministicQa(web, 'No heading here. ' + clean, []);
  assert(bad.review.some((s) => /no Markdown H1/.test(s)));
  assert(bad.review.some((s) => /Primary keyword/.test(s)));
  assert(bad.review.some((s) => /meta title/i.test(s)));
  const good = deterministicQa(web, `# Data sovereignty for marketers\n**Meta title:** Data sovereignty for marketers\n**Meta description:** Why it matters.\n\n${clean}`, []);
  assert.deepEqual(good.review, []);
  const long = deterministicQa(web, `# T\nMeta title: ${'x'.repeat(75)}\nMeta description: ok\ndata sovereignty ${clean}`, []);
  assert(long.review.some((s) => /Meta title is 75/.test(s)));
});
test('repetition against other drafts and the historical archive', () => {
  const dup = repetitionFindings(clean, [{ title: 'Earlier post', body: clean, kind: 'historical' }]);
  assert(dup.block.some((s) => /Near-duplicate: 100%/.test(s) && /historical archive/.test(s)));
  const ending = 'Start with one conversion path and audit it end to end before you buy another tool this quarter.';
  const other = `A completely different argument about paid search budgets and how finance teams read them every month.\n${ending}`;
  const rep = repetitionFindings(`${clean.replace(' ' + ending, '')}\n${ending}`, [{ title: 'Sibling', body: other, kind: 'draft' }]);
  assert(rep.review.some((s) => /Closing line is identical/.test(s)));
  assert.deepEqual(repetitionFindings(clean, [{ title: 'Unrelated', body: 'Entirely separate words about hospital call centres and staffing rotas across regions.', kind: 'draft' }]), { block: [], review: [] });
});
test('model verdict parsing ignores an echoed template heading', () => {
  assert.equal(modelVerdict('## Verdict\nPASS\n## Findings'), 'PASS');
  assert.equal(modelVerdict('Verdict: FAIL\nreasons'), 'FAIL');
  assert.equal(modelVerdict('## Executive verdict (PASS / REVIEW / FAIL)\n**REVIEW**'), 'REVIEW');
  assert.equal(modelVerdict('**Executive Verdict:** **FAIL**'), 'FAIL');
  assert.equal(modelVerdict('No structured answer at all.'), null);
});
test('report formatting drives the approval gate', () => {
  const blocked = formatQaReport({ block: ['Bad thing.'], review: ['Look here.'], metrics: { words: 10, chars: 60, hashtags: 0 } }, 'PASS', 'model text');
  assert.equal(blocked.status, 'blocked'); assert(hasBlockingFinding(blocked.body));
  const failed = formatQaReport({ block: [], review: [], metrics: { words: 10, chars: 60, hashtags: 0 } }, 'FAIL', 'model text');
  assert.equal(failed.status, 'blocked'); assert(hasBlockingFinding(failed.body));
  const review = formatQaReport({ block: [], review: ['Look here.'], metrics: { words: 10, chars: 60, hashtags: 0 } }, 'PASS', 'model text');
  assert.equal(review.status, 'pass', 'notes do not fail a draft'); assert(!hasBlockingFinding(review.body)); assert.match(review.body, /- NOTE: Look here\./);
  const pass = formatQaReport({ block: [], review: [], metrics: { words: 10, chars: 60, hashtags: 0 } }, 'PASS', 'The word BLOCK: inside a sentence is not a finding line.');
  assert.equal(pass.status, 'pass'); assert(!hasBlockingFinding(pass.body));
  assert.equal(formatQaReport({ block: [], review: [], metrics: { words: 1, chars: 1, hashtags: 0 } }, null, 'x').status, 'pass', 'pass or fail: no verdict line is not a fail');
});
