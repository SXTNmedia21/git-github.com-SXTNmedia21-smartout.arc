/**
 * Mine vakter — Shift list grouped by week.
 *
 * Layout:
 * 1. TopBar — burger menu | "Mine vakter" (orange serif) | calendar + avatar
 * 2. Summary widget — next shift info + weekly hours
 * 3. Week sections — grouped shift cards with date blocks
 * 4. Empty state at bottom
 *
 * Data: useMyShifts() for shift data.
 */

import React, { useMemo, useState, useCallback } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn } from "react-native-reanimated";
import { Menu, MoreHorizontal, Plus, StickyNote } from "lucide-react-native";
import { createStyles, useTheme, withOpacity } from "@/theme";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { ActionBar } from "@/components/navigation/ActionBar";
import { useMyShifts } from "@/hooks/queries/use-my-shifts";
import { useMyProfile } from "@/hooks/queries/use-my-profile";
import { useSwapRequests } from "@/hooks/queries/use-swap-requests";
import { useRespondToSwap, useCancelSwap } from "@/hooks/mutations/use-swap";
import { SwapInboxCard } from "@/components/shift/SwapInboxCard";
import { CreateDayInfoSheet } from "@/components/schedule/CreateDayInfoSheet";
import type { Database } from "@smartout/supabase/database.types";

type ScheduleShift = Database["public"]["Tables"]["schedule_shift"]["Row"];

/* ── Helpers ── */

const DAY_NAMES_SHORT = ["Søn", "Man", "Tir", "Ons", "Tor", "Fre", "Lør"];

function formatTime(time: string): string {
  return time.slice(0, 5);
}

function getWeekNumber(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
  );
}

function getWeekDateRange(shifts: ScheduleShift[]): string {
  if (shifts.length === 0) return "";
  const first = new Date(shifts[0].shift_date);
  const last = new Date(shifts[shifts.length - 1].shift_date);
  const months = [
    "jan",
    "feb",
    "mar",
    "apr",
    "mai",
    "jun",
    "jul",
    "aug",
    "sep",
    "okt",
    "nov",
    "des",
  ];
  return `${first.getDate()}. ${months[first.getMonth()]} — ${last.getDate()}. ${months[last.getMonth()]}`;
}

function isWeekend(dateStr: string): boolean {
  const day = new Date(dateStr).getDay();
  return day === 0 || day === 6;
}

function calcHours(start: string, end: string, breakMin: number | null): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let minutes = eh * 60 + em - (sh * 60 + sm);
  if (minutes < 0) minutes += 24 * 60;
  return (minutes - (breakMin ?? 0)) / 60;
}

type WeekGroup = {
  weekNumber: number;
  dateRange: string;
  shifts: ScheduleShift[];
  totalHours: number;
};

/* ── Component ── */

export default function MyShiftsScreen() {
  const styles = useStyles();
  const theme = useTheme();
  const router = useRouter();
  const { data: shifts = [] } = useMyShifts();
  const { data: profile } = useMyProfile();
  const { data: swapRequests = [] } = useSwapRequests();
  const { respondToSwap } = useRespondToSwap();
  const { cancelSwap } = useCancelSwap();

  const handleSwapAccept = useCallback(
    async (engineStateId: string) => {
      await respondToSwap({ engine_state_id: engineStateId, accepted: true });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    [respondToSwap],
  );

  const handleSwapReject = useCallback(
    async (engineStateId: string) => {
      await respondToSwap({ engine_state_id: engineStateId, accepted: false });
    },
    [respondToSwap],
  );

  const handleSwapCancel = useCallback(
    async (engineStateId: string) => {
      await cancelSwap({ engine_state_id: engineStateId });
    },
    [cancelSwap],
  );

  const weekGroups = useMemo((): WeekGroup[] => {
    const groups = new Map<number, ScheduleShift[]>();
    for (const shift of shifts) {
      const wn = getWeekNumber(new Date(shift.shift_date));
      if (!groups.has(wn)) groups.set(wn, []);
      groups.get(wn)!.push(shift);
    }
    return Array.from(groups.entries()).map(([weekNumber, weekShifts]) => ({
      weekNumber,
      dateRange: getWeekDateRange(weekShifts),
      shifts: weekShifts,
      totalHours: weekShifts.reduce(
        (sum, s) => sum + calcHours(s.start_time, s.end_time, s.breaks),
        0,
      ),
    }));
  }, [shifts]);

  const [dayInfoSheetVisible, setDayInfoSheetVisible] = useState(false);
  const [dayInfoDate, setDayInfoDate] = useState(() => new Date().toISOString().split("T")[0]);

  const handleAddDayInfo = useCallback((date: string) => {
    Haptics.selectionAsync();
    setDayInfoDate(date);
    setDayInfoSheetVisible(true);
  }, []);

  const nextShift = shifts[0] ?? null;
  const thisWeekHours = weekGroups[0]?.totalHours ?? 0;

  const nextShiftLabel = useMemo(() => {
    if (!nextShift) return "Ingen planlagt";
    const d = new Date(nextShift.shift_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
    if (diff === 0) return "I dag";
    if (diff === 1) return "I morgen";
    return `${DAY_NAMES_SHORT[d.getDay()]} ${d.getDate()}.`;
  }, [nextShift]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* TopBar */}
      <Animated.View entering={FadeIn.delay(50).duration(300)} style={styles.topBar}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            router.push("/(app)/(home)/settings");
          }}
          style={styles.headerButton}
        >
          <Menu size={22} color={withOpacity(theme.colors.foreground, 0.45)} strokeWidth={1.6} />
        </Pressable>
        <Text style={styles.brandTitle}>Mine vakter</Text>
        <NotificationBell profileId={profile?.profile_id} />
      </Animated.View>

      <ActionBar />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Summary Widget */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryGlow} />
          <View style={styles.summaryLeft}>
            <Text style={styles.summaryOverline}>Neste vakt</Text>
            <Text style={styles.summaryTitle}>{nextShiftLabel}</Text>
            {nextShift && (
              <Text style={styles.summaryMeta}>
                {formatTime(nextShift.start_time)} – {formatTime(nextShift.end_time)} •{" "}
                {nextShift.zone ?? ""}
              </Text>
            )}
          </View>
          <View style={styles.summaryRight}>
            <Text style={styles.summaryHours}>{thisWeekHours.toFixed(1)}t</Text>
            <Text style={styles.summaryHoursLabel}>Denne uken</Text>
          </View>
        </View>

        {/* Swap Inbox */}
        {swapRequests.length > 0 && (
          <View style={styles.swapInbox}>
            <Text style={styles.swapInboxTitle}>Bytteforespørsler</Text>
            {swapRequests.map((swap) => {
              const ctx = swap.context;
              const isTarget = ctx.target_profile_id === profile?.profile_id;
              const isRequester = ctx.requester_profile_id === profile?.profile_id;
              return (
                <SwapInboxCard
                  key={swap.id}
                  swap={swap}
                  isTarget={isTarget}
                  isRequester={isRequester}
                  requesterName={ctx.requester_profile_id.slice(0, 8)}
                  targetName={ctx.target_profile_id.slice(0, 8)}
                  onAccept={handleSwapAccept}
                  onReject={handleSwapReject}
                  onCancel={handleSwapCancel}
                />
              );
            })}
          </View>
        )}

        {/* Week Sections */}
        {weekGroups.map((group, gi) => (
          <View
            key={group.weekNumber}
            style={[styles.weekSection, gi > 0 && styles.weekSectionFaded]}
          >
            <View style={styles.weekHeader}>
              <Text style={styles.weekTitle}>Uke {group.weekNumber}</Text>
              <View style={styles.weekHeaderRight}>
                <Pressable
                  onPress={() => handleAddDayInfo(group.shifts[0].shift_date)}
                  hitSlop={8}
                  style={styles.addNoteBtn}
                >
                  <StickyNote size={14} color={theme.colors.mutedForeground} strokeWidth={1.5} />
                </Pressable>
                <Text style={styles.weekRange}>{group.dateRange}</Text>
              </View>
            </View>

            {group.shifts.map((shift) => {
              const d = new Date(shift.shift_date);
              const dayName = DAY_NAMES_SHORT[d.getDay()];
              const dayNum = d.getDate();
              const weekend = isWeekend(shift.shift_date);
              const hours = calcHours(shift.start_time, shift.end_time, shift.breaks);

              return (
                <Pressable
                  key={shift.schedule_shift_id}
                  onPress={() => {
                    Haptics.selectionAsync();
                    router.push({
                      pathname: "/(app)/(shifts)/[id]",
                      params: { id: shift.schedule_shift_id },
                    });
                  }}
                  style={({ pressed }) => [
                    styles.shiftCard,
                    weekend && styles.shiftCardWeekend,
                    pressed && styles.shiftCardPressed,
                  ]}
                >
                  {/* Date block */}
                  <View style={[styles.dateBlock, weekend && styles.dateBlockWeekend]}>
                    <Text style={[styles.dateDay, weekend && styles.dateDayWeekend]}>
                      {dayName}
                    </Text>
                    <Text style={[styles.dateNum, weekend && styles.dateNumWeekend]}>{dayNum}</Text>
                  </View>

                  {/* Info */}
                  <View style={styles.shiftInfo}>
                    <Text style={styles.shiftRole}>{shift.role ?? "Vakt"}</Text>
                    <Text style={styles.shiftZone}>{shift.zone ?? ""}</Text>
                  </View>

                  {/* Time */}
                  <View style={styles.shiftTimeBlock}>
                    <Text style={styles.shiftTime}>
                      {formatTime(shift.start_time)} — {formatTime(shift.end_time)}
                    </Text>
                    <Text style={styles.shiftHours}>{hours.toFixed(1)} timer</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}

        {/* Empty state */}
        <View style={styles.emptyFooter}>
          <MoreHorizontal
            size={28}
            color={withOpacity(theme.colors.mutedForeground, 0.3)}
            strokeWidth={1.5}
          />
          <Text style={styles.emptyText}>Ingen flere vakter planlagt</Text>
        </View>
      </ScrollView>

      {/* Day info bottom sheet */}
      <CreateDayInfoSheet
        date={dayInfoDate}
        visible={dayInfoSheetVisible}
        onDismiss={() => setDayInfoSheetVisible(false)}
      />

      {/* Floating Action Button — create new shift */}
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push("/(app)/(shifts)/create");
        }}
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
      >
        <Plus size={24} color="#ffffff" strokeWidth={2} />
      </Pressable>
    </SafeAreaView>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  /* TopBar */
  topBar: {
    height: 50,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingHorizontal: 16,
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderRadius: 22,
  },
  brandTitle: {
    fontSize: 22,
    fontStyle: "italic" as const,
    fontWeight: "300" as const,
    color: theme.colors.foreground,
    letterSpacing: -0.5,
  },

  scrollContent: {
    paddingHorizontal: theme.spacing.section,
    paddingBottom: 160,
  },

  /* Summary Widget */
  summaryCard: {
    position: "relative" as const,
    overflow: "hidden" as const,
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "flex-end" as const,
    backgroundColor: theme.isDark ? theme.colors.card : theme.colors.secondary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.page,
    marginBottom: theme.spacing.page,
  },
  summaryGlow: {
    position: "absolute" as const,
    right: -20,
    bottom: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: withOpacity(theme.colors.brandOrange, 0.05),
  },
  summaryLeft: {
    flex: 1,
    gap: 4,
  },
  summaryOverline: {
    fontSize: 10,
    fontWeight: "500" as const,
    letterSpacing: 2,
    textTransform: "uppercase" as const,
    color: withOpacity(theme.colors.mutedForeground, 0.6),
  },
  summaryTitle: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "300" as const,
    fontStyle: "italic" as const,
    color: theme.colors.brandOrange,
  },
  summaryMeta: {
    ...theme.typography.subheadline,
    color: theme.colors.mutedForeground,
    marginTop: 2,
  },
  summaryRight: {
    alignItems: "flex-end" as const,
  },
  summaryHours: {
    fontSize: 24,
    fontWeight: "300" as const,
    color: theme.colors.foreground,
    letterSpacing: -0.5,
  },
  summaryHoursLabel: {
    fontSize: 10,
    fontWeight: "500" as const,
    letterSpacing: 2,
    textTransform: "uppercase" as const,
    color: withOpacity(theme.colors.mutedForeground, 0.6),
  },

  /* Swap Inbox */
  swapInbox: {
    gap: 8,
    marginBottom: theme.spacing.page,
  },
  swapInboxTitle: {
    fontSize: 12,
    fontWeight: "600" as const,
    letterSpacing: 1.5,
    textTransform: "uppercase" as const,
    color: withOpacity(theme.colors.brandOrange, 0.7),
    marginBottom: 4,
  },

  /* Week Section */
  weekSection: {
    marginBottom: theme.spacing.section,
    gap: theme.spacing.element,
  },
  weekSectionFaded: {
    opacity: 0.8,
  },
  weekHeader: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "baseline" as const,
  },
  weekTitle: {
    fontSize: 20,
    fontWeight: "300" as const,
    fontStyle: "italic" as const,
    color: theme.colors.foreground,
  },
  weekHeaderRight: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
  },
  addNoteBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.06)" : theme.colors.muted,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  weekRange: {
    fontSize: 10,
    fontWeight: "500" as const,
    letterSpacing: 1.5,
    textTransform: "uppercase" as const,
    color: withOpacity(theme.colors.mutedForeground, 0.5),
  },

  /* Shift Card */
  shiftCard: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    backgroundColor: theme.isDark ? theme.colors.card : "#ffffff",
    borderRadius: theme.radius.md,
    padding: theme.spacing.card,
    borderWidth: 1,
    borderColor: theme.isDark ? "rgba(255,255,255,0.04)" : withOpacity(theme.colors.border, 0.15),
    gap: theme.spacing.md,
  },
  shiftCardWeekend: {
    borderLeftWidth: 2,
    borderLeftColor: withOpacity(theme.colors.brandOrange, 0.2),
  },
  shiftCardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },

  /* Date Block */
  dateBlock: {
    width: 48,
    height: 56,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.06)" : theme.colors.muted,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  dateBlockWeekend: {
    backgroundColor: withOpacity(theme.colors.brandOrange, 0.08),
  },
  dateDay: {
    fontSize: 10,
    fontWeight: "500" as const,
    letterSpacing: 0.5,
    textTransform: "uppercase" as const,
    color: withOpacity(theme.colors.mutedForeground, 0.6),
  },
  dateDayWeekend: {
    color: withOpacity(theme.colors.brandOrange, 0.7),
  },
  dateNum: {
    fontSize: 20,
    fontWeight: "300" as const,
    fontStyle: "italic" as const,
    color: theme.colors.foreground,
  },
  dateNumWeekend: {
    color: theme.colors.brandOrange,
  },

  /* Shift Info */
  shiftInfo: {
    flex: 1,
    gap: 2,
  },
  shiftRole: {
    ...theme.typography.body,
    fontWeight: "600" as const,
    color: theme.colors.foreground,
  },
  shiftZone: {
    ...theme.typography.subheadline,
    color: theme.colors.mutedForeground,
  },

  /* Shift Time */
  shiftTimeBlock: {
    alignItems: "flex-end" as const,
    gap: 2,
  },
  shiftTime: {
    fontSize: 14,
    fontWeight: "500" as const,
    color: theme.colors.brandOrange,
    letterSpacing: -0.3,
  },
  shiftHours: {
    fontSize: 10,
    fontWeight: "500" as const,
    color: withOpacity(theme.colors.mutedForeground, 0.6),
  },

  /* Empty Footer */
  emptyFooter: {
    alignItems: "center" as const,
    gap: theme.spacing.element,
    paddingVertical: theme.spacing.page * 2,
  },
  emptyText: {
    fontSize: 10,
    fontWeight: "500" as const,
    letterSpacing: 2,
    textTransform: "uppercase" as const,
    color: withOpacity(theme.colors.mutedForeground, 0.4),
  },

  /* Floating Action Button */
  fab: {
    position: "absolute" as const,
    bottom: 100,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.brandOrange,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    ...theme.shadows.lg,
  },
  fabPressed: {
    transform: [{ scale: 0.92 }],
    opacity: 0.9,
  },
}));
