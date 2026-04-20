/**
 * Test Meta connection: validates the access token, lists ad accounts so the
 * caller can pick one. Returns user identity + accounts.
 */

import { requireAuth } from "@/lib/apiAuth";
import { getMe, listAdAccounts } from "@/lib/metaAds";

export async function POST(req: Request) {
  try {
    await requireAuth();
    const { accessToken } = (await req.json()) as { accessToken?: string };
    if (!accessToken) {
      return Response.json({ error: "accessToken is required" }, { status: 400 });
    }

    const [me, accounts] = await Promise.all([
      getMe(accessToken),
      listAdAccounts(accessToken),
    ]);

    return Response.json({
      user: me,
      accounts,
    });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { error: error instanceof Error ? error.message : "Connection test failed" },
      { status: 500 }
    );
  }
}
