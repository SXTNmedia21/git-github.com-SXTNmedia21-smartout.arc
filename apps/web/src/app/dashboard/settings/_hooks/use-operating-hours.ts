"use client";

import { useContext, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { emit } from "@smartout/telemetry";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { toast } from "sonner";

const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export type DayName = (typeof DAY_NAMES)[number];

export type OperatingHoursEntry = {
  day_of_week: number;
  day_name: DayName;
  open_time: string;
  close_time: string;
  is_closed: boolean;
  open_offset_minutes?: number;
  close_offset_minutes?: number;
  is_derived?: boolean;
};

export type WorkspaceBaseHoursEntry = {
  day_of_week: number;
  day_name: DayName;
  open_time: string;
  close_time: string;
  is_closed: boolean;
};

type OperatingHoursOptions = {
  locationId?: string;
  seasonId?: string;
};

const DEFAULT_ENTRY = {
  open_time: "08:00",
  close_time: "22:00",
  is_closed: false,
} as const;

function operatingHoursKeys(
  workspaceId: string,
  departmentId: string,
  locationId?: string,
  seasonId?: string,
) {
  return [
    "settings",
    "department-operating-hours",
    workspaceId,
    departmentId,
    locationId ?? "default",
    seasonId ?? "default",
  ] as const;
}

/**
 * Fetches and persists operating hours for a department.
 * Reads/writes department_operating_hours table (cascade A1).
 * Falls back to 08:00-22:00, open all days when no DB rows exist.
 *
 * The return shape (hours, isLoading, upsertHours) is identical to the
 * legacy hook so downstream consumers (OpeningHoursSettings, HourFactorsTab,
 * SeasonOverviewTab) work unchanged.
 */
export function useOperatingHours(
  departmentId: string | undefined,
  options?: OperatingHoursOptions,
) {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const { profileId } = useContext(DashboardContext);
  const supabase = createClient();
  const queryClient = useQueryClient();
  const locationId = options?.locationId;
  const seasonId = options?.seasonId;

  const query = useQuery({
    queryKey: operatingHoursKeys(wsId ?? "none", departmentId ?? "none", locationId, seasonId),
    queryFn: async (): Promise<OperatingHoursEntry[]> => {
      let q = supabase
        .from("department_operating_hours")
        .select(
          "id, workspace_id, department_id, location_id, season_id, day_of_week, open_time, close_time, is_closed, open_offset_minutes, close_offset_minutes, is_derived",
        )
        .eq("workspace_id", wsId!)
        .eq("department_id", departmentId!);

      // Season: prefer season-specific rows, fall back to default (NULL)
      if (seasonId) {
        q = q.eq("season_id", seasonId);
      } else {
        q = q.is("season_id", null);
      }

      // Location: prefer location-specific rows, fall back to default (NULL)
      if (locationId) {
        q = q.eq("location_id", locationId);
      } else {
        q = q.is("location_id", null);
      }

      const { data, error } = await q;
      if (error) throw new Error(error.message);

      const rowsByDay = new Map<number, (typeof data)[number]>();
      for (const row of data ?? []) {
        rowsByDay.set(row.day_of_week, row);
      }

      return DAY_NAMES.map((name, index) => {
        const row = rowsByDay.get(index);
        return {
          day_of_week: index,
          day_name: name,
          open_time: row?.open_time ?? DEFAULT_ENTRY.open_time,
          close_time: row?.close_time ?? DEFAULT_ENTRY.close_time,
          is_closed: row?.is_closed ?? DEFAULT_ENTRY.is_closed,
          open_offset_minutes: row?.open_offset_minutes ?? 0,
          close_offset_minutes: row?.close_offset_minutes ?? 0,
          is_derived: row?.is_derived ?? true,
        };
      });
    },
    enabled: !!wsId && !!departmentId,
    staleTime: 10 * 60 * 1000,
  });

  const upsertHours = useMutation({
    mutationFn: async (entries: OperatingHoursEntry[]) => {
      const rows = entries.map((entry) => ({
        workspace_id: wsId!,
        department_id: departmentId!,
        location_id: locationId ?? null,
        season_id: seasonId ?? null,
        day_of_week: entry.day_of_week,
        open_time: entry.open_time,
        close_time: entry.close_time,
        is_closed: entry.is_closed,
        // Direct admin edit → no longer derived from workspace base
        is_derived: false,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase.from("department_operating_hours").upsert(rows, {
        onConflict: "department_id,location_id,season_id,day_of_week",
      });

      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void emit({
        event: "operating_hours updated",
        workspace_id: wsId ?? null,
        actor_id: profileId ?? "",
        properties: {
          data: { location_id: locationId },
        },
      });
      queryClient.invalidateQueries({
        queryKey: operatingHoursKeys(wsId!, departmentId!, locationId, seasonId),
      });
      toast.success("Opening hours saved");
    },
    onError: (error: Error) => {
      toast.error(`Failed to save: ${error.message}`);
    },
  });

  // Workspace base hours query (for offset display)
  const baseHoursQuery = useQuery({
    queryKey: ["settings", "workspace-operating-hours", wsId ?? "none"],
    queryFn: async (): Promise<WorkspaceBaseHoursEntry[]> => {
      const { data, error } = await supabase
        .from("workspace_operating_hours")
        .select("day_of_week, open_time, close_time, is_closed")
        .eq("workspace_id", wsId!);

      if (error) throw new Error(error.message);

      const rowsByDay = new Map<number, (typeof data)[number]>();
      for (const row of data ?? []) {
        rowsByDay.set(row.day_of_week, row);
      }

      return DAY_NAMES.map((name, index) => {
        const row = rowsByDay.get(index);
        return {
          day_of_week: index,
          day_name: name,
          open_time: row?.open_time ?? DEFAULT_ENTRY.open_time,
          close_time: row?.close_time ?? DEFAULT_ENTRY.close_time,
          is_closed: row?.is_closed ?? DEFAULT_ENTRY.is_closed,
        };
      });
    },
    enabled: !!wsId,
    staleTime: 10 * 60 * 1000,
  });

  const defaultHours = useMemo<OperatingHoursEntry[]>(
    () =>
      DAY_NAMES.map((name, index) => ({
        day_of_week: index,
        day_name: name,
        ...DEFAULT_ENTRY,
      })),
    [],
  );

  return {
    hours: query.data ?? defaultHours,
    baseHours: baseHoursQuery.data ?? null,
    isLoading: query.isLoading,
    upsertHours,
  };
}
