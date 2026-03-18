/**
 * Auth provider — listens to Supabase auth state changes and exposes session/user.
 * Handles routing: redirects to (auth) when logged out, (app) when logged in.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter, useSegments } from "expo-router";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  isLoading: true,
});

export function useAuth() {
  return useContext(AuthContext);
}

type AuthProviderProps = {
  children: ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setIsLoading(false);
    });

    // Listen for auth changes (login, logout, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Route guard: redirect based on auth state
  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!session && !inAuthGroup) {
      // Not signed in, redirect to welcome
      router.replace("/(auth)/welcome");
    } else if (session && inAuthGroup) {
      // Signed in but still in auth group — workspace-select handles the routing
      // (auto-redirects to app if 1 profile, pending if 0, shows list if >1)
      const isInPostAuthFlow =
        segments[1] === "workspace-select" || segments[1] === "pending" || segments[1] === "verify";
      if (!isInPostAuthFlow) {
        router.replace("/(auth)/workspace-select");
      }
    }
  }, [session, segments, isLoading, router]);

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}
