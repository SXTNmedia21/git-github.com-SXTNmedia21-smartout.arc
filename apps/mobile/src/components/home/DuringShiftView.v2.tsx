/**
 * DuringShiftView v2 — phase "PÅGÅR" handoff layout.
 *
 * Mirrors docs/design/day-handoff/source/day/mobile-day.jsx →
 * `MobileHomeDuring`. Anna-perspective:
 *  1. Phase pill "PÅGÅR" + greeting + shift-time caption
 *  2. Dark gradient hero card (radial-glow orange overlay):
 *     KLOKKET INN label · 52pt mono live-timer · progress bar
 *     · 3-col Tjent/Pause/Tillegg · Ta pause / Klokk ut
 *  3. NESTE OPPGAVE card (next task + dark "Se alle oppgaver" button)
 *  4. PÅ VAKT NÅ colleague rows
 *  5. 2-col quick actions (Rapportér avvik / Meld til leder)
 *
 * Feature-flag: EXPO_PUBLIC_DURING_SHIFT_V2=true enables this component.
 *
 * Real-data wiring: useShiftPhase (timer/shift), useMyTasks (oppgave-count),
 * useShiftColleagues, useDutyLeader (leader-phone).
 *
 * ADR references: ADR-0133 (mobile executes), ADR-0158 (dual-platform ui).
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { AlertTriangle, MessageCircle } from "lucide-react-native";
import { createStyles, useTheme, withOpacity } from "@/theme";
import { nativeTheme } from "@smartout/design-tokens/native";
import { useMyProfile } from "@/hooks/queries/use-my-profile";
import { useShiftColleagues } from "@/hooks/queries/use-shift-colleagues";
import { Avatar } from "@/components/common/Avatar";
import type { Database } from "@smartout/supabase/database.types";
import type { TimeEntry } from "@/types/time-entry";
import type { MyTaskRow } from "@/hooks/queries/use-my-tasks";

type ScheduleShift = Database["public"]["Tables"]["schedule_shift"]["Row"];

type DuringShiftViewProps = {
  shift: ScheduleShift | null;
  timeEntry: TimeEntry;
  tasks?: MyTaskRow[];
  leaderPhone?: string | null;
};

const HOURLY_RATE_FALLBACK = 220;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function clockHM(time: string): string {
  return time.slice(0, 5);
}

function formatTimer(punchIn: string): string {
  const diff = Math.max(0, Date.now() - new Date(punchIn).getTime());
  const s = Math.floor(diff / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${pad2(h)}:${pad2(m)}:${pad2(sec)}`;
}

function hoursElapsed(punchIn: string): number {
  return Math.max(0, (Date.now() - new Date(punchIn).getTime()) / 3_600_000);
}

function estimateEarnings(hourlyRate: number, punchIn: string): string {
  const kr = hoursElapsed(punchIn) * hourlyRate;
  return new Intl.NumberFormat("nb-NO", {
    maximumFractionDigits: 0,
  }).format(kr);
}

function clockFromIso(iso: string): string {
  const d = new Date(iso);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Battery-saver probe placeholder (expo-battery wiring TODO). */
function useLowPower(): boolean {
  const [low] = useState(false);
  return low;
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

  const { data: profile } = useMyProfile();
  const { data: colleagues } = useShiftColleagues(
    shift?.shift_date ?? null,
    profile?.profile_id ?? null,
  );

  const [timer, setTimer] = useState(() => formatTimer(timeEntry.punch_in));
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    timerRef.current = setInterval(() => setTimer(formatTimer(timeEntry.punch_in)), 1000);
    return () => clearInterval(timerRef.current);
  }, [timeEntry.punch_in]);

  // Hero breathe animation (slow scale 1 → 1.04 → 1).
  const reduceMotion = useReducedMotion();
  const lowPower = useLowPower();
  const shouldAnimate = !reduceMotion && !lowPower;
  const breathScale = useSharedValue(1);
  useEffect(() => {
    if (!shouldAnimate) {
      breathScale.value = 1;
      return;
    }
    breathScale.value = withRepeat(
      withTiming(1.04, { duration: 8000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [shouldAnimate, breathScale]);
  const breathStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breathScale.value }],
  }));

  const firstName = profile?.display_name?.split(" ")[0] ?? "";
  const startedAt = clockFromIso(timeEntry.punch_in);
  const elapsedH = hoursElapsed(timeEntry.punch_in);
  const totalH = shift?.work_hours ?? 8;
  const progressPct = Math.min(100, (elapsedH / totalH) * 100);
  const earnings = estimateEarnings(HOURLY_RATE_FALLBACK, timeEntry.punch_in);

  const activeTasks = tasks.filter((t) => t.status !== "completed" && t.status !== "skipped");
  const nextTask = activeTasks[0];

  const onCall = colleagues ?? [];

  const dark = nativeTheme.dark.heroWarmDeep;
  const greetingShiftCaption = useMemo(() => {
    if (!shift) return null;
    return (
      <>
        Din vakt{" "}
        <Text style={styles.greetingTime}>
          {clockHM(shift.start_time)}–{clockHM(shift.end_time)}
        </Text>
        {shift.zone ? ` · ${shift.zone}` : ""}
      </>
    );
  }, [shift, styles.greetingTime]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Phase header */}
      <View style={styles.header}>
        <View style={styles.phasePill}>
          <View style={[styles.phaseDot, { backgroundColor: theme.colors.success }]} />
          <Text style={[styles.phaseLabel, { color: theme.colors.success }]}>PÅGÅR</Text>
        </View>
        <Text style={styles.greeting}>God dag{firstName ? `, ${firstName}` : ""}</Text>
        {greetingShiftCaption ? (
          <Text style={styles.greetingCaption}>{greetingShiftCaption}</Text>
        ) : null}
      </View>

      {/* Dark hero card with live timer */}
      <View style={styles.heroShell}>
        <Animated.View style={[StyleSheet.absoluteFillObject, breathStyle]}>
          <LinearGradient
            colors={[theme.colors.foreground, dark]}
            start={{ x: 0.1, y: 0.05 }}
            end={{ x: 0.95, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
        </Animated.View>
        {/* Primary radial glow (top-right) — focal warm anchor */}
        <View pointerEvents="none" style={styles.heroGlowWrap}>
          <View style={[styles.heroGlow, { backgroundColor: theme.colors.brandOrange }]} />
        </View>
        {/* Secondary glow (bottom-left) — asymmetric depth */}
        <View pointerEvents="none" style={styles.heroGlowSecondary}>
          <View
            style={[styles.heroGlow, { backgroundColor: theme.colors.brandOrange, opacity: 0.35 }]}
          />
        </View>

        <View style={styles.heroInner}>
          <View style={styles.heroLabelRow}>
            <View style={[styles.phaseDot, { backgroundColor: theme.colors.success }]} />
            <Text style={styles.heroEyebrow}>KLOKKET INN</Text>
          </View>
          <Text
            style={styles.timerValue}
            accessibilityRole="timer"
            accessibilityLabel={`Vakt-tid ${timer}`}
          >
            {timer}
          </Text>
          <Text style={styles.heroCaption}>
            Inn {startedAt} · {elapsedH.toFixed(1)}t av {totalH}t
          </Text>

          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${progressPct}%`, backgroundColor: theme.colors.brandOrange },
              ]}
            />
          </View>

          <View style={styles.heroStats}>
            <HeroStat label="TJENT" value={`${earnings} kr`} />
            <View style={styles.heroStatDivider} />
            <HeroStat label="PAUSE" value="0 min" />
            <View style={styles.heroStatDivider} />
            <HeroStat label="TILLEGG" value="—" />
          </View>

          <View style={styles.heroActions}>
            <Pressable
              onPress={() => Haptics.selectionAsync()}
              style={({ pressed }) => [styles.heroGhostBtn, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Ta pause"
            >
              <Text style={styles.heroGhostText}>Ta pause</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                router.push("/(app)/(home)/punch-clock");
              }}
              style={({ pressed }) => [
                styles.heroPrimaryBtn,
                { backgroundColor: theme.colors.brandOrange },
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Klokk ut"
            >
              <Text style={styles.heroPrimaryText}>Klokk ut</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Neste oppgave */}
      {nextTask ? (
        <View style={styles.card}>
          <View style={styles.taskHeaderRow}>
            <Text style={styles.cardEyebrow}>NESTE OPPGAVE</Text>
            {nextTask.due_at ? (
              <Text style={[styles.taskClock, { color: theme.colors.brandOrange }]}>
                kl {clockFromIso(nextTask.due_at)}
              </Text>
            ) : null}
          </View>
          <Text style={styles.taskTitle}>{nextTask.title}</Text>
          {nextTask.description ? (
            <Text style={styles.taskDesc}>{nextTask.description}</Text>
          ) : null}
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              // Pin date to today (so the operations weekly strip lands on the
              // active shift's date) + filter to "tasks" so only the task feed
              // surfaces — shifts/bookings/notes hidden by default.
              const today = shift?.shift_date ?? toIsoDate(new Date());
              router.push(`/(app)/(home)/operations?date=${today}&filter=tasks`);
            }}
            style={({ pressed }) => [
              styles.taskCta,
              { backgroundColor: theme.colors.foreground },
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Se alle oppgaver (${activeTasks.length})`}
          >
            <Text style={[styles.taskCtaText, { color: theme.colors.background }]}>
              Se alle oppgaver ({activeTasks.length})
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* På vakt nå */}
      {onCall.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardEyebrow}>PÅ VAKT NÅ</Text>
          <View style={styles.teamList}>
            {onCall.slice(0, 5).map((c) => (
              <View key={c.profileId} style={styles.teamRow}>
                <View style={styles.teamAvatar}>
                  <Avatar name={`${c.firstName} ${c.lastName}`} imageUrl={c.avatarUrl} size="md" />
                </View>
                <View style={styles.teamInfo}>
                  <Text style={styles.teamName}>
                    {c.firstName} {c.lastName}
                  </Text>
                  <Text style={styles.teamMeta}>{c.role}</Text>
                </View>
                <View style={[styles.teamDot, { backgroundColor: theme.colors.success }]} />
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* Quick actions 2-col */}
      <View style={styles.quickGrid}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            router.push("/(app)/(home)/deviation");
          }}
          style={({ pressed }) => [styles.quickCard, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Rapportér avvik"
        >
          <AlertTriangle size={18} color={theme.colors.destructive} strokeWidth={1.6} />
          <Text style={styles.quickTitle}>Rapportér avvik</Text>
          <Text style={styles.quickMeta}>Hygiene, temp, HMS</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            if (leaderPhone) Linking.openURL(`tel:${leaderPhone}`);
            else router.push("/(app)/(chat)");
          }}
          style={({ pressed }) => [styles.quickCard, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={leaderPhone ? "Ring leder" : "Meld til leder"}
        >
          <MessageCircle size={18} color={theme.colors.info} strokeWidth={1.6} />
          <Text style={styles.quickTitle}>{leaderPhone ? "Ring leder" : "Meld til leder"}</Text>
          <Text style={styles.quickMeta}>Vaktansvarlig</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  const styles = useStyles();
  return (
    <View style={styles.heroStat}>
      <Text style={styles.heroStatLabel}>{label}</Text>
      <Text style={styles.heroStatValue}>{value}</Text>
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  container: { flex: 1 },
  content: {
    paddingHorizontal: 0,
    paddingTop: theme.spacing.tight,
    paddingBottom: theme.spacing.lg,
    gap: theme.spacing.element,
  },

  header: {
    paddingHorizontal: theme.spacing.xs,
    paddingTop: theme.spacing.tight,
    gap: 6,
  },
  phasePill: { flexDirection: "row", alignItems: "center", gap: 6 },
  phaseDot: { width: 5, height: 5, borderRadius: 9999 },
  phaseLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 2 },
  greeting: {
    fontFamily: "InstrumentSerif-Regular",
    fontSize: 32,
    letterSpacing: -0.5,
    color: theme.colors.foreground,
    lineHeight: 36,
  },
  greetingCaption: { fontSize: 13, color: theme.colors.mutedForeground },
  greetingTime: {
    fontFamily: "GeistMono-Regular",
    fontWeight: "600",
    color: theme.colors.foreground,
  },

  // Hero
  heroShell: {
    borderRadius: 20,
    overflow: "hidden",
    position: "relative",
    ...theme.shadows.lg,
  },
  heroGlowWrap: {
    position: "absolute",
    top: -40,
    right: -40,
    width: 180,
    height: 180,
    borderRadius: 9999,
    overflow: "hidden",
    opacity: 0.35,
  },
  heroGlowSecondary: {
    position: "absolute",
    bottom: -60,
    left: -60,
    width: 200,
    height: 200,
    borderRadius: 9999,
    overflow: "hidden",
    opacity: 0.2,
  },
  heroGlow: {
    width: "100%",
    height: "100%",
    borderRadius: 9999,
    opacity: 0.55,
  },
  heroInner: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 6,
    position: "relative",
  },
  heroLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  heroEyebrow: {
    fontFamily: "GeistMono-Regular",
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 2,
    color: withOpacity(theme.colors.primaryForeground, 0.7),
  },
  timerValue: {
    fontFamily: "GeistMono-Regular",
    fontSize: 52,
    fontWeight: "900",
    letterSpacing: -1.5,
    fontVariant: ["tabular-nums"],
    color: theme.colors.primaryForeground,
    marginTop: 4,
  },
  heroCaption: {
    fontSize: 12,
    color: withOpacity(theme.colors.primaryForeground, 0.6),
  },
  progressTrack: {
    marginTop: 6,
    height: 4,
    borderRadius: 2,
    backgroundColor: withOpacity(theme.colors.primaryForeground, 0.15),
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 2 },

  heroStats: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
    gap: 12,
  },
  heroStat: { flex: 1, gap: 3 },
  heroStatDivider: {
    width: 1,
    height: 30,
    backgroundColor: withOpacity(theme.colors.primaryForeground, 0.12),
  },
  heroStatLabel: {
    fontFamily: "GeistMono-Regular",
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1.4,
    color: withOpacity(theme.colors.primaryForeground, 0.55),
  },
  heroStatValue: {
    fontFamily: "GeistMono-Regular",
    fontSize: 18,
    fontWeight: "700",
    color: theme.colors.primaryForeground,
  },

  heroActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  heroGhostBtn: {
    flex: 1,
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.primaryForeground, 0.18),
    backgroundColor: withOpacity(theme.colors.primaryForeground, 0.08),
    alignItems: "center",
    justifyContent: "center",
  },
  heroGhostText: { fontSize: 14, fontWeight: "600", color: theme.colors.primaryForeground },
  heroPrimaryBtn: {
    flex: 1,
    height: 56,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  heroPrimaryText: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.4,
    color: theme.colors.primaryForeground,
  },

  // Card primitive
  card: {
    backgroundColor: theme.colors.background,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.border, 0.4),
    gap: 6,
  },
  cardEyebrow: {
    fontFamily: "GeistMono-Regular",
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 2,
    color: theme.colors.mutedForeground,
  },

  // Task card
  taskHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  taskClock: {
    fontFamily: "GeistMono-Regular",
    fontSize: 11,
    fontWeight: "700",
  },
  taskTitle: { fontSize: 15, fontWeight: "600", color: theme.colors.foreground },
  taskDesc: { fontSize: 12, color: theme.colors.mutedForeground, marginTop: 4, lineHeight: 16 },
  taskCta: {
    marginTop: 12,
    height: 42,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  taskCtaText: { fontSize: 13, fontWeight: "600" },

  // Team list
  teamList: { gap: 8, marginTop: 4 },
  teamRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 },
  teamAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.secondary,
  },
  teamInfo: { flex: 1 },
  teamName: { fontSize: 13, fontWeight: "500", color: theme.colors.foreground },
  teamMeta: { fontSize: 11, color: theme.colors.mutedForeground, marginTop: 1 },
  teamDot: { width: 6, height: 6, borderRadius: 9999 },

  // Quick actions
  quickGrid: { flexDirection: "row", gap: 10 },
  quickCard: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.border, 0.4),
    gap: 6,
  },
  quickTitle: { fontSize: 13, fontWeight: "600", color: theme.colors.foreground, marginTop: 4 },
  quickMeta: { fontSize: 11, color: theme.colors.mutedForeground },

  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
}));
