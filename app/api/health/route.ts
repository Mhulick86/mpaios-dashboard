/** Unauthenticated liveness probe. Listed in PUBLIC_PATHS (lib/access.ts). */
export async function GET() {
  return Response.json(
    { ok: true, service: "maios", ts: new Date().toISOString() },
    { headers: { "cache-control": "no-store" } }
  );
}
