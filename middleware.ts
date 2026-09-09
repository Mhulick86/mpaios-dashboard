import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match everything except Next.js build assets and the favicon. Static
     * files that must stay public (manifest.json, sw.js, icons/) are listed in
     * PUBLIC_PATHS instead of being excluded by extension, so a dynamic route
     * cannot dodge the session check by ending its path in ".png".
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
