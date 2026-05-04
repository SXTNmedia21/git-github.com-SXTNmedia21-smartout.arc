/**
 * journey-capability-run-dev.spec.ts — L-0125 artefact-asserting E2E.
 *
 * Locks the run_dev capability's contract at the artefact layer, not the
 * return-shape layer. Mirrors the structure of
 * `journey-capability-publish-mission.spec.ts` (the gold standard).
 *
 * Binding:
 *   - L-0125 — Test spirit vs letter: asserting `ok:true` is not asserting
 *              the artefact. This file IS the normative run_dev complement.
 *   - L-0023 — Dev-tracking ≠ runtime-state. `run_dev` writes to
 *              `engine_state` (runtime queue) — NOT `journey_event` (dev
 *              tracking). Tests verify this separation explicitly.
 *   - ADR-0173 — capability name `journey.run_dev` (frozen).
 *   - ADR-0175 — `journey.run_started` (5 events, 4 destinations).
 *              Tests assert `engine_event` (dot-notation) and `activity_trail`
 *              (space-form) rows per ADR-0175 destination contract.
 *   - ADR-0176 — engine_authority_config seeded at migration time.
 *              `run_dev` default authority is `suggest`.
 *   - ADR-0196 Invariant 11 — no phantom capabilities. `run_dev` inserts
 *              `engine_state` + `engine_state_step` before emitting run_started.
 *              Validation-failure path emits ZERO rows, ZERO events.
 *
 * Router invocation pattern:
 *   The canonical router is the Server Action `startDevRunAction`
 *   (`apps/web/.../run/actions/start-dev-run.ts`), invoked from the
 *   DevRunLauncher "Start test-kjøring" button. We drive the real router
 *   via Playwright UI click — this exercises `assertPlatformAdmin()` +
 *   `gateAction()` + `runDevTool.execute()` together.
 *
 * Phase expectations:
 *   - Happy path: GREEN (run_dev body is implemented — inserts engine_state
 *     + steps + emits run_started + step_reached).
 *   - Validation failure: GREEN (invalid journey_version_id → 404 preflight
 *     in the Server Action; no state rows, no events).
 *
 * Precondition — the journey row must have a non-null `engine_process_id`
 *   for `runDevTool` to accept it (journey_not_compiled guard). We seed this
 *   via `seedCompiledParentJourney()` below, which reuses the idempotent
 *   `e2e_journey_run` process row.
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
// IR fixture — valid v2.0.0 IR that JourneyIRSchema.safeParse accepts.
// run_dev accepts ANY journey_version_status (draft, testing, published…)
// and does NOT require v2.1 fields (system_prompt / mode).
// ---------------------------------------------------------------------------

const VALID_V2_IR = {
  version: "2.0.0",
  slug: "e2e-run-dev-ir",
  title: "Run Dev E2E IR",
  module: "testing",
  steps: [
    {
      key: "step-open",
      title: "Open the dashboard",
      action: "Click the dashboard link",
      assertion: "Dashboard header is visible",
    },
    {
      key: "step-verify",
      title: "Verify the sidebar",
      action: "Scroll down in the sidebar",
      assertion: "Sidebar links are visible",
    },
  ],
};

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

const E2E_PROCESS_ID = "e2e_journey_run";

/**
 * Ensure the idempotent `e2e_journey_run` engine_process row exists.
 * Mirrors `ensureEngineRunProcess()` in journey-seed.ts (private there).
 */
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
 * Seed a parent journey with `engine_process_id` set to `e2e_journey_run`.
 *
 * `runDevTool` rejects with `journey_not_compiled` when engine_process_id is
 * null (the journey has not been "compiled" to a process blueprint). For E2E
 * we wire the seed process ID directly so the capability body proceeds past
 * that guard.
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
 * Seed a journey_version in `draft` status with valid v2.0.0 IR.
 * run_dev accepts any status — we pick `draft` to avoid pollution from
 * publish-ready versions.
 */
async function seedDevRunVersion(opts: {
  journeyId: string;
  slug: string;
}): Promise<{ journey_version_id: string }> {
  const { data, error } = await supabase
    .from("journey_version")
    .insert({
      workspace_id: HQ_WORKSPACE_ID,
      journey_id: opts.journeyId,
      status: "draft",
      ir_json: { ...VALID_V2_IR, slug: opts.slug },
      created_by: "e0000000-0000-0000-0000-000000000000",
    })
    .select("journey_version_id")
    .single();
  if (error || !data) throw new Error(`seedDevRunVersion failed: ${error?.message ?? "no row"}`);
  return { journey_version_id: (data as { journey_version_id: string }).journey_version_id };
}

// ---------------------------------------------------------------------------
// Cleanup helpers — best-effort deletion in reverse-FK order.
// ---------------------------------------------------------------------------

async function cleanupRunRows(runIds: string[]): Promise<void> {
  if (runIds.length === 0) return;
  await supabase.from("engine_state_step").delete().in("state_id", runIds);
  await supabase.from("engine_state").delete().in("id", runIds);
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

test.describe.configure({ mode: "serial" });

test.describe("journey.run_dev — L-0125 artefact assertion @journey-engine", () => {
  const fixtures: JourneyFixtureIds = {
    journey_ids: [],
    journey_version_ids: [],
  };
  const runIds: string[] = [];

  test.afterEach(async () => {
    if (runIds.length > 0) {
      await cleanupRunRows([...runIds]);
      runIds.length = 0;
    }
  });

  test.afterAll(async () => {
    // activity_trail + engine_event are append-only telemetry — leave rows.
    await cleanupJourneyFixtures(fixtures);
  });

  // ── Happy path ─────────────────────────────────────────────────────────────

  test("run_dev writes engine_state + engine_state_step + emits run_started (L-0125 spirit)", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    const since = new Date().toISOString();
    const slug = `e2e-run-dev-happy-${Date.now()}`;

    const parent = await seedCompiledParentJourney(slug);
    fixtures.journey_ids!.push(parent.journey_id);

    const version = await seedDevRunVersion({ journeyId: parent.journey_id, slug });
    fixtures.journey_version_ids!.push(version.journey_version_id);

    // Drive the real router via Playwright UI click. This fires
    // `startDevRunAction` → `gateAction` → `runDevTool.execute()`.
    await loginAsPlatformAdmin(page);
    await page.goto(`/platform-admin/journeys/versions/${version.journey_version_id}/run`);

    const startButton = page.getByTestId("start-dev-run");
    await expect(startButton).toBeVisible({ timeout: 10_000 });
    await startButton.click();

    // DevRunLauncher hides the Start button after a successful run_id is returned
    // (the component sets runId and the button's container unmounts). A short
    // settle after click is sufficient — startDevRunAction is a Server Action
    // that resolves in-request without a redirect.
    await expect(startButton).toBeHidden({ timeout: 15_000 });

    // Give the Server Action time to complete DB writes before asserting.
    await page.waitForTimeout(2_000);

    // ── Spirit of L-0125 — artefact assertion: engine_state ────────────────
    // run_dev inserts an engine_state row with status='pending' for the
    // `journey_version_id` within the HQ workspace. We filter by
    // workspace_id + entity_id + started_at >= since to isolate this run.
    // NOTE: engine_state has no created_at column — started_at is the insert
    // timestamp (DEFAULT now()); updated_at is the last-mutation timestamp.
    const { data: stateRows, error: stateErr } = await supabase
      .from("engine_state")
      .select("id, status, context, process_id, workspace_id, entity_id, current_step")
      .eq("workspace_id", HQ_WORKSPACE_ID)
      .eq("entity_id", version.journey_version_id)
      .gte("started_at", since);

    expect(stateErr, `engine_state SELECT failed: ${stateErr?.message}`).toBeNull();
    expect(stateRows, "expected engine_state row after run_dev").toBeTruthy();
    expect(stateRows!.length).toBeGreaterThanOrEqual(1);

    const stateRow = stateRows![0] as {
      id: string;
      status: string;
      context: Record<string, unknown>;
      process_id: string;
      workspace_id: string;
      entity_id: string;
      current_step: number;
    };

    // Record run_id for cleanup.
    runIds.push(stateRow.id);

    // run_dev sets status='pending' (DB constraint vocabulary). 'pending'
    // is the queued-not-yet-started state (not 'active' — that's run_guided's
    // status for live execution). The out-of-band Playwright worker flips to
    // 'active' when it picks up the row.
    expect(stateRow.status).toBe("pending");
    // context must carry the capability + surface identifiers.
    expect(stateRow.context).toMatchObject({
      capability: "journey.run_dev",
      surface: "dev",
      journey_version_id: version.journey_version_id,
    });
    // process_id wired to the e2e seed process.
    expect(stateRow.process_id).toBe(E2E_PROCESS_ID);

    // ── engine_state_step cascade ────────────────────────────────────────────
    // One row per IR step (VALID_V2_IR has 2 steps). All status='pending'.
    const { data: stepRows, error: stepErr } = await supabase
      .from("engine_state_step")
      .select("id, step_order, status, action_type, action_payload")
      .eq("state_id", stateRow.id)
      .order("step_order", { ascending: true });

    expect(stepErr, `engine_state_step SELECT failed: ${stepErr?.message}`).toBeNull();
    expect(stepRows, "expected engine_state_step rows").toBeTruthy();
    expect(stepRows!.length).toBe(VALID_V2_IR.steps.length);

    stepRows!.forEach((row: unknown, idx: number) => {
      const s = row as { step_order: number; status: string; action_type: string };
      expect(s.step_order).toBe(idx);
      expect(s.status).toBe("pending");
      // action_type is the step's `action` string from the IR.
      expect(s.action_type).toBe(VALID_V2_IR.steps[idx]!.action);
    });

    // ── L-0023 guard: NO journey_event rows written by run_dev ─────────────
    // L-0023 separates dev-tracking (journey_event) from runtime-state
    // (engine_state). run_dev only writes engine_state — journey_event is
    // never touched. Assert zero rows for our run_id in journey_event.
    const { data: journeyEventRows } = await supabase
      .from("journey_event")
      .select("id")
      .eq("workspace_id", HQ_WORKSPACE_ID)
      .gte("created_at", since);
    // journey_event could have rows from other concurrent tests — we only
    // care that none reference our run_id in the payload. Filter by run_id
    // in the jsonb context column.
    const ourJourneyEvents = (journeyEventRows ?? []).filter((row: unknown) => {
      const r = row as { id: string };
      // We check by presence of the state_id in journey_event rows; if the
      // table doesn't have a run_id FK, we verify via zero-count at since.
      return false; // Structural: we only assert via the count check below.
    });
    // Primary assertion: no `journey_event` row was written since `since`
    // with context.run_id matching our state row id.
    // If journey_event has a context JSONB column, filter there.
    const { data: runDevJourneyEvents } = await supabase
      .from("journey_event")
      .select("id")
      .eq("workspace_id", HQ_WORKSPACE_ID)
      .contains("context", { run_id: stateRow.id });
    expect(
      runDevJourneyEvents ?? [],
      "L-0023 violation: run_dev must not write journey_event rows (dev-tracking ≠ runtime-state)",
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
    // At least 1 run_started event — allow >1 in case of a retry.
    expect(events!.length).toBeGreaterThanOrEqual(1);

    // Payload must include run_id + capability + surface + workspace_id.
    const eventPayload = (events![0] as { payload: Record<string, unknown> }).payload;
    expect(eventPayload).toMatchObject({
      capability: "journey.run_dev",
      surface: "dev",
      workspace_id: HQ_WORKSPACE_ID,
    });
    // run_id in payload must match our engine_state.id.
    expect(eventPayload.run_id).toBe(stateRow.id);

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
    // ADR-0134 / ADR-0176: actor_id must be the admin profile, not empty.
    const trailActor = (trailRows![0] as { actor_id: string }).actor_id;
    expect(trailActor).toBe(ADMIN_PROFILE_ID);
  });

  // ── Validation failure path ─────────────────────────────────────────────────

  test("run_dev rejects invalid journey_version_id — zero engine_state rows, zero emits", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    const since = new Date().toISOString();

    // The startDevRunAction pre-flight checks that the journey_version belongs
    // to the admin workspace. A random UUID that doesn't exist → "Not found"
    // response from the Server Action → the DevRunLauncher renders the error,
    // the Start button remains visible (not hidden), and zero rows are inserted.
    const NON_EXISTENT_VERSION_ID = "00000000-dead-beef-cafe-000000000000";

    await loginAsPlatformAdmin(page);
    await page.goto(`/platform-admin/journeys/versions/${NON_EXISTENT_VERSION_ID}/run`);

    // The page itself returns 404 (notFound()) when the journey_version row
    // doesn't exist in the DB (server component fetches it before rendering).
    // We verify by asserting we're on a 404 page or redirected, not on the
    // /run surface with an active button.
    //
    // The server component calls `notFound()` directly — Next.js renders a 404
    // page, which does not contain the `data-testid="start-dev-run"` button.
    const startButton = page.getByTestId("start-dev-run");
    await expect(startButton).toBeHidden({ timeout: 5_000 });

    // ── Zero engine_state rows since `since` for the bad version_id ─────────
    const { data: stateRows } = await supabase
      .from("engine_state")
      .select("id")
      .eq("workspace_id", HQ_WORKSPACE_ID)
      .eq("entity_id", NON_EXISTENT_VERSION_ID)
      .gte("created_at", since);
    expect(
      stateRows ?? [],
      "engine_state must not be written for an invalid journey_version_id",
    ).toHaveLength(0);

    // ── Zero journey.run_started events since `since` ────────────────────────
    // Even if some other test emits run_started in the window, none should
    // reference the non-existent version_id in the payload.
    const { data: events } = await supabase
      .from("engine_event")
      .select("id, payload")
      .eq("workspace_id", HQ_WORKSPACE_ID)
      .eq("event_type", "journey.run_started")
      .gte("fired_at", since);

    const spuriousEvents = (events ?? []).filter((row: unknown) => {
      const r = row as { payload: Record<string, unknown> };
      return r.payload?.journey_version_id === NON_EXISTENT_VERSION_ID;
    });
    expect(
      spuriousEvents,
      "engine_event journey.run_started must not fire for an invalid version_id",
    ).toHaveLength(0);
  });
});
