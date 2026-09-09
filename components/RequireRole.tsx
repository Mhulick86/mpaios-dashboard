"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Loader2, ShieldAlert } from "lucide-react";
import { useAuth } from "@/lib/supabase/auth-context";
import { ROLE_LEVEL, type Role } from "@/lib/access";

interface RequireRoleProps {
  /** Minimum role needed to render `children`. Defaults to `admin` (level 3). */
  min?: Role;
  children: ReactNode;
}

/**
 * Client-side render guard for role-gated pages.
 *
 * middleware.ts already redirects non-admins away from ADMIN_ONLY_PATHS on the
 * server; this component is the second line of defence so a page never paints
 * sensitive UI if the session's role is below the threshold (or still loading).
 */
export function RequireRole({ min = "admin", children }: RequireRoleProps) {
  const { roleLevel, loading } = useAuth();
  const required = ROLE_LEVEL[min];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-brand-blue animate-spin" />
      </div>
    );
  }

  if (roleLevel < required) {
    const title = min === "owner" ? "Restricted to the owner" : "Restricted to administrators";
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="w-full max-w-md bg-surface-raised rounded-xl border border-border p-6 md:p-8 text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-red-500/10 flex items-center justify-center mb-4">
            <ShieldAlert className="w-6 h-6 text-red-500" />
          </div>
          <h2 className="text-[16px] md:text-[18px] font-semibold mb-2">{title}</h2>
          <p className="text-[12px] md:text-[13px] text-text-secondary leading-relaxed mb-5">
            This area contains Marketing Powered business data and is only available to administrators.
            Ask Mike Hulick if you need access.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-blue text-white text-[12px] font-semibold hover:bg-brand-blue-dark transition-colors"
          >
            Back to Command Center
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default RequireRole;
