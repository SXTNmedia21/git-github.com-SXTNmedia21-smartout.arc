/**
 * useDayLineItems — Fetch session_task rows anchored to a set of day_line_ids.
 *
 * Defensive client-side leak filter: drops any item whose day_line_id is NOT
 * present in the caller-supplied `allowedDayLineIds` set. Each leaked item
 * emits `shift_session.item_leak_detected` to alert + audit destinations.
 *
 * ADR-0367 §M2. ADR-0134: emit() resolves workspace_id + actor_id via
 * getProfileContext() — throws on missing identity, no empty-string fallbacks.
 *
 * Read-only (ADR-0133 — mobile EXECUTES, never authors).
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { emit, nonEmpty } from "@smartout/telemetry";
import { getProfileContext } from "@/lib/profile-context";

/** A single session_task item as returned by this hook. */
export type DayLineItem = {
  id: string; // session_task.id (PK)
  day_line_id: string;
  title: string;
  scheduled_at: string | null;
  status: string;
};

/**
 * Emit one `shift_session.item_leak_detected` per offending item.
 *
 * Must resolve profileContext first — throws (ADR-0134) if identity missing.
 * Fire-and-forget from the call site; errors are swallowed so read path is
 * not interrupted.
 */
async function emitLeakDetected(item: DayLineItem, shiftSessionId: string): Promise<void> {
  const ctx = await getProfileContext(); // throws on missing identity (ADR-0134)
  await emit({
    event: "shift_session.item_leak_detected",
    workspace_id: nonEmpty(ctx.workspaceId, "workspace_id"),
    actor_id: nonEmpty(ctx.profileId, "actor_id"),
    properties: {
      entity: {
        entity_type: "session_task",
        entity_id: item.id,
      },
      data: {
        offending_day_line_id: item.day_line_id,
        shift_session_id: shiftSessionId,
      },
    },
  });
}

/**
 * Load session_task rows for the given day_line_ids.
 *
 * Includes a defensive filter that compares fetched rows against
 * `allowedDayLineIds`. Any row whose `day_line_id` is not in the allowed set
 * is (a) dropped from the returned list and (b) reported via telemetry.
 *
 * @param dayLineIds       - IDs from the viewer's shift_session_day_line join.
 * @param allowedDayLineIds - The canonical set (same as dayLineIds unless the
 *                            query returns unexpected rows — used as the defence
 *                            boundary). Pass the same set as dayLineIds when
 *                            the query is well-formed; the filter then acts as
 *                            a sentinel for any unexpected DB data leakage.
 * @param shiftSessionId   - The parent shift_session ID, used in leak telemetry.
 */
export function useDayLineItems(
  dayLineIds: string[],
  allowedDayLineIds: string[],
  /** null while session is loading — query disabled when null or empty */
  shiftSessionId: string | null,
) {
  const allowedSet = new Set(allowedDayLineIds);

  return useQuery({
    queryKey: ["day-line-items", dayLineIds.slice().sort().join(",")],
    queryFn: async (): Promise<DayLineItem[]> => {
      if (dayLineIds.length === 0) return [];

      const { data, error } = await supabase
        .from("session_task")
        .select(
          `
          id,
          day_line_id,
          title,
          scheduled_at,
          status
          `,
        )
        .in("day_line_id", dayLineIds)
        .order("scheduled_at", { ascending: true, nullsFirst: false });

      if (error) throw error;

      // Database type for session_task.status uses the session_task_status enum.
      // We cast via unknown to avoid cross-table type-variance on the enum string
      // union — the DB guarantees the values match; cast is safe here.
      const rows = (data ?? []) as unknown as Array<{
        id: string;
        day_line_id: string | null;
        title: string;
        scheduled_at: string | null;
        status: string;
      }>;

      const clean: DayLineItem[] = [];
      const leaked: DayLineItem[] = [];

      for (const row of rows) {
        // Rows with null day_line_id are treated as leaked — they cannot
        // belong to any allowed day_line. No fallback to empty string
        // (L-0083 / ADR-0134: ID fields must not be silently coerced).
        if (row.day_line_id === null) {
          continue;
        }

        const item: DayLineItem = {
          id: row.id,
          day_line_id: row.day_line_id,
          title: row.title,
          scheduled_at: row.scheduled_at,
          status: row.status,
        };

        if (!allowedSet.has(item.day_line_id)) {
          leaked.push(item);
        } else {
          clean.push(item);
        }
      }

      // Report leaked items asynchronously — do NOT await; read path must return.
      // shiftSessionId is guaranteed non-null here because enabled guards it,
      // but TypeScript doesn't narrow across queryFn boundaries — assert.
      if (leaked.length > 0 && shiftSessionId) {
        for (const leakedItem of leaked) {
          void emitLeakDetected(leakedItem, shiftSessionId).catch(() => {
            // Swallow telemetry errors so read path is unaffected.
          });
        }
      }

      return clean;
    },
    staleTime: 30_000,
    enabled: dayLineIds.length > 0 && shiftSessionId !== null && shiftSessionId !== "",
  });
}
