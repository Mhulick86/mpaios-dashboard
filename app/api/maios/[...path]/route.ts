/** Thin authenticated proxy from the dashboard to the MAIOS worker on the TNAS. */
import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { MAIOS_WORKER_URL, actingUserId } from "@/lib/maios";

const INTERNAL_KEY = process.env.MAIOS_INTERNAL_KEY || "dev-key";
const ALLOWED = /^\/v1\/(collections|etl|documents|knowledge|workflows|runs|approvals|triggers|events)(\/|$)|^\/health$/;

async function proxy(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const target = "/" + path.join("/");
  if (!ALLOWED.test(target)) return Response.json({ error: { code: "FORBIDDEN_PATH" } }, { status: 403 });
  const { user } = await requireAuth();
  const url = new URL(req.url);
  const headers: Record<string, string> = { "x-internal-key": INTERNAL_KEY };
  const uid = actingUserId(user?.id);
  if (uid) headers["x-user-id"] = uid;
  const ct = req.headers.get("content-type") || "";
  const init: RequestInit = { method: req.method, headers };
  if (req.method !== "GET" && req.method !== "HEAD") {
    if (ct.startsWith("multipart/form-data")) { init.body = await req.arrayBuffer(); headers["content-type"] = ct; }
    else { init.body = await req.text(); headers["content-type"] = "application/json"; }
  }
  const res = await fetch(`${MAIOS_WORKER_URL}${target}${url.search}`, init);
  return new Response(res.body, { status: res.status, headers: { "content-type": res.headers.get("content-type") || "application/json" } });
}

export const GET = proxy;
export const POST = proxy;
export const DELETE = proxy;
export const maxDuration = 120;
