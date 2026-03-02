// ============================================
// monthly-view.tsx
// Redesigned monthly calendar view with proper calendar grid,
// day cells showing shift/staff/coverage stats, color-coded
// days, today highlight, monthly stats summary, and shift
// creation from day click.
// Connected to: schedule-types.ts (Shift type)
// Connected to: use-schedule-computed.ts (coverage, stats)
// Connected to: schedule-ui-context.tsx (setCreateShiftContext)
// ============================================
"use client";

import React, { useContext, useMemo, useState, useCallback } from "react";
import {
  Calendar,
  Clock,
  Users,
  TrendingUp,
  AlertTriangle,
  Plus,
  ChevronLeft,
  ChevronRight,
  DollarSign,
} from "lucide-react";

import { DashboardContext } from "@/components/dashboard/DashboardShell";

import type { Shift } from "./schedule-types";
import type { ScheduleComputed, DayStats } from "../_hooks/use-schedule-computed";
import { useScheduleUI } from "./schedule-ui-context";

// ── Day labels ──────────────────────────────────────────────

const DAY_HEADERS = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];
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
  // Simple heuristic: compare staff to a baseline
  // In reality this should use real staffing targets
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
  onDateClick?: (dateLabel: string) => void;
};

/**
 * Redesigned monthly calendar view.
 * Shows a proper calendar grid with coverage-coded day cells,
 * monthly stats summary, and shift creation on day click.
 */
export function MonthlyView({ shifts, computed, onDateClick }: MonthlyViewProps) {
  const { isDark, scheduleDateOffset } = useContext(DashboardContext);
  const scheduleUI = useScheduleUI();

  // Determine which month to show based on the scheduleDateOffset
  const today = useMemo(() => new Date(), []);
  const [monthOffset, setMonthOffset] = useState(0);

  const { year, month } = useMemo(() => {
    const d = new Date(today);
    d.setMonth(d.getMonth() + monthOffset);
    return { year: d.getFullYear(), month: d.getMonth() };
  }, [today, monthOffset]);

  const calendarDays = useMemo(() => getMonthCalendarDays(year, month), [year, month]);

  const todayStr = useMemo(() => formatDateId(new Date()), []);

  // Build shift count map for all dates
  const shiftsByDate = useMemo(() => {
    const map = new Map<string, Shift[]>();
    for (const s of shifts) {
      const existing = map.get(s.dateId) ?? [];
      existing.push(s);
      map.set(s.dateId, existing);
    }
    return map;
  }, [shifts]);

  // Monthly aggregated stats
  const monthlyStats = useMemo(() => {
    const monthDates = calendarDays.filter((d) => d.isCurrentMonth).map((d) => d.dateId);
    let totalShifts = 0;
    let totalHours = 0;
    let totalCost = 0;
    let daysWithCoverage = 0;
    let daysTotal = 0;
    let criticalDays = 0;
    let warningDays = 0;

    for (const dateId of monthDates) {
      const stats = computed.getDayStats(dateId);
      totalShifts += stats.shiftCount;
      totalHours += shifts
        .filter((s) => s.dateId === dateId)
        .reduce((sum, s) => sum + s.workHours, 0);
      totalCost += stats.estimatedCost;

      if (stats.shiftCount > 0) {
        daysTotal++;
        const level = getCoverageLevel(stats);
        if (level === "good") daysWithCoverage++;
        else if (level === "warning") warningDays++;
        else if (level === "critical") criticalDays++;
      }
    }

    const coveragePercent = daysTotal > 0 ? Math.round((daysWithCoverage / daysTotal) * 100) : 0;

    return {
      totalShifts,
      totalHours,
      totalCost,
      coveragePercent,
      criticalDays,
      warningDays,
      daysTotal,
    };
  }, [calendarDays, computed, shifts]);

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
    <div className={`flex h-full w-full flex-col ${isDark ? "bg-[#050505]" : "bg-zinc-50"}`}>
      {/* ── Stats Summary Bar ────────────────────────────────── */}
      <div
        className={`shrink-0 border-b ${isDark ? "border-white/5 bg-[#0a0a0c]/80" : "border-zinc-200 bg-white/90"} sticky top-0 z-30 px-6 py-4`}
      >
        <div className="flex items-center justify-between">
          {/* Month navigation */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMonthOffset((p) => p - 1)}
              className={`rounded-lg p-1.5 transition-colors ${isDark ? "text-zinc-400 hover:bg-white/10" : "text-zinc-500 hover:bg-zinc-100"}`}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-orange-500" />
              <h2
                className={`text-lg font-black tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}
              >
                {MONTH_NAMES[month]} {year}
              </h2>
            </div>
            <button
              onClick={() => setMonthOffset((p) => p + 1)}
              className={`rounded-lg p-1.5 transition-colors ${isDark ? "text-zinc-400 hover:bg-white/10" : "text-zinc-500 hover:bg-zinc-100"}`}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            {monthOffset !== 0 && (
              <button
                onClick={() => setMonthOffset(0)}
                className="text-xs font-bold text-orange-500 hover:text-orange-400"
              >
                I dag
              </button>
            )}
          </div>

          {/* Stats chips */}
          <div className="flex items-center gap-4">
            <StatChip
              icon={<TrendingUp className="h-3.5 w-3.5" />}
              label="Vakter"
              value={String(monthlyStats.totalShifts)}
              isDark={isDark}
            />
            <StatChip
              icon={<Clock className="h-3.5 w-3.5" />}
              label="Timer"
              value={monthlyStats.totalHours.toFixed(0)}
              isDark={isDark}
            />
            <StatChip
              icon={<DollarSign className="h-3.5 w-3.5" />}
              label="Kostnad"
              value={`${(monthlyStats.totalCost / 1000).toFixed(0)}k`}
              isDark={isDark}
            />
            <StatChip
              icon={<Users className="h-3.5 w-3.5" />}
              label="Dekning"
              value={`${monthlyStats.coveragePercent}%`}
              isDark={isDark}
              highlight={
                monthlyStats.coveragePercent < 80
                  ? "warning"
                  : monthlyStats.coveragePercent >= 90
                    ? "good"
                    : undefined
              }
            />
            {monthlyStats.criticalDays > 0 && (
              <StatChip
                icon={<AlertTriangle className="h-3.5 w-3.5" />}
                label="Kritisk"
                value={String(monthlyStats.criticalDays)}
                isDark={isDark}
                highlight="critical"
              />
            )}
          </div>
        </div>
      </div>

      {/* ── Calendar Grid ────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
        {/* Day headers */}
        <div className="mb-1 grid grid-cols-7 gap-1">
          {DAY_HEADERS.map((day, i) => (
            <div
              key={day}
              className={`py-2 text-center text-[11px] font-bold tracking-widest uppercase ${
                i >= 5 ? "text-indigo-400/70" : "text-zinc-500"
              }`}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar cells */}
        <div className="grid flex-1 auto-rows-fr grid-cols-7 gap-1">
          {calendarDays.map((day) => {
            const stats = computed.getDayStats(day.dateId);
            const dayShifts = shiftsByDate.get(day.dateId) ?? [];
            const isToday = day.dateId === todayStr;
            const coverage = getCoverageLevel(stats);
            const isWeekend = day.date.getDay() === 0 || day.date.getDay() === 6;
            const dayNum = day.date.getDate();

            const draftCount = dayShifts.filter(
              (s) => s.status === "created" || s.status === "assigned",
            ).length;
            const publishedCount = dayShifts.filter((s) => s.status === "published").length;

            return (
              <DayCell
                key={day.dateId}
                dateId={day.dateId}
                dayNum={dayNum}
                isCurrentMonth={day.isCurrentMonth}
                isToday={isToday}
                isWeekend={isWeekend}
                coverage={coverage}
                shiftCount={stats.shiftCount}
                staffCount={stats.staffCount}
                draftCount={draftCount}
                publishedCount={publishedCount}
                estimatedCost={stats.estimatedCost}
                isDark={isDark}
                onClick={() => handleDayClick(day.dateId, dayShifts.length > 0)}
                onCreateShift={() => handleCreateShift(day.dateId)}
              />
            );
          })}
        </div>

        {/* Coverage legend */}
        <div className="mt-3 flex items-center justify-center gap-6">
          <LegendItem color="bg-emerald-500" label="Full dekning" />
          <LegendItem color="bg-amber-500" label="Lav dekning" />
          <LegendItem color="bg-rose-500" label="Kritisk" />
        </div>
      </div>
    </div>
  );
}

// ── DayCell ─────────────────────────────────────────────────

function DayCell({
  dateId,
  dayNum,
  isCurrentMonth,
  isToday,
  isWeekend,
  coverage,
  shiftCount,
  staffCount,
  draftCount,
  publishedCount,
  estimatedCost,
  isDark,
  onClick,
  onCreateShift,
}: {
  dateId: string;
  dayNum: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  coverage: CoverageLevel;
  shiftCount: number;
  staffCount: number;
  draftCount: number;
  publishedCount: number;
  estimatedCost: number;
  isDark: boolean;
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

  return (
    <div
      onClick={onClick}
      onContextMenu={handleContextMenu}
      className={`group relative flex min-h-[90px] cursor-pointer flex-col rounded-xl border p-2 transition-all ${
        !isCurrentMonth
          ? `opacity-30 ${isDark ? "border-white/[0.02] bg-transparent" : "border-zinc-200/30 bg-transparent"}`
          : isToday
            ? `border-orange-500/40 ${isDark ? "bg-orange-500/[0.06]" : "bg-orange-50"} shadow-[0_0_20px_-6px_rgba(249,115,22,0.3)]`
            : coverage !== "empty"
              ? `${styles.border} ${styles.bg}`
              : isWeekend
                ? `${isDark ? "border-white/[0.04] bg-indigo-500/[0.02]" : "border-zinc-200/50 bg-indigo-50/30"}`
                : `${isDark ? "border-white/[0.04] bg-white/[0.01]" : "border-zinc-200/50 bg-white"}`
      } ${isDark ? "hover:bg-white/[0.04]" : "hover:bg-zinc-50"}`}
    >
      {/* Day number + today badge */}
      <div className="mb-1 flex items-center justify-between">
        <span
          className={`text-sm font-black ${
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
        {isToday && (
          <span className="rounded-full bg-orange-500 px-1.5 py-0.5 text-[8px] font-black tracking-wider text-white uppercase">
            I dag
          </span>
        )}
        {coverage !== "empty" && !isToday && (
          <div className={`h-1.5 w-1.5 rounded-full ${styles.dot}`} />
        )}
      </div>

      {/* Shift info */}
      {shiftCount > 0 && isCurrentMonth ? (
        <div className="mt-auto space-y-0.5">
          <div className="flex items-center gap-1">
            <Users className={`h-3 w-3 ${isDark ? "text-zinc-500" : "text-zinc-400"}`} />
            <span className={`text-[11px] font-bold ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
              {staffCount}
            </span>
            <span className="text-[10px] text-zinc-500">ansatte</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className={`h-3 w-3 ${isDark ? "text-zinc-500" : "text-zinc-400"}`} />
            <span className={`text-[11px] font-bold ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
              {shiftCount}
            </span>
            <span className="text-[10px] text-zinc-500">vakter</span>
          </div>
          {/* Draft / published indicators */}
          <div className="flex items-center gap-1.5">
            {publishedCount > 0 && (
              <span className="rounded bg-emerald-500/15 px-1 py-0.5 text-[9px] font-bold text-emerald-500">
                {publishedCount} pub
              </span>
            )}
            {draftCount > 0 && (
              <span className="rounded bg-amber-500/15 px-1 py-0.5 text-[9px] font-bold text-amber-500">
                {draftCount} utkast
              </span>
            )}
          </div>
        </div>
      ) : isCurrentMonth ? (
        <div className="mt-auto flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
          <div
            className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
          >
            <Plus className="h-3 w-3" />
            Opprett vakt
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ── Stat Chip ───────────────────────────────────────────────

function StatChip({
  icon,
  label,
  value,
  isDark,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  isDark: boolean;
  highlight?: "good" | "warning" | "critical";
}) {
  const valueColor =
    highlight === "good"
      ? "text-emerald-500"
      : highlight === "warning"
        ? "text-amber-500"
        : highlight === "critical"
          ? "text-rose-500"
          : isDark
            ? "text-white"
            : "text-zinc-900";

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-zinc-500">{icon}</span>
      <div className="flex flex-col">
        <span className="text-[9px] font-bold tracking-wider text-zinc-500 uppercase">{label}</span>
        <span className={`text-sm leading-none font-black ${valueColor}`}>{value}</span>
      </div>
    </div>
  );
}

// ── Legend Item ──────────────────────────────────────────────

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`h-2 w-2 rounded-full ${color}`} />
      <span className="text-[10px] font-medium text-zinc-500">{label}</span>
    </div>
  );
}
