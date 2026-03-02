"use client";

import { useQuery } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { dashboardKeys } from "./dashboard-keys";
import type { DepartmentShiftGroup } from "./dashboard-types";

/**
 * Fetches shifts for a given date with position->department joins.
 * Groups by department for the reconciliation card view.
 * Connected to: ReconciliationView department cards
 */
export function useDepartmentShifts(date: string) {
  const ctx = useWorkspaceOptional();
  const workspaceId = ctx?.workspace.workspace_id;

  return useQuery({
    queryKey: dashboardKeys.departmentShifts(workspaceId ?? "none", date),
    enabled: !!workspaceId,
    queryFn: async (): Promise<DepartmentShiftGroup[]> => {
      const wsId = workspaceId!;
      const supabase = createClient();

      const { data, error } = await supabase
        .from("schedule_shift")
        .select(
          `
          schedule_shift_id,
          employee_id,
          role,
          start_time,
          end_time,
          work_hours,
          status,
          position:position_id (
            position_id,
            name,
            department:department_id (
              department_id,
              name,
              color
            )
          )
        `,
        )
        .eq("workspace_id", wsId)
        .eq("shift_date", date)
        .order("start_time", { ascending: true });

      if (error) throw error;

      // Group by department
      const deptMap = new Map<
        string,
        {
          departmentId: string;
          departmentName: string;
          departmentColor: string | null;
          shifts: DepartmentShiftGroup["shifts"];
          totalHours: number;
        }
      >();

      for (const shift of data ?? []) {
        const position = shift.position as unknown as {
          position_id: string;
          name: string;
          department: { department_id: string; name: string; color: string | null } | null;
        } | null;

        const deptId = position?.department?.department_id ?? "unassigned";
        const deptName = position?.department?.name ?? "Unassigned";
        const deptColor = position?.department?.color ?? null;

        if (!deptMap.has(deptId)) {
          deptMap.set(deptId, {
            departmentId: deptId,
            departmentName: deptName,
            departmentColor: deptColor,
            shifts: [],
            totalHours: 0,
          });
        }

        const group = deptMap.get(deptId)!;
        group.shifts.push({
          shiftId: shift.schedule_shift_id,
          employeeName: null, // Would need profile join for name
          employeeId: shift.employee_id,
          role: shift.role,
          startTime: shift.start_time,
          endTime: shift.end_time,
          workHours: shift.work_hours,
          status: shift.status,
        });
        group.totalHours += shift.work_hours;
      }

      return Array.from(deptMap.values()).map((group) => ({
        ...group,
        staffCount: new Set(group.shifts.map((s) => s.employeeId).filter(Boolean)).size,
      }));
    },
  });
}
