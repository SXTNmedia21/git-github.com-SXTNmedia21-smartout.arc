"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";

/**
 * Calculates absence rate for the workspace over a rolling 30-day window.
 * Formula: (approved absence days) / (total planned shift days) x 100
 */
export function useAbsenceRate() {
  const { workspace } = useWorkspace();
  const supabase = createClient();
  const wsId = workspace.workspace_id;

  return useQuery({
    queryKey: ["absence-rate", wsId],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const today = new Date();
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const fromDate = thirtyDaysAgo.toISOString().split("T")[0]!;
      const toDate = today.toISOString().split("T")[0]!;

      const [absenceResult, shiftResult] = await Promise.all([
        supabase
          .from("schedule_absence")
          .select("schedule_absence_id", { count: "exact", head: true })
          .eq("workspace_id", wsId)
          .eq("status", "approved")
          .gte("shift_date", fromDate)
          .lte("shift_date", toDate),
        supabase
          .from("schedule_shift")
          .select("schedule_shift_id", { count: "exact", head: true })
          .eq("workspace_id", wsId)
          .gte("shift_date", fromDate)
          .lte("shift_date", toDate),
      ]);

      const absenceDays = absenceResult.count ?? 0;
      const totalShiftDays = shiftResult.count ?? 0;
      const rate = totalShiftDays > 0 ? (absenceDays / totalShiftDays) * 100 : 0;

      return {
        rate: Math.round(rate * 10) / 10,
        absenceDays,
        totalShiftDays,
        periodDays: 30,
      };
    },
  });
}
