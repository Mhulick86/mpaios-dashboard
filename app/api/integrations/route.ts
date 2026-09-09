/**
 * GET /api/integrations — the catalogue with connection status for the
 * Platforms grid. Admin-only; never returns tokens.
 */
import { requireRole } from "@/lib/apiAuth";
import { isEncryptionConfigured } from "@/lib/integrations/crypto";
import { INTEGRATIONS, integrationCallbackPath } from "@/lib/integrations/registry";
import { listConnections } from "@/lib/integrations/store";

export async function GET() {
  try {
    const { supabase } = await requireRole("admin");
    const connections = await listConnections(supabase);
    const integrations = INTEGRATIONS.map((def) => ({
      ...def,
      callbackPath: integrationCallbackPath(def.id),
      missingEnv: def.requiredEnv.filter((name) => !process.env[name]),
      apiKeyFromEnv: def.auth === "api_key" && !!def.apiKeyEnv && !!process.env[def.apiKeyEnv],
      connections: connections.filter((c) => c.provider === def.id),
    }));
    return Response.json({ encryptionConfigured: isEncryptionConfigured(), integrations });
  } catch (e) {
    if (e instanceof Response) return e;
    return Response.json({ error: e instanceof Error ? e.message : "Failed to list integrations" }, { status: 500 });
  }
}
