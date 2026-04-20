import { requireAuth } from "@/lib/apiAuth";
import { listAdSets } from "@/lib/metaAds";

export async function POST(req: Request) {
  try {
    await requireAuth();
    const { accessToken, accountId, limit } = (await req.json()) as {
      accessToken?: string;
      accountId?: string;
      limit?: number;
    };
    if (!accessToken || !accountId) {
      return Response.json(
        { error: "accessToken and accountId are required" },
        { status: 400 }
      );
    }
    const adsets = await listAdSets(accessToken, accountId, limit ?? 100);
    return Response.json({ adsets });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to list ad sets" },
      { status: 500 }
    );
  }
}
