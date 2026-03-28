"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";

/**
 * Calculates 90-day staff turnover rate.
 * Formula: (profiles moved to inactive/offboarding in 90 days) / (avg active profiles) x 100
 */
export function useStaffTurnover() {
  const { workspace } = useWorkspace();
  const supabase = createClient();
  const wsId = workspace.workspace_id;

  return useQuery({
    queryKey: ["staff-turnover", wsId],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const today = new Date();
      const ninetyDaysAgo = new Date(today);
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const cutoff = ninetyDaysAgo.toISOString();

      const [departedResult, activeResult] = await Promise.all([
        supabase
          .from("profile")
          .select("profile_id", { count: "exact", head: true })
          .eq("workspace_id", wsId)
          .in("status", ["inactive", "offboarding"])
          .gte("updated_at", cutoff),
        supabase
          .from("profile")
          .select("profile_id", { count: "exact", head: true })
          .eq("workspace_id", wsId)
          .in("status", ["active", "trainee"]),
      ]);

      const departed = departedResult.count ?? 0;
      const activeNow = activeResult.count ?? 0;
      const avgActive = activeNow + departed / 2;
      const rate = avgActive > 0 ? (departed / avgActive) * 100 : 0;

      return {
        rate: Math.round(rate * 10) / 10,
        departed,
        activeNow,
        periodDays: 90,
      };
    },
  });
}
