"use client";

/**
 * useHoursOverrides — CRUD for department_hours_override.
 *
 * Manages date-specific operating hour exceptions (holidays, events, closures).
 * Used by the HoursOverridePopover in the DayControlPanel.
 */

import { useContext } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { emit, nonEmpty } from "@smartout/telemetry";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { toast } from "sonner";
import type { DepartmentHoursOverrideRow } from "@/lib/cascade/types";

type OverrideInput = {
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean;
  reason: string | null;
  planning_event_id?: string | null;
};

export function useHoursOverrides(departmentId: string | undefined, dateId: string | null) {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const { profileId } = useContext(DashboardContext);
  const supabase = createClient();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["hours-override", wsId, departmentId, dateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("department_hours_override")
        .select(
          "id, department_id, location_id, season_id, override_date, open_time, close_time, is_closed, reason, planning_event_id",
        )
        .eq("workspace_id", wsId!)
        .eq("department_id", departmentId!)
        .eq("override_date", dateId!);

      if (error) throw new Error(error.message);
      return (data ?? []) as DepartmentHoursOverrideRow[];
    },
    enabled: !!wsId && !!departmentId && !!dateId,
    staleTime: 30_000,
  });

  const invalidateAll = () => {
    void queryClient.invalidateQueries({
      queryKey: ["hours-override", wsId, departmentId, dateId],
    });
    void queryClient.invalidateQueries({
      queryKey: ["planned-hours-override", wsId, departmentId, dateId],
    });
    void queryClient.invalidateQueries({
      queryKey: ["department-session", wsId, departmentId, dateId],
    });
  };

  const upsertOverride = useMutation({
    mutationFn: async (input: OverrideInput) => {
      const { error } = await supabase.from("department_hours_override").upsert(
        {
          workspace_id: wsId!,
          department_id: departmentId!,
          location_id: null,
          override_date: dateId!,
          open_time: input.is_closed ? null : input.open_time,
          close_time: input.is_closed ? null : input.close_time,
          is_closed: input.is_closed,
          reason: input.reason,
          planning_event_id: input.planning_event_id ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "department_id,location_id,override_date" },
      );
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void emit({
        event: "operating_hours updated",
        workspace_id: (wsId ?? null) ? nonEmpty(wsId ?? null, "workspace_id") : null,
        actor_id: nonEmpty(profileId, "actor_id"),
        properties: { data: { location_id: undefined } },
      });
      invalidateAll();
      toast.success("Unntak lagret");
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke lagre: ${error.message}`);
    },
  });

  const deleteOverride = useMutation({
    mutationFn: async (overrideId: string) => {
      const { error } = await supabase
        .from("department_hours_override")
        .delete()
        .eq("id", overrideId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void emit({
        event: "operating_hours updated",
        workspace_id: (wsId ?? null) ? nonEmpty(wsId ?? null, "workspace_id") : null,
        actor_id: nonEmpty(profileId, "actor_id"),
        properties: { data: { location_id: undefined } },
      });
      invalidateAll();
      toast.success("Unntak fjernet");
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke slette: ${error.message}`);
    },
  });

  const override = query.data?.[0] ?? null;

  return {
    override,
    overrides: query.data ?? [],
    isLoading: query.isLoading,
    upsertOverride,
    deleteOverride,
  };
}
