/**
 * journey-capability-publish-mission.spec.ts — L-0125 artefact-assertion E2E.
 *
 * Locks the publish_mission capability's contract at the artefact layer, not
 * the return-shape layer. This is the Phase A (red) test for
 * `feat/journey-engine-publish-mission-body`.
 *
 * Binding:
 *   - L-0125 — Test spirit vs letter: asserting `ok:true` is not asserting the
 *              artefact. This file IS the normative template from L-0125.
 *   - ADR-0194 — JourneyIR v2.1 → engine_missions hybrid mapping.
 *              Required root fields: `system_prompt` (non-empty) + `mode`.
 *              Per-stage: goal := step.title, instructions := step.action,
 *              success_criteria := step.assertion.
 *   - ADR-0196 Invariant 11 — no phantom capabilities. A capability that
 *              emits `journey run_started` MUST also produce its declared
 *              artefact (engine_missions row) in the same execute() call.
 *   - ADR-0175 — journey.run_started emits to 4 destinations; this test
 *              asserts the two persistent ones (engine_event + activity_trail).
 *   - L-0118 — every capability tool requires an E2E Trust-Gate test. This
 *              test satisfies L-0118's letter (ok:true) AND spirit (SELECT
 *              against engine_missions with .eq() filter matching the
 *              tool's claimed write).
 *
 * Router invocation pattern:
 *   The canonical router for publish_mission is the Server Action
 *   `publishMissionAction` (apps/web/.../actions/publish-mission.ts), called
 *   from `JourneyVersionEditor.tsx` via the "Publish Mission" button that
 *   appears when `status === 'ready_publish'`. Because the Server Action
 *   is fronted by Next.js auth cookies and not an HTTP route, we drive the
 *   real router via Playwright UI click — this is the production path and
 *   the only way to exercise `assertPlatformAdmin()` + `gateAction()` +
 *   `publishMissionTool.execute()` together. This deliberately does NOT
 *   call `publishMissionTool.execute()` directly — that is the rubber-stamp
 *   pattern L-0125 exists to kill.
 *
 * Phase A expectation: both tests RED until the publish_mission body
 * (Phase B) lands. Today the body returns
 * `{ok:false, error:"not_implemented"}` and emits nothing — happy-path test
 * fails on `ok:true` expectation; rejection test fails because even a valid
 * IR returns not_implemented (wrong error shape). After Phase B both go
 * green together.
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

const ADMIN_USER_ID = "e0000000-0000-0000-0000-000000000000";

// -----------------------------------------------------------------------------
// IR fixtures — v2.1 additive fields per ADR-0194 are written directly into
// the JSONB column. TypeScript's JourneyIRSchema has not yet been bumped to
// v2.1 (Phase B will add the validator in packages/journey-ir/src/validate.ts),
// so we cast via `Record<string, unknown>` at the seed boundary only.
// -----------------------------------------------------------------------------

type V21IrFixture = Record<string, unknown>;

function validV21Ir(slug: string): V21IrFixture {
  return {
    version: "2.1.0",
    slug,
    title: `Publish Mission E2E ${slug}`,
    module: "testing",
    // ADR-0194 v2.1 root additions
    system_prompt: "Du er Botsson. Hjelp brukeren gjennom en test-flyt. Vær kort og varm.",
    mode: "sequential",
    steps: [
      {
        key: "step-intro",
        title: "Open the dashboard",
        action: "Click the dashboard link in the sidebar",
        assertion: "Dashboard header is visible on the page",
      },
      {
        key: "step-confirm",
        title: "Confirm the action",
        action: "Fill the confirmation textbox with 'yes'",
        assertion: "Submit button becomes enabled",
      },
    ],
  };
}

function incompleteV21IrMissingSystemPrompt(slug: string): V21IrFixture {
  const ir = validV21Ir(slug);
  delete (ir as { system_prompt?: unknown }).system_prompt;
  return ir;
}

// -----------------------------------------------------------------------------
// Seed helper — create parent journey + journey_version in ready_publish with
// an IR blob of our choosing. Returns ids for cleanup + assertion.
// -----------------------------------------------------------------------------

async function seedReadyPublishVersion(opts: {
  workspaceId?: string;
  slug: string;
  ir: V21IrFixture;
}): Promise<{ journey_id: string; journey_version_id: string; slug: string }> {
  const workspaceId = opts.workspaceId ?? HQ_WORKSPACE_ID;
  const parent = await seedParentJourney({ workspaceId, slug: opts.slug });

  const { data, error } = await supabase
    .from("journey_version")
    .insert({
      workspace_id: workspaceId,
      journey_id: parent.journey_id,
      status: "ready_publish",
      ir_json: opts.ir,
      created_by: ADMIN_USER_ID,
    })
    .select("journey_version_id")
    .single();

  if (error || !data) {
    throw new Error(`seedReadyPublishVersion failed: ${error?.message ?? "no row"}`);
  }

  return {
    journey_id: parent.journey_id,
    journey_version_id: (data as { journey_version_id: string }).journey_version_id,
    slug: parent.slug,
  };
}

// -----------------------------------------------------------------------------
// Test suite
// -----------------------------------------------------------------------------

test.describe.configure({ mode: "serial" });

test.describe("journey.publish_mission — L-0125 artefact assertion @journey-engine", () => {
  const fixtures: JourneyFixtureIds = {
    journey_ids: [],
    journey_version_ids: [],
  };
  const seededMissionIds: string[] = [];

  test.afterEach(async () => {
    // Clean any mission/stage/event rows the happy-path test may have written
    // BEFORE cleanupJourneyFixtures deletes the journey_version (engine_stages
    // cascades on mission FK; engine_missions has no FK to journey_version so
    // we must delete by our recorded ids).
    if (seededMissionIds.length > 0) {
      await supabase.from("engine_stages").delete().in("mission_id", seededMissionIds);
      await supabase.from("engine_missions").delete().in("id", seededMissionIds);
      seededMissionIds.length = 0;
    }
  });

  test.afterAll(async () => {
    // activity_trail + engine_event are append-only telemetry; we leave rows
    // in place (cleanup would require time-window deletes per test — the
    // workspace isolation + `since` timestamp filter below is sufficient for
    // deterministic re-runs).
    await cleanupJourneyFixtures(fixtures);
  });

  test("publish_mission writes engine_missions + engine_stages + emits run_started", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    const since = new Date().toISOString();
    const slug = `e2e-pub-mission-happy-${Date.now()}`;
    const ir = validV21Ir(slug);

    const seeded = await seedReadyPublishVersion({ slug, ir });
    fixtures.journey_ids!.push(seeded.journey_id);
    fixtures.journey_version_ids!.push(seeded.journey_version_id);

    // Drive the real router: navigate to the editor, click Publish Mission.
    // This fires `publishMissionAction` → `gateAction` → `publishMissionTool.execute()`.
    await loginAsPlatformAdmin(page);
    await page.goto(`/platform-admin/journeys/versions/${seeded.journey_version_id}`);

    // The editor's toolbar only shows the Publish Mission button when status =
    // 'ready_publish'. We seeded that state above, so the button must appear.
    const publishButton = page.getByRole("button", { name: /publish mission/i });
    await expect(publishButton).toBeVisible({ timeout: 10_000 });
    await publishButton.click();

    // Server Action returns `{ok:true, runId, missionId}` — the component
    // renders the mission id in the success toast text. This is the
    // Server-Action-level assertion that the UI receives the real mission_id.
    // Pattern: "Mission published · journey_<slug>_v<n> · run <runId[:8]>"
    const expectedMissionIdPrefix = `journey_${slug}_v`;
    await expect(
      page.getByText(new RegExp(`Mission published.*${expectedMissionIdPrefix}`)),
    ).toBeVisible({
      timeout: 15_000,
    });

    // Give the Server Action a moment to complete its DB writes.
    await page.waitForTimeout(2_000);

    // ── Spirit of L-0118 — artefact assertion ──────────────────────────────
    // The capability claims to insert a row in engine_missions keyed to the
    // journey_version. ADR-0194 does not fix the id format ("journey_<slug>_v<n>"
    // is one proposal in the ADR, but the M5 body has leeway). So we filter
    // by workspace_id + system_prompt match + created_at >= since — the
    // combination uniquely identifies the row this test produced.
    const { data: missions, error: missionErr } = await supabase
      .from("engine_missions")
      .select("id, workspace_id, system_prompt, mode, is_active, journey_id, created_at")
      .eq("workspace_id", HQ_WORKSPACE_ID)
      .eq("system_prompt", ir.system_prompt as string)
      .gte("created_at", since);

    expect(missionErr, `engine_missions SELECT failed: ${missionErr?.message}`).toBeNull();
    expect(missions, "expected engine_missions row after publish").toBeTruthy();
    expect(missions!.length).toBe(1);

    const mission = missions![0] as {
      id: string;
      workspace_id: string;
      system_prompt: string;
      mode: string;
      is_active: boolean;
      journey_id: string | null;
    };
    seededMissionIds.push(mission.id);

    expect(mission.mode).toBe("sequential");
    expect(mission.system_prompt).toBe(ir.system_prompt);
    // ADR-0194 Gate: is_active=false until author enrich step lands in M3.
    expect(mission.is_active).toBe(false);

    // ── Stage cascade — one engine_stages row per IR step, NOT NULL on all
    //    three coaching fields (the engine_stages constraint forces it).
    const { data: stages, error: stageErr } = await supabase
      .from("engine_stages")
      .select("goal, instructions, success_criteria, stage_order, creative_freedom")
      .eq("mission_id", mission.id)
      .order("stage_order", { ascending: true });

    expect(stageErr, `engine_stages SELECT failed: ${stageErr?.message}`).toBeNull();
    expect(stages, "expected engine_stages rows after publish").toBeTruthy();
    expect(stages!.length).toBe((ir.steps as readonly unknown[]).length);

    const steps = ir.steps as readonly {
      title: string;
      action: string;
      assertion: string;
    }[];
    stages!.forEach((row: unknown, idx: number) => {
      const s = row as {
        goal: string;
        instructions: string;
        success_criteria: string;
        stage_order: number;
        creative_freedom: number | null;
      };
      // ADR-0194 derivation rules (per-stage).
      expect(s.goal).toBe(steps[idx]!.title);
      expect(s.instructions).toBe(steps[idx]!.action);
      expect(s.success_criteria).toBe(steps[idx]!.assertion);
      // Stage order matches IR order.
      expect(s.stage_order).toBe(idx);
      // NOT NULL constraint on the schema — we assert it explicitly because
      // a regression to empty-string placeholders would satisfy NOT NULL but
      // violate the derivation contract.
      expect(s.goal.length).toBeGreaterThan(0);
      expect(s.instructions.length).toBeGreaterThan(0);
      expect(s.success_criteria.length).toBeGreaterThan(0);
    });

    // ── Telemetry — run_started must land in engine_event (destination per
    //    ADR-0175) AND activity_trail (destination per ADR-0175). We filter by
    //    workspace_id + event name + since-timestamp; any row is the artefact.
    const { data: events, error: eventErr } = await supabase
      .from("engine_event")
      .select("id, event_type, payload, workspace_id, fired_at")
      .eq("workspace_id", HQ_WORKSPACE_ID)
      // engine_event stores dot-notation per engine-dispatch toDotNotation();
      // activity_trail preserves space-form (ADR-0175 destination-specific encoding).
      .eq("event_type", "journey.run_started")
      .gte("fired_at", since);

    expect(eventErr, `engine_event SELECT failed: ${eventErr?.message}`).toBeNull();
    expect(events, "expected engine_event row for journey.run_started").toBeTruthy();
    expect(events!.length).toBeGreaterThanOrEqual(1);

    const { data: trailRows, error: trailErr } = await supabase
      .from("activity_trail")
      .select("id, event, actor_id, workspace_id, created_at")
      .eq("workspace_id", HQ_WORKSPACE_ID)
      .eq("event", "journey run_started")
      .gte("created_at", since);

    expect(trailErr, `activity_trail SELECT failed: ${trailErr?.message}`).toBeNull();
    expect(trailRows, "expected activity_trail row for journey.run_started").toBeTruthy();
    expect(trailRows!.length).toBeGreaterThanOrEqual(1);
    // ADR-0134: actor_id non-null + matches admin profile.
    const trailActor = (trailRows![0] as { actor_id: string }).actor_id;
    expect(trailActor).toBe(ADMIN_PROFILE_ID);
  });

  test("publish_mission rejects IR without system_prompt — zero rows, zero emits", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    const since = new Date().toISOString();
    const slug = `e2e-pub-mission-reject-${Date.now()}`;
    const ir = incompleteV21IrMissingSystemPrompt(slug);

    const seeded = await seedReadyPublishVersion({ slug, ir });
    fixtures.journey_ids!.push(seeded.journey_id);
    fixtures.journey_version_ids!.push(seeded.journey_version_id);

    await loginAsPlatformAdmin(page);
    await page.goto(`/platform-admin/journeys/versions/${seeded.journey_version_id}`);

    const publishButton = page.getByRole("button", { name: /publish mission/i });
    await expect(publishButton).toBeVisible({ timeout: 10_000 });
    await publishButton.click();

    // Let the Server Action settle (rejection path is faster than success).
    await page.waitForTimeout(2_000);

    // ── Negative spirit assertion ──────────────────────────────────────────
    // No engine_missions row for this journey_version.
    // The v2.1 IR missing system_prompt means the body must reject BEFORE
    // the insert — so we filter by journey_id (unique to this test) to
    // catch any partial writes.
    const { data: missions } = await supabase
      .from("engine_missions")
      .select("id")
      .eq("workspace_id", HQ_WORKSPACE_ID)
      .eq("journey_id", seeded.journey_id);
    expect(
      missions ?? [],
      "engine_missions row must not exist on validation_failed path",
    ).toHaveLength(0);

    // No engine_stages rows (cascade guard — if mission_id=null slipped
    // through we'd catch it here).
    const { data: orphanStages } = await supabase
      .from("engine_stages")
      .select("id, mission_id")
      .gte("created_at", since);
    // Filter any stages that belong to missions we DID NOT create in this test;
    // we only fail if a stage row appears that has no mission (impossible via
    // FK) OR whose mission ties to our journey_id. The simplest assertion:
    // no new stages at all since `since` in this test's workspace.
    const stagesSince = (orphanStages ?? []) as Array<{ mission_id: string }>;
    if (stagesSince.length > 0) {
      const { data: matchingMissions } = await supabase
        .from("engine_missions")
        .select("id, journey_id")
        .in(
          "id",
          stagesSince.map((s) => s.mission_id),
        );
      const leaked = (matchingMissions ?? []).filter(
        (m: { journey_id: string | null }) => m.journey_id === seeded.journey_id,
      );
      expect(leaked, "engine_stages must not exist on validation_failed path").toHaveLength(0);
    }

    // No journey.run_started emit in engine_event since the marker timestamp.
    // (Other tests may emit in the same workspace; we scope by event_type +
    // since to isolate this test's window. The happy-path test runs before
    // this one in serial mode, but its events have a strictly earlier
    // timestamp and would be filtered out by `since` in this test only if we
    // re-check — which we do here against the CURRENT `since` captured
    // immediately before the button click of THIS test.)
    const { data: events } = await supabase
      .from("engine_event")
      .select("id")
      .eq("workspace_id", HQ_WORKSPACE_ID)
      // engine_event stores dot-notation per engine-dispatch toDotNotation();
      // activity_trail preserves space-form (ADR-0175 destination-specific encoding).
      .eq("event_type", "journey.run_started")
      .gte("fired_at", since);
    expect(
      events ?? [],
      "engine_event run_started must not fire on validation_failed path",
    ).toHaveLength(0);

    const { data: trail } = await supabase
      .from("activity_trail")
      .select("id")
      .eq("workspace_id", HQ_WORKSPACE_ID)
      .eq("event", "journey run_started")
      .gte("created_at", since);
    expect(
      trail ?? [],
      "activity_trail run_started must not fire on validation_failed path",
    ).toHaveLength(0);
  });
});
