/**
 * Fetches published shifts eligible for swapping on a given date.
 *
 * Queries schedule_shift for published shifts on the same date, different employee,
 * same workspace. Joins profile for display_name so the UI can show colleague names.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useWorkspaceStore } from "@/hooks/stores/use-workspace-store";

export type EligibleSwapShift = {
  schedule_shift_id: string;
  employee_id: string;
  display_name: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  role: string;
  position_id: string | null;
  work_hours: number;
  status: string;
};

const STALE_TIME_MS = 2 * 60 * 1000;

async function fetchEligibleShifts(
  shiftDate: string,
  currentProfileId: string,
): Promise<EligibleSwapShift[]> {
  // Resolve workspace to scope the query
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: currentProfile, error: profileError } = await supabase
    .from("profile")
    .select("workspace_id")
    .eq("profile_id", currentProfileId)
    .single();

  if (profileError) throw profileError;

  // Fetch published shifts on the same date, excluding the current user's shifts
  const { data: shifts, error: shiftsError } = await supabase
    .from("schedule_shift")
    .select(
      "schedule_shift_id, employee_id, shift_date, start_time, end_time, role, position_id, work_hours, status",
    )
    .eq("workspace_id", currentProfile.workspace_id)
    .eq("shift_date", shiftDate)
    .eq("is_published", true)
    .neq("employee_id", currentProfileId)
    .not("employee_id", "is", null)
    .order("start_time", { ascending: true });

  if (shiftsError) throw shiftsError;
  if (!shifts?.length) return [];

  // Fetch display names for all employees
  const employeeIds = [...new Set(shifts.map((s) => s.employee_id).filter(Boolean))] as string[];

  const { data: profiles, error: profilesError } = await supabase
    .from("profile")
    .select("profile_id, display_name")
    .in("profile_id", employeeIds);

  if (profilesError) throw profilesError;

  const profileMap = new Map((profiles ?? []).map((p) => [p.profile_id, p.display_name ?? ""]));

  return shifts.map((s) => ({
    schedule_shift_id: s.schedule_shift_id,
    employee_id: s.employee_id!,
    display_name: profileMap.get(s.employee_id!) ?? "Ukjent",
    shift_date: s.shift_date,
    start_time: s.start_time,
    end_time: s.end_time,
    role: s.role,
    position_id: s.position_id,
    work_hours: s.work_hours,
    status: s.status,
  }));
}

/**
 * Hook: returns published shifts on the given date that are eligible for swapping.
 * Excludes the current user's own shifts.
 */
export function useEligibleSwapShifts(shiftDate: string | null) {
  const selectedProfileId = useWorkspaceStore((s) => s.selectedProfileId);

  return useQuery<EligibleSwapShift[]>({
    queryKey: ["eligible-swap-shifts", shiftDate, selectedProfileId],
    queryFn: () => fetchEligibleShifts(shiftDate!, selectedProfileId!),
    enabled: Boolean(shiftDate && selectedProfileId),
    staleTime: STALE_TIME_MS,
  });
}
