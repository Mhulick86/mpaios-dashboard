import { testGeminiConnection } from "@/lib/gemini";

export async function POST(req: Request) {
  try {
    const { apiKey } = (await req.json()) as { apiKey?: string };

    if (!apiKey) {
      return Response.json(
        { error: "Gemini API key is required" },
        { status: 400 }
      );
    }

    await testGeminiConnection(apiKey);

    return Response.json({ success: true });
  } catch (error: unknown) {
    const msg =
      error instanceof Error ? error.message : "Failed to connect to Gemini";
    return Response.json({ error: msg }, { status: 500 });
  }
}
