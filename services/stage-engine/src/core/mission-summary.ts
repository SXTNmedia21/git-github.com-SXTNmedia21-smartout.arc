// services/stage-engine/src/core/mission-summary.ts
//
// Fetches a compact "current state" summary for a profile — active missions
// and next-7-day roadmap items — to prepend to the Botsson system prompt.
//
// Design goals:
//   - Stays under 3 lines when there is data; single phrase when empty
//   - Indexed queries only (assignee_id + workspace_id, event_date range)
//   - If either query fails, the error is swallowed and an empty string is
//     returned — the summary is advisory; a DB timeout must NOT break chat
//
// Phase A3 note: engine_memory writes are still unimplemented. This file
// reads engine_state (live) and planning_event (D4), both of which are
// already populated in production. No memory dependency.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { NonEmptyString } from "@smartout/telemetry/server";

type MissionRow = {
  id: string;
  status: string;
  process_id: string;
  current_step: number;
  last_error: string | null;
};

type ProcessRow = {
  id: string;
  name: string;
  max_steps: number;
};

type EventRow = {
  name: string;
  event_date: string;
  category: string;
};

/**
 * Builds a compact 1-3 line "Current state" block for the Botsson prompt.
 *
 * Returns an empty string when nothing is notable (no active missions, no
 * upcoming events) or when the DB is unreachable — so the prompt stays
 * clean and callers need no null-checking.
 *
 * Under load: both queries are keyed on indexed columns
 * (engine_state: assignee_id + workspace_id + status;
 *  planning_event: workspace_id + event_date range).
 * Typical latency < 20 ms on a warm Supabase connection.
 */
export async function fetchActiveStateSummary(
  profileId: NonEmptyString,
  workspaceId: NonEmptyString,
  supabase: SupabaseClient,
): Promise<string> {
  try {
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 86400000);

    const [statesResult, eventsResult] = await Promise.all([
      supabase
        .from("engine_state")
        .select("id, status, process_id, current_step, last_error")
        .eq("assignee_id", profileId)
        .eq("workspace_id", workspaceId)
        .in("status", ["active", "pending", "blocked"])
        .order("started_at", { ascending: false })
        .limit(5),

      supabase
        .from("planning_event")
        .select("name, event_date, category")
        .eq("workspace_id", workspaceId)
        .gte("event_date", now.toISOString().slice(0, 10))
        .lte("event_date", in7Days.toISOString().slice(0, 10))
        .order("event_date", { ascending: true })
        .limit(5),
    ]);

    const states = (statesResult.data ?? []) as MissionRow[];
    const events = (eventsResult.data ?? []) as EventRow[];

    if (states.length === 0 && events.length === 0) return "";

    const lines: string[] = [];

    // --- Mission summary ---
    if (states.length > 0) {
      // Resolve process names for a readable summary.
      const processIds = [...new Set(states.map((s) => s.process_id))];
      const { data: procRows } = await supabase
        .from("engine_process")
        .select("id, name, max_steps")
        .in("id", processIds);

      const procMap = new Map(((procRows ?? []) as ProcessRow[]).map((p) => [p.id, p]));

      const missionParts = states.map((s) => {
        const proc = procMap.get(s.process_id);
        const name = proc?.name ?? s.process_id;
        const total = proc?.max_steps;
        const stepInfo = total ? ` (steg ${s.current_step}/${total})` : ` (steg ${s.current_step})`;
        const blocked = s.status === "blocked" ? " — BLOKKERT" : "";
        return `${name}${stepInfo}${blocked}`;
      });

      const missionLabel =
        states.length === 1 ? "1 aktiv misjon" : `${states.length} aktive misjoner`;
      lines.push(`${missionLabel}: ${missionParts.join("; ")}.`);
    }

    // --- Upcoming events summary ---
    if (events.length > 0) {
      const formatter = new Intl.DateTimeFormat("nb-NO", {
        weekday: "long",
        day: "numeric",
        month: "short",
      });

      const eventParts = events.slice(0, 3).map((e) => {
        const date = formatter.format(new Date(e.event_date));
        return `${e.name} (${date})`;
      });

      const remainder = events.length > 3 ? ` + ${events.length - 3} til` : "";
      lines.push(`Neste 7 dager: ${eventParts.join(", ")}${remainder}.`);
    }

    return lines.join(" ");
  } catch {
    // Summary is advisory — DB errors must not break the chat pipeline.
    return "";
  }
}
