"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { scheduleKeys } from "./schedule-keys";

type ScheduleRealtimeOptions = {
  includeDayContent?: boolean;
  includeOpenShifts?: boolean;
};

export function useScheduleRealtime(weekStart: string, options?: ScheduleRealtimeOptions) {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;
  const includeDayContent = options?.includeDayContent ?? true;
  const includeOpenShifts = options?.includeOpenShifts ?? true;

  useEffect(() => {
    const supabase = createClient();
    const pendingQueryKeys = new Set<string>();
    let flushTimer: ReturnType<typeof setTimeout> | null = null;

    /**
     * Debounces cache invalidations to avoid repaint storms when many realtime
     * events arrive in short bursts.
     */
    const scheduleInvalidate = (queryKey: readonly unknown[]) => {
      pendingQueryKeys.add(JSON.stringify(queryKey));

      if (flushTimer !== null) return;
      flushTimer = setTimeout(() => {
        for (const key of pendingQueryKeys) {
          queryClient.invalidateQueries({ queryKey: JSON.parse(key) as readonly unknown[] });
        }
        pendingQueryKeys.clear();
        flushTimer = null;
      }, 350);
    };

    const channel = supabase
      .channel(`schedule:${workspaceId}:${weekStart}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "schedule_shift",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        () => {
          scheduleInvalidate(scheduleKeys.shifts(workspaceId, weekStart));
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "schedule_absence",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        () => {
          scheduleInvalidate(scheduleKeys.absences(workspaceId, weekStart));
        },
      );

    if (includeDayContent) {
      channel
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "schedule_day_message",
            filter: `workspace_id=eq.${workspaceId}`,
          },
          () => {
            scheduleInvalidate(scheduleKeys.dayMessages(workspaceId, weekStart));
          },
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "schedule_day_task",
            filter: `workspace_id=eq.${workspaceId}`,
          },
          () => {
            scheduleInvalidate(scheduleKeys.dayTasks(workspaceId, weekStart));
          },
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "schedule_day_booking",
            filter: `workspace_id=eq.${workspaceId}`,
          },
          () => {
            scheduleInvalidate(scheduleKeys.dayBookings(workspaceId, weekStart));
          },
        );
    }

    if (includeOpenShifts) {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "schedule_open_shift",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        () => {
          scheduleInvalidate(scheduleKeys.openShifts(workspaceId));
        },
      );
    }

    channel.subscribe();

    return () => {
      if (flushTimer !== null) {
        clearTimeout(flushTimer);
      }
      supabase.removeChannel(channel);
    };
  }, [workspaceId, weekStart, queryClient, includeDayContent, includeOpenShifts]);
}
