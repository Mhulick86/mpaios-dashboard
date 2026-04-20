import { requireAuth } from "@/lib/apiAuth";
import { listAds } from "@/lib/metaAds";

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
    const ads = await listAds(accessToken, accountId, limit ?? 100);
    return Response.json({ ads });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to list ads" },
      { status: 500 }
    );
  }
}
