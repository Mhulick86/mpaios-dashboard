import { buildAhrefsContext } from "@/lib/ahrefs";
import { requireAuth } from "@/lib/apiAuth";

export async function POST(req: Request) {
  try {
    const { user } = await requireAuth();
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }

  const { apiKey, target, country } = await req.json();

  if (!apiKey || !target) {
    return Response.json({ error: "apiKey and target are required" }, { status: 400 });
  }

  try {
    const markdown = await buildAhrefsContext(apiKey, target, country || "us");
    return Response.json({ markdown, target });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Ahrefs API error" },
      { status: 500 }
    );
  }
}
