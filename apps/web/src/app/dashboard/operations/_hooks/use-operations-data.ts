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

export type StressLabel = "low" | "medium" | "high";

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

export type HaccpReading = {
  temperature: number;
  is_within_range: boolean;
  logged_at: string;
  ccp_reference: string;
};

export type CleaningStatus = {
  done: number;
  total: number;
};

export type DeviationBreakdown = {
  critical: number;
  high: number;
  medium: number;
  low: number;
  total: number;
};

/** Shape of the joined cleaning task row from the session_task query. */
type CleaningTaskRow = {
  id: string;
  status: string;
  completed_at: string | null;
  session_hook: {
    linked_procedure_id: string;
    procedure: { procedure_type: string } | null;
  } | null;
};

export type OperationsData = {
  // Metric cards
  taskCompletion: { done: number; total: number; pct: number };
  stressLevel: { label: StressLabel; capacityPct: number; shortStaff: number };
  overdueTasks: number;
  upcomingTasks: number;
  staffPresent: { present: number; expected: number; names: string[] };
  openDeviations: number;
  activeTasks: number;
  // Revenue vs cost chart (hourly buckets, same count as opening hours)
  hourlyData: HourlyBar[];
  /** True when labor costs are estimated (no real shift_cost_snapshot data) */
  laborCostEstimated: boolean;

  // HACCP temperature status
  haccpReadings: HaccpReading[];
  haccpStatus: "ok" | "deviation" | "stale" | "none";
  lastHaccpTime: string | null;

  // Cleaning checklist status
  cleaningStatus: CleaningStatus;

  // Deviation severity breakdown
  deviationBreakdown: DeviationBreakdown;
};

// ─── Query key ─────────────────────────────────────────────────────────────

export function operationsDataKey(workspaceId: string, date: string) {
  return ["operations", "live-data", workspaceId, date] as const;
}

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
        .select("deviation_id, status, severity")
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

      // ── 8. Fetch today's HACCP temperature readings ──────────────────
      const haccpPromise = supabase
        .from("haccp_log")
        .select("temperature, is_within_range, logged_at, ccp_reference")
        .eq("workspace_id", wsId)
        .gte("logged_at", `${today}T00:00:00.000Z`)
        .order("logged_at", { ascending: false });

      // ── 9. Fetch today's shift cost snapshots (real labor cost) ───────
      const shiftCostPromise = supabase
        .from("shift_cost_snapshot")
        .select("total_cost, effective_start, base_rate")
        .eq("workspace_id", wsId)
        .gte("effective_start", `${today}T00:00:00.000Z`)
        .lte("effective_start", `${today}T23:59:59.999Z`)
        .eq("basis", "planned");

      // Run all in parallel
      const [
        { data: sessions, error: sessionsError },
        { data: shifts, error: shiftsError },
        { data: deviations, error: deviationsError },
        { data: reconciliation, error: reconciliationError },
        { data: hourlyBudgets },
        ,
        { data: haccpData },
        { data: shiftCosts },
      ] = await Promise.all([
        sessionsPromise,
        shiftsPromise,
        deviationsPromise,
        reconciliationPromise,
        hourlyBudgetPromise,
        payrollSettingsPromise,
        haccpPromise,
        shiftCostPromise,
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

      // ── Prepare data needed for the second batch of queries ──────────
      const assignedShifts = shiftList.filter((s) => !!s.employee_id);
      const presentCount = assignedShifts.length;
      const expectedCount = shiftList.length;
      const assignedEmployeeIds = [
        ...new Set(assignedShifts.map((s) => s.employee_id).filter((id): id is string => !!id)),
      ];
      const sessionIds = sessionList.map((s) => s.department_session_id);

      // ── Second batch: tasks, profiles, cleaning — all depend on first
      //    batch results but are independent of each other ───────────────
      const [taskResult, profileResult, cleaningResult] = await Promise.all([
        // Tasks query (depends on sessionIds)
        sessionIds.length > 0
          ? supabase
              .from("session_task")
              .select("status, session_hook_id")
              .in("department_session_id", sessionIds)
              .eq("workspace_id", wsId)
          : Promise.resolve({ data: null, error: null }),

        // Profile names query (depends on assignedEmployeeIds from shifts)
        assignedEmployeeIds.length > 0
          ? supabase
              .from("profile")
              .select("profile_id, display_name")
              .in("profile_id", assignedEmployeeIds)
              .eq("workspace_id", wsId)
          : Promise.resolve({ data: null, error: null }),

        // Cleaning tasks query (depends on sessionIds)
        sessionIds.length > 0
          ? supabase
              .from("session_task")
              .select(
                "id, status, completed_at, session_hook:session_hook_id(linked_procedure_id, procedure:linked_procedure_id(procedure_type))",
              )
              .in("department_session_id", sessionIds)
              .eq("workspace_id", wsId)
              .not("session_hook_id", "is", null)
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (taskResult.error) console.error("[operations] tasks error:", taskResult.error.message);
      if (profileResult.error)
        console.error("[operations] profiles error:", profileResult.error.message);

      const taskList = taskResult.data ?? [];

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
      const staffNames = (profileResult.data ?? [])
        .map((p) => p.display_name)
        .filter(Boolean)
        .slice(0, 6); // Cap at 6 names for the sub-label display

      // ── Derive stress level ───────────────────────────────────────────
      const capacityPct = expectedCount > 0 ? Math.round((presentCount / expectedCount) * 100) : 0;
      const shortStaff = Math.max(0, expectedCount - presentCount);
      let stressLabel: StressLabel;
      if (capacityPct >= 90) {
        stressLabel = "low";
      } else if (capacityPct >= 70) {
        stressLabel = "medium";
      } else {
        stressLabel = "high";
      }

      // ── Derive cleaning status from cleaning query results ───────────
      // Cleaning tasks are session_task rows linked via session_hook to a
      // procedure with procedure_type = "maintenance".
      const maintenanceTasks = ((cleaningResult.data ?? []) as CleaningTaskRow[]).filter((t) => {
        return t.session_hook?.procedure?.procedure_type === "maintenance";
      });
      const cleaningTotal = maintenanceTasks.length;
      const cleaningDone = maintenanceTasks.filter((t) => t.status === "completed").length;

      // ── Derive HACCP temperature status ──────────────────────────────
      const haccpReadings: HaccpReading[] = (haccpData ?? []).map((r) => ({
        temperature: r.temperature,
        is_within_range: r.is_within_range,
        logged_at: r.logged_at,
        ccp_reference: r.ccp_reference,
      }));
      const latestHaccp = haccpReadings[0];
      let haccpStatus: "ok" | "deviation" | "stale" | "none" = "none";
      let lastHaccpTime: string | null = null;

      if (latestHaccp) {
        lastHaccpTime = latestHaccp.logged_at;
        const hoursSince = (Date.now() - new Date(latestHaccp.logged_at).getTime()) / 3_600_000;
        if (hoursSince > 2) {
          haccpStatus = "stale";
        } else if (haccpReadings.some((r) => !r.is_within_range)) {
          haccpStatus = "deviation";
        } else {
          haccpStatus = "ok";
        }
      }

      // ── Derive deviation counts ───────────────────────────────────────
      const openDeviations = deviationList.filter((d) => d.status !== "resolved").length;

      // ── Derive deviation severity breakdown ──────────────────────────
      const openDevs = deviationList.filter(
        (d) => d.status === "open" || d.status === "acknowledged",
      );
      const deviationBreakdown: DeviationBreakdown = {
        critical: openDevs.filter((d) => d.severity === "critical").length,
        high: openDevs.filter((d) => d.severity === "high").length,
        medium: openDevs.filter((d) => d.severity === "medium").length,
        low: openDevs.filter((d) => d.severity === "low").length,
        total: openDevs.length,
      };

      // ── Build hourly revenue vs cost chart ────────────────────────────
      // We show a fixed window: 09:00–22:00 (14 hourly bars) to cover typical
      // restaurant/hospitality operating hours. Adjust if operating hours are
      // fetched in future.
      const CHART_HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];

      // If we have a daily reconciliation with totals, distribute revenue
      // evenly across past hours as an approximation. A future improvement
      // would store per-hour data in a separate column or use POS webhook data.
      const totalRevenueToday = Number(reconciliation?.revenue_total ?? 0);
      // How many past hours have elapsed in our chart window
      const pastHoursInWindow = CHART_HOURS.filter((h) => h <= currentHour).length;

      // Per-hour estimates: divide total by elapsed hours for past, 0 for future
      const avgRevenuePerHour = pastHoursInWindow > 0 ? totalRevenueToday / pastHoursInWindow : 0;

      // Build real labor cost per hour from shift_cost_snapshot
      const shiftCostByHour = new Map<number, number>();
      const hasRealCosts = (shiftCosts ?? []).some((sc) => sc.base_rate > 0);

      if (hasRealCosts) {
        for (const sc of shiftCosts ?? []) {
          if (!sc.effective_start) continue;
          const startHour = new Date(sc.effective_start).getHours();
          shiftCostByHour.set(startHour, (shiftCostByHour.get(startHour) ?? 0) + sc.total_cost);
        }
      } else {
        // Fallback: estimate from shift hours x 200 NOK
        for (const shift of shiftList) {
          if (!shift.start_time) continue;
          const startHour = parseInt(shift.start_time.slice(0, 2), 10);
          const shiftCost = shift.work_hours * 200;
          shiftCostByHour.set(startHour, (shiftCostByHour.get(startHour) ?? 0) + shiftCost);
        }
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
        openDeviations,
        activeTasks,
        hourlyData,
        laborCostEstimated: !hasRealCosts,
        haccpReadings,
        haccpStatus,
        lastHaccpTime,
        cleaningStatus: { done: cleaningDone, total: cleaningTotal },
        deviationBreakdown,
      };
    },
  });
}
