/**
 * heartbeat-publiserer-surfaces.spec.ts
 *
 * Journey: heartbeat-publiserer-surfaces — Heartbeat job populerer engine_world
 * Spec: docs/journeys/JOURNEY-engine-world-phase-1-heartbeat-publiserer-surfaces.md
 *
 * Tests:
 *   C1 — Pre-condition: engine_world has ≥1 row per collector category
 *        after infra/scripts/engine-world-refresh.sh has run.
 *   C2 — Collector categories: at least one of {service, migration, worktree}
 *        is populated (pr category skipped when no open PRs — valid empty).
 *   C3 — Second run does not error (idempotent UPSERT semantics).
 *   C4 — Synthetic test rows written via RPC are readable and cleaned up.
 *
 * NOTE on refresh.sh test isolation:
 *   engine-world-refresh.sh writes real platform surfaces (vercel.web, supabase.prod,
 *   worktree.*). These rows persist. The test asserts on pre-existing rows (from
 *   prior runs / seed) and on synthetic test-2e-* rows to avoid dependency on
 *   external API availability (Vercel token, gh CLI, git fetch).
 *
 * The shell script test (C3) calls the script directly via execa-style spawn and
 * asserts exit 0. It does NOT assert specific row counts from that run — the
 * script may skip collectors (e.g. Vercel token absent) and that is valid.
 *
 * Cooldown enforcement test (C4-cooldown) is skipped: the 5-minute cooldown is
 * enforced by HEARTBEAT.md state (heartbeat skill), not by the shell script itself.
 * The script is stateless — cooldown is the caller's responsibility.
 * Deferred to Phase 3 when heartbeat skill integration is testable.
 *
 * Requires: Supabase local running. No web server needed.
 */

import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";
import * as path from "node:path";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

// Unique prefix for synthetic rows — cleanup predicate
const SURFACE_PREFIX = "test-2e-heartbeat-";

// Repository root — apps/e2e/engine-world/ is 3 levels below repo root
const REPO_ROOT = path.resolve(__dirname, "../../..");

function getClient() {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY not set — source apps/e2e/.env.local");
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function cleanupTestRows() {
  const supa = getClient();
  await supa.from("engine_world").delete().like("surface_id", `${SURFACE_PREFIX}%`);
}

// Serial mode: C5 (UPSERT idempotency) and C6 (shell script) write real rows
// to Supabase local. The afterEach cleanup covers all test-2e-heartbeat-* rows.
// With fullyParallel=true, tests WITHIN this describe block would race against
// their own afterEach hooks — serial mode prevents that.
test.describe.configure({ mode: "serial" });

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe("Journey: heartbeat-publiserer-surfaces — collector dry-run", () => {
  test.afterEach(async () => {
    await cleanupTestRows();
  });

  test("C1 — engine_world has rows across multiple surface_type categories", async () => {
    // This test asserts on data from prior heartbeat runs / seed.
    // engine-world-refresh.sh has been run at least once before this test suite
    // (it is part of the dev startup sequence). The local DB has vercel.web,
    // supabase.prod, and worktree.* rows from prior runs.
    //
    // We verify that at least two distinct surface_type values are present —
    // a reasonable proxy for "all four collectors contributed at some point".

    const supa = getClient();

    const { data, error } = await supa
      .from("engine_world")
      .select("surface_type")
      .not("surface_id", "like", `${SURFACE_PREFIX}%`); // exclude our own synthetic rows

    expect(error).toBeNull();
    expect(data).not.toBeNull();

    const distinctTypes = new Set((data ?? []).map((r) => r.surface_type));

    // Expect at least 2 collector categories represented
    // (service from vercel/stage_engine + worktree or migration)
    expect(distinctTypes.size).toBeGreaterThanOrEqual(2);
  });

  test("C2 — service category has ≥1 row (Collector a: vercel.web or stage_engine.*)", async () => {
    const supa = getClient();

    const { data, error } = await supa
      .from("engine_world")
      .select("surface_id, status")
      .eq("surface_type", "service")
      .limit(10);

    expect(error).toBeNull();
    expect(data?.length).toBeGreaterThanOrEqual(1);
  });

  test("C3 — migration category row exists (Collector b: supabase.prod)", async () => {
    const supa = getClient();

    const { data, error } = await supa
      .from("engine_world")
      .select("surface_id, status, details")
      .eq("surface_type", "migration")
      .limit(5);

    expect(error).toBeNull();
    expect(data?.length).toBeGreaterThanOrEqual(1);

    const prodRow = data?.find((r) => r.surface_id === "supabase.prod");
    if (prodRow) {
      // supabase.prod details should carry lag (migration lag count).
      // Note: actual key is 'lag', not 'lag_count' (script uses 'lag' in JSON payload).
      expect(prodRow.details).toHaveProperty("lag");
    }
  });

  test("C4 — worktree category rows exist (Collector d: worktree.*)", async () => {
    const supa = getClient();

    const { data, error } = await supa
      .from("engine_world")
      .select("surface_id, status")
      .eq("surface_type", "worktree")
      .limit(20);

    expect(error).toBeNull();
    expect(data?.length).toBeGreaterThanOrEqual(1);

    // Worktree surface_ids follow 'worktree.<name>' pattern
    for (const row of data ?? []) {
      expect(row.surface_id).toMatch(/^worktree\./);
    }
  });

  test("C5 — synthetic rows written via RPC are idempotent (second UPSERT does not error)", async () => {
    // Simulates the UPSERT semantics the script relies on.
    // Two writes to the same surface_id should result in exactly one row.
    const supa = getClient();
    const syntheticId = `${SURFACE_PREFIX}collector-idempotent`;

    const write1 = await supa.rpc("engine_world_observe_platform", {
      p_surface_id: syntheticId,
      p_surface_type: "service",
      p_status: "green",
      p_details: { run: 1 },
      p_ttl_seconds: 300,
      p_observed_by: "e2e-heartbeat-test",
    });
    expect(write1.error).toBeNull();

    const write2 = await supa.rpc("engine_world_observe_platform", {
      p_surface_id: syntheticId,
      p_surface_type: "service",
      p_status: "yellow", // status changed
      p_details: { run: 2 },
      p_ttl_seconds: 300,
      p_observed_by: "e2e-heartbeat-test",
    });
    expect(write2.error).toBeNull();

    // Exactly one row; latest write wins
    const { data, error } = await supa
      .from("engine_world")
      .select("surface_id, status")
      .eq("surface_id", syntheticId);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].status).toBe("yellow");
  });

  test("C6 — engine-world-refresh.sh runs without fatal error (exit 0)", () => {
    // Calls the script directly. External APIs (Vercel, GitHub) may be
    // unavailable in CI — the script exits 0 when at least one collector succeeds
    // (collector-fail is soft, not fatal, per script contract).
    //
    // We pass only the required Supabase env vars; Vercel + GH collectors will
    // fall back to "unknown" or skip gracefully.

    const scriptPath = path.join(REPO_ROOT, "infra/scripts/engine-world-refresh.sh");

    let exitCode = 0;
    let stdout = "";
    let stderr = "";

    try {
      stdout = execSync(`bash "${scriptPath}"`, {
        env: {
          ...process.env,
          SUPABASE_URL,
          SUPABASE_SERVICE_ROLE_KEY,
          // Omit VERCEL_TOKEN and GH_TOKEN intentionally — script should handle absence gracefully
        },
        cwd: REPO_ROOT,
        timeout: 30_000,
        encoding: "utf-8",
      });
    } catch (err: unknown) {
      // execSync throws on non-zero exit
      if (err instanceof Error && "status" in err) {
        exitCode = (err as { status: number }).status;
        stderr = (err as { stderr?: string }).stderr ?? "";
        stdout = (err as { stdout?: string }).stdout ?? "";
      } else {
        throw err;
      }
    }

    // Script exits 1 only when ALL four collectors fail. With Supabase available,
    // collector b (supabase.prod) succeeds, so exit should be 0.
    expect(exitCode).toBe(0);

    // Sanity: stdout should mention ENGINE WORLD REFRESH header
    expect(stdout).toContain("ENGINE WORLD REFRESH");
  });

  // ── Cooldown enforcement ── skipped: cooldown lives in heartbeat skill caller ──

  test.skip("C-cooldown — second run within cooldown window skips (no duplicate writes)", async () => {
    // The 5-minute cooldown is enforced by the heartbeat skill, not by
    // engine-world-refresh.sh itself. The script is stateless and always runs
    // when invoked — the skill checks heartbeat-state.json before calling it.
    // Testing the cooldown requires mocking the heartbeat skill's state reader
    // (ops/heartbeat-state.json) which is outside the scope of this E2E suite.
    // Deferred to Phase 3 heartbeat integration tests.
  });

  test.skip("C-failure-alert — collector error triggers heartbeat-notify.sh telegram alert", async () => {
    // Requires: injecting a broken VERCEL_TOKEN + mock heartbeat-notify.sh.
    // Out of scope for Phase 2E. Deferred to Phase 3.
  });
});
