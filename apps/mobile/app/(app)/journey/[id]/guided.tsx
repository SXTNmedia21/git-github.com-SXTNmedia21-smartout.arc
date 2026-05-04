/**
 * Guided Journey — mobile thin-client Fjernkontroll (ADR-0132 / ADR-0133).
 *
 * Mobile NEVER imports capabilities directly. Everything goes through the
 * web BFF at /api/journey/guided/* which derives workspace_id + actor_id
 * server-side from the authenticated session (ADR-0176 Invariant 3, R5.2-1).
 *
 * States rendered: loading_profile | profile_error | idle | starting |
 *                  running | stuck | completed | failed.
 * Mobile gets a simplified render — full motion/spring parity lives on web.
 *
 * Guards:
 * - On mount: safeGetProfileContext() — error screen if profile missing or
 *   empty (ADR-0134 Invariant 2 / R5.2-3). No empty-string fallback.
 * - Every BFF call attaches the Supabase access_token as Bearer (ADR-0132).
 * - Request body DELIBERATELY omits workspace_id / actor_id / profile_id —
 *   server derives them (ADR-0176 Invariant 3).
 * - No `@smartout/ai` imports. No direct capability calls (R5.2-4).
 * - No telemetry emit from mobile — BFF owns emit.
 */

import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, CheckCircle2, AlertTriangle, Play, RotateCcw } from "lucide-react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { createStyles, useTheme } from "@/theme";
import { safeGetProfileContext } from "@/lib/profile-context";
import { bffStartGuided, bffFetchStatus } from "@/lib/journey-bff";

// ── State machine (simplified mobile mirror of ADR-0177 web spec) ──────────
type MobileJourneyState =
  | { kind: "loading_profile" }
  | { kind: "profile_error"; error: string }
  | { kind: "idle" }
  | { kind: "starting" }
  | { kind: "running"; runId: string; currentStep: number; status: string }
  | { kind: "stuck"; runId: string; currentStep: number; lastError: string | null }
  | { kind: "completed"; runId: string }
  | { kind: "failed"; runId: string | null; error: string };

// ── Screen ─────────────────────────────────────────────────────────────────

const useStyles = createStyles((theme) => ({
  root: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.card, gap: theme.spacing.card },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.element,
    paddingHorizontal: theme.spacing.card,
    paddingVertical: theme.spacing.card,
  },
  backBtn: {
    width: 44, // R5.2 touch target
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.muted,
  },
  title: {
    ...theme.typography.title,
    color: theme.colors.foreground,
  },
  card: {
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.card,
    gap: theme.spacing.element,
  },
  stateLabel: {
    ...theme.typography.micro,
    color: theme.colors.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  stateValue: {
    ...theme.typography.largeTitle,
    color: theme.colors.foreground,
  },
  subtleText: {
    ...theme.typography.subheadline,
    color: theme.colors.mutedForeground,
  },
  bodyText: {
    ...theme.typography.body,
    color: theme.colors.foreground,
  },
  primaryBtn: {
    minHeight: 48, // > 44 touch target (R5.2)
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: theme.spacing.tight,
    paddingHorizontal: theme.spacing.card,
  },
  primaryBtnText: {
    color: theme.colors.primaryForeground,
    ...theme.typography.bodyBold,
  },
  errorBox: {
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.destructive,
    padding: theme.spacing.card,
    gap: theme.spacing.element,
  },
  errorText: {
    color: theme.colors.destructive,
    ...theme.typography.body,
  },
  inlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.tight,
  },
}));

const POLL_INTERVAL_MS = 2500;

export default function GuidedJourneyScreen() {
  const router = useRouter();
  const styles = useStyles();
  const theme = useTheme();
  const { id: journeyVersionId } = useLocalSearchParams<{ id: string }>();

  const [state, setState] = useState<MobileJourneyState>({ kind: "loading_profile" });

  // Profile guard on mount (ADR-0134 / R5.2-3). No empty-string fallback.
  useEffect(() => {
    let alive = true;
    (async () => {
      const ctx = await safeGetProfileContext();
      if (!alive) return;
      if (!ctx.ok) {
        setState({ kind: "profile_error", error: ctx.error });
        return;
      }
      setState({ kind: "idle" });
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Poll status while running. Transitions to stuck/completed/failed drive
  // terminal UI. (BFF is the authoritative source — no local emit.)
  useEffect(() => {
    if (state.kind !== "running") return;
    let alive = true;
    const currentRunId = state.runId;
    const tick = async () => {
      const res = await bffFetchStatus(currentRunId);
      if (!alive) return;
      if (!res.ok) {
        setState({ kind: "failed", runId: currentRunId, error: res.error });
        return;
      }
      const s = res.data;
      // Map engine_state.status → UI state.
      if (s.status === "completed") {
        setState({ kind: "completed", runId: s.run_id });
      } else if (s.status === "failed") {
        setState({ kind: "failed", runId: s.run_id, error: s.last_error ?? "Journey failed" });
      } else if (s.status === "stuck") {
        setState({
          kind: "stuck",
          runId: s.run_id,
          currentStep: s.current_step,
          lastError: s.last_error,
        });
      } else {
        setState({
          kind: "running",
          runId: s.run_id,
          currentStep: s.current_step,
          status: s.status,
        });
      }
    };
    const interval = setInterval(tick, POLL_INTERVAL_MS);
    // initial fetch
    void tick();
    return () => {
      alive = false;
      clearInterval(interval);
    };
    // state.kind is the only transition gate we care about — currentRunId
    // is stable while kind === "running".
  }, [state.kind]);

  const handleStart = useCallback(async () => {
    if (!journeyVersionId || typeof journeyVersionId !== "string") {
      setState({ kind: "failed", runId: null, error: "Missing journey id" });
      return;
    }
    setState({ kind: "starting" });
    const result = await bffStartGuided(journeyVersionId);
    if (!result.ok) {
      setState({ kind: "failed", runId: null, error: result.error });
      return;
    }
    setState({ kind: "running", runId: result.runId, currentStep: 0, status: "active" });
  }, [journeyVersionId]);

  const handleReset = useCallback(() => {
    setState({ kind: "idle" });
  }, []);

  // ── Render ────────────────────────────────────────────────────────────
  const renderHeader = () => (
    <View style={styles.header}>
      <Pressable
        style={styles.backBtn}
        onPress={() => router.back()}
        accessibilityLabel="Tilbake"
        accessibilityRole="button"
      >
        <ArrowLeft size={20} color={theme.colors.foreground} />
      </Pressable>
      <Text style={styles.title}>Guided Journey</Text>
    </View>
  );

  const renderBody = () => {
    if (state.kind === "loading_profile") {
      return (
        <View style={styles.card}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={styles.subtleText}>Laster profil…</Text>
        </View>
      );
    }

    if (state.kind === "profile_error") {
      return (
        <View
          style={styles.errorBox}
          accessibilityLiveRegion="polite"
          accessibilityLabel="Profil mangler"
        >
          <Text style={styles.errorText}>
            Fant ikke profil. Journey kan ikke starte uten workspace + profil.
          </Text>
          <Text style={styles.subtleText}>{state.error}</Text>
        </View>
      );
    }

    if (state.kind === "idle") {
      return (
        <View style={styles.card}>
          <Text style={styles.stateLabel}>Status</Text>
          <Text style={styles.stateValue}>Klar til start</Text>
          <Text style={styles.subtleText}>Journey ID: {journeyVersionId}</Text>
          <Pressable
            style={styles.primaryBtn}
            onPress={handleStart}
            accessibilityRole="button"
            accessibilityLabel="Start guided journey"
          >
            <Play size={18} color={theme.colors.primaryForeground} />
            <Text style={styles.primaryBtnText}>Start</Text>
          </Pressable>
        </View>
      );
    }

    if (state.kind === "starting") {
      return (
        <View style={styles.card} accessibilityLiveRegion="polite">
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={styles.stateValue}>Starter…</Text>
        </View>
      );
    }

    if (state.kind === "running") {
      return (
        <Animated.View entering={FadeIn} style={styles.card} accessibilityLiveRegion="polite">
          <Text style={styles.stateLabel}>Status</Text>
          <Text style={styles.stateValue}>Kjører</Text>
          <Text style={styles.subtleText}>Steg {state.currentStep}</Text>
          <Text style={styles.subtleText}>Run: {state.runId}</Text>
          <ActivityIndicator color={theme.colors.primary} />
        </Animated.View>
      );
    }

    if (state.kind === "stuck") {
      return (
        <View style={styles.errorBox} accessibilityLiveRegion="assertive">
          <View style={styles.inlineRow}>
            <AlertTriangle size={20} color={theme.colors.destructive} />
            <Text style={styles.stateValue}>Stuck</Text>
          </View>
          <Text style={styles.errorText}>
            Journey henger på steg {state.currentStep}. Fjernkontrollen venter på handling.
          </Text>
          {state.lastError ? <Text style={styles.subtleText}>{state.lastError}</Text> : null}
          <Pressable style={styles.primaryBtn} onPress={handleReset} accessibilityRole="button">
            <RotateCcw size={18} color={theme.colors.primaryForeground} />
            <Text style={styles.primaryBtnText}>Start på nytt</Text>
          </Pressable>
        </View>
      );
    }

    if (state.kind === "completed") {
      return (
        <Animated.View entering={FadeIn} style={styles.card} accessibilityLiveRegion="polite">
          <View style={styles.inlineRow}>
            <CheckCircle2 size={22} color={theme.colors.success} />
            <Text style={styles.stateValue}>Fullført</Text>
          </View>
          <Text style={styles.subtleText}>Run: {state.runId}</Text>
          <Pressable style={styles.primaryBtn} onPress={handleReset} accessibilityRole="button">
            <Play size={18} color={theme.colors.primaryForeground} />
            <Text style={styles.primaryBtnText}>Kjør igjen</Text>
          </Pressable>
        </Animated.View>
      );
    }

    // failed
    return (
      <View style={styles.errorBox} accessibilityLiveRegion="assertive">
        <Text style={styles.stateValue}>Feil</Text>
        <Text style={styles.errorText}>{state.error}</Text>
        {state.runId ? <Text style={styles.subtleText}>Run: {state.runId}</Text> : null}
        <Pressable style={styles.primaryBtn} onPress={handleReset} accessibilityRole="button">
          <RotateCcw size={18} color={theme.colors.primaryForeground} />
          <Text style={styles.primaryBtnText}>Prøv igjen</Text>
        </Pressable>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      {renderHeader()}
      <ScrollView contentContainerStyle={styles.content}>{renderBody()}</ScrollView>
    </SafeAreaView>
  );
}
