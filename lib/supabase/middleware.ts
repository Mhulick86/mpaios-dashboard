import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_LEVEL, isAdminOnlyPath, isAllowedUser, isPublicPath, roleLevel } from "@/lib/access";

type CookieToSet = { name: string; value: string; options: Record<string, unknown> };

/**
 * Refreshes the Supabase session on every request and enforces the MAIOS access
 * model server-side (see lib/access.ts):
 *
 *  - no session on a private path       -> /login?next=<path>  (or 401 JSON for /api/*)
 *  - session on a non-allowed domain    -> sign out, /login?error=domain
 *  - non-admin on an admin-only path    -> /?denied=<path>      (or 403 JSON for /api/*)
 *  - signed-in user opening /login      -> /
 *
 * The returned response always carries any refreshed auth cookies.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options as never)
          );
        },
      },
    }
  );

  // IMPORTANT: do not run any code between createServerClient and getUser();
  // getUser() is what refreshes the session and rewrites cookies.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;
  const isApi = pathname.startsWith("/api/");

  /** Carry refreshed cookies onto a response we build ourselves. */
  const withCookies = <T extends NextResponse>(res: T): T => {
    supabaseResponse.cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
  };
  const redirectTo = (path: string, params?: Record<string, string>) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = "";
    if (params) for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    return withCookies(NextResponse.redirect(url));
  };
  const json = (status: number, error: string) =>
    withCookies(NextResponse.json({ error }, { status }));

  // 1. Unauthenticated
  if (!user) {
    if (isPublicPath(pathname)) return supabaseResponse;
    if (isApi) return json(401, "unauthorized");
    const next = pathname + (search || "");
    return redirectTo("/login", next && next !== "/" ? { next } : undefined);
  }

  // 2. Signed in with an account outside the allowed Google Workspace domain,
  //    or through a provider other than Google.
  if (!isAllowedUser(user)) {
    try {
      await supabase.auth.signOut();
    } catch {
      // Session may already be invalid; cookies are cleared explicitly below.
    }
    // Belt and braces: drop every Supabase auth cookie on the response so a
    // failed GoTrue logout can never leave the browser in a redirect loop.
    const clearAuthCookies = <T extends NextResponse>(res: T): T => {
      request.cookies.getAll().forEach((c) => {
        if (c.name.startsWith("sb-")) res.cookies.set(c.name, "", { maxAge: 0, path: "/" });
      });
      return res;
    };
    if (isApi) return clearAuthCookies(json(403, "forbidden_domain"));
    if (pathname === "/login") return clearAuthCookies(supabaseResponse);
    return clearAuthCookies(redirectTo("/login", { error: "domain" }));
  }

  // 3. Already signed in: no reason to see the login page
  if (pathname === "/login") return redirectTo("/");

  // 4. Admin-only surface: check role from public.profiles
  if (isAdminOnlyPath(pathname)) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    const role = (profile as { role?: string } | null)?.role;
    if (roleLevel(role) < ADMIN_LEVEL) {
      if (isApi) return json(403, "forbidden");
      return redirectTo("/", { denied: pathname });
    }
  }

  return supabaseResponse;
}
