import { fetchGAOverview } from "@/lib/googleAnalytics";

export async function POST(req: Request) {
  try {
    const { accessToken, propertyId } = (await req.json()) as {
      accessToken?: string;
      propertyId?: string;
    };

    if (!accessToken || !propertyId) {
      return Response.json(
        { error: "accessToken and propertyId are required" },
        { status: 400 }
      );
    }

    const markdown = await fetchGAOverview(accessToken, propertyId);
    return Response.json({ markdown });
  } catch (error: unknown) {
    const msg =
      error instanceof Error ? error.message : "Failed to fetch GA overview";
    return Response.json({ error: msg }, { status: 500 });
  }
}
