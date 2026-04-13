/**
 * use-season-operating-hours.ts
 * Manages department_operating_hours rows scoped to a specific season.
 * These rows override default (season_id=NULL) hours when a season is active.
 * Connected to: resolve-hours.ts (cascade consumer), SeasonHoursTab.tsx (UI)
 */

"use client";

import { useContext } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { emit } from "@smartout/telemetry";
import { DashboardContext } from "@/components/dashboard/DashboardShell";

import type { Database } from "@smartout/supabase";

type DepartmentOperatingHoursRow =
  Database["public"]["Tables"]["department_operating_hours"]["Row"];
type DepartmentOperatingHoursInsert =
  Database["public"]["Tables"]["department_operating_hours"]["Insert"];

/**
 * Fetches and manages department_operating_hours rows for a specific season.
 * Returns the season-scoped hours grouped by department, and mutations
 * to copy default hours as a starting point and save edits.
 */
export function useSeasonOperatingHours(seasonId: string | null) {
  const ctx = useWorkspaceOptional();
  const workspaceId = ctx?.workspace.workspace_id;
  const { profileId } = useContext(DashboardContext);
  const supabase = createClient();
  const queryClient = useQueryClient();

  const queryKey = ["season-operating-hours", workspaceId, seasonId] as const;

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (!workspaceId || !seasonId) return [];

      const { data, error } = await supabase
        .from("department_operating_hours")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("season_id", seasonId)
        .order("department_id")
        .order("day_of_week");

      if (error) throw new Error(error.message);
      return data as DepartmentOperatingHoursRow[];
    },
    enabled: !!workspaceId && !!seasonId,
    staleTime: 5 * 60 * 1000,
  });

  /**
   * Copies the default operating hours (season_id=NULL) for all departments
   * as the starting point for season-specific hours. This lets managers
   * start from "what we have now" and adjust, rather than building from scratch.
   */
  const copyDefaultHours = useMutation({
    mutationFn: async () => {
      if (!workspaceId || !seasonId) throw new Error("Missing context");

      const { data: existing } = await supabase
        .from("department_operating_hours")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("season_id", seasonId)
        .limit(1);

      if (existing && existing.length > 0) {
        throw new Error("Season already has operating hours configured");
      }

      const { data: defaults, error: fetchError } = await supabase
        .from("department_operating_hours")
        .select("*")
        .eq("workspace_id", workspaceId)
        .is("season_id", null)
        .order("department_id")
        .order("day_of_week");

      if (fetchError) throw new Error(fetchError.message);
      if (!defaults || defaults.length === 0) {
        throw new Error("No default operating hours to copy");
      }

      const seasonRows: DepartmentOperatingHoursInsert[] = defaults.map((row) => ({
        workspace_id: workspaceId,
        department_id: row.department_id,
        location_id: row.location_id,
        season_id: seasonId,
        day_of_week: row.day_of_week,
        open_time: row.open_time,
        close_time: row.close_time,
        open_offset_minutes: row.open_offset_minutes,
        close_offset_minutes: row.close_offset_minutes,
        is_closed: row.is_closed,
        is_derived: true,
        provenance: { source: "copy_from_default", copied_at: new Date().toISOString() },
      }));

      const { error: insertError } = await supabase
        .from("department_operating_hours")
        .insert(seasonRows);

      if (insertError) throw new Error(insertError.message);
      return seasonRows.length;
    },
    onSuccess: (count) => {
      void queryClient.invalidateQueries({ queryKey });
      if (!seasonId) return;
      void emit({
        event: "season operating_hours_copied",
        workspace_id: workspaceId ?? null,
        actor_id: profileId ?? "",
        properties: {
          entity: {
            entity_type: "season",
            entity_id: seasonId,
          },
          data: { rows_copied: count },
        },
      });
    },
  });

  /**
   * Updates a single operating hours row. Used by the per-day time pickers
   * in the SeasonHoursTab.
   */
  const updateHours = useMutation({
    mutationFn: async (update: {
      id: string;
      open_time?: string | null;
      close_time?: string | null;
      is_closed?: boolean;
    }) => {
      const { error } = await supabase
        .from("department_operating_hours")
        .update({
          open_time: update.open_time,
          close_time: update.close_time,
          is_closed: update.is_closed,
          is_derived: false,
          provenance: { source: "manual_edit", edited_at: new Date().toISOString() },
          updated_at: new Date().toISOString(),
        })
        .eq("id", update.id);

      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
      if (!seasonId) return;
      void emit({
        event: "season operating_hours_updated",
        workspace_id: workspaceId ?? null,
        actor_id: profileId ?? "",
        properties: {
          entity: {
            entity_type: "season",
            entity_id: seasonId,
          },
          data: {} as Record<string, never>,
        },
      });
    },
  });

  /**
   * Deletes all season-specific hours (reverts to default hours).
   */
  const removeSeasonHours = useMutation({
    mutationFn: async () => {
      if (!workspaceId || !seasonId) throw new Error("Missing context");

      const { error } = await supabase
        .from("department_operating_hours")
        .delete()
        .eq("workspace_id", workspaceId)
        .eq("season_id", seasonId);

      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
      if (!seasonId) return;
      void emit({
        event: "season operating_hours_removed",
        workspace_id: workspaceId ?? null,
        actor_id: profileId ?? "",
        properties: {
          entity: {
            entity_type: "season",
            entity_id: seasonId,
          },
          data: {} as Record<string, never>,
        },
      });
    },
  });

  const hasSeasonHours = (query.data?.length ?? 0) > 0;

  return {
    hours: query.data ?? [],
    isLoading: query.isLoading,
    hasSeasonHours,
    copyDefaultHours,
    updateHours,
    removeSeasonHours,
  };
}
