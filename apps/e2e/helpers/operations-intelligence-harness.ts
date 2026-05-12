// =============================================================================
// helpers/operations-intelligence-harness.ts
//
// Assertion helpers for the operations-intelligence-harness E2E spec.
// Builds on botsson-harness.ts (recording + activity_trail polling) and
// mirrors the pattern established in operations-harness.ts and
// business-intelligence-harness.ts.
//
// Capability contract:
//   - tools emit `botsson.tool_invoked` via the vercel-ai adapter wrapper
//     (packages/ai/src/adapters/vercel-ai.ts).
//   - activity_trail row: event='botsson.tool_invoked',
//     data.tool=<tool_name>, data.success=true,
//     data.capability='operations_intelligence'.
//   - triage_event additionally emits 'ops.triage classified' but that event
//     routes to logger + engine_event ONLY (not activity_trail). The
//     botsson.tool_invoked wrapper row IS the authoritative trail signal.
//   - agent_session_recording: phase='classifier_output',
//     content.intent='operations_intelligence' for operations-intelligence queries.
//   - allowedChannels=["chat"] (ADR-0163 channel guard).
//
// ADR refs: ADR-0088 (operations intelligence), ADR-0163 (channel guard),
//           ADR-0134 (telemetry), ADR-0151 (server-side workspace derivation),
//           ADR-0099 (gate_action), ADR-0184 (recorder).
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
// Seed helpers
// ---------------------------------------------------------------------------

/**
 * Seed an engine_event row for operations-intelligence E2E testing.
 * triage_event receives an event_type string parameter — this helper creates
 * a matching engine_event row so monitor-tools can also find it.
 */
export async function seedEngineEvent(opts: {
  eventType: string;
  payload?: Record<string, unknown>;
}): Promise<string> {
  const { data, error } = await supabase
    .from("engine_event")
    .insert({
      workspace_id: SEED_WORKSPACE_ID,
      event_type: opts.eventType,
      payload: opts.payload ?? {},
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`seedEngineEvent failed: ${error?.message ?? "no data returned"}`);
  }
  return data.id as string;
}

/**
 * Delete engine_event rows seeded during this test run.
 */
export async function cleanupEngineEvents(eventIds: string[]): Promise<void> {
  if (eventIds.length === 0) return;
  await supabase.from("engine_event").delete().in("id", eventIds);
}

/**
 * Delete activity_trail rows emitted for operations_intelligence during this
 * test run. Scoped to workspace_id + sinceIso.
 */
export async function cleanupOpsIntelligenceTrail(sinceIso: string): Promise<void> {
  await supabase
    .from("activity_trail")
    .delete()
    .eq("workspace_id", SEED_WORKSPACE_ID)
    .gte("created_at", sinceIso)
    .in("event", ["botsson.tool_invoked", "botsson.tool_failed"]);
}

// ---------------------------------------------------------------------------
// Core assertion: ops-intelligence tool fired (via botsson.tool_invoked trail)
// ---------------------------------------------------------------------------

/**
 * Assert that a specific operations-intelligence tool was invoked by checking
 * activity_trail for `botsson.tool_invoked` with the expected tool name.
 *
 * Note: ops-intelligence tools emit 'ops.triage classified' / 'ops.monitor …'
 * to engine_event, not activity_trail. The botsson.tool_invoked row is emitted
 * by the vercel-ai adapter wrapper and IS the authoritative activity_trail signal.
 */
export async function assertOpsIntelligenceToolFired(opts: {
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
 * Assert that the classifier routed to 'operations_intelligence' for a given
 * session. Polls agent_session_recording for a classifier_output row.
 */
export async function assertOpsIntelligenceIntent(opts: {
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
      return typeof content?.intent === "string" && content.intent === "operations_intelligence";
    },
    sinceIso: opts.sinceIso,
    poll: { timeoutMs: 20_000, ...opts.poll },
  });

  const content = row.content_redacted as Record<string, unknown>;
  expect(content.intent, "classifier_output intent must be 'operations_intelligence'").toBe(
    "operations_intelligence",
  );
}

// ---------------------------------------------------------------------------
// BFF response assertions
// ---------------------------------------------------------------------------

/**
 * Assert that the BFF response text does not contain Norwegian/English error
 * patterns. Operations-intelligence tools should never surface "feilet",
 * "teknisk feil", etc. on a successful triage invocation.
 */
export async function assertNoOpsIntelligenceError(
  responseText: string,
  label: string,
): Promise<void> {
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
