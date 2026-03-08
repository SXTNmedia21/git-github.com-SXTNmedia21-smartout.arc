"use client";

/**
 * Employee week view showing published shifts in a vertical day-by-day layout.
 * Connected to: use-my-shifts.ts, DashboardContext
 *
 * UI Events:
 * - nav: week navigation (prev/next buttons)
 * - color-regime: today highlight (orange border), past days (muted)
 */

import { useContext, useState, useMemo } from "react";
import { Calendar, ChevronLeft, ChevronRight, Clock, MapPin, Loader2 } from "lucide-react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { useMyScheduleShifts, type MyScheduleShift } from "../_hooks/use-my-shifts";

function getWeekRange(offset: number) {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7) + offset * 7);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  return { weekStart: fmt(monday), weekEnd: fmt(sunday) };
}

function getDaysInWeek(weekStart: string): string[] {
  const start = new Date(weekStart + "T00:00:00");
  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    );
  }
  return days;
}

const DAY_NAMES_NO: Record<number, string> = {
  0: "Son",
  1: "Man",
  2: "Tir",
  3: "Ons",
  4: "Tor",
  5: "Fre",
  6: "Lor",
};

function formatDateLabel(dateStr: string): { weekday: string; day: string; month: string } {
  const d = new Date(dateStr + "T00:00:00");
  return {
    weekday: DAY_NAMES_NO[d.getDay()] ?? "",
    day: String(d.getDate()),
    month: d.toLocaleDateString("nb-NO", { month: "short" }),
  };
}

function formatWeekLabel(weekStart: string): string {
  const d = new Date(weekStart + "T00:00:00");
  const oneJan = new Date(d.getFullYear(), 0, 1);
  const weekNum = Math.ceil(
    ((d.getTime() - oneJan.getTime()) / 86400000 + oneJan.getDay() + 1) / 7,
  );
  return `Uke ${weekNum}`;
}

export function MyWeekView() {
  const { isDark, profileId } = useContext(DashboardContext);
  const [weekOffset, setWeekOffset] = useState(0);

  const { weekStart, weekEnd } = useMemo(() => getWeekRange(weekOffset), [weekOffset]);
  const days = useMemo(() => getDaysInWeek(weekStart), [weekStart]);

  const { data: shifts, isLoading } = useMyScheduleShifts(profileId, weekStart, weekEnd);

  const today = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }, []);

  const shiftsByDay = useMemo(() => {
    const map = new Map<string, MyScheduleShift[]>();
    for (const s of shifts ?? []) {
      const existing = map.get(s.date) ?? [];
      existing.push(s);
      map.set(s.date, existing);
    }
    return map;
  }, [shifts]);

  const totalHours = useMemo(
    () => (shifts ?? []).reduce((sum, s) => sum + s.workHours, 0),
    [shifts],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1
          className={`mb-1 text-3xl font-extrabold tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}
        >
          Min Vaktplan
        </h1>
        <p className={`text-sm ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
          Dine publiserte vakter for kommende dager.
        </p>
      </div>

      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekOffset((o) => o - 1)}
            className={`rounded-lg border p-2 transition-colors ${
              isDark
                ? "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-white"
                : "border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300 hover:text-zinc-900"
            }`}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <button
            onClick={() => setWeekOffset(0)}
            className={`rounded-lg border px-3 py-2 text-sm font-bold transition-colors ${
              weekOffset === 0
                ? isDark
                  ? "border-orange-500/30 bg-orange-500/10 text-orange-400"
                  : "border-orange-200 bg-orange-50 text-orange-600"
                : isDark
                  ? "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700"
                  : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"
            }`}
          >
            I dag
          </button>

          <button
            onClick={() => setWeekOffset((o) => o + 1)}
            className={`rounded-lg border p-2 transition-colors ${
              isDark
                ? "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-white"
                : "border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300 hover:text-zinc-900"
            }`}
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          <span
            className={`ml-2 text-sm font-semibold ${isDark ? "text-zinc-300" : "text-zinc-700"}`}
          >
            {formatWeekLabel(weekStart)}
          </span>
        </div>

        {/* Week summary */}
        <div className="flex items-center gap-3">
          <div
            className={`rounded-lg border px-3 py-1.5 text-xs font-bold ${
              isDark
                ? "border-zinc-800 bg-zinc-900 text-zinc-300"
                : "border-zinc-200 bg-zinc-50 text-zinc-700"
            }`}
          >
            <Calendar className="mr-1.5 inline-block h-3.5 w-3.5" />
            {(shifts ?? []).length} vakter
          </div>
          <div
            className={`rounded-lg border px-3 py-1.5 text-xs font-bold ${
              isDark
                ? "border-zinc-800 bg-zinc-900 text-zinc-300"
                : "border-zinc-200 bg-zinc-50 text-zinc-700"
            }`}
          >
            <Clock className="mr-1.5 inline-block h-3.5 w-3.5" />
            {totalHours}t
          </div>
        </div>
      </div>

      {/* Loading state */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2
            className={`h-6 w-6 animate-spin ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
          />
          <span className={`ml-3 text-sm ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
            Laster vakter...
          </span>
        </div>
      ) : (
        /* Day rows */
        <div className="space-y-2">
          {days.map((dateStr) => {
            const label = formatDateLabel(dateStr);
            const dayShifts = shiftsByDay.get(dateStr) ?? [];
            const isToday = dateStr === today;
            const isPast = dateStr < today;

            return (
              <div
                key={dateStr}
                className={`group rounded-xl border p-4 transition-colors ${
                  isToday
                    ? isDark
                      ? "border-orange-500/30 bg-orange-500/5"
                      : "border-orange-200 bg-orange-50/50"
                    : isDark
                      ? "border-zinc-800 bg-[#0c0c0e] hover:border-zinc-700"
                      : "border-zinc-200 bg-white hover:border-zinc-300"
                } ${isPast ? "opacity-60" : ""}`}
              >
                <div className="flex items-start gap-4">
                  {/* Day label */}
                  <div
                    className={`flex w-14 flex-col items-center pt-0.5 ${
                      isToday ? "text-orange-500" : isDark ? "text-zinc-400" : "text-zinc-500"
                    }`}
                  >
                    <span className="text-[10px] font-bold uppercase">{label.weekday}</span>
                    <span className="text-lg font-black">{label.day}</span>
                    <span className="text-[10px] font-semibold">{label.month}</span>
                  </div>

                  {/* Divider */}
                  <div
                    className={`mt-1 h-12 w-px ${
                      isToday ? "bg-orange-500/30" : isDark ? "bg-zinc-800" : "bg-zinc-200"
                    }`}
                  />

                  {/* Shifts for this day */}
                  <div className="flex-1">
                    {dayShifts.length > 0 ? (
                      <div className="space-y-2">
                        {dayShifts.map((shift) => (
                          <div
                            key={shift.id}
                            className={`flex items-center justify-between rounded-lg border px-3 py-2 ${
                              isDark
                                ? "border-zinc-800 bg-zinc-900/50"
                                : "border-zinc-100 bg-zinc-50"
                            }`}
                          >
                            <div>
                              <span
                                className={`text-sm font-bold ${isDark ? "text-white" : "text-zinc-900"}`}
                              >
                                {shift.role}
                              </span>
                              {shift.departmentName && (
                                <span
                                  className={`ml-2 text-xs font-medium ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
                                >
                                  <MapPin className="mr-0.5 inline-block h-3 w-3" />
                                  {shift.departmentName}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-sm font-semibold ${
                                  isToday
                                    ? "text-orange-500"
                                    : isDark
                                      ? "text-zinc-300"
                                      : "text-zinc-700"
                                }`}
                              >
                                <Clock className="mr-1 inline-block h-3.5 w-3.5" />
                                {shift.startTime} - {shift.endTime}
                              </span>
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                  isDark ? "bg-zinc-800 text-zinc-400" : "bg-zinc-100 text-zinc-500"
                                }`}
                              >
                                {shift.workHours}t
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div
                        className={`flex items-center py-3 text-xs font-medium ${
                          isDark ? "text-zinc-600" : "text-zinc-400"
                        }`}
                      >
                        Ingen vakt
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
