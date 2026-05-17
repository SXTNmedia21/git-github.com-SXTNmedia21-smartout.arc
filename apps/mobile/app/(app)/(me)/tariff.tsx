/**
 * Min tariff — "Tariff & Overenskomst" read screen.
 *
 * Shows the employee's workspace tariff binding:
 * 1. TariffSummaryCard — union, law_version, effective_from, bound status
 * 2. ParagrafReferenceList — paragraf citations with rates
 *
 * READ-ONLY per ADR-0133 (D1-D5 authoring stays on web dashboard).
 * No forms, no edit affordances, no write tools.
 *
 * Data flows:
 * - useCurrentTariff() → GET /api/payroll/tariff/current via web BFF (ADR-0132)
 * - L-0177 fail-fast: getProfileContext() throws on missing workspace_id/profile_id
 * - Telemetry: payroll.tariff_view_loaded_mobile on mount
 *   ⚠ EVENT NOT IN REGISTRY — flagged to orchestrator (T4 scope; T1 BFF owner
 *     must add to packages/telemetry/src/registry.ts before emit is wired).
 *     View-emit is intentionally commented out until registry entry ships.
 *
 * Skeleton loader covers initial load. Error and empty states are explicit.
 */

import React, { useEffect, useRef } from "react";
import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { createStyles, useTheme, withOpacity } from "@/theme";
import { ActionHeader } from "@/components/navigation/ActionHeader";
import { useCurrentTariff } from "@/hooks/queries/use-current-tariff";
import { TariffSummaryCard } from "@/components/tariff/TariffSummaryCard";
import { ParagrafReferenceList } from "@/components/tariff/ParagrafReferenceList";
import { safeGetProfileContext } from "@/lib/profile-context";
import { AlertTriangle } from "lucide-react-native";

/* ── Skeleton ── */

function TariffSkeleton() {
  const styles = useStyles();
  return (
    <View style={styles.skeletonContainer} accessibilityLabel="Laster tariff-informasjon">
      {/* Card skeleton */}
      <View style={styles.skeletonCard}>
        <View style={styles.skeletonAccent} />
        <View style={styles.skeletonContent}>
          <View style={styles.skeletonHeaderRow}>
            <View style={styles.skeletonCircle} />
            <View style={styles.skeletonTextBlock}>
              <View style={[styles.skeletonLine, { width: "40%" }]} />
              <View style={[styles.skeletonLine, { width: "65%", marginTop: 6 }]} />
            </View>
          </View>
          <View style={styles.skeletonDetails}>
            <View style={[styles.skeletonLine, { width: "30%", height: 12 }]} />
            <View style={[styles.skeletonLine, { width: "45%", height: 20, marginTop: 4 }]} />
          </View>
        </View>
      </View>

      {/* List skeleton */}
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.skeletonRow}>
          <View style={[styles.skeletonLine, { width: "35%", height: 22 }]} />
          <View style={[styles.skeletonLine, { width: "80%", height: 14, marginTop: 6 }]} />
          <View style={[styles.skeletonLine, { width: "60%", height: 14, marginTop: 4 }]} />
        </View>
      ))}
    </View>
  );
}

/* ── Error state ── */

function TariffError({ message }: { message: string }) {
  const styles = useStyles();
  const theme = useTheme();
  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      style={styles.errorContainer}
      accessibilityLabel={`Feil ved henting av tariff: ${message}`}
      accessibilityRole="alert"
    >
      <AlertTriangle size={28} color={theme.colors.mutedForeground} strokeWidth={1.5} />
      <Text style={styles.errorTitle}>Kunne ikke hente tariff-informasjon</Text>
      <Text style={styles.errorMessage}>{message}</Text>
    </Animated.View>
  );
}

/* ── Auth error (L-0177 fail-fast) ── */

function AuthError({ message }: { message: string }) {
  const styles = useStyles();
  return (
    <View
      style={styles.authErrorContainer}
      accessibilityLabel={`Autentiseringsfeil: ${message}`}
      accessibilityRole="alert"
    >
      <Text style={styles.authErrorTitle}>Tilgang ikke tilgjengelig</Text>
      <Text style={styles.authErrorMessage}>{message}</Text>
    </View>
  );
}

/* ── Main screen ── */

export default function TariffScreen() {
  const styles = useStyles();
  const theme = useTheme();

  // L-0177 / ADR-0134: fail-fast on missing workspace_id / profile_id.
  // Render error state explicitly — no empty-string fallback.
  const [authError, setAuthError] = React.useState<string | null>(null);
  const authChecked = useRef(false);

  useEffect(() => {
    if (authChecked.current) return;
    authChecked.current = true;

    safeGetProfileContext().then((result) => {
      if (!result.ok) {
        setAuthError(result.error);
      }
      // If ok: context verified. BFF derives identity from JWT — no need to
      // pass profileId/workspaceId to the hook (ADR-0151 / ADR-0176 Invariant 3).

      // ⚠ TELEMETRY BLOCKED — event "payroll.tariff_view_loaded_mobile" is NOT
      // in packages/telemetry/src/registry.ts. T1 (BFF owner) must add the
      // registry entry before this emit() call can be wired. Orchestrator notified.
      // When registry is live, wire:
      //   emit({ event: "payroll.tariff_view_loaded_mobile", workspaceId: context.workspaceId,
      //          actorId: context.profileId });
    });
  }, []);

  const { data, isLoading, error } = useCurrentTariff();

  // Auth check failed — show error before attempting BFF call
  if (authError) {
    return (
      <View style={styles.container}>
        <ActionHeader title="Min tariff" />
        <View style={styles.centeredContent}>
          <AuthError message={authError} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ActionHeader title="Min tariff" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Section header */}
        <Animated.View entering={FadeIn.delay(50).duration(350)} style={styles.sectionHeader}>
          <Text style={styles.sectionOverline}>OVERSIKT</Text>
          <Text style={styles.sectionTitle}>Tariff & Overenskomst</Text>
        </Animated.View>

        {/* Loading skeleton */}
        {isLoading && !data && <TariffSkeleton />}

        {/* BFF error */}
        {error && !isLoading && (
          <TariffError
            message={error instanceof Error ? error.message : "Ukjent feil fra tjenesten."}
          />
        )}

        {/* Tariff summary card */}
        {data && (
          <>
            <TariffSummaryCard data={data} />

            {/* Paragraf references — only shown when bound */}
            {data.is_bound && (
              <Animated.View
                entering={FadeInDown.delay(200).duration(400).springify()}
                style={styles.refSection}
              >
                <Text style={styles.refSectionTitle}>Paragraf-referanser</Text>
                <ParagrafReferenceList references={data.paragraf_references} />
              </Animated.View>
            )}
          </>
        )}

        {/* Subtle refresh indicator while revalidating */}
        {isLoading && data && (
          <View style={styles.refreshRow}>
            <ActivityIndicator size="small" color={theme.colors.mutedForeground} />
            <Text style={styles.refreshText}>Oppdaterer…</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

/* ── Styles ── */

const useStyles = createStyles((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    paddingHorizontal: theme.spacing.section,
    paddingTop: theme.spacing.md,
    paddingBottom: 120,
    gap: theme.spacing.section,
  },
  centeredContent: {
    flex: 1,
    paddingHorizontal: theme.spacing.section,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },

  /* ── Section header ── */
  sectionHeader: {
    gap: 4,
  },
  sectionOverline: {
    fontSize: 10,
    fontWeight: "600" as const,
    letterSpacing: 2.5,
    textTransform: "uppercase" as const,
    color: withOpacity(theme.colors.mutedForeground, 0.6),
  },
  sectionTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "300" as const,
    fontStyle: "italic" as const,
    color: theme.colors.foreground,
    letterSpacing: -0.5,
  },

  /* ── Paragraf references section ── */
  refSection: {
    gap: theme.spacing.md,
  },
  refSectionTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "300" as const,
    fontStyle: "italic" as const,
    color: theme.colors.foreground,
  },

  /* ── Refresh indicator ── */
  refreshRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: theme.spacing.tight,
    paddingVertical: theme.spacing.md,
  },
  refreshText: {
    fontSize: 12,
    color: withOpacity(theme.colors.mutedForeground, 0.6),
  },

  /* ── Error state ── */
  errorContainer: {
    alignItems: "center" as const,
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.page,
    paddingHorizontal: theme.spacing.section,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: theme.colors.foreground,
    textAlign: "center" as const,
  },
  errorMessage: {
    fontSize: 13,
    color: theme.colors.mutedForeground,
    textAlign: "center" as const,
    fontStyle: "italic" as const,
    lineHeight: 19,
  },

  /* ── Auth error state ── */
  authErrorContainer: {
    alignItems: "center" as const,
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.page,
    paddingHorizontal: theme.spacing.section,
  },
  authErrorTitle: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: theme.colors.foreground,
    textAlign: "center" as const,
  },
  authErrorMessage: {
    fontSize: 13,
    color: theme.colors.mutedForeground,
    textAlign: "center" as const,
    fontStyle: "italic" as const,
    lineHeight: 19,
  },

  /* ── Skeleton ── */
  skeletonContainer: {
    gap: theme.spacing.section,
  },
  skeletonCard: {
    borderRadius: theme.radius.xl,
    backgroundColor: theme.isDark ? theme.colors.card : "#ffffff",
    overflow: "hidden" as const,
    ...theme.shadows.sm,
  },
  skeletonAccent: {
    height: 4,
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
  },
  skeletonContent: {
    padding: theme.spacing.page,
    gap: theme.spacing.section,
  },
  skeletonHeaderRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: theme.spacing.md,
  },
  skeletonCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
  },
  skeletonTextBlock: {
    flex: 1,
    gap: 6,
  },
  skeletonLine: {
    height: 14,
    borderRadius: 7,
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
  },
  skeletonDetails: {
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderColor: theme.isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
  },
  skeletonRow: {
    padding: theme.spacing.card,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.isDark ? theme.colors.card : "#ffffff",
    gap: 4,
    ...theme.shadows.sm,
  },
}));
