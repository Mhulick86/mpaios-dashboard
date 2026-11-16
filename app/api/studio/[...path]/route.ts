import { after, type NextRequest } from "next/server";
import { getStudio, studioConfigError, toResponse } from "@/lib/contentStudio";

// The studio needs Node (SQLite, crypto) and time to finish generations in the background after responding.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;

async function handle(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const started = Date.now();
  const problem = studioConfigError();
  if (problem) return Response.json({ error: problem }, { status: 503 });
  const { path } = await params;
  const url = new URL(request.url);
  const body = request.method === "GET" || request.method === "HEAD" ? Buffer.alloc(0) : Buffer.from(await request.arrayBuffer());
  const studio = getStudio();
  const reply = await studio.handle({
    method: request.method,
    // The studio UI calls /api/studio/api/...; the studio's own routes start at /api/.
    path: "/" + path.map(encodeURIComponent).join("/"),
    query: url.searchParams,
    header: (name: string) => request.headers.get(name) || "",
    body: async () => body,
    host: request.headers.get("host") || "",
    cookie: request.cookies.get("maios_studio")?.value || "",
  });
  // Queued generations and image runs continue after the response, within this function's time limit.
  after(() => studio.background({ deadline: started + (maxDuration - 20) * 1000 }));
  return toResponse(reply);
}

export { handle as GET, handle as POST, handle as PATCH, handle as DELETE };
