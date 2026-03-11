// ─── Google Analytics Integration Types & Helpers ───

const GA_BASE = "https://analyticsdata.googleapis.com/v1beta";

/* ---------- Types ---------- */

export interface GAProperty {
  id: string;
  name: string;
  displayName: string;
}

export interface GAMetricValue {
  name: string;
  value: string;
}

export interface GAReport {
  rows: Array<{
    dimensionValues: Array<{ value: string }>;
    metricValues: Array<{ value: string }>;
  }>;
  dimensionHeaders: Array<{ name: string }>;
  metricHeaders: Array<{ name: string; type: string }>;
  rowCount?: number;
}

export interface GAIntegrationConfig {
  accessToken: string;
  propertyId: string;
  propertyName: string;
  connected: boolean;
  connectedAt: string | null;
}

export function defaultGAConfig(): GAIntegrationConfig {
  return {
    accessToken: "",
    propertyId: "",
    propertyName: "",
    connected: false,
    connectedAt: null,
  };
}

/* ---------- Fetch helper ---------- */

export async function gaFetch<T = unknown>(
  accessToken: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = endpoint.startsWith("http") ? endpoint : `${GA_BASE}${endpoint}`;
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
    let message = `Google Analytics API error (${res.status})`;
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

export async function fetchGAOverview(
  accessToken: string,
  propertyId: string
): Promise<string> {
  try {
    // Fetch last 30 days overview
    const report = await gaFetch<GAReport>(
      accessToken,
      `/properties/${propertyId}:runReport`,
      {
        method: "POST",
        body: JSON.stringify({
          dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
          dimensions: [{ name: "date" }],
          metrics: [
            { name: "activeUsers" },
            { name: "sessions" },
            { name: "screenPageViews" },
            { name: "bounceRate" },
            { name: "averageSessionDuration" },
          ],
          orderBys: [{ dimension: { dimensionName: "date" } }],
          limit: "30",
        }),
      }
    );

    let ctx = "\n\n## Google Analytics Context (Live Data — Last 30 Days)\n";

    if (report.rows && report.rows.length > 0) {
      // Calculate totals
      let totalUsers = 0;
      let totalSessions = 0;
      let totalPageViews = 0;
      let totalBounceRate = 0;
      let totalDuration = 0;

      for (const row of report.rows) {
        totalUsers += parseInt(row.metricValues[0]?.value || "0");
        totalSessions += parseInt(row.metricValues[1]?.value || "0");
        totalPageViews += parseInt(row.metricValues[2]?.value || "0");
        totalBounceRate += parseFloat(row.metricValues[3]?.value || "0");
        totalDuration += parseFloat(row.metricValues[4]?.value || "0");
      }

      const avgBounce = (totalBounceRate / report.rows.length * 100).toFixed(1);
      const avgDuration = (totalDuration / report.rows.length).toFixed(0);

      ctx += `**Property:** ${propertyId}\n`;
      ctx += `**Period:** Last 30 days\n`;
      ctx += `- Active Users: ${totalUsers.toLocaleString()}\n`;
      ctx += `- Sessions: ${totalSessions.toLocaleString()}\n`;
      ctx += `- Page Views: ${totalPageViews.toLocaleString()}\n`;
      ctx += `- Avg Bounce Rate: ${avgBounce}%\n`;
      ctx += `- Avg Session Duration: ${avgDuration}s\n`;

      // Show weekly trend (aggregate by week)
      ctx += `\n**Daily trend (last 7 days):**\n`;
      const recentRows = report.rows.slice(-7);
      for (const row of recentRows) {
        const date = row.dimensionValues[0]?.value || "";
        const users = row.metricValues[0]?.value || "0";
        const sessions = row.metricValues[1]?.value || "0";
        ctx += `  - ${date}: ${users} users, ${sessions} sessions\n`;
      }
    } else {
      ctx += "No data available for the last 30 days.\n";
    }

    // Fetch top traffic sources
    try {
      const sourcesReport = await gaFetch<GAReport>(
        accessToken,
        `/properties/${propertyId}:runReport`,
        {
          method: "POST",
          body: JSON.stringify({
            dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
            dimensions: [{ name: "sessionDefaultChannelGroup" }],
            metrics: [{ name: "sessions" }, { name: "activeUsers" }],
            orderBys: [
              { metric: { metricName: "sessions" }, desc: true },
            ],
            limit: "8",
          }),
        }
      );

      if (sourcesReport.rows && sourcesReport.rows.length > 0) {
        ctx += `\n**Top Traffic Sources:**\n`;
        for (const row of sourcesReport.rows) {
          const channel = row.dimensionValues[0]?.value || "Unknown";
          const sessions = row.metricValues[0]?.value || "0";
          const users = row.metricValues[1]?.value || "0";
          ctx += `  - ${channel}: ${parseInt(sessions).toLocaleString()} sessions, ${parseInt(users).toLocaleString()} users\n`;
        }
      }
    } catch {
      // Skip sources if it fails
    }

    // Fetch top pages
    try {
      const pagesReport = await gaFetch<GAReport>(
        accessToken,
        `/properties/${propertyId}:runReport`,
        {
          method: "POST",
          body: JSON.stringify({
            dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
            dimensions: [{ name: "pagePath" }],
            metrics: [{ name: "screenPageViews" }, { name: "activeUsers" }],
            orderBys: [
              { metric: { metricName: "screenPageViews" }, desc: true },
            ],
            limit: "10",
          }),
        }
      );

      if (pagesReport.rows && pagesReport.rows.length > 0) {
        ctx += `\n**Top Pages:**\n`;
        for (const row of pagesReport.rows) {
          const path = row.dimensionValues[0]?.value || "/";
          const views = row.metricValues[0]?.value || "0";
          ctx += `  - ${path}: ${parseInt(views).toLocaleString()} views\n`;
        }
      }
    } catch {
      // Skip pages if it fails
    }

    ctx += `\nAgent 13 (Campaign Performance Analyst) can analyze this data in depth. Use charts to visualize trends when presenting GA data.`;
    return ctx;
  } catch {
    return "\n\n## Google Analytics Context\nGoogle Analytics is connected but could not fetch data. The access token may need to be refreshed in Integrations settings.";
  }
}
