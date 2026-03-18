/**
 * Fetches colleagues working on the same date as a given shift.
 *
 * Queries schedule_shift for the same shift_date and workspace,
 * then resolves employee profiles (name + image). Excludes the
 * current user from the results.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Database } from "@smartout/supabase/database.types";

type Profile = Database["public"]["Tables"]["profile"]["Row"];

export type Colleague = {
  profileId: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  role: string;
  startTime: string;
  endTime: string;
};

const STALE_TIME_MS = 5 * 60 * 1000;

async function fetchShiftColleagues(
  shiftDate: string,
  currentProfileId: string,
): Promise<Colleague[]> {
  // Get all shifts on the same date (published only)
  const { data: shifts, error: shiftsError } = await supabase
    .from("schedule_shift")
    .select("employee_id, role, start_time, end_time")
    .eq("shift_date", shiftDate)
    .eq("is_published", true)
    .not("employee_id", "is", null);

  if (shiftsError) throw shiftsError;
  if (!shifts?.length) return [];

  // Collect unique employee IDs, excluding the current user
  const employeeIds = [
    ...new Set(
      shifts
        .map((s) => s.employee_id)
        .filter((id): id is string => id !== null && id !== currentProfileId),
    ),
  ];

  if (employeeIds.length === 0) return [];

  // Fetch profile data for all colleagues
  const { data: profiles, error: profileError } = await supabase
    .from("profile")
    .select("profile_id, first_name, last_name, avatar_url")
    .in("profile_id", employeeIds);

  if (profileError) throw profileError;

  // Build a lookup for profiles
  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.profile_id, p]),
  );

  // Map shifts to Colleague objects
  return shifts
    .filter((s) => s.employee_id && s.employee_id !== currentProfileId)
    .map((s) => {
      const profile = profileMap.get(s.employee_id!);
      return {
        profileId: s.employee_id!,
        firstName: profile?.first_name ?? "",
        lastName: profile?.last_name ?? "",
        avatarUrl: profile?.avatar_url ?? null,
        role: s.role,
        startTime: s.start_time,
        endTime: s.end_time,
      };
    })
    // Deduplicate by profileId (in case of multiple shifts for same person)
    .filter(
      (colleague, index, self) =>
        self.findIndex((c) => c.profileId === colleague.profileId) === index,
    );
}

/**
 * Hook: returns colleagues working on the same shift date.
 * Disabled when shiftDate or profileId are missing.
 */
export function useShiftColleagues(shiftDate: string | null, currentProfileId: string | null) {
  return useQuery<Colleague[]>({
    queryKey: ["shift-colleagues", shiftDate],
    queryFn: () => fetchShiftColleagues(shiftDate!, currentProfileId!),
    enabled: Boolean(shiftDate && currentProfileId),
    staleTime: STALE_TIME_MS,
  });
}
