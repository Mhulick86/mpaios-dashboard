/**
 * Server-side auth helpers for API routes (app/api/**).
 *
 * Usage (keep the existing calling convention):
 *
 *   try {
 *     const { user, role, isAdmin } = await requireAuth();      // any signed-in staff member
 *     const { user } = await requireRole("admin");              // admins / owner only
 *   } catch (e) {
 *     if (e instanceof Response) return e;                      // 401 / 403 JSON
 *     throw e;
 *   }
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { ADMIN_LEVEL, ROLE_LEVEL, isAllowedUser, roleLevel, type Role } from "@/lib/access";

export interface AuthProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string;
}

export interface AuthContext {
  supabase: SupabaseClient;
  user: User;
  profile: AuthProfile | null;
  /** Effective role: profile.role, or 'member' when no profile row exists yet. */
  role: string;
  roleLevel: number;
  isAdmin: boolean;
}

export type MinRole = Extract<Role, "member" | "admin" | "owner">;

function errorResponse(status: number, error: string): Response {
  return Response.json({ error }, { status });
}

async function createRouteClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options as never)
            );
          } catch {
            // Called from a Server Component: cookies are refreshed by middleware instead.
          }
        },
      },
    }
  );
}

async function loadProfile(supabase: SupabaseClient, userId: string): Promise<AuthProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id,email,full_name,role")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return data as AuthProfile;
}

/**
 * Resolves the calling user. Throws a 401 JSON Response when there is no valid
 * session or the account is not on the allowed Google Workspace domain.
 */
export async function requireAuth(): Promise<AuthContext> {
  const supabase = await createRouteClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) throw errorResponse(401, "unauthorized");
  // Allowed Workspace domain AND a Google identity (not email/password or magic link).
  if (!isAllowedUser(user)) throw errorResponse(401, "unauthorized");

  const profile = await loadProfile(supabase, user.id);
  const role = profile?.role || "member";
  const level = roleLevel(role);

  return {
    supabase,
    user,
    profile,
    role,
    roleLevel: level,
    isAdmin: level >= ADMIN_LEVEL,
  };
}

/**
 * Like requireAuth, but additionally throws a 403 JSON Response when the
 * caller's role level is below the requested minimum.
 */
export async function requireRole(min: MinRole): Promise<AuthContext> {
  const ctx = await requireAuth();
  if (ctx.roleLevel < ROLE_LEVEL[min]) throw errorResponse(403, "forbidden");
  return ctx;
}

/** Non-throwing variant: returns null instead of a 401/403 Response. */
export async function getSessionInfo(): Promise<AuthContext | null> {
  try {
    return await requireAuth();
  } catch {
    return null;
  }
}
