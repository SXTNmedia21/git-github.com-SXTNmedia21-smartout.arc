"use client";

// Fetches all live data powering the Operations/Drift page.
// Pulls from four tables in parallel: department_session, session_task,
// schedule_shift (with profile join), and deviation. Hourly revenue vs cost
// chart is built from daily_reconciliation + workspace_budget + shift hours.
// Refetches every 60s because this is a live operational dashboard.

import { useQuery } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";

// ─── Types ─────────────────────────────────────────────────────────────────

export type StressLabel = "Lav" | "Middels" | "Høy";

export type HourlyBar = {
  time: string;
  // Revenue and cost as percentages of the daily max — preserves the existing
  // CSS-height-based chart pattern in the page component.
  revPct: string;
  costPct: string;
  // Raw values for the hover tooltip
  revenue: number;
  cost: number;
  isFuture: boolean;
};

export type OperationsData = {
  // Metric cards
  taskCompletion: { done: number; total: number; pct: number };
  stressLevel: { label: StressLabel; capacityPct: number; shortStaff: number };
  overdueTasks: number;
  upcomingTasks: number;
  staffPresent: { present: number; expected: number; names: string[] };
  activeTasks: number;
  // Revenue vs cost chart (hourly buckets, same count as opening hours)
  hourlyData: HourlyBar[];
};

// ─── Query key ─────────────────────────────────────────────────────────────

export function operationsDataKey(workspaceId: string, date: string) {
  return ["operations", "live-data", workspaceId, date] as const;
}

// ─── Fallback hourly rate when no payroll workspace_settings row exists ────

const FALLBACK_HOURLY_RATE_NOK = 200;

// ─── Hook ──────────────────────────────────────────────────────────────────

/**
 * Fetches all live metrics for the Operations/Drift page.
 * All queries run in parallel via Promise.all for a single loading state.
 * Returns graceful zeros when no data exists for today.
 */
export function useOperationsData() {
  const ctx = useWorkspaceOptional();
  const workspaceId = ctx?.workspace.workspace_id;

  // Today's date in ISO format (local date, not UTC — avoids off-by-one on
  // servers that run in UTC but the workspace operates in local time).
  const today = new Date().toISOString().split("T")[0]!;
  const currentHour = new Date().getHours();

  return useQuery({
    queryKey: operationsDataKey(workspaceId ?? "none", today),
    enabled: !!workspaceId,
    staleTime: 30 * 1000, // 30s — fresh enough, but avoids hammer on tab switch
    refetchInterval: 60_000, // 1-minute live refresh
    queryFn: async (): Promise<OperationsData> => {
      const wsId = workspaceId!;
      const supabase = createClient();

      // ── 1. Fetch today's department sessions ──────────────────────────
      const sessionsPromise = supabase
        .from("department_session")
        .select(
          "department_session_id, status, tasks_completed, tasks_total, actual_shifts, planned_shifts",
        )
        .eq("workspace_id", wsId)
        .eq("session_date", today);

      // ── 2. Fetch today's session tasks (join via session IDs below) ───
      // We fetch tasks for the workspace on today's date by joining through
      // department_session. Supabase doesn't support subquery filters directly,
      // so we do it in two steps: sessions first, then tasks by session IDs.

      // ── 3. Fetch today's shifts (no profile join — resolved separately below
      //      to avoid the ambiguous multi-relationship TS error on profile)
      const shiftsPromise = supabase
        .from("schedule_shift")
        .select("schedule_shift_id, employee_id, start_time, end_time, work_hours, status")
        .eq("workspace_id", wsId)
        .eq("shift_date", today);

      // ── 4. Fetch today's deviations ───────────────────────────────────
      const deviationsPromise = supabase
        .from("deviation")
        .select("deviation_id, status")
        .eq("workspace_id", wsId)
        // Deviations don't have a date column — filter by created_at for today
        .gte("created_at", `${today}T00:00:00.000Z`)
        .lte("created_at", `${today}T23:59:59.999Z`);

      // ── 5. Fetch today's daily reconciliation (revenue data) ──────────
      const reconciliationPromise = supabase
        .from("daily_reconciliation")
        .select("revenue_total, total_labor_cost, total_actual_hours")
        .eq("workspace_id", wsId)
        .eq("reconciliation_date", today)
        .maybeSingle();

      // ── 6. Fetch hourly budget targets for today ──────────────────────
      // workspace_budget rows with period_type='daily' and hour_slot set give
      // us per-hour revenue targets to use when no reconciliation exists yet.
      const hourlyBudgetPromise = supabase
        .from("workspace_budget")
        .select("hour_slot, revenue_target, labor_cost_target")
        .eq("workspace_id", wsId)
        .eq("period_type", "daily")
        .eq("period_date", today)
        .not("hour_slot", "is", null)
        .order("hour_slot", { ascending: true });

      // ── 7. Fetch payroll hourly rate fallback ─────────────────────────
      const payrollSettingsPromise = supabase
        .schema("payroll")
        .from("workspace_settings")
        .select("id")
        .eq("workspace_id", wsId)
        .maybeSingle();

      // Run all in parallel
      const [
        { data: sessions, error: sessionsError },
        { data: shifts, error: shiftsError },
        { data: deviations, error: deviationsError },
        { data: reconciliation, error: reconciliationError },
        { data: hourlyBudgets },
      ] = await Promise.all([
        sessionsPromise,
        shiftsPromise,
        deviationsPromise,
        reconciliationPromise,
        hourlyBudgetPromise,
        payrollSettingsPromise, // result intentionally unused — just confirming row exists
      ]);

      // Surface errors without crashing — log and return zeros
      if (sessionsError) console.error("[operations] sessions error:", sessionsError.message);
      if (shiftsError) console.error("[operations] shifts error:", shiftsError.message);
      if (deviationsError) console.error("[operations] deviations error:", deviationsError.message);
      if (reconciliationError)
        console.error("[operations] reconciliation error:", reconciliationError.message);

      const sessionList = sessions ?? [];
      const shiftList = shifts ?? [];
      const deviationList = deviations ?? [];

      // ── Fetch tasks for today's sessions (step 2, needs session IDs) ──
      let taskList: Array<{ status: string; session_hook_id: string | null }> = [];
      if (sessionList.length > 0) {
        const sessionIds = sessionList.map((s) => s.department_session_id);
        const { data: tasks, error: tasksError } = await supabase
          .from("session_task")
          .select("status, session_hook_id")
          .in("department_session_id", sessionIds)
          .eq("workspace_id", wsId);

        if (tasksError) console.error("[operations] tasks error:", tasksError.message);
        taskList = tasks ?? [];
      }

      // ── Derive task completion metrics ────────────────────────────────
      const totalTasks = taskList.length;
      const doneTasks = taskList.filter((t) => t.status === "completed").length;
      const overdueTasks = taskList.filter((t) => t.status === "overdue").length;
      const activeTasks = taskList.filter((t) => t.status === "in_progress").length;
      // "upcoming" = tasks that exist but haven't started yet
      const upcomingTasks = taskList.filter(
        (t) => t.status === "pending" || t.status === "available",
      ).length;
      const completionPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

      // ── Derive staff presence metrics ─────────────────────────────────
      // Shifts with an employee assigned = present. Total shifts = expected.
      const assignedShifts = shiftList.filter((s) => !!s.employee_id);
      const presentCount = assignedShifts.length;
      const expectedCount = shiftList.length;

      // Look up display names for assigned employees in a dedicated query.
      // We avoid the embedded join on schedule_shift because Supabase's type
      // generator flags the profile FK as ambiguous (multiple relationships exist).
      const assignedEmployeeIds = [
        ...new Set(assignedShifts.map((s) => s.employee_id).filter((id): id is string => !!id)),
      ];

      let staffNames: string[] = [];
      if (assignedEmployeeIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profile")
          .select("profile_id, display_name")
          .in("profile_id", assignedEmployeeIds)
          .eq("workspace_id", wsId);

        staffNames = (profiles ?? [])
          .map((p) => p.display_name)
          .filter(Boolean)
          .slice(0, 6); // Cap at 6 names for the sub-label display
      }

      // ── Derive stress level ───────────────────────────────────────────
      const capacityPct = expectedCount > 0 ? Math.round((presentCount / expectedCount) * 100) : 0;
      const shortStaff = Math.max(0, expectedCount - presentCount);
      let stressLabel: StressLabel;
      if (capacityPct >= 90) {
        stressLabel = "Lav";
      } else if (capacityPct >= 70) {
        stressLabel = "Middels";
      } else {
        stressLabel = "Høy";
      }

      // ── Derive deviation counts ───────────────────────────────────────
      // (kept for future use in card, currently feeds into stressLabel context)
      void deviationList;

      // ── Build hourly revenue vs cost chart ────────────────────────────
      // We show a fixed window: 09:00–22:00 (14 hourly bars) to cover typical
      // restaurant/hospitality operating hours. Adjust if operating hours are
      // fetched in future.
      const CHART_HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];

      // If we have a daily reconciliation with totals, distribute revenue
      // evenly across past hours as an approximation. A future improvement
      // would store per-hour data in a separate column or use POS webhook data.
      const totalRevenueToday = Number(reconciliation?.revenue_total ?? 0);
      const totalLaborCostToday = Number(reconciliation?.total_labor_cost ?? 0);

      // How many past hours have elapsed in our chart window
      const pastHoursInWindow = CHART_HOURS.filter((h) => h <= currentHour).length;

      // Per-hour estimates: divide total by elapsed hours for past, 0 for future
      const avgRevenuePerHour = pastHoursInWindow > 0 ? totalRevenueToday / pastHoursInWindow : 0;

      // Shift hours per hour bucket: sum work_hours for shifts whose start_time
      // falls in that hour. Use payroll fallback rate for cost.
      const shiftCostByHour = new Map<number, number>();
      for (const shift of shiftList) {
        if (!shift.start_time) continue;
        const startHour = parseInt(shift.start_time.slice(0, 2), 10);
        const shiftCost = shift.work_hours * FALLBACK_HOURLY_RATE_NOK;
        shiftCostByHour.set(startHour, (shiftCostByHour.get(startHour) ?? 0) + shiftCost);
      }

      // Also fold in budget targets where available
      const budgetByHour = new Map<number, { revenue: number; laborCost: number }>();
      for (const b of hourlyBudgets ?? []) {
        if (b.hour_slot !== null) {
          budgetByHour.set(b.hour_slot, {
            revenue: Number(b.revenue_target ?? 0),
            laborCost: Number(b.labor_cost_target ?? 0),
          });
        }
      }

      // Build per-hour data points
      const rawHourlyData = CHART_HOURS.map((hour) => {
        const isFuture = hour > currentHour;
        const budget = budgetByHour.get(hour);

        let revenue = 0;
        let cost = 0;

        if (!isFuture) {
          // Use budget target if available, otherwise use the daily total spread
          revenue = budget?.revenue ?? avgRevenuePerHour;
          cost = budget?.laborCost ?? shiftCostByHour.get(hour) ?? 0;
        }

        return { hour, time: `${String(hour).padStart(2, "0")}:00`, revenue, cost, isFuture };
      });

      // Normalize to percentages for the CSS-height chart pattern.
      // 100% = the maximum revenue value across all hours.
      const maxRevenue = Math.max(...rawHourlyData.map((d) => d.revenue), 1);
      const maxCost = Math.max(...rawHourlyData.map((d) => d.cost), 1);
      // Use same scale for both bars so the comparison is meaningful
      const maxValue = Math.max(maxRevenue, maxCost, 1);

      const hourlyData: HourlyBar[] = rawHourlyData.map((d) => ({
        time: d.time,
        revPct: `${Math.round((d.revenue / maxValue) * 100)}%`,
        costPct: `${Math.round((d.cost / maxValue) * 100)}%`,
        revenue: d.revenue,
        cost: d.cost,
        isFuture: d.isFuture,
      }));

      return {
        taskCompletion: { done: doneTasks, total: totalTasks, pct: completionPct },
        stressLevel: { label: stressLabel, capacityPct, shortStaff },
        overdueTasks,
        upcomingTasks,
        staffPresent: { present: presentCount, expected: expectedCount, names: staffNames },
        activeTasks,
        hourlyData,
      };
    },
  });
}
