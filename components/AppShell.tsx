"use client";

import { Sidebar } from "./Sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-surface p-4 md:p-8 pt-16 md:pt-8 main-safe-pb">
        {children}
      </main>
    </>
  );
}
