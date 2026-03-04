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
    .eq("mission_id", "season-lifecycle")
    .eq("status", "active");

  if (error) {
    console.error("[calendar-guardian] Failed to fetch sessions:", error.message);
    return;
  }

  if (!sessions?.length) return;

  for (const row of sessions) {
    try {
      const session = row as unknown as Session;
      const collected = (session.collected_data ?? {}) as Record<string, unknown>;
      const seedData = (collected.seed ?? collected.season ?? {}) as Record<string, string>;

      const seasonStart = seedData.startDate ?? seedData.start_date;
      const seasonEnd = seedData.endDate ?? seedData.end_date;

      if (!seasonStart || !seasonEnd) continue;

      const seasonDates: SeasonDates = {
        season_start: seasonStart,
        season_end: seasonEnd,
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
              season_start: seasonStart,
              season_end: seasonEnd,
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
