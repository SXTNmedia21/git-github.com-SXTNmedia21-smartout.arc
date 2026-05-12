// =============================================================================
// helpers/business-intelligence-harness.ts
//
// Business-intelligence–specific assertion helpers for
// business-intelligence-harness-e2e.spec.ts.
//
// Builds on botsson-harness.ts (recording + activity_trail polling).
// Adds:
//
//   assertBIToolFired(sessionId, toolName, opts)
//     — polls agent_session_recording for a tool_call row naming the tool.
//
//   assertBICapabilityClassified(sessionId, sinceIso, poll)
//     — polls agent_session_recording for a classifier_output row where
//       intent === 'business_intelligence'.
//
//   assertBIToolInvoked(toolName, sinceIso, opts)
//     — polls activity_trail for "botsson.tool_invoked" with data.tool
//       matching the given tool name.
//
// ADR refs: ADR-0078 (chat-only), ADR-0134 (telemetry), ADR-0151 (server-side
//           profile_id), ADR-0184 (recorder), ADR-0270 (godmode-only BI toolkit).
// =============================================================================

import {
  assertRecordingPhase,
  assertActivityTrailEvent,
  type RecordingRow,
  type ActivityTrailRow,
  SEED_WORKSPACE_ID,
  SEED_PROFILE_ID,
} from "./botsson-harness";

export { SEED_WORKSPACE_ID, SEED_PROFILE_ID };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PollOptions = {
  timeoutMs?: number;
  intervalMs?: number;
};

// ---------------------------------------------------------------------------
// assertBIToolFired
// ---------------------------------------------------------------------------

/**
 * Poll agent_session_recording for a `tool_call` row naming the given
 * business_intelligence tool.  Returns the matched row.
 *
 * The tool was invoked if the row exists regardless of whether scrapling
 * returned data or an error — the pipe is verified, not the external service.
 */
export async function assertBIToolFired(
  sessionId: string,
  toolName: string,
  opts: {
    sinceIso?: string;
    poll?: PollOptions;
  } = {},
): Promise<RecordingRow> {
  return assertRecordingPhase({
    sessionId,
    phase: "tool_call",
    turnKind: "tool_invocation",
    contentPredicate: (c) => {
      const content = c as Record<string, unknown>;
      return typeof content?.tool_name === "string" && content.tool_name === toolName;
    },
    sinceIso: opts.sinceIso,
    poll: opts.poll ?? { timeoutMs: 25_000 },
  });
}

// ---------------------------------------------------------------------------
// assertBICapabilityClassified
// ---------------------------------------------------------------------------

/**
 * Poll agent_session_recording for a classifier_output row where
 * intent === 'business_intelligence'.  Returns the matched row.
 */
export async function assertBICapabilityClassified(
  sessionId: string,
  sinceIso: string,
  poll?: PollOptions,
): Promise<RecordingRow> {
  return assertRecordingPhase({
    sessionId,
    phase: "classifier_output",
    turnKind: "user_input",
    contentPredicate: (c) => {
      const content = c as Record<string, unknown>;
      return typeof content?.intent === "string" && content.intent === "business_intelligence";
    },
    sinceIso,
    poll: poll ?? { timeoutMs: 25_000 },
  });
}

// ---------------------------------------------------------------------------
// assertBIToolInvoked
// ---------------------------------------------------------------------------

/**
 * Poll activity_trail for a "botsson.tool_invoked" event where data.tool
 * matches the given tool name.
 *
 * This verifies the Vercel AI adapter emitted the telemetry event after the
 * tool executed (ADR-0134 + vercel-ai.ts:59).
 */
export async function assertBIToolInvoked(
  toolName: string,
  sinceIso: string,
  opts: {
    workspaceId?: string;
    actorId?: string;
    poll?: PollOptions;
  } = {},
): Promise<ActivityTrailRow> {
  return assertActivityTrailEvent({
    event: "botsson.tool_invoked",
    workspaceId: opts.workspaceId ?? SEED_WORKSPACE_ID,
    actorId: opts.actorId ?? SEED_PROFILE_ID,
    dataPredicate: (d) => {
      const data = d as Record<string, unknown>;
      return data?.tool === toolName;
    },
    sinceIso,
    poll: opts.poll ?? { timeoutMs: 25_000 },
  });
}
