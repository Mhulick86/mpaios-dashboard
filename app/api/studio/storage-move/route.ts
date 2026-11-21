import { timingSafeEqual } from "node:crypto";
import { oldSupabaseConfigured, studioConfigError, studioOldStore, studioS3Store } from "@/lib/contentStudio";
import { copyEverything } from "@/content-studio/storage-move.mjs";

/**
 * TEMPORARY: one-off copy of the studio from Supabase to the S3 bucket: the database snapshot and every image.
 * POST with header x-studio-passcode (the STUDIO_PASSCODE environment value). Run it until "remaining" is 0, then
 * remove STUDIO_SUPABASE_URL and STUDIO_SUPABASE_SECRET_KEY and delete this route with content-studio/storage-move.mjs.
 * The database is copied only when the bucket has none yet, unless ?replace=1 (which replaces whatever the studio
 * saved in the bucket in the meantime with the Supabase copy).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export async function POST(request: Request) {
  const started = Date.now();
  const expected = process.env.STUDIO_PASSCODE || "";
  if (!expected || !same(request.headers.get("x-studio-passcode") || "", expected)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!oldSupabaseConfigured()) return Response.json({ error: "STUDIO_SUPABASE_URL and STUDIO_SUPABASE_SECRET_KEY are not set; there is nothing to copy from." }, { status: 400 });
  const problem = studioConfigError();
  if (problem) return Response.json({ error: problem }, { status: 400 });
  if (!process.env.STUDIO_S3_ENDPOINT) return Response.json({ error: "Set the STUDIO_S3_* variables first; the copy goes into that bucket." }, { status: 400 });
  try {
    const report = await copyEverything({
      store: studioS3Store(), old: studioOldStore(),
      replace: new URL(request.url).searchParams.get("replace") === "1",
      deadline: started + (maxDuration - 100) * 1000,
    });
    return Response.json({ ok: true, ...report });
  } catch (e) {
    return Response.json({ ok: false, error: String((e as Error)?.message || e).slice(0, 400) }, { status: 502 });
  }
}
