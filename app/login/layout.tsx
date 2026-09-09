import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in | Marketing Powered AI Operating System",
  description: "Sign in with your Marketing Powered Google account.",
};

/**
 * Full-screen layout for the login page. The root <AppShell> already renders
 * /login without the sidebar; this wrapper pins the page to the viewport so the
 * two-column brand layout fills the window.
 */
export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-full w-full bg-brand-black">{children}</div>;
}
