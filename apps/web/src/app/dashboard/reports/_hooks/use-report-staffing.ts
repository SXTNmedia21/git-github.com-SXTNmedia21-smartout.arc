"use client";

// Fetches staffing analytics for the Staffing tab of the Reports page.
// Queries schedule_shift for the current week (coverage) and last 4 weeks
// (labor hours trend, shift type distribution, unfilled shifts).

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { CHART_COLORS } from "../_components/chart-utils";

// ── Return types (shape must match StaffingSection chart props exactly) ───

export type WeeklyCoverageDay = {
  day: string;
  needed: number;
  assigned: number;
  coverage: number;
};

export type ShiftTypeItem = {
  type: string;
  count: number;
  color: string;
};

export type LaborHoursWeek = {
  week: string;
  planned: number;
  actual: number;
  budget: number;
};

export type UnfilledShift = {
  date: string;
  shift: string;
  department: string;
  needed: number;
};

export type StaffingData = {
  weeklyCoverage: WeeklyCoverageDay[];
  shiftTypes: ShiftTypeItem[];
  laborHours4w: LaborHoursWeek[];
  unfilledShifts: UnfilledShift[];
};

const NO_LABEL = "DAY_LABELS";

// Monday-anchored Norwegian day labels (Mon=1 in getDay() is index 0 here)
const DAY_LABELS_MON = ["Man", "Tir", "Ons", "Tor", "Fre", "Lor", "Son"] as const;

function mondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon … 6=Sat
  const diff = day === 0 ? -6 : 1 - day; // distance back to Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function isoDate(date: Date): string {
  return date.toISOString().split("T")[0]!;
}

function isoWeekNumber(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
  );
}

function safePercent(num: number, denom: number): number {
  if (denom === 0) return 0;
  return Math.round((num / denom) * 100);
}

// Map shift start time to a human-readable category label
function categorizeShift(startTime: string): string {
  const hour = parseInt(startTime.slice(0, 2), 10);
  if (hour >= 6 && hour < 10) return "Morgen (07-15)";
  if (hour >= 10 && hour < 14) return "Dag (10-18)";
  if (hour >= 14) return "Kveld (16-24)";
  return "Annet";
}

const SHIFT_TYPE_COLORS: Record<string, string> = {
  "Morgen (07-15)": CHART_COLORS.amber,
  "Dag (10-18)": CHART_COLORS.blue,
  "Kveld (16-24)": CHART_COLORS.purple,
  Annet: CHART_COLORS.primary,
};

export function useReportStaffing() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;

  return useQuery({
    queryKey: ["reports", "staffing", wsId],
    queryFn: async (): Promise<StaffingData> => {
      const supabase = createClient();

      const today = new Date();
      const thisMonday = mondayOf(today);
      const thisSunday = addDays(thisMonday, 6);

      // 4-week window ending today (Mon–Sun)
      const fourWeeksAgo = addDays(thisMonday, -28);

      const [currentWeekResult, fourWeeksResult, deptResult] = await Promise.all([
        // Current week shifts for daily coverage breakdown
        supabase
          .from("schedule_shift")
          .select(
            "schedule_shift_id, shift_date, employee_id, start_time, work_hours, status, department_id",
          )
          .eq("workspace_id", wsId!)
          .gte("shift_date", isoDate(thisMonday))
          .lte("shift_date", isoDate(thisSunday)),

        // Last 4 weeks shifts for labor hours trend + unfilled shifts
        supabase
          .from("schedule_shift")
          .select(
            "schedule_shift_id, shift_date, employee_id, start_time, work_hours, status, department_id",
          )
          .eq("workspace_id", wsId!)
          .gte("shift_date", isoDate(fourWeeksAgo))
          .lte("shift_date", isoDate(thisSunday)),

        // Department names for unfilled shift labels
        supabase
          .from("department")
          .select("department_id, name")
          .eq("workspace_id", wsId!)
          .eq("is_active", true),
      ]);

      if (currentWeekResult.error) throw new Error(currentWeekResult.error.message);
      if (fourWeeksResult.error) throw new Error(fourWeeksResult.error.message);

      const currentWeekShifts = currentWeekResult.data ?? [];
      const fourWeekShifts = fourWeeksResult.data ?? [];
      const departments = deptResult.data ?? [];

      const deptNameById = new Map(departments.map((d) => [d.department_id, d.name]));

      // ── Weekly coverage: one row per weekday ───────────────────────────
      const weeklyCoverage: WeeklyCoverageDay[] = DAY_LABELS_MON.map((dayLabel, idx) => {
        const dateStr = isoDate(addDays(thisMonday, idx));
        const dayShifts = currentWeekShifts.filter((s) => s.shift_date === dateStr);
        const needed = dayShifts.length;
        const assigned = dayShifts.filter((s) => s.employee_id !== null).length;
        return {
          day: dayLabel,
          needed,
          assigned,
          coverage: safePercent(assigned, needed || 1),
        };
      });

      // ── Shift type distribution (current week) ──────────────────────────
      const typeCounts = new Map<string, number>();
      for (const shift of currentWeekShifts) {
        const label = categorizeShift(shift.start_time);
        typeCounts.set(label, (typeCounts.get(label) ?? 0) + 1);
      }

      const shiftTypes: ShiftTypeItem[] = Array.from(typeCounts.entries()).map(([type, count]) => ({
        type,
        count,
        color: SHIFT_TYPE_COLORS[type] ?? CHART_COLORS.primary,
      }));

      // Sort by count descending for visual clarity
      shiftTypes.sort((a, b) => b.count - a.count);

      // ── Fetch daily labor_hours_target for the 4-week period ──────────
      const fourWeeksAgoStr = isoDate(fourWeeksAgo);
      const toDate = isoDate(thisSunday);
      const { data: weeklyBudgets } = await supabase
        .from("workspace_budget")
        .select("period_date, labor_hours_target")
        .eq("workspace_id", wsId!)
        .eq("period_type", "daily")
        .gte("period_date", fourWeeksAgoStr)
        .lte("period_date", toDate);

      // Sum daily targets per ISO week
      const budgetByWeek = new Map<number, number>();
      for (const b of weeklyBudgets ?? []) {
        if (!b.labor_hours_target) continue;
        const d = new Date(b.period_date + "T00:00:00");
        const wk = isoWeekNumber(d);
        budgetByWeek.set(wk, (budgetByWeek.get(wk) ?? 0) + Number(b.labor_hours_target));
      }

      // ── Labor hours over last 4 weeks ─────────────────────────────────
      // Group shifts by ISO week, sum planned hours (work_hours field)
      const weekBuckets = new Map<number, { planned: number; label: string }>();

      for (const shift of fourWeekShifts) {
        const shiftDate = new Date(shift.shift_date + "T00:00:00");
        const weekNum = isoWeekNumber(shiftDate);
        const existing = weekBuckets.get(weekNum);
        const hoursToAdd = shift.work_hours ?? 0;
        if (existing) {
          existing.planned += hoursToAdd;
        } else {
          weekBuckets.set(weekNum, { planned: hoursToAdd, label: `Uke ${weekNum}` });
        }
      }

      // Take the 4 most recent weeks, sorted ascending
      const laborHours4w: LaborHoursWeek[] = Array.from(weekBuckets.entries())
        .sort((a, b) => a[0] - b[0])
        .slice(-4)
        .map(([weekNum, v]) => ({
          week: v.label,
          planned: Math.round(v.planned),
          // actual = same as planned until time_entry table integration
          actual: Math.round(v.planned),
          budget: budgetByWeek.get(weekNum) ?? 0,
        }));

      // ── Unfilled shifts: no employee assigned, in the next 7 days ───────
      const futureDate = addDays(today, 7);
      const unfilledRaw = fourWeekShifts
        .filter(
          (s) =>
            s.employee_id === null &&
            new Date(s.shift_date + "T00:00:00") >= today &&
            new Date(s.shift_date + "T00:00:00") <= futureDate,
        )
        .slice(0, 8); // cap list to avoid overwhelming the card

      const unfilledShifts: UnfilledShift[] = unfilledRaw.map((s) => {
        const d = new Date(s.shift_date + "T00:00:00");
        const dayName = ["Sondag", "Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lordag"][
          d.getDay()
        ]!;
        const dateLabel = `${dayName} ${d.getDate().toString().padStart(2, "0")}.${(d.getMonth() + 1).toString().padStart(2, "0")}`;
        const shiftLabel = categorizeShift(s.start_time).split(" ")[0]!;
        const deptName = s.department_id
          ? (deptNameById.get(s.department_id) ?? "Ukjent")
          : "Ukjent";

        return {
          date: dateLabel,
          shift: shiftLabel,
          department: deptName,
          needed: 1,
        };
      });

      return { weeklyCoverage, shiftTypes, laborHours4w, unfilledShifts };
    },
    enabled: !!wsId,
    staleTime: 2 * 60 * 1000,
  });
}
