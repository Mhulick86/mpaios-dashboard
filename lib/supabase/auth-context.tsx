"use client";

import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
}

const NO_AUTH: AuthContextType = {
  user: null,
  session: null,
  loading: false,
};

export function useAuth(): AuthContextType {
  return NO_AUTH;
}
