// =============================================================================
// helpers/ui-harness.ts
//
// UI capability–specific assertion helpers for ui-harness-e2e.spec.ts.
//
// Builds on botsson-harness.ts (recording + activity_trail polling).
// Adds:
//
//   assertUIToolFired(sessionId, toolName, opts)
//     — polls agent_session_recording for a tool_call row naming the tool.
//
//   assertUICapabilityClassified(sessionId, sinceIso, poll)
//     — polls agent_session_recording for a classifier_output row where
//       intent === 'ui'.
//
//   assertUIToolInvoked(toolName, sinceIso, opts)
//     — polls activity_trail for "botsson.tool_invoked" with data.tool
//       matching the given tool name AND data.success === true.
//
// UI capability design notes:
//   - All 5 tools are presentation-only — they emit broadcast directives to the
//     L1 overlay via ctx.broadcast() and return a plain string describing the action.
//   - No DB mutations occur. gate_action is NEVER called.
//   - emitPrefix is null — tools do NOT emit via the @smartout/telemetry emit()
//     helper. The "botsson.tool_invoked" trail entry is written by the stage-engine
//     Vercel AI adapter (vercel-ai.ts) after tool execution, not by the tool body.
//   - toolAuthPattern="direct_admin" — same godmode gate as business_intelligence.
//   - allowedChannels: ["chat", "voice", "sms", "email"] — no channel guard;
//     UI directives are safe across all channels (no PII exfiltration path).
//
// ADR refs: ADR-0078 (channel guard — UI explicitly exempted from voice block),
//           ADR-0099 (gate_action — absent by design for UI tools),
//           ADR-0134 (telemetry — tool_invoked fired by adapter, not tool body),
//           ADR-0151 (server-side profile_id derivation),
//           ADR-0163 (presentation-only tools, no data exfiltration),
//           ADR-0184 (recorder), ADR-0270 (godmode-only toolAuthPattern).
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
// assertUIToolFired
// ---------------------------------------------------------------------------

/**
 * Poll agent_session_recording for a `tool_call` row naming the given ui tool.
 * Returns the matched row.
 *
 * The tool was invoked if the row exists — the spec verifies pipe completeness
 * (session recording, telemetry) rather than broadcast delivery (L1 overlay
 * is not under Playwright control).
 */
export async function assertUIToolFired(
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
// assertUICapabilityClassified
// ---------------------------------------------------------------------------

/**
 * Poll agent_session_recording for a classifier_output row where
 * intent === 'ui'. Returns the matched row.
 */
export async function assertUICapabilityClassified(
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
      return typeof content?.intent === "string" && content.intent === "ui";
    },
    sinceIso,
    poll: poll ?? { timeoutMs: 25_000 },
  });
}

// ---------------------------------------------------------------------------
// assertUIToolInvoked
// ---------------------------------------------------------------------------

/**
 * Poll activity_trail for a "botsson.tool_invoked" event where:
 *   data.tool === toolName
 *   data.success === true
 *   data.capability === 'ui'
 *
 * The adapter (vercel-ai.ts) emits this event after every tool execution.
 * success=true confirms the tool body returned without throwing.
 */
export async function assertUIToolInvoked(
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
      return data?.tool === toolName && data?.success === true;
    },
    sinceIso,
    poll: opts.poll ?? { timeoutMs: 25_000 },
  });
}
