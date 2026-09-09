"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { ADMIN_LEVEL, ROLE_LEVEL, roleLevel } from "@/lib/access";

export interface AuthProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
}

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: AuthProfile | null;
  /** Effective role ('member' when signed in without a profile row yet), null when signed out. */
  role: string | null;
  roleLevel: number;
  isAdmin: boolean;
  isOwner: boolean;
  /** True until the initial session lookup has completed. */
  loading: boolean;
  signOut: () => Promise<void>;
}

const NO_AUTH: AuthContextType = {
  user: null,
  session: null,
  profile: null,
  role: null,
  roleLevel: 0,
  isAdmin: false,
  isOwner: false,
  loading: true,
  signOut: async () => {},
};

const AuthContext = createContext<AuthContextType>(NO_AUTH);

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Initial session + keep in sync with token refresh / sign-in / sign-out.
  useEffect(() => {
    let cancelled = false;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (cancelled) return;
        setSession(data.session);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setSession(null);
        setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      // Never await Supabase queries inside this callback (it can deadlock);
      // the profile is loaded by the effect below when the user id changes.
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const user = session?.user ?? null;
  const userId = user?.id ?? null;

  // Load the caller's profile row (role, name, avatar) whenever the user changes.
  useEffect(() => {
    if (!userId) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    supabase
      .from("profiles")
      .select("id,email,full_name,avatar_url,role")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setProfile((data as AuthProfile | null) ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [supabase, userId]);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      window.location.assign("/login");
    }
  }, [supabase]);

  const value = useMemo<AuthContextType>(() => {
    const role = user ? profile?.role || "member" : null;
    const level = roleLevel(role);
    return {
      user,
      session,
      profile,
      role,
      roleLevel: level,
      isAdmin: level >= ADMIN_LEVEL,
      isOwner: level >= ROLE_LEVEL.owner,
      loading,
      signOut,
    };
  }, [user, session, profile, loading, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  return useContext(AuthContext);
}
