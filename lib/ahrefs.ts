/**
 * Ahrefs API v3 Integration
 * https://docs.ahrefs.com/reference
 */

const AHREFS_BASE = "https://api.ahrefs.com/v3";

interface AhrefsRequestOptions {
  apiKey: string;
  endpoint: string;
  params?: Record<string, string | number | boolean>;
}

async function ahrefsFetch<T>({ apiKey, endpoint, params }: AhrefsRequestOptions): Promise<T> {
  const url = new URL(`${AHREFS_BASE}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `Ahrefs API error: ${res.status}`);
  }

  return res.json();
}

// ── Domain Overview ──

export interface DomainRating {
  domain_rating: number;
  ahrefs_rank: number;
}

export async function getDomainRating(apiKey: string, target: string): Promise<DomainRating> {
  return ahrefsFetch({
    apiKey,
    endpoint: "/site-explorer/domain-rating",
    params: { target, output: "json" },
  });
}

// ── Backlink Stats ──

export interface BacklinksOverview {
  live: number;
  all_time: number;
  live_refdomains: number;
  all_time_refdomains: number;
}

export async function getBacklinksOverview(apiKey: string, target: string): Promise<BacklinksOverview> {
  return ahrefsFetch({
    apiKey,
    endpoint: "/site-explorer/backlinks-stats",
    params: { target, output: "json" },
  });
}

// ── Organic Keywords ──

export interface OrganicKeyword {
  keyword: string;
  volume: number;
  position: number;
  url: string;
  traffic: number;
  cpc: number;
  difficulty: number;
}

export interface OrganicKeywordsResponse {
  keywords: OrganicKeyword[];
  total_count: number;
}

export async function getOrganicKeywords(
  apiKey: string,
  target: string,
  limit: number = 20,
  country: string = "us"
): Promise<OrganicKeywordsResponse> {
  return ahrefsFetch({
    apiKey,
    endpoint: "/site-explorer/organic-keywords",
    params: { target, country, limit, output: "json", order_by: "traffic:desc" },
  });
}

// ── Top Pages ──

export interface TopPage {
  url: string;
  organic_traffic: number;
  organic_keywords: number;
  referring_domains: number;
}

export interface TopPagesResponse {
  pages: TopPage[];
  total_count: number;
}

export async function getTopPages(
  apiKey: string,
  target: string,
  limit: number = 20,
  country: string = "us"
): Promise<TopPagesResponse> {
  return ahrefsFetch({
    apiKey,
    endpoint: "/site-explorer/top-pages",
    params: { target, country, limit, output: "json", order_by: "organic_traffic:desc" },
  });
}

// ── Referring Domains ──

export interface ReferringDomain {
  domain: string;
  domain_rating: number;
  backlinks: number;
  first_seen: string;
}

export interface ReferringDomainsResponse {
  refdomains: ReferringDomain[];
  total_count: number;
}

export async function getReferringDomains(
  apiKey: string,
  target: string,
  limit: number = 20
): Promise<ReferringDomainsResponse> {
  return ahrefsFetch({
    apiKey,
    endpoint: "/site-explorer/refdomains",
    params: { target, limit, output: "json", order_by: "domain_rating:desc" },
  });
}

// ── Keyword Explorer ──

export interface KeywordData {
  keyword: string;
  volume: number;
  difficulty: number;
  cpc: number;
  clicks: number;
  global_volume: number;
}

export async function getKeywordOverview(
  apiKey: string,
  keyword: string,
  country: string = "us"
): Promise<KeywordData> {
  return ahrefsFetch({
    apiKey,
    endpoint: "/keywords-explorer/overview",
    params: { keyword, country, output: "json" },
  });
}

export interface RelatedKeyword {
  keyword: string;
  volume: number;
  difficulty: number;
  cpc: number;
}

export async function getRelatedKeywords(
  apiKey: string,
  keyword: string,
  limit: number = 20,
  country: string = "us"
): Promise<{ keywords: RelatedKeyword[] }> {
  return ahrefsFetch({
    apiKey,
    endpoint: "/keywords-explorer/related-terms",
    params: { keyword, country, limit, output: "json" },
  });
}

// ── Competitor Analysis ──

export interface Competitor {
  domain: string;
  common_keywords: number;
  organic_traffic: number;
  domain_rating: number;
}

export async function getOrganicCompetitors(
  apiKey: string,
  target: string,
  limit: number = 10,
  country: string = "us"
): Promise<{ competitors: Competitor[] }> {
  return ahrefsFetch({
    apiKey,
    endpoint: "/site-explorer/organic-competitors",
    params: { target, country, limit, output: "json" },
  });
}

// ── Full Site Audit Context Builder ──
// Pulls multiple endpoints and formats as markdown for LLM context

export async function buildAhrefsContext(
  apiKey: string,
  target: string,
  country: string = "us"
): Promise<string> {
  const results = await Promise.allSettled([
    getDomainRating(apiKey, target),
    getBacklinksOverview(apiKey, target),
    getOrganicKeywords(apiKey, target, 15, country),
    getTopPages(apiKey, target, 10, country),
    getReferringDomains(apiKey, target, 10),
    getOrganicCompetitors(apiKey, target, 5, country),
  ]);

  let ctx = `\n\n## Ahrefs Data for ${target}\n\n`;

  // Domain Rating
  if (results[0].status === "fulfilled") {
    const dr = results[0].value;
    ctx += `**Domain Rating:** ${dr.domain_rating} | **Ahrefs Rank:** ${dr.ahrefs_rank.toLocaleString()}\n\n`;
  }

  // Backlinks
  if (results[1].status === "fulfilled") {
    const bl = results[1].value;
    ctx += `**Backlinks:** ${bl.live.toLocaleString()} live (${bl.live_refdomains.toLocaleString()} referring domains)\n\n`;
  }

  // Organic Keywords
  if (results[2].status === "fulfilled") {
    const kw = results[2].value;
    ctx += `**Organic Keywords:** ${kw.total_count.toLocaleString()} total\n`;
    ctx += `| Keyword | Volume | Position | Traffic | KD |\n|---------|--------|----------|---------|----|\n`;
    kw.keywords.slice(0, 10).forEach((k) => {
      ctx += `| ${k.keyword} | ${k.volume.toLocaleString()} | ${k.position} | ${k.traffic.toLocaleString()} | ${k.difficulty} |\n`;
    });
    ctx += "\n";
  }

  // Top Pages
  if (results[3].status === "fulfilled") {
    const tp = results[3].value;
    ctx += `**Top Pages by Traffic:**\n`;
    tp.pages.slice(0, 8).forEach((p) => {
      ctx += `- ${p.url} — ${p.organic_traffic.toLocaleString()} visits, ${p.organic_keywords} keywords, ${p.referring_domains} refdomains\n`;
    });
    ctx += "\n";
  }

  // Referring Domains
  if (results[4].status === "fulfilled") {
    const rd = results[4].value;
    ctx += `**Top Referring Domains:**\n`;
    rd.refdomains.slice(0, 8).forEach((d) => {
      ctx += `- ${d.domain} (DR ${d.domain_rating}) — ${d.backlinks} backlinks\n`;
    });
    ctx += "\n";
  }

  // Competitors
  if (results[5].status === "fulfilled") {
    const comp = results[5].value;
    ctx += `**Organic Competitors:**\n`;
    comp.competitors.forEach((c) => {
      ctx += `- ${c.domain} (DR ${c.domain_rating}) — ${c.common_keywords.toLocaleString()} common keywords, ${c.organic_traffic.toLocaleString()} traffic\n`;
    });
    ctx += "\n";
  }

  return ctx;
}
