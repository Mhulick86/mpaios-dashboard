/** POST /api/integrations/<provider>/disconnect — removes stored credentials. Admin-only. */
import { requireRole } from "@/lib/apiAuth";
import { isIntegrationId } from "@/lib/integrations/registry";
import { deleteConnection } from "@/lib/integrations/store";

export async function POST(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  try {
    const { supabase } = await requireRole("admin");
    const { provider } = await ctx.params;
    if (!isIntegrationId(provider)) return Response.json({ error: "Unknown integration" }, { status: 404 });
    const body = (await req.json().catch(() => ({}))) as { accountId?: unknown };
    const accountId = typeof body.accountId === "string" ? body.accountId : null;
    const removed = await deleteConnection(supabase, provider, accountId);
    return Response.json({ ok: true, removed });
  } catch (e) {
    if (e instanceof Response) return e;
    return Response.json({ error: e instanceof Error ? e.message : "Disconnect failed" }, { status: 500 });
  }
}
