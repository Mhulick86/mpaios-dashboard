import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAllowedEmail, isGoogleIdentity } from "@/lib/access";

type CookieToSet = { name: string; value: string; options: Record<string, unknown> };

/** Only allow same-origin relative paths as a post-login destination. */
function sanitizeNext(raw: string | null): string {
  if (!raw) return "/";
  const value = raw.trim();
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return "/";
  if (value.startsWith("/login") || value.startsWith("/auth/")) return "/";
  return value;
}

/** Public origin, honouring reverse-proxy headers (Vercel, nginx). */
function publicOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost) {
    const proto = request.headers.get("x-forwarded-proto") || "https";
    return `${proto}://${forwardedHost}`;
  }
  return new URL(request.url).origin;
}

/**
 * Supabase OAuth (PKCE) callback: exchanges the code for a session, rejects
 * accounts outside the allowed domain, then redirects to `next`.
 */
export async function GET(request: NextRequest) {
  const origin = publicOrigin(request);
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = sanitizeNext(searchParams.get("next"));

  const pending: CookieToSet[] = [];
  const applyCookies = (res: NextResponse) => {
    pending.forEach(({ name, value, options }) => res.cookies.set(name, value, options as never));
    return res;
  };
  const fail = (reason: "auth" | "domain") =>
    applyCookies(NextResponse.redirect(`${origin}/login?error=${reason}`));

  // When the on_auth_user_created trigger rejects an off-domain account, GoTrue
  // reports it as error=server_error with a generic "Database error saving new
  // user" description (the trigger's own message only reaches the auth logs).
  const oauthError = searchParams.get("error");
  if (oauthError) {
    const description = (searchParams.get("error_description") || "").toLowerCase();
    if (description.includes("database error saving new user")) return fail("domain");
    return fail("auth");
  }
  if (!code) return fail("auth");

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet: CookieToSet[]) {
            pending.push(...cookiesToSet);
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return fail("auth");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !isAllowedEmail(user.email) || !isGoogleIdentity(user)) {
      const reason = user && isAllowedEmail(user.email) ? "auth" : "domain";
      try {
        await supabase.auth.signOut();
      } catch {
        // ignore; cleared cookies are still applied below
      }
      return fail(reason);
    }

    return applyCookies(NextResponse.redirect(`${origin}${next}`));
  } catch {
    return fail("auth");
  }
}
