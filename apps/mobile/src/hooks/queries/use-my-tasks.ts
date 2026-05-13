/**
 * Fetches today's tasks assigned to the current employee via the
 * fn_list_my_tasks SECURITY DEFINER RPC (ADR-0298).
 *
 * The RPC UNION-ALLs across session_task, schedule_day_task, personal_task,
 * and emma_task. Caller identity is derived inside the function from
 * auth.uid() — no profile_id param required from the client.
 *
 * Returns tasks sorted by compliance priority first, then by creation date.
 * Window defaults to yesterday → 7 days ahead so today's tasks are always
 * included regardless of timezone drift on session_date.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Database } from "@smartout/supabase/database.types";

/** Normalized task row as returned by fn_list_my_tasks (ADR-0298 §4.4). */
export type MyTaskRow = Database["public"]["Functions"]["fn_list_my_tasks"]["Returns"][number];

/** Cache key for MMKV persistence */
const CACHE_KEY = "cache:my-tasks";

/** Stale time — 2 minutes for task data */
const STALE_TIME_MS = 2 * 60 * 1000;

function getPlaceholderData(): MyTaskRow[] | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { mmkvStorage } = require("@/lib/cache/persister");
    const cached = mmkvStorage?.getString(CACHE_KEY);
    return cached ? (JSON.parse(cached) as MyTaskRow[]) : undefined;
  } catch {
    return undefined;
  }
}

function persistToCache(data: MyTaskRow[]): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { mmkvStorage } = require("@/lib/cache/persister");
    mmkvStorage?.set(CACHE_KEY, JSON.stringify(data));
  } catch {
    // Cache module not available
  }
}

async function fetchMyTasks(): Promise<MyTaskRow[]> {
  // Window: yesterday → 7 days ahead covers today regardless of timezone drift.
  const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const windowEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase.rpc("fn_list_my_tasks", {
    p_window_start: windowStart,
    p_window_end: windowEnd,
  });

  if (error) throw error;

  // Sort compliance-first, then created_at ascending — mirrors old PostgREST order.
  const sorted = ((data ?? []) as MyTaskRow[]).sort((a, b) => {
    if (a.compliance !== b.compliance) return a.compliance ? -1 : 1;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  persistToCache(sorted);
  return sorted;
}

/**
 * Hook: returns today's tasks assigned to the current employee via RPC.
 * Sorted by compliance priority (HACCP first), then creation time.
 */
export function useMyTasks() {
  return useQuery<MyTaskRow[]>({
    queryKey: ["my-tasks"],
    queryFn: fetchMyTasks,
    staleTime: STALE_TIME_MS,
    placeholderData: getPlaceholderData,
  });
}
