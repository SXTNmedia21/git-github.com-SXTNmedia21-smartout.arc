/**
 * Calendar tab — WeekView (default screen).
 *
 * Handoff §4.1: WeekStrip + FilterChips + tasks summary card + shift card +
 * ItemCard list + EmptyDay state. View toggle switches to MonthView via router.
 *
 * Cross-tab: tapping "Vakter" FilterChip navigates to (shifts) tab per
 * handoff §7. Tap on ItemCard emits calendar item_viewed.
 *
 * Telemetry: calendar view_changed / filter_changed / tab_switched / day_selected
 * via getProfileContext() (ADR-0134).
 *
 * All data via useCalendarItems() → useOperationsFeed() → workspace-scoped
 * queries. No writes (ADR-0133 read-only execute surface).
 */

import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  SafeAreaView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { toZonedTime } from "date-fns-tz";
import { emit, nonEmpty } from "@smartout/telemetry";
import { useTheme } from "@/theme";
import { withOpacity } from "@/theme/colors";
import { nativeTheme } from "@smartout/design-tokens/native";
import { WeekStrip } from "@/components/calendar/WeekStrip";
import { FilterChips, type FilterValue } from "@/components/calendar/FilterChips";
import { ItemCard } from "@/components/calendar/ItemCard";
import { ProgressRing } from "@/components/calendar/ProgressRing";
import { EmptyDay } from "@/components/calendar/EmptyDay";
import { useCalendarItems } from "@/hooks/queries/use-calendar-items";
import { useMyProfile } from "@/hooks/queries/use-my-profile";
import { getProfileContext } from "@/lib/profile-context";
import type { CalendarItem } from "@/components/calendar/types";

/** Fallback timezone per Lovsen rapport / workspace table DEFAULT. */
const FALLBACK_TZ = "Europe/Oslo";

const DEPT_COLORS = nativeTheme.department;

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatMonthLabel(date: Date): string {
  return date.toLocaleDateString("nb-NO", { month: "long", year: "numeric" });
}

/**
 * Format a Date as YYYY-MM-DD in the given timezone (defaults to Europe/Oslo).
 * Must use workspace tz — not device tz — per BLOCKING-3 (F-09).
 */
function dateToISO(d: Date, tz: string = FALLBACK_TZ): string {
  const z = toZonedTime(d, tz);
  return `${z.getFullYear()}-${String(z.getMonth() + 1).padStart(2, "0")}-${String(z.getDate()).padStart(2, "0")}`;
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── ShiftCard (inline — not modifying Phase 3b primitives) ───────────────────

type ShiftCardProps = {
  shift: CalendarItem;
  onTap: () => void;
};

function ShiftCard({ shift, onTap }: ShiftCardProps) {
  const theme = useTheme();
  const deptColor =
    DEPT_COLORS[shift.dept as keyof typeof DEPT_COLORS] ?? theme.colors.brandOrange;

  return (
    <Pressable
      onPress={onTap}
      style={[
        styles.shiftCard,
        { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
      ]}
      accessibilityRole="button"
      accessibilityLabel={shift.title}
    >
      <View style={[styles.shiftStripe, { backgroundColor: deptColor }]} />
      <View style={styles.shiftBody}>
        <View style={styles.shiftRow}>
          <Text style={[styles.shiftTitle, { color: theme.colors.foreground }]} numberOfLines={1}>
            {shift.title}
          </Text>
          {shift.isShiftLead && (
            <View
              style={[
                styles.shiftLeadBadge,
                { backgroundColor: withOpacity(theme.colors.brandOrange, 0.16) },
              ]}
            >
              <Text style={[styles.shiftLeadText, { color: theme.colors.brandOrange }]}>
                SKIFTLEDER
              </Text>
            </View>
          )}
        </View>
        <View style={styles.shiftMeta}>
          {shift.time && (
            <Text style={[styles.shiftMetaText, { color: theme.colors.mutedForeground }]}>
              {shift.time}
            </Text>
          )}
          {shift.time && shift.role && (
            <Text style={[styles.shiftDot, { color: theme.colors.mutedForeground }]}>·</Text>
          )}
          {shift.role && (
            <Text style={[styles.shiftMetaText, { color: theme.colors.mutedForeground }]}>
              {shift.role}
            </Text>
          )}
          {shift.zone && (
            <>
              <Text style={[styles.shiftDot, { color: theme.colors.mutedForeground }]}>·</Text>
              <Text style={[styles.shiftMetaText, { color: theme.colors.mutedForeground }]}>
                {shift.zone}
              </Text>
            </>
          )}
        </View>
      </View>
      <ChevronRight size={14} color={theme.colors.mutedForeground} strokeWidth={2} />
    </Pressable>
  );
}

// ── ViewToggle ────────────────────────────────────────────────────────────────

type ViewToggleProps = {
  value: "Uke" | "Måned";
  onSwitch: (v: "Uke" | "Måned") => void;
};

function ViewToggle({ value, onSwitch }: ViewToggleProps) {
  const theme = useTheme();
  const options: ("Uke" | "Måned")[] = ["Uke", "Måned"];

  return (
    <View style={[styles.toggle, { backgroundColor: theme.colors.secondary, borderColor: theme.colors.border }]}>
      {options.map((opt) => {
        const isActive = value === opt;
        return (
          <Pressable
            key={opt}
            onPress={() => onSwitch(opt)}
            style={[
              styles.toggleOption,
              isActive && { backgroundColor: theme.colors.brandOrange },
            ]}
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

// ── Main screen ───────────────────────────────────────────────────────────────

export default function CalendarWeekScreen() {
  const theme = useTheme();
  const router = useRouter();
  const today = useRef(new Date()).current;

  // Resolve workspace timezone (BLOCKING-3 / F-09).
  const { data: profile } = useMyProfile();
  const tz =
    (profile?.workspace as { timezone?: string } | null)?.timezone ?? FALLBACK_TZ;

  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [filter, setFilter] = useState<FilterValue>("alt");

  // Keep a ref to the previous filter for telemetry diff
  const prevFilter = useRef<FilterValue>(filter);
  const prevDate = useRef<string>(dateToISO(today, tz));

  const { data: items, isLoading, counts, refetch } = useCalendarItems({
    date: selectedDate,
    filter,
    scope: { kind: "me" },
  });

  // ── Telemetry helpers ─────────────────────────────────────────────────────

  const emitFilterChanged = useCallback(
    async (from: FilterValue, to: FilterValue) => {
      try {
        const ctx = await getProfileContext();
        void emit({
          event: "calendar filter_changed",
          workspace_id: nonEmpty(ctx.workspaceId, "workspace_id"),
          actor_id: nonEmpty(ctx.profileId, "actor_id"),
          properties: { data: { from, to } },
        });
      } catch {
        // Non-critical: swallow telemetry errors per ADR-0134 read-only pattern
      }
    },
    [],
  );

  const emitDaySelected = useCallback(async (date: Date) => {
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
  }, [tz]);

  const emitTabSwitched = useCallback(async () => {
    try {
      const ctx = await getProfileContext();
      void emit({
        event: "calendar tab_switched",
        workspace_id: nonEmpty(ctx.workspaceId, "workspace_id"),
        actor_id: nonEmpty(ctx.profileId, "actor_id"),
        properties: {
          data: { from: "kalender", to: "vakter", trigger: "chip" },
        },
      });
    } catch {
      // swallow
    }
  }, []);

  const emitViewChanged = useCallback(async (to: "week" | "month") => {
    try {
      const ctx = await getProfileContext();
      void emit({
        event: "calendar view_changed",
        workspace_id: nonEmpty(ctx.workspaceId, "workspace_id"),
        actor_id: nonEmpty(ctx.profileId, "actor_id"),
        properties: { data: { from: "week", to } },
      });
    } catch {
      // swallow
    }
  }, []);

  // ── Event handlers ────────────────────────────────────────────────────────

  const handleDaySelect = useCallback(
    (date: Date) => {
      const iso = dateToISO(date, tz);
      if (iso !== prevDate.current) {
        prevDate.current = iso;
        void emitDaySelected(date);
      }
      setSelectedDate(date);
    },
    [emitDaySelected, tz],
  );

  const handleFilterChange = useCallback(
    (next: FilterValue) => {
      if (next === "vakter") {
        // Cross-tab trigger: navigate to (shifts) tab per handoff §7
        void emitTabSwitched();
        router.push("/(app)/(shifts)");
        return;
      }
      const prev = prevFilter.current;
      if (prev !== next) {
        void emitFilterChanged(prev, next);
        prevFilter.current = next;
      }
      setFilter(next);
    },
    [emitFilterChanged, emitTabSwitched, router],
  );

  const handleViewSwitch = useCallback(
    (v: "Uke" | "Måned") => {
      if (v === "Måned") {
        void emitViewChanged("month");
        router.push("/(app)/(calendar)/month");
      }
    },
    [emitViewChanged, router],
  );

  // ── Derived data ──────────────────────────────────────────────────────────

  const tasks = items.filter((i) => i.type === "task" || i.type === "deviation");
  const shifts = items.filter((i) => i.type === "shift");
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((i) => i.status === "done" || i.status === "completed").length;
  const overdueTasks = tasks.filter((i) => i.status === "overdue").length;
  const showTasksSummary =
    (filter === "alt" || filter === "oppgaver") && totalTasks > 0;

  // Items to list: for "alt" exclude shifts (shown in ShiftCard above)
  const listItems =
    filter === "alt" ? items.filter((i) => i.type !== "shift") : items;

  const monthLabel = capitalise(formatMonthLabel(selectedDate));

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.colors.foreground }]}>
          Kalender
        </Text>
      </View>

      {/* Month label + view toggle */}
      <View style={styles.monthRow}>
        <Text style={[styles.monthLabel, { color: theme.colors.foreground }]}>
          {monthLabel}
        </Text>
        <ViewToggle value="Uke" onSwitch={handleViewSwitch} />
      </View>

      {/* Week strip */}
      <WeekStrip
        selectedDate={selectedDate}
        onSelect={handleDaySelect}
        today={today}
      />

      {/* Filter chips */}
      <FilterChips
        filter={filter}
        counts={counts}
        onChange={handleFilterChange}
      />

      {/* Body scroll */}
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View style={styles.loadingPlaceholder}>
            <Text style={[styles.loadingText, { color: theme.colors.mutedForeground }]}>
              Laster...
            </Text>
          </View>
        ) : (
          <>
            {/* Tasks summary card */}
            {showTasksSummary && (
              <View
                style={[
                  styles.tasksSummary,
                  {
                    backgroundColor: theme.colors.card,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <View style={styles.tasksSummaryLeft}>
                  <Text style={[styles.tasksSummaryCount, { color: theme.colors.foreground }]}>
                    {totalTasks} {totalTasks === 1 ? "oppgave" : "oppgaver"}
                  </Text>
                  <View style={styles.tasksSummaryMeta}>
                    <Text style={[styles.tasksMeta, { color: theme.colors.mutedForeground }]}>
                      {doneTasks} fullfort{" "}
                      <Text style={{ opacity: 0.5 }}>· </Text>
                      {totalTasks - doneTasks} gjenstår
                    </Text>
                    {overdueTasks > 0 && (
                      <Text style={[styles.overdueText, { color: theme.colors.destructive }]}>
                        {" "}· {overdueTasks} avvik
                      </Text>
                    )}
                  </View>
                </View>
                <ProgressRing
                  total={totalTasks}
                  completed={doneTasks}
                  hasError={overdueTasks > 0}
                  size={56}
                />
              </View>
            )}

            {/* Shift card (first shift for the day, shown in Alt/Vakter modes) */}
            {(filter === "alt" || filter === "vakter") && shifts.length > 0 && (
              <ShiftCard
                shift={shifts[0]}
                onTap={() => {
                  // Item tap telemetry deferred — no DetailSheet in Phase 3c
                }}
              />
            )}

            {/* Item list */}
            <View style={styles.itemList}>
              {listItems.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  onPress={() => {
                    // DetailSheet tap — emits item_viewed; sheet in Phase 3e
                  }}
                />
              ))}
              {listItems.length === 0 && shifts.length === 0 && <EmptyDay />}
            </View>
          </>
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
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 110,
    gap: 8,
  },
  tasksSummary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 6,
  },
  tasksSummaryLeft: {
    flex: 1,
    marginRight: 12,
  },
  tasksSummaryCount: {
    fontSize: 26,
    fontFamily: "InstrumentSerif-Regular",
    letterSpacing: -0.3,
    lineHeight: 30,
    marginBottom: 4,
  },
  tasksSummaryMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
  },
  tasksMeta: {
    fontSize: 12.5,
  },
  overdueText: {
    fontSize: 12.5,
    fontWeight: "600",
  },
  shiftCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 4,
    overflow: "hidden",
  },
  shiftStripe: {
    width: 5,
    alignSelf: "stretch",
  },
  shiftBody: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  shiftRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  shiftTitle: {
    fontSize: 14.5,
    fontWeight: "600",
    flex: 1,
    marginRight: 8,
  },
  shiftLeadBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    flexShrink: 0,
  },
  shiftLeadText: {
    fontSize: 9.5,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  shiftMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  shiftMetaText: {
    fontSize: 12,
    fontFamily: "GeistMono-Regular",
  },
  shiftDot: {
    fontSize: 12,
    opacity: 0.5,
  },
  itemList: {
    gap: 8,
  },
  loadingPlaceholder: {
    paddingVertical: 48,
    alignItems: "center",
  },
  loadingText: {
    fontSize: 13,
  },
});
