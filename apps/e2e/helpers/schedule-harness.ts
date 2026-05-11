// =============================================================================
// helpers/schedule-harness.ts
//
// Additional assertion helpers for the schedule-harness E2E spec.
// Re-uses the shared DB client and polling infrastructure from botsson-harness.ts.
//
// All functions poll with configurable timeout to accommodate the fire-and-forget
// recorder flush interval (ADR-0184). On timeout, each function includes a
// diagnostic dump so failures are actionable without separate log inspection.
//
// Capability contract:
//   - schedule tools emit `botsson.tool_invoked` via toVercelTools() wrapper
//     (packages/ai/src/adapters/vercel-ai.ts).
//   - activity_trail row: event='botsson.tool_invoked',
//     data.tool=<tool_name>, data.success=true, data.capability='schedule'.
//   - agent_session_recording: phase='classifier_output',
//     content.intent='schedule' for any schedule query.
//
// ADR refs: ADR-0184 (recorder), ADR-0078 (channel guard), ADR-0134 (telemetry),
//           ADR-0151 (server-side workspace derivation).
// =============================================================================

import { expect } from "@playwright/test";
import {
  SEED_PROFILE_ID,
  SEED_WORKSPACE_ID,
  assertActivityTrailEvent,
  assertRecordingPhase,
  dumpStageEngineLogs,
} from "./botsson-harness";
import { supabase } from "./seed";

export { SEED_PROFILE_ID, SEED_WORKSPACE_ID };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PollOptions = {
  timeoutMs?: number;
  intervalMs?: number;
};

// ---------------------------------------------------------------------------
// Schedule-specific cleanup
// ---------------------------------------------------------------------------

/**
 * Delete schedule_shift rows created during this test run for the seed workspace.
 * Scoped by workspace_id + a future-date window so existing prod-like seed data
 * (past shifts) is not touched.
 */
export async function cleanupTestShifts(shiftIds: string[]): Promise<void> {
  if (shiftIds.length === 0) return;
  await supabase.from("schedule_shift").delete().in("schedule_shift_id", shiftIds);
}

/**
 * Delete activity_trail rows emitted during this test run for the seed workspace.
 * Scoped by workspace_id + sinceIso to avoid disturbing earlier rows.
 */
export async function cleanupScheduleTrail(sinceIso: string): Promise<void> {
  await supabase
    .from("activity_trail")
    .delete()
    .eq("workspace_id", SEED_WORKSPACE_ID)
    .gte("created_at", sinceIso)
    .in("event", [
      "botsson.tool_invoked",
      "botsson.tool_failed",
      "agent.schedule.workspace_queried",
      "agent.schedule.date_queried_self",
    ]);
}

// ---------------------------------------------------------------------------
// Shift seed helpers
// ---------------------------------------------------------------------------

export type SeededShift = {
  schedule_shift_id: string;
  workspace_id: string;
  employee_id: string | null;
  shift_date: string;
  start_time: string;
  end_time: string;
};

/**
 * Seed a future schedule_shift for the seed profile in the seed workspace.
 * Returns the inserted row. Used to give schedule tools real data to return.
 *
 * @param daysAhead - Number of days in the future (default: 3, keeps tests stable)
 * @param startHour - Oslo wall-clock start hour, 0-23 (default: 9)
 */
export async function seedFutureShift(daysAhead = 3, startHour = 9): Promise<SeededShift> {
  // Compute the future date in a way that always gives a valid YYYY-MM-DD.
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  const shiftDate = d.toISOString().slice(0, 10);
  const startTime = `${String(startHour).padStart(2, "0")}:00:00`;
  const endTime = `${String(startHour + 4).padStart(2, "0")}:00:00`;

  const { data, error } = await supabase
    .from("schedule_shift")
    .insert({
      workspace_id: SEED_WORKSPACE_ID,
      shift_date: shiftDate,
      start_time: startTime,
      end_time: endTime,
      employee_id: SEED_PROFILE_ID,
      day_category: "morning",
      role: "server",
      status: "published",
      is_published: true,
    })
    .select("schedule_shift_id, workspace_id, employee_id, shift_date, start_time, end_time")
    .single();

  if (error || !data) {
    throw new Error(`seedFutureShift failed: ${error?.message ?? "no data returned"}`);
  }
  return data as SeededShift;
}

// ---------------------------------------------------------------------------
// Core assertion: schedule tool fired
// ---------------------------------------------------------------------------

/**
 * Assert that a specific schedule tool was invoked during a session by checking
 * the activity_trail for `botsson.tool_invoked` with the expected tool name.
 *
 * This mirrors the A8 assertion in botsson-harness-e2e.spec.ts but is
 * parameterised on tool name so all schedule tools share the same pattern.
 */
export async function assertScheduleToolFired(opts: {
  toolName: string;
  sinceIso: string;
  poll?: PollOptions;
}): Promise<void> {
  await assertActivityTrailEvent({
    event: "botsson.tool_invoked",
    workspaceId: SEED_WORKSPACE_ID,
    actorId: SEED_PROFILE_ID,
    dataPredicate: (d) => {
      const data = d as Record<string, unknown>;
      return data?.tool === opts.toolName && data?.success === true;
    },
    sinceIso: opts.sinceIso,
    poll: { timeoutMs: 20_000, ...opts.poll },
  });
}

/**
 * Assert that the classifier routed to the 'schedule' capability for a given
 * session. Polls agent_session_recording for a classifier_output row.
 */
export async function assertScheduleIntent(opts: {
  sessionId: string;
  sinceIso: string;
  poll?: PollOptions;
}): Promise<void> {
  const row = await assertRecordingPhase({
    sessionId: opts.sessionId,
    phase: "classifier_output",
    turnKind: "user_input",
    contentPredicate: (c) => {
      const content = c as Record<string, unknown>;
      return typeof content?.intent === "string" && content.intent === "schedule";
    },
    sinceIso: opts.sinceIso,
    poll: { timeoutMs: 20_000, ...opts.poll },
  });

  const content = row.content_redacted as Record<string, unknown>;
  expect(content.intent, "classifier_output intent must be 'schedule'").toBe("schedule");
}

// ---------------------------------------------------------------------------
// BFF response assertions
// ---------------------------------------------------------------------------

/**
 * Assert that the BFF response text does not contain common Norwegian error patterns.
 * The schedule tools should never surface "feilet", "teknisk feil", etc. for
 * a successful query.
 */
export async function assertNoScheduleError(responseText: string, label: string): Promise<void> {
  const errorPattern = /feilet|teknisk feil|beklager.*ikke|dessverre|ikke tilgjengelig/i;
  if (errorPattern.test(responseText)) {
    const logs = await dumpStageEngineLogs();
    expect(
      responseText,
      `${label}: assistant returned an error-patterned response.\n\n` +
        `Response: "${responseText}"\n\n` +
        `Stage-engine logs:\n${logs}`,
    ).not.toMatch(errorPattern);
  }
  expect(responseText.length, `${label}: assistant response is empty`).toBeGreaterThan(0);
}
