// =============================================================================
// helpers/journey-harness.ts
//
// Journey-capability–specific assertion helpers for journey-harness-e2e.spec.ts.
//
// Builds on the base assertion helpers in botsson-harness.ts.  This file adds:
//
//   assertJourneyToolFired(sessionId, toolName, opts)
//     — polls agent_session_recording for a tool_call row naming the tool.
//
//   assertJourneyCapabilityClassified(sessionId, sinceIso, poll)
//     — polls agent_session_recording for a classifier_output row where
//       intent === 'journey'.
//
//   assertJourneyToolInvokedFor(toolName, sinceIso, opts)
//     — polls activity_trail for "botsson.tool_invoked" with data.tool
//       matching the given tool name.
//
//   seedMinimalJourneyVersion(opts)
//     — inserts a journey + journey_version row with a minimal v2.1 IR suitable
//       for publish_mission, publish_guide, run_dev, run_guided tests.  Returns
//       the journey_version_id and journey_id.  Idempotent per-slug.
//
//   cleanupJourneyHarnessFixtures(ids)
//     — deletes rows created by seedMinimalJourneyVersion in reverse-FK order.
//
// Journey capability notes (ADR-0173):
//   - All 4 tools are mutations; none are read-only.
//   - All 4 require journey_version_id (UUID) in the Zod schema.
//   - run_dev + run_guided insert engine_state rows; publish_mission inserts
//     engine_missions; publish_guide upserts journey_guide.
//   - run_guided also requires an active mission (is_active=true in engine_missions).
//     Without it, execute() returns {ok:false, error:"no_active_mission"} — which
//     the LLM relays gracefully.  The E2E for run_guided tests the graceful path.
//   - run_dev and run_guided also require journey.engine_process_id to be non-null
//     for engine_state insertion.  The seed uses ensureEngineRunProcess() from
//     journey-seed.ts to guarantee this.
//
// ADR refs: ADR-0078 (chat-only), ADR-0099 (gate_action), ADR-0134 (telemetry),
//           ADR-0151 (server-side profile_id), ADR-0173 (capability model),
//           ADR-0184 (recorder), ADR-0194 (JourneyIR v2.1 publish_mission),
//           ADR-0217 (publish_guide journey_guide table).
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

/** User_id for the seeded admin (see seed.sql step 8). */
const ADMIN_USER_ID = "e0000000-0000-0000-0000-000000000000";

/**
 * Minimal v2.1 IR fixture that satisfies validateV21IrForMission() +
 * validateIRForGuide().  Carries system_prompt + mode (publish_mission) and
 * a non-empty title with at least one step (publish_guide).
 *
 * Cast via `Record<string, unknown>` — TypeScript JourneyIRSchema does not yet
 * mandate v2.1 root fields; they are stored as JSONB opaque to the seed layer.
 */
function buildMinimalV21Ir(slug: string): Record<string, unknown> {
  return {
    version: "2.1.0",
    slug,
    title: `E2E Journey Harness ${slug}`,
    module: "testing",
    system_prompt: "Du er Botsson. Hjelp brukeren gjennom en e2e-test. Vær kort og klar.",
    mode: "sequential",
    steps: [
      {
        key: "step-welcome",
        title: "Åpne dashbordet",
        description: "E2E-steg 1",
        action: "Klikk på dashbordlenken i navigasjonen",
        assertion: "Dashbordsiden er synlig",
        goal: "Navigere til dashbordet",
        instructions: "Klikk på lenken i venstremenyen",
        success_criteria: "Brukeren ser dashbordet",
        creative_freedom: 0.2,
      },
      {
        key: "step-confirm",
        title: "Bekreft oppgaven",
        description: "E2E-steg 2",
        action: "Klikk på bekreft-knappen",
        assertion: "En bekreftelse vises på skjermen",
        goal: "Fullføre oppgaven",
        instructions: "Klikk på bekreft-knappen",
        success_criteria: "Bekreftelsesmeldingen er synlig",
        creative_freedom: 0.2,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// ensureEngineRunProcess — needed so engine_state.process_id FK resolves
// ---------------------------------------------------------------------------

const E2E_PROCESS_ID = "e2e_journey_harness_run";

async function ensureEngineRunProcess(): Promise<string> {
  const { data: existing } = await supabase
    .from("engine_process")
    .select("id")
    .eq("id", E2E_PROCESS_ID)
    .maybeSingle();
  if (existing) return E2E_PROCESS_ID;

  const { error } = await supabase.from("engine_process").insert({
    id: E2E_PROCESS_ID,
    name: "E2E Journey Harness Process",
    description: "Ephemeral process used by journey-harness-e2e.spec.ts fixtures.",
    is_active: true,
    max_steps: 32,
    allowed_channels: ["chat", "system"],
  });
  if (error) throw new Error(`ensureEngineRunProcess failed: ${error.message}`);
  return E2E_PROCESS_ID;
}

// ---------------------------------------------------------------------------
// seedMinimalJourneyVersion
// ---------------------------------------------------------------------------

export type SeededJourneyHarnessFixture = {
  journey_id: string;
  journey_version_id: string;
  slug: string;
  engine_process_id: string;
};

/**
 * Insert a minimal journey + journey_version with a v2.1 IR and link the
 * parent journey to an engine_process so run_dev and run_guided can insert
 * engine_state rows (engine_process_id FK is NOT NULL on engine_state).
 *
 * The journey_version is inserted in `draft` status — all four tools accept
 * any status (publish_* tools do not gate on status; run_guided gates on
 * active mission, not on version status).
 *
 * Idempotent: if a journey with the given slug already exists in this
 * workspace, the existing row is reused and a fresh version is inserted on top.
 */
export async function seedMinimalJourneyVersion(opts?: {
  workspaceId?: string;
  slug?: string;
}): Promise<SeededJourneyHarnessFixture> {
  const workspaceId = opts?.workspaceId ?? SEED_WORKSPACE_ID;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const slug = opts?.slug ?? `e2e-harness-${suffix}`;

  // Ensure a process row exists for the engine_state FK.
  const processId = await ensureEngineRunProcess();

  // Check for an existing parent journey with this slug.
  let journeyId: string;
  const { data: existingJourney } = await supabase
    .from("journey")
    .select("journey_id, engine_process_id")
    .eq("workspace_id", workspaceId)
    .eq("slug", slug)
    .maybeSingle();

  if (existingJourney) {
    journeyId = existingJourney.journey_id as string;
    // Ensure engine_process_id is linked (may be null if seeded without it).
    if (!existingJourney.engine_process_id) {
      await supabase
        .from("journey")
        .update({ engine_process_id: processId })
        .eq("journey_id", journeyId);
    }
  } else {
    const { data: inserted, error: insertErr } = await supabase
      .from("journey")
      .insert({
        workspace_id: workspaceId,
        slug,
        code: `E2E-HARNESS-${suffix.toUpperCase()}`,
        title: `E2E Journey Harness ${slug}`,
        actor: "admin",
        module: "testing",
        platform: "desktop",
        priority: "P2",
        status: "idea",
        created_by: ADMIN_USER_ID,
        engine_process_id: processId,
      })
      .select("journey_id")
      .single();

    if (insertErr || !inserted)
      throw new Error(`seedMinimalJourneyVersion(journey): ${insertErr?.message ?? "no row"}`);
    journeyId = (inserted as { journey_id: string }).journey_id;
  }

  // Insert a fresh journey_version every time — tests need a unique version
  // so they can assert the specific engine_state / engine_missions rows.
  const { data: version, error: versionErr } = await supabase
    .from("journey_version")
    .insert({
      workspace_id: workspaceId,
      journey_id: journeyId,
      status: "draft",
      ir_json: buildMinimalV21Ir(slug),
      created_by: ADMIN_USER_ID,
    })
    .select("journey_version_id")
    .single();

  if (versionErr || !version)
    throw new Error(`seedMinimalJourneyVersion(version): ${versionErr?.message ?? "no row"}`);

  return {
    journey_id: journeyId,
    journey_version_id: (version as { journey_version_id: string }).journey_version_id,
    slug,
    engine_process_id: processId,
  };
}

// ---------------------------------------------------------------------------
// cleanupJourneyHarnessFixtures
// ---------------------------------------------------------------------------

export type JourneyHarnessFixtureIds = {
  journey_version_ids?: string[];
  journey_ids?: string[];
  engine_state_ids?: string[];
  engine_missions_ids?: string[];
  journey_guide_ids?: string[];
};

/**
 * Delete fixture rows in reverse-FK order.  Tolerant of missing rows.
 * Does NOT delete engine_process (shared across tests — ensureEngineRunProcess
 * makes it idempotent).
 */
export async function cleanupJourneyHarnessFixtures(ids: JourneyHarnessFixtureIds): Promise<void> {
  // 1. engine_state_step (FK → engine_state.id)
  if (ids.engine_state_ids?.length) {
    const { error } = await supabase
      .from("engine_state_step")
      .delete()
      .in("state_id", ids.engine_state_ids);
    if (error) console.warn(`cleanup(engine_state_step): ${error.message}`);

    const { error: stateErr } = await supabase
      .from("engine_state")
      .delete()
      .in("id", ids.engine_state_ids);
    if (stateErr) console.warn(`cleanup(engine_state): ${stateErr.message}`);
  }

  // 2. journey_guide rows
  if (ids.journey_guide_ids?.length) {
    const { error } = await supabase.from("journey_guide").delete().in("id", ids.journey_guide_ids);
    if (error) console.warn(`cleanup(journey_guide): ${error.message}`);
  }

  // 3. engine_stages → engine_missions
  if (ids.engine_missions_ids?.length) {
    const { error: stagesErr } = await supabase
      .from("engine_stages")
      .delete()
      .in("mission_id", ids.engine_missions_ids);
    if (stagesErr) console.warn(`cleanup(engine_stages): ${stagesErr.message}`);

    const { error: missionErr } = await supabase
      .from("engine_missions")
      .delete()
      .in("id", ids.engine_missions_ids);
    if (missionErr) console.warn(`cleanup(engine_missions): ${missionErr.message}`);
  }

  // 4. journey_version
  if (ids.journey_version_ids?.length) {
    const { error } = await supabase
      .from("journey_version")
      .delete()
      .in("journey_version_id", ids.journey_version_ids);
    if (error) console.warn(`cleanup(journey_version): ${error.message}`);
  }

  // 5. journey
  if (ids.journey_ids?.length) {
    const { error } = await supabase.from("journey").delete().in("journey_id", ids.journey_ids);
    if (error) console.warn(`cleanup(journey): ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// assertJourneyToolFired
// ---------------------------------------------------------------------------

/**
 * Poll agent_session_recording for a `tool_call` row naming the given journey tool.
 * Returns the matched row.
 */
export async function assertJourneyToolFired(
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
// assertJourneyCapabilityClassified
// ---------------------------------------------------------------------------

/**
 * Poll agent_session_recording for a classifier_output row where
 * intent === 'journey'.  Returns the matched row.
 */
export async function assertJourneyCapabilityClassified(
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
      return typeof content?.intent === "string" && content.intent === "journey";
    },
    sinceIso,
    poll: poll ?? { timeoutMs: 20_000 },
  });
}

// ---------------------------------------------------------------------------
// assertJourneyToolInvokedFor
// ---------------------------------------------------------------------------

/**
 * Poll activity_trail for a "botsson.tool_invoked" event where data.tool
 * matches the given journey tool name.
 */
export async function assertJourneyToolInvokedFor(
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
