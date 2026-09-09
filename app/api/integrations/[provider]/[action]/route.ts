/**
 * GET|POST /api/integrations/<provider>/<action>
 * Dispatches to the provider module's named action with a fresh access token.
 * Query params (GET) or JSON body (POST) become the action's params; pass
 * ?account=<accountId> to pick a specific connected account. Admin-only.
 */
import { requireRole } from "@/lib/apiAuth";
import { clientCredentials, IntegrationApiError, IntegrationConfigError } from "@/lib/integrations/oauth";
import { loadProvider } from "@/lib/integrations/providers";
import { getIntegration, isIntegrationId } from "@/lib/integrations/registry";
import { getConnection, getValidAccessToken } from "@/lib/integrations/store";
import type { ActionParams } from "@/lib/integrations/types";

const RESERVED = new Set(["auth-url", "callback", "disconnect", "connect"]);

async function handle(req: Request, ctx: { params: Promise<{ provider: string; action: string }> }, method: "GET" | "POST") {
  try {
    const { supabase, user } = await requireRole("admin");
    const { provider, action } = await ctx.params;
    if (!isIntegrationId(provider)) return Response.json({ error: "Unknown integration" }, { status: 404 });
    if (RESERVED.has(action) || action.startsWith("_")) return Response.json({ error: "Unknown action" }, { status: 404 });
    const def = getIntegration(provider)!;
    if (!def.actions.includes(action)) return Response.json({ error: `Unknown action "${action}" for ${def.name}` }, { status: 404 });

    const mod = await loadProvider(def.id);
    const handler = mod?.actions[action];
    if (!mod || !handler) return Response.json({ error: `${def.name} has no server module yet` }, { status: 501 });

    const url = new URL(req.url);
    const params: ActionParams = method === "GET"
      ? Object.fromEntries(url.searchParams.entries())
      : ((await req.json().catch(() => ({}))) as ActionParams);
    const accountId = typeof params.account === "string" ? params.account : null;

    let accessToken: string;
    let connection;
    if (def.auth === "oauth2") {
      const creds = () => clientCredentials(def);
      const refreshed = await getValidAccessToken(
        supabase,
        def.id,
        accountId,
        mod.refresh ? (refreshToken) => mod.refresh!({ definition: def, refreshToken, ...creds() }) : undefined
      );
      accessToken = refreshed.accessToken;
      connection = refreshed.connection;
    } else {
      connection = await getConnection(supabase, def.id, accountId);
      if (!connection) return Response.json({ error: `${def.name} is not connected` }, { status: 404 });
      accessToken = connection.accessToken;
    }

    const result = await handler({ supabase, definition: def, connection, accessToken, userId: user.id }, params, method);
    return Response.json(result ?? { ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof IntegrationConfigError) return Response.json({ error: e.message, missing: e.missing }, { status: 500 });
    if (e instanceof IntegrationApiError) return Response.json({ error: e.message, details: e.details }, { status: e.status });
    const message = e instanceof Error ? e.message : "Integration call failed";
    return Response.json({ error: message }, { status: /not connected/i.test(message) ? 404 : 500 });
  }
}

export async function GET(req: Request, ctx: { params: Promise<{ provider: string; action: string }> }) {
  return handle(req, ctx, "GET");
}
export async function POST(req: Request, ctx: { params: Promise<{ provider: string; action: string }> }) {
  return handle(req, ctx, "POST");
}

export const maxDuration = 60;
