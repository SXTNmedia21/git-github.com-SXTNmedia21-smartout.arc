// =============================================================================
// helpers/journey-authoring-harness.ts
//
// Journey-authoring–capability assertion helpers for
// journey-authoring-harness-e2e.spec.ts.
//
// Builds on base helpers in botsson-harness.ts.  This file adds:
//
//   assertAuthoringToolFired(sessionId, toolName, opts)
//     — polls agent_session_recording for a tool_call row naming the tool.
//
//   assertAuthoringCapabilityClassified(sessionId, sinceIso, poll?)
//     — polls agent_session_recording for a classifier_output row where
//       intent === 'journey_authoring' (underscore).
//
//   assertAuthoringToolInvokedFor(toolName, sinceIso, opts?)
//     — polls activity_trail for "botsson.tool_invoked" with data.tool
//       matching the given tool name.
//
//   ensureSeededWizardSession(opts?)
//     — insert a minimal wizard_session row in status='active' so save_draft
//       and publish_draft have a target row.  Returns wizard_session_id.
//       Idempotent if a row already exists for the seed profile.
//
//   cleanupAuthoringHarnessFixtures(ids)
//     — delete rows seeded by ensureSeededWizardSession + any journey/
//       journey_version rows created by publish_draft, in reverse-FK order.
//
// Key distinctions from journey-harness.ts (sister capability):
//   - journey capability (ADR-0173): run_dev / publish_mission / publish_guide /
//     run_guided — all require journey_version_id and write to engine_missions,
//     engine_stages, journey_guide, engine_state.
//   - journey_authoring capability (ADR-0239): save_draft / check_duplicates /
//     lookup_journeys / publish_draft — operate on wizard_session.draft_journey.
//     publish_draft is the only tool that writes journey + journey_version rows
//     (ADR-0240 note: these writes happen inside gatedMutation, cross-namespace
//     boundary is documented in the tool body comment).
//
// ADR refs: ADR-0078 (chat-only), ADR-0099 (gate_action via gatedMutation),
//           ADR-0134 (telemetry), ADR-0151 (server-side profile_id),
//           ADR-0184 (recorder), ADR-0204 (gatedMutation all mutations),
//           ADR-0226 (journey-authoring migration spec),
//           ADR-0239 (journey-authoring capability),
//           ADR-0240 (cross-namespace write boundary).
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
// PollOptions — mirrors the unexported type in botsson-harness.ts
// ---------------------------------------------------------------------------
export type PollOptions = {
  timeoutMs?: number;
  intervalMs?: number;
};

// ---------------------------------------------------------------------------
// Seed constants
// ---------------------------------------------------------------------------

/** user_id for the seeded admin (see seed.sql step 8). */
const ADMIN_USER_ID = "e0000000-0000-0000-0000-000000000000";

// ---------------------------------------------------------------------------
// ensureSeededWizardSession
// ---------------------------------------------------------------------------

export type SeededWizardSessionFixture = {
  wizard_session_id: string;
  workspace_id: string;
};

/**
 * Insert a minimal wizard_session row with status='active' and a pre-populated
 * draft_journey so save_draft can UPDATE it, and publish_draft can READ it.
 *
 * The draft_journey is seeded with all 5 required fields (title, module, actor,
 * platform, steps) so publish_draft validation passes without additional save_draft
 * calls in the E2E environment.
 *
 * Idempotent: if an active wizard_session already exists for the seed profile in
 * this workspace, the existing row is reused.
 */
export async function ensureSeededWizardSession(opts?: {
  workspaceId?: string;
}): Promise<SeededWizardSessionFixture> {
  const workspaceId = opts?.workspaceId ?? SEED_WORKSPACE_ID;

  // Re-use any existing active session for the seed profile.
  const { data: existing } = await supabase
    .from("wizard_session")
    .select("wizard_session_id, workspace_id")
    .eq("workspace_id", workspaceId)
    .eq("created_by", ADMIN_USER_ID)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1);

  if (existing && existing.length > 0) {
    const row = existing[0] as { wizard_session_id: string; workspace_id: string };
    return {
      wizard_session_id: row.wizard_session_id,
      workspace_id: row.workspace_id,
    };
  }

  // Build a draft_journey with all required fields so publish_draft validation
  // passes immediately.  The steps array has one well-formed step.
  const draftJourney = {
    title: "E2E Authoring Harness Journey",
    description: "Created by journey-authoring-harness-e2e.spec.ts for E2E verification.",
    module: "onboarding",
    actor: "admin",
    platform: "desktop",
    priority: "P2",
    tags: ["e2e", "harness"],
    system_prompt:
      "Du er Botsson. Guide brukeren gjennom testscenarioet. Vær kortfattet og presis.",
    test_assertion: "step.e2e-authoring-harness-journey.completed",
    steps: [
      {
        key: "step.e2e-authoring-harness-journey.start",
        title: "Åpne dashbordet",
        description: "Naviger til dashbordet for å starte",
        action: "Klikk på dashbordlenken",
        expects: "Dashbordet er synlig",
        goal: "Komme til dashbordet",
        instructions: "Bruk venstremenyen",
        success_criteria: "Dashbordsiden lastes",
      },
    ],
  };

  const { data: inserted, error } = await supabase
    .from("wizard_session")
    .insert({
      workspace_id: workspaceId,
      created_by: ADMIN_USER_ID,
      status: "active",
      current_phase: "discovery",
      draft_journey: draftJourney,
      messages: [],
    })
    .select("wizard_session_id, workspace_id")
    .single();

  if (error || !inserted) {
    throw new Error(`ensureSeededWizardSession: insert failed: ${error?.message ?? "no row"}`);
  }

  const row = inserted as { wizard_session_id: string; workspace_id: string };
  return {
    wizard_session_id: row.wizard_session_id,
    workspace_id: row.workspace_id,
  };
}

// ---------------------------------------------------------------------------
// cleanupAuthoringHarnessFixtures
// ---------------------------------------------------------------------------

export type AuthoringHarnessFixtureIds = {
  wizard_session_ids?: string[];
  journey_version_ids?: string[];
  journey_ids?: string[];
};

/**
 * Delete fixture rows in reverse-FK order.  Tolerant of missing rows.
 *
 * publish_draft inserts: journey_version → journey (FK to journey_version via
 * journey_id).  Wizard sessions are deleted last.
 */
export async function cleanupAuthoringHarnessFixtures(
  ids: AuthoringHarnessFixtureIds,
): Promise<void> {
  // 1. journey_version (FK → journey.journey_id; also FK from engine_missions etc.)
  if (ids.journey_version_ids?.length) {
    const { error } = await supabase
      .from("journey_version")
      .delete()
      .in("journey_version_id", ids.journey_version_ids);
    if (error) console.warn(`cleanup(journey_version): ${error.message}`);
  }

  // 2. journey rows created by publish_draft
  if (ids.journey_ids?.length) {
    const { error } = await supabase.from("journey").delete().in("journey_id", ids.journey_ids);
    if (error) console.warn(`cleanup(journey): ${error.message}`);
  }

  // 3. wizard_session rows
  if (ids.wizard_session_ids?.length) {
    const { error } = await supabase
      .from("wizard_session")
      .delete()
      .in("wizard_session_id", ids.wizard_session_ids);
    if (error) console.warn(`cleanup(wizard_session): ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// assertAuthoringToolFired
// ---------------------------------------------------------------------------

/**
 * Poll agent_session_recording for a `tool_call` row naming the given
 * journey-authoring tool.  Returns the matched row.
 */
export async function assertAuthoringToolFired(
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
// assertAuthoringCapabilityClassified
// ---------------------------------------------------------------------------

/**
 * Poll agent_session_recording for a classifier_output row where
 * intent === 'journey_authoring'.  Returns the matched row.
 *
 * Note: the intent name uses underscore (journey_authoring) per ADR-0239 and
 * the intent-classifier enum.  Not to be confused with the journey capability
 * intent (plain 'journey').
 */
export async function assertAuthoringCapabilityClassified(
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
      return typeof content?.intent === "string" && content.intent === "journey_authoring";
    },
    sinceIso,
    poll: poll ?? { timeoutMs: 20_000 },
  });
}

// ---------------------------------------------------------------------------
// assertAuthoringToolInvokedFor
// ---------------------------------------------------------------------------

/**
 * Poll activity_trail for a "botsson.tool_invoked" event where data.tool
 * matches the given journey-authoring tool name.
 */
export async function assertAuthoringToolInvokedFor(
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
