/**
 * Fetches the authenticated employee's shifts for the next 7 days.
 * Uses MMKV placeholderData when the cache module is available (graceful fallback if not).
 * Queries schedule_shift WHERE employee_id = current profile, ordered by date + start_time.
 *
 * Two exported hooks:
 *  - useMyShifts()         → raw ScheduleShift[] (used by shift-phase, clockout, etc.)
 *  - useMyShiftsWithDept() → ShiftWithDept[] that includes department.slug from the DB.
 *    Used by useOperationsFeed so it can populate FeedItem.dept without substring heuristics.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useWorkspaceStore } from "@/hooks/stores/use-workspace-store";
import type { Database } from "@smartout/supabase/database.types";

type ScheduleShift = Database["public"]["Tables"]["schedule_shift"]["Row"];

/**
 * Shift row augmented with the department slug read directly from the DB.
 * The slug is nullable because position_id on schedule_shift is nullable by design
 * (ADR-0266 §Implementation contract). Consumers must handle null → fallback.
 */
export type ShiftWithDept = ScheduleShift & {
  /** department.slug from position → department join. Null when shift has no position. */
  deptSlug: string | null;
};

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

async function fetchMyShifts(selectedProfileId: string | null): Promise<ScheduleShift[]> {
  let profileId = selectedProfileId;

  // If no selected profile, resolve from auth user (fallback for single-workspace)
  if (!profileId) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { data: profile, error: profileError } = await supabase
      .from("profile")
      .select("profile_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .limit(1)
      .single();

    if (profileError) throw profileError;
    profileId = profile.profile_id;
  }

  const today = new Date().toISOString().split("T")[0];
  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const { data, error } = await supabase
    .from("schedule_shift")
    .select("*")
    .eq("employee_id", profileId)
    .eq("is_published", true)
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
 * Uses the selected profile from workspace-select for multi-workspace support.
 * Data is cached in MMKV for offline placeholder support.
 */
export function useMyShifts() {
  const selectedProfileId = useWorkspaceStore((s) => s.selectedProfileId);

  const query = useQuery<ScheduleShift[]>({
    queryKey: ["my-shifts", selectedProfileId],
    queryFn: () => fetchMyShifts(selectedProfileId),
    staleTime: STALE_TIME_MS,
    placeholderData: getPlaceholderData,
    retry: 1,
  });

  return query;
}

// ─── Extended variant: shifts + department.slug ───────────────────────────────

/** Raw shape returned by the dept-join query before client mapping. */
type RawShiftWithDeptRow = ScheduleShift & {
  position: {
    department: {
      slug: string;
    } | null;
  } | null;
};

async function fetchMyShiftsWithDept(selectedProfileId: string | null): Promise<ShiftWithDept[]> {
  let profileId = selectedProfileId;

  if (!profileId) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { data: profile, error: profileError } = await supabase
      .from("profile")
      .select("profile_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .limit(1)
      .single();

    if (profileError) throw profileError;
    profileId = profile.profile_id;
  }

  const today = new Date().toISOString().split("T")[0];
  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const { data, error } = await supabase
    .from("schedule_shift")
    .select(
      `
      *,
      position:position_id (
        department:department_id (
          slug
        )
      )
    `,
    )
    .eq("employee_id", profileId)
    .eq("is_published", true)
    .gte("shift_date", today!)
    .lte("shift_date", sevenDaysFromNow!)
    .order("shift_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) throw error;

  const rows = (data ?? []) as unknown as RawShiftWithDeptRow[];

  return rows.map((row) => ({
    ...row,
    deptSlug: row.position?.department?.slug ?? null,
  }));
}

/**
 * Hook: same as useMyShifts but each row is augmented with `deptSlug` read from
 * `position → department.slug` in the DB. Used by useOperationsFeed to populate
 * FeedItem.dept without substring heuristics (dropped 2026-05-18).
 *
 * No MMKV caching here — this variant is only used for the operations feed which
 * already has its own staleness guarantees.
 */
export function useMyShiftsWithDept() {
  const selectedProfileId = useWorkspaceStore((s) => s.selectedProfileId);

  return useQuery<ShiftWithDept[]>({
    queryKey: ["my-shifts-with-dept", selectedProfileId],
    queryFn: () => fetchMyShiftsWithDept(selectedProfileId),
    staleTime: STALE_TIME_MS,
    retry: 1,
  });
}
