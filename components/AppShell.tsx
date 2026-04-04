"use client";

import { usePathname } from "next/navigation";
import { AuthProvider } from "@/lib/supabase/auth-context";
import { Sidebar } from "./Sidebar";

const NO_SHELL_PATHS = ["/login", "/signup", "/auth"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isNoShell = NO_SHELL_PATHS.some((p) => pathname.startsWith(p));

  return (
    <AuthProvider>
      {isNoShell ? (
        <>{children}</>
      ) : (
        <>
          <Sidebar />
          <main className="flex-1 overflow-y-auto bg-surface p-4 md:p-8 pt-16 md:pt-8">
            {children}
          </main>
        </>
      )}
    </AuthProvider>
  );
}
