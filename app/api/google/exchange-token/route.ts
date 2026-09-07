/**
 * Exchanges a Google authorization code for access + refresh tokens.
 * Admin-only: tokens returned here are integration credentials.
 */

import { requireRole } from "@/lib/apiAuth";

export async function POST(req: Request) {
  try {
    await requireRole("admin");
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }

  const { code, redirectUri } = (await req.json()) as {
    code?: unknown;
    redirectUri?: unknown;
  };

  if (typeof code !== "string" || !code || typeof redirectUri !== "string" || !redirectUri) {
    return Response.json({ error: "code and redirectUri are required" }, { status: 400 });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return Response.json(
      { error: "Google OAuth not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to environment variables." },
      { status: 500 }
    );
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok) {
      return Response.json(
        { error: tokenData.error_description || tokenData.error || "Token exchange failed" },
        { status: 400 }
      );
    }

    return Response.json({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_in: tokenData.expires_in,
      scope: tokenData.scope,
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Token exchange failed" },
      { status: 500 }
    );
  }
}
