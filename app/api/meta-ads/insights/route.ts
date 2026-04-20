import { requireAuth } from "@/lib/apiAuth";
import { getInsights, type InsightsOptions } from "@/lib/metaAds";

export async function POST(req: Request) {
  try {
    await requireAuth();
    const body = (await req.json()) as {
      accessToken?: string;
      accountId?: string;
      options?: InsightsOptions;
    };
    if (!body.accessToken || !body.accountId) {
      return Response.json(
        { error: "accessToken and accountId are required" },
        { status: 400 }
      );
    }
    const insights = await getInsights(body.accessToken, body.accountId, body.options || {});
    return Response.json({ insights });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to load insights" },
      { status: 500 }
    );
  }
}
