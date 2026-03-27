"use client";

/**
 * usePlannedHours — resolves the effective opening hours for a department on a given date.
 *
 * Resolution:
 * 1. If a department_session exists for the date → use planned_open/planned_close
 * 2. Otherwise → run resolveEffectiveHours() client-side as a preview
 *
 * Returns source ("session" | "preview") so the UI can style accordingly.
 */

import { useQuery } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { resolveEffectiveHours } from "@/lib/cascade/resolve-hours";
import type { DepartmentOperatingHoursRow, DepartmentHoursOverrideRow } from "@/lib/cascade/types";

export type PlannedHoursResult = {
  openTime: string | null;
  closeTime: string | null;
  source: "session" | "preview";
  hasOverride: boolean;
  isClosed: boolean;
  isLoading: boolean;
  overrideReason: string | null;
};

export function usePlannedHours(
  departmentId: string | undefined,
  dateId: string | null,
): PlannedHoursResult {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const supabase = createClient();

  const sessionQuery = useQuery({
    queryKey: ["department-session", wsId, departmentId, dateId],
    queryFn: async () => {
      const { data } = await supabase
        .from("department_session")
        .select("planned_open, planned_close, status")
        .eq("workspace_id", wsId!)
        .eq("department_id", departmentId!)
        .eq("session_date", dateId!)
        .maybeSingle();
      return data;
    },
    enabled: !!wsId && !!departmentId && !!dateId,
    staleTime: 30_000,
  });

  const weeklyQuery = useQuery({
    queryKey: ["planned-hours-weekly", wsId, departmentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("department_operating_hours")
        .select(
          "id, department_id, location_id, season_id, day_of_week, open_time, close_time, is_closed",
        )
        .eq("workspace_id", wsId!)
        .eq("department_id", departmentId!);
      return (data ?? []) as DepartmentOperatingHoursRow[];
    },
    enabled: !!wsId && !!departmentId && !sessionQuery.data,
    staleTime: 5 * 60_000,
  });

  const workspaceHoursQuery = useQuery({
    queryKey: ["workspace-operating-hours-fallback", wsId],
    queryFn: async () => {
      const { data } = await supabase
        .from("workspace_operating_hours")
        .select("day_of_week, open_time, close_time, is_closed")
        .eq("workspace_id", wsId!);
      return (data ?? []) as Array<{
        day_of_week: number;
        open_time: string;
        close_time: string;
        is_closed: boolean;
      }>;
    },
    enabled: !!wsId && !sessionQuery.data && (weeklyQuery.data?.length ?? 0) === 0,
    staleTime: 10 * 60_000,
  });

  const overrideQuery = useQuery({
    queryKey: ["planned-hours-override", wsId, departmentId, dateId],
    queryFn: async () => {
      const { data } = await supabase
        .from("department_hours_override")
        .select(
          "id, department_id, location_id, season_id, override_date, open_time, close_time, is_closed, reason, planning_event_id",
        )
        .eq("workspace_id", wsId!)
        .eq("department_id", departmentId!)
        .eq("override_date", dateId!);
      return (data ?? []) as DepartmentHoursOverrideRow[];
    },
    enabled: !!wsId && !!departmentId && !!dateId,
    staleTime: 30_000,
  });

  const isLoading =
    sessionQuery.isLoading ||
    weeklyQuery.isLoading ||
    overrideQuery.isLoading ||
    workspaceHoursQuery.isLoading;
  const overrides = overrideQuery.data ?? [];
  const hasOverride = overrides.length > 0;
  const overrideReason = overrides[0]?.reason ?? null;

  // If session exists, use it directly
  if (sessionQuery.data?.planned_open && sessionQuery.data?.planned_close) {
    return {
      openTime: sessionQuery.data.planned_open.substring(0, 5),
      closeTime: sessionQuery.data.planned_close.substring(0, 5),
      source: "session",
      hasOverride,
      isClosed: false,
      isLoading,
      overrideReason,
    };
  }

  // No session — compute preview from weekly hours + overrides
  if (!dateId || !departmentId) {
    return {
      openTime: null,
      closeTime: null,
      source: "preview",
      hasOverride: false,
      isClosed: false,
      isLoading,
      overrideReason: null,
    };
  }

  const deptHours = weeklyQuery.data ?? [];
  const weeklyHours: DepartmentOperatingHoursRow[] =
    deptHours.length > 0
      ? deptHours
      : ((workspaceHoursQuery.data ?? []).map((wh) => ({
          id: `ws-fallback-${wh.day_of_week}`,
          department_id: departmentId!,
          location_id: null,
          season_id: null,
          day_of_week: wh.day_of_week,
          open_time: wh.open_time,
          close_time: wh.close_time,
          is_closed: wh.is_closed,
        })) as DepartmentOperatingHoursRow[]);
  const resolved = resolveEffectiveHours(
    departmentId,
    null, // location — null for workspace default
    dateId,
    weeklyHours,
    overrides,
  );

  return {
    openTime: resolved.openTime,
    closeTime: resolved.closeTime,
    source: "preview",
    hasOverride,
    isClosed: !resolved.isOpen,
    isLoading,
    overrideReason,
  };
}
