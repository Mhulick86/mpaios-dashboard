#!/usr/bin/env node
/**
 * Stand-in for LM Studio: a tiny OpenAI-compatible server (/v1/models, /v1/chat/completions, streaming).
 * It lets you click through the whole production flow, and lets the test suite run, with no model loaded.
 * Everything it writes is canned placeholder text and is labelled as such. Never use it for real content.
 *
 *   node scripts/mock-model.mjs [port]      # default 1234, the LM Studio port
 *   npm run demo                            # mock model + studio together
 */
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const NOTE = '> MOCK OUTPUT: canned placeholder text from scripts/mock-model.mjs, not written by a real model.';
const field = (prompt, name) => (prompt.match(new RegExp(`^${name}: (.*)$`, 'm'))?.[1] || '').trim();

export function stageOf(prompt) {
  if (prompt.startsWith('Prepare a production-ready editorial brief')) return 'brief';
  if (/^Prepare \d+ distinct visual concepts/.test(prompt) || prompt.startsWith('Plan the images for this piece')) return 'graphics';
  if (prompt.startsWith('Review the current draft')) return 'qa';
  if (prompt.startsWith('Revise the CURRENT DRAFT')) return 'revise';
  return 'draft';
}
function write(prompt) {
  const stage = stageOf(prompt), topic = field(prompt, 'TOPIC') || 'Untitled topic', channel = field(prompt, 'CHANNEL') || 'website';
  const audience = field(prompt, 'AUDIENCE') || 'marketing decision makers', keyword = field(prompt, 'PRIMARY KEYWORD') || topic;
  const cta = field(prompt, 'CTA') || 'Talk to the team about your measurement setup.';
  // Test directives, driven by markers in the topic.
  const unverified = /UNVERIFIED/.test(topic), failcase = /FAILCASE/.test(topic);
  if (stage === 'brief') return `${NOTE}\n\n## 1. Thesis and business case\n${topic}: the organisations that own their measurement and their models make better budget decisions than the ones renting both.\n\n## 2. Target audience and problem\n${audience}. They are asked to prove revenue impact with platform-reported numbers they cannot audit.\n\n## 3. Single central insight\nOwnership of the data and the inference layer is a finance decision before it is a technology decision.\n\n## 4. Editorial angle\nOperator-led and specific. No generic AI enthusiasm.\n\n## 5. Evidence required\n- Named first-party sources for every figure\n- No client outcomes without written approval\n\n## 6. Recommended structure\n1. The decision the reader is facing\n2. What rented intelligence costs over three years\n3. What ownership requires\n4. A practical first step\n\n## 7. Keywords\nPrimary: ${keyword}\n\n## 8. CTA\n${cta}\n\n## 9. Creative brief\nOne process diagram and one comparison table.\n\n## 10. Acceptance criteria\nOriginal argument, verifiable claims, one clear next action.`;
  if (stage === 'graphics') return `${NOTE}\n\n## Visual 1: process diagram\n- **Placement:** after the second section\n- **Direction:** left-to-right flow from first-party signal to budget decision, sky blue #2CACE8 on black, green #08AE67 for the outcome node\n- **Overlay text:** "Signal, decision, revenue"\n- **Dimensions:** ${channel === 'website' ? '1600 x 900' : '1080 x 1350'}\n- **Alt text:** Diagram showing how first-party marketing signals feed budget decisions.\n- **Claim check:** no figures shown\n\n## Visual 2: comparison table\n- **Placement:** before the CTA\n- **Direction:** two columns, rented versus owned, three rows\n- **Alt text:** Table comparing rented and owned marketing intelligence.\n\n## Consistency checklist\n- Brand colors only\n- Mobile crop checked\n- Spelling verified\n\n\`\`\`json\n${JSON.stringify({ images: [{ section: 'Hero', type: 'photo', brief: 'A hospital marketing director and a finance lead reviewing the quarter together in a bright meeting room.', alt: 'Two hospital leaders reviewing marketing results together.' }, { section: 'What ownership requires', type: 'diagram', brief: 'Three linked blocks: first-party data layer, inference where the data lives, human approval step.', alt: 'Diagram of the three requirements of owned measurement.' }, { section: 'The decision in front of the reader', type: 'photo', brief: 'A CMO at her desk weighing two budget options, laptop open, late afternoon light.', alt: 'A marketing leader weighing a budget decision.' }] })}\n\`\`\`\n`;
  if (stage === 'qa') return `Verdict: ${failcase ? 'FAIL' : 'REVIEW'}\n\n${NOTE}\n\n## Findings\n- The central argument is clear and specific to the stated audience.\n- ${failcase ? 'The draft asserts a client outcome with no source. This cannot ship.' : 'One claim about budget decisions needs a named source before publication.'}\n\n## Factual verification items\n- Confirm any figure against a first-party report.\n\n## Brand voice and repetition\n- Voice matches the operator-led profile. Ending is specific to the piece.\n\n## Channel-specific checks\n- Format suits ${channel}.\n\n## Recommended edits\n- Tighten the opening paragraph.`;
  const revised = stage === 'revise' ? ' This revision addresses the reviewer feedback and the QA findings.' : '';
  const claim = unverified ? '\n\n[VERIFY] Teams that own their attribution cut wasted spend by a third. Which report supports this?' : '';
  if (channel === 'website') return `# ${topic}\n\n**Meta title:** ${topic.length > 58 ? topic.slice(0, 58).replace(/\s+\S*$/, '') : topic}\n**Meta description:** A practical look at ${keyword} for ${audience.slice(0, 60)}.\n\n${NOTE}\n\nMost marketing reports describe activity. Very few describe decisions.${revised} This piece is about ${keyword} and what changes when the organisation, not the ad platform, owns the measurement.${claim}\n\n## The decision in front of the reader\nBudget moves every quarter. The question is whether it moves on evidence the team can audit.\n\n## What rented intelligence costs\nSubscriptions are the visible cost. The hidden cost is that the model of your customer lives in someone else's system.\n\n## What ownership requires\n- A first-party data layer the team controls\n- Inference that runs where the data lives\n- A human approval step before anything is published\n\n## A practical first step\nAudit one conversion path end to end before buying another tool.\n\n## Next step\n${cta}`;
  return `${topic}.\n\nMost teams can tell you what they spent. Few can tell you which decision that spend supported.${revised}${claim}\n\nThree questions worth asking this quarter:\n1. Who owns the data behind the dashboard?\n2. Where does the model that scores your leads actually run?\n3. Who approves a claim before it is published?\n\n${cta}\n\n${NOTE}`;
}

export function createMockModel({ delayMs = Number(process.env.MOCK_DELAY_MS ?? 25), modelId = 'mock-local-instruct' } = {}) {
  const requests = [];
  const server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/v1/models') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ data: [{ id: modelId, owned_by: 'mock' }] }));
    }
    if (req.method === 'POST' && req.url === '/v1/chat/completions') {
      let raw = ''; req.on('data', (c) => { raw += c; });
      req.on('end', async () => {
        let q; try { q = JSON.parse(raw); } catch { res.writeHead(400); return res.end('{"error":{"message":"bad json"}}'); }
        const prompt = String(q.messages?.at(-1)?.content || '');
        requests.push({ model: q.model, stream: !!q.stream, system: String(q.messages?.[0]?.content || ''), user: prompt, stage: stageOf(prompt) });
        const topic = field(prompt, 'TOPIC');
        // Reasoning models wrap chain-of-thought in <think>; the studio must strip it.
        const text = (/THINKCASE/.test(topic) ? '<think>private reasoning that must never reach an artifact</think>\n' : '') + write(prompt);
        const slow = /SLOWCASE/.test(topic) ? 400 : delayMs;
        if (!q.stream) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content: text }, finish_reason: 'stop' }] }));
        }
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
        const parts = text.match(/\S+\s*/g) || [text];
        for (let i = 0; i < parts.length && !res.destroyed; i += 3) {
          res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: parts.slice(i, i + 3).join('') } }] })}\n\n`);
          if (slow) await new Promise((r) => setTimeout(r, slow));
        }
        if (!res.destroyed) { res.write(`data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] })}\n\ndata: [DONE]\n\n`); res.end(); }
      });
      return;
    }
    res.writeHead(404); res.end();
  });
  return { server, requests, listen: (port, host = '127.0.0.1') => new Promise((ok) => server.listen(port, host, () => ok(server.address().port))), close: () => new Promise((ok) => { server.closeAllConnections?.(); server.close(ok); }) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.argv[2] || process.env.MOCK_MODEL_PORT || 1234);
  const mock = createMockModel();
  await mock.listen(port);
  console.log(`Mock model server (placeholder text only): http://127.0.0.1:${port}/v1`);
}
