"use client";

/**
 * useShiftClockConfig.ts — Fetches the cascading shift_clock_config for the
 * current workspace, optionally filtered by department and team.
 *
 * Resolution order (most specific wins): team > department > workspace.
 * The query fetches all matching levels and picks the most specific row
 * by ordering non-null team_id and department_id first.
 *
 * Connected to: ShiftClock UI components, useShiftClock hook
 */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import type { GPSConfig } from "@smartout/shift-clock";

type ShiftClockConfig = {
  gpsConfig: GPSConfig;
  adhocShiftsEnabled: boolean;
  adhocRequiresApproval: boolean;
  punchWindowMinutes: number;
};

export const shiftClockKeys = {
  config: (workspaceId: string, departmentId?: string, teamId?: string) =>
    ["shift-clock-config", workspaceId, departmentId, teamId] as const,

  activeEntry: (profileId: string) => ["shift-clock-active-entry", profileId] as const,
};

export function useShiftClockConfig(departmentId?: string, teamId?: string) {
  const { workspace } = useWorkspace();

  return useQuery<ShiftClockConfig | null>({
    queryKey: shiftClockKeys.config(workspace.workspace_id, departmentId, teamId),
    queryFn: async () => {
      const supabase = createClient();

      // Build OR filter for cascading resolution — most specific first
      const conditions = [
        "and(team_id.is.null,department_id.is.null)", // workspace-level fallback
      ];
      if (departmentId) {
        conditions.unshift(`and(team_id.is.null,department_id.eq.${departmentId})`);
      }
      if (teamId && departmentId) {
        conditions.unshift(`and(team_id.eq.${teamId},department_id.eq.${departmentId})`);
      }

      const { data, error } = await supabase
        .from("shift_clock_config")
        .select("*")
        .eq("workspace_id", workspace.workspace_id)
        .or(conditions.join(","))
        .order("team_id", { nullsFirst: false })
        .order("department_id", { nullsFirst: false })
        .limit(1);

      if (error) throw error;
      const config = data?.[0];
      if (!config) return null;

      return {
        gpsConfig: {
          required: config.gps_required,
          radiusMeters: config.gps_radius_meters,
          referenceLat: config.gps_reference_lat ? Number(config.gps_reference_lat) : null,
          referenceLng: config.gps_reference_lng ? Number(config.gps_reference_lng) : null,
        },
        adhocShiftsEnabled: config.adhoc_shifts_enabled,
        adhocRequiresApproval: config.adhoc_requires_approval,
        punchWindowMinutes: config.punch_window_minutes,
      };
    },
    staleTime: 5 * 60 * 1000, // Config rarely changes — 5 min cache
  });
}
