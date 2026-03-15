import { NextResponse } from "next/server";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  const baseUrl = new URL(req.url).origin;

  if (error) {
    return NextResponse.redirect(
      `${baseUrl}/integrations?google_error=${encodeURIComponent(error)}`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${baseUrl}/integrations?google_error=${encodeURIComponent("No authorization code received")}`
    );
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      `${baseUrl}/integrations?google_error=${encodeURIComponent("OAuth not configured on server")}`
    );
  }

  const redirectUri = `${baseUrl}/api/auth/google/callback`;

  try {
    // Exchange code for tokens
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
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
      throw new Error(tokenData.error_description || tokenData.error || "Token exchange failed");
    }

    // Build redirect with token data (sent via hash fragment for client-side only)
    const params = new URLSearchParams({
      google_access_token: tokenData.access_token,
      google_refresh_token: tokenData.refresh_token || "",
      google_expires_in: String(tokenData.expires_in || 3600),
    });

    return NextResponse.redirect(
      `${baseUrl}/integrations?${params.toString()}`
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "OAuth failed";
    return NextResponse.redirect(
      `${baseUrl}/integrations?google_error=${encodeURIComponent(msg)}`
    );
  }
}
