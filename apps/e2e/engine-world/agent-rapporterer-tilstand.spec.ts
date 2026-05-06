/**
 * agent-rapporterer-tilstand.spec.ts
 *
 * Journey: agent-rapporterer-tilstand — stage-engine rapporterer tilstand til engine_world
 * Spec: docs/journeys/JOURNEY-engine-world-phase-1-agent-rapporterer-tilstand.md
 *
 * Path B round-trip test: calls engine_world_observe_platform RPC directly via
 * service_role (simulating what ci-conductor + stage-engine async writer do),
 * asserts:
 *   - engine_world row written with correct surface_id, status
 *   - activity_trail row written with actor_kind = 'platform'
 *     (Phase 2A migration: activity_trail now accepts nullable workspace_id for
 *     actor_kind='platform' rows — ADR-0290 Phase 2A)
 *
 * Path A (user-facing gated write via report_observation tool) and
 * Path B latency assertion are skipped — they require a running stage-engine
 * instance with loaded capabilities and an authorized profile session.
 * Deferred to Phase 3 integration suite.
 *
 * Cleanup: all rows written under surface_id prefix 'test-2e-*' are deleted
 * in afterEach. activity_trail rows cleaned by surface_id in data JSONB.
 *
 * Requires: Supabase local running (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 * from apps/e2e/.env.local). No web server needed (no browser).
 */

import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

// Unique prefix for all synthetic rows — cleanup predicate
const SURFACE_PREFIX = "test-2e-path-b-";

// ─── Supabase client ──────────────────────────────────────────────────────────

function getClient() {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY not set — run tests with apps/e2e/.env.local sourced",
    );
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ─── Cleanup helpers ──────────────────────────────────────────────────────────

async function cleanupEngineWorldRows(surfaceId: string) {
  const supa = getClient();
  await supa.from("engine_world").delete().eq("surface_id", surfaceId);
}

async function cleanupActivityTrailRows(surfaceId: string) {
  // Platform audit rows carry the surface_id in data JSONB.
  // Use a raw .filter() on the data->>'surface_id' path.
  const supa = getClient();
  await supa
    .from("activity_trail")
    .delete()
    .eq("actor_kind", "platform")
    .contains("data", { surface_id: surfaceId });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe("Journey: agent-rapporterer-tilstand — Path B RPC round-trip", () => {
  // Each test uses its own surface_id to avoid cross-test UPSERT collisions
  // when tests run in parallel (B1 and B3 would otherwise overwrite each other).
  const surfaceB1 = `${SURFACE_PREFIX}b1-dispatch`;
  const surfaceB3 = `${SURFACE_PREFIX}b3-upsert`;

  test.afterEach(async () => {
    await cleanupEngineWorldRows(surfaceB1);
    await cleanupEngineWorldRows(surfaceB3);
    await cleanupActivityTrailRows(surfaceB1);
    await cleanupActivityTrailRows(surfaceB3);
  });

  test("B1 — engine_world_observe_platform writes engine_world row", async () => {
    const supa = getClient();

    const { error } = await supa.rpc("engine_world_observe_platform", {
      p_surface_id: surfaceB1,
      p_surface_type: "service",
      p_status: "green",
      p_details: { sample_size: 5, p95_ms: 120 },
      p_ttl_seconds: 600,
      p_observed_by: "e2e-test-phase-2e",
    });

    expect(error).toBeNull();

    // Assert row exists in engine_world
    const { data: rows, error: fetchErr } = await supa
      .from("engine_world")
      .select("surface_id, surface_type, status, observed_by, ttl_seconds, workspace_id")
      .eq("surface_id", surfaceB1)
      .limit(1);

    expect(fetchErr).toBeNull();
    expect(rows).toHaveLength(1);

    const row = rows![0];
    expect(row.surface_id).toBe(surfaceB1);
    expect(row.surface_type).toBe("service");
    expect(row.status).toBe("green");
    expect(row.observed_by).toBe("e2e-test-phase-2e");
    expect(row.ttl_seconds).toBe(600);
    // Platform-level rows have workspace_id = NULL
    expect(row.workspace_id).toBeNull();
  });

  test("B2 — engine_world_observe_platform writes activity_trail row with actor_kind=platform", async () => {
    // Phase 2A migration (20260527000000_activity_trail_platform_actor.sql):
    // activity_trail now accepts actor_kind='platform' rows where workspace_id,
    // actor_id, entity_id are NULL. The RPC writes a real audit row.
    const supa = getClient();

    // Use a unique surface_id for this specific assertion to avoid cross-test bleed
    const auditSurfaceId = `${SURFACE_PREFIX}audit-trail`;

    // Cleanup any prior run
    await cleanupEngineWorldRows(auditSurfaceId);
    await cleanupActivityTrailRows(auditSurfaceId);

    const beforeTs = new Date().toISOString();

    const { error } = await supa.rpc("engine_world_observe_platform", {
      p_surface_id: auditSurfaceId,
      p_surface_type: "service",
      p_status: "yellow",
      p_details: { note: "e2e audit test" },
      p_ttl_seconds: 300,
      p_observed_by: "e2e-audit-test",
    });

    expect(error).toBeNull();

    // Assert activity_trail row
    const { data: auditRows, error: auditErr } = await supa
      .from("activity_trail")
      .select(
        "actor_kind, workspace_id, actor_id, entity_id, event, action_verb, category, entity_type, data",
      )
      .eq("actor_kind", "platform")
      .contains("data", { surface_id: auditSurfaceId })
      .gte("created_at", beforeTs)
      .limit(5);

    expect(auditErr).toBeNull();
    expect(auditRows?.length).toBeGreaterThanOrEqual(1);

    const auditRow = auditRows![0];
    expect(auditRow.actor_kind).toBe("platform");
    // Platform rows have NULL identity fields (ADR-0290 Phase 2A)
    expect(auditRow.workspace_id).toBeNull();
    expect(auditRow.actor_id).toBeNull();
    expect(auditRow.entity_id).toBeNull();
    // Consistent event naming from the RPC
    expect(auditRow.event).toBe("engine_world.platform_write");
    expect(auditRow.action_verb).toBe("observed");
    expect(auditRow.category).toBe("platform_telemetry");
    expect(auditRow.entity_type).toBe("engine_world");
    // data carries the observation context
    expect(auditRow.data).toMatchObject({
      surface_id: auditSurfaceId,
      surface_type: "service",
      status: "yellow",
      observed_by: "e2e-audit-test",
    });

    // Cleanup extra row
    await cleanupEngineWorldRows(auditSurfaceId);
    await cleanupActivityTrailRows(auditSurfaceId);
  });

  test("B3 — UPSERT semantics: second call updates existing row, does not duplicate", async () => {
    const supa = getClient();

    // First write
    const { error: e1 } = await supa.rpc("engine_world_observe_platform", {
      p_surface_id: surfaceB3,
      p_surface_type: "service",
      p_status: "green",
      p_details: {},
      p_ttl_seconds: 600,
      p_observed_by: "e2e-first",
    });
    expect(e1).toBeNull();

    // Second write with different status
    const { error: e2 } = await supa.rpc("engine_world_observe_platform", {
      p_surface_id: surfaceB3,
      p_surface_type: "service",
      p_status: "red",
      p_details: { reason: "test update" },
      p_ttl_seconds: 600,
      p_observed_by: "e2e-second",
    });
    expect(e2).toBeNull();

    // Should have exactly ONE engine_world row (UPSERT on surface_id PK)
    const { data: rows, error: fetchErr } = await supa
      .from("engine_world")
      .select("surface_id, status, observed_by")
      .eq("surface_id", surfaceB3);

    expect(fetchErr).toBeNull();
    expect(rows).toHaveLength(1);
    // Latest write wins
    expect(rows![0].status).toBe("red");
    expect(rows![0].observed_by).toBe("e2e-second");
  });

  // ── Path A (gated user write) — skipped: requires running stage-engine + capability loader ──

  test.skip("A1 — Path A: gated write via report_observation tool succeeds for authorized profile", async () => {
    // Requires: stage-engine running, profile with capability level 'confirm',
    // active session with gate_action returning allow.
    // Deferred to Phase 3 — full integration suite with stage-engine fixture.
  });

  test.skip("A2 — Path A: gated write denied for profile below 'confirm' capability level", async () => {
    // Requires: stage-engine running, profile with capability level 'read_only'.
    // gate_action should return deny → activity_trail entry with denied_by_gate set.
    // Deferred to Phase 3.
  });

  test.skip("B-latency — Path B latency: async writer does not measurably affect request path", async () => {
    // Requires: load test harness + running stage-engine.
    // Pattern: dispatch N requests with writer enabled vs disabled; compare p95.
    // Deferred to Phase 3 — load test is out of scope for Phase 2E unit suite.
    // Reference: JOURNEY spec Path B verification item 4.
  });
});
