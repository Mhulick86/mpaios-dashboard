const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

export async function POST(req: Request) {
  try {
    const { refreshToken } = (await req.json()) as { refreshToken?: string };

    if (!refreshToken) {
      return Response.json({ error: "Refresh token required" }, { status: 400 });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return Response.json({ error: "OAuth not configured" }, { status: 500 });
    }

    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error_description || data.error || "Refresh failed");
    }

    return Response.json({
      accessToken: data.access_token,
      expiresIn: data.expires_in || 3600,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Token refresh failed";
    return Response.json({ error: msg }, { status: 500 });
  }
}
