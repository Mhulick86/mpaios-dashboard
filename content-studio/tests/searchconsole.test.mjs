// Search Console as free keyword data for briefs: service account auth, encrypted key, data in the brief prompt.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { generateKeyPairSync, createVerify } from 'node:crypto';
import { startStudio, waitFor } from './helpers.mjs';

function fakeGoogle(t, publicKey) {
  const seen = { tokens: 0, queries: [] };
  const server = http.createServer(async (req, res) => {
    const chunks = []; for await (const c of req) chunks.push(c); const body = Buffer.concat(chunks).toString();
    const send = (status, value) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value)); };
    if (req.url === '/token') {
      const assertion = new URLSearchParams(body).get('assertion') || '';
      const [h, c, s] = assertion.split('.');
      const ok = createVerify('RSA-SHA256').update(`${h}.${c}`).verify(publicKey, Buffer.from(s, 'base64url'));
      const claim = JSON.parse(Buffer.from(c, 'base64url').toString());
      if (!ok || claim.scope !== 'https://www.googleapis.com/auth/webmasters.readonly') return send(400, { error: 'invalid_grant' });
      seen.tokens++; return send(200, { access_token: 'gsc-token', expires_in: 3600 });
    }
    if (req.headers.authorization !== 'Bearer gsc-token') return send(401, { error: { message: 'no auth' } });
    if (req.url === '/sites') return send(200, { siteEntry: [{ siteUrl: 'sc-domain:marketingpowered.ai', permissionLevel: 'siteRestrictedUser' }, { siteUrl: 'https://other.example/', permissionLevel: 'siteUnverifiedUser' }] });
    if (req.url.startsWith('/sites/sc-domain%3Amarketingpowered.ai/searchAnalytics/query')) {
      const q = JSON.parse(body); seen.queries.push(q);
      const dims = (q.dimensions || []).join();
      if (dims === '') return send(200, { rows: [{ keys: [], clicks: 0, impressions: 2154, ctr: 0, position: 69.6 }] });
      if (dims === 'query') return send(200, { rows: [{ keys: ['mental health marketing'], clicks: 0, impressions: 435, ctr: 0, position: 18.2 }] });
      if (dims === 'query,page') return send(200, { rows: [{ keys: ['mental health marketing agency', 'https://marketingpowered.ai/resources/mental-health-marketing'], clicks: 1, impressions: 90, ctr: 0.011, position: 12.4 }] });
    }
    send(404, { error: { message: 'not found' } });
  });
  t.after(() => new Promise((ok) => server.close(ok)));
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok({ seen, base: `http://127.0.0.1:${server.address().port}` })));
}

test('Search Console: service account key, property choice, and first-party data in the brief prompt', async (t) => {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const g = await fakeGoogle(t, publicKey);
  const s = await startStudio(t, { env: { GOOGLE_TOKEN_URL: `${g.base}/token`, GSC_BASE_URL: g.base, AUTO_GENERATE_ON_MOVE: 'false' } });
  assert.equal((await s.api('/api/searchconsole')).configured, false);
  await assert.rejects(s.api('/api/searchconsole', 'PATCH', { key: '{"type":"authorized_user"}' }), /not a service account key/);

  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' });
  const key = JSON.stringify({ type: 'service_account', client_email: 'maios-search-console@proj.iam.gserviceaccount.com', private_key: pem, project_id: 'proj' });
  const saved = await s.api('/api/searchconsole', 'PATCH', { key });
  assert.equal(saved.configured, true); assert.equal(saved.site, 'sc-domain:marketingpowered.ai', 'the domain property is picked automatically');
  assert.deepEqual(saved.sites, ['sc-domain:marketingpowered.ai'], 'unverified properties are not offered');
  assert.ok(!JSON.stringify(await s.api('/api/export')).includes('PRIVATE KEY'), 'the key never leaves the server');
  assert.ok(!JSON.stringify(await s.api('/api/bootstrap')).includes('PRIVATE KEY'));
  assert.equal((await s.api('/api/searchconsole/test', 'POST', {})).ok, true);

  const { tasks: [task] } = await s.api('/api/commission', 'POST', { topic: 'Mental health marketing agency page', outputs: ['website'], voice: 'company', primary_keyword: 'mental health marketing agency', instructions: 'Mode: refresh\nPrimary Keyword: mental health marketing agency\nURL: /who-we-help/mental-health\nPriority Group: P0' });
  await s.api(`/api/tasks/${task.id}/generate`, 'POST', { kind: 'brief' });
  await waitFor(async () => (await s.api(`/api/tasks/${task.id}`)).artifacts.some((a) => a.kind === 'brief'));
  const prompt = s.mock.requests.find((r) => r.stage === 'brief').user;
  assert.match(prompt, /SEARCH CONSOLE DATA/);
  assert.match(prompt, /This page \(\/who-we-help\/mental-health\): 2,154 impressions, 0 clicks/);
  assert.match(prompt, /- mental health marketing: 435 impr, 0 clicks, CTR 0\.0%, pos 18\.2/);
  assert.match(prompt, /mental health marketing agency -> \/resources\/mental-health-marketing/);
  assert.match(prompt, /land on other pages/, 'flags that the topic currently ranks on a different URL');
  const pageFilter = g.seen.queries.find((q) => q.dimensions?.join() === 'query' && q.dimensionFilterGroups).dimensionFilterGroups[0].filters[0];
  assert.equal(pageFilter.operator, 'includingRegex'); assert.match('https://marketingpowered.ai/who-we-help/mental-health/', new RegExp(pageFilter.expression));
  const detail = await s.api(`/api/tasks/${task.id}`);
  assert.ok(detail.events.some((e) => e.event_type === 'searchconsole' && /Search Console data added/.test(e.message)), 'the task history says Search Console data was used');
  assert.equal(g.seen.tokens, 1, 'the access token is reused');

  // Draft prompts do not get it; briefs without Search Console set up are unchanged.
  await s.api('/api/searchconsole', 'PATCH', { clear: true });
  assert.equal((await s.api('/api/searchconsole')).configured, false);
  await s.api(`/api/tasks/${task.id}/generate`, 'POST', { kind: 'brief' });
  await waitFor(async () => (await s.api(`/api/tasks/${task.id}`)).artifacts.filter((a) => a.kind === 'brief').length === 2);
  assert.doesNotMatch(s.mock.requests.filter((r) => r.stage === 'brief').at(-1).user, /SEARCH CONSOLE DATA/);
});
