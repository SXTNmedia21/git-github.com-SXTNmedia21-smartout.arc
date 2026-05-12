// =============================================================================
// helpers/availability-harness.ts
//
// Availability-capability-specific assertion helpers for
// availability-harness-e2e.spec.ts.
//
// Builds on botsson-harness.ts. This file adds:
//
//   ensureAvailabilityAuthority(workspaceId)
//     — idempotent upsert of the three engine_authority_config rows for
//       availability.set_own / availability.clear_own / availability.query_others.
//
//   assertAvailabilityToolFired(sessionId, toolName, opts)
//     — polls agent_session_recording for a tool_call row naming the tool.
//
//   assertAvailabilityCapabilityClassified(sessionId, sinceIso, poll)
//     — polls agent_session_recording for a classifier_output row where
//       intent === 'availability'.
//
//   assertAvailabilityTrailEvent(toolName, sinceIso, opts)
//     — polls activity_trail for the availability.* event emitted by the tool.
//     — NOTE: availability.queried routes to posthog+logger+activity_trail (3
//       destinations, no engine_event per L-0023). set_own + cleared route to
//       all 4 destinations (including activity_trail). All three tools fire to
//       activity_trail per telemetry registry.
//
//   assertAvailabilityRow(availabilityId, opts)
//     — polls employee_availability for a row by ID + profile + workspace.
//
//   cleanupAvailabilityRows(profileId, workspaceId, sinceIso)
//     — deletes employee_availability rows created by this run (scoped).
//
// ADR refs: ADR-0078 (channel guard), ADR-0099 (gate_action), ADR-0134
//           (telemetry), ADR-0151 (server-side profile_id), ADR-0184 (recorder),
//           ADR-0200 (three-table model), ADR-0201 (gate_action mandatory),
//           ADR-0202 (voice policy split).
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
// ensureAvailabilityAuthority
// ---------------------------------------------------------------------------

/**
 * Ensure the three engine_authority_config rows for the availability capability
 * family are present for the given workspace. Mirrors the seed from
 * 20260518200002_seed_availability_authority.sql.
 *
 * Idempotent via ON CONFLICT DO NOTHING (ignoreDuplicates: true).
 * Uses 'autonomous' for set_own/clear_own and 'read_only' for query_others,
 * matching the migration intent (ADR-0202).
 */
export async function ensureAvailabilityAuthority(
  workspaceId: string = SEED_WORKSPACE_ID,
): Promise<void> {
  const rows = [
    {
      workspace_id: workspaceId,
      capability: "availability.set_own",
      level: "autonomous",
      min_role: "employee",
      requires_four_eyes: false,
    },
    {
      workspace_id: workspaceId,
      capability: "availability.clear_own",
      level: "autonomous",
      min_role: "employee",
      requires_four_eyes: false,
    },
    {
      workspace_id: workspaceId,
      capability: "availability.query_others",
      level: "read_only",
      min_role: "employee",
      requires_four_eyes: false,
    },
  ];

  for (const row of rows) {
    const { error } = await supabase
      .from("engine_authority_config")
      .upsert(row, { onConflict: "workspace_id,capability", ignoreDuplicates: true });

    if (error) {
      console.warn(
        `ensureAvailabilityAuthority: upsert warning for ${row.capability}: ${error.message}`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// assertAvailabilityToolFired
// ---------------------------------------------------------------------------

/**
 * Poll agent_session_recording for a tool_call row naming the given
 * availability capability tool. Returns the matched row.
 */
export async function assertAvailabilityToolFired(
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
// assertAvailabilityCapabilityClassified
// ---------------------------------------------------------------------------

/**
 * Poll agent_session_recording for a classifier_output row where
 * intent === 'availability'. Returns the matched row.
 */
export async function assertAvailabilityCapabilityClassified(
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
      return typeof content?.intent === "string" && content.intent === "availability";
    },
    sinceIso,
    poll: poll ?? { timeoutMs: 20_000 },
  });
}

// ---------------------------------------------------------------------------
// assertAvailabilityTrailEvent
// ---------------------------------------------------------------------------

/**
 * Tool-to-event mapping for the availability capability.
 *
 * Routing per telemetry registry (ADR-0134):
 *   availability.set_own   → 4 destinations (posthog + logger + activity_trail + engine_event)
 *   availability.cleared   → 4 destinations
 *   availability.queried   → 3 destinations (posthog + logger + activity_trail; no engine_event per L-0023)
 *
 * All three fire to activity_trail, so all three can be asserted here.
 */
const TOOL_TO_EVENT: Record<string, string> = {
  set_own_availability: "availability.set_own",
  clear_own_availability: "availability.cleared",
  query_others_availability: "availability.queried",
};

export async function assertAvailabilityTrailEvent(
  toolName: string,
  sinceIso: string,
  opts: {
    workspaceId?: string;
    actorId?: string;
    poll?: PollOptions;
  } = {},
): Promise<ActivityTrailRow> {
  const event = TOOL_TO_EVENT[toolName];
  if (!event) {
    throw new Error(`assertAvailabilityTrailEvent: unknown tool name "${toolName}"`);
  }

  return assertActivityTrailEvent({
    event,
    workspaceId: opts.workspaceId ?? SEED_WORKSPACE_ID,
    actorId: opts.actorId ?? SEED_PROFILE_ID,
    sinceIso,
    poll: opts.poll ?? { timeoutMs: 20_000 },
  });
}

// ---------------------------------------------------------------------------
// assertAvailabilityRow
// ---------------------------------------------------------------------------

export type AvailabilityRow = {
  id: string;
  profile_id: string;
  workspace_id: string;
  valid_from: string;
  valid_to: string | null;
  rrule: string | null;
  preference_type: string;
  reason: string | null;
  created_at: string;
};

/**
 * Poll employee_availability for a row by id scoped to profileId +
 * workspaceId. Returns the matching row.
 */
export async function assertAvailabilityRow(
  availabilityId: string,
  opts: {
    profileId?: string;
    workspaceId?: string;
    poll?: PollOptions;
  } = {},
): Promise<AvailabilityRow> {
  const profileId = opts.profileId ?? SEED_PROFILE_ID;
  const workspaceId = opts.workspaceId ?? SEED_WORKSPACE_ID;
  const { timeoutMs = 15_000, intervalMs = 600 } = opts.poll ?? {};
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const { data } = await supabase
      .from("employee_availability")
      .select(
        "id, profile_id, workspace_id, valid_from, valid_to, rrule, preference_type, reason, created_at",
      )
      .eq("id", availabilityId)
      .eq("profile_id", profileId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (data) return data as AvailabilityRow;
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  // Diagnostic dump
  const { data: recent } = await supabase
    .from("employee_availability")
    .select("id, profile_id, workspace_id, preference_type, valid_from, created_at")
    .eq("profile_id", profileId)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(5);

  expect(
    null,
    `assertAvailabilityRow: no employee_availability row id="${availabilityId}" ` +
      `profile=${profileId} workspace=${workspaceId}.\n` +
      `Recent rows:\n${JSON.stringify(recent ?? [], null, 2)}`,
  ).not.toBeNull();

  throw new Error("unreachable");
}

// ---------------------------------------------------------------------------
// assertAvailabilityRowByPreferenceType
// ---------------------------------------------------------------------------

/**
 * Poll employee_availability for the most recent row matching profileId +
 * workspaceId + preference_type after sinceIso. Used when the exact
 * availability_id is not known beforehand (e.g. clear_own pre-seed).
 */
export async function assertAvailabilityRowByPreferenceType(
  preferenceType: string,
  sinceIso: string,
  opts: {
    profileId?: string;
    workspaceId?: string;
    poll?: PollOptions;
  } = {},
): Promise<AvailabilityRow> {
  const profileId = opts.profileId ?? SEED_PROFILE_ID;
  const workspaceId = opts.workspaceId ?? SEED_WORKSPACE_ID;
  const { timeoutMs = 15_000, intervalMs = 600 } = opts.poll ?? {};
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const { data } = await supabase
      .from("employee_availability")
      .select(
        "id, profile_id, workspace_id, valid_from, valid_to, rrule, preference_type, reason, created_at",
      )
      .eq("profile_id", profileId)
      .eq("workspace_id", workspaceId)
      .eq("preference_type", preferenceType)
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(1);

    if (data && data.length > 0) return data[0] as AvailabilityRow;
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  expect(
    null,
    `assertAvailabilityRowByPreferenceType: no employee_availability row ` +
      `preference_type="${preferenceType}" after ${sinceIso} ` +
      `for profile=${profileId} workspace=${workspaceId}.`,
  ).not.toBeNull();

  throw new Error("unreachable");
}

// ---------------------------------------------------------------------------
// cleanupAvailabilityRows
// ---------------------------------------------------------------------------

/**
 * Delete employee_availability rows for profileId + workspaceId created after
 * sinceIso. Best-effort — errors are logged, not thrown.
 */
export async function cleanupAvailabilityRows(
  profileId: string = SEED_PROFILE_ID,
  workspaceId: string = SEED_WORKSPACE_ID,
  sinceIso?: string,
): Promise<void> {
  try {
    let q = supabase
      .from("employee_availability")
      .delete()
      .eq("profile_id", profileId)
      .eq("workspace_id", workspaceId);
    if (sinceIso) q = q.gte("created_at", sinceIso);
    await q;
  } catch (err) {
    console.warn(`cleanupAvailabilityRows: ignored error: ${String(err)}`);
  }
}
