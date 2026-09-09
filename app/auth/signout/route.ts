import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options: Record<string, unknown> };

function publicOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost) {
    const proto = request.headers.get("x-forwarded-proto") || "https";
    return `${proto}://${forwardedHost}`;
  }
  return new URL(request.url).origin;
}

async function signOutAndRedirect(request: NextRequest) {
  const pending: CookieToSet[] = [];
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

  try {
    await supabase.auth.signOut();
  } catch {
    // Session may already be gone; still clear cookies and redirect.
  }

  const res = NextResponse.redirect(`${publicOrigin(request)}/login`, { status: 303 });
  pending.forEach(({ name, value, options }) => res.cookies.set(name, value, options as never));
  return res;
}

export async function POST(request: NextRequest) {
  return signOutAndRedirect(request);
}

/**
 * GET never signs out: a state-changing GET would let any third-party page
 * force a logout with an <img src>. It just sends the visitor to the login page.
 */
export async function GET(request: NextRequest) {
  return NextResponse.redirect(`${publicOrigin(request)}/login`, { status: 303 });
}
