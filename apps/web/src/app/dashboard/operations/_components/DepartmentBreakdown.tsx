"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Users, AlertTriangle } from "lucide-react";
import { createClient } from "@smartout/supabase/client";

type DepartmentBreakdownProps = {
  workspaceId: string;
};

type DepartmentMetric = {
  departmentId: string;
  departmentName: string;
  staffPresent: number;
  staffExpected: number;
  capacityPct: number;
};

/**
 * Per-department staff capacity breakdown for the operations page.
 * Fetches today's shifts grouped by department and calculates capacity.
 */
export function DepartmentBreakdown({ workspaceId }: DepartmentBreakdownProps) {
  const today = useMemo(() => new Date().toISOString().split("T")[0]!, []);

  const { data: departments } = useQuery({
    queryKey: ["department-breakdown", workspaceId, today],
    staleTime: 60 * 1000,
    refetchInterval: 60_000,
    queryFn: async () => {
      const supabase = createClient();

      // Fetch today's shifts with department info
      const { data: shifts, error } = await supabase
        .from("schedule_shift")
        .select(
          "schedule_shift_id, department_id, employee_id, status, department:department_id(name)",
        )
        .eq("workspace_id", workspaceId)
        .eq("shift_date", today);

      if (error) throw error;
      if (!shifts || shifts.length === 0) return [];

      // Group by department
      const deptMap = new Map<string, DepartmentMetric>();

      for (const shift of shifts) {
        if (!shift.department_id) continue;

        if (!deptMap.has(shift.department_id)) {
          deptMap.set(shift.department_id, {
            departmentId: shift.department_id,
            departmentName:
              (shift.department as unknown as { name: string } | null)?.name ?? shift.department_id, // SAFETY: Supabase join returns union type; runtime shape matches the cast
            staffPresent: 0,
            staffExpected: 0,
            capacityPct: 0,
          });
        }

        const dept = deptMap.get(shift.department_id)!;
        dept.staffExpected++;
        if (shift.employee_id) dept.staffPresent++;
      }

      // Calculate capacity percentages
      for (const dept of deptMap.values()) {
        dept.capacityPct =
          dept.staffExpected > 0 ? Math.round((dept.staffPresent / dept.staffExpected) * 100) : 0;
      }

      // Sort by capacity (lowest first — most stressed departments on top)
      return Array.from(deptMap.values()).sort((a, b) => a.capacityPct - b.capacityPct);
    },
  });

  if (!departments || departments.length === 0) return null;

  return (
    <div className="grid gap-2">
      {departments.map((dept, i) => {
        const isLow = dept.capacityPct < 70;
        const isMid = dept.capacityPct >= 70 && dept.capacityPct < 90;
        return (
          <motion.div
            key={dept.departmentId}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              type: "spring",
              stiffness: 30,
              damping: 24,
              mass: 2.5,
              delay: i * 0.06,
            }}
            className="bg-card flex items-center justify-between rounded-lg border px-4 py-3"
          >
            <div className="flex items-center gap-3">
              {isLow && <AlertTriangle className="text-destructive h-4 w-4" />}
              <span className="font-medium">{dept.departmentName}</span>
            </div>
            <div className="text-muted-foreground flex items-center gap-6 text-sm">
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {dept.staffPresent}/{dept.staffExpected}
              </span>
              <span
                className={
                  isLow
                    ? "text-destructive font-medium"
                    : isMid
                      ? "font-medium text-orange-500"
                      : "text-emerald-500"
                }
              >
                {dept.capacityPct}%
              </span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
