/**
 * Fetches the authenticated employee's active time entry (clocked_in, no punch_out).
 * Queries timesheet.time_entry WHERE profile_id = me AND status = 'clocked_in'.
 * Returns null when there's no active punch — the employee is not on the clock.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Database } from "@smartout/supabase/database.types";

type TimeEntry = Database["timesheet"]["Tables"]["time_entry"]["Row"];

/** Cache key for MMKV persistence */
const CACHE_KEY = "cache:active-punch";

/** Short stale time — punch status should be near-realtime (30 seconds) */
const STALE_TIME_MS = 30 * 1000;

/**
 * Try to load MMKV cached data for offline placeholder.
 * Returns undefined if the cache module isn't available yet.
 */
function getPlaceholderData(): TimeEntry | null | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { mmkvStorage } = require("@/lib/cache/persister");
    const cached = mmkvStorage?.getString(CACHE_KEY);
    return cached ? (JSON.parse(cached) as TimeEntry | null) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Persists fresh data to MMKV for offline reads.
 */
function persistToCache(data: TimeEntry | null): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { mmkvStorage } = require("@/lib/cache/persister");
    mmkvStorage?.set(CACHE_KEY, JSON.stringify(data));
  } catch {
    // Cache module not available — skip persistence
  }
}

async function fetchActiveTimeEntry(): Promise<TimeEntry | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Get profile_id for the current user
  const { data: profile, error: profileError } = await supabase
    .from("profile")
    .select("profile_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (profileError) throw profileError;

  // Query timesheet schema for active clocked_in entry
  const { data, error } = await supabase
    .schema("timesheet")
    .from("time_entry")
    .select("*")
    .eq("profile_id", profile.profile_id)
    .eq("status", "clocked_in")
    .is("punch_out", null)
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  persistToCache(data);
  return data;
}

/**
 * Hook: returns the current employee's active time entry (if clocked in).
 * Returns null when there's no active punch.
 * Short stale time (30s) since punch status is time-critical.
 */
export function useActiveTimeEntry() {
  return useQuery<TimeEntry | null>({
    queryKey: ["active-time-entry"],
    queryFn: fetchActiveTimeEntry,
    staleTime: STALE_TIME_MS,
    placeholderData: getPlaceholderData,
  });
}
