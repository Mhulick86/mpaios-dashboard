/**
 * POST /api/integrations/<provider>/connect — for api_key platforms.
 * Body: { apiKey } (or omit it to use the platform's env var). Validates the
 * key with the provider, then stores it encrypted. Admin-only.
 */
import { requireRole } from "@/lib/apiAuth";
import { isEncryptionConfigured } from "@/lib/integrations/crypto";
import { IntegrationApiError } from "@/lib/integrations/oauth";
import { loadProvider } from "@/lib/integrations/providers";
import { getIntegration, isIntegrationId } from "@/lib/integrations/registry";
import { upsertConnection } from "@/lib/integrations/store";

export async function POST(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  try {
    const { supabase, user } = await requireRole("admin");
    const { provider } = await ctx.params;
    if (!isIntegrationId(provider)) return Response.json({ error: "Unknown integration" }, { status: 404 });
    const def = getIntegration(provider)!;
    if (def.auth !== "api_key") return Response.json({ error: `${def.name} uses OAuth; use the Connect button` }, { status: 400 });
    if (!isEncryptionConfigured()) return Response.json({ error: "INTEGRATIONS_ENCRYPTION_KEY is not set on the server" }, { status: 500 });

    const body = (await req.json().catch(() => ({}))) as { apiKey?: unknown };
    const apiKey = typeof body.apiKey === "string" && body.apiKey.trim() ? body.apiKey.trim() : def.apiKeyEnv ? process.env[def.apiKeyEnv] : undefined;
    if (!apiKey) return Response.json({ error: "Enter an API key" }, { status: 400 });

    const mod = await loadProvider(def.id);
    if (!mod?.validateApiKey) return Response.json({ error: `${def.name} has no server module yet` }, { status: 501 });
    const identity = await mod.validateApiKey(apiKey);
    const connection = await upsertConnection(supabase, {
      userId: user.id,
      provider: def.id,
      accountId: identity.accountId,
      accountName: identity.accountName,
      scopes: [],
      tokens: { accessToken: apiKey, refreshToken: null, expiresAt: null },
      metadata: identity.metadata,
    });
    return Response.json({ ok: true, connection });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof IntegrationApiError) return Response.json({ error: e.message, details: e.details }, { status: e.status });
    return Response.json({ error: e instanceof Error ? e.message : "Connect failed" }, { status: 500 });
  }
}
