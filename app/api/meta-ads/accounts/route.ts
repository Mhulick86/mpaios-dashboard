import { requireAuth } from "@/lib/apiAuth";
import { listAdAccounts } from "@/lib/metaAds";

export async function POST(req: Request) {
  try {
    await requireAuth();
    const { accessToken } = (await req.json()) as { accessToken?: string };
    if (!accessToken) {
      return Response.json({ error: "accessToken is required" }, { status: 400 });
    }
    const accounts = await listAdAccounts(accessToken);
    return Response.json({ accounts });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to list ad accounts" },
      { status: 500 }
    );
  }
}
