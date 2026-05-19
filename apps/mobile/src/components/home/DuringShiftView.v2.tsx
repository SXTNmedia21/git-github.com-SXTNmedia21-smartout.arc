/**
 * DuringShiftView v2 — "På vakt" home content when clocked in (M4 redesign).
 *
 * Nordic Split gradient-hero redesign per CAMPAIGN-daily-operation.md §M4
 * + Frontend Council 1 motion-spec §M4.
 *
 * Hero:
 *   - Radial-gradient using `--hero-warm-deep` token (9ebef7a6).
 *   - Breathe animation: scale 1 → 1.04 → 1, 8s ease-in-out infinite alternate.
 *   - useReducedMotion() gate: parks scale at 1 when reduced motion is on.
 *   - Low-power gate: useLowPower() (placeholder — expo-battery wiring TODO)
 *     also parks scale at 1 + suppresses the loop.
 *   - Live-timer: `GeistMono-*` tabular-nums 52pt, NO tick animation.
 *     Typography alone carries the tempo.
 *
 * Earnings/pause/tillegg grid + noise-overlay + a11y (aria-labels,
 * focus-ring via pressed states, ≥56pt touch targets) follow Nordic Split
 * glassmorphism + AAA-for-gloves guidance.
 *
 * Feature flag:
 *   EXPO_PUBLIC_DURING_SHIFT_V2=true enables this component. Default (unset
 *   or any non-"true") renders the legacy DuringShiftView.tsx.
 *
 * ADR references: ADR-0133 (mobile executes), ADR-0158 (dual-platform ui).
 */

import React, { useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, Pressable, Linking, StyleSheet } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { UtensilsCrossed, Phone, MessageCircle, AlertTriangle, Coffee } from "lucide-react-native";
import { createStyles, useTheme, withOpacity } from "@/theme";
import { nativeTheme } from "@smartout/design-tokens/native";
import type { Database } from "@smartout/supabase/database.types";
import type { TimeEntry } from "@/types/time-entry";
import type { MyTaskRow } from "@/hooks/queries/use-my-tasks";

type ScheduleShift = Database["public"]["Tables"]["schedule_shift"]["Row"];
/** @deprecated Use MyTaskRow from use-my-tasks for new code */
type SessionTask = MyTaskRow;

type DuringShiftViewProps = {
  shift: ScheduleShift | null;
  timeEntry: TimeEntry;
  tasks?: SessionTask[];
  onPunchOut?: () => void;
  punchingOut?: boolean;
  leaderPhone?: string | null;
};

/**
 * Battery-saver probe. Placeholder: returns false by default.
 *
 * TODO (M4-polish): wire `expo-battery` → `Battery.getPowerStateAsync()` +
 * `Battery.lowPowerModeChanged` listener. Dependency not installed yet;
 * adding here would expand M4 scope. The hook is already consumed so
 * future swap is a no-op for callers. See handoff "Known debt".
 */
function useLowPower(): boolean {
  const [low, _setLow] = useState(false);
  useEffect(() => {
    // Placeholder — no-op until expo-battery lands.
    return () => {};
  }, []);
  return low;
}

function formatTimer(punchIn: string): string {
  const diff = Math.max(0, Date.now() - new Date(punchIn).getTime());
  const s = Math.floor(diff / 1000);
  const h = Math.floor(s / 3600)
    .toString()
    .padStart(2, "0");
  const m = Math.floor((s % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const sec = (s % 60).toString().padStart(2, "0");
  return `${h}:${m}:${sec}`;
}

/** Estimate earnings so far (base rate × elapsed hours). */
function estimateEarnings(hourlyRate: number, punchIn: string): string {
  const hours = (Date.now() - new Date(punchIn).getTime()) / 3_600_000;
  const kr = Math.max(0, hours * hourlyRate);
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    maximumFractionDigits: 0,
  }).format(kr);
}

export function DuringShiftViewV2({
  shift,
  timeEntry,
  tasks = [],
  leaderPhone,
}: DuringShiftViewProps) {
  const styles = useStyles();
  const theme = useTheme();
  const router = useRouter();

  const [timer, setTimer] = useState(() => formatTimer(timeEntry.punch_in));
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    timerRef.current = setInterval(() => setTimer(formatTimer(timeEntry.punch_in)), 1000);
    return () => clearInterval(timerRef.current);
  }, [timeEntry.punch_in]);

  // Breathe animation — scale the hero gradient slowly.
  const reduceMotion = useReducedMotion();
  const lowPower = useLowPower();
  const shouldAnimate = !reduceMotion && !lowPower;

  const breathScale = useSharedValue(1);
  useEffect(() => {
    if (!shouldAnimate) {
      breathScale.value = 1;
      return;
    }
    // 8s ease-in-out infinite alternate (1 → 1.04 → 1).
    breathScale.value = withRepeat(
      withTiming(1.04, { duration: 8000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [shouldAnimate, breathScale]);

  const breathStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breathScale.value }],
  }));

  const activeTasks = tasks.filter((t) => t.status !== "completed" && t.status !== "skipped");
  const criticalCount = activeTasks.filter((t) => t.compliance || t.status === "overdue").length;

  // Hourly rate fallback (220 kr/t) — live rate wiring is an M4-polish follow-up.
  void shift;
  const earnings = estimateEarnings(220, timeEntry.punch_in);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Radial-gradient hero with live timer. */}
      <View style={styles.heroShell}>
        <Animated.View
          style={[StyleSheet.absoluteFillObject, breathStyle]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <LinearGradient
            colors={[
              theme.isDark ? theme.colors.background : theme.colors.card,
              nativeTheme[theme.isDark ? "dark" : "light"].heroWarmDeep,
            ]}
            // Approximates a radial glow via a diagonal linear gradient — RN
            // has no native radial-gradient; this reads as warm depth.
            start={{ x: 0.1, y: 0.05 }}
            end={{ x: 0.95, y: 1 }}
            style={styles.heroGradient}
          />
        </Animated.View>

        {/* Noise-overlay per Nordic Split §glassmorphism. Soft alpha on a
            warm tint keeps the hero from reading flat. */}
        <View
          style={[
            StyleSheet.absoluteFillObject,
            styles.noise,
            {
              backgroundColor: theme.isDark
                ? withOpacity(theme.colors.foreground, 0.1)
                : withOpacity(theme.colors.background, 0.05),
            },
          ]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />

        {/* Dept stripe — accent bar indicating department colour. */}
        <View
          style={[styles.deptStripe, { backgroundColor: theme.colors.brandOrange }]}
          accessibilityRole="image"
          accessibilityLabel="Avdelingsindikator"
        />

        <View style={styles.heroInner}>
          <Text style={styles.heroEyebrow}>PÅ VAKT</Text>
          <Text
            style={styles.timerValue}
            accessibilityRole="timer"
            accessibilityLabel={`Vakt-tid ${timer}`}
          >
            {timer}
          </Text>
          <Text style={styles.heroCaption}>Vakt startet kl. {formatClock(timeEntry.punch_in)}</Text>
        </View>
      </View>

      {/* Earnings / pause / tillegg grid. */}
      <View style={styles.statsGrid}>
        <StatTile label="Tjent så langt" value={earnings} accent="brand" />
        <StatTile label="Pause" value="0 min" accent="muted" />
        <StatTile label="Tillegg" value="—" hint="Beregnes ved oppgjør" accent="muted" />
      </View>

      {/* Clock-out CTA — ≥56pt (hansker), focus-ring via pressed state. */}
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          router.push("/(app)/(home)/punch-clock");
        }}
        style={({ pressed }) => [styles.clockOutCta, pressed && styles.clockOutCtaPressed]}
        accessibilityRole="button"
        accessibilityLabel="Stemple ut"
      >
        <Text style={styles.clockOutLabel}>STEMPLE UT</Text>
      </Pressable>

      {/* Live update panel. */}
      <View
        style={[
          styles.liveCard,
          {
            backgroundColor: theme.isDark
              ? withOpacity(theme.colors.card, 0.4)
              : withOpacity(theme.colors.muted, 0.4),
          },
        ]}
      >
        <View style={styles.livePulse}>
          <View style={[styles.livePulseInner, { backgroundColor: theme.colors.brandOrange }]} />
        </View>
        <Text style={styles.liveLabel}>NÅ SKJER DET</Text>
        <View style={styles.liveRow}>
          <UtensilsCrossed size={28} color={theme.colors.brandOrange} strokeWidth={1.3} />
          <Text style={styles.liveText}>
            VIP-middag om <Text style={styles.liveAccent}>15 min</Text>
          </Text>
        </View>
        {criticalCount > 0 ? (
          <Text style={[styles.liveMeta, { color: theme.colors.destructive }]}>
            {criticalCount} kritisk{criticalCount === 1 ? "" : "e"} oppgave
            {criticalCount === 1 ? "" : "r"} venter
          </Text>
        ) : null}
      </View>

      {/* Quick actions — 2×2. */}
      <View style={styles.actionsGrid}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            if (leaderPhone) Linking.openURL(`tel:${leaderPhone}`);
          }}
          style={({ pressed }) => [
            styles.actionCard,
            styles.actionCardPrimary,
            pressed && styles.actionPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Ring leder"
        >
          <Phone size={24} color={theme.colors.primaryForeground} strokeWidth={1.5} />
          <Text style={styles.actionLabelPrimary}>Ring leder</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            router.push("/(app)/(chat)");
          }}
          style={({ pressed }) => [styles.actionCard, pressed && styles.actionPressed]}
          accessibilityRole="button"
          accessibilityLabel="Åpne chat"
        >
          <MessageCircle size={24} color={theme.colors.brandOrange} strokeWidth={1.5} />
          <Text style={styles.actionLabel}>Åpne chat</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            router.push("/(app)/(home)/deviation");
          }}
          style={({ pressed }) => [styles.actionCard, pressed && styles.actionPressed]}
          accessibilityRole="button"
          accessibilityLabel="Rapporter avvik"
        >
          <AlertTriangle size={24} color={theme.colors.destructive} strokeWidth={1.5} />
          <Text style={styles.actionLabel}>Rapporter avvik</Text>
        </Pressable>
        <Pressable
          onPress={() => Haptics.selectionAsync()}
          style={({ pressed }) => [
            styles.actionCard,
            styles.actionCardMuted,
            pressed && styles.actionPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Ta pause"
        >
          <Coffee size={24} color={theme.colors.mutedForeground} strokeWidth={1.5} />
          <Text style={styles.actionLabelMuted}>Ta pause</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function StatTile({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent: "brand" | "muted";
}) {
  const styles = useStyles();
  const theme = useTheme();
  return (
    <View
      style={[
        styles.statTile,
        {
          backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.4) : theme.colors.card,
          borderColor: withOpacity(theme.colors.border, 0.15),
        },
      ]}
    >
      <Text style={[styles.statLabel, { color: theme.colors.mutedForeground }]}>
        {label.toUpperCase()}
      </Text>
      <Text
        style={[
          styles.statValue,
          {
            color: accent === "brand" ? theme.colors.brandOrange : theme.colors.foreground,
          },
        ]}
      >
        {value}
      </Text>
      {hint ? (
        <Text style={[styles.statHint, { color: theme.colors.mutedForeground }]} numberOfLines={1}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

function formatClock(iso: string): string {
  const d = new Date(iso);
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

const useStyles = createStyles((theme) => ({
  container: { flex: 1 },
  content: {
    paddingHorizontal: theme.spacing.section,
    paddingTop: theme.spacing.element,
    paddingBottom: theme.spacing.xl + 40,
    gap: theme.spacing.page,
  },

  // Hero gradient shell — clips the animated gradient layer.
  heroShell: {
    position: "relative",
    borderRadius: theme.radius.xl,
    overflow: "hidden",
    minHeight: 220,
    justifyContent: "flex-end",
  },
  heroGradient: {
    flex: 1,
  },
  noise: {
    opacity: 0.6,
  },
  deptStripe: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  heroInner: {
    paddingVertical: theme.spacing.section,
    paddingHorizontal: theme.spacing.section,
    gap: theme.spacing.element,
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 2,
    color: theme.colors.mutedForeground,
  },
  timerValue: {
    fontFamily: "GeistMono-Regular",
    fontSize: 52,
    fontWeight: "700",
    letterSpacing: -1.5,
    // Tabular numerals — each digit occupies the same width so the timer
    // doesn't jitter as seconds roll. Typography carries tempo — no tick
    // animation.
    fontVariant: ["tabular-nums"],
    color: theme.colors.brandOrange,
  },
  heroCaption: {
    fontSize: 13,
    color: theme.colors.mutedForeground,
  },

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.element,
  },
  statTile: {
    flexGrow: 1,
    flexBasis: "30%",
    minWidth: 100,
    padding: theme.spacing.card,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    gap: 6,
  },
  statLabel: {
    fontFamily: "GeistMono-Regular",
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1.4,
  },
  statValue: {
    fontFamily: "GeistMono-Regular",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  statHint: {
    fontSize: 11,
  },

  clockOutCta: {
    alignSelf: "center",
    minWidth: 200,
    minHeight: 64,
    paddingHorizontal: theme.spacing.section,
    paddingVertical: theme.spacing.element,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.brandOrange,
    ...theme.shadows.lg,
  },
  clockOutCtaPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
  clockOutLabel: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 1,
    color: theme.colors.primaryForeground,
  },

  liveCard: {
    borderRadius: theme.radius.lg,
    padding: theme.spacing.card,
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.border, 0.2),
    gap: theme.spacing.element,
    overflow: "hidden",
    position: "relative",
  },
  livePulse: {
    position: "absolute",
    top: 14,
    right: 14,
  },
  livePulseInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  liveLabel: {
    fontFamily: "GeistMono-Regular",
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 2,
    color: theme.colors.mutedForeground,
  },
  liveRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.element,
  },
  liveText: {
    ...theme.typography.title,
    color: theme.colors.foreground,
    flex: 1,
    lineHeight: 28,
  },
  liveAccent: {
    fontStyle: "italic",
    color: theme.colors.brandOrange,
  },
  liveMeta: {
    fontSize: 12,
    fontWeight: "600",
  },

  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: theme.spacing.element,
  },
  actionCard: {
    width: "48.5%",
    minHeight: 104,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: theme.spacing.section,
    backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.4) : theme.colors.background,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.border, 0.15),
    ...theme.shadows.sm,
  },
  actionCardPrimary: {
    backgroundColor: theme.colors.brandOrange,
    borderColor: "transparent",
  },
  actionCardMuted: {
    backgroundColor: theme.isDark ? withOpacity(theme.colors.muted, 0.3) : theme.colors.muted,
  },
  actionPressed: { transform: [{ scale: 0.95 }] },
  actionLabel: {
    ...theme.typography.subheadline,
    fontWeight: "500",
    color: theme.colors.foreground,
  },
  actionLabelPrimary: {
    ...theme.typography.subheadline,
    fontWeight: "500",
    color: theme.colors.primaryForeground,
  },
  actionLabelMuted: {
    ...theme.typography.subheadline,
    fontWeight: "500",
    color: theme.colors.mutedForeground,
  },
}));
