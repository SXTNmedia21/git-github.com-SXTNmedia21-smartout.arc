/**
 * ShiftListScreen — Vaktliste redesign (Phase 3d).
 *
 * Reproduces handoff shiftlist.jsx per §4.4:
 *   ScopeChips → ScopeSummary → 7 × DayCrewCluster (all days, even empty)
 *
 * Data: useTeamShifts() fetches all workspace published shifts for the current
 * week, joined with profile + department. Client-side scope filter per ADR-0266.
 *
 * Telemetry: emits "calendar scope_changed" on ScopeChips selection (ADR-0134).
 * scope_changed is a navigation event — workspace_id + actor_id resolved async
 * via getProfileContext, emitted fire-and-forget.
 *
 * Phase 3b primitives (ScopeChips, CompactShiftRow, Avatar) are READ-ONLY imports.
 */

import React, { useMemo, useState, useCallback, useRef } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { toZonedTime } from "date-fns-tz";
import { emit } from "@smartout/telemetry";
import { nativeTheme } from "@smartout/design-tokens/native";
import { useTheme, withOpacity, createStyles } from "@/theme";
import { ScopeChips } from "@/components/calendar/ScopeChips";
import { CompactShiftRow } from "@/components/calendar/CompactShiftRow";
import { useTeamShifts } from "@/hooks/queries/use-team-shifts";
import { useTeamStaff } from "@/hooks/queries/use-team-staff";
import { useMyProfile } from "@/hooks/queries/use-my-profile";
import { getProfileContext } from "@/lib/profile-context";
import type { Scope, ScopeKind } from "@/components/calendar/ScopeChips";
import type { Department, Staff } from "@/components/calendar/types";

/** Fallback timezone per Lovsen rapport / workspace table DEFAULT. */
const FALLBACK_TZ = "Europe/Oslo";

const DEPT_COLORS = nativeTheme.department;

/* ── Date helpers ─────────────────────────────────────────────────────────── */

/**
 * Returns ISO Monday (YYYY-MM-DD) of the week containing `date`,
 * computed in the given workspace timezone (BLOCKING-3 / F-09).
 * Defaults to "Europe/Oslo" if tz is not provided.
 */
function mondayOf(date: Date, tz: string = FALLBACK_TZ): string {
  const zoned = toZonedTime(date, tz);
  const day = zoned.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(zoned);
  monday.setDate(zoned.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, "0");
  const d = String(monday.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** ISO week number for a date. */
function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

const MONTHS_SHORT = [
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

const DAY_SHORT = ["søn", "man", "tir", "ons", "tor", "fre", "lør"];
const DAY_LONG = ["Søndag", "Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag"];

/** 7 consecutive Date objects starting from Monday of the current week. */
function weekDays(mondayStr: string): Date[] {
  const monday = new Date(mondayStr + "T00:00:00");
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

/** "UKE 19 · 4–10. MAI" style range label. */
function weekRangeLabel(weekStart: string): string {
  const days = weekDays(weekStart);
  const first = days[0]!;
  const last = days[6]!;
  const weekNum = isoWeek(first);
  const m = MONTHS_SHORT[last.getMonth()]!.toUpperCase();
  return `UKE ${weekNum} · ${first.getDate()}–${last.getDate()}. ${m}`;
}

/** Total planned hours for a filtered shift list. */
function totalHours(shifts: { planned: number }[]): number {
  return shifts.reduce((s, x) => s + x.planned, 0);
}

/* ── Staff type alias for ScopeChips Ansatt-dropdown ─────────────────────── */

// Re-export the canonical Staff shape from calendar/types so local usages
// continue to compile without renaming call sites throughout this file.
type StaffShape = Staff;

/* ── Department density pills inside DayCrewCluster header ────────────────── */

const DEPT_LABELS: Record<Department, string> = {
  kjokken: "Kjøkken",
  sal: "Sal",
  bar: "Bar",
  event: "Event",
  // English DB-slug equivalents — see Department union in calendar/types.ts.
  kitchen: "Kjøkken",
  service: "Service",
  operations: "Drift",
};

/* ── ScopeSummary card ────────────────────────────────────────────────────── */

type ScopeSummaryProps = {
  scope: Scope;
  count: number;
  hours: number;
  weekStart: string;
  staffById: (id: string) => StaffShape | undefined;
};

function ScopeSummary({ scope, count, hours, weekStart, staffById }: ScopeSummaryProps) {
  const theme = useTheme();
  const rangeLabel = weekRangeLabel(weekStart);

  const scopeLabel = (() => {
    if (scope.kind === "me") return "Dine vakter";
    if (scope.kind === "all") return "Hele teamet";
    if (scope.kind === "dept") return DEPT_LABELS[scope.value as Department] ?? scope.value ?? "";
    if (scope.kind === "person") {
      const s = scope.value ? staffById(scope.value) : undefined;
      return s ? s.name : "—";
    }
    return "";
  })();

  return (
    <View
      style={[
        styles.summaryCard,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <View>
        <Text style={[styles.summaryOverline, { color: theme.colors.mutedForeground }]}>
          {rangeLabel}
        </Text>
        <Text style={[styles.summaryTitle, { color: theme.colors.foreground }]}>{scopeLabel}</Text>
      </View>
      <View style={styles.summaryRight}>
        <Text style={[styles.summaryCount, { color: theme.colors.foreground }]}>
          {count}
          <Text style={[styles.summaryCountSub, { color: theme.colors.mutedForeground }]}>
            {" "}
            vakter
          </Text>
        </Text>
        <Text style={[styles.summaryHours, { color: theme.colors.mutedForeground }]}>
          {hours.toFixed(1)}t totalt
        </Text>
      </View>
    </View>
  );
}

/* ── DayCrewCluster ─────────────────────────────────────────────────────── */

type DayCrewClusterProps = {
  date: Date;
  todayStr: string;
  myProfileId: string | null;
  scope: Scope;
  shifts: import("@/hooks/queries/use-team-shifts").ShiftWithProfile[];
  onTap: (id: string) => void;
};

function DayCrewCluster({
  date,
  todayStr,
  myProfileId,
  scope,
  shifts,
  onTap,
}: DayCrewClusterProps) {
  const theme = useTheme();
  const dateStr = date.toISOString().split("T")[0]!;
  const isToday = dateStr === todayStr;
  const meIn = shifts.some((s) => s.owner === myProfileId);
  const showCrew = scope.kind !== "me";
  const empty = shifts.length === 0;

  // Sort: mine first, then by start time (time string is already HH–HH)
  const sorted = [...shifts].sort((a, b) => {
    const am = a.owner === myProfileId ? 0 : 1;
    const bm = b.owner === myProfileId ? 0 : 1;
    if (am !== bm) return am - bm;
    return a.time.localeCompare(b.time);
  });

  // Dept density map for header pills
  const byDept: Partial<Record<Department, number>> = {};
  for (const s of sorted) {
    byDept[s.dept] = (byDept[s.dept] ?? 0) + 1;
  }

  const dayIndex = date.getDay(); // 0=Sun..6=Sat
  const dayShortLabel = DAY_SHORT[dayIndex]!.toUpperCase();
  const dayLongLabel = DAY_LONG[dayIndex]!;
  const dayNum = date.getDate();

  return (
    <View
      style={[
        styles.cluster,
        {
          backgroundColor: isToday
            ? withOpacity(theme.colors.brandOrange, 0.05)
            : theme.colors.card,
          borderColor: isToday ? withOpacity(theme.colors.brandOrange, 0.35) : theme.colors.border,
        },
      ]}
    >
      {/* Day header */}
      <View
        style={[
          styles.clusterHeader,
          !empty && { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
        ]}
      >
        <View style={styles.clusterHeaderLeft}>
          <Text style={[styles.dayShort, { color: theme.colors.mutedForeground }]}>
            {dayShortLabel}
          </Text>
          <Text
            style={[
              styles.dayNum,
              { color: isToday ? theme.colors.brandOrange : theme.colors.foreground },
            ]}
          >
            {dayNum}.
          </Text>
          <Text style={[styles.dayLong, { color: theme.colors.mutedForeground }]}>
            {dayLongLabel}
          </Text>
          {isToday && (
            <View style={[styles.todayBadge, { backgroundColor: theme.colors.brandOrange }]}>
              <Text style={styles.todayBadgeText}>I DAG</Text>
            </View>
          )}
          {(meIn && !scope) || (meIn && scope.kind !== "me") ? (
            <View
              style={[
                styles.duJobberBadge,
                { backgroundColor: withOpacity(theme.colors.brandOrange, 0.16) },
              ]}
            >
              <Text style={[styles.duJobberBadgeText, { color: theme.colors.brandOrange }]}>
                DU JOBBER
              </Text>
            </View>
          ) : null}
        </View>

        {!empty && (
          <View style={styles.clusterHeaderRight}>
            {/* Dept density mini-pills */}
            {showCrew && (
              <View style={styles.deptPills}>
                {(Object.entries(byDept) as [Department, number][]).map(([dept, cnt]) => {
                  const col =
                    (DEPT_COLORS[dept as keyof typeof DEPT_COLORS] as string | undefined) ??
                    theme.colors.brandOrange;
                  return (
                    <View
                      key={dept}
                      style={[styles.deptPill, { backgroundColor: withOpacity(col, 0.22) }]}
                    >
                      <Text style={[styles.deptPillText, { color: col }]}>{cnt}</Text>
                    </View>
                  );
                })}
              </View>
            )}
            <Text style={[styles.shiftCount, { color: theme.colors.mutedForeground }]}>
              {shifts.length}
            </Text>
          </View>
        )}
      </View>

      {/* Body */}
      {empty ? (
        <View style={styles.emptyDay}>
          <Text style={[styles.emptyDayText, { color: theme.colors.mutedForeground }]}>
            Ingen vakter.
          </Text>
        </View>
      ) : (
        <View style={styles.clusterBody}>
          {sorted.map((s) => {
            const isOwn = s.owner === myProfileId;
            return (
              <CompactShiftRow
                key={s.id}
                shift={{
                  id: s.id,
                  type: "shift",
                  date: s.date,
                  title: s.title,
                  time: s.time,
                  dept: s.dept,
                  status: "upcoming",
                  role: s.role,
                  zone: s.zone ?? undefined,
                  isShiftLead: s.isShiftLead,
                  planned: s.planned,
                  owner: s.owner,
                }}
                showCrew={showCrew}
                isOwn={isOwn}
                ownerInitials={s.ownerInitials}
                ownerName={s.ownerName}
                ownerColor={s.ownerColor}
                onPress={() => {
                  void Haptics.selectionAsync();
                  onTap(s.id);
                }}
              />
            );
          })}
        </View>
      )}
    </View>
  );
}

/* ── ShiftListScreen ─────────────────────────────────────────────────────── */

export default function ShiftListScreen() {
  const styles2 = useScreenStyles();
  const theme = useTheme();
  const router = useRouter();

  const { data: profile } = useMyProfile();
  const myProfileId = profile?.profile_id ?? null;
  // Workspace timezone for day-boundary calculations (BLOCKING-3 / F-09).
  const tz = (profile?.workspace as { timezone?: string } | null)?.timezone ?? FALLBACK_TZ;

  // Scope state — default to "me" (own shifts)
  const [scope, setScope] = useState<Scope>({ kind: "me" });
  // Keep previous scope kind for telemetry delta
  const prevScopeKind = useRef<ScopeKind>("me");

  // Compute weekStart and todayStr in workspace tz, not device tz (BLOCKING-3).
  const weekStart = useMemo(() => mondayOf(new Date(), tz), [tz]);
  const todayStr = useMemo(() => {
    const z = toZonedTime(new Date(), tz);
    const y = z.getFullYear();
    const mo = String(z.getMonth() + 1).padStart(2, "0");
    const d = String(z.getDate()).padStart(2, "0");
    return `${y}-${mo}-${d}`;
  }, [tz]);

  const {
    data: shifts = [],
    isLoading,
    error,
  } = useTeamShifts({
    weekStart,
    scope,
    myProfileId,
  });

  // Fetch the full active workspace staff list independent of the current scope.
  // useTeamStaff() queries profile directly so Ansatt-dropdown always shows
  // every team member — not just those visible in the filtered shift list (ADR-0367).
  const { data: staff = [] } = useTeamStaff();

  const staffById = useCallback(
    (id: string): StaffShape | undefined => staff.find((s) => s.id === id),
    [staff],
  );

  // Telemetry: emit scope_changed on selection change (ADR-0134).
  const handleScopeChange = useCallback((newScope: Scope) => {
    const from = prevScopeKind.current;
    const to = newScope.kind;
    prevScopeKind.current = to;

    void Haptics.selectionAsync();
    setScope(newScope);

    // Fire-and-forget: resolve profile context then emit
    void (async () => {
      try {
        const { profileId, workspaceId } = await getProfileContext();
        void emit({
          event: "calendar scope_changed",
          workspace_id: workspaceId,
          actor_id: profileId,
          properties: {
            data: { from, to },
          },
        });
      } catch {
        // Non-critical — telemetry failure must not affect UX (ADR-0134 §non-blocking)
      }
    })();
  }, []);

  const handleShiftTap = useCallback(
    (id: string) => {
      void Haptics.selectionAsync();
      router.push({ pathname: "/(app)/(shifts)/[id]", params: { id } });
    },
    [router],
  );

  // All 7 days of the current week
  const days = useMemo(() => weekDays(weekStart), [weekStart]);

  // Shifts grouped by ISO date string for fast cluster lookup
  const shiftsByDate = useMemo(() => {
    const map = new Map<string, typeof shifts>();
    for (const s of shifts) {
      const key = s.shiftDate;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return map;
  }, [shifts]);

  const totalCount = shifts.length;
  const hoursTotal = useMemo(() => totalHours(shifts), [shifts]);

  return (
    <SafeAreaView
      style={[styles2.container, { backgroundColor: theme.colors.background }]}
      edges={["top"]}
    >
      {/* Header */}
      <View style={styles2.header}>
        <Text style={[styles2.headerTitle, { color: theme.colors.foreground }]}>Vaktliste</Text>
      </View>

      {/* ScopeChips — scroll-horizontal row with Avdeling + Ansatt dropdowns */}
      <ScopeChips scope={scope} onChange={handleScopeChange} staff={staff} />

      <ScrollView
        contentContainerStyle={styles2.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ScopeSummary card */}
        <ScopeSummary
          scope={scope}
          count={totalCount}
          hours={hoursTotal}
          weekStart={weekStart}
          staffById={staffById}
        />

        {/* Loading skeleton */}
        {isLoading && (
          <View style={styles2.loadingHint}>
            <Text style={[styles2.loadingText, { color: theme.colors.mutedForeground }]}>
              Laster vakter…
            </Text>
          </View>
        )}

        {/* Error state */}
        {!isLoading && error && (
          <View style={styles2.errorHint}>
            <Text style={[styles2.errorText, { color: theme.colors.destructive }]}>
              Kunne ikke laste vakter. Prøv igjen.
            </Text>
          </View>
        )}

        {/* DayCrewCluster — alle 7 dager, selv tomme (handoff §4.4 spec) */}
        {!isLoading &&
          !error &&
          days.map((day) => {
            const key = day.toISOString().split("T")[0]!;
            const dayShifts = shiftsByDate.get(key) ?? [];
            return (
              <DayCrewCluster
                key={key}
                date={day}
                todayStr={todayStr}
                myProfileId={myProfileId}
                scope={scope}
                shifts={dayShifts}
                onTap={handleShiftTap}
              />
            );
          })}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ── StyleSheet ─────────────────────────────────────────────────────────── */

const useScreenStyles = createStyles((theme) => ({
  container: {
    flex: 1,
  },
  header: {
    height: 50,
    paddingHorizontal: 16,
    justifyContent: "center" as const,
  },
  headerTitle: {
    fontSize: 22,
    fontStyle: "italic" as const,
    fontWeight: "300" as const,
    letterSpacing: -0.5,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 120,
    paddingTop: 4,
  },
  loadingHint: {
    paddingVertical: 24,
    alignItems: "center" as const,
  },
  loadingText: {
    fontSize: 13,
  },
  errorHint: {
    paddingVertical: 24,
    alignItems: "center" as const,
  },
  errorText: {
    fontSize: 13,
  },
}));

const styles = StyleSheet.create({
  /* ScopeSummary */
  summaryCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: 14,
    marginBottom: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  summaryOverline: {
    fontSize: 10.5,
    letterSpacing: 1.4,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  summaryTitle: {
    fontSize: 22,
    fontStyle: "italic",
    fontWeight: "300",
    letterSpacing: -0.3,
    marginTop: 2,
  },
  summaryRight: {
    alignItems: "flex-end",
  },
  summaryCount: {
    fontSize: 22,
    fontWeight: "700",
    fontFamily: "GeistMono-Regular",
    letterSpacing: -0.5,
  },
  summaryCountSub: {
    fontSize: 13,
    fontWeight: "400",
  },
  summaryHours: {
    fontSize: 11.5,
    fontFamily: "GeistMono-Regular",
    marginTop: 2,
  },

  /* DayCrewCluster */
  cluster: {
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  clusterHeader: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  clusterHeaderLeft: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    flexWrap: "nowrap",
  },
  clusterHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dayShort: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  dayNum: {
    fontSize: 24,
    fontStyle: "italic",
    fontWeight: "300",
    letterSpacing: -0.5,
    lineHeight: 28,
  },
  dayLong: {
    fontSize: 12,
  },
  todayBadge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 5,
  },
  todayBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.3,
    color: "#ffffff",
  },
  duJobberBadge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 5,
  },
  duJobberBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.3,
  },
  deptPills: {
    flexDirection: "row",
    gap: 3,
  },
  deptPill: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 5,
  },
  deptPillText: {
    fontSize: 10,
    fontWeight: "700",
    fontFamily: "GeistMono-Regular",
  },
  shiftCount: {
    fontSize: 11,
    fontFamily: "GeistMono-Regular",
  },
  emptyDay: {
    padding: 14,
  },
  emptyDayText: {
    fontSize: 12.5,
  },
  clusterBody: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    gap: 4,
  },
});
