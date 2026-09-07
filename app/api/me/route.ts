/** Returns the signed-in user's identity and role. 401 when there is no session. */
import { requireAuth } from "@/lib/apiAuth";

export async function GET() {
  const auth = await requireAuth().catch((e: unknown) => {
    if (e instanceof Response) return e;
    throw e;
  });
  if (auth instanceof Response) return auth;

  const { user, profile, role, isAdmin } = auth;
  const p = profile as unknown as { full_name?: string | null } | null | undefined;
  const meta = (user.user_metadata || {}) as Record<string, unknown>;
  const full_name =
    p?.full_name ??
    (typeof meta.full_name === "string" ? meta.full_name : null) ??
    (typeof meta.name === "string" ? meta.name : null);

  return Response.json(
    { id: user.id, email: user.email ?? null, full_name, role, isAdmin },
    { headers: { "cache-control": "no-store" } }
  );
}
