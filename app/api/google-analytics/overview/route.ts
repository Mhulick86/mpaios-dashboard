import { fetchGAOverview } from "@/lib/googleAnalytics";
import { requireAuth } from "@/lib/apiAuth";

export async function POST(req: Request) {
  try {
    const { user } = await requireAuth();
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
    if (error instanceof Response) return error;
    const msg =
      error instanceof Error ? error.message : "Failed to fetch GA overview";
    return Response.json({ error: msg }, { status: 500 });
  }
}
