/**
 * Google Search Console as free, first-party keyword data for briefs (no Semrush units needed).
 *
 * Access is a Google service account added as a (restricted) user on the Search Console property, so the engine can
 * read data in the background without anyone signing in. The service account's JSON key is stored encrypted in the
 * studio settings (or comes from GSC_SERVICE_ACCOUNT_JSON). Read-only scope.
 *
 * For a brief, the engine adds:
 *  - refresh pages: the queries the page itself appeared for in the last 28 days, with clicks, CTR and position;
 *  - every page: queries on the page's topic across the whole site, and which page Google showed for them.
 */
import { createSign } from 'node:crypto';
import { getDb } from './db.mjs';
import { encrypt, decrypt } from './secrets.mjs';

const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
const TOKEN_URL = () => process.env.GOOGLE_TOKEN_URL || 'https://oauth2.googleapis.com/token';
const GSC_BASE = () => (process.env.GSC_BASE_URL || 'https://searchconsole.googleapis.com/webmasters/v3').replace(/\/+$/, '');
const KEY = 'cred:gsc', SITE = 'gsc_site';

const getSetting = (key) => getDb().prepare('SELECT value FROM settings WHERE key=?').get(key)?.value || '';
const setSetting = (key, value) => {
  if (!value) getDb().prepare('DELETE FROM settings WHERE key=?').run(key);
  else getDb().prepare('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)').run(key, String(value));
};

function parseKey(text) {
  let sa; try { sa = JSON.parse(text); } catch { throw new Error('That is not a JSON key file. Paste the whole file you downloaded from Google Cloud.'); }
  if (sa?.type !== 'service_account' || !sa.client_email || !String(sa.private_key || '').includes('PRIVATE KEY')) throw new Error('This JSON is not a service account key (it needs "type": "service_account", client_email and private_key).');
  return { client_email: String(sa.client_email), private_key: String(sa.private_key) };
}
function serviceAccount() {
  const sealed = getSetting(KEY);
  if (sealed) { try { return parseKey(decrypt(sealed)); } catch { return null; } }
  if (process.env.GSC_SERVICE_ACCOUNT_JSON) { try { return parseKey(process.env.GSC_SERVICE_ACCOUNT_JSON); } catch { return null; } }
  return null;
}

// ---------- auth ----------
const tokens = new Map(); // client_email -> { token, expires }
async function accessToken(sa) {
  const cached = tokens.get(sa.client_email);
  if (cached && cached.expires > Date.now() + 60000) return cached.token;
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ iss: sa.client_email, scope: SCOPE, aud: TOKEN_URL(), iat: now, exp: now + 3600 })}`;
  let signature;
  try { signature = createSign('RSA-SHA256').update(unsigned).sign(sa.private_key, 'base64url'); } catch { throw new Error('The service account private key could not be read. Download a new JSON key.'); }
  const r = await fetch(TOKEN_URL(), { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }), signal: AbortSignal.timeout(15000) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.access_token) throw new Error(`Google rejected the service account key (${data.error_description || data.error || r.status}).`);
  tokens.set(sa.client_email, { token: data.access_token, expires: Date.now() + (Number(data.expires_in) || 3600) * 1000 });
  return data.access_token;
}
async function gsc(sa, path, body) {
  const r = await fetch(GSC_BASE() + path, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${await accessToken(sa)}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000) });
  const data = await r.json().catch(() => ({}));
  if (r.status === 403) throw new Error(`The service account ${sa.client_email} has no access to this Search Console property. Add it under Search Console > Settings > Users and permissions.`);
  if (!r.ok) throw new Error(`Search Console returned HTTP ${r.status}: ${data.error?.message || 'request failed'}`);
  return data;
}

// ---------- settings ----------
export function searchConsoleStatus(extra = {}) {
  const sa = serviceAccount();
  return { configured: !!sa, email: sa?.client_email || '', site: getSetting(SITE), source: getSetting(KEY) ? 'saved' : sa ? 'environment' : 'none', ...extra };
}
async function listSites(sa) {
  const data = await gsc(sa, '/sites');
  return (data.siteEntry || []).filter((s) => s.permissionLevel !== 'siteUnverifiedUser').map((s) => s.siteUrl).sort();
}
const preferSite = (sites) => sites.find((s) => /^sc-domain:/.test(s)) || sites[0] || '';

/** { key } saves a service account key (validated against Google first), { site } picks the property, { clear: true } removes both. */
export async function saveSearchConsole(patch = {}) {
  if (patch.clear === true) { setSetting(KEY, ''); setSetting(SITE, ''); return searchConsoleStatus(); }
  if (patch.key !== undefined) {
    const text = String(patch.key || '').trim();
    const sa = parseKey(text);
    const sites = await listSites(sa); // proves the key works before it is stored
    setSetting(KEY, encrypt(JSON.stringify({ type: 'service_account', ...sa })));
    if (!sites.includes(getSetting(SITE))) setSetting(SITE, preferSite(sites));
    return searchConsoleStatus({ sites, hint: sites.length ? '' : `Key works, but ${sa.client_email} has not been added to any Search Console property yet.` });
  }
  if (patch.site !== undefined) {
    const site = String(patch.site || '').trim().slice(0, 300);
    if (site && !/^(sc-domain:[a-z0-9.-]+|https?:\/\/\S+)$/i.test(site)) throw new Error('Pick a Search Console property such as sc-domain:example.com or https://example.com/.');
    setSetting(SITE, site);
  }
  return searchConsoleStatus();
}
export async function testSearchConsole() {
  const sa = serviceAccount(); if (!sa) throw new Error('Add a Search Console service account key first.');
  const sites = await listSites(sa);
  const site = getSetting(SITE);
  if (!site) return searchConsoleStatus({ sites, ok: !!sites.length, hint: sites.length ? 'Pick the property to use.' : `Add ${sa.client_email} as a user in Search Console.` });
  if (!sites.includes(site)) throw new Error(`${sa.client_email} cannot read ${site}. Add it as a user on that property, or pick another one.`);
  const { start, end } = window28();
  const rows = (await gsc(sa, `/sites/${encodeURIComponent(site)}/searchAnalytics/query`, { startDate: start, endDate: end, dimensions: ['query'], rowLimit: 5 })).rows || [];
  return searchConsoleStatus({ sites, ok: true, sample: rows.map((r) => r.keys[0]), period: `${start} to ${end}` });
}

// ---------- brief context ----------
/** Search Console data is final about 3 days after the fact; use the 28 days before that. */
function window28() {
  const day = (d) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
  return { start: day(30), end: day(3) };
}
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const STOP = new Set(['a', 'an', 'and', 'the', 'for', 'of', 'to', 'in', 'on', 'vs', 'how', 'what', 'is', 'are', 'best', 'with', 'your', 'my']);
/** RE2 has no lookahead, so "all key words in any order" is written as the permutations of up to three words. */
function topicRegex(keyword) {
  const words = [...new Set(String(keyword).toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1 && !STOP.has(w)))].slice(0, 3);
  if (!words.length) return null;
  const perms = (a) => a.length <= 1 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p]));
  return perms(words).map((p) => p.map(esc).join('.*')).join('|');
}
export function pageTarget(task) {
  const text = String(task.instructions || '');
  const url = (text.match(/^URL(?: Path)?:\s*(\S+)/mi)?.[1] || String(task.title || '').match(/^B?P\d+-\s*(\/\S*)/)?.[1] || '').trim();
  const mode = (text.match(/^Mode:\s*(new|refresh)/mi)?.[1] || 'new').toLowerCase();
  const path = url ? (url.replace(/^https?:\/\/[^/]+/i, '').replace(/\/+$/, '') || '/') : '';
  return { path, mode };
}
const n = (v) => Number(v || 0).toLocaleString('en-US');
const pct = (v) => `${(Number(v || 0) * 100).toFixed(1)}%`;
const pos = (v) => Number(v || 0).toFixed(1);

/**
 * The Search Console block for a brief prompt. Returns { text, note }; text is '' when Search Console is not set up,
 * so the studio runs exactly as before without it. Never throws: a failure becomes a one-line note in the prompt.
 */
export async function searchConsoleContext(task) {
  const sa = serviceAccount(), site = getSetting(SITE);
  if (!sa || !site) return { text: '', note: '' };
  const { path, mode } = pageTarget(task);
  const keyword = task.primary_keyword || '';
  const { start, end } = window28();
  const domain = site.startsWith('sc-domain:') ? site.slice(10) : site.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/.*$/, '');
  const base = { startDate: start, endDate: end, type: 'web' };
  const q = (body) => gsc(sa, `/sites/${encodeURIComponent(site)}/searchAnalytics/query`, { ...base, ...body }).then((d) => d.rows || []);
  try {
    const out = [`SEARCH CONSOLE (Google, ${start} to ${end}, property ${site}). First-party data; treat positions 8 to 25 as the strongest opportunities and ignore position-1 queries with zero clicks.`];
    let count = 0;
    if (path && mode === 'refresh') {
      const pageRe = `^https?://(www\\.)?${esc(domain)}${esc(path === '/' ? '' : path)}/?$`;
      const filter = { dimensionFilterGroups: [{ filters: [{ dimension: 'page', operator: 'includingRegex', expression: pageRe }] }] };
      const [total] = await q({ ...filter, dimensions: [], rowLimit: 1 });
      const rows = await q({ ...filter, dimensions: ['query'], rowLimit: 25 });
      count += rows.length;
      out.push(total ? `This page (${path}): ${n(total.impressions)} impressions, ${n(total.clicks)} clicks, CTR ${pct(total.ctr)}, average position ${pos(total.position)}.` : `This page (${path}): no impressions in this period.`);
      if (rows.length) out.push('Queries this page appeared for (by impressions):', ...rows.map((r) => `- ${r.keys[0]}: ${n(r.impressions)} impr, ${n(r.clicks)} clicks, CTR ${pct(r.ctr)}, pos ${pos(r.position)}`));
    }
    const re = topicRegex(keyword);
    if (re) {
      const rows = (await q({ dimensions: ['query', 'page'], rowLimit: 20, dimensionFilterGroups: [{ filters: [{ dimension: 'query', operator: 'includingRegex', expression: re }] }] }));
      count += rows.length;
      out.push(rows.length ? `Queries on this topic ("${keyword}") across the site, and the page Google showed:` : `No queries on this topic ("${keyword}") across the site in this period.`);
      for (const r of rows) out.push(`- ${r.keys[0]} -> ${r.keys[1].replace(/^https?:\/\/[^/]+/i, '') || '/'}: ${n(r.impressions)} impr, ${n(r.clicks)} clicks, pos ${pos(r.position)}`);
      if (path && rows.some((r) => (r.keys[1].replace(/^https?:\/\/[^/]+/i, '').replace(/\/+$/, '') || '/') !== path)) out.push('Some of these queries currently land on other pages: avoid creating a competing page; link to or consolidate with them where the intent is the same.');
    }
    return { text: out.join('\n'), note: `Search Console data added to the prompt (${count} query rows, ${start} to ${end}).` };
  } catch (e) {
    const msg = String(e?.message || e);
    return { text: `SEARCH CONSOLE: unavailable for this brief (${msg}). Base keyword decisions on the keyword data in the notes.`, note: `Search Console data unavailable: ${msg}` };
  }
}
