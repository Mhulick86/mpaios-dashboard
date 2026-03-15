import { NextResponse } from "next/server";

const ASANA_TOKEN_URL = "https://app.asana.com/-/oauth_token";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  const baseUrl = new URL(req.url).origin;

  if (error) {
    return NextResponse.redirect(
      `${baseUrl}/integrations?asana_error=${encodeURIComponent(error)}`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${baseUrl}/integrations?asana_error=${encodeURIComponent("No authorization code received")}`
    );
  }

  const clientId = process.env.ASANA_CLIENT_ID;
  const clientSecret = process.env.ASANA_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      `${baseUrl}/integrations?asana_error=${encodeURIComponent("OAuth not configured on server")}`
    );
  }

  const redirectUri = `${baseUrl}/api/auth/asana/callback`;

  try {
    // Exchange code for tokens
    const tokenRes = await fetch(ASANA_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code,
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok) {
      throw new Error(tokenData.error_description || tokenData.error || "Token exchange failed");
    }

    // Fetch user info + workspaces using the new token
    const userRes = await fetch("https://app.asana.com/api/1.0/users/me?opt_fields=name,email,workspaces.name", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const userData = await userRes.json();
    const user = userData.data;

    const params = new URLSearchParams({
      asana_access_token: tokenData.access_token,
      asana_refresh_token: tokenData.refresh_token || "",
      asana_user_name: user?.name || "",
      asana_user_email: user?.email || "",
      asana_workspaces: JSON.stringify(user?.workspaces || []),
    });

    return NextResponse.redirect(
      `${baseUrl}/integrations?${params.toString()}`
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "OAuth failed";
    return NextResponse.redirect(
      `${baseUrl}/integrations?asana_error=${encodeURIComponent(msg)}`
    );
  }
}
