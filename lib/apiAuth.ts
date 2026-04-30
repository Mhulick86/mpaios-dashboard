import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";

const ANONYMOUS_USER: User = {
  id: "00000000-0000-0000-0000-000000000000",
  app_metadata: {},
  user_metadata: { full_name: "Anonymous" },
  aud: "authenticated",
  created_at: new Date(0).toISOString(),
  email: "anonymous@local",
  role: "authenticated",
} as User;

export async function requireAuth() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options as never)
            );
          } catch {}
        },
      },
    }
  );

  return { supabase, user: ANONYMOUS_USER };
}
