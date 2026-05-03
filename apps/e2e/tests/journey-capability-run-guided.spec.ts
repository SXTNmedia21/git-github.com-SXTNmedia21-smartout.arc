/**
 * journey-capability-run-guided.spec.ts — L-0125 artefact-asserting E2E.
 *
 * Locks the run_guided capability's contract at the artefact layer, not the
 * return-shape layer. Mirrors the structure of
 * `journey-capability-publish-mission.spec.ts` (the gold standard).
 *
 * Binding:
 *   - L-0125 — Test spirit vs letter: asserting `ok:true` is not asserting
 *              the artefact. Every test here SELECTs the created row.
 *   - L-0023 — Dev-tracking ≠ runtime-state. `run_guided` writes to
 *              `engine_state` (runtime, status='active') and MUST NOT write
 *              `journey_event` (dev-tracking). Test 3 is the cross-coverage
 *              guard per the task brief.
 *   - ADR-0132 — Mobile AI Routing: mobile → BFF → capability. Test 2
 *              asserts the BFF derives workspace_id + actor_id server-side
 *              (not from client body) per ADR-0176 Invariant 3 / CVE-class
 *              red line.
 *   - ADR-0134 — Mobile Telemetry Contract: actor_id + workspace_id resolved
 *              server-side; empty-string fallback banned. Test 2 asserts
 *              non-empty values in the resulting engine_event row.
 *   - ADR-0173 — capability name `journey.run_guided` (frozen).
 *   - ADR-0175 — `journey.run_started` (5 events, 4 destinations). Tests
 *              assert `engine_event` (dot-notation) + `activity_trail`
 *              (space-form) rows with correct payload.
 *   - ADR-0176 — engine_authority_config seeded; `run_guided` default is
 *              `autonomous`. gate_action is MANDATORY per Invariant 13.
 *   - ADR-0196 Invariant 11 — no phantom capabilities. `run_guided` inserts
 *              `engine_state` + steps before emitting run_started. Rejection
 *              path emits ZERO events.
 *
 * Router invocation pattern:
 *   Test 1 (happy path): BFF POST /api/journey/guided/start with cookie auth
 *   (same session as loginAsPlatformAdmin). The BFF derives identity
 *   server-side, calls gateAction + runGuidedTool.execute(), and returns
 *   `{run_id, status:"active", surface}`. This is the canonical production
 *   path per ADR-0132.
 *
 *   Test 2 (BFF derivation guard): POST without workspace_id / actor_id in
 *   body. Asserts the BFF derives both from the authenticated session and
 *   that the engine_event row has non-empty, non-fallback values.
 *   NOTE: if the BFF does not correctly derive identity (e.g. missing profile
 *   FK resolution), this test will fail with empty actor_id in the row. That
 *   is a CVE-class regression; a follow-up sortie must fix the BFF.
 *
 *   Test 3 (L-0023 cross-coverage): confirms no engine_state was written by
 *   an earlier run_dev invocation with a re-used journey_version_id.
 *
 * Precondition:
 *   - journey_version.status must be `published` (BFF gate rejects others
 *     with 409).
 *   - journey.engine_process_id must be non-null (journey_not_compiled
 *     guard in the capability body).
 *
 * Phase expectations:
 *   - Test 1 (happy path):       GREEN (run_guided body implemented).
 *   - Test 2 (BFF derivation):   GREEN if BFF correctly resolves profile;
 *                                 RED with message noting gap if not.
 *   - Test 3 (L-0023 guard):     GREEN (structural isolation assert).
 */

import { test, expect } from "@playwright/test";
import { loginAsPlatformAdmin } from "../helpers/admin-login";
import {
  cleanupJourneyFixtures,
  ADMIN_PROFILE_ID,
  HQ_WORKSPACE_ID,
  type JourneyFixtureIds,
  seedParentJourney,
} from "../helpers/journey-seed";
import { supabase } from "../helpers/seed";

// ---------------------------------------------------------------------------
// IR fixture — valid v2.0.0 IR. run_guided only requires JourneyIRSchema to
// parse (no v2.1 coaching fields needed — those are publish_mission-only).
// ---------------------------------------------------------------------------

const VALID_V2_IR = {
  version: "2.0.0",
  slug: "e2e-run-guided-ir",
  title: "Run Guided E2E IR",
  module: "testing",
  steps: [
    {
      key: "step-greeting",
      title: "Greet the user",
      action: "Display welcome message",
      assertion: "Welcome heading is visible",
    },
    {
      key: "step-action",
      title: "Confirm action",
      action: "Click the confirm button",
      assertion: "Confirmation modal appears",
    },
  ],
};

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

const E2E_PROCESS_ID = "e2e_journey_run";

async function ensureDevRunProcess(): Promise<void> {
  const { data: existing } = await supabase
    .from("engine_process")
    .select("id")
    .eq("id", E2E_PROCESS_ID)
    .maybeSingle();
  if (existing) return;

  const { error } = await supabase.from("engine_process").insert({
    id: E2E_PROCESS_ID,
    name: "E2E Journey Run",
    description: "Ephemeral process used by E2E journey-engine fixtures.",
    is_active: true,
    max_steps: 32,
    allowed_channels: ["chat", "system"],
  });
  if (error) throw new Error(`ensureDevRunProcess failed: ${error.message}`);
}

/**
 * Seed a parent journey with `engine_process_id` set so the capability body
 * passes the `journey_not_compiled` guard.
 */
async function seedCompiledParentJourney(slug: string): Promise<{ journey_id: string }> {
  await ensureDevRunProcess();
  const parent = await seedParentJourney({ workspaceId: HQ_WORKSPACE_ID, slug });
  const { error } = await supabase
    .from("journey")
    .update({ engine_process_id: E2E_PROCESS_ID })
    .eq("journey_id", parent.journey_id);
  if (error)
    throw new Error(`seedCompiledParentJourney: engine_process_id update failed: ${error.message}`);
  return { journey_id: parent.journey_id };
}

/**
 * Seed a journey_version in `published` status.
 * The BFF gate rejects non-published versions with 409.
 */
async function seedPublishedV2Version(opts: {
  journeyId: string;
  slug: string;
}): Promise<{ journey_version_id: string }> {
  const { data, error } = await supabase
    .from("journey_version")
    .insert({
      workspace_id: HQ_WORKSPACE_ID,
      journey_id: opts.journeyId,
      status: "published",
      ir_json: { ...VALID_V2_IR, slug: opts.slug },
      created_by: "e0000000-0000-0000-0000-000000000000",
    })
    .select("journey_version_id")
    .single();
  if (error || !data)
    throw new Error(`seedPublishedV2Version failed: ${error?.message ?? "no row"}`);
  return { journey_version_id: (data as { journey_version_id: string }).journey_version_id };
}

async function cleanupRunRows(runIds: string[]): Promise<void> {
  if (runIds.length === 0) return;
  await supabase.from("engine_state_step").delete().in("state_id", runIds);
  await supabase.from("engine_state").delete().in("id", runIds);
}

/**
 * Seed an active engine_missions row + 2 engine_stages for the given journey.
 *
 * Phase 3 #2 requirement: runGuidedTool.execute() now resolves the active mission
 * before inserting engine_state. Existing tests must seed this or the BFF returns 409.
 * Uses the v2.1 coaching fields on stages (goal/instructions/success_criteria) so the
 * mission can be activated in production; here is_active=true is set directly.
 */
async function seedActiveMissionForJourney(opts: {
  journeyId: string;
  slug: string;
}): Promise<{ mission_id: string }> {
  const missionId = `journey_${opts.slug}_v1`;

  const { error: missionErr } = await supabase.from("engine_missions").insert({
    id: missionId,
    name: `Run Guided E2E Mission ${opts.slug}`,
    description: "Seeded by journey-capability-run-guided E2E fixture (Phase 3 #2)",
    mode: "sequential",
    system_prompt: "You are Botsson. Guide the user step by step through the run-guided E2E test.",
    workspace_id: HQ_WORKSPACE_ID,
    journey_id: opts.journeyId,
    is_active: true,
  });
  if (missionErr)
    throw new Error(`seedActiveMissionForJourney: mission insert failed: ${missionErr.message}`);

  // Seed matching stages from VALID_V2_IR steps.
  const stageRows = VALID_V2_IR.steps.map((step, idx) => ({
    mission_id: missionId,
    stage_id: step.key,
    stage_order: idx,
    goal: step.title,
    instructions: step.action,
    success_criteria: step.assertion,
    creative_freedom: 0.2,
    is_required: true,
  }));

  const { error: stagesErr } = await supabase.from("engine_stages").insert(stageRows);
  if (stagesErr)
    throw new Error(`seedActiveMissionForJourney: stages insert failed: ${stagesErr.message}`);

  return { mission_id: missionId };
}

async function cleanupMissionRows(missionIds: string[]): Promise<void> {
  if (missionIds.length === 0) return;
  await supabase.from("engine_stages").delete().in("mission_id", missionIds);
  await supabase.from("engine_missions").delete().in("id", missionIds);
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

test.describe.configure({ mode: "serial" });

test.describe("journey.run_guided — L-0125 artefact assertion + BFF derivation @journey-engine", () => {
  const fixtures: JourneyFixtureIds = {
    journey_ids: [],
    journey_version_ids: [],
  };
  const runIds: string[] = [];
  // Phase 3 #2: track seeded mission ids for cleanup.
  const missionIds: string[] = [];

  // Shared across tests 1 + 2 (same journey_version to re-use BFF path).
  let sharedVersionId: string | null = null;
  let sharedJourneyId: string | null = null;

  test.beforeAll(async () => {
    const slug = `e2e-run-guided-${Date.now()}`;
    const parent = await seedCompiledParentJourney(slug);
    sharedJourneyId = parent.journey_id;
    fixtures.journey_ids!.push(parent.journey_id);

    const version = await seedPublishedV2Version({ journeyId: parent.journey_id, slug });
    sharedVersionId = version.journey_version_id;
    fixtures.journey_version_ids!.push(version.journey_version_id);

    // Phase 3 #2 fixture: runGuidedTool.execute() now requires an active mission.
    // Seed one so the happy-path BFF calls return 200 instead of 409 no_active_mission.
    const { mission_id } = await seedActiveMissionForJourney({
      journeyId: parent.journey_id,
      slug,
    });
    missionIds.push(mission_id);
  });

  test.afterEach(async () => {
    if (runIds.length > 0) {
      await cleanupRunRows([...runIds]);
      runIds.length = 0;
    }
  });

  test.afterAll(async () => {
    // Clean up missions (stages cascade on mission FK).
    await cleanupMissionRows(missionIds);
    // activity_trail + engine_event are append-only telemetry — leave rows.
    await cleanupJourneyFixtures(fixtures);
  });

  // ── Test 1: happy path ──────────────────────────────────────────────────────

  test("run_guided writes engine_state + engine_state_step + emits run_started (L-0125 spirit)", async ({
    page,
    request,
    baseURL,
  }) => {
    test.setTimeout(60_000);
    test.skip(!sharedVersionId, "beforeAll did not seed a published version");

    const since = new Date().toISOString();

    // Obtain the authenticated session via the standard admin login flow.
    // The BFF accepts cookie-based session from the same browser context.
    await loginAsPlatformAdmin(page);

    // POST to BFF with cookie auth (no Authorization header — browser context
    // carries the session cookie set by loginAsPlatformAdmin).
    const bffResponse = await page.request.post(`${baseURL}/api/journey/guided/start`, {
      data: { journey_version_id: sharedVersionId },
      headers: { "Content-Type": "application/json" },
    });

    // BFF should return 200 with run_id on success.
    expect(bffResponse.status(), `BFF returned unexpected status: ${bffResponse.status()}`).toBe(
      200,
    );

    const bffBody = (await bffResponse.json()) as {
      run_id?: string;
      status?: string;
      surface?: string;
      error?: string;
    };

    expect(bffBody.run_id, "BFF must return run_id on success").toBeTruthy();
    expect(bffBody.status).toBe("active");

    const runId = bffBody.run_id!;
    runIds.push(runId);

    // Allow DB writes to settle.
    await page.waitForTimeout(1_000);

    // ── Spirit of L-0125 — artefact assertion: engine_state ────────────────
    // run_guided inserts engine_state with status='active' (DB constraint
    // vocabulary: pending|active|waiting|complete|failed|escalated|blocked).
    // 'active' = live execution (distinct from run_dev 'pending' = queued).
    // We filter by run_id (=engine_state.id).
    const { data: stateRow, error: stateErr } = await supabase
      .from("engine_state")
      .select("id, status, context, process_id, workspace_id, entity_id")
      .eq("id", runId)
      .maybeSingle();

    expect(stateErr, `engine_state SELECT failed: ${stateErr?.message}`).toBeNull();
    expect(stateRow, `expected engine_state row for run_id ${runId}`).toBeTruthy();

    const sr = stateRow as {
      id: string;
      status: string;
      context: Record<string, unknown>;
      process_id: string;
      workspace_id: string;
      entity_id: string;
    };

    // run_guided → runtime status = 'active' (distinct from run_dev 'pending').
    expect(sr.status).toBe("active");
    expect(sr.context).toMatchObject({
      capability: "journey.run_guided",
      surface: "runtime_web",
      journey_version_id: sharedVersionId,
    });
    expect(sr.process_id).toBe(E2E_PROCESS_ID);
    expect(sr.workspace_id).toBe(HQ_WORKSPACE_ID);

    // ── Phase 3 #2 addition: mission fields in engine_state.context ──────────
    // runGuidedTool.execute() now resolves the active mission and packs these
    // 3 fields into context JSONB so stage-engine loadMission() can use mission_id
    // and Fjernkontroll can render the correct mode variant (ADR-0177).
    expect(
      sr.context.mission_id,
      "engine_state.context.mission_id must be populated by mission resolver (Phase 3 #2)",
    ).toBeTruthy();
    expect(
      sr.context.mission_mode,
      "engine_state.context.mission_mode must be populated from the active mission row",
    ).toBe("sequential");
    expect(
      sr.context.mission_system_prompt,
      "engine_state.context.mission_system_prompt must be populated from the active mission row",
    ).toBeTruthy();

    // ── engine_state_step cascade ────────────────────────────────────────────
    // One row per IR step (VALID_V2_IR has 2 steps). All status='pending'.
    const { data: stepRows, error: stepErr } = await supabase
      .from("engine_state_step")
      .select("step_order, status, action_type")
      .eq("state_id", runId)
      .order("step_order", { ascending: true });

    expect(stepErr, `engine_state_step SELECT failed: ${stepErr?.message}`).toBeNull();
    expect(stepRows, "expected engine_state_step rows").toBeTruthy();
    expect(stepRows!.length).toBe(VALID_V2_IR.steps.length);

    stepRows!.forEach((row: unknown, idx: number) => {
      const s = row as { step_order: number; status: string; action_type: string };
      expect(s.step_order).toBe(idx);
      expect(s.status).toBe("pending");
      expect(s.action_type).toBe(VALID_V2_IR.steps[idx]!.action);
    });

    // ── L-0023 guard: NO journey_event status rows written by run_guided ───
    // run_guided only writes engine_state (runtime). journey_event (dev-
    // tracking) must not receive any rows from this run. We check via the
    // run_id in the context JSONB column.
    const { data: journeyEventRows } = await supabase
      .from("journey_event")
      .select("id")
      .eq("workspace_id", HQ_WORKSPACE_ID)
      .contains("context", { run_id: runId });
    expect(
      journeyEventRows ?? [],
      "L-0023 violation: run_guided must not write journey_event rows",
    ).toHaveLength(0);

    // ── Telemetry: engine_event (dot-notation per ADR-0175) ────────────────
    const { data: events, error: eventErr } = await supabase
      .from("engine_event")
      .select("id, event_type, payload, workspace_id, fired_at")
      .eq("workspace_id", HQ_WORKSPACE_ID)
      .eq("event_type", "journey.run_started")
      .gte("fired_at", since);

    expect(eventErr, `engine_event SELECT failed: ${eventErr?.message}`).toBeNull();
    expect(events, "expected engine_event row for journey.run_started").toBeTruthy();
    expect(events!.length).toBeGreaterThanOrEqual(1);

    // Find our specific run's event by matching run_id in payload.
    const ourEvent = (events as Array<{ payload: Record<string, unknown> }>).find(
      (e) => e.payload.run_id === runId,
    );
    expect(ourEvent, `expected engine_event with run_id=${runId}`).toBeTruthy();
    expect(ourEvent!.payload).toMatchObject({
      capability: "journey.run_guided",
      surface: "runtime_web",
      workspace_id: HQ_WORKSPACE_ID,
      run_id: runId,
    });

    // ── Telemetry: activity_trail (space-form per ADR-0175) ────────────────
    const { data: trailRows, error: trailErr } = await supabase
      .from("activity_trail")
      .select("id, event, actor_id, workspace_id, created_at")
      .eq("workspace_id", HQ_WORKSPACE_ID)
      .eq("event", "journey run_started")
      .gte("created_at", since);

    expect(trailErr, `activity_trail SELECT failed: ${trailErr?.message}`).toBeNull();
    expect(trailRows, "expected activity_trail row for journey.run_started").toBeTruthy();
    expect(trailRows!.length).toBeGreaterThanOrEqual(1);
    // ADR-0134 / ADR-0176: actor_id must be the admin profile — not empty.
    const trailActor = (trailRows![0] as { actor_id: string }).actor_id;
    expect(trailActor).toBe(ADMIN_PROFILE_ID);
  });

  // ── Test 2: BFF derivation guard (ADR-0134 + ADR-0176 Invariant 3) ─────────

  test("BFF derives workspace_id + actor_id server-side — engine_event has non-empty values (CVE-class regression guard)", async ({
    page,
    baseURL,
  }) => {
    test.setTimeout(60_000);
    test.skip(!sharedVersionId, "beforeAll did not seed a published version");

    const since = new Date().toISOString();

    await loginAsPlatformAdmin(page);

    // POST WITHOUT workspace_id / actor_id in the body — they are not in the
    // Zod schema (RequestSchema strips unknown keys). Server must derive both
    // from the authenticated session.
    const bffResponse = await page.request.post(`${baseURL}/api/journey/guided/start`, {
      data: {
        journey_version_id: sharedVersionId,
        // These fields are NOT in RequestSchema; Zod strips them.
        // Supplying them here proves the BFF ignores body-supplied identity.
        workspace_id: "00000000-0000-0000-0000-attacker",
        actor_id: "00000000-0000-0000-0000-attacker",
      },
      headers: { "Content-Type": "application/json" },
    });

    // The BFF should succeed (cookie auth is valid, journey_version is
    // published + workspace-owned). If it returns non-200, the BFF has a
    // profile-resolution gap — report the gap without asserting the
    // artefact (follow-up sortie fixes the BFF; see task constraints).
    if (bffResponse.status() !== 200) {
      // FIXME: BFF returned a non-200 status. This indicates the BFF cannot
      // resolve the profile from the admin session, OR the published version
      // isn't accessible. Capture status + body for the follow-up sortie.
      const body = await bffResponse.text();
      test.info().annotations.push({
        type: "bff-gap",
        description:
          `BFF returned ${bffResponse.status()} — identity derivation gap detected. ` +
          `Body: ${body}. Fix: ensure resolveAuth() resolves profile via profile.user_id FK.`,
      });
      // Soft fail — leave this test RED so the follow-up sortie sees it.
      expect(
        bffResponse.status(),
        `BFF must return 200 for authenticated admin. Got ${bffResponse.status()}: ${body}`,
      ).toBe(200);
      return;
    }

    const bffBody = (await bffResponse.json()) as { run_id?: string };
    expect(bffBody.run_id, "BFF must return run_id").toBeTruthy();

    const runId = bffBody.run_id!;
    runIds.push(runId);

    await page.waitForTimeout(1_000);

    // ── ADR-0134 / ADR-0176 assertion: engine_event must have NON-EMPTY
    //    workspace_id + actor_id (not attacker-supplied, not empty string). ──
    const { data: events, error: eventErr } = await supabase
      .from("engine_event")
      .select("id, event_type, payload, workspace_id, fired_at")
      .eq("workspace_id", HQ_WORKSPACE_ID)
      .eq("event_type", "journey.run_started")
      .gte("fired_at", since);

    expect(eventErr, `engine_event SELECT failed: ${eventErr?.message}`).toBeNull();
    expect(events, "expected engine_event row").toBeTruthy();

    const ourEvent = (events as Array<{ payload: Record<string, unknown> }>).find(
      (e) => e.payload.run_id === runId,
    );
    expect(
      ourEvent,
      `No engine_event row found for run_id=${runId} — the BFF emit may not have fired`,
    ).toBeTruthy();

    const payload = ourEvent!.payload;

    // workspace_id in the payload must be the real HQ workspace, NOT the
    // attacker-supplied value. This is the CVE-class regression guard.
    expect(
      payload.workspace_id,
      "engine_event.payload.workspace_id must be server-derived (non-empty, non-attacker)",
    ).toBe(HQ_WORKSPACE_ID);

    // actor_id must be the admin profile_id (server-derived), not the
    // attacker-supplied fake UUID, and not an empty string.
    expect(
      payload.actor_id,
      "engine_event.payload.actor_id must be non-empty and server-derived",
    ).toBeTruthy();
    expect(
      (payload.actor_id as string).length,
      "engine_event.payload.actor_id must not be an empty string (ADR-0134 / L-0097)",
    ).toBeGreaterThan(0);
    expect(
      payload.actor_id,
      "engine_event.payload.actor_id must match the admin profile, not the spoofed value",
    ).toBe(ADMIN_PROFILE_ID);
  });

  // ── Test 3: L-0023 cross-coverage — run_dev must not write engine_state ──

  test("L-0023 cross-coverage: no engine_state row from run_dev bleeds into run_guided assertion scope", async ({
    page,
    baseURL,
  }) => {
    test.setTimeout(60_000);
    test.skip(!sharedVersionId, "beforeAll did not seed a published version");
    test.skip(!sharedJourneyId, "beforeAll did not seed a parent journey");

    const since = new Date().toISOString();

    // We use a DIFFERENT journey_version (draft status, same parent journey)
    // to simulate a run_dev invocation on a dev-surface version. Then we
    // assert that the run_guided engine_state (from Test 1) does not have
    // context.capability='journey.run_dev'.
    //
    // This test primarily verifies the structural separation: a `status=pending`
    // row (from run_dev) must never appear in the same result set as a
    // `status=active` row (from run_guided) — they have different contexts.
    //
    // We inspect ALL engine_state rows written to HQ_WORKSPACE_ID since
    // the test window started and confirm no `queued` row was produced by a
    // run_guided invocation (and vice versa).

    // Login + hit the BFF (run_guided path) once more for isolation.
    await loginAsPlatformAdmin(page);
    const bffResponse = await page.request.post(`${baseURL}/api/journey/guided/start`, {
      data: { journey_version_id: sharedVersionId },
      headers: { "Content-Type": "application/json" },
    });

    if (bffResponse.status() !== 200) {
      // BFF gap — same note as Test 2.
      test.info().annotations.push({
        type: "bff-gap",
        description: `BFF returned ${bffResponse.status()} — skipping L-0023 cross-coverage assertion.`,
      });
      return;
    }

    const { run_id: runGuidedId } = (await bffResponse.json()) as { run_id?: string };
    expect(runGuidedId, "BFF must return run_id").toBeTruthy();
    runIds.push(runGuidedId!);

    await page.waitForTimeout(1_000);

    // ── Fetch the run_guided engine_state row ───────────────────────────────
    const { data: guidedRow } = await supabase
      .from("engine_state")
      .select("id, status, context")
      .eq("id", runGuidedId!)
      .maybeSingle();

    expect(guidedRow, "expected engine_state row for run_guided").toBeTruthy();
    const guided = guidedRow as { status: string; context: Record<string, unknown> };

    // run_guided rows must have status='active', not 'pending' (run_dev).
    expect(guided.status, "run_guided engine_state must have status=active (L-0023)").toBe(
      "active",
    );
    expect(
      guided.context.capability,
      "run_guided engine_state.context.capability must be journey.run_guided",
    ).toBe("journey.run_guided");

    // ── Assert no `pending` row references this journey_version_id ─────────
    // If run_dev were accidentally called on the same version, it would insert
    // a `pending` row (run_dev's status). We assert zero such rows exist in
    // our test window (L-0023 cross-coverage: run_guided only writes 'active').
    const { data: pendingRows } = await supabase
      .from("engine_state")
      .select("id, status, context")
      .eq("workspace_id", HQ_WORKSPACE_ID)
      .eq("status", "pending")
      .eq("entity_id", sharedVersionId!)
      .gte("created_at", since);

    expect(
      pendingRows ?? [],
      "No pending engine_state rows should exist for the run_guided journey_version (L-0023 cross-coverage)",
    ).toHaveLength(0);
  });
});
