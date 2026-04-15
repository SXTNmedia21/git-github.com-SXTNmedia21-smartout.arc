/**
 * Auth provider — listens to Supabase auth state changes and exposes session/user.
 * Handles routing: redirects to (auth) when logged out, (app) when logged in.
 * Registers push notification token after successful authentication.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter, useSegments } from "expo-router";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { setupNotificationListeners } from "@/lib/push";
import { usePushToken } from "@/hooks/use-push-token";
import { useWorkspaceStore } from "@/hooks/stores/use-workspace-store";

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

/**
 * Resolve the active profile ID for the current user. Returns the first active
 * profile (V1 assumes one device per person). Errors are swallowed — push
 * registration is non-critical and must not block app startup.
 */
async function resolveActiveProfileId(userId: string): Promise<string | null> {
  try {
    const { data: profile } = await supabase
      .from("profile")
      .select("profile_id")
      .eq("user_id", userId)
      .eq("is_active", true)
      .limit(1)
      .single();
    return profile?.profile_id ?? null;
  } catch (error) {
    console.warn("Profile lookup for push registration failed:", error);
    return null;
  }
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // profileId drives usePushToken — kept as state so the hook re-runs when it changes
  const [pushProfileId, setPushProfileId] = useState<string | null>(null);
  const segments = useSegments() as string[];
  const router = useRouter();

  // Register push token whenever the active profile is known.
  // The hook handles permission request, Expo token fetch, and Supabase sync.
  usePushToken(pushProfileId);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setIsLoading(false);

      if (initialSession?.user) {
        void resolveActiveProfileId(initialSession.user.id).then(setPushProfileId);
      }
    });

    // Listen for auth changes (login, logout, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);

      if (event === "SIGNED_IN" && newSession?.user) {
        void resolveActiveProfileId(newSession.user.id).then(setPushProfileId);
      }

      if (event === "SIGNED_OUT") {
        setPushProfileId(null);
        useWorkspaceStore.getState().clearSelectedProfile();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Set up notification listeners (foreground display + tap handling)
  useEffect(() => {
    const cleanup = setupNotificationListeners();
    return cleanup;
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
        segments[1] === "workspace-select" ||
        segments[1] === "pending" ||
        segments[1] === "verify" ||
        segments[1] === "invite";
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
