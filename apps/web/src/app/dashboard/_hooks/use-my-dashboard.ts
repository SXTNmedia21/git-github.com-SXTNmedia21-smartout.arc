"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { dashboardKeys } from "./dashboard-keys";

export type MyShift = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  role: string;
  status: string;
  isPublished: boolean;
  workHours: number;
};

type MyReadiness = {
  total: number;
  completed: number;
  pending: number;
  percent: number;
};

/**
 * Fetches the next 6 upcoming shifts for the current employee.
 * Connected to: EmployeeDashboard today's shift + upcoming schedule
 */
export function useMyShifts(profileId: string | null) {
  return useQuery({
    queryKey: dashboardKeys.myShifts(profileId ?? ""),
    enabled: !!profileId,
    staleTime: 2 * 60 * 1000, // 2 minutes — volatile shift data
    queryFn: async (): Promise<MyShift[]> => {
      const supabase = createClient();
      const today = new Date().toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("schedule_shift")
        .select(
          "schedule_shift_id, shift_date, start_time, end_time, role, status, is_published, work_hours",
        )
        .eq("employee_id", profileId!)
        .gte("shift_date", today!)
        .order("shift_date", { ascending: true })
        .order("start_time", { ascending: true })
        .limit(6);

      if (error) throw error;

      return (data ?? []).map((s) => ({
        id: s.schedule_shift_id,
        date: s.shift_date,
        startTime: s.start_time,
        endTime: s.end_time,
        role: s.role,
        status: s.status,
        isPublished: s.is_published,
        workHours: s.work_hours,
      }));
    },
  });
}

/**
 * Fetches protocol assignment completion for the current employee.
 * Connected to: EmployeeDashboard readiness widget
 */
export function useMyReadiness(profileId: string | null) {
  return useQuery({
    queryKey: dashboardKeys.myReadiness(profileId ?? ""),
    enabled: !!profileId,
    staleTime: 5 * 60 * 1000, // 5 minutes — semi-stable training readiness
    queryFn: async (): Promise<MyReadiness> => {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("protocol_assignment")
        .select("status")
        .eq("profile_id", profileId!);

      if (error) throw error;

      const assignments = data ?? [];
      const total = assignments.length;
      const completed = assignments.filter((a) => a.status === "completed").length;
      const pending = assignments.filter((a) => a.status === "pending").length;

      return {
        total,
        completed,
        pending,
        percent: total > 0 ? Math.round((completed / total) * 100) : 100,
      };
    },
  });
}
