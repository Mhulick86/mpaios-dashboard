"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { useAuth } from "@/lib/supabase/auth-context";

/** Routes rendered full-bleed, without the app chrome (sidebar). */
function isBareRoute(pathname: string): boolean {
  return pathname === "/login" || pathname.startsWith("/login/") || pathname.startsWith("/auth/");
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading } = useAuth();

  if (isBareRoute(pathname)) {
    return <div className="flex-1 min-w-0 overflow-y-auto">{children}</div>;
  }

  // Middleware guarantees a session on every non-public route, so keep the
  // sidebar mounted while the client-side session is still resolving to avoid
  // a layout flash. Only drop it once we positively know there is no user.
  const showSidebar = loading || user !== null;

  return (
    <>
      {showSidebar && <Sidebar />}
      <main
        className={`flex-1 min-w-0 overflow-y-auto bg-surface p-4 md:p-8 main-safe-pb ${
          showSidebar ? "pt-16 md:pt-8" : ""
        }`}
      >
        {children}
      </main>
    </>
  );
}
