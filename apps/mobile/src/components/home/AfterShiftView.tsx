/**
 * AfterShiftView — phase "VENTER PÅ OPPGJØR" handoff layout.
 *
 * Mirrors docs/design/day-handoff/source/day/mobile-day.jsx →
 * `MobileHomeAfter`. Anna-perspective:
 *  1. Phase pill "VENTER PÅ OPPGJØR" + greeting + shift caption
 *  2. Card 1 — green check "Vakten er ferdig" · Instrument-Serif "God jobb i dag."
 *     · klokket-ut tid · 3-col stats inset (TIMER / LØNN / TILLEGG)
 *  3. Card 2 (amber-tinted) — "Venter på oppgjør" + body (leder godkjenner)
 *  4. Card 3 — NESTE VAKT mono time + dept caption
 *
 * Real-data: timeEntry (punch_out + elapsed), shift (work_hours), useShiftPhase
 * (nextShift), useDutyLeader (leader-name for "X godkjenner").
 *
 * Note: per CLAUDE.md memory L-lønnsgrunnlag the "LØNN" label is an estimated
 * lønnsgrunnlag (basis), not a payslip. Label kept to match handoff design;
 * rename to "GRUNNLAG" if Phase 4 spec lands.
 */

import React, { useCallback, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Check, Clock } from "lucide-react-native";
import { createStyles, useTheme, withOpacity } from "@/theme";
import { useMyProfile } from "@/hooks/queries/use-my-profile";
import { useShiftPhase } from "@/hooks/stores/use-shift-phase";
import { useDutyLeader } from "@/hooks/queries/use-duty-leader";
import type { Database } from "@smartout/supabase/database.types";
import type { TimeEntry } from "@/types/time-entry";

type ScheduleShift = Database["public"]["Tables"]["schedule_shift"]["Row"];

type AfterShiftViewProps = {
  shift: ScheduleShift | null;
  timeEntry: TimeEntry;
  /**
   * Optional workflow callbacks — when provided, appends a handoff textarea
   * + confirm/dispute action bar below the passive cards. Used by
   * ShiftClockView's after_shift phase. Home (`(home)/index.tsx`) omits
   * these so the surface stays passive ("Venter på oppgjør" only).
   */
  onSubmitHandoff?: (text: string) => void;
  submittingHandoff?: boolean;
  onConfirmHours?: () => void;
  confirmingHours?: boolean;
  onDisputeHours?: () => void;
};

const HOURLY_RATE_FALLBACK = 220;
const DAY_LONG = ["søndag", "mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag"];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function clockHM(time: string): string {
  return time.slice(0, 5);
}

function clockFromIso(iso: string): string {
  const d = new Date(iso);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function formatNok(kr: number): string {
  return new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 }).format(kr);
}

function hoursBetween(start: string, end: string): number {
  return Math.max(0, (new Date(end).getTime() - new Date(start).getTime()) / 3_600_000);
}

function freeHoursUntil(next: ScheduleShift, fromPunchOut: string | null | undefined): string {
  if (!fromPunchOut) return "";
  const clean = next.start_time.replace(/[Z+-].*$/, "");
  const startMs = new Date(`${next.shift_date}T${clean}`).getTime();
  const diff = startMs - new Date(fromPunchOut).getTime();
  if (diff <= 0) return "";
  const h = Math.floor(diff / 3_600_000);
  return `${h}t fri`;
}

function dayLabelOf(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return DAY_LONG[d.getDay()] ?? "";
}

export function AfterShiftView({
  shift,
  timeEntry,
  onSubmitHandoff,
  submittingHandoff = false,
  onConfirmHours,
  confirmingHours = false,
  onDisputeHours,
}: AfterShiftViewProps) {
  const styles = useStyles();
  const theme = useTheme();
  const { data: profile } = useMyProfile();
  const { nextShift } = useShiftPhase();
  const { data: leader } = useDutyLeader(
    shift?.department_id ?? null,
    profile?.workspace_id ?? null,
  );

  const firstName = profile?.display_name?.split(" ")[0] ?? "";
  const showWorkflow = !!(onSubmitHandoff || onConfirmHours || onDisputeHours);
  const [handoffText, setHandoffText] = useState("");
  const [handoffSent, setHandoffSent] = useState(false);

  const handleSubmitHandoff = useCallback(() => {
    const trimmed = handoffText.trim();
    if (!trimmed) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSubmitHandoff?.(trimmed);
    setHandoffSent(true);
  }, [handoffText, onSubmitHandoff]);

  const punchOutClock = timeEntry.punch_out ? clockFromIso(timeEntry.punch_out) : "—";

  const workedH = useMemo(() => {
    if (!timeEntry.punch_out) return 0;
    return hoursBetween(timeEntry.punch_in, timeEntry.punch_out);
  }, [timeEntry.punch_in, timeEntry.punch_out]);

  const estimatedNok = useMemo(() => formatNok(workedH * HOURLY_RATE_FALLBACK), [workedH]);

  const leaderName = leader?.name?.split(" ")[0] ?? "leder";
  const oppgjorBody = `${leaderName} godkjenner dagen før timene låses. Du får varsel når oppgjøret er ferdig.`;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Phase header */}
      <Animated.View entering={FadeIn.delay(50).duration(500)} style={styles.header}>
        <View style={styles.phasePill}>
          <View style={[styles.phaseDot, { backgroundColor: theme.colors.warning }]} />
          <Text style={[styles.phaseLabel, { color: theme.colors.warning }]}>
            VENTER PÅ OPPGJØR
          </Text>
        </View>
        <Text style={styles.greeting}>God dag{firstName ? `, ${firstName}` : ""}</Text>
        {shift ? (
          <Text style={styles.greetingCaption}>
            Din vakt{" "}
            <Text style={styles.greetingTime}>
              {clockHM(shift.start_time)}–{clockHM(shift.end_time)}
            </Text>
            {shift.zone ? ` · ${shift.zone}` : ""}
          </Text>
        ) : null}
      </Animated.View>

      {/* Card 1 — Vakten er ferdig */}
      <Animated.View entering={FadeInDown.delay(150).duration(400).springify()} style={styles.card}>
        <View style={styles.doneLabelRow}>
          <Check size={12} color={theme.colors.success} strokeWidth={3} />
          <Text style={[styles.doneLabel, { color: theme.colors.success }]}>VAKTEN ER FERDIG</Text>
        </View>
        <Text style={styles.bigStatement}>God jobb i dag.</Text>
        <Text style={styles.doneCaption}>Du klokket ut {punchOutClock}.</Text>

        <View style={styles.statsInset}>
          <SummaryStat label="TIMER" value={`${workedH.toFixed(1).replace(".", ",")}t`} />
          <View style={styles.statDivider} />
          <SummaryStat label="LØNN" value={estimatedNok} />
          <View style={styles.statDivider} />
          <SummaryStat label="TILLEGG" value="—" />
        </View>
      </Animated.View>

      {/* Card 2 — Venter på oppgjør (amber-tint) */}
      <Animated.View
        entering={FadeInDown.delay(250).duration(400).springify()}
        style={[
          styles.card,
          {
            backgroundColor: withOpacity(theme.colors.warning, 0.06),
            borderColor: withOpacity(theme.colors.warning, 0.18),
          },
        ]}
      >
        <View style={styles.oppgjorTitleRow}>
          <Clock size={16} color={theme.colors.warning} strokeWidth={1.6} />
          <Text style={styles.oppgjorTitle}>Venter på oppgjør</Text>
        </View>
        <Text style={styles.oppgjorBody}>{oppgjorBody}</Text>
      </Animated.View>

      {/* Card 3 — Neste vakt */}
      {nextShift ? (
        <Animated.View
          entering={FadeInDown.delay(350).duration(400).springify()}
          style={styles.card}
        >
          <Text style={styles.cardEyebrow}>NESTE VAKT</Text>
          <Text style={styles.nextShiftTime}>
            {dayLabelOf(nextShift.shift_date)} {clockHM(nextShift.start_time)}–
            {clockHM(nextShift.end_time)}
          </Text>
          <Text style={styles.nextShiftMeta}>
            {nextShift.zone ?? "Arbeidsplass"}
            {nextShift.role ? ` · ${nextShift.role}` : ""}
            {(() => {
              const free = freeHoursUntil(nextShift, timeEntry.punch_out);
              return free ? ` · ${free}` : "";
            })()}
          </Text>
        </Animated.View>
      ) : null}

      {/* Workflow strip — only when caller passes workflow callbacks
          (ShiftClockView after-punch flow). Home stays passive. */}
      {showWorkflow ? (
        <Animated.View
          entering={FadeInDown.delay(450).duration(400).springify()}
          style={styles.card}
        >
          <Text style={styles.cardEyebrow}>OVERLEVERING</Text>
          {handoffSent ? (
            <Text style={[styles.oppgjorBody, { color: theme.colors.success }]}>
              Notat sendt til neste skift.
            </Text>
          ) : (
            <TextInput
              style={styles.handoffInput}
              placeholder="Skriv notater til neste skift..."
              placeholderTextColor={withOpacity(theme.colors.mutedForeground, 0.4)}
              value={handoffText}
              onChangeText={setHandoffText}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          )}
          {onSubmitHandoff && !handoffSent ? (
            <Pressable
              onPress={handleSubmitHandoff}
              disabled={submittingHandoff || !handoffText.trim()}
              style={({ pressed }) => [
                styles.workflowGhostBtn,
                pressed && { opacity: 0.7 },
                (!handoffText.trim() || submittingHandoff) && { opacity: 0.4 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Send overlevering"
            >
              <Text style={styles.workflowGhostText}>
                {submittingHandoff ? "Sender..." : "Send notat"}
              </Text>
            </Pressable>
          ) : null}

          {onConfirmHours || onDisputeHours ? (
            <View style={styles.workflowActions}>
              {onDisputeHours ? (
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync();
                    onDisputeHours();
                  }}
                  style={({ pressed }) => [styles.workflowGhostBtn, pressed && { opacity: 0.7 }]}
                  accessibilityRole="button"
                  accessibilityLabel="Bestrid timer"
                >
                  <Text style={styles.workflowGhostText}>Bestrid timer</Text>
                </Pressable>
              ) : null}
              {onConfirmHours ? (
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    onConfirmHours();
                  }}
                  disabled={confirmingHours}
                  style={({ pressed }) => [
                    styles.workflowPrimaryBtn,
                    { backgroundColor: theme.colors.brandOrange },
                    pressed && { opacity: 0.85 },
                    confirmingHours && { opacity: 0.5 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Bekreft timer"
                >
                  <Text style={styles.workflowPrimaryText}>
                    {confirmingHours ? "Bekrefter..." : "Bekreft timer"}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </Animated.View>
      ) : null}
    </ScrollView>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  const styles = useStyles();
  return (
    <View style={styles.summaryStat}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  container: { flex: 1 },
  content: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.tight,
    paddingBottom: theme.spacing.xl + 40,
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

  // Card primitive
  card: {
    backgroundColor: theme.colors.background,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.border, 0.4),
    gap: 4,
  },
  cardEyebrow: {
    fontFamily: "GeistMono-Regular",
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 2,
    color: theme.colors.mutedForeground,
    marginBottom: 6,
  },

  // Card 1 (done)
  doneLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  doneLabel: {
    fontFamily: "GeistMono-Regular",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
  },
  bigStatement: {
    fontFamily: "InstrumentSerif-Regular",
    fontSize: 26,
    letterSpacing: -0.5,
    color: theme.colors.foreground,
    marginTop: 4,
  },
  doneCaption: {
    fontSize: 13,
    color: theme.colors.mutedForeground,
    marginTop: 4,
  },
  statsInset: {
    marginTop: 16,
    padding: 14,
    backgroundColor: theme.colors.secondary,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  statDivider: {
    width: 1,
    alignSelf: "stretch",
    backgroundColor: withOpacity(theme.colors.border, 0.5),
  },
  summaryStat: { flex: 1 },
  summaryLabel: {
    fontFamily: "GeistMono-Regular",
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1.4,
    color: theme.colors.mutedForeground,
  },
  summaryValue: {
    fontFamily: "GeistMono-Regular",
    fontSize: 18,
    fontWeight: "700",
    color: theme.colors.foreground,
    marginTop: 3,
  },

  // Card 2 (oppgjør)
  oppgjorTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  oppgjorTitle: { fontSize: 14, fontWeight: "600", color: theme.colors.foreground },
  oppgjorBody: {
    fontSize: 12,
    color: theme.colors.mutedForeground,
    lineHeight: 18,
    marginTop: 4,
  },

  // Card 3 (neste vakt)
  nextShiftTime: {
    fontFamily: "GeistMono-Regular",
    fontSize: 20,
    fontWeight: "700",
    color: theme.colors.foreground,
  },
  nextShiftMeta: {
    fontSize: 12,
    color: theme.colors.mutedForeground,
    marginTop: 4,
  },

  // Workflow strip (shift-clock only)
  handoffInput: {
    fontSize: 14,
    color: theme.colors.foreground,
    backgroundColor: theme.colors.secondary,
    borderRadius: 10,
    padding: 12,
    minHeight: 100,
    marginTop: 6,
  },
  workflowActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  workflowGhostBtn: {
    flex: 1,
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.border, 0.6),
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  workflowGhostText: { fontSize: 14, fontWeight: "600", color: theme.colors.foreground },
  workflowPrimaryBtn: {
    flex: 2,
    height: 56,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  workflowPrimaryText: { fontSize: 15, fontWeight: "700", letterSpacing: 0.4, color: "#ffffff" },
}));
