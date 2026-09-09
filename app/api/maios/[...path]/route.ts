/**
 * Thin authenticated proxy from the dashboard to the MAIOS worker on the TNAS.
 *
 * - Every call needs a session (requireAuth).
 * - Admins may reach anything in ADMIN_ALLOWED.
 * - Members are further restricted to MEMBER_MAIOS_PATHS (read-only knowledge search + health).
 * - Only the headers built here are forwarded: a client can never inject
 *   x-user-id or x-internal-key, and the acting user is always the session user.
 */
import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { MAIOS_WORKER_URL } from "@/lib/maios";
import { MEMBER_MAIOS_PATHS } from "@/lib/access";

const INTERNAL_KEY = process.env.MAIOS_INTERNAL_KEY || "dev-key";

/** Everything an admin may reach through the proxy. */
const ADMIN_ALLOWED = /^\/v1\/(collections|etl|documents|knowledge|workflows|runs|approvals|triggers|events)(\/|$)|^\/health$/;

function forbidden(code: string) {
  return Response.json({ error: { code } }, { status: 403 });
}

async function proxy(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const auth = await requireAuth().catch((e: unknown) => {
    if (e instanceof Response) return e;
    throw e;
  });
  if (auth instanceof Response) return auth;
  const { user, isAdmin } = auth;

  const { path } = await ctx.params;
  const segments = Array.isArray(path) ? path : [];
  if (
    segments.length === 0 ||
    segments.some((s) => !s || s === "." || s === ".." || /[\\\s\u0000-\u001f]/.test(s))
  ) {
    return forbidden("FORBIDDEN_PATH");
  }
  const target = "/" + segments.join("/");

  if (!ADMIN_ALLOWED.test(target)) return forbidden("FORBIDDEN_PATH");
  if (!isAdmin && !MEMBER_MAIOS_PATHS.some((re) => re.test(target))) {
    return forbidden("FORBIDDEN_PATH");
  }

  const url = new URL(req.url);
  // Fresh header set: nothing from the incoming request is forwarded except the body content-type.
  const headers: Record<string, string> = {
    "x-internal-key": INTERNAL_KEY,
    "x-user-id": user.id,
  };
  const ct = req.headers.get("content-type") || "";
  const init: RequestInit = { method: req.method, headers };
  if (req.method !== "GET" && req.method !== "HEAD") {
    if (ct.startsWith("multipart/form-data")) {
      init.body = await req.arrayBuffer();
      headers["content-type"] = ct;
    } else {
      init.body = await req.text();
      headers["content-type"] = "application/json";
    }
  }

  const res = await fetch(`${MAIOS_WORKER_URL}${target}${url.search}`, init);
  return new Response(res.body, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") || "application/json" },
  });
}

export const GET = proxy;
export const POST = proxy;
export const DELETE = proxy;
export const maxDuration = 120;
