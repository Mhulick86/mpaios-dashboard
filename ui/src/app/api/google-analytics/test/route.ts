import { gaFetch } from "@/lib/googleAnalytics";

interface GAPropertyListResponse {
  properties?: Array<{
    name: string;
    displayName: string;
    property: string;
  }>;
}

export async function POST(req: Request) {
  try {
    const { accessToken, propertyId } = (await req.json()) as {
      accessToken?: string;
      propertyId?: string;
    };

    if (!accessToken) {
      return Response.json(
        { error: "Google OAuth access token is required" },
        { status: 400 }
      );
    }

    if (!propertyId) {
      return Response.json(
        { error: "GA4 Property ID is required" },
        { status: 400 }
      );
    }

    // Validate token by running a minimal report on the property
    const report = await gaFetch<Record<string, unknown>>(
      accessToken,
      `/properties/${propertyId}:runReport`,
      {
        method: "POST",
        body: JSON.stringify({
          dateRanges: [{ startDate: "7daysAgo", endDate: "today" }],
          metrics: [{ name: "activeUsers" }],
          limit: "1",
        }),
      }
    );

    // Try to get property metadata
    let propertyName = `Property ${propertyId}`;
    try {
      const metadata = await gaFetch<{ displayName?: string }>(
        accessToken,
        `https://analyticsadmin.googleapis.com/v1beta/properties/${propertyId}`,
      );
      if (metadata.displayName) {
        propertyName = metadata.displayName;
      }
    } catch {
      // Property name lookup is best-effort
    }

    return Response.json({
      success: true,
      propertyId,
      propertyName,
      hasData: !!(report as { rows?: unknown[] }).rows?.length,
    });
  } catch (error: unknown) {
    const msg =
      error instanceof Error
        ? error.message
        : "Failed to connect to Google Analytics";
    return Response.json({ error: msg }, { status: 500 });
  }
}
