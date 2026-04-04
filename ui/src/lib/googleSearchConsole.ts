// ─── Google Search Console Integration Types & Helpers ───

const GSC_BASE = "https://www.googleapis.com/webmasters/v3";
const GSC_SEARCH_BASE = "https://searchconsole.googleapis.com/webmasters/v3";

/* ---------- Types ---------- */

export interface GSCSite {
  siteUrl: string;
  permissionLevel: string;
}

export interface GSCRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GSCSearchAnalyticsResponse {
  rows?: GSCRow[];
  responseAggregationType?: string;
}

export interface GSCIntegrationConfig {
  accessToken: string;
  siteUrl: string;
  connected: boolean;
  connectedAt: string | null;
}

export function defaultGSCConfig(): GSCIntegrationConfig {
  return {
    accessToken: "",
    siteUrl: "",
    connected: false,
    connectedAt: null,
  };
}

/* ---------- Fetch helper ---------- */

export async function gscFetch<T = unknown>(
  accessToken: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = endpoint.startsWith("http")
    ? endpoint
    : `${GSC_SEARCH_BASE}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const body = await res.text();
    let message = `Search Console API error (${res.status})`;
    try {
      const parsed = JSON.parse(body);
      if (parsed.error?.message) {
        message = parsed.error.message;
      }
    } catch {
      if (body) message = body;
    }
    throw new Error(message);
  }

  return res.json();
}

/* ---------- Data fetching helpers ---------- */

export async function fetchGSCOverview(
  accessToken: string,
  siteUrl: string
): Promise<string> {
  try {
    const endDate = new Date().toISOString().split("T")[0];
    const startDate30 = new Date(Date.now() - 30 * 86400000)
      .toISOString()
      .split("T")[0];
    const startDate7 = new Date(Date.now() - 7 * 86400000)
      .toISOString()
      .split("T")[0];

    const encodedSite = encodeURIComponent(siteUrl);

    // Fetch 30-day totals
    const overallReport = await gscFetch<GSCSearchAnalyticsResponse>(
      accessToken,
      `/sites/${encodedSite}/searchAnalytics/query`,
      {
        method: "POST",
        body: JSON.stringify({
          startDate: startDate30,
          endDate,
          dimensions: [],
          rowLimit: 1,
        }),
      }
    );

    let ctx = `\n\n## Google Search Console Context (Live Data)\n`;
    ctx += `**Site:** ${siteUrl}\n`;
    ctx += `**Period:** Last 30 days\n`;

    if (overallReport.rows && overallReport.rows.length > 0) {
      const row = overallReport.rows[0];
      ctx += `- Total Clicks: ${row.clicks.toLocaleString()}\n`;
      ctx += `- Total Impressions: ${row.impressions.toLocaleString()}\n`;
      ctx += `- Average CTR: ${(row.ctr * 100).toFixed(2)}%\n`;
      ctx += `- Average Position: ${row.position.toFixed(1)}\n`;
    }

    // Fetch daily trend (last 7 days)
    try {
      const dailyReport = await gscFetch<GSCSearchAnalyticsResponse>(
        accessToken,
        `/sites/${encodedSite}/searchAnalytics/query`,
        {
          method: "POST",
          body: JSON.stringify({
            startDate: startDate7,
            endDate,
            dimensions: ["date"],
            rowLimit: 7,
          }),
        }
      );

      if (dailyReport.rows && dailyReport.rows.length > 0) {
        ctx += `\n**Daily Trend (Last 7 Days):**\n`;
        for (const row of dailyReport.rows) {
          ctx += `  - ${row.keys[0]}: ${row.clicks} clicks, ${row.impressions.toLocaleString()} impressions, ${(row.ctr * 100).toFixed(1)}% CTR, pos ${row.position.toFixed(1)}\n`;
        }
      }
    } catch {
      // Skip daily trend if fails
    }

    // Fetch top queries
    try {
      const queryReport = await gscFetch<GSCSearchAnalyticsResponse>(
        accessToken,
        `/sites/${encodedSite}/searchAnalytics/query`,
        {
          method: "POST",
          body: JSON.stringify({
            startDate: startDate30,
            endDate,
            dimensions: ["query"],
            rowLimit: 15,
          }),
        }
      );

      if (queryReport.rows && queryReport.rows.length > 0) {
        ctx += `\n**Top Search Queries (30 days):**\n`;
        for (const row of queryReport.rows) {
          ctx += `  - "${row.keys[0]}": ${row.clicks} clicks, ${row.impressions.toLocaleString()} impr, ${(row.ctr * 100).toFixed(1)}% CTR, pos ${row.position.toFixed(1)}\n`;
        }
      }
    } catch {
      // Skip queries if fails
    }

    // Fetch top pages
    try {
      const pageReport = await gscFetch<GSCSearchAnalyticsResponse>(
        accessToken,
        `/sites/${encodedSite}/searchAnalytics/query`,
        {
          method: "POST",
          body: JSON.stringify({
            startDate: startDate30,
            endDate,
            dimensions: ["page"],
            rowLimit: 10,
          }),
        }
      );

      if (pageReport.rows && pageReport.rows.length > 0) {
        ctx += `\n**Top Pages by Clicks:**\n`;
        for (const row of pageReport.rows) {
          const pagePath = row.keys[0].replace(siteUrl, "") || "/";
          ctx += `  - ${pagePath}: ${row.clicks} clicks, ${row.impressions.toLocaleString()} impr\n`;
        }
      }
    } catch {
      // Skip pages if fails
    }

    // Fetch device breakdown
    try {
      const deviceReport = await gscFetch<GSCSearchAnalyticsResponse>(
        accessToken,
        `/sites/${encodedSite}/searchAnalytics/query`,
        {
          method: "POST",
          body: JSON.stringify({
            startDate: startDate30,
            endDate,
            dimensions: ["device"],
            rowLimit: 5,
          }),
        }
      );

      if (deviceReport.rows && deviceReport.rows.length > 0) {
        ctx += `\n**Device Breakdown:**\n`;
        for (const row of deviceReport.rows) {
          ctx += `  - ${row.keys[0]}: ${row.clicks} clicks, ${(row.ctr * 100).toFixed(1)}% CTR, pos ${row.position.toFixed(1)}\n`;
        }
      }
    } catch {
      // Skip devices if fails
    }

    ctx += `\nAgent 10 (SEO & Organic Growth Manager) can analyze this Search Console data for keyword opportunities, ranking changes, and technical SEO insights. Use charts to visualize trends.`;
    return ctx;
  } catch {
    return "\n\n## Google Search Console Context\nSearch Console is connected but could not fetch data. The access token may need to be refreshed in Integrations settings.";
  }
}
