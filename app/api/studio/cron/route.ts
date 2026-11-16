import { getStudio, studioConfigError } from "@/lib/contentStudio";

// Vercel Cron (see vercel.json) calls this every few minutes so queued and retrying generations finish even when
// nobody has the studio open.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;

export async function GET(request: Request) {
  const started = Date.now();
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const problem = studioConfigError();
  if (problem) return Response.json({ skipped: problem });
  return Response.json(await getStudio().tick({ deadline: started + (maxDuration - 20) * 1000 }));
}
