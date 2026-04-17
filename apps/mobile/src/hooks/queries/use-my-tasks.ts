/**
 * Fetches today's tasks assigned to the current employee.
 *
 * Joins session_task through department_session to filter by today's date,
 * since session_task has no shift_date column — the date comes from
 * department_session.session_date.
 *
 * Returns tasks sorted by compliance priority first, then by creation date.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Database } from "@smartout/supabase/database.types";

type SessionTask = Database["public"]["Tables"]["session_task"]["Row"];

/** Cache key for MMKV persistence */
const CACHE_KEY = "cache:my-tasks";

/** Stale time — 2 minutes for task data */
const STALE_TIME_MS = 2 * 60 * 1000;

function getPlaceholderData(): SessionTask[] | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { mmkvStorage } = require("@/lib/cache/persister");
    const cached = mmkvStorage?.getString(CACHE_KEY);
    return cached ? (JSON.parse(cached) as SessionTask[]) : undefined;
  } catch {
    return undefined;
  }
}

function persistToCache(data: SessionTask[]): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { mmkvStorage } = require("@/lib/cache/persister");
    mmkvStorage?.set(CACHE_KEY, JSON.stringify(data));
  } catch {
    // Cache module not available
  }
}

async function fetchMyTasks(): Promise<SessionTask[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Get the current employee's profile
  const { data: profile, error: profileError } = await supabase
    .from("profile")
    .select("profile_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (profileError) throw profileError;

  const today = new Date().toISOString().split("T")[0];

  // Query session_task joined through department_session for today's date.
  // Also pull procedure name via session_hook → procedure for checklist labels.
  // Filter by assigned_to = current profile.
  const { data, error } = await supabase
    .from("session_task")
    .select(
      "*, department_session!inner(session_date), session_hook(procedure:linked_procedure_id(name))",
    )
    .eq("department_session.session_date", today)
    .eq("assigned_to", profile.profile_id)
    .order("is_compliance_required", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) throw error;

  // Flatten: strip the join intermediates, surface procedure_name on the row.
  const tasks = (data ?? []).map((row) => {
    const { department_session: _ds, session_hook, ...task } = row as typeof row & {
      session_hook?: { procedure?: { name?: string | null } | null } | null;
    };
    return {
      ...task,
      procedure_name: session_hook?.procedure?.name ?? null,
    };
  }) as SessionTask[];

  persistToCache(tasks);
  return tasks;
}

/**
 * Hook: returns today's tasks assigned to the current employee.
 * Sorted by compliance priority (HACCP first), then creation time.
 */
export function useMyTasks() {
  return useQuery<SessionTask[]>({
    queryKey: ["my-tasks"],
    queryFn: fetchMyTasks,
    staleTime: STALE_TIME_MS,
    placeholderData: getPlaceholderData,
  });
}
