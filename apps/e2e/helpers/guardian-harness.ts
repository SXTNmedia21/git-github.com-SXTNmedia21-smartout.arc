// =============================================================================
// helpers/guardian-harness.ts
//
// Seed helpers and assertion utilities for guardian-harness-e2e.spec.ts.
//
// Builds on botsson-harness.ts. Adds:
//
//   ensureGuardianAuthority(workspaceId?)
//     — ensures engine_authority_config has level='suggest' for the guardian
//       capability in the seed workspace. The migration
//       20260314000000_guardian_signal.sql seeds this for all active workspaces
//       via a JOIN on profile (owner/admin). CI clean DBs may miss it if the
//       owner FK is not yet satisfied. This helper is idempotent via
//       ON CONFLICT DO NOTHING.
//
//   seedGuardianSignal(opts)
//     — inserts a minimal guardian_signal row for the seed workspace.
//       Used to give get_signals and acknowledge_signal real data.
//       Returns the seeded signal id.
//
//   cleanupGuardianSignals(sinceIso)
//     — removes guardian_signal rows created after sinceIso for the seed
//       workspace. Best-effort — errors are logged, not thrown.
//
//   assertGuardianToolFired(sessionId, toolName, opts)
//     — polls agent_session_recording for a tool_call row naming the given
//       guardian tool.
//
//   assertGuardianCapabilityClassified(sessionId, sinceIso, poll)
//     — polls agent_session_recording for a classifier_output row where
//       intent === 'guardian'.
//
//   assertGuardianTrailEvent(toolName, sinceIso, opts)
//     — polls activity_trail for "botsson.tool_invoked" with data.tool
//       matching the given guardian tool name.
//
// ADR refs: ADR-0134 (telemetry), ADR-0151 (server-side profile_id),
//           ADR-0163 (channel guard — guardian allows all channels),
//           ADR-0184 (recorder).
//
// Gap note — G3/G4 pattern: acknowledge_signal has no gate_action call in
// the tool body (packages/ai/src/capabilities/guardian/tools.ts). This is a
// known compliance gap. The spec tests the acknowledge path anyway because the
// BFF pipe must work end-to-end regardless of the internal gate gap. Do NOT
// attempt to fix the gate in this file.
// =============================================================================

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
// PollOptions re-export
// ---------------------------------------------------------------------------

export type PollOptions = {
  timeoutMs?: number;
  intervalMs?: number;
};

// ---------------------------------------------------------------------------
// ensureGuardianAuthority
// ---------------------------------------------------------------------------

/**
 * Ensure engine_authority_config has a 'suggest' row for the guardian
 * capability in the seed workspace.
 *
 * The guardian migration seeds this for all active workspaces with an
 * owner/admin profile — but in CI the migration-time JOIN may not find the
 * seed workspace if seeds run after migrations. This helper is a fallback.
 *
 * Idempotent: ON CONFLICT DO NOTHING preserves any existing higher-level row.
 */
export async function ensureGuardianAuthority(
  workspaceId: string = SEED_WORKSPACE_ID,
): Promise<void> {
  const { error } = await supabase.from("engine_authority_config").upsert(
    {
      workspace_id: workspaceId,
      capability: "guardian",
      level: "suggest",
      min_role: "employee",
      requires_four_eyes: false,
    },
    { onConflict: "workspace_id,capability", ignoreDuplicates: true },
  );

  if (error) {
    // Log but don't throw — a missing authority row means the gate returns
    // deny with a reason string, not a server panic. Tests will still run
    // and the BFF pipe will be exercised.
    console.warn(`ensureGuardianAuthority: upsert warning: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// cleanupGuardianAuthority
// ---------------------------------------------------------------------------

/**
 * Remove the test-seeded guardian authority row for the given workspace.
 * Only removes 'suggest' level to avoid touching existing higher-level rows.
 */
export async function cleanupGuardianAuthority(
  workspaceId: string = SEED_WORKSPACE_ID,
): Promise<void> {
  const { error } = await supabase
    .from("engine_authority_config")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("capability", "guardian")
    .eq("level", "suggest");

  if (error) {
    console.warn(`cleanupGuardianAuthority: delete warning: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// seedGuardianSignal
// ---------------------------------------------------------------------------

export type SeededSignal = {
  id: string;
  workspace_id: string;
  signal_type: string;
  domain: string;
  severity: string;
  status: string;
  title: string;
};

/**
 * Insert a minimal guardian_signal row for the seed workspace.
 * Returns the seeded row for use in subsequent assertions.
 *
 * Caller is responsible for cleanup via cleanupGuardianSignals(sinceIso).
 */
export async function seedGuardianSignal(opts: {
  domain?: "readiness" | "workspace_maturity" | "agent_behavior" | "journey_health";
  severity?: "info" | "warning" | "critical";
  status?: "active" | "acknowledged" | "resolved" | "dismissed";
  title?: string;
  workspaceId?: string;
}): Promise<SeededSignal> {
  const workspaceId = opts.workspaceId ?? SEED_WORKSPACE_ID;
  const domain = opts.domain ?? "workspace_maturity";
  const severity = opts.severity ?? "warning";
  const status = opts.status ?? "active";
  const title = opts.title ?? `E2E harness test signal [${domain}/${severity}] ${Date.now()}`;

  const { data, error } = await supabase
    .from("guardian_signal")
    .insert({
      workspace_id: workspaceId,
      signal_type: "e2e_harness_test",
      domain,
      severity,
      status,
      title,
      description: "Created by guardian-harness-e2e.spec.ts — safe to delete.",
    })
    .select("id, workspace_id, signal_type, domain, severity, status, title")
    .single();

  if (error || !data) {
    throw new Error(`seedGuardianSignal: insert failed: ${error?.message ?? "no data returned"}`);
  }

  return data as SeededSignal;
}

// ---------------------------------------------------------------------------
// cleanupGuardianSignals
// ---------------------------------------------------------------------------

/**
 * Delete guardian_signal rows created after sinceIso for the seed workspace.
 * Also removes acknowledged rows where acknowledged_by = SEED_PROFILE_ID.
 * Best-effort — errors are logged, not thrown.
 */
export async function cleanupGuardianSignals(
  sinceIso: string,
  workspaceId: string = SEED_WORKSPACE_ID,
): Promise<void> {
  const { error } = await supabase
    .from("guardian_signal")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("signal_type", "e2e_harness_test")
    .gte("created_at", sinceIso);

  if (error) {
    console.warn(`cleanupGuardianSignals: delete warning: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// assertGuardianToolFired
// ---------------------------------------------------------------------------

/**
 * Poll agent_session_recording for a tool_call row naming the given guardian
 * tool. Returns the matched row.
 */
export async function assertGuardianToolFired(
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
// assertGuardianCapabilityClassified
// ---------------------------------------------------------------------------

/**
 * Poll agent_session_recording for a classifier_output row where
 * intent === 'guardian'. Returns the matched row.
 */
export async function assertGuardianCapabilityClassified(
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
      return typeof content?.intent === "string" && content.intent === "guardian";
    },
    sinceIso,
    poll: poll ?? { timeoutMs: 20_000 },
  });
}

// ---------------------------------------------------------------------------
// assertGuardianTrailEvent
// ---------------------------------------------------------------------------

/**
 * Poll activity_trail for "botsson.tool_invoked" with data.tool matching the
 * given guardian tool name. Returns the matched row.
 */
export async function assertGuardianTrailEvent(
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
