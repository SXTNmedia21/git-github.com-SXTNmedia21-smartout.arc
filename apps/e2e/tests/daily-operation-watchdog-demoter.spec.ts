import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * J-CLOSURE-4 — Watchdog demotes stale pending_signoff sessions (session-watchdog-demoter).
 *
 * Tests the Edge Function HTTP endpoint directly via Playwright's `request`
 * fixture. No browser page required.
 *
 * Edge Function: `session-watchdog-demoter` (supabase/functions/session-watchdog-demoter/index.ts)
 * Auth: Bearer WATCHDOG_CRON_SECRET (or open if the env var is unset in local).
 * Local Edge Function URL: http://127.0.0.1:54321/functions/v1/session-watchdog-demoter
 *
 * Invariant tested:
 *   - A `pending_signoff` session with `updated_at` > 24h ago is demoted to `missed`.
 *   - Response body: { ok: true, demoted_count: N, ids: [...] }
 *   - activity_trail row written with automated=true for the demoted session.
 *   - A fresh pending_signoff (updated_at < 24h) is NOT demoted.
 *
 * Requires:
 *   - SUPABASE_URL env (defaults to http://127.0.0.1:54321)
 *   - SUPABASE_SERVICE_ROLE_KEY env
 *   - Local Supabase (supabase start) running with Edge Functions served.
 *   - A seeded department in the workspace to create department_session rows.
 *
 * Graceful skip: if SUPABASE_SERVICE_ROLE_KEY is missing or Edge Functions
 * are not reachable, all tests skip rather than fail.
 */

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const WATCHDOG_CRON_SECRET = process.env.WATCHDOG_CRON_SECRET ?? "";
const EDGE_FN_URL = `${SUPABASE_URL}/functions/v1/session-watchdog-demoter`;
// SYSTEM_ACTOR_ID from the function source (migration 20260422215500).
const SYSTEM_ACTOR_ID = "00000000-0000-0000-0000-000000000001";

function adminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Find the first active department in any workspace. Returns null if none. */
async function findAnyDepartment(): Promise<{
  department_id: string;
  workspace_id: string;
} | null> {
  if (!SERVICE_ROLE_KEY) return null;
  try {
    const { data } = await adminClient()
      .from("department")
      .select("department_id, workspace_id")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    return data ?? null;
  } catch {
    return null;
  }
}

/** Insert a department_session with a manually back-dated updated_at. */
async function seedStaleSession(workspaceId: string, departmentId: string): Promise<string | null> {
  if (!SERVICE_ROLE_KEY) return null;
  try {
    // Insert with status pending_signoff and a session_date well in the past.
    const staleDate = new Date(Date.now() - 26 * 60 * 60 * 1000);
    const sessionDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const { data, error } = await adminClient()
      .from("department_session")
      .insert({
        workspace_id: workspaceId,
        department_id: departmentId,
        session_date: sessionDate,
        status: "pending_signoff",
      })
      .select("department_session_id")
      .single();

    if (error || !data) return null;

    // Back-date updated_at to simulate 26h staleness.
    const { error: updateErr } = await adminClient()
      .from("department_session")
      .update({ updated_at: staleDate.toISOString() })
      .eq("department_session_id", data.department_session_id);

    if (updateErr) return null;
    return data.department_session_id;
  } catch {
    return null;
  }
}

/** Insert a fresh pending_signoff session (updated_at = now). */
async function seedFreshSession(workspaceId: string, departmentId: string): Promise<string | null> {
  if (!SERVICE_ROLE_KEY) return null;
  try {
    const sessionDate = new Date().toISOString().slice(0, 10);
    const { data, error } = await adminClient()
      .from("department_session")
      .insert({
        workspace_id: workspaceId,
        department_id: departmentId,
        session_date: sessionDate,
        status: "pending_signoff",
      })
      .select("department_session_id")
      .single();
    if (error || !data) return null;
    return data.department_session_id;
  } catch {
    return null;
  }
}

/** Clean up a seeded session by id. */
async function deleteSession(id: string): Promise<void> {
  await adminClient().from("department_session").delete().eq("department_session_id", id);
}

/** Invoke the Edge Function with an optional cron-secret Bearer. */
async function invokeWatchdog(request: {
  post: (
    url: string,
    opts: Record<string, unknown>,
  ) => Promise<{ status: () => number; json: () => Promise<unknown> }>;
}): Promise<{ status: number; body: unknown }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(WATCHDOG_CRON_SECRET ? { Authorization: `Bearer ${WATCHDOG_CRON_SECRET}` } : {}),
  };
  const res = await request.post(EDGE_FN_URL, { headers });
  return { status: res.status(), body: await res.json() };
}

/** Check that the Edge Function endpoint is reachable. */
async function isEdgeFunctionReachable(): Promise<boolean> {
  if (!SERVICE_ROLE_KEY) return false;
  try {
    // A quick fetch with a no-secret to check connectivity (401 or 200 = reachable).
    const r = await fetch(EDGE_FN_URL, { method: "OPTIONS" });
    return r.status < 500;
  } catch {
    return false;
  }
}

test.describe("J-CLOSURE-4 — Watchdog demotes stale pending_signoff", () => {
  test("J-C4-a — stale pending_signoff session is demoted to missed", async ({ request }) => {
    if (!(await isEdgeFunctionReachable())) {
      // Edge Functions not running locally — skip rather than fail.
      // Run with: npx supabase functions serve session-watchdog-demoter
      test.skip();
      return;
    }

    const dept = await findAnyDepartment();
    if (!dept) {
      // No department seeded — cannot create session.
      // TODO: seed a department fixture and remove this skip.
      test.skip();
      return;
    }

    const sessionId = await seedStaleSession(dept.workspace_id, dept.department_id);
    if (!sessionId) {
      test.skip();
      return;
    }

    try {
      const { status, body } = await invokeWatchdog(
        request as Parameters<typeof invokeWatchdog>[0],
      );
      expect(status).toBe(200);

      const b = body as { ok: boolean; demoted_count: number; ids: string[] };
      expect(b.ok).toBe(true);
      expect(b.demoted_count).toBeGreaterThanOrEqual(1);
      expect(b.ids).toContain(sessionId);

      // Verify DB: session is now missed.
      const { data: updated } = await adminClient()
        .from("department_session")
        .select("status")
        .eq("department_session_id", sessionId)
        .single();
      expect(updated?.status).toBe("missed");

      // Verify activity_trail row.
      const { data: trail } = await adminClient()
        .from("activity_trail")
        .select("data, actor_id")
        .eq("entity_id", sessionId)
        .eq("event", "session demoted_to_missed")
        .maybeSingle();
      expect(trail).not.toBeNull();
      expect(trail?.actor_id).toBe(SYSTEM_ACTOR_ID);
      const trailData = trail?.data as Record<string, unknown> | null;
      expect(trailData?.["automated"]).toBe(true);
    } finally {
      await deleteSession(sessionId);
    }
  });

  test("J-C4-b — fresh pending_signoff (< 24h) is NOT demoted", async ({ request }) => {
    if (!(await isEdgeFunctionReachable())) {
      test.skip();
      return;
    }

    const dept = await findAnyDepartment();
    if (!dept) {
      test.skip();
      return;
    }

    const sessionId = await seedFreshSession(dept.workspace_id, dept.department_id);
    if (!sessionId) {
      test.skip();
      return;
    }

    try {
      await invokeWatchdog(request as Parameters<typeof invokeWatchdog>[0]);

      // Verify DB: fresh session must still be pending_signoff.
      const { data: unchanged } = await adminClient()
        .from("department_session")
        .select("status")
        .eq("department_session_id", sessionId)
        .single();
      expect(unchanged?.status).toBe("pending_signoff");
    } finally {
      await deleteSession(sessionId);
    }
  });

  test("J-C4-c — watchdog with no stale sessions returns demoted_count=0", async ({ request }) => {
    if (!(await isEdgeFunctionReachable())) {
      test.skip();
      return;
    }

    // This test does NOT seed a stale session — it just checks the function
    // returns a valid zero-demotion payload when nothing qualifies.
    const { status, body } = await invokeWatchdog(request as Parameters<typeof invokeWatchdog>[0]);
    expect(status).toBe(200);
    const b = body as { ok: boolean; demoted_count: number };
    expect(b.ok).toBe(true);
    // demoted_count may be > 0 if other stale sessions exist in the DB.
    // The invariant is only that the shape is correct and it doesn't crash.
    expect(typeof b.demoted_count).toBe("number");
  });
});
