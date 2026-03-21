"use client";

import { useContext } from "react";
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
};

type OperatingHoursRow = {
  id: string;
  workspace_id: string;
  location_id: string | null;
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_closed: boolean;
};

const DEFAULT_ENTRY = {
  open_time: "08:00",
  close_time: "22:00",
  is_closed: false,
} as const;

function operatingHoursKeys(workspaceId: string, locationId?: string) {
  return ["settings", "operating-hours", workspaceId, locationId ?? "default"] as const;
}

/**
 * Fetches and persists operating hours for the workspace (optionally per location).
 * Uses operating_hours table with upsert on (workspace_id, location_id, day_of_week).
 * Falls back to 08:00-22:00, open all days when no DB rows exist.
 */
export function useOperatingHours(locationId?: string) {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const { profileId } = useContext(DashboardContext);
  const supabase = createClient();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: operatingHoursKeys(wsId ?? "none", locationId),
    queryFn: async (): Promise<OperatingHoursEntry[]> => {
      let q = supabase
        .from("operating_hours")
        .select("id, workspace_id, location_id, day_of_week, open_time, close_time, is_closed")
        .eq("workspace_id", wsId!);

      if (locationId) {
        q = q.eq("location_id", locationId);
      } else {
        q = q.is("location_id", null);
      }

      const { data, error } = await q;

      if (error) throw new Error(error.message);

      const rowsByDay = new Map<number, OperatingHoursRow>();
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
    staleTime: 10 * 60 * 1000, // 10 minutes — stable workspace settings
  });

  const upsertHours = useMutation({
    mutationFn: async (entries: OperatingHoursEntry[]) => {
      const rows = entries.map((entry) => ({
        workspace_id: wsId!,
        location_id: locationId ?? null,
        day_of_week: entry.day_of_week,
        open_time: entry.open_time,
        close_time: entry.close_time,
        is_closed: entry.is_closed,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase.from("operating_hours").upsert(rows, {
        onConflict: "workspace_id,location_id,day_of_week",
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
        queryKey: operatingHoursKeys(wsId!, locationId),
      });
      toast.success("Opening hours saved");
    },
    onError: (error: Error) => {
      toast.error(`Failed to save: ${error.message}`);
    },
  });

  const defaultHours: OperatingHoursEntry[] = DAY_NAMES.map((name, index) => ({
    day_of_week: index,
    day_name: name,
    ...DEFAULT_ENTRY,
  }));

  return {
    hours: query.data ?? defaultHours,
    isLoading: query.isLoading,
    upsertHours,
  };
}
