/**
 * Deterministic editorial preflight. Pure functions, no model and no I/O, so the same draft
 * always yields the same findings and the checks are unit-testable.
 *
 * block  = cannot be approved until fixed (or a human records a manual QA sign-off)
 * review = a human must look before approving
 */
const CHANNEL_CHAR_LIMIT = { x: 280, linkedin: 3000, instagram: 2200, gbp: 1500 };
const CHANNEL_NAME = { x: 'X', linkedin: 'LinkedIn', instagram: 'Instagram', gbp: 'Google Business Profile', facebook: 'Facebook', website: 'Website' };
const HASHTAG_LIMIT = { linkedin: 5, facebook: 3, x: 3, instagram: 15, gbp: 0 };

const HYPE = [
  "in today's fast-paced", 'in the ever-evolving', 'ever-changing landscape', 'game-changer', 'game changer', 'game-changing',
  'revolutionize', 'revolutionary', 'unlock the power', 'unleash', 'supercharge', 'skyrocket', 'cutting-edge', 'next-level',
  'seamlessly', "let's dive in", 'dive deep', 'delve', 'look no further', 'in conclusion', "it's no secret", 'the future is here',
  'harness the power', 'take your marketing to the next level', 'elevate your', 'synergy', 'paradigm shift'
];
const ABSOLUTES = /\b(guarantee[ds]?|risk[- ]free|number one|best[- ]in[- ]class|world[- ]class|proven to|never fails?|always works|no[- ]brainer)\b|#1\b|\b100\s?%/gi;
const NUMERIC = /(?<![\w.])(?:\d{1,3}(?:[.,]\d+)*\s?%|\$\s?\d[\d,.]*\s?(?:[kKmMbB]\b|million|billion)?|\d+(?:\.\d+)?[xX]\b)/g;
const PLACEHOLDER = /\[(?:TODO|TBD|TK|INSERT[^\]]*|PLACEHOLDER[^\]]*|CITATION NEEDED|LINK|URL|NAME|COMPANY|CLIENT[^\]]*)\]|lorem ipsum|\{\{[^}\n]+\}\}/gi;
const INTERNAL_KEYS = /<\/?KNOWLEDGE_SOURCE|\b(?:foundation|policy|method|workflow|agent-ref|reference):[a-z0-9][a-z0-9-]+\b/i;
const HEALTH = /\b(patients?|PHI|medical records?|diagnos(?:is|es|ed)|treatment plans?|prescriptions?)\b/i;
const SSN = /\b\d{3}-\d{2}-\d{4}\b/;
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE = /(?<!\d)(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}(?!\d)/;

/**
 * House strip-outs: things the content lead removed from draft after draft in editorial review.
 * Each entry is [pattern, what the reviewer sees]. Founder-voice pieces may name the founder.
 */
const HOUSE_STRIP = [
  [/\bHulick\b/i, 'names Mike Hulick', 'founder'],
  [/\$\s?50\s?(?:million|M\b|MM\b)\+?/i, 'uses the "$50 million" figure'],
  [/\b(?:brand|company|business)\s+valuation\b|\bvalued at\b/i, 'mentions a brand valuation'],
  [/\bMarketing\s?Powered\s+AI\b/i, 'puts "AI" in the brand name'],
  [/\bMarketing Powered,?\s+LLC\b/i, 'adds "LLC" to the brand name'],
  [/\bMarketingPowered\b(?!\.ai)/, 'writes the brand as one word (use "Marketing Powered")'],
  [/\bHaven Health\b/i, 'names a former employer or client (needs their consent)']
];
const CITATION = /\[\d{1,3}\]/;
const SOURCES_HEADING = /^#{1,6}\s*(?:sources?|references?|citations?|works cited)\b/im;
const uniq = (list) => [...new Set(list)];
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
export const wordCount = (s) => (String(s || '').trim().match(/\S+/g) || []).length;

function shingles(text, n = 4) {
  const words = norm(text).split(' ').filter(Boolean), set = new Set();
  for (let i = 0; i + n <= words.length; i++) set.add(words.slice(i, i + n).join(' '));
  return set;
}
function edgeLines(body) {
  const lines = String(body || '').split('\n').map((l) => l.trim())
    .filter((l) => l && !/^(#[\w-]+\s*)+$/.test(l) && !/^[-*_=]{3,}$/.test(l));
  return { first: norm(lines[0]), last: norm(lines.at(-1)) };
}

/**
 * Compare a draft with other drafts in the studio and with the historical draft archive.
 * Uses containment of 4-word shingles: the share of this draft's phrases that already exist elsewhere.
 */
export function repetitionFindings(body, corpus = []) {
  const block = [], review = [];
  const mine = shingles(body), edges = edgeLines(body);
  const overlaps = [];
  for (const other of corpus) {
    if (!other?.body) continue;
    const label = `"${String(other.title || 'another draft').slice(0, 90)}"${other.kind === 'historical' ? ' (historical archive)' : ''}`;
    if (mine.size >= 12) {
      const theirs = shingles(other.body);
      let shared = 0;
      for (const s of mine) if (theirs.has(s)) shared++;
      const ratio = shared / mine.size;
      if (ratio >= 0.25) overlaps.push({ ratio, label });
    }
    const theirEdges = edgeLines(other.body);
    if (edges.last.length >= 25 && edges.last === theirEdges.last) review.push(`Closing line is identical to ${label}. Vary the ending and CTA.`);
    if (edges.first.length >= 25 && edges.first === theirEdges.first) review.push(`Opening hook is identical to ${label}.`);
  }
  overlaps.sort((a, b) => b.ratio - a.ratio);
  for (const o of overlaps.slice(0, 3)) {
    const pct = Math.round(o.ratio * 100);
    if (o.ratio >= 0.6) block.push(`Near-duplicate: ${pct}% of this draft's phrasing already appears in ${o.label}.`);
    else review.push(`Repetition: ${pct}% of this draft's phrasing overlaps with ${o.label}.`);
  }
  return { block, review: uniq(review).slice(0, 6) };
}

export function deterministicQa(task, draftBody, corpus = []) {
  const block = [], review = [];
  const body = String(draftBody || '');
  if (!body.trim()) return { block: ['No draft artifact exists.'], review, metrics: { words: 0, chars: 0, hashtags: 0 } };

  const channel = task.channel || 'website';
  const words = wordCount(body), chars = body.length;
  const hashtags = (body.match(/(?:^|\s)#[A-Za-z][\w-]*/g) || []).length;
  const target = Number(task.word_count) || 0;

  // Length against the commission and the platform.
  if (target && words < Math.min(250, target * 0.5)) review.push(`Draft is short: ${words} words versus ${target} requested.`);
  if (target && words > target * 1.8 && words - target > 150) review.push(`Draft is long: ${words} words versus ${target} requested.`);
  const limit = CHANNEL_CHAR_LIMIT[channel];
  if (limit && chars > limit && task.content_type !== 'carousel') {
    review.push(channel === 'x'
      ? `X output is ${chars} characters; a single post allows ${limit}. Trim it or confirm it is formatted as a thread.`
      : `${CHANNEL_NAME[channel]} output is ${chars} characters, over the ${limit}-character post limit.`);
  }
  if (channel in HASHTAG_LIMIT && hashtags > HASHTAG_LIMIT[channel]) {
    review.push(`${hashtags} hashtags on ${CHANNEL_NAME[channel]} (guideline: at most ${HASHTAG_LIMIT[channel]}). Remove hashtag stuffing.`);
  }

  // Unresolved editing markers can never ship.
  const verify = (body.match(/\[VERIFY[^\]]*\]/gi) || []).length;
  if (verify) block.push(`${verify} unresolved [VERIFY] marker${verify > 1 ? 's' : ''}. Confirm or remove each claim, then rerun QA.`);
  const placeholders = uniq((body.match(PLACEHOLDER) || []).map((x) => x.slice(0, 40)));
  if (placeholders.length) block.push(`Unresolved placeholder text: ${placeholders.slice(0, 5).join(', ')}.`);
  if (INTERNAL_KEYS.test(body)) block.push('Internal knowledge-base identifiers or source tags appear in the draft. Remove them before publishing.');
  // Working notes and placeholders render publicly on the site, so they block like [VERIFY] does.
  const notes = uniq((body.match(/\[(?:PHONE|INTERNAL LINK|EVIDENCE SLOT|EVIDENCE|TBD|TODO|INSERT|PLACEHOLDER|CONFIRM)\b[^\]]*\]/gi) || []).map((x) => x.slice(0, 40)));
  if (notes.length) block.push(`Bracketed working notes in the copy: ${notes.slice(0, 5).join(', ')}.`);
  if (/\]\(#[^)]*\)/.test(body)) block.push('Links pointing to "#" in the copy. Link a real page or remove the link.');
  if (/^#{1,6}\s*(?:production notes|editor(?:'s)? notes|notes for (?:the )?(?:editor|designer|developer)|fact[- ]check(?:ing)?(?: notes| log)?|internal notes|graphics?(?: notes| plan)?|suggested internal links)\b|not for publication/im.test(body)) block.push('Production, editor or fact-check notes are in the copy. The draft must contain only the published page.');
  if (/^\s*(?:sure|certainly|of course|here(?:'s| is| are)|absolutely|great question)\b[^\n]{0,120}[:!.]\s*\n/i.test(body) || /\b(?:let me know if|i hope this helps|feel free to ask|would you like me to)\b/i.test(body.slice(-400))) {
    review.push('Chat-style preamble or sign-off detected. Strip assistant chatter so only the publishable piece remains.');
  }

  // Brand rules.
  const emDashes = (body.match(/—/g) || []).length;
  if (emDashes) review.push(`${emDashes} em dash${emDashes > 1 ? 'es' : ''} found. Brand style avoids em dashes.`);
  if (/follow marketing powered for/i.test(body)) review.push('Template-style "Follow Marketing Powered for..." ending detected. Replace it with a CTA specific to this piece.');
  const lower = body.toLowerCase();
  const hype = HYPE.filter((p) => lower.includes(p));
  if (hype.length) review.push(`Generic AI-hype phrasing: ${hype.slice(0, 6).map((p) => `"${p}"`).join(', ')}.`);

  // Claims that need evidence in regulated marketing.
  // House rule: no number unless it is sourced. A figure counts as cited when its paragraph carries a [n] marker or an
  // inline link to an outside source (the writer cites what it verified as [source](url)).
  const sourced = (para) => CITATION.test(para) || /\]\(https?:\/\/(?!(?:www\.)?marketingpowered\.ai)[^)]+\)/i.test(para);
  const uncited = uniq(body.split(/\n\s*\n|\n(?=[-*]\s|\d+[.)]\s|#)/).filter((para) => !sourced(para) && !SOURCES_HEADING.test(para)).flatMap((para) => para.match(NUMERIC) || []).map((x) => x.trim()));
  const cited = uniq((body.match(NUMERIC) || []).map((x) => x.trim())).length - uncited.length;
  if (uncited.length) review.push(`Numeric claims need a source on file: ${uncited.slice(0, 6).join(', ')}${uncited.length > 6 ? ` and ${uncited.length - 6} more` : ''}. Cite the source inline as a link in the same paragraph, or remove the figure.${cited > 0 ? ` (${cited} other figure${cited > 1 ? 's are' : ' is'} cited.)` : ''}`);
  const stripped = HOUSE_STRIP.filter(([re, , exceptVoice]) => re.test(body) && task.voice !== exceptVoice).map(([, label]) => label);
  if (stripped.length) review.push(`House strip-outs: the draft ${stripped.join('; ')}. Editorial review removes these.`);
  const absolutes = uniq((body.match(ABSOLUTES) || []).map((x) => x.toLowerCase()));
  if (absolutes.length) review.push(`Absolute or guarantee language: ${absolutes.slice(0, 5).join(', ')}. Soften or substantiate.`);

  // Privacy.
  if (SSN.test(body)) block.push('A pattern that looks like a Social Security number is present. Remove it.');
  if (EMAIL.test(body)) review.push('An email address appears in the copy. Confirm it is a public business contact.');
  if (PHONE.test(body)) review.push('A phone number appears in the copy. Confirm it is the correct public line.');
  if (HEALTH.test(body)) review.push('Healthcare terms detected. Perform a privacy and compliance review; no patient-identifying details.');

  // Website structure and metadata.
  if (channel === 'website') {
    const h1 = (body.match(/^#\s+\S.*$/gm) || []).length;
    if (h1 === 0) review.push('Website copy has no Markdown H1.');
    if (h1 > 1) review.push(`Website copy has ${h1} H1 headings; use exactly one.`);
    if (words > 400 && !/^##\s+\S/m.test(body)) review.push('Long-form website copy has no H2 sections.');
    const metaTitle = body.match(/meta\s*title\W{0,6}[:：]\W{0,4}([^\n]+)/i)?.[1]?.replace(/[*_`]+/g, '').trim();
    const metaDesc = body.match(/meta\s*description\W{0,6}[:：]\W{0,4}([^\n]+)/i)?.[1]?.replace(/[*_`]+/g, '').trim();
    if (metaTitle && metaTitle.length > 60) review.push(`Meta title is ${metaTitle.length} characters (aim for 60 or fewer).`);
    if (metaDesc && metaDesc.length > 160) review.push(`Meta description is ${metaDesc.length} characters (aim for 160 or fewer).`);
    if (!metaTitle && !metaDesc) review.push('No meta title or meta description found.');
    // Citations and links: bracketed numbers with a source list, plus internal and outbound links.
    if (words > 400) {
      // Sources are cited inline as links; numbered [n] markers are optional but then need a Sources list.
      if (CITATION.test(body) && !SOURCES_HEADING.test(body)) review.push('Bracketed citations are used but there is no Sources section listing them.');
      const links = [...body.matchAll(/\]\(([^)\s]+)[^)]*\)/g)].map((m) => m[1]).concat(body.match(/(?<![(\w])https?:\/\/[^\s)>\]]+/g) || []);
      const internal = links.filter((u) => /^\/(?!\/)/.test(u) || /^https?:\/\/(?:www\.)?marketingpowered\.ai\b/i.test(u));
      const outbound = links.filter((u) => /^https?:\/\//i.test(u) && !/^https?:\/\/(?:www\.)?marketingpowered\.ai\b/i.test(u));
      if (!internal.length) review.push('No internal links found. Link to related Marketing Powered pages.');
    }
    const keyword = String(task.primary_keyword || '').trim().toLowerCase();
    if (keyword && !lower.includes(keyword)) review.push(`Primary keyword "${task.primary_keyword}" does not appear in the copy.`);
  }

  const rep = repetitionFindings(body, corpus);
  block.push(...rep.block); review.push(...rep.review);
  return { block, review, metrics: { words, chars, hashtags } };
}

/** Read PASS / REVIEW / FAIL out of a model-written QA report without being fooled by an echoed template heading. */
export function modelVerdict(report) {
  const text = String(report || '').replace(/\(?\s*PASS\s*\/\s*REVIEW\s*\/\s*FAIL\s*\)?/gi, ' ');
  const at = text.search(/verdict/i);
  const windowText = at >= 0 ? text.slice(at, at + 260) : text.slice(0, 200);
  const hit = windowText.match(/\b(PASS|REVIEW|FAIL)(?:ED|ES|S)?\b/);
  return hit ? hit[1] : null;
}

export function qaStatusFor(det, verdict) {
  const block = [...det.block];
  if (verdict === 'FAIL') block.unshift('The editorial QA model rated the draft FAIL.');
  // Pass or fail. Review notes are advisory; a person decides on a FAIL (approve anyway, or redo).
  const status = block.length ? 'blocked' : 'pass';
  return { status, block };
}

export function formatQaReport(det, verdict, modelBody) {
  const { status, block } = qaStatusFor(det, verdict);
  const label = { blocked: 'FAIL', pass: 'PASS' }[status];
  const flags = [...block.map((s) => `- BLOCK: ${s}`), ...det.review.map((s) => `- NOTE: ${s}`)];
  const m = det.metrics;
  return {
    status,
    body: `## Deterministic checks\n**Automatic status: ${label}** · ${m.words.toLocaleString('en-US')} words · ${m.chars.toLocaleString('en-US')} characters${m.hashtags ? ` · ${m.hashtags} hashtags` : ''}\n\n${flags.length ? flags.join('\n') : 'No automatic issues detected.'}\n\n## Local model review\n${modelBody}\n\n**Human editorial approval is still required.**`
  };
}

/** True when a QA report still carries a blocking finding. Tolerates list markers and bold. */
export const hasBlockingFinding = (reportBody) => /^\s*(?:[-*+]\s*)?\**BLOCK\**:/m.test(String(reportBody || ''));
