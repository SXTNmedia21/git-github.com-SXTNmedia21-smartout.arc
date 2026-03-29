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
  const query = useQuery<ScheduleShift[]>({
    queryKey: ["my-shifts"],
    queryFn: fetchMyShifts,
    staleTime: STALE_TIME_MS,
    placeholderData: getPlaceholderData,
    retry: 1,
  });

  // In dev mode, fall back to placeholder shifts when the query returns empty
  if (__DEV__ && (!query.data || query.data.length === 0) && !query.isLoading) {
    return { ...query, data: DEV_SHIFTS };
  }

  return query;
}

/** Generates a date string N days from now */
function devDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split("T")[0]!;
}

/**
 * Dev-only placeholder shifts so the shifts screen renders with content
 * before Supabase is seeded or auth is configured.
 */
const DEV_SHIFTS: ScheduleShift[] = __DEV__
  ? ([
      {
        schedule_shift_id: "dev-shift-1",
        workspace_id: "b0000000-0000-0000-0000-000000000000",
        employee_id: "f0000000-0000-0000-0000-000000000001",
        position_id: null,
        team_id: null,
        shift_date: devDate(1),
        role: "Servitør",
        start_time: "16:00:00",
        end_time: "23:00:00",
        work_hours: 6.5,
        breaks: 30,
        day_category: "evening",
        status: "published",
        is_published: true,
        zone: "Sjøhuset",
        indicator: "emerald",
        notes: null,
        confirmed_at: new Date().toISOString(),
        confirmed_by: "f0000000-0000-0000-0000-000000000001",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        schedule_shift_id: "dev-shift-2",
        workspace_id: "b0000000-0000-0000-0000-000000000000",
        employee_id: "f0000000-0000-0000-0000-000000000001",
        position_id: null,
        team_id: null,
        shift_date: devDate(3),
        role: "Servitør",
        start_time: "15:30:00",
        end_time: "00:00:00",
        work_hours: 8.0,
        breaks: 30,
        day_category: "evening",
        status: "published",
        is_published: true,
        zone: "Sjøhuset",
        indicator: "emerald",
        notes: null,
        confirmed_at: null,
        confirmed_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        schedule_shift_id: "dev-shift-3",
        workspace_id: "b0000000-0000-0000-0000-000000000000",
        employee_id: "f0000000-0000-0000-0000-000000000001",
        position_id: null,
        team_id: null,
        shift_date: devDate(5),
        role: "Hovmester",
        start_time: "17:00:00",
        end_time: "02:00:00",
        work_hours: 8.5,
        breaks: 30,
        day_category: "weekend",
        status: "published",
        is_published: true,
        zone: "Sjøhuset (Hovedsal)",
        indicator: "orange",
        notes: null,
        confirmed_at: null,
        confirmed_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        schedule_shift_id: "dev-shift-4",
        workspace_id: "b0000000-0000-0000-0000-000000000000",
        employee_id: "f0000000-0000-0000-0000-000000000001",
        position_id: null,
        team_id: null,
        shift_date: devDate(6),
        role: "Servitør",
        start_time: "17:00:00",
        end_time: "02:00:00",
        work_hours: 8.5,
        breaks: 30,
        day_category: "weekend",
        status: "published",
        is_published: true,
        zone: "Sjøhuset",
        indicator: "orange",
        notes: null,
        confirmed_at: null,
        confirmed_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        schedule_shift_id: "dev-shift-5",
        workspace_id: "b0000000-0000-0000-0000-000000000000",
        employee_id: "f0000000-0000-0000-0000-000000000001",
        position_id: null,
        team_id: null,
        shift_date: devDate(9),
        role: "Servitør",
        start_time: "16:00:00",
        end_time: "23:00:00",
        work_hours: 6.5,
        breaks: 30,
        day_category: "evening",
        status: "published",
        is_published: true,
        zone: "Sjøhuset",
        indicator: "emerald",
        notes: null,
        confirmed_at: null,
        confirmed_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ] as ScheduleShift[])
  : [];
