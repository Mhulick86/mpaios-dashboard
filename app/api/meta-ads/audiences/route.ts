import { requireAuth } from "@/lib/apiAuth";
import { listAudiences } from "@/lib/metaAds";

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
    const audiences = await listAudiences(accessToken, accountId);
    return Response.json({ audiences });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to load audiences" },
      { status: 500 }
    );
  }
}
