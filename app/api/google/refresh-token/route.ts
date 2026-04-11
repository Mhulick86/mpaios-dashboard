/**
 * Refreshes an expired Google access token using a refresh token.
 */

export async function POST(req: Request) {
  const { refreshToken } = await req.json();

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return Response.json(
      { error: "Google OAuth not configured" },
      { status: 500 }
    );
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok) {
      return Response.json(
        { error: tokenData.error_description || "Refresh failed" },
        { status: 400 }
      );
    }

    return Response.json({
      access_token: tokenData.access_token,
      expires_in: tokenData.expires_in,
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Refresh failed" },
      { status: 500 }
    );
  }
}
