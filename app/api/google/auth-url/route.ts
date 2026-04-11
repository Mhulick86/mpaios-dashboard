/**
 * Returns the Google OAuth authorization URL for the popup flow.
 * Uses Authorization Code flow with server-side token exchange.
 */

export async function POST(req: Request) {
  const { scopes, redirectUri } = await req.json();

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return Response.json(
      { error: "Google OAuth not configured. Add GOOGLE_CLIENT_ID to environment variables." },
      { status: 500 }
    );
  }

  const scopeString = (scopes as string[]).join(" ");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopeString,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
  });

  return Response.json({
    url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  });
}
