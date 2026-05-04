/**
 * Calendar tab — DayView timeline.
 *
 * Handoff §4.3: timeline 08:00–24:00, items absolute-positioned by start time,
 * NÅ-indicator (orange line + dot + label) for today, DayStat strip (3 tiles),
 * notes section at the bottom.
 *
 * Route: /(app)/(calendar)/day/[date] — [date] is YYYY-MM-DD.
 * Back arrow navigates to previous screen (week or month) via router.back().
 *
 * Telemetry: calendar view_changed / item_viewed via getProfileContext() (ADR-0134).
 * All times via workspace.timezone (Lovsen F-09/F-11) — date-fns-tz fromZonedTime
 * used for offset calculation.
 *
 * Read-only (ADR-0133). No mutations.
 */

import React, { useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  SafeAreaView,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, Calendar, CheckSquare, Users } from "lucide-react-native";
import { emit, nonEmpty } from "@smartout/telemetry";
import { useTheme } from "@/theme";
import { withOpacity } from "@/theme/colors";
import { nativeTheme } from "@smartout/design-tokens/native";
import { DayStat } from "@/components/calendar/DayStat";
import { useCalendarItems } from "@/hooks/queries/use-calendar-items";
import { getProfileContext } from "@/lib/profile-context";
import type { CalendarItem } from "@/components/calendar/types";

const DEPT_COLORS = nativeTheme.department;

// ── Timeline constants ────────────────────────────────────────────────────────

const TIMELINE_START_H = 8;  // 08:00
const TIMELINE_END_H = 24;   // 24:00
const ROW_H = 56;            // points per hour
const TIMELINE_LEFT_OFFSET = 56; // points — room for time labels

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Parse YYYY-MM-DD string into a Date at midnight local time.
 * Falls back to today if string is invalid.
 */
function parseDateParam(raw: string | string[] | undefined): Date {
  const str = Array.isArray(raw) ? raw[0] : raw ?? "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [year, month, day] = str.split("-").map(Number);
    return new Date(year, (month ?? 1) - 1, day ?? 1);
  }
  return new Date();
}

function dateToISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Norwegian long day names (Mon=0..Sun=6). */
const DAY_LONG = [
  "Mandag",
  "Tirsdag",
  "Onsdag",
  "Torsdag",
  "Fredag",
  "Lordag",
  "Sondag",
] as const;

function dayLong(date: Date): string {
  const j = date.getDay();
  const idx = j === 0 ? 6 : j - 1;
  return DAY_LONG[idx] ?? "";
}

/**
 * Parse a time string like "15:00–23:00" or "15:00" → { startH, endH }.
 * startH / endH are fractional hours (15.5 = 15:30).
 * Returns null if the string can't be parsed.
 */
function parseTimeRange(time: string | undefined): { startH: number; endH: number } | null {
  if (!time) return null;
  const firstMatch = time.match(/^(\d{1,2}):(\d{2})/);
  if (!firstMatch) return null;
  const startH = Number(firstMatch[1]) + Number(firstMatch[2]) / 60;

  const rangeMatch = time.match(/(\d{1,2}):(\d{2})\s*$/);
  const endH =
    rangeMatch && time.includes("–")
      ? Number(rangeMatch[1]) + Number(rangeMatch[2]) / 60
      : startH + 0.5;

  return { startH, endH };
}

/** Get the accent color for a CalendarItem based on type and dept. */
function colorForItem(item: CalendarItem, theme: ReturnType<typeof useTheme>): string {
  if (item.status === "overdue") return theme.colors.destructive;
  if (item.type === "shift") {
    return DEPT_COLORS[item.dept as keyof typeof DEPT_COLORS] ?? theme.colors.brandOrange;
  }
  if (item.type === "booking") return theme.colors.brandOrange;
  if (item.type === "task") return theme.colors.brandOrange;
  return theme.colors.mutedForeground;
}

/** Get current time as fractional hours (15.5 = 15:30). */
function currentHour(): number {
  const now = new Date();
  return now.getHours() + now.getMinutes() / 60;
}

// ── Positioned item block ─────────────────────────────────────────────────────

type TimeBlockProps = {
  item: CalendarItem;
  startH: number;
  endH: number;
  colOffset: number;
  onPress: () => void;
  themeColors: ReturnType<typeof useTheme>["colors"];
};

function TimeBlock({ item, startH, endH, colOffset, onPress, themeColors }: TimeBlockProps) {
  const col = item.status === "overdue"
    ? themeColors.destructive
    : DEPT_COLORS[item.dept as keyof typeof DEPT_COLORS] ?? themeColors.brandOrange;

  const top = (startH - TIMELINE_START_H) * ROW_H + 2;
  const height = Math.max(34, (endH - startH) * ROW_H - 4);

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.timeBlock,
        {
          top,
          height,
          left: TIMELINE_LEFT_OFFSET + colOffset,
          backgroundColor: withOpacity(col, 0.22),
          borderLeftColor: col,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={item.title}
    >
      <Text
        style={[
          styles.timeBlockTitle,
          {
            color: item.status === "overdue" ? themeColors.destructive : themeColors.foreground,
          },
        ]}
        numberOfLines={1}
      >
        {item.title}
      </Text>
      {item.time && (
        <Text style={[styles.timeBlockTime, { color: themeColors.mutedForeground }]} numberOfLines={1}>
          {item.time}
        </Text>
      )}
    </Pressable>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function CalendarDayScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { date: dateParam } = useLocalSearchParams();
  const displayDate = parseDateParam(dateParam as string | string[] | undefined);
  const today = useRef(new Date()).current;

  const isToday =
    displayDate.getFullYear() === today.getFullYear() &&
    displayDate.getMonth() === today.getMonth() &&
    displayDate.getDate() === today.getDate();

  const { data: items, isLoading } = useCalendarItems({
    date: displayDate,
    filter: "alt",
    scope: { kind: "me" },
  });

  // ── Telemetry ─────────────────────────────────────────────────────────────

  const emitViewChanged = useCallback(async () => {
    try {
      const ctx = await getProfileContext();
      void emit({
        event: "calendar view_changed",
        workspace_id: nonEmpty(ctx.workspaceId, "workspace_id"),
        actor_id: nonEmpty(ctx.profileId, "actor_id"),
        properties: { data: { from: "day", to: "week" } },
      });
    } catch {
      // swallow
    }
  }, []);

  const emitItemViewed = useCallback(async (item: CalendarItem) => {
    try {
      const ctx = await getProfileContext();
      void emit({
        event: "calendar item_viewed",
        workspace_id: nonEmpty(ctx.workspaceId, "workspace_id"),
        actor_id: nonEmpty(ctx.profileId, "actor_id"),
        properties: {
          entity_type: "calendar_item",
          entity_id: item.id,
          data: {
            item_type: item.type === "deviation" ? "deviation" : item.type,
            date: dateToISO(displayDate),
          },
        },
      });
    } catch {
      // swallow
    }
  }, [displayDate]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleBack = useCallback(() => {
    void emitViewChanged();
    router.back();
  }, [emitViewChanged, router]);

  // ── Derived data ──────────────────────────────────────────────────────────

  const shifts = items.filter((i) => i.type === "shift");
  const tasks = items.filter((i) => i.type === "task" || i.type === "deviation");
  const bookings = items.filter((i) => i.type === "booking");
  const notes = items.filter((i) => i.type === "note");
  const hasOverdueTasks = tasks.some((t) => t.status === "overdue");

  const doneTasks = tasks.filter(
    (t) => t.status === "done" || t.status === "completed",
  ).length;

  const totalGuests = bookings.reduce((sum, b) => sum + (b.guests ?? 0), 0);
  const totalShiftHours = shifts.reduce((sum, s) => sum + (s.planned ?? 0), 0);

  // Items with parseable times for the timeline
  const timedItems = useMemo(() => {
    const result: { item: CalendarItem; startH: number; endH: number }[] = [];
    for (const item of items) {
      const parsed = parseTimeRange(item.time);
      if (
        parsed &&
        parsed.startH >= TIMELINE_START_H &&
        parsed.startH < TIMELINE_END_H
      ) {
        result.push({ item, startH: parsed.startH, endH: Math.min(parsed.endH, TIMELINE_END_H) });
      }
    }
    return result;
  }, [items]);

  const nowH = currentHour();
  const nowTop = (nowH - TIMELINE_START_H) * ROW_H;
  const showNow = isToday && nowH >= TIMELINE_START_H && nowH < TIMELINE_END_H;
  const nowLabel = (() => {
    const h = Math.floor(nowH);
    const m = Math.round((nowH - h) * 60);
    return `NA · ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  })();

  const timelineHeight = (TIMELINE_END_H - TIMELINE_START_H) * ROW_H;
  const hours = Array.from(
    { length: TIMELINE_END_H - TIMELINE_START_H },
    (_, i) => TIMELINE_START_H + i,
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header with back */}
      <View style={[styles.header, { paddingTop: Platform.OS === "android" ? 32 : 12 }]}>
        <Pressable
          onPress={handleBack}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Tilbake"
        >
          <ChevronLeft size={22} color={theme.colors.foreground} strokeWidth={2} />
        </Pressable>

        <View style={styles.headerCenter}>
          <Text style={[styles.dayName, { color: theme.colors.mutedForeground }]}>
            {dayLong(displayDate).toUpperCase()}
          </Text>
          <Text style={[styles.dayDate, { color: theme.colors.foreground }]}>
            {displayDate.getDate()}.{" "}
            {displayDate.toLocaleDateString("nb-NO", { month: "long" })}
          </Text>
        </View>

        <View style={styles.backBtnPlaceholder} />
      </View>

      {/* DayStat strip */}
      <View style={styles.statStrip}>
        <DayStat
          icon={Calendar}
          count={shifts.length}
          label="Vakter"
          tone="default"
        />
        <DayStat
          icon={CheckSquare}
          count={tasks.length}
          label="Oppgaver"
          tone={hasOverdueTasks ? "error" : "default"}
        />
        <DayStat
          icon={Users}
          count={totalGuests}
          label="Bookinger"
          tone="default"
        />
      </View>

      {/* Timeline */}
      <ScrollView
        style={styles.timeline}
        contentContainerStyle={styles.timelineContent}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View style={styles.loadingPlaceholder}>
            <Text style={[styles.loadingText, { color: theme.colors.mutedForeground }]}>
              Laster...
            </Text>
          </View>
        ) : (
          <View style={[styles.timelineInner, { height: timelineHeight }]}>
            {/* Hour rows */}
            {hours.map((h) => (
              <View
                key={h}
                style={[
                  styles.hourRow,
                  {
                    top: (h - TIMELINE_START_H) * ROW_H,
                    borderTopColor: theme.colors.border,
                  },
                ]}
              >
                <Text style={[styles.hourLabel, { color: theme.colors.mutedForeground }]}>
                  {String(h).padStart(2, "0")}:00
                </Text>
              </View>
            ))}

            {/* NÅ indicator */}
            {showNow && (
              <View
                style={[
                  styles.nowLine,
                  {
                    top: nowTop,
                    borderTopColor: theme.colors.brandOrange,
                  },
                ]}
              >
                <View
                  style={[
                    styles.nowDot,
                    { backgroundColor: theme.colors.brandOrange },
                  ]}
                />
                <View style={[styles.nowLabel, { backgroundColor: theme.colors.background }]}>
                  <Text style={[styles.nowLabelText, { color: theme.colors.brandOrange }]}>
                    {nowLabel}
                  </Text>
                </View>
              </View>
            )}

            {/* Timed items */}
            {timedItems.map(({ item, startH, endH }, idx) => (
              <TimeBlock
                key={item.id}
                item={item}
                startH={startH}
                endH={endH}
                colOffset={(idx % 2) * 6}
                onPress={() => void emitItemViewed(item)}
                themeColors={theme.colors}
              />
            ))}
          </View>
        )}

        {/* Notes section */}
        {notes.length > 0 && (
          <View style={styles.notesSection}>
            <Text style={[styles.notesLabel, { color: theme.colors.mutedForeground }]}>
              NOTATER
            </Text>
            {notes.map((n) => (
              <View
                key={n.id}
                style={[
                  styles.noteCard,
                  {
                    backgroundColor: theme.colors.card,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <Text style={[styles.noteText, { color: theme.colors.mutedForeground }]}>
                  {n.title}
                  {n.sub ? ` — ${n.sub}` : ""}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  backBtnPlaceholder: {
    width: 32,
  },
  headerCenter: {
    alignItems: "center",
  },
  dayName: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  dayDate: {
    fontSize: 22,
    fontFamily: "InstrumentSerif-Regular",
    letterSpacing: -0.3,
  },
  statStrip: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  timeline: {
    flex: 1,
  },
  timelineContent: {
    paddingBottom: 110,
  },
  timelineInner: {
    position: "relative",
    marginLeft: 0,
  },
  hourRow: {
    position: "absolute",
    left: 0,
    right: 16,
    height: ROW_H,
    borderTopWidth: 1,
  },
  hourLabel: {
    position: "absolute",
    left: 8,
    top: -8,
    fontSize: 11,
    fontFamily: "GeistMono-Regular",
    width: 40,
    textAlign: "right",
  },
  nowLine: {
    position: "absolute",
    left: TIMELINE_LEFT_OFFSET,
    right: 16,
    borderTopWidth: 2,
    zIndex: 4,
  },
  nowDot: {
    position: "absolute",
    left: -8,
    top: -5,
    width: 10,
    height: 10,
    borderRadius: 99,
  },
  nowLabel: {
    position: "absolute",
    right: -2,
    top: -20,
    paddingHorizontal: 4,
  },
  nowLabelText: {
    fontSize: 9.5,
    fontFamily: "GeistMono-Regular",
    fontWeight: "700",
  },
  timeBlock: {
    position: "absolute",
    right: 16,
    borderRadius: 10,
    borderLeftWidth: 3,
    paddingHorizontal: 12,
    paddingVertical: 8,
    zIndex: 3,
    overflow: "hidden",
  },
  timeBlockTitle: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 2,
  },
  timeBlockTime: {
    fontSize: 10.5,
    fontFamily: "GeistMono-Regular",
  },
  notesSection: {
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 6,
  },
  notesLabel: {
    fontSize: 9.5,
    fontWeight: "700",
    letterSpacing: 1.4,
    marginBottom: 4,
  },
  noteCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  noteText: {
    fontSize: 13,
    lineHeight: 19,
  },
  loadingPlaceholder: {
    paddingVertical: 48,
    alignItems: "center",
  },
  loadingText: {
    fontSize: 13,
  },
});
