"use client";

// ============================================
// CockpitPrepStrip.tsx
// 7-day preparation horizon — shows staffing,
// revenue targets, and reservation counts for
// each of the next 7 days. Sits below the drift
// section in the unified dashboard.
// ============================================

import { useMemo } from "react";
import { Users, Utensils, Target } from "lucide-react";
import {
  useStaffingCoverage,
  getCurrentWeekStart,
} from "@/app/dashboard/_hooks/use-staffing-coverage";
import { useBudget } from "@/app/dashboard/_hooks/use-budget";
import { useQuery } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";

const DAYS_NO = ["Søn", "Man", "Tir", "Ons", "Tor", "Fre", "Lør"];

function getNext7Days(): Array<{
  date: string;
  label: string;
  dayName: string;
  isToday: boolean;
  isWeekend: boolean;
}> {
  const days: Array<{
    date: string;
    label: string;
    dayName: string;
    isToday: boolean;
    isWeekend: boolean;
  }> = [];
  const now = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const dayOfWeek = d.getDay();
    days.push({
      date: dateStr,
      label: `${d.getDate()}/${d.getMonth() + 1}`,
      dayName: DAYS_NO[dayOfWeek] ?? "",
      isToday: i === 0,
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
    });
  }
  return days;
}

function useReservationCounts(dates: string[]) {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;

  return useQuery({
    queryKey: ["dashboard", "prep-reservations", wsId, dates[0]],
    enabled: !!wsId && dates.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("schedule_day_booking")
        .select("shift_date, guest_count")
        .eq("workspace_id", wsId!)
        .gte("shift_date", dates[0]!)
        .lte("shift_date", dates[dates.length - 1]!)
        .neq("status", "cancelled");

      const countsByDate: Record<string, { bookings: number; guests: number }> = {};
      for (const row of data ?? []) {
        const existing = countsByDate[row.shift_date] ?? { bookings: 0, guests: 0 };
        existing.bookings += 1;
        existing.guests += (row.guest_count as number) ?? 0;
        countsByDate[row.shift_date] = existing;
      }
      return countsByDate;
    },
  });
}

export function CockpitPrepStrip() {
  const days = useMemo(() => getNext7Days(), []);
  const weekStart = getCurrentWeekStart();
  const { data: coverage } = useStaffingCoverage(weekStart);
  const { budgets: budget } = useBudget({
    periodType: "daily",
    startDate: days[0]?.date ?? "",
    endDate: days[6]?.date ?? "",
  });
  const { data: reservations } = useReservationCounts(days.map((d) => d.date));

  // Map coverage data to date-keyed lookup
  const coverageByDate = useMemo(() => {
    const map: Record<string, { fillPercent: number; assigned: number; total: number }> = {};
    if (coverage) {
      for (const day of coverage) {
        map[day.date] = {
          fillPercent: day.fillPercent,
          assigned: day.assignedShifts,
          total: day.totalShifts,
        };
      }
    }
    return map;
  }, [coverage]);

  // Map budget data to date-keyed lookup
  const budgetByDate = useMemo(() => {
    const map: Record<string, number> = {};
    if (budget) {
      for (const entry of budget) {
        if (entry.revenue_target) {
          map[entry.period_date] = entry.revenue_target;
        }
      }
    }
    return map;
  }, [budget]);

  return (
    <div>
      <div className="grid grid-cols-7 gap-2">
        {days.map((day, i) => {
          const cov = coverageByDate[day.date];
          const rev = budgetByDate[day.date];
          const res = reservations?.[day.date];
          const fillPct = cov?.fillPercent ?? 0;
          const fillColor =
            fillPct >= 100
              ? "text-[var(--success)]" // success green
              : fillPct >= 80
                ? "text-[var(--warning)]" // warning amber
                : fillPct > 0
                  ? "text-destructive"
                  : "text-muted-foreground/30";

          return (
            <div
              key={day.date}
              className={`group relative overflow-hidden rounded-xl border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                day.isToday
                  ? "border-brand-orange/25 bg-brand-orange/5 shadow-[0_0_20px_-6px_var(--brand-orange)/15%]"
                  : day.isWeekend
                    ? "border-border/30 bg-muted/40 backdrop-blur-sm"
                    : "border-border/20 bg-card/50 backdrop-blur-sm"
              }`}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              {/* Top accent bar for today */}
              {day.isToday && <div className="bg-brand-orange/60 absolute inset-x-0 top-0 h-0.5" />}

              <div className="space-y-2 p-2.5">
                {/* Day header */}
                <div className="text-center">
                  <div
                    className={`text-[10px] font-bold tracking-wide ${day.isToday ? "text-brand-orange" : "text-muted-foreground/60"}`}
                  >
                    {day.dayName}
                  </div>
                  <div
                    className={`font-heading text-lg leading-none ${day.isToday ? "text-foreground" : "text-foreground/70"}`}
                  >
                    {day.label}
                  </div>
                </div>

                {/* Staffing */}
                <div className="flex items-center justify-center gap-1">
                  <Users className={`h-3 w-3 ${fillColor}`} />
                  <span className={`text-[10px] font-bold tabular-nums ${fillColor}`}>
                    {cov ? `${cov.assigned}/${cov.total}` : "—"}
                  </span>
                </div>

                {/* Revenue target */}
                {rev ? (
                  <div className="flex items-center justify-center gap-1">
                    <Target className="text-muted-foreground/40 h-3 w-3" />
                    <span className="text-muted-foreground/60 text-[10px] font-medium tabular-nums">
                      {Math.round(rev / 1000)}k
                    </span>
                  </div>
                ) : null}

                {/* Reservations */}
                {res && res.bookings > 0 ? (
                  <div className="flex items-center justify-center gap-1">
                    <Utensils className="text-muted-foreground/40 h-3 w-3" />
                    <span className="text-muted-foreground/60 text-[10px] font-medium tabular-nums">
                      {res.guests} gj
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
