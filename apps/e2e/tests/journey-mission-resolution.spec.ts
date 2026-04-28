/**
 * journey-mission-resolution.spec.ts — L-0125 artefact-asserting E2E.
 *
 * Tests the Mission Resolution Layer (Phase 3 #2) which closes the retraction:
 * `runGuidedTool.execute()` previously wrote `engine_state` without EVER reading
 * `engine_missions`. The `is_active=true` rows from `activateMissionAction` had
 * ZERO runtime consumers. This spec verifies the gap is closed.
 *
 * Binding:
 *   - L-0125 — Test spirit vs letter: assert the artefact (engine_state.context
 *              contains mission_id/mode/system_prompt), not just `ok:true`.
 *   - ADR-0194 — JourneyIR v2.1 → engine_missions hybrid mapping. Two-step join:
 *              journey_version → journey → engine_missions(is_active=true).
 *   - ADR-0196 Invariant 11 — no phantom capabilities: no `run_started` emit
 *              without a real engine_state + mission artefact.
 *   - ADR-0132 — Mobile AI Routing — same BFF route handles both web and mobile.
 *   - ADR-0134 / ADR-0176 — workspaceId server-derived, never from client body.
 *
 * Three tests:
 *   1. Happy path — published version + active mission → HTTP 200, run_id,
 *      engine_state.context contains mission_id/mission_mode/mission_system_prompt.
 *   2. No active mission (409) — published version + is_active=false mission →
 *      HTTP 409 no_active_mission, ZERO engine_state rows.
 *   3. Multiple active (data integrity guard) — 2 missions both is_active=true →
 *      HTTP 500 data_integrity_multiple_active_missions, ZERO engine_state rows.
 *
 * Router invocation:
 *   POST /api/journey/guided/start with cookie auth (same session as
 *   loginAsPlatformAdmin). The BFF pre-resolution guard (5.5) runs BEFORE
 *   `runGuidedTool` — so the 409/500 return happens before any DB state write.
 */

import { test, expect } from "@playwright/test";
import { loginAsPlatformAdmin } from "../helpers/admin-login";
import {
  cleanupJourneyFixtures,
  seedParentJourney,
  ADMIN_PROFILE_ID,
  HQ_WORKSPACE_ID,
  type JourneyFixtureIds,
} from "../helpers/journey-seed";
import { supabase } from "../helpers/seed";

// ---------------------------------------------------------------------------
// Shared IR fixtures
// ---------------------------------------------------------------------------

const V21_IR = {
  version: "2.1.0",
  slug: "e2e-mission-resolution-ir",
  title: "Mission Resolution E2E IR",
  module: "testing",
  system_prompt: "You are Botsson. Guide the user through the resolution test.",
  mode: "sequential" as const,
  steps: [
    {
      key: "step-a",
      title: "Open the dashboard",
      action: "Click the dashboard link",
      assertion: "Dashboard header is visible",
    },
    {
      key: "step-b",
      title: "Confirm the action",
      action: "Click the confirm button",
      assertion: "Modal appears",
    },
  ],
};

// Minimal v2.0 IR — doesn't need v2.1 fields for run_guided (only publish_mission does).
const V20_IR = {
  version: "2.0.0",
  slug: "e2e-mission-resolution-run",
  title: "Run Guided Resolution E2E",
  module: "testing",
  steps: [
    {
      key: "step-a",
      title: "Open the dashboard",
      action: "Click the dashboard link",
      assertion: "Dashboard header is visible",
    },
    {
      key: "step-b",
      title: "Confirm the action",
      action: "Click the confirm button",
      assertion: "Modal appears",
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

async function seedPublishedVersion(opts: {
  journeyId: string;
  slug: string;
}): Promise<{ journey_version_id: string }> {
  const { data, error } = await supabase
    .from("journey_version")
    .insert({
      workspace_id: HQ_WORKSPACE_ID,
      journey_id: opts.journeyId,
      status: "published",
      ir_json: { ...V20_IR, slug: opts.slug },
      created_by: "e0000000-0000-0000-0000-000000000000",
    })
    .select("journey_version_id")
    .single();
  if (error || !data) throw new Error(`seedPublishedVersion failed: ${error?.message ?? "no row"}`);
  return { journey_version_id: (data as { journey_version_id: string }).journey_version_id };
}

/**
 * Seed an active mission with 2 stages for the given journey_id.
 * Seeds stages inline (simulates completed enrich-mission flow).
 */
async function seedActiveMission(opts: {
  journeyId: string;
  slug: string;
}): Promise<{ mission_id: string }> {
  const missionId = `journey_${opts.slug}_v1`;

  const { error: missionErr } = await supabase.from("engine_missions").insert({
    id: missionId,
    name: `Resolution E2E Mission ${opts.slug}`,
    description: "Seeded by journey-mission-resolution E2E",
    mode: V21_IR.mode,
    system_prompt: V21_IR.system_prompt,
    workspace_id: HQ_WORKSPACE_ID,
    journey_id: opts.journeyId,
    is_active: true,
  });
  if (missionErr)
    throw new Error(`seedActiveMission: engine_missions insert failed: ${missionErr.message}`);

  // Seed stages
  const stageRows = V21_IR.steps.map((step, idx) => ({
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
    throw new Error(`seedActiveMission: engine_stages insert failed: ${stagesErr.message}`);

  return { mission_id: missionId };
}

/**
 * Seed an inactive mission (is_active=false) — simulates publish-only, not activated.
 */
async function seedInactiveMission(opts: {
  journeyId: string;
  slug: string;
}): Promise<{ mission_id: string }> {
  const missionId = `journey_${opts.slug}_v1_inactive`;

  const { error } = await supabase.from("engine_missions").insert({
    id: missionId,
    name: `Inactive Mission ${opts.slug}`,
    description: "Seeded inactive by journey-mission-resolution E2E",
    mode: "sequential",
    system_prompt: "This mission is not active.",
    workspace_id: HQ_WORKSPACE_ID,
    journey_id: opts.journeyId,
    is_active: false,
  });
  if (error)
    throw new Error(`seedInactiveMission: engine_missions insert failed: ${error.message}`);

  return { mission_id: missionId };
}

/**
 * Seed 2 missions both is_active=true for the same journey_id.
 * Bypasses activateMissionAction (which would prevent this) via direct SQL.
 * Simulates a data integrity corruption scenario.
 */
async function seedMultipleActiveMissions(opts: {
  journeyId: string;
  slug: string;
}): Promise<{ mission_id_a: string; mission_id_b: string }> {
  const missionIdA = `journey_${opts.slug}_v1_multi_a`;
  const missionIdB = `journey_${opts.slug}_v1_multi_b`;

  const missions = [
    {
      id: missionIdA,
      name: `Multi Active A ${opts.slug}`,
      description: "Seeded for data-integrity test",
      mode: "sequential",
      system_prompt: "Mission A — corrupted state",
      workspace_id: HQ_WORKSPACE_ID,
      journey_id: opts.journeyId,
      is_active: true,
    },
    {
      id: missionIdB,
      name: `Multi Active B ${opts.slug}`,
      description: "Seeded for data-integrity test",
      mode: "sequential",
      system_prompt: "Mission B — corrupted state",
      workspace_id: HQ_WORKSPACE_ID,
      journey_id: opts.journeyId,
      is_active: true,
    },
  ];

  for (const m of missions) {
    const { error } = await supabase.from("engine_missions").insert(m);
    if (error)
      throw new Error(`seedMultipleActiveMissions: insert failed for ${m.id}: ${error.message}`);
  }

  return { mission_id_a: missionIdA, mission_id_b: missionIdB };
}

async function cleanupEngineRows(runIds: string[]): Promise<void> {
  if (runIds.length === 0) return;
  await supabase.from("engine_state_step").delete().in("state_id", runIds);
  await supabase.from("engine_state").delete().in("id", runIds);
}

async function cleanupMissions(missionIds: string[]): Promise<void> {
  if (missionIds.length === 0) return;
  await supabase.from("engine_stages").delete().in("mission_id", missionIds);
  await supabase.from("engine_missions").delete().in("id", missionIds);
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

test.describe.configure({ mode: "serial" });

test.describe("journey mission resolution — happy path + 409 guard + multiple_active integrity @journey-engine", () => {
  const fixtures: JourneyFixtureIds = {
    journey_ids: [],
    journey_version_ids: [],
  };
  const runIds: string[] = [];
  const missionIds: string[] = [];

  test.afterEach(async () => {
    if (runIds.length > 0) {
      await cleanupEngineRows([...runIds]);
      runIds.length = 0;
    }
  });

  test.afterAll(async () => {
    await cleanupMissions(missionIds);
    await cleanupJourneyFixtures(fixtures);
  });

  // ── Test 1: Happy resolution path ────────────────────────────────────────

  test("Test 1 — happy path: engine_state.context contains mission_id + mission_mode + mission_system_prompt (L-0125 spirit)", async ({
    page,
    baseURL,
  }) => {
    test.setTimeout(60_000);

    const slug = `e2e-mres-happy-${Date.now()}`;

    // Seed: compiled parent journey + published version + active mission with stages.
    const parent = await seedCompiledParentJourney(slug);
    fixtures.journey_ids!.push(parent.journey_id);

    const version = await seedPublishedVersion({
      journeyId: parent.journey_id,
      slug,
    });
    fixtures.journey_version_ids!.push(version.journey_version_id);

    const { mission_id } = await seedActiveMission({
      journeyId: parent.journey_id,
      slug,
    });
    missionIds.push(mission_id);

    // Authenticate + POST to BFF.
    await loginAsPlatformAdmin(page);
    const bffResponse = await page.request.post(`${baseURL}/api/journey/guided/start`, {
      data: { journey_version_id: version.journey_version_id },
      headers: { "Content-Type": "application/json" },
    });

    // ── Assert HTTP 200 ────────────────────────────────────────────────────
    expect(
      bffResponse.status(),
      `BFF returned unexpected status ${bffResponse.status()}. ` +
        `Expected 200 (active mission seeded). Body: ${await bffResponse.text()}`,
    ).toBe(200);

    const bffBody = (await bffResponse.json()) as {
      run_id?: string;
      status?: string;
      error?: string;
    };

    expect(bffBody.run_id, "BFF must return run_id on success").toBeTruthy();
    expect(bffBody.status).toBe("active");

    const runId = bffBody.run_id!;
    runIds.push(runId);

    // Allow DB writes to settle.
    await page.waitForTimeout(1_000);

    // ── L-0125 spirit: assert engine_state.context contains mission fields ─
    // This is the core retraction closure: engine_state must now carry
    // mission_id, mission_mode, mission_system_prompt from the resolved mission.
    const { data: stateRow, error: stateErr } = await supabase
      .from("engine_state")
      .select("id, status, context, workspace_id, entity_id")
      .eq("id", runId)
      .maybeSingle();

    expect(stateErr, `engine_state SELECT failed: ${stateErr?.message}`).toBeNull();
    expect(stateRow, `expected engine_state row for run_id ${runId}`).toBeTruthy();

    const sr = stateRow as {
      id: string;
      status: string;
      context: Record<string, unknown>;
      workspace_id: string;
      entity_id: string;
    };

    expect(sr.status).toBe("active");
    expect(sr.workspace_id).toBe(HQ_WORKSPACE_ID);

    // ── Primary retraction assertion ───────────────────────────────────────
    // engine_state.context MUST include the 3 resolved mission fields.
    // Before Phase 3 #2, this object only had journey_version_id + capability.
    expect(
      sr.context.mission_id,
      "engine_state.context.mission_id must match the seeded active mission (closes M5 retraction)",
    ).toBe(mission_id);
    expect(
      sr.context.mission_mode,
      "engine_state.context.mission_mode must be populated from mission row",
    ).toBe(V21_IR.mode);
    expect(
      sr.context.mission_system_prompt,
      "engine_state.context.mission_system_prompt must be populated from mission row",
    ).toBe(V21_IR.system_prompt);

    // ── Telemetry: run_started emitted AFTER successful artefact write ─────
    // Invariant 11: emit only after engine_state insert succeeds.
    const since = new Date(Date.now() - 30_000).toISOString(); // 30s window
    const { data: events, error: eventErr } = await supabase
      .from("engine_event")
      .select("id, event_type, payload")
      .eq("workspace_id", HQ_WORKSPACE_ID)
      .eq("event_type", "journey.run_started")
      .gte("fired_at", since);

    expect(eventErr, `engine_event SELECT failed: ${eventErr?.message}`).toBeNull();

    const ourEvent = (events ?? []).find(
      (e) => (e.payload as Record<string, unknown>).run_id === runId,
    );
    expect(ourEvent, `expected engine_event run_started with run_id=${runId}`).toBeTruthy();

    // ── activity_trail telemetry (space-form per ADR-0175) ────────────────
    const { data: trailRows, error: trailErr } = await supabase
      .from("activity_trail")
      .select("id, event, actor_id, workspace_id")
      .eq("workspace_id", HQ_WORKSPACE_ID)
      .eq("event", "journey run_started")
      .gte("created_at", since);

    expect(trailErr, `activity_trail SELECT failed: ${trailErr?.message}`).toBeNull();
    const ourTrail = (trailRows ?? []).find(
      // The capability embeds run_id in the entity label, not the trail event directly.
      // Match by actor_id (admin profile) + time window as a proxy.
      (r) => (r as { actor_id: string }).actor_id === ADMIN_PROFILE_ID,
    );
    expect(ourTrail, "expected activity_trail run_started row for admin profile").toBeTruthy();
  });

  // ── Test 2: No active mission → HTTP 409 ─────────────────────────────────

  test("Test 2 — no active mission returns HTTP 409 no_active_mission + ZERO engine_state rows (Invariant 11)", async ({
    page,
    baseURL,
  }) => {
    test.setTimeout(60_000);

    const slug = `e2e-mres-noactive-${Date.now()}`;

    // Seed: compiled parent journey + published version + INACTIVE mission.
    const parent = await seedCompiledParentJourney(slug);
    fixtures.journey_ids!.push(parent.journey_id);

    const version = await seedPublishedVersion({
      journeyId: parent.journey_id,
      slug,
    });
    fixtures.journey_version_ids!.push(version.journey_version_id);

    const { mission_id } = await seedInactiveMission({
      journeyId: parent.journey_id,
      slug,
    });
    missionIds.push(mission_id);

    const since = new Date().toISOString();

    // Authenticate + POST to BFF.
    await loginAsPlatformAdmin(page);
    const bffResponse = await page.request.post(`${baseURL}/api/journey/guided/start`, {
      data: { journey_version_id: version.journey_version_id },
      headers: { "Content-Type": "application/json" },
    });

    // ── Assert HTTP 409 ────────────────────────────────────────────────────
    expect(
      bffResponse.status(),
      `BFF must return 409 when no active mission exists. Got ${bffResponse.status()}`,
    ).toBe(409);

    const bffBody = (await bffResponse.json()) as {
      error?: string;
      detail?: string;
    };

    expect(bffBody.error, "BFF must return structured error.error='no_active_mission'").toBe(
      "no_active_mission",
    );

    // Allow any async writes to settle.
    await page.waitForTimeout(500);

    // ── Invariant 11: ZERO engine_state rows created ───────────────────────
    // The BFF pre-resolution guard returns 409 BEFORE runGuidedTool is called,
    // so NO engine_state row should exist for this journey_version_id.
    const { data: stateRows, error: stateErr } = await supabase
      .from("engine_state")
      .select("id, context")
      .eq("workspace_id", HQ_WORKSPACE_ID)
      .eq("entity_id", version.journey_version_id)
      .gte("created_at", since);

    expect(stateErr, `engine_state SELECT failed: ${stateErr?.message}`).toBeNull();
    expect(
      stateRows ?? [],
      "engine_state must have ZERO rows when BFF returns 409 no_active_mission (Invariant 11)",
    ).toHaveLength(0);

    // ── Invariant 11: ZERO run_started emits ──────────────────────────────
    // Phantom emit prevention: no emit fires without a real artefact (ADR-0196).
    const { data: events, error: eventErr } = await supabase
      .from("engine_event")
      .select("id, event_type")
      .eq("workspace_id", HQ_WORKSPACE_ID)
      .eq("event_type", "journey.run_started")
      .gte("fired_at", since);

    expect(eventErr, `engine_event SELECT failed: ${eventErr?.message}`).toBeNull();
    expect(
      events ?? [],
      "ZERO run_started events must be emitted when no active mission (Invariant 11)",
    ).toHaveLength(0);
  });

  // ── Test 3: Multiple active missions → HTTP 500 data integrity ───────────

  test("Test 3 — multiple is_active=true missions returns 500 data_integrity_multiple_active_missions + ZERO engine_state rows", async ({
    page,
    baseURL,
  }) => {
    test.setTimeout(60_000);

    const slug = `e2e-mres-multi-${Date.now()}`;

    // Seed: compiled parent journey + published version + 2 is_active=true missions.
    // This bypasses activateMissionAction (which prevents duplicate activation)
    // to simulate a data integrity corruption scenario (e.g. direct SQL update).
    const parent = await seedCompiledParentJourney(slug);
    fixtures.journey_ids!.push(parent.journey_id);

    const version = await seedPublishedVersion({
      journeyId: parent.journey_id,
      slug,
    });
    fixtures.journey_version_ids!.push(version.journey_version_id);

    const { mission_id_a, mission_id_b } = await seedMultipleActiveMissions({
      journeyId: parent.journey_id,
      slug,
    });
    missionIds.push(mission_id_a, mission_id_b);

    const since = new Date().toISOString();

    // Authenticate + POST to BFF.
    await loginAsPlatformAdmin(page);
    const bffResponse = await page.request.post(`${baseURL}/api/journey/guided/start`, {
      data: { journey_version_id: version.journey_version_id },
      headers: { "Content-Type": "application/json" },
    });

    // ── Assert HTTP 500 (data integrity bug) ───────────────────────────────
    expect(
      bffResponse.status(),
      `BFF must return 500 on data integrity multiple_active. Got ${bffResponse.status()}`,
    ).toBe(500);

    const bffBody = (await bffResponse.json()) as {
      error?: string;
      detail?: string;
    };

    expect(bffBody.error, "BFF must return error='data_integrity_multiple_active_missions'").toBe(
      "data_integrity_multiple_active_missions",
    );

    // Allow any async writes to settle.
    await page.waitForTimeout(500);

    // ── ZERO engine_state rows created ─────────────────────────────────────
    const { data: stateRows, error: stateErr } = await supabase
      .from("engine_state")
      .select("id")
      .eq("workspace_id", HQ_WORKSPACE_ID)
      .eq("entity_id", version.journey_version_id)
      .gte("created_at", since);

    expect(stateErr, `engine_state SELECT failed: ${stateErr?.message}`).toBeNull();
    expect(
      stateRows ?? [],
      "engine_state must have ZERO rows when multiple_active data integrity error",
    ).toHaveLength(0);
  });
});
