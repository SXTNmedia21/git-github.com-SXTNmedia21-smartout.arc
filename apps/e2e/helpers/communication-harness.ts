// =============================================================================
// helpers/communication-harness.ts
//
// Communication-capability-specific assertion helpers for
// communication-harness-e2e.spec.ts.
//
// Builds on the base assertion helpers in botsson-harness.ts.  This file adds:
//
//   assertCommToolFired(sessionId, toolName, opts)
//     — polls agent_session_recording for a tool_call row naming the tool.
//
//   assertCommCapabilityClassified(sessionId, sinceIso, poll)
//     — polls agent_session_recording for a classifier_output row where
//       intent === 'communication'.
//
//   assertBotssonToolInvokedForComm(toolName, sinceIso, opts)
//     — polls activity_trail for "botsson.tool_invoked" with data.tool
//       matching the given comm tool name.
//
//   ensureCommChannelAndMembership(workspaceId, profileId)
//     — idempotent: inserts a test channel + channel_member row so
//       get_conversations / get_unread_count / send_message have data.
//
//   cleanupCommSeedData(channelId)
//     — deletes channel_message, channel_member, channel rows seeded by
//       the helpers above.  Safe to call in afterAll.
//
// ADR refs: ADR-0078 (channel guard), ADR-0099 (gate_action),
//           ADR-0134 (telemetry), ADR-0151 (server-side profile_id derivation),
//           ADR-0163 (channel AI policy), ADR-0184 (recorder),
//           ADR-0287 (gate_action mandatory).
// =============================================================================

import { expect } from "@playwright/test";
import {
  assertRecordingPhase,
  assertActivityTrailEvent,
  type RecordingRow,
  type ActivityTrailRow,
  SEED_WORKSPACE_ID,
  SEED_PROFILE_ID,
} from "./botsson-harness";
import { supabase } from "./seed";

export { SEED_WORKSPACE_ID, SEED_PROFILE_ID };

// ---------------------------------------------------------------------------
// PollOptions — mirrors the unexported type in botsson-harness.ts
// ---------------------------------------------------------------------------
export type PollOptions = {
  timeoutMs?: number;
  intervalMs?: number;
};

// ---------------------------------------------------------------------------
// Deterministic seed IDs so helpers are idempotent across test runs.
// ---------------------------------------------------------------------------

/** Seed channel for the communication E2E tests. */
export const SEED_CHANNEL_ID = "c0mm0000-e2e0-0000-0000-000000000001";

// ---------------------------------------------------------------------------
// ensureCommChannelAndMembership
// ---------------------------------------------------------------------------

/**
 * Idempotent: inserts a test `channel` row and a matching `channel_member`
 * for the seed profile if they do not already exist.
 *
 * The channel uses type='custom' (most permissive, no required FK to
 * department/team/session) and sets no channel_ai_policy row — the policy
 * layer defaults to `mention_only`, which means `is_proactive=false`
 * (the default for tool invocations) will be accepted.
 *
 * Returns the channel_id (SEED_CHANNEL_ID).
 */
export async function ensureCommChannelAndMembership(
  workspaceId: string = SEED_WORKSPACE_ID,
  profileId: string = SEED_PROFILE_ID,
): Promise<string> {
  // Upsert the channel row.
  const { error: channelError } = await supabase.from("channel").upsert(
    {
      id: SEED_CHANNEL_ID,
      workspace_id: workspaceId,
      channel_type: "custom",
      name: "E2E Communication Test Channel",
      description: "Seeded by communication-harness-e2e spec",
      is_archived: false,
      is_read_only: false,
    },
    { onConflict: "id", ignoreDuplicates: true },
  );

  if (channelError) {
    console.warn(
      `ensureCommChannelAndMembership: channel upsert failed: ${channelError.message}. ` +
        "Tests will degrade gracefully.",
    );
    return SEED_CHANNEL_ID;
  }

  // Upsert the membership row.
  const { error: memberError } = await supabase.from("channel_member").upsert(
    {
      channel_id: SEED_CHANNEL_ID,
      workspace_id: workspaceId,
      profile_id: profileId,
      role: "member",
      is_ai: false,
    },
    { onConflict: "channel_id,profile_id", ignoreDuplicates: true },
  );

  if (memberError) {
    console.warn(
      `ensureCommChannelAndMembership: member upsert failed: ${memberError.message}. ` +
        "send_message will be denied as non-member; tests will degrade gracefully.",
    );
  }

  return SEED_CHANNEL_ID;
}

// ---------------------------------------------------------------------------
// ensureCommAuthoritySeeded
// ---------------------------------------------------------------------------

/**
 * Upsert an engine_authority_config row granting the seed workspace 'suggest'
 * authority on the `communication` capability. `suggest` exposes
 * readOnlyTools + suggestTools (which includes send_message) to the LLM.
 *
 * Idempotent — safe to call in beforeAll.  Uses DO NOTHING on conflict.
 */
export async function ensureCommAuthoritySeeded(
  workspaceId: string = SEED_WORKSPACE_ID,
): Promise<void> {
  const { error } = await supabase.from("engine_authority_config").upsert(
    {
      workspace_id: workspaceId,
      capability: "communication",
      level: "suggest",
      min_role: "employee",
      requires_four_eyes: false,
      updated_by: SEED_PROFILE_ID,
    },
    { onConflict: "workspace_id,capability", ignoreDuplicates: false },
  );

  if (error) {
    console.warn(
      `ensureCommAuthoritySeeded: authority upsert failed: ${error.message}. ` +
        "Communication tools may not be exposed to the LLM.",
    );
  }
}

// ---------------------------------------------------------------------------
// cleanupCommSeedData
// ---------------------------------------------------------------------------

/**
 * Delete channel_message, channel_member, channel rows for the test channel.
 * Safe to call in afterAll — no-ops if rows are already deleted.
 * Does NOT delete engine_authority_config (shared across test runs).
 */
export async function cleanupCommSeedData(channelId: string = SEED_CHANNEL_ID): Promise<void> {
  await supabase.from("channel_message").delete().eq("channel_id", channelId);
  await supabase.from("channel_member").delete().eq("channel_id", channelId);
  await supabase.from("channel").delete().eq("id", channelId);
}

// ---------------------------------------------------------------------------
// assertCommToolFired
// ---------------------------------------------------------------------------

/**
 * Poll agent_session_recording for a `tool_call` row naming the given
 * communication tool.  Returns the matched row.
 */
export async function assertCommToolFired(
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
    poll: opts.poll ?? { timeoutMs: 20_000 },
  });
}

// ---------------------------------------------------------------------------
// assertCommCapabilityClassified
// ---------------------------------------------------------------------------

/**
 * Poll agent_session_recording for a classifier_output row where
 * intent === 'communication'.  Returns the matched row.
 */
export async function assertCommCapabilityClassified(
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
      return typeof content?.intent === "string" && content.intent === "communication";
    },
    sinceIso,
    poll: poll ?? { timeoutMs: 20_000 },
  });
}

// ---------------------------------------------------------------------------
// assertBotssonToolInvokedForComm
// ---------------------------------------------------------------------------

/**
 * Poll activity_trail for a "botsson.tool_invoked" event where data.tool
 * matches the given communication tool name.
 */
export async function assertBotssonToolInvokedForComm(
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
    poll: opts.poll ?? { timeoutMs: 20_000 },
  });
}

// ---------------------------------------------------------------------------
// assertNoRawPiiInCommResponse
// ---------------------------------------------------------------------------

/**
 * Assert the response does NOT contain personnummer-like sequences
 * (11-digit Norwegian ID numbers) or raw bank account identifiers.
 * Channel message body content (e.g. names, shift times) is NOT PII —
 * this guard targets identifier sequences only.
 */
export function assertNoRawPiiInCommResponse(responseText: string, context: string): void {
  // Norwegian personnummer: 11 consecutive digits (6 date + 5 individual).
  const personnummerPattern = /\b\d{11}\b/;
  expect(
    personnummerPattern.test(responseText),
    `${context}: response contains 11-digit sequence (possible personnummer). ` +
      `Response: "${responseText.slice(0, 200)}"`,
  ).toBe(false);

  // Norwegian bank account in BBBBB.BB.BBBBB dotted form.
  const bankAccountPattern = /\d{4,5}\.\d{2}\.\d{5}/;
  expect(
    bankAccountPattern.test(responseText),
    `${context}: response contains Norwegian bank account format. ` +
      `Response: "${responseText.slice(0, 200)}"`,
  ).toBe(false);
}
