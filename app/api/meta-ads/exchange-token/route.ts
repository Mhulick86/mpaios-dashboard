/**
 * Exchanges a Meta authorization code for a short-lived user access token,
 * then upgrades it to a long-lived (~60 day) token via fb_exchange_token.
 */

import { requireAuth } from "@/lib/apiAuth";
import { META_GRAPH_BASE } from "@/lib/metaAds";

export async function POST(req: Request) {
  try {
    await requireAuth();
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }

  const { code, redirectUri } = (await req.json()) as {
    code: string;
    redirectUri: string;
  };

  const clientId = process.env.META_APP_ID;
  const clientSecret = process.env.META_APP_SECRET;

  if (!clientId || !clientSecret) {
    return Response.json(
      { error: "Meta OAuth not configured. Set META_APP_ID and META_APP_SECRET." },
      { status: 500 }
    );
  }

  try {
    // 1. Exchange authorization code for a short-lived user access token.
    const shortUrl = new URL(`${META_GRAPH_BASE}/oauth/access_token`);
    shortUrl.searchParams.set("client_id", clientId);
    shortUrl.searchParams.set("client_secret", clientSecret);
    shortUrl.searchParams.set("redirect_uri", redirectUri);
    shortUrl.searchParams.set("code", code);

    const shortRes = await fetch(shortUrl.toString(), { method: "GET" });
    const shortData = await shortRes.json();

    if (!shortRes.ok) {
      return Response.json(
        {
          error:
            shortData?.error?.message ||
            shortData?.error_description ||
            "Token exchange failed",
        },
        { status: 400 }
      );
    }

    const shortToken = shortData.access_token as string;

    // 2. Upgrade to a long-lived token (~60 days).
    const longUrl = new URL(`${META_GRAPH_BASE}/oauth/access_token`);
    longUrl.searchParams.set("grant_type", "fb_exchange_token");
    longUrl.searchParams.set("client_id", clientId);
    longUrl.searchParams.set("client_secret", clientSecret);
    longUrl.searchParams.set("fb_exchange_token", shortToken);

    const longRes = await fetch(longUrl.toString(), { method: "GET" });
    const longData = await longRes.json();

    if (!longRes.ok) {
      // Fall back to the short-lived token if long-lived upgrade fails.
      return Response.json({
        access_token: shortToken,
        expires_in: shortData.expires_in ?? null,
        long_lived: false,
      });
    }

    return Response.json({
      access_token: longData.access_token,
      expires_in: longData.expires_in ?? null, // seconds
      token_type: longData.token_type ?? "bearer",
      long_lived: true,
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Token exchange failed" },
      { status: 500 }
    );
  }
}
