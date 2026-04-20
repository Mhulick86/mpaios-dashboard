/**
 * Returns the Meta (Facebook) OAuth authorization URL for the popup flow.
 * Uses Facebook Login for Business — Authorization Code flow with server-side
 * token exchange. App ID/secret live in env: META_APP_ID / META_APP_SECRET.
 */

import { requireAuth } from "@/lib/apiAuth";
import { META_API_VERSION, META_OAUTH_SCOPES } from "@/lib/metaAds";

export async function POST(req: Request) {
  try {
    await requireAuth();
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }

  const { scopes, redirectUri } = (await req.json()) as {
    scopes?: string[];
    redirectUri: string;
  };

  const clientId = process.env.META_APP_ID;
  if (!clientId) {
    return Response.json(
      {
        error:
          "Meta OAuth not configured. Add META_APP_ID and META_APP_SECRET to environment variables.",
      },
      { status: 500 }
    );
  }

  const scopeString = (scopes && scopes.length ? scopes : META_OAUTH_SCOPES).join(",");
  const state = crypto.randomUUID();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopeString,
    state,
    auth_type: "rerequest", // re-prompt for any previously declined permissions
  });

  return Response.json({
    url: `https://www.facebook.com/${META_API_VERSION}/dialog/oauth?${params.toString()}`,
    state,
  });
}
