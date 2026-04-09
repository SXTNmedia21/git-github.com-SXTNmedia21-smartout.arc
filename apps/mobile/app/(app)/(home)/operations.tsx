/**
 * Operations — Daily task & operations calendar.
 *
 * Layout:
 * 1. Header — ← back | "Oppgaver" (serif) | spacer
 * 2. Month label + Uke/Måned toggle
 * 3. Weekly strip — 7-day horizontal selector with today highlight
 * 4. Filter tags — Alt, Oppgaver, Vakter, Bookinger, Notater
 * 5. Summary hero — "X oppgaver i dag" + completion ring
 * 6. Bento feed — overdue (red), tasks, shifts, team, bookings, notes
 */

import React, { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import {
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Users,
  UtensilsCrossed,
  StickyNote,
  RefreshCw,
} from "lucide-react-native";
import { createStyles, useTheme, withOpacity } from "@/theme";
import { useOperationsFeed } from "@/hooks/queries/use-operations-feed";
import type { FeedItem, FeedItemType } from "@/hooks/queries/use-operations-feed";

/* ── Constants ── */

const DAY_NAMES = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];
const MONTH_NAMES = [
  "Januar",
  "Februar",
  "Mars",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Desember",
];

type FilterKey = "all" | "tasks" | "shifts" | "bookings" | "notes";
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Alt" },
  { key: "tasks", label: "Oppgaver" },
  { key: "shifts", label: "Vakter" },
  { key: "bookings", label: "Bookinger" },
  { key: "notes", label: "Notater" },
];

/* ── Helpers ── */

function getWeekDays(date: Date): Date[] {
  const d = new Date(date);
  const dow = d.getDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(d);
  monday.setDate(d.getDate() + mondayOffset);
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    return day;
  });
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

const ICON_MAP: Record<FeedItemType, typeof Clock> = {
  overdue: AlertTriangle,
  task: CheckCircle2,
  shift: Clock,
  team: Users,
  booking: UtensilsCrossed,
  note: StickyNote,
};

/* ── Week Strip ── */

function WeekStrip({ selected, onSelect }: { selected: Date; onSelect: (d: Date) => void }) {
  const s = useStyles();
  const _theme = useTheme();
  const today = useMemo(() => new Date(), []);
  const days = useMemo(() => getWeekDays(selected), [selected]);

  return (
    <View style={s.weekStrip}>
      {days.map((day, i) => {
        const isSel = isSameDay(day, selected);
        const isTod = isSameDay(day, today);
        return (
          <Pressable
            key={i}
            onPress={() => {
              Haptics.selectionAsync();
              onSelect(day);
            }}
            style={[s.dayCell, isSel && s.dayCellSel]}
          >
            <Text style={[s.dayLabel, isSel && s.dayLabelSel]}>{DAY_NAMES[i]}</Text>
            <Text style={[s.dayNum, isSel && s.dayNumSel, isTod && !isSel && s.dayNumToday]}>
              {day.getDate()}
            </Text>
            {isTod && !isSel && <View style={s.todayDot} />}
          </Pressable>
        );
      })}
    </View>
  );
}

/* ── Main ── */

export default function OperationsScreen() {
  const s = useStyles();
  const theme = useTheme();
  const router = useRouter();

  const [selected, setSelected] = useState(new Date());
  const [filter, setFilter] = useState<FilterKey>("all");
  const [viewMode, setViewMode] = useState<"week" | "month">("week");

  const { data: feed, isLoading, isError, refetch } = useOperationsFeed(selected);

  const monthLabel = `${MONTH_NAMES[selected.getMonth()]} ${selected.getFullYear()}`;

  const taskCount = feed.filter((f) => f.type === "task" || f.type === "overdue").length;
  const doneCount = feed.filter((f) => f.type === "task" && f.done).length;

  const filtered =
    filter === "all"
      ? feed
      : feed.filter((f) => {
          if (filter === "tasks") return f.type === "task" || f.type === "overdue";
          if (filter === "shifts") return f.type === "shift" || f.type === "team";
          if (filter === "bookings") return f.type === "booking";
          if (filter === "notes") return f.type === "note";
          return true;
        });

  const handleFeedPress = (item: FeedItem) => {
    Haptics.selectionAsync();
    if (item.type === "task" || item.type === "overdue") {
      router.push("/(app)/(home)/haccp");
      return;
    }
    if (item.type === "shift" || item.type === "team") {
      router.push("/(app)/(shifts)");
      return;
    }
    if (item.type === "booking") {
      router.push("/(app)/(home)/operations");
      return;
    }
    if (item.type === "note") {
      router.push("/(app)/(home)/haccp");
    }
  };

  return (
    <SafeAreaView style={s.container} edges={["top"]}>
      {/* Header */}
      <View style={s.headerBar}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            router.back();
          }}
          hitSlop={12}
          style={s.backBtn}
        >
          <ChevronLeft size={24} color={theme.colors.foreground} strokeWidth={1.8} />
        </Pressable>
        <Text style={s.headerTitle}>Oppgaver</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Month + toggle */}
        <View style={s.monthRow}>
          <Text style={s.monthLabel}>{monthLabel}</Text>
          <View style={s.toggleWrap}>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setViewMode("week");
              }}
              style={[s.toggleBtn, viewMode === "week" && s.toggleBtnActive]}
            >
              <Text style={[s.toggleText, viewMode === "week" && s.toggleTextActive]}>Uke</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setViewMode("month");
              }}
              style={[s.toggleBtn, viewMode === "month" && s.toggleBtnActive]}
            >
              <Text style={[s.toggleText, viewMode === "month" && s.toggleTextActive]}>Måned</Text>
            </Pressable>
          </View>
        </View>

        {/* Week strip */}
        <WeekStrip selected={selected} onSelect={setSelected} />

        {/* Filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.filterRow}
        >
          {FILTERS.map((f) => (
            <Pressable
              key={f.key}
              onPress={() => {
                Haptics.selectionAsync();
                setFilter(f.key);
              }}
              style={[s.filterPill, filter === f.key && s.filterPillActive]}
            >
              <Text style={[s.filterText, filter === f.key && s.filterTextActive]}>{f.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Loading state */}
        {isLoading && (
          <View style={s.emptyState}>
            <ActivityIndicator size="large" color={theme.colors.brandOrange} />
            <Text style={s.emptyText}>Laster oppgaver...</Text>
          </View>
        )}

        {/* Error state */}
        {isError && !isLoading && (
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              void refetch();
            }}
            style={s.errorCard}
          >
            <AlertTriangle size={20} color={theme.colors.destructive} strokeWidth={1.5} />
            <Text style={s.errorText}>Kunne ikke laste data</Text>
            <View style={s.retryRow}>
              <RefreshCw size={14} color={theme.colors.mutedForeground} strokeWidth={1.5} />
              <Text style={s.retryText}>Trykk for å prøve igjen</Text>
            </View>
          </Pressable>
        )}

        {/* Summary hero — only show when we have data */}
        {!isLoading && !isError && (
          <View style={s.summaryCard}>
            <View>
              <Text style={s.summaryCount}>
                {feed.length === 0 ? "Ingen oppgaver" : `${taskCount} oppgaver`}
              </Text>
              <Text style={s.summarySubtitle}>
                {feed.length === 0
                  ? "Ingen hendelser denne dagen"
                  : `${doneCount} fullført · ${taskCount - doneCount} gjenstår`}
              </Text>
            </View>
            <View style={s.summaryRing}>
              <Text style={s.summaryRingText}>
                {Math.round((doneCount / Math.max(taskCount, 1)) * 100)}%
              </Text>
            </View>
          </View>
        )}

        {/* Empty state — no items for the selected day after filtering */}
        {!isLoading && !isError && filtered.length === 0 && feed.length > 0 && (
          <View style={s.emptyState}>
            <Text style={s.emptyText}>Ingen treff for dette filteret</Text>
          </View>
        )}

        {/* Feed */}
        {filtered.map((item) => {
          const Icon = ICON_MAP[item.type];
          const isOverdue = item.type === "overdue";
          const isDone = item.type === "task" && item.done;

          return (
            <Pressable
              key={item.id}
              onPress={() => handleFeedPress(item)}
              style={({ pressed }) => [
                s.feedCard,
                isOverdue && s.feedCardOverdue,
                isDone && s.feedCardDone,
                pressed && s.feedCardPressed,
              ]}
            >
              <View style={[s.feedIcon, isOverdue && s.feedIconOverdue, isDone && s.feedIconDone]}>
                {isDone ? (
                  <CheckCircle2 size={20} color={theme.colors.success} strokeWidth={1.5} />
                ) : (
                  <Icon
                    size={20}
                    color={isOverdue ? theme.colors.destructive : theme.colors.mutedForeground}
                    strokeWidth={1.5}
                  />
                )}
              </View>
              <View style={s.feedBody}>
                <Text
                  style={[
                    s.feedTitle,
                    isOverdue && { color: theme.colors.destructive },
                    isDone && s.feedTitleDone,
                  ]}
                  numberOfLines={1}
                >
                  {item.title}
                </Text>
                <Text style={s.feedSub} numberOfLines={1}>
                  {item.subtitle}
                </Text>
              </View>
              {item.time && <Text style={s.feedTime}>{item.time}</Text>}
              <ChevronRight
                size={16}
                color={withOpacity(theme.colors.mutedForeground, 0.25)}
                strokeWidth={1.5}
              />
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ── Styles ── */

const useStyles = createStyles((theme) => ({
  container: { flex: 1, backgroundColor: theme.colors.background },

  /* Header */
  headerBar: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.element,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  headerTitle: {
    fontSize: 22,
    fontStyle: "italic" as const,
    fontWeight: "300" as const,
    color: theme.colors.foreground,
    letterSpacing: -0.3,
  },

  scroll: { paddingHorizontal: theme.spacing.section, paddingBottom: 160 },

  /* Month + toggle */
  monthRow: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    marginBottom: theme.spacing.element,
  },
  monthLabel: {
    fontSize: 16,
    fontWeight: "500" as const,
    color: theme.colors.foreground,
  },
  toggleWrap: {
    flexDirection: "row" as const,
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.06)" : theme.colors.muted,
    borderRadius: theme.radius.full,
    padding: 3,
  },
  toggleBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
  },
  toggleBtnActive: {
    backgroundColor: theme.colors.brandOrange,
  },
  toggleText: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: theme.colors.mutedForeground,
  },
  toggleTextActive: {
    color: "#ffffff",
  },

  /* Week Strip */
  weekStrip: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    marginBottom: theme.spacing.section,
    gap: 4,
  },
  dayCell: {
    flex: 1,
    alignItems: "center" as const,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    gap: 3,
  },
  dayCellSel: {
    backgroundColor: theme.colors.brandOrange,
  },
  dayLabel: {
    fontSize: 10,
    fontWeight: "500" as const,
    letterSpacing: 0.5,
    textTransform: "uppercase" as const,
    color: theme.colors.mutedForeground,
  },
  dayLabelSel: { color: "rgba(255,255,255,0.7)" },
  dayNum: {
    fontSize: 18,
    fontWeight: "300" as const,
    fontStyle: "italic" as const,
    color: theme.colors.foreground,
  },
  dayNumSel: { color: "#ffffff", fontWeight: "600" as const, fontStyle: "normal" as const },
  dayNumToday: { color: theme.colors.brandOrange },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.brandOrange,
  },

  /* Filters */
  filterRow: {
    gap: theme.spacing.tight,
    paddingBottom: theme.spacing.section,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.06)" : theme.colors.muted,
  },
  filterPillActive: { backgroundColor: theme.colors.brandOrange },
  filterText: { fontSize: 13, fontWeight: "500" as const, color: theme.colors.foreground },
  filterTextActive: { color: "#ffffff" },

  /* Summary hero */
  summaryCard: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    backgroundColor: theme.isDark ? theme.colors.card : theme.colors.secondary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.page,
    marginBottom: theme.spacing.section,
  },
  summaryCount: {
    fontSize: 24,
    fontWeight: "300" as const,
    fontStyle: "italic" as const,
    color: theme.colors.foreground,
  },
  summarySubtitle: {
    ...theme.typography.subheadline,
    color: theme.colors.mutedForeground,
    marginTop: 4,
  },
  summaryRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 3,
    borderColor: theme.colors.brandOrange,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  summaryRingText: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: theme.colors.brandOrange,
  },

  /* Feed */
  feedCard: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: theme.isDark ? theme.colors.card : "#ffffff",
    borderRadius: theme.radius.md,
    padding: theme.spacing.card,
    marginBottom: theme.spacing.element,
    gap: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
  },
  feedCardOverdue: {
    borderColor: withOpacity(theme.colors.destructive, 0.15),
    backgroundColor: theme.isDark ? "rgba(186,26,26,0.06)" : "rgba(186,26,26,0.02)",
  },
  feedCardDone: {
    opacity: 0.6,
  },
  feedCardPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  feedIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.06)" : theme.colors.muted,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  feedIconOverdue: { backgroundColor: withOpacity(theme.colors.destructive, 0.08) },
  feedIconDone: { backgroundColor: withOpacity(theme.colors.success, 0.08) },
  feedBody: { flex: 1, gap: 2 },
  feedTitle: { fontSize: 14, fontWeight: "600" as const, color: theme.colors.foreground },
  feedTitleDone: {
    textDecorationLine: "line-through" as const,
    color: theme.colors.mutedForeground,
  },
  feedSub: { fontSize: 12, color: theme.colors.mutedForeground },
  feedTime: { fontSize: 12, fontWeight: "500" as const, color: theme.colors.mutedForeground },

  /* Empty & error states */
  emptyState: {
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingVertical: 40,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.mutedForeground,
    fontWeight: "500" as const,
  },
  errorCard: {
    alignItems: "center" as const,
    backgroundColor: theme.isDark ? "rgba(186,26,26,0.06)" : "rgba(186,26,26,0.03)",
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.destructive, 0.12),
    padding: theme.spacing.page,
    marginBottom: theme.spacing.section,
    gap: 8,
  },
  errorText: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: theme.colors.destructive,
  },
  retryRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
  },
  retryText: {
    fontSize: 12,
    color: theme.colors.mutedForeground,
  },
}));
