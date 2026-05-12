// =============================================================================
// helpers/operations-harness.ts
//
// Assertion helpers for the operations-harness E2E spec.
// Re-uses the shared DB client and polling infrastructure from botsson-harness.ts.
//
// All functions poll with configurable timeout to accommodate the fire-and-forget
// recorder flush interval (ADR-0184). On timeout, each function includes a
// diagnostic dump so failures are actionable without separate log inspection.
//
// Capability contract:
//   - operations tools emit `botsson.tool_invoked` via toVercelTools() wrapper
//     (packages/ai/src/adapters/vercel-ai.ts).
//   - activity_trail row: event='botsson.tool_invoked',
//     data.tool=<tool_name>, data.success=true, data.capability='operations'.
//   - agent_session_recording: phase='classifier_output',
//     content.intent='operations' for any operations query.
//   - allowedChannels=["chat"] (ADR-0163 channel guard). Voice requests must be
//     rejected at the capability boundary.
//
// ADR refs: ADR-0184 (recorder), ADR-0078 (channel guard), ADR-0134 (telemetry),
//           ADR-0151 (server-side workspace derivation), ADR-0099 (gate_action).
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

export type SeededSession = {
  department_session_id: string;
  workspace_id: string;
  department_id: string;
  session_date: string;
};

export type SeededTask = {
  id: string;
  workspace_id: string;
  title: string;
  status: string;
};

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

/**
 * Seed a department_session row for today in the seed workspace.
 * Used to give get_session_info and get_department_status real data.
 */
export async function seedTodaySession(
  departmentId: string,
  status: "upcoming" | "active" = "active",
): Promise<SeededSession> {
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("department_session")
    .insert({
      workspace_id: SEED_WORKSPACE_ID,
      department_id: departmentId,
      session_date: today,
      status,
    })
    .select("department_session_id, workspace_id, department_id, session_date")
    .single();

  if (error || !data) {
    throw new Error(`seedTodaySession failed: ${error?.message ?? "no data returned"}`);
  }
  return data as SeededSession;
}

/**
 * Seed a session_task row assigned to the seed profile.
 * Used to give get_my_tasks real data to return.
 */
export async function seedPendingTask(
  departmentSessionId: string,
  title = "E2E test task",
): Promise<SeededTask> {
  const { data, error } = await supabase
    .from("session_task")
    .insert({
      workspace_id: SEED_WORKSPACE_ID,
      department_session_id: departmentSessionId,
      assigned_to: SEED_PROFILE_ID,
      title,
      task_type: "general",
      status: "pending",
      priority: "normal",
    })
    .select("id, workspace_id, title, status")
    .single();

  if (error || !data) {
    throw new Error(`seedPendingTask failed: ${error?.message ?? "no data returned"}`);
  }
  return data as SeededTask;
}

// ---------------------------------------------------------------------------
// Cleanup helpers
// ---------------------------------------------------------------------------

/**
 * Delete department_session rows seeded during this test run.
 * Scoped by workspace_id + provided IDs.
 */
export async function cleanupTestSessions(sessionIds: string[]): Promise<void> {
  if (sessionIds.length === 0) return;
  await supabase.from("department_session").delete().in("department_session_id", sessionIds);
}

/**
 * Delete session_task rows seeded during this test run.
 * Scoped by workspace_id + provided IDs.
 */
export async function cleanupTestTasks(taskIds: string[]): Promise<void> {
  if (taskIds.length === 0) return;
  await supabase.from("session_task").delete().in("id", taskIds);
}

/**
 * Delete deviation rows created during this test run for the seed profile.
 * Scoped by workspace_id + sinceIso.
 */
export async function cleanupTestDeviations(sinceIso: string): Promise<void> {
  await supabase
    .from("deviation")
    .delete()
    .eq("workspace_id", SEED_WORKSPACE_ID)
    .eq("reported_by", SEED_PROFILE_ID)
    .gte("created_at", sinceIso);
}

/**
 * Delete activity_trail rows emitted during this test run.
 * Scoped by workspace_id + sinceIso to avoid disturbing earlier rows.
 */
export async function cleanupOperationsTrail(sinceIso: string): Promise<void> {
  await supabase
    .from("activity_trail")
    .delete()
    .eq("workspace_id", SEED_WORKSPACE_ID)
    .gte("created_at", sinceIso)
    .in("event", [
      "botsson.tool_invoked",
      "botsson.tool_failed",
      "deviation reported",
      "session_task completed",
    ]);
}

// ---------------------------------------------------------------------------
// Core assertion: operations tool fired
// ---------------------------------------------------------------------------

/**
 * Assert that a specific operations tool was invoked during a session by
 * checking activity_trail for `botsson.tool_invoked` with the expected tool name.
 */
export async function assertOperationsToolFired(opts: {
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
 * Assert that the classifier routed to the 'operations' capability for a
 * given session. Polls agent_session_recording for a classifier_output row.
 */
export async function assertOperationsIntent(opts: {
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
      return typeof content?.intent === "string" && content.intent === "operations";
    },
    sinceIso: opts.sinceIso,
    poll: { timeoutMs: 20_000, ...opts.poll },
  });

  const content = row.content_redacted as Record<string, unknown>;
  expect(content.intent, "classifier_output intent must be 'operations'").toBe("operations");
}

// ---------------------------------------------------------------------------
// BFF response assertions
// ---------------------------------------------------------------------------

/**
 * Assert that the BFF response text does not contain common Norwegian error
 * patterns. Operations tools should never surface "feilet", "teknisk feil",
 * etc. for a successful read query.
 */
export async function assertNoOperationsError(responseText: string, label: string): Promise<void> {
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
