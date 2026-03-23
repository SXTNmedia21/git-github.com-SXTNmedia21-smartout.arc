"use client";

// Fetches all data needed for the Overview tab of the Reports page.
// Runs four parallel queries against profile, schedule_shift,
// protocol_assignment, and department, then shapes the results
// into the same structure the OverviewSection charts expect.

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspaceOptional } from "@/lib/workspace-context";

// ── Return types (must match OverviewSection chart props exactly) ─────────

export type OverviewKpi = {
  label: string;
  value: string | number;
  change: string;
  direction: "up" | "down";
  colorKey: "purple" | "emerald" | "blue" | "orange";
};

export type TrendDay = {
  day: string;
  beredskap: number;
  dekning: number;
  opplaering: number;
};

export type DepartmentStat = {
  name: string;
  employees: number;
  coverage: number;
  readiness: number;
  training: number;
  color: string;
};

export type TopInsight = {
  label: string;
  value: string;
  detail: string;
};

export type OverviewData = {
  kpis: OverviewKpi[];
  trend7d: TrendDay[];
  departmentStats: DepartmentStat[];
  insights: TopInsight[];
};

// Norwegian day abbreviations for the 7-day trend x-axis
const DAY_LABELS = ["Son", "Man", "Tir", "Ons", "Tor", "Fre", "Lor"] as const;

// Fallback color palette when a department has no color set
const DEPT_COLORS = ["#f97316", "#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#f43f5e"];

function safePercent(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

export function useReportOverview() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;

  return useQuery({
    queryKey: ["reports", "overview", wsId],
    queryFn: async (): Promise<OverviewData> => {
      const supabase = createClient();

      // Build date range for the 7-day trend window
      const today = new Date();
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(today.getDate() - 6);
      const startDate = sevenDaysAgo.toISOString().split("T")[0]!;
      const endDate = today.toISOString().split("T")[0]!;

      // All four queries run in parallel — no cascading waterfalls
      const [profilesResult, shiftsResult, assignmentsResult, departmentsResult] =
        await Promise.all([
          supabase
            .from("profile")
            .select("profile_id, status, department_id")
            .eq("workspace_id", wsId!),

          supabase
            .from("schedule_shift")
            .select("schedule_shift_id, shift_date, status, department_id, employee_id")
            .eq("workspace_id", wsId!)
            .gte("shift_date", startDate)
            .lte("shift_date", endDate),

          supabase
            .from("protocol_assignment")
            .select("assignment_id, status, profile_id, protocol_id")
            .in("status", ["pending", "completed", "expired"]),

          // workspace filtering is via the profile_id FK; we filter in memory
          // after joining to profiles from this workspace
          supabase
            .from("department")
            .select("department_id, name, color")
            .eq("workspace_id", wsId!)
            .eq("is_active", true)
            .order("sort_order", { ascending: true }),
        ]);

      if (profilesResult.error) throw new Error(profilesResult.error.message);
      if (shiftsResult.error) throw new Error(shiftsResult.error.message);
      if (departmentsResult.error) throw new Error(departmentsResult.error.message);
      // protocol_assignment has no workspace_id column — tolerate its error gracefully
      const assignments = assignmentsResult.error ? [] : (assignmentsResult.data ?? []);

      const profiles = profilesResult.data ?? [];
      const shifts = shiftsResult.data ?? [];
      const departments = departmentsResult.data ?? [];

      // Build a set of profile_ids that belong to this workspace so we can
      // filter protocol_assignment rows (table has no workspace_id column)
      const workspaceProfileIds = new Set(profiles.map((p) => p.profile_id));
      const wsAssignments = assignments.filter((a) => workspaceProfileIds.has(a.profile_id));

      // ── KPI calculations ────────────────────────────────────────────────

      const activeProfiles = profiles.filter(
        (p) => p.status === "active" || p.status === "trainee",
      );

      const totalAssignments = wsAssignments.length;
      const completedAssignments = wsAssignments.filter((a) => a.status === "completed").length;
      const readinessPct = safePercent(completedAssignments, totalAssignments);

      // Vaktdekning: shifts with employee assigned vs total shifts this week
      const assignedShifts = shifts.filter((s) => s.employee_id !== null).length;
      const coveragePct = safePercent(assignedShifts, shifts.length || 1);

      // Opplæring: same as readiness for now (protocol_assignment has no is_required field)
      const trainingPct = readinessPct;

      const kpis: OverviewKpi[] = [
        {
          label: "Ansatte",
          value: activeProfiles.length,
          change: `${profiles.length} totalt`,
          direction: "up",
          colorKey: "purple",
        },
        {
          label: "Beredskap",
          value: totalAssignments > 0 ? `${readinessPct}%` : "–",
          change:
            totalAssignments > 0
              ? `${completedAssignments}/${totalAssignments} fullfort`
              : "Ingen data",
          direction: readinessPct >= 70 ? "up" : "down",
          colorKey: "emerald",
        },
        {
          label: "Vaktdekning",
          value: shifts.length > 0 ? `${coveragePct}%` : "–",
          change: shifts.length > 0 ? `${assignedShifts}/${shifts.length} vakter` : "Ingen vakter",
          direction: coveragePct >= 80 ? "up" : "down",
          colorKey: "blue",
        },
        {
          label: "Opplaering",
          value: totalAssignments > 0 ? `${trainingPct}%` : "–",
          change: totalAssignments > 0 ? `${completedAssignments} fullfort` : "Ingen data",
          direction: trainingPct >= 60 ? "up" : "down",
          colorKey: "orange",
        },
      ];

      // ── 7-Day trend — one data point per day ────────────────────────────
      // We derive coverage per day from actual shift data.
      // Readiness and training are workspace-level (they don't change daily)
      // so we project a flat line at the current value with slight variance.
      const trend7d: TrendDay[] = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(sevenDaysAgo);
        d.setDate(sevenDaysAgo.getDate() + i);
        const dateStr = d.toISOString().split("T")[0]!;
        const dayLabel = DAY_LABELS[d.getDay()]!;

        const dayShifts = shifts.filter((s) => s.shift_date === dateStr);
        const dayAssigned = dayShifts.filter((s) => s.employee_id !== null).length;
        const dayDekning = safePercent(dayAssigned, dayShifts.length || 1);

        // Use workspace-level readiness as the steady base — no day-level data available
        return {
          day: dayLabel,
          beredskap: readinessPct,
          dekning: dayShifts.length > 0 ? dayDekning : coveragePct,
          opplaering: trainingPct,
        };
      });

      // ── Department stats ─────────────────────────────────────────────────
      const departmentStats: DepartmentStat[] = departments.map((dept, idx) => {
        const deptProfiles = profiles.filter((p) => p.department_id === dept.department_id);
        const deptAssignments = wsAssignments.filter((a) =>
          deptProfiles.some((p) => p.profile_id === a.profile_id),
        );
        const deptCompleted = deptAssignments.filter((a) => a.status === "completed").length;
        const deptShifts = shifts.filter((s) => s.department_id === dept.department_id);
        const deptAssigned = deptShifts.filter((s) => s.employee_id !== null).length;

        return {
          name: dept.name,
          employees: deptProfiles.length,
          coverage: safePercent(deptAssigned, deptShifts.length || 1),
          readiness: safePercent(deptCompleted, deptAssignments.length || 1),
          training: safePercent(deptCompleted, deptAssignments.length || 1),
          color: dept.color ?? DEPT_COLORS[idx % DEPT_COLORS.length]!,
        };
      });

      // ── Quick insights ────────────────────────────────────────────────────
      const insights: TopInsight[] = [];

      if (departmentStats.length > 0) {
        const highestReadiness = [...departmentStats].sort((a, b) => b.readiness - a.readiness)[0]!;
        const lowestTraining = [...departmentStats].sort((a, b) => a.training - b.training)[0]!;
        const mostEmployees = [...departmentStats].sort((a, b) => b.employees - a.employees)[0]!;

        insights.push(
          {
            label: "Hoyest beredskap",
            value: highestReadiness.name,
            detail: `${highestReadiness.readiness}% beredskap`,
          },
          {
            label: "Lavest opplaering",
            value: lowestTraining.name,
            detail: `${lowestTraining.training}% fullfort`,
          },
          {
            label: "Flest ansatte",
            value: mostEmployees.name,
            detail: `${mostEmployees.employees} medarbeidere`,
          },
        );
      }

      // Flag if any protocol has low completion — we surface the worst one
      if (totalAssignments > 0 && readinessPct < 60) {
        insights.push({
          label: "Lav beredskap",
          value: `${readinessPct}%`,
          detail: "Under mal pa 60%",
        });
      }

      // Pad to 4 insights if we have fewer (to keep the grid from collapsing)
      while (insights.length < 4) {
        insights.push({
          label: `Ansatte totalt`,
          value: String(profiles.length),
          detail: `${activeProfiles.length} aktive`,
        });
      }

      return { kpis, trend7d, departmentStats, insights: insights.slice(0, 4) };
    },
    enabled: !!wsId,
    staleTime: 2 * 60 * 1000,
  });
}
