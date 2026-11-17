import { timingSafeEqual } from "node:crypto";
import { get, list } from "@vercel/blob";
import { createSupabaseStore } from "@/content-studio/supabase-store.mjs";

/**
 * One-off copy of the studio from Vercel Blob to Supabase: the database snapshot and every image. Vercel blocks a Hobby
 * Blob store for 30 days once its monthly operations run out, so this reports the block until the store can be read
 * again. POST with header x-studio-passcode (the STUDIO_PASSCODE environment value). The database is copied only when
 * Supabase has none yet, unless ?replace=1 (which replaces whatever the studio stored on Supabase in the meantime).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;

const DB_KEY = "studio/content-studio.sqlite";
const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export async function POST(request: Request) {
  const expected = process.env.STUDIO_PASSCODE || "";
  if (!expected || !same(request.headers.get("x-studio-passcode") || "", expected)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.STUDIO_SUPABASE_URL || !process.env.STUDIO_SUPABASE_SECRET_KEY) return Response.json({ error: "Set STUDIO_SUPABASE_URL and STUDIO_SUPABASE_SECRET_KEY first." }, { status: 400 });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return Response.json({ error: "No Vercel Blob store is connected; nothing to copy." }, { status: 400 });
  const replace = new URL(request.url).searchParams.get("replace") === "1";
  const target = createSupabaseStore({ url: process.env.STUDIO_SUPABASE_URL, key: process.env.STUDIO_SUPABASE_SECRET_KEY });
  const report: Record<string, unknown> = { database: "skipped", images: 0, imagesFailed: 0 };
  try {
    const src = await get(DB_KEY, { access: "private", useCache: false });
    if (!src?.stream) report.database = "not found on Vercel Blob";
    else {
      const data = Buffer.from(await new Response(src.stream).arrayBuffer());
      const current = await target.get(DB_KEY);
      if (current && !replace) report.database = "kept: Supabase already has a studio database (add ?replace=1 to overwrite it)";
      else { await target.put(DB_KEY, data, current ? { ifMatch: current.blob?.etag } : {}); report.database = `copied (${data.length} bytes)`; }
    }
    let cursor: string | undefined;
    do {
      const page = await list({ prefix: "studio/assets/", cursor, limit: 1000 });
      for (const b of page.blobs) {
        try {
          const res = await get(b.pathname, { access: "private" });
          if (res?.stream) { await target.put(b.pathname, Buffer.from(await new Response(res.stream).arrayBuffer()), { allowOverwrite: true }); report.images = (report.images as number) + 1; }
        } catch { report.imagesFailed = (report.imagesFailed as number) + 1; }
      }
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return Response.json({ ok: true, ...report });
  } catch (e) {
    return Response.json({ ok: false, ...report, error: String((e as Error)?.message || e).slice(0, 400) }, { status: 502 });
  }
}
