/**
 * GET /api/integrations/<provider>/auth-url — starts the OAuth flow.
 * Admin-only. Signs a state token, mirrors its nonce in an httpOnly cookie
 * and redirects the browser to the platform's consent screen.
 */
import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/apiAuth";
import { encodeState, isEncryptionConfigured, randomNonce } from "@/lib/integrations/crypto";
import { buildAuthorizeUrl, clientCredentials, IntegrationConfigError } from "@/lib/integrations/oauth";
import { loadProvider } from "@/lib/integrations/providers";
import { getIntegration, integrationCallbackPath, isIntegrationId } from "@/lib/integrations/registry";
import { publicOrigin, STATE_COOKIE } from "../../_shared";

export async function GET(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  const origin = publicOrigin(req);
  const back = (params: Record<string, string>) => {
    const url = new URL("/integrations", origin);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    return NextResponse.redirect(url);
  };

  let user;
  try {
    ({ user } = await requireRole("admin"));
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }

  if (!isIntegrationId(provider)) return back({ error: "Unknown integration" });
  const def = getIntegration(provider)!;
  if (def.auth !== "oauth2" || def.availability !== "available") return back({ error: `${def.name} cannot be connected here`, provider });
  if (!isEncryptionConfigured()) return back({ error: "INTEGRATIONS_ENCRYPTION_KEY is not set on the server", provider });

  try {
    const creds = clientCredentials(def);
    const redirectUri = `${origin}${integrationCallbackPath(def.id)}`;
    const nonce = randomNonce();
    const state = encodeState({ p: def.id, u: user.id, n: nonce, t: Date.now() });
    const mod = await loadProvider(def.id);
    const url = mod?.buildAuthorizeUrl
      ? mod.buildAuthorizeUrl({ definition: def, clientId: creds.clientId, redirectUri, state })
      : buildAuthorizeUrl(def, { clientId: creds.clientId, redirectUri, state });

    const res = NextResponse.redirect(url);
    res.cookies.set(STATE_COOKIE, nonce, {
      httpOnly: true,
      sameSite: "lax",
      secure: origin.startsWith("https://"),
      path: "/api/integrations",
      maxAge: 600,
    });
    return res;
  } catch (e) {
    if (e instanceof IntegrationConfigError) return back({ error: e.message, provider });
    return back({ error: e instanceof Error ? e.message : "Could not start OAuth", provider });
  }
}
