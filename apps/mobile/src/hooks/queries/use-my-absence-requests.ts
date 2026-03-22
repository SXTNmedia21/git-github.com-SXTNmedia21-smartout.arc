/**
 * Fetches the employee's own absence requests.
 *
 * schedule_absence lives in the PUBLIC schema (not payroll) — it's the operational
 * request record. The payroll schema reads from it via foreign key when generating
 * ledger entries, but the source record itself is public.
 *
 * Returns the 20 most recent requests ordered by start_date descending,
 * covering pending, approved, and rejected states.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Database } from "@smartout/supabase/database.types";

type ScheduleAbsence = Database["public"]["Tables"]["schedule_absence"]["Row"];

export type AbsenceRequestsResult = {
  requests: ScheduleAbsence[];
};

/** How long before absence request list is considered stale (2 minutes) */
const STALE_TIME_MS = 2 * 60 * 1000;

async function fetchMyAbsenceRequests(): Promise<AbsenceRequestsResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile, error: profileError } = await supabase
    .from("profile")
    .select("profile_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();
  if (profileError) throw profileError;

  // schedule_absence uses employee_id (FK to profile.profile_id)
  const { data, error } = await supabase
    .from("schedule_absence")
    .select("*")
    .eq("employee_id", profile.profile_id)
    .order("start_date", { ascending: false })
    .limit(20);

  if (error) throw error;

  return { requests: data ?? [] };
}

/**
 * Hook: returns the current employee's absence requests (most recent 20).
 * Shorter stale time (2 min) since request status can change as managers review.
 */
export function useMyAbsenceRequests() {
  return useQuery<AbsenceRequestsResult>({
    queryKey: ["my-absence-requests"],
    queryFn: fetchMyAbsenceRequests,
    staleTime: STALE_TIME_MS,
    retry: 1,
  });
}
