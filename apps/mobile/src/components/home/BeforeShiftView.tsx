/**
 * BeforeShiftView — phase "STARTER SNART" handoff layout.
 *
 * Mirrors docs/design/day-handoff/source/day/mobile-day.jsx →
 * `MobileHomeBefore` (phase=upcoming). Anna-perspective:
 *  1. Phase pill + Instrument-Serif greeting + shift-time caption
 *  2. Week strip (man-søn, today highlighted + shift-dot)
 *  3. DIN NESTE VAKT card (mono time, countdown, dept-strip inset, button)
 *  4. HVEM ER PÅ I DAG colleague rows
 *  5. MELDINGER TIL TEAMET day-messages
 *
 * Real-data wiring kept (useMyProfile, useShiftColleagues, useDayInfo,
 * useMyShifts for week-strip).
 */

import React, { useMemo } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { createStyles, useTheme, withOpacity } from "@/theme";
import { Avatar } from "@/components/common/Avatar";
import { CompleteProfileCard } from "@/components/onboarding/CompleteProfileCard";
import { useMyProfile } from "@/hooks/queries/use-my-profile";
import { useMyShifts } from "@/hooks/queries/use-my-shifts";
import { useClockIn } from "@/hooks/queries/use-shift-session";
import type { Colleague } from "@/hooks/queries/use-shift-colleagues";
import type { DayInfo } from "@/hooks/queries/use-day-info";
import type { Database } from "@smartout/supabase/database.types";
import type { MyTaskRow } from "@/hooks/queries/use-my-tasks";

type ScheduleShift = Database["public"]["Tables"]["schedule_shift"]["Row"];
type DayMessage = Database["public"]["Tables"]["schedule_day_message"]["Row"];

type BeforeShiftViewProps = {
  shift: ScheduleShift;
  colleagues?: Colleague[];
  dayInfo?: DayInfo | null;
  tasks?: MyTaskRow[];
  /**
   * Phase variant — drives pill label and countdown semantics.
   * - "before"  → STARTER SNART (default, shift in future)
   * - "late"    → IKKE STEMPLET INN (shift in progress, no punch)
   */
  variant?: "before" | "late";
  /**
   * shift_session_id for the employee's runtime session row (ADR-0367).
   * When provided and variant='late', the primary CTA also fires the BFF
   * clock-in mutation (shift_session.status → clocked_in) in addition to
   * navigating to punch-clock. If null/undefined the CTA still navigates
   * (graceful degradation — session may not yet be materialised).
   */
  shiftSessionId?: string | null;
  /**
   * Called after a successful BFF clock-in so the parent can react
   * (e.g. invalidate queries). Optional — the mutation handles its own
   * TanStack Query invalidation internally.
   */
  onClockIn?: (sessionId: string) => void;
};

const DAY_SHORT = ["SØN", "MAN", "TIR", "ONS", "TOR", "FRE", "LØR"];

function clockHM(time: string): string {
  return time.slice(0, 5);
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function countdownTo(shift: ScheduleShift): string {
  const clean = shift.start_time.replace(/[Z+-].*$/, "");
  const start = new Date(`${shift.shift_date}T${clean}`);
  const diffMs = start.getTime() - Date.now();
  if (diffMs <= 0) return "NÅ";
  const totalMin = Math.floor(diffMs / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `STARTER OM ${h}T ${pad2(m)}M`;
  return `STARTER OM ${m}M`;
}

function elapsedSinceStart(shift: ScheduleShift): string {
  const clean = shift.start_time.replace(/[Z+-].*$/, "");
  const start = new Date(`${shift.shift_date}T${clean}`);
  const diffMs = Date.now() - start.getTime();
  if (diffMs <= 0) return "NÅ";
  const totalMin = Math.floor(diffMs / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}T ${pad2(m)}M SIDEN START`;
  return `${m}M SIDEN START`;
}

type WeekDay = {
  date: string;
  dayShort: string;
  dayNum: number;
  isToday: boolean;
  hasShift: boolean;
};

function buildWeek(shifts: ScheduleShift[] | undefined): WeekDay[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isoToday = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;

  // Monday-anchored week: shift back so Mon = day 0
  const dow = (today.getDay() + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - dow);

  const shiftDates = new Set((shifts ?? []).map((s) => s.shift_date));

  return Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const iso = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    return {
      date: iso,
      dayShort: DAY_SHORT[d.getDay()] ?? "",
      dayNum: d.getDate(),
      isToday: iso === isoToday,
      hasShift: shiftDates.has(iso),
    };
  });
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Nå";
  if (mins < 60) return `${mins}m siden`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}t siden`;
  const d = Math.floor(h / 24);
  return `${d}d siden`;
}

export function BeforeShiftView({
  shift,
  colleagues = [],
  dayInfo,
  variant = "before",
  shiftSessionId = null,
  onClockIn,
}: BeforeShiftViewProps) {
  const styles = useStyles();
  const theme = useTheme();
  const router = useRouter();
  const { data: profile } = useMyProfile();
  const { data: myShifts } = useMyShifts();

  // Date for query-key invalidation on clock-in (shift.shift_date is YYYY-MM-DD).
  const clockIn = useClockIn(profile?.profile_id ?? null, shift.shift_date);
  const isClockingIn = clockIn.isPending;

  const firstName = profile?.display_name?.split(" ")[0] ?? "";
  const isLate = variant === "late";
  const countdown = useMemo(
    () => (isLate ? elapsedSinceStart(shift) : countdownTo(shift)),
    [shift, isLate],
  );
  const week = useMemo(() => buildWeek(myShifts), [myShifts]);
  const messages = (dayInfo?.messages ?? []).slice(0, 2);
  const phaseLabel = isLate ? "IKKE STEMPLET INN" : "STARTER SNART";
  const phaseColor = isLate ? theme.colors.warning : theme.colors.brandOrange;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Onboarding CTA — hidden once wizard is complete (spec §S5) */}
      <CompleteProfileCard />

      {/* Phase header */}
      <Animated.View entering={FadeIn.delay(50).duration(500)} style={styles.header}>
        <View style={styles.phasePill}>
          <View style={[styles.phaseDot, { backgroundColor: phaseColor }]} />
          <Text style={[styles.phaseLabel, { color: phaseColor }]}>{phaseLabel}</Text>
        </View>
        <Text style={styles.greeting}>God dag{firstName ? `, ${firstName}` : ""}</Text>
        <Text style={styles.greetingCaption}>
          Din vakt{" "}
          <Text style={styles.greetingTime}>
            {clockHM(shift.start_time)}–{clockHM(shift.end_time)}
          </Text>
          {shift.zone ? ` · ${shift.zone}` : ""}
        </Text>
      </Animated.View>

      {/* Week strip */}
      <Animated.View entering={FadeIn.delay(120).duration(400)}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.weekStrip}
        >
          {week.map((d) => {
            const selected = d.isToday;
            return (
              <View
                key={d.date}
                style={[styles.weekDay, selected && { backgroundColor: theme.colors.foreground }]}
              >
                <Text
                  style={[
                    styles.weekDayShort,
                    { color: selected ? theme.colors.background : theme.colors.mutedForeground },
                  ]}
                >
                  {d.dayShort}
                </Text>
                <Text
                  style={[
                    styles.weekDayNum,
                    { color: selected ? theme.colors.background : theme.colors.foreground },
                  ]}
                >
                  {d.dayNum}
                </Text>
                <View
                  style={[
                    styles.weekDot,
                    { backgroundColor: d.hasShift ? theme.colors.brandOrange : "transparent" },
                  ]}
                />
              </View>
            );
          })}
        </ScrollView>
      </Animated.View>

      {/* Din neste vakt */}
      <Animated.View
        entering={FadeInDown.delay(200).duration(400).springify()}
        style={styles.featureCard}
      >
        {/* Subtle warm depth — top-left brighter, no shadow */}
        <LinearGradient
          colors={[
            withOpacity(theme.colors.brandOrange, 0.06),
            withOpacity(theme.colors.brandOrange, 0),
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.featureGradient}
          pointerEvents="none"
        />
        <View style={styles.featureContent}>
          <View style={styles.featureHeadRow}>
            <Text style={styles.cardEyebrow}>
              {isLate ? "VAKTEN HAR STARTET" : "DIN NESTE VAKT"}
            </Text>
            <Text style={[styles.countdownPill, { color: phaseColor }]}>{countdown}</Text>
          </View>
          <Text style={styles.bigTime}>
            {clockHM(shift.start_time)} – {clockHM(shift.end_time)}
          </Text>

          <View style={styles.deptInset}>
            <View style={[styles.deptStripe, { backgroundColor: phaseColor }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.deptTitle}>{shift.zone ?? "Arbeidsplass"}</Text>
              {shift.role ? <Text style={styles.deptMeta}>Rolle: {shift.role}</Text> : null}
            </View>
          </View>

          {/* Primary CTA varies by phase — late = stempel inn, before = se detaljer */}
          {isLate ? (
            <Pressable
              disabled={isClockingIn}
              onPress={async () => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                // Fire BFF clock-in when a shift_session is linked (ADR-0367).
                // Navigation to punch-clock happens regardless — the BFF call is
                // best-effort; the punch-clock screen owns the time_entry write.
                if (shiftSessionId) {
                  const result = await clockIn.mutateAsync(shiftSessionId);
                  if (result.ok) {
                    onClockIn?.(shiftSessionId);
                  }
                  // If the BFF fails we still navigate — punch-clock handles recovery.
                }
                router.push("/(app)/(home)/punch-clock");
              }}
              style={({ pressed }) => [
                styles.cardButton,
                { backgroundColor: phaseColor, borderColor: phaseColor },
                (pressed || isClockingIn) && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={isClockingIn ? "Stempler inn..." : "Stemple inn nå"}
            >
              <Text style={[styles.cardButtonText, { color: theme.colors.primaryForeground }]}>
                {isClockingIn ? "Stempler inn..." : "Stemple inn nå"}
              </Text>
              <ChevronRight size={16} color={theme.colors.primaryForeground} strokeWidth={1.8} />
            </Pressable>
          ) : (
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                router.push(`/(app)/(shifts)/${shift.schedule_shift_id}`);
              }}
              style={({ pressed }) => [styles.cardButton, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Se vaktdetaljer"
            >
              <Text style={styles.cardButtonText}>Se vaktdetaljer</Text>
              <ChevronRight
                size={16}
                color={withOpacity(theme.colors.mutedForeground, 0.5)}
                strokeWidth={1.6}
              />
            </Pressable>
          )}
        </View>
      </Animated.View>

      {/* Hvem er på i dag */}
      {colleagues.length > 0 ? (
        <Animated.View
          entering={FadeInDown.delay(300).duration(400).springify()}
          style={styles.card}
        >
          <Text style={styles.cardEyebrow}>HVEM ER PÅ I DAG</Text>
          <View style={styles.teamList}>
            {colleagues.slice(0, 5).map((c) => (
              <View key={c.profileId} style={styles.teamRow}>
                <View style={styles.teamAvatar}>
                  <Avatar name={`${c.firstName} ${c.lastName}`} imageUrl={c.avatarUrl} size="md" />
                </View>
                <View style={styles.teamInfo}>
                  <Text style={styles.teamName}>
                    {c.firstName} {c.lastName}
                  </Text>
                  <Text style={styles.teamMeta}>
                    {c.role} · {clockHM(c.startTime)}–{clockHM(c.endTime)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </Animated.View>
      ) : null}

      {/* Meldinger til teamet */}
      {messages.length > 0 ? (
        <Animated.View
          entering={FadeInDown.delay(400).duration(400).springify()}
          style={styles.card}
        >
          <Text style={styles.cardEyebrow}>MELDINGER TIL TEAMET</Text>
          <View>
            {messages.map((m: DayMessage, idx) => (
              <View
                key={m.schedule_day_message_id}
                style={[
                  styles.messageRow,
                  idx === messages.length - 1 && { borderBottomWidth: 0, paddingBottom: 0 },
                ]}
              >
                <Text style={styles.messageTitle}>{m.title}</Text>
                <Text style={styles.messageBody}>{m.content}</Text>
                <Text style={styles.messageMeta}>{relativeTime(m.created_at)}</Text>
              </View>
            ))}
          </View>
        </Animated.View>
      ) : null}
    </ScrollView>
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
    paddingBottom: theme.spacing.tight,
    gap: 6,
  },
  phasePill: { flexDirection: "row", alignItems: "center", gap: 6 },
  phaseDot: { width: 5, height: 5, borderRadius: 9999 },
  phaseLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
  },
  greeting: {
    fontFamily: "InstrumentSerif-Regular",
    fontSize: 32,
    letterSpacing: -0.5,
    color: theme.colors.foreground,
    lineHeight: 36,
  },
  greetingCaption: {
    fontSize: 13,
    color: theme.colors.mutedForeground,
  },
  greetingTime: {
    fontFamily: "GeistMono-Regular",
    fontWeight: "600",
    color: theme.colors.foreground,
  },

  // Week strip
  weekStrip: {
    gap: 6,
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
  },
  weekDay: {
    width: 48,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: "center",
    gap: 2,
  },
  weekDayShort: {
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 1,
  },
  weekDayNum: {
    fontFamily: "GeistMono-Regular",
    fontSize: 16,
    fontWeight: "700",
  },
  weekDot: {
    width: 5,
    height: 5,
    borderRadius: 9999,
    marginTop: 3,
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
    marginBottom: 4,
  },

  featureCard: {
    position: "relative",
    backgroundColor: theme.colors.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.border, 0.4),
    overflow: "hidden",
  },
  featureGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  featureContent: {
    padding: 14,
    gap: 6,
  },
  featureHeadRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  countdownPill: {
    fontFamily: "GeistMono-Regular",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
  },
  bigTime: {
    fontFamily: "GeistMono-Regular",
    fontSize: 30,
    fontWeight: "700",
    letterSpacing: -0.8,
    color: theme.colors.foreground,
    marginTop: 4,
  },

  deptInset: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
    padding: 12,
    backgroundColor: theme.colors.secondary,
    borderRadius: 10,
  },
  deptStripe: {
    width: 3,
    height: 28,
    borderRadius: 2,
  },
  deptTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.foreground,
  },
  deptMeta: {
    fontSize: 11,
    color: theme.colors.mutedForeground,
    marginTop: 2,
  },

  cardButton: {
    marginTop: 14,
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.border, 0.6),
    backgroundColor: theme.colors.background,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  cardButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.foreground,
  },
  pressed: { opacity: 0.7 },

  // Team list
  teamList: { gap: 10, marginTop: 4 },
  teamRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  teamAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.secondary,
  },
  teamInfo: { flex: 1, minWidth: 0 },
  teamName: {
    fontSize: 13,
    fontWeight: "500",
    color: theme.colors.foreground,
  },
  teamMeta: {
    fontSize: 11,
    color: theme.colors.mutedForeground,
    marginTop: 1,
  },

  // Messages
  messageRow: {
    paddingBottom: 10,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: withOpacity(theme.colors.border, 0.4),
  },
  messageTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.foreground,
  },
  messageBody: {
    fontSize: 11,
    color: theme.colors.mutedForeground,
    marginTop: 3,
    lineHeight: 16,
  },
  messageMeta: {
    fontFamily: "GeistMono-Regular",
    fontSize: 10,
    color: withOpacity(theme.colors.mutedForeground, 0.7),
    marginTop: 4,
  },
}));
