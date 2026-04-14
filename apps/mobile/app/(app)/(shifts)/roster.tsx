/**
 * Master Roster — Weekly schedule grid for managers (Driftsleder).
 *
 * Nordic Split layout:
 * 1. Header — "Master Roster" + filter button
 * 2. Week pill filter — Current Week, Oct, Nov
 * 3. Week blocks — sticky week header + 7-column grid
 * 4. Day cells — avatar stacks with shift start times
 * 5. Today column highlighted with accent ring
 * 6. Weekend columns dimmed
 *
 * Wired to useTeamShifts() hook for real schedule_shift data.
 */

import React from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { CalendarRange, SlidersHorizontal } from "lucide-react-native";
import { createStyles, useTheme, withOpacity } from "@/theme";
import { Avatar } from "@/components/common/Avatar";
import { useTeamShifts } from "@/hooks/queries/use-team-shifts";
import type { RosterWeek, RosterDay } from "@/hooks/queries/use-team-shifts";

const DAY_HEADERS = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];

type ShiftSlot = {
  name: string;
  time: string;
};

/** Single avatar + time slot inside a day cell */
function ShiftSlotItem({ slot }: { slot: ShiftSlot }) {
  const styles = useSlotStyles();

  return (
    <View style={styles.slot}>
      <Avatar name={slot.name} size="sm" />
      <Text style={styles.time}>{slot.time}</Text>
    </View>
  );
}

const useSlotStyles = createStyles((theme) => ({
  slot: {
    alignItems: "center",
    gap: 2,
  },
  time: {
    fontSize: 9,
    fontWeight: "500",
    color: theme.colors.foreground,
  },
}));

/** Single day column in the grid */
function DayColumn({ day }: { day: RosterDay }) {
  const styles = useDayStyles();
  const theme = useTheme();

  return (
    <View
      style={[styles.cell, day.isToday && styles.cellToday, day.isWeekend && styles.cellWeekend]}
    >
      {day.isToday && <View style={styles.todayBar} />}
      {day.shifts.length > 0 ? (
        day.shifts.map((slot, i) => <ShiftSlotItem key={i} slot={slot} />)
      ) : day.isWeekend ? (
        <Text style={styles.closedIcon}>—</Text>
      ) : null}
    </View>
  );
}

const useDayStyles = createStyles((theme) => ({
  cell: {
    flex: 1,
    backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.4) : theme.colors.secondary,
    borderRadius: theme.radius.lg,
    padding: 6,
    gap: 8,
    alignItems: "center",
    minHeight: 180,
  },
  cellToday: {
    backgroundColor: withOpacity(theme.colors.brandOrange, 0.06),
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.brandOrange, 0.15),
  },
  cellWeekend: {
    opacity: 0.3,
    backgroundColor: theme.isDark ? withOpacity(theme.colors.muted, 0.3) : theme.colors.muted,
  },
  todayBar: {
    width: "100%",
    height: 2,
    borderRadius: 1,
    backgroundColor: theme.colors.brandOrange,
    marginBottom: 4,
  },
  closedIcon: {
    fontSize: 12,
    color: theme.colors.mutedForeground,
    marginTop: 8,
  },
}));

/** Week section — sticky header + 7-col grid */
function WeekSection({ week, index }: { week: RosterWeek; index: number }) {
  const styles = useWeekStyles();
  const theme = useTheme();
  const hasToday = week.days.some((d) => d.isToday);

  return (
    <Animated.View
      entering={FadeInDown.delay(100 + index * 100)
        .duration(400)
        .springify()}
    >
      {/* Week header */}
      <View style={styles.header}>
        <Text style={[styles.weekTitle, !hasToday && styles.weekTitleFaded]}>
          Uke {week.weekNumber}
        </Text>
        <Text style={styles.weekRange}>{week.dateRange}</Text>
      </View>

      {/* Day headers */}
      <View style={styles.dayHeaders}>
        {DAY_HEADERS.map((label, i) => {
          const isToday = week.days[i]?.isToday;
          const isWeekend = i >= 5;
          return (
            <View key={label} style={styles.dayHeaderCell}>
              <Text
                style={[
                  styles.dayHeaderText,
                  isToday && styles.dayHeaderToday,
                  isWeekend && styles.dayHeaderWeekend,
                ]}
              >
                {label}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Grid */}
      <View style={styles.grid}>
        {week.days.map((day, i) => (
          <DayColumn key={i} day={day} />
        ))}
      </View>
    </Animated.View>
  );
}

const useWeekStyles = createStyles((theme) => ({
  header: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.section,
    paddingVertical: theme.spacing.md,
  },
  weekTitle: {
    fontSize: 28,
    fontStyle: "italic",
    fontWeight: "300",
    color: theme.colors.foreground,
  },
  weekTitleFaded: {
    opacity: 0.5,
  },
  weekRange: {
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 1,
    color: withOpacity(theme.colors.mutedForeground, 0.5),
    textTransform: "uppercase",
  },
  dayHeaders: {
    flexDirection: "row",
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  dayHeaderCell: {
    flex: 1,
    alignItems: "center",
  },
  dayHeaderText: {
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 2,
    color: theme.colors.mutedForeground,
    textTransform: "uppercase",
  },
  dayHeaderToday: {
    color: theme.colors.brandOrange,
    fontWeight: "700",
  },
  dayHeaderWeekend: {
    opacity: 0.4,
  },
  grid: {
    flexDirection: "row",
    gap: 3,
    paddingHorizontal: 4,
  },
}));

export default function RosterScreen() {
  const styles = useStyles();
  const theme = useTheme();
  const { weeks, isLoading } = useTeamShifts();

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <Animated.View entering={FadeIn.delay(50).duration(300)} style={styles.headerBar}>
        <View style={styles.headerLeft}>
          <CalendarRange size={22} color={theme.colors.brandOrange} strokeWidth={1.6} />
          <Text style={styles.headerTitle}>Master Roster</Text>
        </View>
        <Pressable
          onPress={() => Haptics.selectionAsync()}
          style={styles.filterButton}
          accessibilityRole="button"
          accessibilityLabel="Filter"
        >
          <SlidersHorizontal size={20} color={theme.colors.brandOrange} strokeWidth={1.6} />
        </Pressable>
      </Animated.View>

      {/* Week blocks */}
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <View style={styles.centeredState}>
            <ActivityIndicator size="large" color={theme.colors.brandOrange} />
          </View>
        ) : weeks.length === 0 ? (
          <View style={styles.centeredState}>
            <Text style={styles.emptyText}>Ingen vakter å vise</Text>
          </View>
        ) : (
          weeks.map((week, i) => (
            <WeekSection key={week.weekNumber} week={week} index={i} />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  /* Header */
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.section,
    paddingVertical: theme.spacing.md,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.element,
  },
  headerTitle: {
    ...theme.typography.title,
    color: theme.colors.foreground,
    letterSpacing: -0.3,
  },
  filterButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
  },

  /* States */
  centeredState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 120,
  },
  emptyText: {
    ...theme.typography.subheadline,
    color: theme.colors.mutedForeground,
  },

  /* Scroll */
  scrollContent: {
    paddingBottom: theme.spacing.xl + 40,
    gap: theme.spacing.page,
  },
}));
