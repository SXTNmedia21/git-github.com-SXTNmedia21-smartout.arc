/**
 * Auth provider — listens to Supabase auth state changes and exposes session/user.
 * Handles routing: redirects to (auth) when logged out, (app) when logged in.
 * Registers push notification token after successful authentication.
 */
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter, useSegments } from "expo-router";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { registerPushToken, setupNotificationListeners } from "@/lib/push";

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
 * Resolve the user's active profile and register for push notifications.
 * Fetches the first active profile for the user (one device per person in V1).
 */
async function registerPushForUser(userId: string): Promise<void> {
  try {
    const { data: profile } = await supabase
      .from("profile")
      .select("id")
      .eq("user_id", userId)
      .eq("is_active", true)
      .limit(1)
      .single();

    if (profile?.id) {
      await registerPushToken(profile.id);
    }
  } catch (error) {
    // Non-critical — push registration failure shouldn't block the app
    console.warn("Push registration failed:", error);
  }
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const segments = useSegments() as string[];
  const router = useRouter();

  // Track whether push has been registered for this session to avoid redundant calls
  const pushRegistered = useRef(false);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setIsLoading(false);

      // Register push for existing session (app restart while logged in)
      if (initialSession?.user && !pushRegistered.current) {
        pushRegistered.current = true;
        void registerPushForUser(initialSession.user.id);
      }
    });

    // Listen for auth changes (login, logout, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);

      // Register push token on sign-in events
      if (event === "SIGNED_IN" && newSession?.user && !pushRegistered.current) {
        pushRegistered.current = true;
        void registerPushForUser(newSession.user.id);
      }

      // Reset flag on sign-out so next sign-in re-registers
      if (event === "SIGNED_OUT") {
        pushRegistered.current = false;
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
