/**
 * Fetches the authenticated employee's shifts for the next 7 days.
 * Uses MMKV placeholderData when the cache module is available (graceful fallback if not).
 * Queries schedule_shift WHERE employee_id = current profile, ordered by date + start_time.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Database } from "@smartout/supabase/database.types";

type ScheduleShift = Database["public"]["Tables"]["schedule_shift"]["Row"];

/** Cache key for MMKV persistence */
const CACHE_KEY = "cache:my-shifts";

/** How long before data is considered stale (5 minutes) */
const STALE_TIME_MS = 5 * 60 * 1000;

/**
 * Try to load MMKV cached data for offline placeholder.
 * Returns undefined if the cache module isn't available yet (Phase 2 not merged).
 */
function getPlaceholderData(): ScheduleShift[] | undefined {
  try {
    // Dynamic import attempt — graceful fallback if cache module doesn't exist
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { mmkvStorage } = require("@/lib/cache/persister");
    const cached = mmkvStorage?.getString(CACHE_KEY);
    return cached ? (JSON.parse(cached) as ScheduleShift[]) : undefined;
  } catch {
    // Cache module not yet available — no placeholder data
    return undefined;
  }
}

/**
 * Persists fresh data to MMKV for offline reads.
 */
function persistToCache(data: ScheduleShift[]): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { mmkvStorage } = require("@/lib/cache/persister");
    mmkvStorage?.set(CACHE_KEY, JSON.stringify(data));
  } catch {
    // Cache module not available — skip persistence
  }
}

async function fetchMyShifts(): Promise<ScheduleShift[]> {
  // Get current user to find their profile
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Get profile_id → employee_id on schedule_shift
  const { data: profiles, error: profileError } = await supabase
    .from("profile")
    .select("profile_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (profileError) throw profileError;

  const today = new Date().toISOString().split("T")[0];
  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const { data, error } = await supabase
    .from("schedule_shift")
    .select("*")
    .eq("employee_id", profiles.profile_id)
    .gte("shift_date", today)
    .lte("shift_date", sevenDaysFromNow)
    .order("shift_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) throw error;

  // Cache for offline reads
  if (data) persistToCache(data);

  return data ?? [];
}

/**
 * Hook: returns the current employee's shifts for the next 7 days.
 * Data is cached in MMKV for offline placeholder support.
 */
export function useMyShifts() {
  return useQuery<ScheduleShift[]>({
    queryKey: ["my-shifts"],
    queryFn: fetchMyShifts,
    staleTime: STALE_TIME_MS,
    placeholderData: getPlaceholderData,
    retry: 1,
  });
}
