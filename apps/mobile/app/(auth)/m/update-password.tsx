/**
 * Native Update-Password screen — Universal Link landing point for password reset.
 *
 * Mounted when the OS routes `https://app.smartout.ai/m/update-password?token_hash=<hash>&type=recovery`
 * into the app via iOS Associated Domains / Android App Links. This is Strategy A per
 * ADR-0368 + ADR-0389 (token_hash over legacy hash-fragment flow).
 *
 * Entry points:
 *   A. ?token_hash=<hash>&type=recovery — standard mobile reset flow. verifyOtp() exchanges
 *      the token and opens a recovery session so the set-password form can proceed.
 *   B. No params — opened without a valid link (e.g. stale shortcut, bad relay).
 *      Redirect immediately to the reset-request screen.
 *
 * Flow:
 *   1. verifyOtp({ token_hash, type: "recovery" }) → recovery session
 *   2. Show set-password form (password + confirm, min 8 chars, match validation)
 *   3. updateUser({ password, data: { force_password_reset: false } })
 *   4. Emit "auth password_reset_completed" (best-effort: omit if profile not yet resolvable)
 *   5. Route to workspace-select
 *
 * Error paths:
 *   - verifyOtp fails (stale/expired/used) → inline error + link to request a new reset
 *   - updateUser fails → inline error, form stays open
 *   - No token_hash on mount → immediate redirect to the reset-request screen
 *
 * Refs:
 *   - ADR-0368 (mobile Universal-Link bridge), ADR-0389 (OTP length coherence + token_hash strategy)
 *   - ADR-0134 (Mobile Telemetry Contract — fail-fast on empty actor_id/workspace_id)
 *   - docs/architecture/SMARTOUT_AUTH_DEEPLINK_ARCHITECTURE.md §3.3
 */
import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { getProfileContext } from "@/lib/profile-context";
import { emit } from "@smartout/telemetry";
import {
  lightColors,
  withOpacity,
  spacing,
  typography,
  fontWeights,
  radius,
  shadows,
} from "@/theme";

const t = lightColors;

type Phase =
  | "verifying" // running verifyOtp — show spinner
  | "form" // verifyOtp succeeded — show set-password form
  | "submitting" // running updateUser — disable form
  | "success" // updateUser succeeded — show brief confirmation
  | "link_error" // verifyOtp failed — invalid/expired token
  | "no_params"; // no token_hash on mount — redirect in progress

export default function UpdatePasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    token_hash?: string;
    type?: string;
  }>();

  const [phase, setPhase] = useState<Phase>("verifying");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // ── Phase A: exchange token_hash for a recovery session on mount ─────────
  useEffect(() => {
    const tokenHash = params.token_hash;

    // No params: redirect immediately — nothing to exchange.
    if (!tokenHash) {
      setPhase("no_params");
      router.replace("/(auth)/verify?flow=login");
      return;
    }

    let cancelled = false;

    async function exchangeToken() {
      // verifyOtp with token_hash — the token lives in the GoTrue one_time_tokens
      // table. We must pass type="recovery" to match the token kind. Passing
      // the wrong type would produce a generic "otp_expired" 403 (ADR-0389).
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash as string,
        type: "recovery",
      });

      if (cancelled) return;

      if (error) {
        setLinkError("Lenken er ugyldig eller utløpt. Be om en ny.");
        setPhase("link_error");
        return;
      }

      // Session is now live in the Supabase client. Show the form.
      setPhase("form");
    }

    void exchangeToken();
    return () => {
      cancelled = true;
    };
    // Intentional one-shot effect: token exchange runs once on mount; params
    // are stable for this screen's lifetime.
  }, []);

  // ── Phase B: submit new password ─────────────────────────────────────────
  async function handleSubmit() {
    setFormError(null);

    if (password.length < 8) {
      setFormError("Passordet må være minst 8 tegn.");
      return;
    }
    if (password !== confirmPassword) {
      setFormError("Passordene stemmer ikke overens.");
      return;
    }

    setPhase("submitting");

    // Atomic: rotate password AND clear the force_password_reset migration flag
    // in one call — mirrors the web update-password page (apps/web/src/app/update-password/page.tsx).
    const { data, error } = await supabase.auth.updateUser({
      password,
      data: { force_password_reset: false },
    });

    if (error) {
      setFormError(error.message);
      setPhase("form");
      return;
    }

    setPhase("success");

    // Telemetry: emit "auth password_reset_completed" — best-effort.
    // At this point the Supabase session is live (updateUser succeeded), but
    // the profile row may not be reachable yet if this is a brand-new user
    // invited without a profile record (race window). We attempt getProfileContext()
    // and emit only if it resolves. Per ADR-0134: empty-string fallback is
    // forbidden — if identity is unresolvable we omit rather than corrupt telemetry.
    try {
      const userId = data.user?.id;
      if (userId) {
        try {
          const { profileId, workspaceId } = await getProfileContext();
          void emit({
            event: "auth password_reset_completed",
            workspace_id: workspaceId,
            actor_id: profileId,
            properties: {
              data: {
                user_id: userId,
                context: "self_service",
              },
            },
          });
        } catch {
          // Profile not yet resolvable (e.g. first-time invited user whose profile
          // row hasn't been created yet). Omit emit — non-fatal, same guard used
          // by web counterpart which also wraps in try/catch. ADR-0134 §Invariant 2.
        }
      }
    } catch {
      // Outer catch: userId lookup failed — also non-fatal.
    }

    // Brief success state → then route to workspace-select. The workspace-select
    // screen handles the decision (join-wizard vs dashboard) based on profile state.
    setTimeout(() => {
      router.replace("/(auth)/workspace-select");
    }, 1200);
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={[s.flex, { backgroundColor: t.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          s.container,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Verifying token ─────────────────────────────────── */}
        {phase === "verifying" && (
          <View style={s.centeredSection}>
            <ActivityIndicator size="large" color={t.brandOrange} />
            <Text style={s.heading}>Verifiserer lenken…</Text>
            <Text style={s.subtitle}>Et øyeblikk.</Text>
          </View>
        )}

        {/* ── Token error ──────────────────────────────────────── */}
        {phase === "link_error" && (
          <View style={s.centeredSection}>
            <Text style={s.heading}>Lenken virker ikke</Text>
            <Text style={s.subtitle}>
              {linkError ?? "Lenken er ugyldig eller utløpt. Be om en ny."}
            </Text>
            <TouchableOpacity
              style={s.primaryButton}
              activeOpacity={0.85}
              onPress={() => router.replace("/(auth)/verify?flow=login")}
            >
              <Text style={s.primaryButtonText}>Be om ny lenke</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── No params (redirect in progress) ─────────────────── */}
        {phase === "no_params" && (
          <View style={s.centeredSection}>
            <ActivityIndicator size="large" color={t.brandOrange} />
            <Text style={s.subtitle}>Tar deg til innlogging…</Text>
          </View>
        )}

        {/* ── Success ──────────────────────────────────────────── */}
        {phase === "success" && (
          <View style={s.centeredSection}>
            <Text style={s.heading}>Passordet er oppdatert!</Text>
            <Text style={s.subtitle}>Tar deg videre…</Text>
            <ActivityIndicator
              size="small"
              color={t.brandOrange}
              style={{ marginTop: spacing.md }}
            />
          </View>
        )}

        {/* ── Set-password form ────────────────────────────────── */}
        {(phase === "form" || phase === "submitting") && (
          <>
            <Text style={s.heading}>Sett nytt passord</Text>
            <Text style={s.subtitle}>Velg et nytt passord for kontoen din.</Text>

            {formError && (
              <View style={s.errorBanner}>
                <Text style={s.errorBannerText}>{formError}</Text>
              </View>
            )}

            <Text style={s.label}>Nytt passord</Text>
            <TextInput
              style={s.input}
              placeholder="Minst 8 tegn"
              placeholderTextColor={t.mutedForeground}
              value={password}
              onChangeText={(v) => {
                setPassword(v);
                setFormError(null);
              }}
              secureTextEntry
              autoComplete="new-password"
              autoCapitalize="none"
              autoCorrect={false}
              editable={phase === "form"}
            />

            <Text style={s.label}>Bekreft passord</Text>
            <TextInput
              style={s.input}
              placeholder="Skriv passordet igjen"
              placeholderTextColor={t.mutedForeground}
              value={confirmPassword}
              onChangeText={(v) => {
                setConfirmPassword(v);
                setFormError(null);
              }}
              secureTextEntry
              autoComplete="new-password"
              autoCapitalize="none"
              autoCorrect={false}
              editable={phase === "form"}
            />

            <TouchableOpacity
              style={[s.primaryButton, phase === "submitting" && s.buttonDisabled]}
              activeOpacity={0.85}
              onPress={handleSubmit}
              disabled={phase === "submitting"}
            >
              {phase === "submitting" ? (
                <ActivityIndicator color={t.primaryForeground} />
              ) : (
                <Text style={s.primaryButtonText}>Oppdater passord</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={s.secondaryLink}
              onPress={() => router.replace("/(auth)/verify?flow=login")}
            >
              <Text style={s.secondaryLinkText}>Be om ny tilbakestillingslenke</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: spacing.section,
    justifyContent: "center",
  },
  centeredSection: {
    alignItems: "center",
    gap: spacing.tight,
  },
  heading: {
    ...typography.largeTitle,
    color: t.foreground,
    textAlign: "center",
    letterSpacing: -0.5,
    marginBottom: spacing.tight,
  },
  subtitle: {
    ...typography.subheadline,
    color: t.mutedForeground,
    textAlign: "center",
    marginBottom: spacing.section,
  },

  // Form
  label: {
    ...typography.subheadline,
    fontWeight: fontWeights.semibold,
    color: t.foreground,
    marginBottom: spacing.tight,
    marginTop: spacing.element,
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.md,
    ...typography.body,
    color: t.foreground,
    backgroundColor: t.secondary,
    marginBottom: spacing.tight,
  },

  // CTA
  primaryButton: {
    height: 52,
    backgroundColor: t.brandOrange,
    borderRadius: radius.xl,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.md,
    ...shadows.md,
    shadowColor: t.brandOrange,
  },
  primaryButtonText: {
    ...typography.bodyBold,
    color: t.primaryForeground,
  },
  buttonDisabled: {
    opacity: 0.6,
  },

  // Error banner
  errorBanner: {
    backgroundColor: withOpacity(t.destructive, 0.08),
    borderWidth: 1,
    borderColor: withOpacity(t.destructive, 0.3),
    borderRadius: radius.lg,
    paddingVertical: spacing.element,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  errorBannerText: {
    ...typography.caption,
    color: t.destructive,
    textAlign: "center",
  },

  // Footer link
  secondaryLink: {
    alignItems: "center",
    marginTop: spacing.md,
    padding: spacing.tight,
  },
  secondaryLinkText: {
    ...typography.subheadline,
    fontWeight: fontWeights.medium,
    color: t.mutedForeground,
  },
});
