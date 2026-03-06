// ============================================
// calendar-guardian.ts
// Evaluates active season-lifecycle sessions against calendar triggers.
// Advances stages when time conditions are met (e.g. season start approaching).
// Runs on a 60-second interval registered in index.ts.
// Connected to: guardian-bus.ts (event emission)
// Connected to: stage-manager.ts (auto-advance)
// Connected to: guardian-evaluator.ts (sibling — event-driven guardian)
// ============================================

import { supabaseAdmin } from "../lib/supabase.js";
import { advanceStage } from "./stage-manager.js";
import { emitGuardianEvent } from "./guardian-bus.js";
import type { Session } from "../types/session.js";
import { SEASON_LIFECYCLE_MISSION_ID } from "@smartout/ai";

type SeasonDates = {
  season_start: string;
  season_end: string;
};

type CalendarRule = {
  from_stage: string;
  to_stage: string;
  condition: (seasonDates: SeasonDates) => boolean;
};

function weeksUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now();
  return diff / (7 * 24 * 60 * 60 * 1000);
}

function daysSince(dateStr: string): number {
  const diff = Date.now() - new Date(dateStr).getTime();
  return diff / (24 * 60 * 60 * 1000);
}

function isPast(dateStr: string): boolean {
  return new Date(dateStr).getTime() <= Date.now();
}

const CALENDAR_RULES: CalendarRule[] = [
  {
    from_stage: "seed",
    to_stage: "revenue",
    condition: (s) => weeksUntil(s.season_start) <= 8,
  },
  {
    from_stage: "prepare",
    to_stage: "ready",
    condition: (s) => weeksUntil(s.season_start) <= 1,
  },
  {
    from_stage: "ready",
    to_stage: "running",
    condition: (s) => isPast(s.season_start),
  },
  {
    from_stage: "running",
    to_stage: "reflect",
    condition: (s) => daysSince(s.season_end) >= 3,
  },
];

/**
 * Evaluate all active season-lifecycle sessions against calendar-based rules.
 * If a rule's time condition is met, advance the session to the next stage.
 * Designed to run on a 60-second interval — one advance per session per cycle.
 */
export async function evaluateCalendarTriggers(): Promise<void> {
  const { data: sessions, error } = await supabaseAdmin
    .from("engine_sessions")
    .select("*")
    .eq("mission_id", SEASON_LIFECYCLE_MISSION_ID)
    .eq("status", "active");

  if (error) {
    console.error("[calendar-guardian] Failed to fetch sessions:", error.message);
    return;
  }

  if (!sessions?.length) return;

  for (const row of sessions) {
    try {
      const session = row as unknown as Session;

      // Query the season table directly for authoritative dates (not collected_data which is fragile)
      if (!session.workspace_id) continue;

      const { data: season } = await supabaseAdmin
        .from("season")
        .select("start_date, end_date")
        .eq("workspace_id", session.workspace_id)
        .in("status", ["draft", "active"])
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!season?.start_date || !season?.end_date) continue;

      const seasonDates: SeasonDates = {
        season_start: season.start_date,
        season_end: season.end_date,
      };

      for (const rule of CALENDAR_RULES) {
        if (session.current_stage_id === rule.from_stage && rule.condition(seasonDates)) {
          emitGuardianEvent({
            session_id: session.id,
            workspace_id: session.workspace_id,
            event_type: "guardian.calendar_advance",
            actor: "guardian",
            summary: `Calendar trigger: ${rule.from_stage} → ${rule.to_stage}`,
            data: {
              from_stage: rule.from_stage,
              to_stage: rule.to_stage,
              season_start: seasonDates.season_start,
              season_end: seasonDates.season_end,
              trigger: "calendar",
            },
          });

          await advanceStage(session, { next_stage_id: rule.to_stage });
          break; // one advance per evaluation cycle per session
        }
      }
    } catch (err) {
      console.error(`[calendar-guardian] Eval failed for session ${row.id}:`, err);
    }
  }
}
