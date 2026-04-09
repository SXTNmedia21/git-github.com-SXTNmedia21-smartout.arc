"use client";

/**
 * TanStack Query hook for fetching published shifts for the current employee.
 * Shows today + upcoming 2 weeks of published shifts.
 * Connected to: MyWeekView component
 */

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";

export type MyScheduleShift = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  role: string;
  status: string;
  workHours: number;
  departmentName: string | null;
};

const myScheduleKeys = {
  shifts: (profileId: string, weekStart: string) =>
    ["my-schedule", "shifts", profileId, weekStart] as const,
};

export { myScheduleKeys };

/**
 * Fetches published shifts for the current profile for a given 2-week window.
 * Only shows is_published=true shifts.
 */
export function useMyScheduleShifts(profileId: string | null, weekStart: string, weekEnd: string) {
  return useQuery({
    queryKey: myScheduleKeys.shifts(profileId ?? "", weekStart),
    enabled: !!profileId,
    staleTime: 2 * 60 * 1000,
    queryFn: async (): Promise<MyScheduleShift[]> => {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("schedule_shift")
        .select(
          "schedule_shift_id, shift_date, start_time, end_time, role, status, work_hours, department:department_id(name)",
        )
        .eq("employee_id", profileId!)
        .eq("is_published", true)
        .gte("shift_date", weekStart)
        .lte("shift_date", weekEnd)
        .order("shift_date", { ascending: true })
        .order("start_time", { ascending: true });

      if (error) throw error;

      return (data ?? []).map((s) => ({
        id: s.schedule_shift_id,
        date: s.shift_date,
        startTime: s.start_time,
        endTime: s.end_time,
        role: s.role,
        status: s.status,
        workHours: s.work_hours,
        departmentName: (s.department as unknown as { name: string } | null)?.name ?? null, // SAFETY: Supabase join returns union type; runtime shape matches the cast
      }));
    },
  });
}

/**
 * Subscribes to Supabase Realtime changes on schedule_shift for a given employee.
 * On any INSERT/UPDATE/DELETE, invalidates the my-schedule query cache so the
 * UI refreshes automatically when shifts are published or modified.
 */
export function useMyShiftsRealtime(profileId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!profileId) return;

    const supabase = createClient();

    const channel = supabase
      .channel(`my-shifts-realtime-${profileId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "schedule_shift",
          filter: `employee_id=eq.${profileId}`,
        },
        () => {
          // Invalidate all my-schedule shift queries for this profile so the
          // current and any prefetched weeks refresh.
          void queryClient.invalidateQueries({
            queryKey: ["my-schedule", "shifts", profileId],
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [profileId, queryClient]);
}
