"use client";

import { useQuery } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { dashboardKeys } from "./dashboard-keys";
import type { PipelineData } from "./dashboard-types";

/**
 * Fetches workforce pipeline data: active staff, new hires, departures, onboarding.
 * 4 parallel count queries.
 * Connected to: StrategicView pipeline widget, ActivityView people count
 */
export function useWorkforcePipeline() {
  const ctx = useWorkspaceOptional();
  const workspaceId = ctx?.workspace.workspace_id;

  return useQuery({
    queryKey: dashboardKeys.workforcePipeline(workspaceId ?? "none"),
    enabled: !!workspaceId,
    staleTime: 5 * 60 * 1000, // 5 minutes — semi-stable workforce pipeline
    queryFn: async (): Promise<PipelineData> => {
      const wsId = workspaceId!;
      const supabase = createClient();
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const [activeStaff, newHires, departures, onboarding] = await Promise.all([
        // Active profiles
        supabase
          .from("profile")
          .select("*", { count: "exact", head: true })
          .eq("workspace_id", wsId)
          .eq("is_active", true),

        // New hires in last 30 days
        supabase
          .from("profile")
          .select("*", { count: "exact", head: true })
          .eq("workspace_id", wsId)
          .gte("joined_at", thirtyDaysAgo),

        // Departures in last 30 days (inactive profiles recently updated)
        supabase
          .from("profile")
          .select("*", { count: "exact", head: true })
          .eq("workspace_id", wsId)
          .eq("status", "offboarding")
          .gte("updated_at", thirtyDaysAgo),

        // Currently onboarding
        supabase
          .from("profile")
          .select("*", { count: "exact", head: true })
          .eq("workspace_id", wsId)
          .eq("status", "trainee"),
      ]);

      return {
        activeStaff: activeStaff.count ?? 0,
        newHires30d: newHires.count ?? 0,
        departures30d: departures.count ?? 0,
        onboarding: onboarding.count ?? 0,
      };
    },
  });
}
