import { gscFetch, type GSCSite } from "@/lib/googleSearchConsole";

export async function POST(req: Request) {
  try {
    const { accessToken, siteUrl } = (await req.json()) as {
      accessToken?: string;
      siteUrl?: string;
    };

    if (!accessToken) {
      return Response.json(
        { error: "Google OAuth access token is required" },
        { status: 400 }
      );
    }

    // If no siteUrl provided, fetch list of available sites
    if (!siteUrl) {
      const sitesResponse = await gscFetch<{ siteEntry?: GSCSite[] }>(
        accessToken,
        "/sites"
      );

      const sites = sitesResponse.siteEntry || [];

      if (sites.length === 0) {
        return Response.json(
          {
            error:
              "No sites found in Search Console for this account. Make sure you have verified site ownership.",
          },
          { status: 404 }
        );
      }

      return Response.json({
        success: true,
        sites,
        needsSiteSelection: true,
      });
    }

    // Validate access to the specific site by running a minimal query
    const encodedSite = encodeURIComponent(siteUrl);
    const endDate = new Date().toISOString().split("T")[0];
    const startDate = new Date(Date.now() - 7 * 86400000)
      .toISOString()
      .split("T")[0];

    await gscFetch(
      accessToken,
      `/sites/${encodedSite}/searchAnalytics/query`,
      {
        method: "POST",
        body: JSON.stringify({
          startDate,
          endDate,
          dimensions: [],
          rowLimit: 1,
        }),
      }
    );

    return Response.json({
      success: true,
      siteUrl,
      needsSiteSelection: false,
    });
  } catch (error: unknown) {
    const msg =
      error instanceof Error
        ? error.message
        : "Failed to connect to Google Search Console";
    return Response.json({ error: msg }, { status: 500 });
  }
}
