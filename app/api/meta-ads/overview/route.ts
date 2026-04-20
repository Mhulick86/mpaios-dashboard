import { requireAuth } from "@/lib/apiAuth";
import { fetchMetaOverview } from "@/lib/metaAds";

export async function POST(req: Request) {
  try {
    await requireAuth();
    const { accessToken, accountId } = (await req.json()) as {
      accessToken?: string;
      accountId?: string;
    };
    if (!accessToken || !accountId) {
      return Response.json(
        { error: "accessToken and accountId are required" },
        { status: 400 }
      );
    }
    const markdown = await fetchMetaOverview(accessToken, accountId);
    return Response.json({ markdown });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to load overview" },
      { status: 500 }
    );
  }
}
