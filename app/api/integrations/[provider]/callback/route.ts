/**
 * GET /api/integrations/<provider>/callback — OAuth redirect target.
 * Verifies the signed state + nonce cookie, exchanges the code server-side,
 * asks the provider which account was connected, stores encrypted tokens and
 * sends the admin back to /integrations.
 */
import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/apiAuth";
import { decodeState } from "@/lib/integrations/crypto";
import { clientCredentials, exchangeCode, IntegrationConfigError } from "@/lib/integrations/oauth";
import { loadProvider } from "@/lib/integrations/providers";
import { getIntegration, integrationCallbackPath, isIntegrationId } from "@/lib/integrations/registry";
import { upsertConnection } from "@/lib/integrations/store";
import { publicOrigin, STATE_COOKIE } from "../../_shared";

export async function GET(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  const origin = publicOrigin(req);
  const finish = (params: Record<string, string>) => {
    const url = new URL("/integrations", origin);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v.slice(0, 300)));
    const res = NextResponse.redirect(url);
    res.cookies.set(STATE_COOKIE, "", { maxAge: 0, path: "/api/integrations" });
    return res;
  };

  let user;
  let supabase;
  try {
    ({ user, supabase } = await requireRole("admin"));
  } catch (e) {
    if (e instanceof Response) return NextResponse.redirect(new URL("/login?next=/integrations", origin));
    throw e;
  }

  if (!isIntegrationId(provider)) return finish({ error: "Unknown integration" });
  const def = getIntegration(provider)!;
  const sp = req.nextUrl.searchParams;

  const oauthError = sp.get("error");
  if (oauthError) {
    return finish({ error: sp.get("error_description") || sp.get("error_message") || oauthError, provider });
  }

  const state = decodeState(sp.get("state"));
  const nonce = req.cookies.get(STATE_COOKIE)?.value;
  if (!state || state.p !== def.id || state.u !== user.id || !nonce || state.n !== nonce) {
    return finish({ error: "OAuth state check failed; please try connecting again", provider });
  }

  const code = sp.get("code") || sp.get("auth_code");
  if (!code) return finish({ error: "No authorization code returned", provider });

  try {
    const creds = clientCredentials(def);
    const redirectUri = `${origin}${integrationCallbackPath(def.id)}`;
    const mod = await loadProvider(def.id);
    if (!mod) return finish({ error: `${def.name} has no server module yet`, provider });

    const tokens = mod.exchange
      ? await mod.exchange({ definition: def, code, redirectUri, ...creds })
      : await exchangeCode(def, { code, redirectUri, ...creds });
    const identity = await mod.identify({ definition: def, tokens });

    await upsertConnection(supabase, {
      userId: user.id,
      provider: def.id,
      accountId: identity.accountId,
      accountName: identity.accountName,
      scopes: def.oauth?.scopes,
      tokens,
      metadata: identity.metadata,
    });
    return finish({ connected: provider, account: identity.accountName });
  } catch (e) {
    if (e instanceof IntegrationConfigError) return finish({ error: e.message, provider });
    return finish({ error: e instanceof Error ? e.message : "Connection failed", provider });
  }
}
