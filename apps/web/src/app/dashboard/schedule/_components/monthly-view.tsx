// ============================================
// monthly-view.tsx
// Monthly calendar view filling full container height.
// Uses scheduleDateOffset from DashboardContext for month navigation.
// Supports Ansatt/Jobb/Team view perspectives via scheduleView.
// Connected to: schedule-types.ts (Shift type)
// Connected to: use-schedule-computed.ts (coverage, stats)
// Connected to: schedule-ui-context.tsx (setCreateShiftContext)
// Connected to: DashboardShell.tsx (scheduleDateOffset, scheduleView)
// ============================================
"use client";

import React, { useContext, useMemo, useCallback } from "react";
import { Clock, Users, Plus, Briefcase, Network } from "lucide-react";

import { DashboardContext, type ScheduleViewMode } from "@/components/dashboard/DashboardShell";

import type { Shift } from "./schedule-types";
import type { ScheduleComputed, DayStats } from "../_hooks/use-schedule-computed";
import type { ScheduleEmployee } from "../_hooks/use-employees";
import { useScheduleUI } from "./schedule-ui-context";

// ── Day labels ──────────────────────────────────────────────

const DAY_HEADERS = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];

// ── Helpers ─────────────────────────────────────────────────

function formatDateId(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getMonthCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Monday = 0 in our grid (ISO week), JS getDay: 0=Sun, 1=Mon...
  const startDayOfWeek = (firstDay.getDay() + 6) % 7; // 0=Mon

  const days: Array<{ date: Date; dateId: string; isCurrentMonth: boolean }> = [];

  // Fill preceding days from previous month
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    days.push({ date: d, dateId: formatDateId(d), isCurrentMonth: false });
  }

  // Current month days
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const date = new Date(year, month, d);
    days.push({ date, dateId: formatDateId(date), isCurrentMonth: true });
  }

  // Fill trailing days to complete the last week
  const remaining = 7 - (days.length % 7);
  if (remaining < 7) {
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      days.push({ date: d, dateId: formatDateId(d), isCurrentMonth: false });
    }
  }

  return days;
}

type CoverageLevel = "good" | "warning" | "critical" | "empty";

function getCoverageLevel(stats: DayStats | undefined): CoverageLevel {
  if (!stats || stats.shiftCount === 0) return "empty";
  if (stats.staffCount >= 4) return "good";
  if (stats.staffCount >= 2) return "warning";
  return "critical";
}

const COVERAGE_STYLES: Record<CoverageLevel, { bg: string; border: string; dot: string }> = {
  good: {
    bg: "bg-emerald-500/8",
    border: "border-emerald-500/20",
    dot: "bg-emerald-500",
  },
  warning: {
    bg: "bg-amber-500/8",
    border: "border-amber-500/20",
    dot: "bg-amber-500",
  },
  critical: {
    bg: "bg-rose-500/8",
    border: "border-rose-500/20",
    dot: "bg-rose-500",
  },
  empty: {
    bg: "",
    border: "border-transparent",
    dot: "",
  },
};

// ── Props ───────────────────────────────────────────────────

type MonthlyViewProps = {
  shifts: Shift[];
  computed: ScheduleComputed;
  employees: ScheduleEmployee[];
  onDateClick?: (dateLabel: string) => void;
};

/**
 * Monthly calendar view that fills 100% of its container.
 * Uses scheduleDateOffset from DashboardContext for month navigation.
 * Supports Ansatt/Jobb/Team view perspectives.
 */
export function MonthlyView({ shifts, computed, employees, onDateClick }: MonthlyViewProps) {
  const { isDark, scheduleDateOffset, scheduleView } = useContext(DashboardContext);
  const scheduleUI = useScheduleUI();

  // Use scheduleDateOffset from DashboardContext for month
  const { year, month } = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + scheduleDateOffset);
    return { year: d.getFullYear(), month: d.getMonth() };
  }, [scheduleDateOffset]);

  const calendarDays = useMemo(() => getMonthCalendarDays(year, month), [year, month]);
  const todayStr = useMemo(() => formatDateId(new Date()), []);
  const weekCount = calendarDays.length / 7;

  // Build shift map and employee map
  const shiftsByDate = useMemo(() => {
    const map = new Map<string, Shift[]>();
    for (const s of shifts) {
      const existing = map.get(s.dateId) ?? [];
      existing.push(s);
      map.set(s.dateId, existing);
    }
    return map;
  }, [shifts]);

  const employeeMap = useMemo(() => {
    const map = new Map<string, ScheduleEmployee>();
    for (const emp of employees) map.set(emp.id, emp);
    return map;
  }, [employees]);

  const handleDayClick = useCallback(
    (dateId: string, hasShifts: boolean) => {
      if (!hasShifts) {
        scheduleUI.setCreateShiftContext({ dateId });
      }
      onDateClick?.(dateId);
    },
    [scheduleUI, onDateClick],
  );

  const handleCreateShift = useCallback(
    (dateId: string) => {
      scheduleUI.setCreateShiftContext({ dateId });
    },
    [scheduleUI],
  );

  return (
    <div className="flex h-full w-full flex-col">
      {/* Day headers */}
      <div className="border-border grid shrink-0 grid-cols-7 gap-px border-b">
        {DAY_HEADERS.map((day, i) => (
          <div
            key={day}
            className={`py-1.5 text-center text-[10px] font-bold tracking-widest uppercase ${
              i >= 5 ? "text-indigo-400/70" : "text-muted-foreground"
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar cells — fills remaining height */}
      <div className="grid min-h-0 flex-1 grid-cols-7 gap-px">
        {calendarDays.map((day) => {
          const stats = computed.getDayStats(day.dateId);
          const dayShifts = shiftsByDate.get(day.dateId) ?? [];
          const isToday = day.dateId === todayStr;
          const coverage = getCoverageLevel(stats);
          const isWeekend = day.date.getDay() === 0 || day.date.getDay() === 6;
          const dayNum = day.date.getDate();

          return (
            <DayCell
              key={day.dateId}
              dayNum={dayNum}
              isCurrentMonth={day.isCurrentMonth}
              isToday={isToday}
              isWeekend={isWeekend}
              coverage={coverage}
              shiftCount={stats.shiftCount}
              staffCount={stats.staffCount}
              dayShifts={dayShifts}
              employeeMap={employeeMap}
              scheduleView={scheduleView}
              isDark={isDark}
              compact={weekCount > 5}
              onClick={() => handleDayClick(day.dateId, dayShifts.length > 0)}
              onCreateShift={() => handleCreateShift(day.dateId)}
            />
          );
        })}
      </div>

      {/* Compact legend */}
      <div className="border-border flex shrink-0 items-center justify-center gap-5 border-t py-1.5">
        <LegendItem color="bg-emerald-500" label="Full dekning" />
        <LegendItem color="bg-amber-500" label="Lav dekning" />
        <LegendItem color="bg-rose-500" label="Kritisk" />
      </div>
    </div>
  );
}

// ── DayCell ─────────────────────────────────────────────────

function DayCell({
  dayNum,
  isCurrentMonth,
  isToday,
  isWeekend,
  coverage,
  shiftCount,
  staffCount,
  dayShifts,
  employeeMap,
  scheduleView,
  isDark,
  compact,
  onClick,
  onCreateShift,
}: {
  dayNum: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  coverage: CoverageLevel;
  shiftCount: number;
  staffCount: number;
  dayShifts: Shift[];
  employeeMap: Map<string, ScheduleEmployee>;
  scheduleView: ScheduleViewMode;
  isDark: boolean;
  compact: boolean;
  onClick: () => void;
  onCreateShift: () => void;
}) {
  const styles = COVERAGE_STYLES[coverage];

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      onCreateShift();
    },
    [onCreateShift],
  );

  // Build perspective-specific content
  const perspectiveContent = useMemo(() => {
    if (dayShifts.length === 0 || !isCurrentMonth) return null;

    if (scheduleView === "jobb") {
      // Group by role
      const roleMap = new Map<string, number>();
      for (const s of dayShifts) {
        roleMap.set(s.role, (roleMap.get(s.role) ?? 0) + 1);
      }
      const entries = Array.from(roleMap.entries()).slice(0, compact ? 2 : 3);
      return entries.map(([role, count]) => (
        <div key={role} className="flex items-center gap-1 truncate">
          <Briefcase
            className={`h-2.5 w-2.5 shrink-0 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
          />
          <span className={`truncate text-[9px] ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
            {count > 1 ? `${count}× ` : ""}
            {role}
          </span>
        </div>
      ));
    }

    if (scheduleView === "team") {
      // Group by team
      const teamMap = new Map<string, number>();
      for (const s of dayShifts) {
        const emp = s.employeeId ? employeeMap.get(s.employeeId) : undefined;
        const team = emp?.team || "Ikke tildelt";
        teamMap.set(team, (teamMap.get(team) ?? 0) + 1);
      }
      const entries = Array.from(teamMap.entries()).slice(0, compact ? 2 : 3);
      return entries.map(([team, count]) => (
        <div key={team} className="flex items-center gap-1 truncate">
          <Network
            className={`h-2.5 w-2.5 shrink-0 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
          />
          <span className={`truncate text-[9px] ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
            {count > 1 ? `${count}× ` : ""}
            {team}
          </span>
        </div>
      ));
    }

    // Default "ansatt" view — show employee names
    const uniqueEmployees = new Map<string, ScheduleEmployee>();
    for (const s of dayShifts) {
      if (s.employeeId) {
        const emp = employeeMap.get(s.employeeId);
        if (emp) uniqueEmployees.set(emp.id, emp);
      }
    }
    const emps = Array.from(uniqueEmployees.values()).slice(0, compact ? 2 : 3);
    const remaining = uniqueEmployees.size - emps.length;

    return (
      <>
        {emps.map((emp) => (
          <div key={emp.id} className="flex items-center gap-1 truncate">
            <div
              className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded text-[6px] font-black ${emp.avatarColor}`}
            >
              {emp.initials}
            </div>
            <span className={`truncate text-[9px] ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
              {emp.name.split(" ")[0]}
            </span>
          </div>
        ))}
        {remaining > 0 && (
          <span className="text-muted-foreground text-[9px]">+{remaining} til</span>
        )}
      </>
    );
  }, [dayShifts, isCurrentMonth, scheduleView, employeeMap, isDark, compact]);

  return (
    <div
      onClick={onClick}
      onContextMenu={handleContextMenu}
      className={`group relative flex cursor-pointer flex-col overflow-hidden border-r border-b p-1.5 transition-colors ${
        !isCurrentMonth
          ? `opacity-30 ${isDark ? "bg-transparent" : "bg-transparent"}`
          : isToday
            ? `${isDark ? "bg-orange-500/[0.06]" : "bg-orange-50"}`
            : coverage !== "empty"
              ? styles.bg
              : isWeekend
                ? `${isDark ? "bg-indigo-500/[0.02]" : "bg-indigo-50/30"}`
                : `${isDark ? "bg-white/[0.01]" : "bg-white"}`
      } ${isDark ? "border-white/[0.04] hover:bg-white/[0.04]" : "border-zinc-100 hover:bg-zinc-50"}`}
    >
      {/* Day number row */}
      <div className="mb-0.5 flex items-center justify-between">
        <span
          className={`text-xs leading-none font-black ${
            isToday
              ? "text-orange-500"
              : !isCurrentMonth
                ? "text-zinc-600"
                : isWeekend
                  ? isDark
                    ? "text-indigo-400"
                    : "text-indigo-600"
                  : isDark
                    ? "text-white"
                    : "text-zinc-900"
          }`}
        >
          {dayNum}
        </span>
        <div className="flex items-center gap-1">
          {isToday && (
            <span className="rounded-full bg-orange-500 px-1 py-px text-[7px] leading-none font-black tracking-wider text-white uppercase">
              I dag
            </span>
          )}
          {coverage !== "empty" && !isToday && (
            <div className={`h-1.5 w-1.5 rounded-full ${styles.dot}`} />
          )}
        </div>
      </div>

      {/* Shift info */}
      {shiftCount > 0 && isCurrentMonth ? (
        <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden">
          {/* Quick stat counts */}
          <div className="flex items-center gap-2 text-[9px] leading-none">
            <span
              className={`flex items-center gap-0.5 font-bold ${isDark ? "text-zinc-400" : "text-zinc-600"}`}
            >
              <Users className="h-2.5 w-2.5" /> {staffCount}
            </span>
            <span
              className={`flex items-center gap-0.5 font-bold ${isDark ? "text-zinc-400" : "text-zinc-600"}`}
            >
              <Clock className="h-2.5 w-2.5" /> {shiftCount}
            </span>
          </div>

          {/* Perspective content */}
          <div className="min-h-0 flex-1 space-y-px overflow-hidden">{perspectiveContent}</div>
        </div>
      ) : isCurrentMonth ? (
        <div className="flex flex-1 items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
          <div
            className={`flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-bold ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
          >
            <Plus className="h-2.5 w-2.5" />
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ── Legend Item ──────────────────────────────────────────────

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`h-1.5 w-1.5 rounded-full ${color}`} />
      <span className="text-muted-foreground text-[9px] font-medium">{label}</span>
    </div>
  );
}
