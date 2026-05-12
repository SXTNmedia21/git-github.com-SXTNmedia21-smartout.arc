// =============================================================================
// helpers/training-harness.ts
//
// Seed helpers and assertion utilities for training-harness-e2e.spec.ts.
//
// Builds on the base assertion helpers in botsson-harness.ts.  This file adds:
//
//   assertTrainingToolFired(sessionId, toolName, opts)
//     — polls agent_session_recording for a tool_call row naming the tool.
//
//   assertTrainingCapabilityClassified(sessionId, sinceIso, poll)
//     — polls agent_session_recording for a classifier_output row where
//       intent === 'training'.
//
//   assertBotssontoolInvokedFor(toolName, sinceIso, opts)
//     — polls activity_trail for "botsson.tool_invoked" with data.tool
//       matching the given tool name.
//
//   seedTrainingAuthorityForSeedWorkspace()
//     — ensures engine_authority_config has a 'suggest' row for capability
//       'training' in SEED_WORKSPACE_ID so get_team_readiness is exposed.
//       Idempotent (ON CONFLICT DO NOTHING).
//
//   cleanupTrainingAuthority()
//     — removes the test-seeded authority row after the suite runs.
//       Only removes the row seeded by this file to avoid touching
//       production-tier rows.
//
//   SEED_EMPLOYEE_PROFILE_ID
//     — profile that has protocol_assignment rows (Anna Olsen, f0..1).
//       Used for asserting get_my_training_status returns data.
//
// ADR refs: ADR-0078 (channel guard — training is chat-only per ADR-0163),
//           ADR-0134 (telemetry), ADR-0151 (server-side profile_id derivation),
//           ADR-0184 (recorder).
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

// Anna Olsen — has 2 completed protocol_assignment rows in seed.sql.
// profile_id f0000000-0000-0000-0000-000000000001
export const SEED_EMPLOYEE_PROFILE_ID = "f0000000-0000-0000-0000-000000000001";

// ---------------------------------------------------------------------------
// PollOptions — mirrors the unexported type in botsson-harness.ts
// ---------------------------------------------------------------------------
export type PollOptions = {
  timeoutMs?: number;
  intervalMs?: number;
};

// ---------------------------------------------------------------------------
// seedTrainingAuthorityForSeedWorkspace
// ---------------------------------------------------------------------------

/**
 * Ensure engine_authority_config has a row for ('training', SEED_WORKSPACE_ID)
 * with level='suggest'.  This unlocks get_team_readiness (a suggestTool) for
 * the seed workspace.
 *
 * Idempotent — ON CONFLICT DO NOTHING.  If a higher-level row already exists,
 * it is kept (DO NOTHING preserves the higher authority).
 *
 * Returns true if a new row was inserted, false if it already existed.
 */
export async function seedTrainingAuthorityForSeedWorkspace(): Promise<boolean> {
  // Check if a row already exists.
  const { data: existing } = await supabase
    .from("engine_authority_config")
    .select("level")
    .eq("workspace_id", SEED_WORKSPACE_ID)
    .eq("capability", "training")
    .maybeSingle();

  if (existing) return false;

  // Insert a 'suggest' authority row using the seed godmode user as updater.
  // If the godmode user is not found, we still attempt the insert — the
  // updated_by column accepts NULL in dev environments.
  const { data: godmodeUser } = await supabase
    .from("user_identity")
    .select("user_id")
    .eq("is_godmode", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("engine_authority_config").insert({
    workspace_id: SEED_WORKSPACE_ID,
    capability: "training",
    level: "suggest",
    min_role: "employee",
    requires_four_eyes: false,
    observer_escalation_hours: 24,
    updated_by: godmodeUser?.user_id ?? null,
  });

  if (error && !error.message.includes("duplicate")) {
    console.warn(
      `seedTrainingAuthorityForSeedWorkspace: insert failed: ${error.message}. ` +
        "get_team_readiness tests may be skipped due to insufficient authority.",
    );
    return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// cleanupTrainingAuthority
// ---------------------------------------------------------------------------

/**
 * Remove the test-seeded training authority row for SEED_WORKSPACE_ID.
 * Only removes 'suggest' level — does not touch existing higher-level rows.
 */
export async function cleanupTrainingAuthority(): Promise<void> {
  await supabase
    .from("engine_authority_config")
    .delete()
    .eq("workspace_id", SEED_WORKSPACE_ID)
    .eq("capability", "training")
    .eq("level", "suggest");
}

// ---------------------------------------------------------------------------
// assertTrainingToolFired
// ---------------------------------------------------------------------------

/**
 * Poll agent_session_recording for a `tool_call` row naming the given training tool.
 * Returns the matched row.
 */
export async function assertTrainingToolFired(
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
// assertTrainingCapabilityClassified
// ---------------------------------------------------------------------------

/**
 * Poll agent_session_recording for a classifier_output row where
 * intent === 'training'.  Returns the matched row.
 */
export async function assertTrainingCapabilityClassified(
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
      return typeof content?.intent === "string" && content.intent === "training";
    },
    sinceIso,
    poll: poll ?? { timeoutMs: 20_000 },
  });
}

// ---------------------------------------------------------------------------
// assertBotssontoolInvokedFor
// ---------------------------------------------------------------------------

/**
 * Poll activity_trail for a "botsson.tool_invoked" event where data.tool
 * matches the given training tool name.
 */
export async function assertBotssontoolInvokedFor(
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
// Direct DB helper: protocol_assignment counts for a profile
// ---------------------------------------------------------------------------

export type TrainingStatusCounts = {
  total: number;
  completed: number;
  notStarted: number;
  inProgress: number;
};

/**
 * Read protocol_assignment rows directly from DB for the given profile.
 * Used in DB sanity assertions.
 */
export async function getProtocolAssignmentCounts(
  profileId: string,
  workspaceId: string,
): Promise<TrainingStatusCounts> {
  const { data, error } = await supabase
    .from("protocol_assignment")
    .select("status")
    .eq("profile_id", profileId)
    .eq("workspace_id", workspaceId);

  if (error || !data) {
    return { total: 0, completed: 0, notStarted: 0, inProgress: 0 };
  }

  return {
    total: data.length,
    completed: data.filter((r) => r.status === "completed").length,
    notStarted: data.filter((r) => r.status === "not_started").length,
    inProgress: data.filter((r) => r.status === "in_progress").length,
  };
}
