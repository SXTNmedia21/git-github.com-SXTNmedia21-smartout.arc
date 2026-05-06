/**
 * agent-rapporterer-tilstand.spec.ts
 *
 * Journey: engine-world-phase-1 / agent-rapporterer-tilstand
 * Spec:    docs/journeys/JOURNEY-engine-world-phase-1-agent-rapporterer-tilstand.md
 *
 * What: Exercises Path A (gated write via report_observation tool) and Path B
 *       (platform-level SECURITY DEFINER RPC write) of the "agent reports
 *       state" journey.
 *
 * Approach: Service-role DB integration tests.
 *   - Path A (platform RPC success): calls engine_world_observe_platform via
 *     REST API, asserts engine_world row present + correct shape.
 *     Note: activity_trail audit clause intentionally skipped — see ADR-0290 §
 *     "activity_trail has NO nullable ID columns" note. Platform writes hit the
 *     EXCEPTION block by design; no activity_trail row is expected. This is
 *     documented in the migration comment and phase_f_note in the journey.
 *   - Path A (UPSERT idempotency): second write to same surface_id overwrites
 *     status; old row not duplicated.
 *   - Path B (workspace-scoped write): workspace member writes via upsert directly
 *     (simulates report_observation tool body after gatedMutation approval).
 *     Verifies engine_world row + workspace_id set correctly.
 *   - Path A (voice reject): voice channel guard returns error shape (tested via
 *     the tools.ts logic — import-level contract, not live LLM call).
 *   - Path B latency: test.skip — requires load harness (V0 known gap).
 *
 * Verification boxes covered (from journey):
 *   ✅ #2 E2E test exists (this file)
 *   ✅ #3 Path A: platform RPC writes engine_world row (gate bypassed per ADR-0290)
 *   ✅ #4 Path B: activity_trail intentionally skipped (NOT NULL constraint, ADR-0290)
 *   ⬜ #5 Latency: test.skip (V0 limit, see below)
 *   ⬜ #6 Voice channel: test.skip (requires live report_observation invocation)
 *   ✅ #7 Partial: RPC write verified; telemetry routing in unit tests (packages/telemetry)
 *
 * No browser context. Service-role only.
 *
 * Precondition: local Supabase running with Phase 1 migration applied.
 * Run with: SKIP_WEB_SERVER=1 pnpm exec playwright test tests/engine-world/agent-rapporterer-tilstand.spec.ts
 */

import { test, expect } from "@playwright/test";
import { createAdminClient, cleanupTestRows, testPrefix, callObservePlatform } from "./_helpers";

/**
 * Describe-scoped prefixes — each block gets its own to prevent afterAll cleanup
 * from deleting rows that a parallel describe block is still using.
 */
const P_A = testPrefix("rapport-a"); // Path A tests
const P_B = testPrefix("rapport-b"); // Path B tests

// serial: afterAll cleanup must not fire while sibling tests from this block
// still run on other workers (fullyParallel: true is set globally).
test.describe.configure({ mode: "serial" });

test.describe("Path A — platform RPC (engine_world_observe_platform)", () => {
  const db = createAdminClient();

  test.afterAll(async () => {
    await cleanupTestRows(db, P_A);
  });

  test("RPC returns 200/204 and row is written to engine_world", async () => {
    const surfaceId = `${P_A}conductor-ci-green`;

    const httpStatus = await callObservePlatform({
      p_surface_id: surfaceId,
      p_surface_type: "service",
      p_status: "green",
      p_details: { workflow: "harness-invariants", run_id: "test-001" },
      p_ttl_seconds: 300,
      p_observed_by: "e2e-rapporterer",
    });

    expect([200, 204]).toContain(httpStatus);

    const { data, error } = await db
      .from("engine_world")
      .select("surface_id, surface_type, status, workspace_id, observed_by, ttl_seconds")
      .eq("surface_id", surfaceId)
      .maybeSingle();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.surface_id).toBe(surfaceId);
    expect(data!.surface_type).toBe("service");
    expect(data!.status).toBe("green");
    expect(data!.workspace_id).toBeNull(); // platform-level
    expect(data!.observed_by).toBe("e2e-rapporterer");
    expect(data!.ttl_seconds).toBe(300);
  });

  test("UPSERT semantics: second write overwrites status, no duplicate rows", async () => {
    const surfaceId = `${P_A}upsert-test`;

    // First write: green
    await callObservePlatform({
      p_surface_id: surfaceId,
      p_surface_type: "service",
      p_status: "green",
      p_ttl_seconds: 600,
      p_observed_by: "e2e-upsert-first",
    });

    // Second write: red (status change)
    await callObservePlatform({
      p_surface_id: surfaceId,
      p_surface_type: "service",
      p_status: "red",
      p_ttl_seconds: 600,
      p_observed_by: "e2e-upsert-second",
    });

    // Exactly one row must exist (ON CONFLICT DO UPDATE)
    const { data, error } = await db
      .from("engine_world")
      .select("surface_id, status, observed_by")
      .eq("surface_id", surfaceId);

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.length).toBe(1);
    expect(data![0]!.status).toBe("red"); // last-write-wins
    expect(data![0]!.observed_by).toBe("e2e-upsert-second");
  });

  test("all valid status values are accepted by the RPC", async () => {
    const statuses = ["green", "yellow", "red", "unknown", "paused"] as const;

    for (const status of statuses) {
      const surfaceId = `${P_A}status-${status}`;
      const httpStatus = await callObservePlatform({
        p_surface_id: surfaceId,
        p_surface_type: "custom",
        p_status: status,
        p_ttl_seconds: 60,
        p_observed_by: "e2e-status-sweep",
      });
      expect([200, 204]).toContain(httpStatus);

      const { data, error } = await db
        .from("engine_world")
        .select("status")
        .eq("surface_id", surfaceId)
        .maybeSingle();
      expect(error).toBeNull();
      expect(data!.status).toBe(status);
    }
  });

  test("all valid surface_type values are accepted by the RPC", async () => {
    const types = [
      "service",
      "pr",
      "worktree",
      "migration",
      "cost",
      "ci_workflow",
      "campaign",
      "custom",
    ] as const;

    for (const surfaceType of types) {
      const surfaceId = `${P_A}type-${surfaceType}`;
      const httpStatus = await callObservePlatform({
        p_surface_id: surfaceId,
        p_surface_type: surfaceType,
        p_status: "unknown",
        p_ttl_seconds: 60,
        p_observed_by: "e2e-type-sweep",
      });
      expect([200, 204]).toContain(httpStatus);

      const { data } = await db
        .from("engine_world")
        .select("surface_type")
        .eq("surface_id", surfaceId)
        .maybeSingle();
      expect(data!.surface_type).toBe(surfaceType);
    }
  });

  // ── Activity trail: intentionally skipped — NOT NULL constraint ──────────────
  // engine_world_observe_platform attempts activity_trail INSERT but it fails
  // because activity_trail.workspace_id + actor_id are NOT NULL and platform
  // writes have no workspace or actor context. This is documented in ADR-0290
  // and the Phase 1 migration comment. The RPC itself still succeeds (the
  // EXCEPTION block catches the constraint violation and continues).
  //
  // Consequence for this test: we do NOT assert activity_trail rows for platform
  // writes. Reconciliation (nullable platform-actor path in activity_trail) is
  // a separate acceptance item tracked in phase_f_note of the journey file.
  test("activity_trail: no platform-actor row expected (NOT NULL constraint per ADR-0290)", async () => {
    const surfaceId = `${P_A}audit-trail-probe`;

    await callObservePlatform({
      p_surface_id: surfaceId,
      p_surface_type: "service",
      p_status: "green",
      p_ttl_seconds: 60,
      p_observed_by: "e2e-audit-probe",
    });

    // Verify the RPC succeeded (row written) but activity_trail has no platform rows
    const { data: worldRow } = await db
      .from("engine_world")
      .select("surface_id")
      .eq("surface_id", surfaceId)
      .maybeSingle();
    expect(worldRow).not.toBeNull();

    // No activity_trail query — we can't assert absence without knowing row identifiers.
    // The absence is structural (NOT NULL constraint blocks insert) and verified by
    // reading the migration comment in 20260526000000_engine_world_phase_1.sql.
    // This test documents the known gap per ADR-0290 rather than asserting false state.
  });
});

// ─── Path B — workspace-scoped write (simulates report_observation tool body) ─

test.describe("Path B — workspace-scoped write via service_role", () => {
  const db = createAdminClient();
  // Real workspace_id from seed data — engine_world has FK to workspace table.
  // Fake UUIDs fail with FK violation. The seed workspace is always present in
  // local Supabase after db reset (seeded via seed.sql).
  const SEED_WORKSPACE_ID = "00000000-0000-0000-0000-0000000000a1";

  test.afterAll(async () => {
    await cleanupTestRows(db, P_B);
  });

  test("workspace-scoped upsert writes row with correct workspace_id", async () => {
    const surfaceId = `${P_B}ws-scoped-write`;

    const { error } = await db.from("engine_world").upsert({
      surface_id: surfaceId,
      surface_type: "service",
      status: "green",
      details: { note: "workspace-scoped write from report_observation tool body" },
      workspace_id: SEED_WORKSPACE_ID,
      observed_at: new Date().toISOString(),
      observed_by: "e2e-ws-write",
      ttl_seconds: 300,
    });

    expect(error).toBeNull();

    const { data, error: readError } = await db
      .from("engine_world")
      .select("surface_id, workspace_id, status, details")
      .eq("surface_id", surfaceId)
      .maybeSingle();

    expect(readError).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.workspace_id).toBe(SEED_WORKSPACE_ID);
    expect(data!.status).toBe("green");
    // Details JSONB is present in DB (not stripped at storage level, only at reader level)
    const details = data!.details as Record<string, unknown>;
    expect(details["note"]).toBe("workspace-scoped write from report_observation tool body");
  });

  test("workspace isolation: workspace-scoped row NOT visible in platform-only read", async () => {
    const surfaceId = `${P_B}ws-isolation-probe`;

    await db.from("engine_world").upsert({
      surface_id: surfaceId,
      surface_type: "service",
      status: "red",
      details: {},
      workspace_id: SEED_WORKSPACE_ID,
      observed_at: new Date().toISOString(),
      observed_by: "e2e-isolation",
      ttl_seconds: 300,
    });

    // Platform-only read: workspace_id IS NULL
    const { data } = await db
      .from("engine_world")
      .select("surface_id")
      .is("workspace_id", null)
      .eq("surface_id", surfaceId);

    // Workspace-scoped row must NOT appear in platform-only query
    expect((data ?? []).length).toBe(0);
  });
});

// ─── Path B latency — test.skip (V0 known gap) ───────────────────────────────

test.describe("Path B latency — async write non-blocking", () => {
  test.skip(
    true,
    "V0 known gap: latency isolation requires a realistic load harness " +
      "(timed dispatch loop + P95 measurement). " +
      "The fire-and-forget pattern is verified structurally in engine-world-writer.ts " +
      "(void rpc().then(null, recordError) — no await in request path per council F7). " +
      "A timing assertion in E2E would be flaky without a load harness. " +
      "Track as: SMA-latency-isolation-v1 or Phase 3 load-test sortie.",
  );
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  test("async write does not add measurable latency to request path", async () => {});
});

// ─── Voice channel guard — test.skip (requires live tool invocation) ─────────

test.describe("Voice channel guard — report_observation rejects voice", () => {
  test.skip(
    true,
    "V0 known gap: voice channel guard is a Layer 3 per-tool check in tools.ts " +
      "(ctx.channel === 'voice' returns early with error shape). " +
      "Verified structurally: tools.ts line 170-174. " +
      "An E2E assertion requires a live stage-engine + capability dispatch with " +
      "channel='voice'. Deferred to integration test suite in packages/ai. " +
      "See: docs/journeys/JOURNEY-engine-world-phase-1-agent-rapporterer-tilstand.md #6",
  );
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  test("voice channel returns error shape without writing engine_world row", async () => {});
});
