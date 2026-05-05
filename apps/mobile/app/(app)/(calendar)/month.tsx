/**
 * Calendar tab — MonthView.
 *
 * Handoff §4.2: 6×7 grid with leading/trailing blanks, mini event-blocks,
 * department-color coded, SelectedDaySheet below the grid.
 *
 * Tap on a day cell: navigates to DayView via router.push (handoff §7).
 * View toggle back to Uke: router.replace to index.
 *
 * Telemetry: calendar view_changed / day_selected via getProfileContext() (ADR-0134).
 *
 * Read-only: no mutations (ADR-0133).
 */

import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { emit, nonEmpty } from "@smartout/telemetry";
import { useTheme } from "@/theme";
import { withOpacity } from "@/theme/colors";
import { nativeTheme } from "@smartout/design-tokens/native";
import { useCalendarItems } from "@/hooks/queries/use-calendar-items";
import { useMyProfile } from "@/hooks/queries/use-my-profile";
import { getProfileContext } from "@/lib/profile-context";
import type { CalendarItem } from "@/components/calendar/types";

/** Fallback timezone per Lovsen rapport / workspace table DEFAULT. */
const FALLBACK_TZ = "Europe/Oslo";

const DEPT_COLORS = nativeTheme.department;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Format Date as YYYY-MM-DD in workspace tz (not device tz) — BLOCKING-3 / F-09.
 * tz defaults to Europe/Oslo per workspace table DEFAULT.
 */
function dateToISO(d: Date, tz: string = FALLBACK_TZ): string {
  const z = toZonedTime(d, tz);
  return `${z.getFullYear()}-${String(z.getMonth() + 1).padStart(2, "0")}-${String(z.getDate()).padStart(2, "0")}`;
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatMonthLabel(date: Date): string {
  return date.toLocaleDateString("nb-NO", { month: "long", year: "numeric" });
}

/** Build day names Mo–Su in Norwegian short form. */
const DAY_SHORT = ["MAN", "TIR", "ONS", "TOR", "FRE", "LØR", "SØN"] as const;

/** Norwegian long day names for display in SelectedDaySheet. */
const DAY_LONG = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"] as const;

/**
 * Build calendar grid for a given month. Returns array (padded to 7-column rows).
 * All Date cells represent midnight in the workspace timezone (BLOCKING-3 / F-09).
 */
function buildMonthGrid(year: number, month: number, tz: string): Array<Date | null> {
  // Construct first day of month as midnight in workspace tz, then convert to UTC.
  const firstDayLocal = fromZonedTime(new Date(year, month, 1, 0, 0, 0), tz);
  const firstDayZoned = toZonedTime(firstDayLocal, tz);
  const jsDay = firstDayZoned.getDay();
  const leading = jsDay === 0 ? 6 : jsDay - 1;
  // Days in month: last day of month in workspace tz
  const lastDayLocal = fromZonedTime(new Date(year, month + 1, 0, 0, 0, 0), tz);
  const daysInMonth = toZonedTime(lastDayLocal, tz).getDate();

  const cells: Array<Date | null> = [];
  for (let i = 0; i < leading; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    // Each cell is UTC instant for midnight of day d in workspace tz
    cells.push(fromZonedTime(new Date(year, month, d, 0, 0, 0), tz));
  }
  while (cells.length % 7 !== 0) cells.push(null);

  return cells;
}

/** Get day-of-week index (Mon=0..Sun=6) for a Date. */
function dayIdx(date: Date): number {
  const j = date.getDay();
  return j === 0 ? 6 : j - 1;
}

// ── ViewToggle (duplicated from index.tsx — inline, no modification to 3b) ───

type ViewToggleProps = {
  value: "Uke" | "Måned";
  onSwitch: (v: "Uke" | "Måned") => void;
};

function ViewToggle({ value, onSwitch }: ViewToggleProps) {
  const theme = useTheme();
  const options: ("Uke" | "Måned")[] = ["Uke", "Måned"];

  return (
    <View
      style={[
        styles.toggle,
        { backgroundColor: theme.colors.secondary, borderColor: theme.colors.border },
      ]}
    >
      {options.map((opt) => {
        const isActive = value === opt;
        return (
          <Pressable
            key={opt}
            onPress={() => onSwitch(opt)}
            style={[styles.toggleOption, isActive && { backgroundColor: theme.colors.brandOrange }]}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
          >
            <Text
              style={[
                styles.toggleLabel,
                { color: isActive ? "#ffffff" : theme.colors.mutedForeground },
              ]}
            >
              {opt}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── SelectedDaySheet ──────────────────────────────────────────────────────────

type SelectedDaySheetProps = {
  date: Date;
  items: CalendarItem[];
};

function SelectedDaySheet({ date, items }: SelectedDaySheetProps) {
  const theme = useTheme();
  const dayName = DAY_LONG[dayIdx(date)];
  const shifts = items.filter((i) => i.type === "shift");
  const tasks = items.filter((i) => i.type === "task" || i.type === "deviation");
  const bookings = items.filter((i) => i.type === "booking");

  return (
    <View
      style={[
        styles.selectedSheet,
        { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
      ]}
    >
      <View style={styles.selectedSheetHeader}>
        <View>
          <Text style={[styles.selectedDayName, { color: theme.colors.mutedForeground }]}>
            {dayName.toUpperCase()}
          </Text>
          <Text style={[styles.selectedDayDate, { color: theme.colors.foreground }]}>
            {date.getDate()}. {date.toLocaleDateString("nb-NO", { month: "long" })}
          </Text>
        </View>
        <Text style={[styles.selectedDayCounters, { color: theme.colors.mutedForeground }]}>
          {shifts.length}V · {tasks.length}O · {bookings.length}B
        </Text>
      </View>

      {items.length === 0 ? (
        <Text style={[styles.selectedEmpty, { color: theme.colors.mutedForeground }]}>
          Ingen oppforinger.
        </Text>
      ) : (
        <View style={styles.selectedItemList}>
          {items.slice(0, 3).map((it) => (
            <View key={it.id} style={styles.selectedItemRow}>
              <Text style={[styles.selectedItemTime, { color: theme.colors.mutedForeground }]}>
                {it.time ? it.time.slice(0, 11) : "—"}
              </Text>
              <Text
                style={[styles.selectedItemTitle, { color: theme.colors.mutedForeground }]}
                numberOfLines={1}
              >
                {it.title}
              </Text>
            </View>
          ))}
          {items.length > 3 && (
            <Text style={[styles.selectedMore, { color: theme.colors.brandOrange }]}>
              +{items.length - 3} flere
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

// ── DayCell ───────────────────────────────────────────────────────────────────

type DayCellProps = {
  date: Date;
  today: Date;
  isSelected: boolean;
  items: CalendarItem[];
  onPress: (d: Date) => void;
};

function DayCell({ date, today, isSelected, items, onPress }: DayCellProps) {
  const theme = useTheme();
  const isToday =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();
  const hasOverdue = items.some((i) => i.status === "overdue");
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;

  const shifts = items.filter((i) => i.type === "shift");
  const bookings = items.filter((i) => i.type === "booking");
  const tasks = items.filter((i) => i.type === "task" || i.type === "deviation");

  const cellBg = isSelected ? theme.colors.brandOrange : theme.colors.card;
  const cellBorder = isSelected ? theme.colors.brandOrange : theme.colors.border;
  const textColor = isSelected ? "#ffffff" : theme.colors.foreground;

  return (
    <Pressable
      onPress={() => onPress(date)}
      style={[styles.dayCell, { backgroundColor: cellBg, borderColor: cellBorder }]}
      accessibilityRole="button"
      accessibilityLabel={`${date.getDate()}`}
      accessibilityState={{ selected: isSelected }}
    >
      {/* Date number + indicators */}
      <View style={styles.dayCellHeader}>
        <Text
          style={[
            styles.dayCellDate,
            {
              color: textColor,
              opacity: isWeekend && !isSelected ? 0.6 : 1,
            },
          ]}
        >
          {date.getDate()}
        </Text>
        <View style={styles.dayCellDots}>
          {isToday && !isSelected && (
            <View style={[styles.dayCellDot, { backgroundColor: theme.colors.brandOrange }]} />
          )}
          {hasOverdue && (
            <View
              style={[
                styles.dayCellDot,
                {
                  backgroundColor: isSelected ? "rgba(255,255,255,0.9)" : theme.colors.destructive,
                },
              ]}
            />
          )}
        </View>
      </View>

      {/* Mini event blocks */}
      <View style={styles.miniEvents}>
        {shifts.slice(0, 1).map((s) => {
          const col = DEPT_COLORS[s.dept as keyof typeof DEPT_COLORS] ?? theme.colors.brandOrange;
          return (
            <View
              key={s.id}
              style={[
                styles.miniBlock,
                {
                  backgroundColor: isSelected ? "rgba(255,255,255,0.18)" : withOpacity(col, 0.24),
                },
              ]}
            >
              <Text
                style={[styles.miniBlockText, { color: isSelected ? "#ffffff" : col }]}
                numberOfLines={1}
              >
                {s.time ? s.time.slice(0, 5) : ""} {s.role ?? s.title}
              </Text>
            </View>
          );
        })}

        {bookings.slice(0, 1).map((b) => (
          <View
            key={b.id}
            style={[
              styles.miniBlock,
              {
                backgroundColor: isSelected
                  ? "rgba(255,255,255,0.18)"
                  : withOpacity(theme.colors.brandOrange, 0.22),
              },
            ]}
          >
            <Text
              style={[
                styles.miniBlockText,
                {
                  color: isSelected ? "#ffffff" : theme.colors.brandOrange,
                },
              ]}
              numberOfLines={1}
            >
              {b.guests ? `${b.guests} ` : ""}
              {b.title.split(" ")[0]}
            </Text>
          </View>
        ))}

        {tasks.length > 0 && (
          <Text
            style={[
              styles.miniTaskCount,
              { color: isSelected ? "rgba(255,255,255,0.8)" : theme.colors.mutedForeground },
            ]}
          >
            {tasks.length} oppg.
          </Text>
        )}
      </View>
    </Pressable>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function CalendarMonthScreen() {
  const theme = useTheme();
  const router = useRouter();
  const today = useRef(new Date()).current;

  const [selectedDate, setSelectedDate] = useState<Date>(today);

  // Resolve workspace timezone from profile (BLOCKING-3 / F-09).
  const { data: profile } = useMyProfile();
  const tz = (profile?.workspace as { timezone?: string } | null)?.timezone ?? FALLBACK_TZ;

  // Fetch items for the selected date only (for SelectedDaySheet preview)
  const { data: selectedItems } = useCalendarItems({
    date: selectedDate,
    filter: "alt",
    scope: { kind: "me" },
  });

  // Use today in workspace tz to derive grid year/month correctly.
  const todayZoned = toZonedTime(today, tz);
  const year = todayZoned.getFullYear();
  const month = todayZoned.getMonth();
  const grid = buildMonthGrid(year, month, tz);
  const monthLabel = capitalise(formatMonthLabel(today));

  // ── Telemetry ─────────────────────────────────────────────────────────────

  const emitViewChanged = useCallback(async (to: "week" | "month") => {
    try {
      const ctx = await getProfileContext();
      void emit({
        event: "calendar view_changed",
        workspace_id: nonEmpty(ctx.workspaceId, "workspace_id"),
        actor_id: nonEmpty(ctx.profileId, "actor_id"),
        properties: { data: { from: "month", to } },
      });
    } catch {
      // swallow
    }
  }, []);

  const emitDaySelected = useCallback(
    async (date: Date) => {
      try {
        const ctx = await getProfileContext();
        const iso = dateToISO(date, tz);
        void emit({
          event: "calendar day_selected",
          workspace_id: nonEmpty(ctx.workspaceId, "workspace_id"),
          actor_id: nonEmpty(ctx.profileId, "actor_id"),
          properties: {
            entity_type: "date",
            entity_id: iso,
            data: { date: iso },
          },
        });
      } catch {
        // swallow
      }
    },
    [tz],
  );

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleViewSwitch = useCallback(
    (v: "Uke" | "Måned") => {
      if (v === "Uke") {
        void emitViewChanged("week");
        router.back();
      }
    },
    [emitViewChanged, router],
  );

  const handleDayPress = useCallback(
    (date: Date) => {
      setSelectedDate(date);
      void emitDaySelected(date);
      // Navigate to DayView per handoff §7
      router.push(`/(app)/(calendar)/day/${dateToISO(date, tz)}`);
    },
    [emitDaySelected, router, tz],
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.colors.foreground }]}>Kalender</Text>
      </View>

      {/* Month label + view toggle */}
      <View style={styles.monthRow}>
        <Text style={[styles.monthLabel, { color: theme.colors.foreground }]}>{monthLabel}</Text>
        <ViewToggle value="Måned" onSwitch={handleViewSwitch} />
      </View>

      {/* Day-of-week header */}
      <View style={styles.dowHeader}>
        {DAY_SHORT.map((d) => (
          <Text key={d} style={[styles.dowLabel, { color: theme.colors.mutedForeground }]}>
            {d}
          </Text>
        ))}
      </View>

      {/* Grid + selected day sheet */}
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.grid}>
          {grid.map((cell, i) => {
            if (!cell) return <View key={`blank-${i}`} style={styles.blankCell} />;
            const isSel =
              cell.getFullYear() === selectedDate.getFullYear() &&
              cell.getMonth() === selectedDate.getMonth() &&
              cell.getDate() === selectedDate.getDate();

            return (
              <DayCell
                key={dateToISO(cell)}
                date={cell}
                today={today}
                isSelected={isSel}
                items={[]} // Per-cell item hydration deferred — full-month fetch in Phase 3d
                onPress={handleDayPress}
              />
            );
          })}
        </View>

        {/* Selected day preview */}
        <SelectedDaySheet date={selectedDate} items={selectedItems} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: Platform.OS === "android" ? 16 : 0,
    paddingHorizontal: 18,
    paddingBottom: 4,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: 0.1,
  },
  monthRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 12,
  },
  monthLabel: {
    fontSize: 22,
    fontFamily: "InstrumentSerif-Regular",
    letterSpacing: -0.3,
  },
  toggle: {
    flexDirection: "row",
    borderRadius: 10,
    borderWidth: 1,
    overflow: "hidden",
    padding: 2,
  },
  toggleOption: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  toggleLabel: {
    fontSize: 12.5,
    fontWeight: "600",
  },
  dowHeader: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  dowLabel: {
    flex: 1,
    textAlign: "center",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.3,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingHorizontal: 12,
    paddingBottom: 110,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  dayCell: {
    width: "calc(14.28% - 4px)" as unknown as number,
    // React Native doesn't support calc — use ratio
    flexBasis: `${100 / 7}%`,
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 78,
    borderRadius: 10,
    borderWidth: 1,
    padding: 6,
    overflow: "hidden",
  },
  blankCell: {
    flexBasis: `${100 / 7}%`,
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 78,
  },
  dayCellHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  dayCellDate: {
    fontSize: 18,
    fontFamily: "InstrumentSerif-Regular",
    letterSpacing: -0.3,
  },
  dayCellDots: {
    flexDirection: "row",
    gap: 3,
  },
  dayCellDot: {
    width: 5,
    height: 5,
    borderRadius: 99,
  },
  miniEvents: {
    gap: 2,
  },
  miniBlock: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  miniBlockText: {
    fontSize: 9,
    fontWeight: "600",
  },
  miniTaskCount: {
    fontSize: 9,
    fontFamily: "GeistMono-Regular",
  },
  // SelectedDaySheet
  selectedSheet: {
    marginTop: 14,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  selectedSheetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  selectedDayName: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  selectedDayDate: {
    fontSize: 22,
    fontFamily: "InstrumentSerif-Regular",
    letterSpacing: -0.3,
    marginTop: 2,
  },
  selectedDayCounters: {
    fontSize: 11.5,
    fontFamily: "GeistMono-Regular",
  },
  selectedEmpty: {
    fontSize: 13,
  },
  selectedItemList: {
    gap: 6,
  },
  selectedItemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  selectedItemTime: {
    fontSize: 11,
    fontFamily: "GeistMono-Regular",
    width: 60,
    flexShrink: 0,
  },
  selectedItemTitle: {
    fontSize: 13,
    flex: 1,
  },
  selectedMore: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
  },
});
