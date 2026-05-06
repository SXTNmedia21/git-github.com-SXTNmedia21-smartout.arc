/**
 * _helpers.ts — Shared utilities for engine-world E2E specs.
 *
 * What: Admin Supabase client + RPC call helper used by the three
 *       engine-world journey specs (agent-leser-status, agent-rapporterer-tilstand,
 *       heartbeat-publiserer-surfaces).
 *
 * Why: Avoid repeating createClient boilerplate. Single place to maintain
 *      the SUPABASE_API_URL + service_role key resolution pattern used by
 *      engine-world-refresh.sh (consistent with heartbeat/_helpers.ts pattern).
 *
 * Pattern: No browser context — all specs are API-only or unit-style.
 *          DB assertions via service-role client. RPC calls via REST API (curl/fetch).
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ─── Constants ────────────────────────────────────────────────────────────────

export const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
export const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/**
 * Unique prefix for test-authored rows.
 *
 * Each spec file uses a distinct sub-prefix to prevent cross-file cleanup
 * collisions when tests run in parallel workers.
 *
 * Usage pattern in spec files:
 *   const P = testPrefix("leser");   // → "test-2e-leser-"
 *   const P = testPrefix("rapport"); // → "test-2e-rapport-"
 *   const P = testPrefix("hb");      // → "test-2e-hb-"
 */
export const TEST_PREFIX = "test-2e-";

/** Returns a file-scoped prefix to avoid cross-spec cleanup collisions. */
export function testPrefix(scope: string): string {
  return `${TEST_PREFIX}${scope}-`;
}

// ─── Admin client ─────────────────────────────────────────────────────────────

/**
 * Creates a service-role Supabase client for test DB assertions and RPC calls.
 * Reads env from .env.local (loaded by playwright.config.ts via dotenv).
 */
export function createAdminClient(): SupabaseClient {
  if (!SERVICE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. " +
        "Ensure apps/e2e/.env.local is populated: " +
        "op run --env-file=.env.template -- pnpm exec playwright test",
    );
  }
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ─── RPC helper ───────────────────────────────────────────────────────────────

export type ObservePlatformParams = {
  p_surface_id: string;
  p_surface_type:
    | "service"
    | "pr"
    | "worktree"
    | "migration"
    | "cost"
    | "ci_workflow"
    | "campaign"
    | "custom";
  p_status: "green" | "yellow" | "red" | "unknown" | "paused";
  p_details?: Record<string, unknown>;
  p_ttl_seconds?: number;
  p_observed_by?: string;
};

/**
 * Calls engine_world_observe_platform via Supabase REST API.
 * Returns the HTTP status code. 200/204 = success.
 *
 * Used by tests that verify the RPC is callable and wired correctly.
 * Mirrors the call pattern in engine-world-refresh.sh.
 */
export async function callObservePlatform(params: ObservePlatformParams): Promise<number> {
  const body = {
    p_surface_id: params.p_surface_id,
    p_surface_type: params.p_surface_type,
    p_status: params.p_status,
    p_details: params.p_details ?? {},
    p_ttl_seconds: params.p_ttl_seconds ?? 600,
    p_observed_by: params.p_observed_by ?? "e2e-test",
  };

  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/engine_world_observe_platform`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(body),
  });

  return res.status;
}

// ─── Cleanup helper ───────────────────────────────────────────────────────────

/**
 * Deletes all engine_world rows whose surface_id starts with the given prefix.
 * Each spec file passes its own scoped prefix so parallel workers don't
 * accidentally delete each other's rows.
 *
 * @param prefix - file-scoped prefix, e.g. testPrefix("leser")
 */
export async function cleanupTestRows(db: SupabaseClient, prefix: string): Promise<void> {
  await db.from("engine_world").delete().like("surface_id", `${prefix}%`);
}
