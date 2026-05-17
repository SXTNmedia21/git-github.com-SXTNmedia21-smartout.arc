/**
 * Lønnsgrunnlag Detail — Read-only PDF viewer for a single lønnsgrunnlag.
 *
 * Mobile is WITNESS-only for payroll (ADR-0133). This screen:
 *   - Fetches a signed URL via useLonnsgrunnlagUrl (Wave B BFF dependency)
 *   - Shares the PDF via expo-sharing Sharing.shareAsync (J3 acceptance criterion)
 *   - Falls back to Linking.openURL on devices where sharing is unavailable
 *   - NO generation, NO admin actions, NO authoring
 *
 * Loading skeleton (§B acceptance criterion):
 *   Three rows pulse via Reanimated useSharedValue opacity (0.3 → 0.8 repeat).
 *   ONLY opacity animated — GPU compositor rule (no layout/transform animations).
 *   Spring: nativeTheme.motion.springAmbient (≡ springGentle — slow, unhurried).
 *   Skeleton shows while (isLoading && !urlData) to eliminate layout shift.
 *
 * ADR-0151: profile_id derived from getProfileContext() — never from route params.
 * ADR-0134: mobile only emits server-side-registered events; no new telemetry
 *   events are emitted from this screen.
 * ADR-0133: witness-only — no generate/override/admin UI elements.
 * L-0177: empty state returns clear UI + retry; error state shows toast + retry.
 */

import React, { useEffect, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, ScrollView, StyleSheet } from "react-native";
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import * as Sharing from "expo-sharing";
import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, RefreshCw, FileText, ShieldCheck, Share2 } from "lucide-react-native";
import { createStyles, useTheme, withOpacity } from "@/theme";
import { nativeTheme } from "@smartout/design-tokens/native";
import { ActionHeader } from "@/components/navigation/ActionHeader";
import { useLonnsgrunnlagUrl } from "@/hooks/queries/use-lonnsgrunnlag";
import { getProfileContext } from "@/lib/profile-context";

/* ── Motion (springAmbient / orbMigrationMs for skeleton pulse timing) ─────── */
// nativeTheme.motion.springAmbient = { stiffness:35, damping:22, mass:2.2 }
// Use orbMigrationMs (800ms) as the withTiming pulse duration — same motion vocabulary.

/* ── Loading skeleton — 3 rows, opacity-only pulse (GPU rule) ───────────────── */

/**
 * SkeletonRow: single animated bar. Only opacity is animated — no layout or
 * transform animations (GPU compositor constraint per animation-gpu-properties).
 * Spring: springAmbient (low stiffness, high damping — unhurried pulse).
 */
function SkeletonRow({ width, height = 18 }: { width: number | `${number}%`; height?: number }) {
  const theme = useTheme();
  const opacity = useSharedValue(0.3);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  // Pulse duration derived from spring ambient damping ratio — unhurried.
  // springAmbient { stiffness:35, damping:22, mass:2.2 } → ~900ms feel.
  const PULSE_MS = nativeTheme.motion.orbMigrationMs ?? 900;

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.8, { duration: PULSE_MS }),
        withTiming(0.3, { duration: PULSE_MS }),
      ),
      -1, // infinite
      false,
    );
  }, []);
  // opacity shared value initialised once — no deps needed (Reanimated worklet)

  const bgColor = theme.isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)";

  return (
    <Animated.View
      style={[
        animatedStyle,
        {
          width,
          height,
          borderRadius: height / 2,
          backgroundColor: bgColor,
        },
      ]}
    />
  );
}

/**
 * LonnsgrunnlagDetailSkeleton — 3 rows matching the layout:
 *   Row 1: wide (simulates primary button placeholder)
 *   Row 2: medium (secondary action placeholder)
 *   Row 3: narrow (metadata / disclaimer placeholder)
 *
 * Eliminates layout shift when the screen first loads before urlData arrives.
 */
function LonnsgrunnlagDetailSkeleton() {
  return (
    <View style={skeletonStyles.container}>
      <SkeletonRow width="100%" height={52} />
      <SkeletonRow width="75%" height={44} />
      <SkeletonRow width="50%" height={28} />
    </View>
  );
}

const skeletonStyles = StyleSheet.create({
  container: {
    gap: 12,
    paddingVertical: 8,
  },
});

/* ── Types ────────────────────────────────────────────────────────────────── */

type RouteParams = {
  eventId: string;
  periodLabel: string;
  exportedAt: string;
};

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function formatExportedAt(isoDate: string): string {
  const d = new Date(isoDate);
  const months = [
    "jan.",
    "feb.",
    "mar.",
    "apr.",
    "mai",
    "jun.",
    "jul.",
    "aug.",
    "sep.",
    "okt.",
    "nov.",
    "des.",
  ];
  return `${d.getDate()}. ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function isUrlExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() < Date.now() + 60_000; // 1min buffer
}

/* ── Component ────────────────────────────────────────────────────────────── */

export default function LonnsgrunnlagDetailScreen() {
  const styles = useStyles();
  const theme = useTheme();
  const router = useRouter();

  const { eventId, periodLabel, exportedAt } = useLocalSearchParams<RouteParams>();

  // ADR-0151 — profile_id resolved from session, never from route params.
  const [profileId, setProfileId] = useState<string>("");
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getProfileContext()
      .then((ctx) => {
        if (!cancelled) setProfileId(ctx.profileId);
      })
      .catch((err: unknown) => {
        if (!cancelled) setProfileError(err instanceof Error ? err.message : "Autentiseringsfeil");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Wave B BFF dependency — disabled until profileId is resolved.
  const {
    data: urlData,
    isLoading,
    isError,
    error,
    refetch,
    dataUpdatedAt,
  } = useLonnsgrunnlagUrl(eventId ?? "", profileId);

  const [openError, setOpenError] = useState<string | null>(null);
  const [isOpening, setIsOpening] = useState(false);

  const expired = urlData ? isUrlExpired(urlData.expires_at) : false;

  /**
   * Primary action: share PDF via expo-sharing native sheet (J3 acceptance).
   * Falls back to Linking.openURL when Sharing.isAvailableAsync() returns false
   * (e.g. web/simulator environments that do not support native share sheet).
   * Uses React Native ActivityIndicator while sharing is in progress — no
   * custom spinner per acceptance criterion D.
   */
  async function handleShare() {
    if (!urlData?.signed_url) return;
    if (expired) {
      await refetch();
      return;
    }

    setIsOpening(true);
    setOpenError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const available = await Sharing.isAvailableAsync();
      if (available) {
        // Share via native OS sheet (Files, AirDrop, Mail, etc.)
        await Sharing.shareAsync(urlData.signed_url, {
          mimeType: "application/pdf",
          dialogTitle: `Lønnsgrunnlag — ${periodLabel ?? ""}`,
        });
      } else {
        // Fallback: open in system browser / OS PDF viewer
        const supported = await Linking.canOpenURL(urlData.signed_url);
        if (!supported) {
          setOpenError("Kan ikke åpne PDF på denne enheten.");
          return;
        }
        await Linking.openURL(urlData.signed_url);
      }
    } catch (err) {
      setOpenError(err instanceof Error ? err.message : "Kunne ikke åpne PDF.");
    } finally {
      setIsOpening(false);
    }
  }

  async function handleRefresh() {
    Haptics.selectionAsync();
    setOpenError(null);
    await refetch();
  }

  /* ── Auth error screen ─────────────────────────────────────────────────── */
  if (profileError) {
    return (
      <View style={styles.container}>
        <ActionHeader title="Lønnsgrunnlag" />
        <View style={styles.centeredState}>
          <Text style={styles.errorTitle}>Autentiseringsfeil</Text>
          <Text style={styles.errorBody}>{profileError}</Text>
          <Pressable
            onPress={() => router.back()}
            style={styles.retryButton}
            accessibilityRole="button"
            accessibilityLabel="Gå tilbake"
          >
            <Text style={styles.retryText}>Gå tilbake</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  /* ── Missing params guard ──────────────────────────────────────────────── */
  if (!eventId) {
    return (
      <View style={styles.container}>
        <ActionHeader title="Lønnsgrunnlag" />
        <View style={styles.centeredState}>
          <Text style={styles.errorTitle}>Manglende data</Text>
          <Text style={styles.errorBody}>Kunne ikke identifisere lønnsgrunnlaget.</Text>
          <Pressable
            onPress={() => router.back()}
            style={styles.retryButton}
            accessibilityRole="button"
            accessibilityLabel="Gå tilbake"
          >
            <Text style={styles.retryText}>Gå tilbake</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Back button in lieu of ActionHeader navigation (custom header) */}
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            router.back();
          }}
          style={styles.backButton}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Tilbake"
        >
          <ChevronLeft size={24} color={theme.colors.foreground} strokeWidth={1.8} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerOverline}>Lønnsgrunnlag</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {periodLabel ?? "—"}
          </Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* ── Document card ────────────────────────────────────────────── */}
        <Animated.View entering={FadeIn.delay(50).duration(350)} style={styles.docCard}>
          <View style={styles.docIconWrap}>
            <FileText size={32} color={theme.colors.brandOrange} strokeWidth={1.5} />
          </View>
          <View style={styles.docMeta}>
            <Text style={styles.docTitle}>Lønnsgrunnlag — {periodLabel ?? "—"}</Text>
            {exportedAt ? (
              <Text style={styles.docDate}>Generert {formatExportedAt(exportedAt)}</Text>
            ) : null}
          </View>
          <View style={styles.docBadge}>
            <ShieldCheck size={14} color="#22c55e" strokeWidth={1.8} />
            <Text style={styles.docBadgeText}>Signert dokument</Text>
          </View>
        </Animated.View>

        {/* ── Loading skeleton (§B) ───────────────────────────────────── */}
        {/*
         * 3-row skeleton while URL is loading and no data yet.
         * Eliminates layout shift. Only opacity animated (GPU rule).
         * Shows for both auth phase (profileId empty) and URL fetch phase.
         */}
        {(profileId.length === 0 || (profileId.length > 0 && isLoading && !urlData)) &&
          !profileError && <LonnsgrunnlagDetailSkeleton />}

        {profileId.length > 0 && isError && (
          <View style={styles.errorBlock}>
            <Text style={styles.errorBody}>
              {(error as Error)?.message ?? "Kunne ikke hente tilgang til dokumentet."}
            </Text>
            <Pressable
              onPress={handleRefresh}
              style={styles.retryButton}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Prøv igjen"
            >
              <RefreshCw size={14} color="#ffffff" strokeWidth={2} />
              <Text style={styles.retryText}>Prøv igjen</Text>
            </Pressable>
          </View>
        )}

        {expired && urlData && (
          <View style={styles.warningBlock}>
            <Text style={styles.warningText}>
              Tilgangen til dokumentet er utløpt. Trykk Oppdater for ny tilgang.
            </Text>
          </View>
        )}

        {openError && (
          <View style={styles.errorBlock}>
            <Text style={styles.errorBody}>{openError}</Text>
          </View>
        )}

        {/* ── Action buttons ───────────────────────────────────────────── */}
        {urlData && !isError && (
          <Animated.View entering={FadeIn.delay(200).duration(350)} style={styles.actionsBlock}>
            {/* Primary: Del / Åpne via expo-sharing native sheet (J3 acceptance) */}
            <Pressable
              onPress={handleShare}
              disabled={isOpening || isLoading}
              style={({ pressed }) => [
                styles.primaryButton,
                (isOpening || isLoading) && styles.buttonDisabled,
                pressed && styles.buttonPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Del eller åpne lønnsgrunnlag"
            >
              {isOpening ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Share2 size={18} color="#ffffff" strokeWidth={2} />
              )}
              <Text style={styles.primaryButtonText}>
                {expired ? "Oppdater og åpne" : "Del / Åpne"}
              </Text>
            </Pressable>

            {/* Secondary: manual refresh */}
            <Pressable
              onPress={handleRefresh}
              disabled={isLoading}
              style={({ pressed }) => [
                styles.secondaryButton,
                isLoading && styles.buttonDisabled,
                pressed && styles.buttonPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Oppdater tilgang"
            >
              <RefreshCw
                size={16}
                color={isLoading ? theme.colors.mutedForeground : theme.colors.foreground}
                strokeWidth={1.8}
              />
              <Text
                style={[
                  styles.secondaryButtonText,
                  isLoading && { color: theme.colors.mutedForeground },
                ]}
              >
                Oppdater
              </Text>
            </Pressable>
          </Animated.View>
        )}

        {/* ── Witness-only disclaimer ─────────────────────────────────── */}
        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            Dette er et lønnsgrunnlag — ikke en lønnsslipp. Dokumentet viser grunnlaget for
            lønnsberegning og skal overleveres regnskapsfører for videre behandling.
          </Text>
          {dataUpdatedAt > 0 && (
            <Text style={styles.disclaimerMeta}>
              Oppdatert{" "}
              {new Date(dataUpdatedAt).toLocaleTimeString("nb-NO", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

/* ── Styles ──────────────────────────────────────────────────────────────── */

const useStyles = createStyles((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  /* Custom header (matches payslip-detail.tsx pattern) */
  header: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingTop: 56,
    paddingBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.section,
    borderBottomWidth: 1,
    borderBottomColor: theme.isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  headerCenter: {
    flex: 1,
    alignItems: "center" as const,
    paddingHorizontal: theme.spacing.xs,
  },
  headerOverline: {
    fontSize: 9,
    fontWeight: "700" as const,
    letterSpacing: 1.5,
    textTransform: "uppercase" as const,
    color: withOpacity(theme.colors.mutedForeground, 0.6),
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "400" as const,
    fontStyle: "italic" as const,
    color: theme.colors.foreground,
  },
  headerRight: {
    width: 40,
  },

  content: {
    paddingHorizontal: theme.spacing.section,
    paddingTop: theme.spacing.page,
    paddingBottom: 120,
    gap: theme.spacing.section,
  },

  /* Document card */
  docCard: {
    backgroundColor: theme.isDark ? theme.colors.card : "#ffffff",
    borderRadius: theme.radius.xl,
    padding: theme.spacing.page,
    gap: theme.spacing.md,
    ...theme.shadows.sm,
  },
  docIconWrap: {
    width: 56,
    height: 56,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.isDark
      ? withOpacity(theme.colors.brandOrange, 0.12)
      : withOpacity(theme.colors.brandOrange, 0.08),
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  docMeta: {
    gap: 4,
  },
  docTitle: {
    fontSize: 18,
    fontWeight: "500" as const,
    color: theme.colors.foreground,
  },
  docDate: {
    fontSize: 12,
    fontWeight: "400" as const,
    color: theme.colors.mutedForeground,
  },
  docBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
    alignSelf: "flex-start" as const,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radius.full,
    backgroundColor: "rgba(34,197,94,0.08)",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.15)",
  },
  docBadgeText: {
    fontSize: 11,
    fontWeight: "600" as const,
    letterSpacing: 0.3,
    color: "#22c55e",
  },

  /* Loading / error states */
  loadingBlock: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.element,
  },
  loadingText: {
    fontSize: 14,
    color: theme.colors.mutedForeground,
    fontStyle: "italic" as const,
  },
  errorBlock: {
    backgroundColor: theme.isDark ? "rgba(239,68,68,0.12)" : "rgba(239,68,68,0.06)",
    borderRadius: theme.radius.lg,
    padding: theme.spacing.card,
    gap: theme.spacing.md,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.18)",
  },
  warningBlock: {
    backgroundColor: theme.isDark ? "rgba(245,158,11,0.10)" : "rgba(245,158,11,0.07)",
    borderRadius: theme.radius.lg,
    padding: theme.spacing.card,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.20)",
  },
  warningText: {
    fontSize: 13,
    color: "#f59e0b",
    fontWeight: "500" as const,
  },

  /* Action buttons */
  actionsBlock: {
    gap: theme.spacing.md,
  },
  primaryButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: theme.spacing.md,
    paddingVertical: 16,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.brandOrange,
    ...theme.shadows.sm,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: "#ffffff",
    letterSpacing: 0.2,
  },
  secondaryButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: theme.spacing.md,
    paddingVertical: 13,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.06)" : theme.colors.secondary,
    borderWidth: 1,
    borderColor: theme.isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: "500" as const,
    color: theme.colors.foreground,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonPressed: {
    transform: [{ scale: 0.97 as number }],
    opacity: 0.85,
  },

  /* Centered full-screen states */
  centeredState: {
    flex: 1,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingHorizontal: theme.spacing.page,
    gap: theme.spacing.element,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "300" as const,
    fontStyle: "italic" as const,
    color: theme.colors.foreground,
  },
  errorBody: {
    fontSize: 14,
    color: theme.colors.mutedForeground,
    textAlign: "center" as const,
  },
  retryButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: theme.spacing.xs,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.brandOrange,
    marginTop: theme.spacing.xs,
  },
  retryText: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: "#ffffff",
  },

  /* Disclaimer block */
  disclaimer: {
    gap: 6,
    paddingVertical: theme.spacing.element,
    paddingHorizontal: theme.spacing.card,
    borderTopWidth: 1,
    borderTopColor: theme.isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
  },
  disclaimerText: {
    fontSize: 11,
    lineHeight: 16,
    color: withOpacity(theme.colors.mutedForeground, 0.7),
    textAlign: "center" as const,
  },
  disclaimerMeta: {
    fontSize: 10,
    color: withOpacity(theme.colors.mutedForeground, 0.4),
    textAlign: "center" as const,
  },
}));
