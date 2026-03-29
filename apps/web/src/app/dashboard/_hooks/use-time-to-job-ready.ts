"use client";

import { useQuery } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";

export type TimeToJobReadyData = {
  averageDays: number;
  sampleSize: number;
};

/**
 * Calculates average days from trainee_started to trainee_completed
 * for profiles in the current workspace that have completed training.
 */
export function useTimeToJobReady() {
  const ctx = useWorkspaceOptional();
  const workspaceId = ctx?.workspace.workspace_id;

  return useQuery({
    queryKey: ["dashboard", "time-to-job-ready", workspaceId ?? "none"],
    enabled: !!workspaceId,
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<TimeToJobReadyData> => {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("profile")
        .select("trainee_started, trainee_completed")
        .eq("workspace_id", workspaceId!)
        .not("trainee_started", "is", null)
        .not("trainee_completed", "is", null);

      if (error) throw error;

      const profiles = data ?? [];
      if (profiles.length === 0) {
        return { averageDays: 0, sampleSize: 0 };
      }

      let totalDays = 0;
      for (const p of profiles) {
        const start = new Date(p.trainee_started!).getTime();
        const end = new Date(p.trainee_completed!).getTime();
        totalDays += (end - start) / (1000 * 60 * 60 * 24);
      }

      return {
        averageDays: Math.round(totalDays / profiles.length),
        sampleSize: profiles.length,
      };
    },
  });
}
