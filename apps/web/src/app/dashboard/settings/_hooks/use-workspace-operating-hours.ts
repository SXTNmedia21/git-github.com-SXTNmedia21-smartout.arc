"use client";

/**
 * Reads and writes workspace-level base operating hours.
 * Used by the Settings page. Departments inherit these unless overridden.
 */

import { useContext } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { emit } from "@smartout/telemetry";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { toast } from "sonner";
import { dashboardKeys } from "../../_hooks/dashboard-keys";

const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

type DayName = (typeof DAY_NAMES)[number];

export type WorkspaceHoursEntry = {
  day_of_week: number;
  day_name: DayName;
  open_time: string;
  close_time: string;
  is_closed: boolean;
};

const DEFAULT_ENTRY = {
  open_time: "08:00",
  close_time: "22:00",
  is_closed: false,
} as const;

export function useWorkspaceOperatingHours() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const { profileId } = useContext(DashboardContext);
  const supabase = createClient();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: dashboardKeys.workspaceOperatingHours(wsId ?? "none"),
    queryFn: async (): Promise<{ entries: WorkspaceHoursEntry[]; persistedCount: number }> => {
      const { data, error } = await supabase
        .from("workspace_operating_hours")
        .select("id, workspace_id, day_of_week, open_time, close_time, is_closed")
        .eq("workspace_id", wsId!);

      if (error) throw new Error(error.message);

      const persistedCount = data?.length ?? 0;
      const rowsByDay = new Map<number, (typeof data)[number]>();
      for (const row of data ?? []) {
        rowsByDay.set(row.day_of_week, row);
      }

      const entries = DAY_NAMES.map((name, index) => {
        const row = rowsByDay.get(index);
        return {
          day_of_week: index,
          day_name: name,
          open_time: row?.open_time ?? DEFAULT_ENTRY.open_time,
          close_time: row?.close_time ?? DEFAULT_ENTRY.close_time,
          is_closed: row?.is_closed ?? DEFAULT_ENTRY.is_closed,
        };
      });

      return { entries, persistedCount };
    },
    enabled: !!wsId,
    staleTime: 10 * 60_000,
  });

  const upsertHours = useMutation({
    mutationFn: async (entries: WorkspaceHoursEntry[]) => {
      const rows = entries.map((entry) => ({
        workspace_id: wsId!,
        day_of_week: entry.day_of_week,
        open_time: entry.open_time,
        close_time: entry.close_time,
        is_closed: entry.is_closed,
      }));

      const { error } = await supabase.from("workspace_operating_hours").upsert(rows, {
        onConflict: "workspace_id,day_of_week",
      });

      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void emit({
        event: "workspace_operating_hours updated",
        workspace_id: wsId ?? null,
        actor_id: profileId ?? "",
        properties: { data: {} },
      });
      queryClient.invalidateQueries({
        queryKey: dashboardKeys.workspaceOperatingHours(wsId!),
      });
      queryClient.invalidateQueries({
        queryKey: dashboardKeys.cascadeTasks(wsId!),
      });
      toast.success("Opening hours saved");
    },
    onError: (error: Error) => {
      toast.error(`Failed to save: ${error.message}`);
    },
  });

  const defaultHours: WorkspaceHoursEntry[] = DAY_NAMES.map((name, index) => ({
    day_of_week: index,
    day_name: name,
    ...DEFAULT_ENTRY,
  }));

  return {
    hours: query.data?.entries ?? defaultHours,
    isSaved: (query.data?.persistedCount ?? 0) > 0,
    isLoading: query.isLoading,
    upsertHours,
  };
}
