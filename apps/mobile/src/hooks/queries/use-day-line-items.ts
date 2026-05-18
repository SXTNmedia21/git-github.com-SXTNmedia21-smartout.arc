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
  id: string; // session_task_id
  day_line_id: string;
  title: string;
  scheduled_at: string | null;
  status: string;
  task_type: string | null;
  position: number | null;
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
  shiftSessionId: string,
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
          session_task_id,
          day_line_id,
          title,
          scheduled_at,
          status,
          task_type,
          position
          `,
        )
        .in("day_line_id", dayLineIds)
        .order("scheduled_at", { ascending: true, nullsFirst: false })
        .order("position", { ascending: true, nullsFirst: true });

      if (error) throw error;

      const rows = (data ?? []) as Array<{
        session_task_id: string;
        day_line_id: string | null;
        title: string;
        scheduled_at: string | null;
        status: string;
        task_type: string | null;
        position: number | null;
      }>;

      const clean: DayLineItem[] = [];
      const leaked: DayLineItem[] = [];

      for (const row of rows) {
        const item: DayLineItem = {
          id: row.session_task_id,
          day_line_id: row.day_line_id ?? "",
          title: row.title,
          scheduled_at: row.scheduled_at,
          status: row.status,
          task_type: row.task_type,
          position: row.position,
        };

        if (!item.day_line_id || !allowedSet.has(item.day_line_id)) {
          leaked.push(item);
        } else {
          clean.push(item);
        }
      }

      // Report leaked items asynchronously — do NOT await; read path must return.
      if (leaked.length > 0) {
        for (const leakedItem of leaked) {
          void emitLeakDetected(leakedItem, shiftSessionId).catch(() => {
            // Swallow telemetry errors so read path is unaffected.
          });
        }
      }

      return clean;
    },
    staleTime: 30_000,
    enabled: dayLineIds.length > 0 && Boolean(shiftSessionId),
  });
}
