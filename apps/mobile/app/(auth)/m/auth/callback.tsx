/**
 * Mobile OAuth/recovery callback — Universal Link landing point.
 *
 * Mounted when the OS routes `https://app.smartout.ai/m/auth/callback?code=...`
 * (or `#access_token=...&type=recovery` for password recovery) into the app via
 * iOS Associated Domains / Android App Links. Picks up the auth params from
 * the deep-link URL and completes the session exchange.
 *
 * Two code paths:
 *   1. OAuth: `?code=<authcode>` → `exchangeCodeForSession(code)`. PKCE verifier
 *      lives in Expo SecureStore (managed by supabase-js storage adapter); the
 *      verifier was written when `signInWithOAuth` was called, persists across
 *      the external-browser hop, and resolves here.
 *   2. Recovery: `#access_token=...&type=recovery` → Supabase client SDK
 *      auto-consumes the hash via `onAuthStateChange("PASSWORD_RECOVERY")`.
 *      Native screen then navigates to a set-new-password flow.
 *
 * On success: navigate to workspace-select. On failure: show error + back to
 * welcome. The actual decision (workspace dashboard vs join-wizard) happens
 * server-side post-login.
 *
 * Refs:
 *   - ADR-0021 amendment (portal canonical), ADR-0362 (web portal-redirect),
 *     ADR-0368 (this sortie — mobile UL bridge)
 *   - docs/architecture/SMARTOUT_AUTH_DEEPLINK_ARCHITECTURE.md §3.1 (mobile
 *     Google flow), §3.3 (mobile recovery flow)
 */
import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { lightColors, spacing, typography, fontWeights, radius, shadows } from "@/theme";

const t = lightColors;

export default function CallbackScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    code?: string;
    error?: string;
    error_description?: string;
  }>();
  const [status, setStatus] = useState<"working" | "success" | "error">("working");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      // Provider-returned error short-circuit (e.g. user cancelled Google).
      if (params.error) {
        setStatus("error");
        setErrorMsg(params.error_description ?? params.error ?? "Autentisering avbrutt.");
        return;
      }

      // OAuth code path. `exchangeCodeForSession` reads the PKCE verifier from
      // the storage adapter (Expo SecureStore) that `signInWithOAuth` wrote
      // to earlier in this same app instance.
      if (params.code) {
        const { error } = await supabase.auth.exchangeCodeForSession(params.code);
        if (cancelled) return;
        if (error) {
          setStatus("error");
          setErrorMsg(error.message);
          return;
        }
        setStatus("success");
        router.replace("/(auth)/workspace-select");
        return;
      }

      // Password-recovery hash path. The Supabase client auto-consumes the
      // hash and fires `PASSWORD_RECOVERY` on `onAuthStateChange`. We can
      // either wait for that event OR check current session presence —
      // here we wait briefly then route to the update-password screen.
      const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
        if (cancelled) return;
        if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
          setStatus("success");
          // Route to a native update-password screen (P2 — to be added in a
          // follow-up sortie). For now, workspace-select handles authenticated
          // users with the force_password_reset flag on user_metadata.
          router.replace("/(auth)/workspace-select");
        }
      });

      // Safety timeout — if nothing fires in 5s, bail out.
      const timer = setTimeout(() => {
        if (cancelled) return;
        if (status === "working") {
          setStatus("error");
          setErrorMsg("Tidsavbrudd. Prøv på nytt.");
        }
      }, 5000);

      return () => {
        subscription.subscription.unsubscribe();
        clearTimeout(timer);
      };
    }

    void run();
    return () => {
      cancelled = true;
    };
    // Intentional one-shot effect — runs once on mount to consume the
    // deep-link auth payload. useLocalSearchParams identity is stable.
  }, []);

  return (
    <View style={[s.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 }]}>
      <View style={s.card}>
        {status === "working" && (
          <>
            <ActivityIndicator size="large" color={t.brandOrange} />
            <Text style={s.heading}>Fullfører innloggingen…</Text>
            <Text style={s.subtitle}>Et øyeblikk.</Text>
          </>
        )}
        {status === "success" && (
          <>
            <Text style={s.heading}>Innlogget!</Text>
            <Text style={s.subtitle}>Tar deg videre…</Text>
          </>
        )}
        {status === "error" && (
          <>
            <Text style={s.heading}>Noe gikk galt</Text>
            <Text style={s.subtitle}>{errorMsg ?? "Ukjent feil."}</Text>
            <TouchableOpacity style={s.button} onPress={() => router.replace("/(auth)/welcome")}>
              <Text style={s.buttonText}>Tilbake</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.background,
    paddingHorizontal: spacing.section,
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
    padding: spacing.section,
  },
  heading: {
    ...typography.title,
    fontWeight: fontWeights.bold,
    color: t.foreground,
    textAlign: "center",
    marginTop: spacing.md,
  },
  subtitle: {
    ...typography.subheadline,
    color: t.mutedForeground,
    textAlign: "center",
    marginTop: spacing.tight,
  },
  button: {
    marginTop: spacing.section,
    height: 52,
    backgroundColor: t.brandOrange,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.section,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.md,
    shadowColor: t.brandOrange,
  },
  buttonText: {
    ...typography.bodyBold,
    color: t.primaryForeground,
  },
});
