/**
 * BeforeShiftView — "God morgen" home screen when an upcoming shift is near.
 *
 * Mockup sections:
 * 1. Header — "God morgen, {name}" + date
 * 2. Din Vakt — featured card with time, location, leader note
 * 3. Dagens Info — 2-col grid (bookings + expected volume)
 * 4. Teamet i dag — horizontal avatar scroll of colleagues
 * 5. Åpne vakter — ghost cards for available extra shifts
 */

import React, { useMemo } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  BookOpen,
  BarChart3,
  ChevronRight,
  Utensils,
  UserRound,
  Zap,
} from "lucide-react-native";
import { createStyles, useTheme, withOpacity } from "@/theme";
import { Avatar } from "@/components/common/Avatar";
import { supabase } from "@/lib/supabase";
import type { Colleague } from "@/hooks/queries/use-shift-colleagues";
import type { DayInfo } from "@/hooks/queries/use-day-info";
import type { Database } from "@smartout/supabase/database.types";
import type { MyTaskRow } from "@/hooks/queries/use-my-tasks";

type ScheduleShift = Database["public"]["Tables"]["schedule_shift"]["Row"];
/** @deprecated Use MyTaskRow from use-my-tasks for new code */
type SessionTask = MyTaskRow;

type BeforeShiftViewProps = {
  shift: ScheduleShift;
  colleagues?: Colleague[];
  dayInfo?: DayInfo | null;
  tasks?: SessionTask[];
  onConfirm?: (shiftId: string) => void;
  confirming?: boolean;
  onPunchIn?: () => void;
};

const DAY_NAMES = ["søndag", "mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag"];
const MONTH_NAMES = [
  "januar",
  "februar",
  "mars",
  "april",
  "mai",
  "juni",
  "juli",
  "august",
  "september",
  "oktober",
  "november",
  "desember",
];

function formatShiftTime(time: string): string {
  return time.slice(0, 5);
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const day = DAY_NAMES[d.getDay()] ?? "";
  const date = d.getDate();
  const month = MONTH_NAMES[d.getMonth()] ?? "";
  return `${day.charAt(0).toUpperCase() + day.slice(1)} ${date}. ${month}`;
}

function hoursUntilShift(shift: ScheduleShift): string {
  const cleanTime = shift.start_time.replace(/[Z+-].*$/, "");
  const shiftStart = new Date(`${shift.shift_date}T${cleanTime}`);
  const diffMs = shiftStart.getTime() - Date.now();
  if (diffMs <= 0) return "Nå";
  const hours = Math.floor(diffMs / 3600000);
  const mins = Math.floor((diffMs % 3600000) / 60000);
  if (hours > 0) return `Live om ${hours}t`;
  return `Live om ${mins}m`;
}

/**
 * Fetches the handoff note from the LAST CLOSED department_session for this
 * shift's department, where `closed_at < shift.start_at`. This implements
 * split-shift semantics per Campaign Invariant #11: the handover belongs to
 * the most recent closed session BEFORE this shift starts, not the session
 * that shares the same calendar date (which breaks when A and B shifts span
 * midnight or when multiple sessions run on the same date).
 *
 * Note (ADR-0188): `handoff_notes` is the legacy TEXT column. Phase 2 will
 * migrate reads to `session_note(note_type='handoff')`; for now we keep
 * reading the column but fix the row-selection to be time-correct.
 */
function useLeaderNote(shift: ScheduleShift) {
  // schedule_shift does not store a timestamptz; reconstruct the shift start
  // as an ISO string from `shift_date` + `start_time` (strip any stray offset
  // suffix that may leak through Postgres `time` serialisation).
  const shiftStartIso = useMemo(() => {
    const cleanTime = shift.start_time.replace(/[Z+-].*$/, "");
    return new Date(`${shift.shift_date}T${cleanTime}`).toISOString();
  }, [shift.shift_date, shift.start_time]);

  return useQuery({
    queryKey: ["leader-note", shift.workspace_id, shift.department_id, shiftStartIso],
    queryFn: async () => {
      if (!shift.department_id) return null;

      const { data, error } = await supabase
        .from("department_session")
        .select("department_session_id, handoff_notes, closed_at")
        .eq("workspace_id", shift.workspace_id)
        .eq("department_id", shift.department_id)
        .eq("status", "closed")
        .lt("closed_at", shiftStartIso)
        .order("closed_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data?.handoff_notes ?? null;
    },
    enabled: !!shift.department_id,
    staleTime: 5 * 60 * 1000,
  });
}

export function BeforeShiftView({ shift, colleagues = [], dayInfo }: BeforeShiftViewProps) {
  const styles = useStyles();
  const theme = useTheme();
  const router = useRouter();
  const { data: leaderNote } = useLeaderNote(shift);

  const dateLabel = useMemo(() => formatDateLabel(shift.shift_date), [shift.shift_date]);
  const countdown = useMemo(() => hoursUntilShift(shift), [shift]);

  return (
    <View style={styles.content}>
      {/* Header */}
      <Animated.View entering={FadeIn.delay(50).duration(500)} style={styles.header}>
        <Text style={styles.greeting}>God morgen</Text>
        <View style={styles.dateRow}>
          <CalendarDays
            size={12}
            color={withOpacity(theme.colors.mutedForeground, 0.5)}
            strokeWidth={1.5}
          />
          <Text style={styles.dateText}>{dateLabel.toUpperCase()}</Text>
        </View>
      </Animated.View>

      {/* Din Vakt — featured card */}
      <Animated.View entering={FadeInDown.delay(150).duration(400).springify()}>
        <View style={styles.shiftLabelRow}>
          <Text style={styles.sectionTitle}>Din Vakt</Text>
          <Text style={styles.countdown}>{countdown.toUpperCase()}</Text>
        </View>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push(`/(app)/(shifts)/${shift.schedule_shift_id}`);
          }}
          style={({ pressed }) => [styles.shiftCard, pressed && styles.shiftCardPressed]}
        >
          {/* Background icon */}
          <View style={styles.shiftCardBgIcon}>
            <Utensils
              size={64}
              color={withOpacity(theme.colors.primaryForeground, 0.15)}
              strokeWidth={1}
            />
          </View>

          <View style={styles.shiftCardContent}>
            <Text style={styles.shiftLocation}>
              {shift.zone ?? "Arbeidsplass"}, {shift.role}
            </Text>
            <Text style={styles.shiftTime}>
              {formatShiftTime(shift.start_time)} — {formatShiftTime(shift.end_time)}
            </Text>

            {/* Leader note — from department_session.handoff_notes */}
            {leaderNote ? (
              <View style={styles.leaderNote}>
                <UserRound
                  size={16}
                  color={withOpacity(theme.colors.primaryForeground, 0.8)}
                  strokeWidth={1.5}
                />
                <View>
                  <Text style={styles.leaderNoteLabel}>LEADER NOTE</Text>
                  <Text style={styles.leaderNoteText}>{leaderNote}</Text>
                </View>
              </View>
            ) : null}
          </View>
        </Pressable>
      </Animated.View>

      {/* Dagens Info — 2-col grid */}
      <Animated.View
        entering={FadeInDown.delay(300).duration(400).springify()}
        style={styles.infoGrid}
      >
        <View style={styles.infoCard}>
          <BookOpen size={20} color={theme.colors.brandOrange} strokeWidth={1.5} />
          <View style={styles.infoBottom}>
            <Text style={styles.infoNumber}>{dayInfo?.bookings?.length ?? 0}</Text>
            <Text style={styles.infoLabel}>Bookinger</Text>
          </View>
        </View>
        <View style={styles.infoCard}>
          <BarChart3 size={20} color={theme.colors.mutedForeground} strokeWidth={1.5} />
          <View style={styles.infoBottom}>
            <Text style={styles.infoDesc}>Normalt trykk forventet</Text>
            <Text style={styles.infoMeta}>BASERT PÅ HISTORIKK</Text>
          </View>
        </View>
      </Animated.View>

      {/* Teamet i dag */}
      {colleagues.length > 0 && (
        <Animated.View
          entering={FadeInDown.delay(450).duration(400).springify()}
          style={styles.teamSection}
        >
          <Text style={styles.sectionTitle}>Teamet i dag</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.teamScroll}
          >
            {colleagues.map((c) => (
              <View key={c.profileId} style={styles.teamMember}>
                <View style={styles.teamAvatarRing}>
                  <Avatar name={`${c.firstName} ${c.lastName}`} imageUrl={c.avatarUrl} size="lg" />
                </View>
                <Text style={styles.teamName}>{c.firstName}</Text>
              </View>
            ))}
          </ScrollView>
        </Animated.View>
      )}

      {/* Åpne vakter */}
      <Animated.View
        entering={FadeInDown.delay(600).duration(400).springify()}
        style={styles.openSection}
      >
        <Text style={styles.sectionTitle}>Åpne vakter</Text>
        <View style={styles.openList}>
          <Pressable style={({ pressed }) => [styles.openCard, pressed && { opacity: 0.7 }]}>
            <View
              style={[
                styles.openIcon,
                { backgroundColor: withOpacity(theme.colors.brandOrange, 0.1) },
              ]}
            >
              <Zap size={18} color={theme.colors.brandOrange} strokeWidth={1.5} />
            </View>
            <View style={styles.openInfo}>
              <Text style={styles.openTitle}>Extra Runner</Text>
              <Text style={styles.openMeta}>START 17:00</Text>
            </View>
            <ChevronRight
              size={18}
              color={withOpacity(theme.colors.mutedForeground, 0.3)}
              strokeWidth={1.5}
            />
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  content: { gap: theme.spacing.page },

  /* Header */
  header: { gap: 4 },
  greeting: { fontSize: 40, fontWeight: "300", letterSpacing: -1, color: theme.colors.foreground },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  dateText: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 2,
    color: withOpacity(theme.colors.mutedForeground, 0.6),
  },

  /* Section title */
  sectionTitle: {
    fontSize: 22,
    fontWeight: "300",
    letterSpacing: -0.5,
    color: theme.colors.foreground,
    paddingHorizontal: 4,
  },

  /* Shift card */
  shiftLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: theme.spacing.element,
    paddingHorizontal: 4,
  },
  countdown: { fontSize: 11, fontWeight: "700", letterSpacing: 1, color: theme.colors.brandOrange },

  shiftCard: {
    backgroundColor: theme.colors.brandOrange,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.page + 4,
    overflow: "hidden",
    position: "relative",
    ...theme.shadows.lg,
  },
  shiftCardPressed: { transform: [{ scale: 0.98 }], opacity: 0.95 },
  shiftCardBgIcon: { position: "absolute", top: 16, right: 16, opacity: 0.2 },
  shiftCardContent: { gap: theme.spacing.md },
  shiftLocation: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 2,
    textTransform: "uppercase",
    color: withOpacity(theme.colors.primaryForeground, 0.75),
  },
  shiftTime: {
    fontSize: 36,
    fontWeight: "300",
    letterSpacing: -1,
    color: theme.colors.primaryForeground,
  },

  leaderNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: withOpacity(theme.colors.primaryForeground, 0.1),
    borderRadius: theme.radius.lg,
    padding: theme.spacing.card,
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.primaryForeground, 0.1),
  },
  leaderNoteLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1,
    color: withOpacity(theme.colors.primaryForeground, 0.6),
  },
  leaderNoteText: {
    fontSize: 16,
    fontWeight: "300",
    fontStyle: "italic",
    color: theme.colors.primaryForeground,
    marginTop: 2,
  },

  /* Info grid */
  infoGrid: { flexDirection: "row", gap: theme.spacing.md },
  infoCard: {
    flex: 1,
    aspectRatio: 1,
    backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.5) : theme.colors.secondary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.section,
    justifyContent: "space-between",
  },
  infoBottom: { gap: 2 },
  infoNumber: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -1,
    color: theme.colors.foreground,
  },
  infoLabel: { fontSize: 13, fontWeight: "500", color: theme.colors.mutedForeground },
  infoDesc: { fontSize: 13, fontWeight: "500", color: theme.colors.foreground, lineHeight: 18 },
  infoMeta: {
    fontSize: 9,
    fontWeight: "500",
    letterSpacing: 1,
    color: withOpacity(theme.colors.mutedForeground, 0.6),
    marginTop: 4,
  },

  /* Team */
  teamSection: { gap: theme.spacing.md },
  teamScroll: { gap: 16, paddingHorizontal: 4 },
  teamMember: { alignItems: "center", gap: 6 },
  teamAvatarRing: {
    width: 58,
    height: 58,
    borderRadius: 29,
    padding: 2,
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.border, 0.2),
    alignItems: "center",
    justifyContent: "center",
  },
  teamName: { fontSize: 11, fontWeight: "500", color: theme.colors.mutedForeground },

  /* Open shifts */
  openSection: { gap: theme.spacing.md },
  openList: { gap: theme.spacing.element },
  openCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    padding: theme.spacing.card,
    backgroundColor: theme.isDark
      ? withOpacity(theme.colors.card, 0.3)
      : withOpacity(theme.colors.muted, 0.3),
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.border, 0.1),
  },
  openIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  openInfo: { flex: 1, gap: 2 },
  openTitle: { fontSize: 13, fontWeight: "600", color: theme.colors.foreground },
  openMeta: {
    fontSize: 9,
    fontWeight: "500",
    letterSpacing: 1,
    color: withOpacity(theme.colors.mutedForeground, 0.6),
  },
}));
