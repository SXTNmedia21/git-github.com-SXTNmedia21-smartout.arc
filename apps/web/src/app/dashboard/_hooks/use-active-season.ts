"use client";

import { useQuery } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { dashboardKeys } from "./dashboard-keys";
import { SEASON_LIFECYCLE_MISSION_ID } from "@smartout/ai";

/**
 * Shape of the season data returned by useActiveSeason.
 * Matches what SeasonCard expects as props.
 */
export type ActiveSeasonData = {
  name: string;
  type: string;
  startDate: string;
  endDate: string;
  currentStage: string;
  stagesCompleted: string[];
};

/** Stage order for the season-lifecycle mission */
const STAGE_ORDER = [
  "seed",
  "revenue",
  "concept",
  "staffing",
  "prepare",
  "ready",
  "running",
  "reflect",
];

/**
 * Fetches the active season and its lifecycle progress.
 * Combines data from the season table (name, dates, type) with
 * the engine_sessions table (current stage for season-lifecycle mission).
 *
 * Returns null when no active/draft season exists.
 */
export function useActiveSeason() {
  const ctx = useWorkspaceOptional();
  const workspaceId = ctx?.workspace.workspace_id;

  return useQuery({
    queryKey: [...dashboardKeys.seasons(workspaceId ?? "none"), "active"],
    enabled: !!workspaceId,
    staleTime: 60 * 1000, // 1 minute — season data is semi-stable
    queryFn: async (): Promise<ActiveSeasonData | null> => {
      const wsId = workspaceId!;
      const supabase = createClient();

      // Get the most recent non-archived season
      const { data: season, error: seasonError } = await supabase
        .from("season")
        .select("season_id, name, season_type, start_date, end_date, status")
        .eq("workspace_id", wsId)
        .in("status", ["active", "draft"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (seasonError || !season) return null;

      // Try to find an active season-lifecycle engine session for this workspace
      const { data: engineSession } = await supabase
        .from("engine_sessions")
        .select("current_stage_id, collected_data")
        .eq("workspace_id", wsId)
        .eq("mission_id", SEASON_LIFECYCLE_MISSION_ID)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Determine current stage from engine session or infer from season status
      let currentStage = "seed";
      if (engineSession?.current_stage_id) {
        currentStage = engineSession.current_stage_id;
      } else if (season.status === "active") {
        // If season is active but no engine session, it's likely in the running stage
        currentStage = "running";
      }

      // All stages before the current one are considered completed
      const currentIndex = STAGE_ORDER.indexOf(currentStage);
      const stagesCompleted = currentIndex > 0 ? STAGE_ORDER.slice(0, currentIndex) : [];

      return {
        name: season.name,
        type: season.season_type,
        startDate: season.start_date ?? "",
        endDate: season.end_date ?? "",
        currentStage,
        stagesCompleted,
      };
    },
  });
}
