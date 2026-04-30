"use client";

/**
 * Hook for DepartmentRichCard: parallel queries for department details,
 * employee count, today's active session, 7-day deviation count, manager name,
 * and operating hours.
 */

import { useQuery } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { dashboardKeys } from "./dashboard-keys";

export function useDrawerDepartment(departmentId: string) {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const supabase = createClient();

  return useQuery({
    queryKey: dashboardKeys.drawerDepartment(wsId ?? "none", departmentId),
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0]!;
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0]!;

      const [deptRes, employeeCountRes, sessionRes, deviationsRes, hoursRes] = await Promise.all([
        supabase
          .from("department")
          .select(
            "department_id, name, description, is_active, manager_profile_id, color, created_at, manager:profile!manager_profile_id(display_name)",
          )
          .eq("department_id", departmentId)
          .single(),

        supabase
          .from("profile")
          .select("profile_id", { count: "exact", head: true })
          .eq("workspace_id", wsId!)
          .eq("department_id", departmentId)
          .eq("is_active", true),

        supabase
          .from("department_session")
          .select(
            "department_session_id, status, session_date, actual_shifts, tasks_total, tasks_completed",
          )
          .eq("department_id", departmentId)
          .eq("session_date", today)
          .maybeSingle(),

        supabase
          .from("deviation")
          .select("deviation_id, severity, status, title, created_at")
          .eq("department_id", departmentId)
          .gte("created_at", `${sevenDaysAgo}T00:00:00.000Z`)
          .order("created_at", { ascending: false })
          .limit(5),

        supabase
          .from("department_operating_hours")
          .select("day_of_week, open_time, close_time, is_closed")
          .eq("department_id", departmentId)
          .order("day_of_week"),
      ]);

      if (deptRes.error) throw deptRes.error;

      const manager = deptRes.data?.manager as { display_name: string } | null;

      return {
        department: deptRes.data,
        employeeCount: employeeCountRes.count ?? 0,
        managerName: manager?.display_name ?? null,
        todaySession: sessionRes.data,
        recentDeviations: deviationsRes.data ?? [],
        operatingHours: hoursRes.data ?? [],
      };
    },
    enabled: !!wsId && !!departmentId,
    staleTime: 30_000,
  });
}

export type DrawerDepartmentData = ReturnType<typeof useDrawerDepartment>["data"];
