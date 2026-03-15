import { NextResponse } from "next/server";

const ASANA_AUTH_URL = "https://app.asana.com/-/oauth_authorize";

export async function GET(req: Request) {
  const clientId = process.env.ASANA_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "ASANA_CLIENT_ID not configured" },
      { status: 500 }
    );
  }

  const baseUrl = new URL(req.url).origin;
  const redirectUri = `${baseUrl}/api/auth/asana/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    state: "asana_oauth",
  });

  return NextResponse.redirect(`${ASANA_AUTH_URL}?${params.toString()}`);
}
