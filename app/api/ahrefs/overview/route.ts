import { buildAhrefsContext } from "@/lib/ahrefs";

export async function POST(req: Request) {
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
