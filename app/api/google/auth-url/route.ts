/**
 * Returns the Google OAuth authorization URL for the popup flow.
 * Uses Authorization Code flow with server-side token exchange.
 * Admin-only: this is the entry point for connecting integrations.
 */

import { requireRole } from "@/lib/apiAuth";

export async function POST(req: Request) {
  try {
    await requireRole("admin");
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }

  const { scopes, redirectUri } = (await req.json()) as {
    scopes?: unknown;
    redirectUri?: unknown;
  };

  if (!Array.isArray(scopes) || scopes.some((s) => typeof s !== "string") || scopes.length === 0) {
    return Response.json({ error: "scopes must be a non-empty array of strings" }, { status: 400 });
  }
  if (typeof redirectUri !== "string" || !redirectUri) {
    return Response.json({ error: "redirectUri is required" }, { status: 400 });
  }

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
