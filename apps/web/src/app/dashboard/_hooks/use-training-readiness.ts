"use client";

import { useQuery } from "@tanstack/react-query";
import { useWorkspace } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { dashboardKeys } from "./dashboard-keys";
import type { TrainingReadinessData } from "./dashboard-types";

/**
 * Fetches training readiness data: protocol assignment completion rates.
 * Joins through profile to filter by workspace.
 * Connected to: TacticalView task completion, StrategicView training KPI
 */
export function useTrainingReadiness() {
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;

  return useQuery({
    queryKey: dashboardKeys.trainingReadiness(workspaceId),
    queryFn: async (): Promise<TrainingReadinessData> => {
      const supabase = createClient();

      // Fetch all protocol assignments for workspace profiles
      const { data, error } = await supabase
        .from("protocol_assignment")
        .select("status, profile!inner(workspace_id)")
        .eq("profile.workspace_id", workspaceId);

      if (error) throw error;

      const assignments = data ?? [];
      const total = assignments.length;
      let completed = 0;
      let pending = 0;
      let expired = 0;

      for (const a of assignments) {
        if (a.status === "completed") completed++;
        else if (a.status === "pending") pending++;
        else if (a.status === "expired") expired++;
      }

      return {
        totalAssignments: total,
        completed,
        pending,
        expired,
        readinessPercent: total > 0 ? Math.round((completed / total) * 100) : 100,
      };
    },
  });
}
