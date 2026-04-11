import { fetchGSCOverview } from "@/lib/googleSearchConsole";
import { requireAuth } from "@/lib/apiAuth";

export async function POST(req: Request) {
  try {
    const { user } = await requireAuth();
    const { accessToken, siteUrl } = (await req.json()) as {
      accessToken?: string;
      siteUrl?: string;
    };

    if (!accessToken || !siteUrl) {
      return Response.json(
        { error: "accessToken and siteUrl are required" },
        { status: 400 }
      );
    }

    const markdown = await fetchGSCOverview(accessToken, siteUrl);
    return Response.json({ markdown });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    const msg =
      error instanceof Error ? error.message : "Failed to fetch GSC overview";
    return Response.json({ error: msg }, { status: 500 });
  }
}
