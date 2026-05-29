// =============================================================================
// sortie-p0-fix-sweep-task-complete-source.spec.ts
//
// P0-A — E2E coverage for:
//   POST /api/mobile/tasks/[id]/complete
//   Body: { source: 'session'|'personal'|'day_ad_hoc' }
//
// These tests assert POST-FIX behavior introduced on feat/mobile-p0-fix-sweep.
// They will:
//   FAIL on campaign/mobile (pre-fix — POST route returns 405 Method Not Allowed)
//   PASS  on feat/mobile-p0-fix-sweep (POST route + source dispatcher wired)
//
// Run after feat/mobile-p0-fix-sweep merges to campaign/mobile.
//
// Auth:
//   Bearer JWT from Supabase signInWithPassword (admin@smartout.local).
//   Identity ALWAYS derived server-side from JWT — no workspace_id/profile_id in body.
//
// DB verify:
//   session_task.status = 'completed' (for source='session')
//   activity_trail row with event='task completed' + actor_id + workspace_id
//
// Seed chain:
//   workspace + department (SEED_WORKSPACE_ID + SEED_DEPARTMENT_ID) are pre-seeded.
//   department_session → session_task seeded inline, cleaned up afterAll.
//
// ADR refs: ADR-0132, ADR-0134, ADR-0151, ADR-0298.
// =============================================================================

import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import {
  SEED_PROFILE_ID,
  SEED_WORKSPACE_ID,
  assertActivityTrailEvent,
} from "../helpers/botsson-harness";
import { supabase } from "../helpers/seed";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const ADMIN_EMAIL = process.env.E2E_EMAIL ?? "admin@smartout.local";
const ADMIN_PASSWORD = process.env.E2E_PASSWORD ?? "password123";
const E2E_WEB_PORT = Number(process.env.E2E_WEB_PORT) || 3060;
const BFF_BASE = `http://127.0.0.1:${E2E_WEB_PORT}`;

// Pre-seeded by global-setup.
const SEED_DEPARTMENT_ID = "d0000000-0000-0000-0000-000000000000";

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

async function getAdminBearerToken(): Promise<string | null> {
  if (!SERVICE_ROLE_KEY) return null;
  try {
    const client = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await client.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });
    if (error || !data.session) return null;
    return data.session.access_token;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

async function seedSession(): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("department_session")
    .insert({
      workspace_id: SEED_WORKSPACE_ID,
      department_id: SEED_DEPARTMENT_ID,
      session_date: today,
      status: "active",
    })
    .select("department_session_id")
    .single();
  if (error || !data) throw new Error(`seedSession failed: ${error?.message ?? "no data"}`);
  return data.department_session_id;
}

async function seedSessionTask(
  departmentSessionId: string,
  title = "P0-A E2E session task",
): Promise<string> {
  const { data, error } = await supabase
    .from("session_task")
    .insert({
      workspace_id: SEED_WORKSPACE_ID,
      department_session_id: departmentSessionId,
      assigned_to: SEED_PROFILE_ID,
      title,
      status: "pending",
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`seedSessionTask failed: ${error?.message ?? "no data"}`);
  return data.id;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe("P0-A: POST /api/mobile/tasks/[id]/complete — source dispatcher", () => {
  let bearerToken: string | null = null;
  const sessionIds: string[] = [];
  const taskIds: string[] = [];

  test.beforeAll(async () => {
    bearerToken = await getAdminBearerToken();
  });

  test.afterAll(async () => {
    // Cleanup tasks (FK child) then sessions.
    if (taskIds.length) {
      await supabase.from("session_task").delete().in("id", taskIds);
    }
    if (sessionIds.length) {
      await supabase.from("department_session").delete().in("department_session_id", sessionIds);
    }
  });

  // --------------------------------------------------------------------------
  // T1: Happy path — source=session → 200 + status=completed + activity_trail
  // --------------------------------------------------------------------------
  //
  // POST is the NEW path added by P0-A. On campaign/mobile (pre-fix) this route
  // does not exist and Next.js returns 405. After merge it returns 200.

  test("T1: source=session → 200 + session_task.status=completed + activity_trail 'task completed'", async ({
    request,
  }) => {
    if (!bearerToken) {
      test.skip(true, "Supabase local not reachable or admin fixture missing");
      return;
    }

    const sinceIso = new Date().toISOString();
    const sessionId = await seedSession();
    sessionIds.push(sessionId);
    const taskId = await seedSessionTask(sessionId, "P0-A T1 session task");
    taskIds.push(taskId);

    const response = await request.post(`${BFF_BASE}/api/mobile/tasks/${taskId}/complete`, {
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        "Content-Type": "application/json",
      },
      data: { source: "session" },
    });

    // P0-A fix: POST route exists and handles source='session'.
    // Pre-fix: 405 (method not allowed). Post-fix: 200.
    expect(response.status(), "P0-A T1: expected 200 — POST route not found (pre-fix?)").toBe(200);
    const body = (await response.json()) as { ok?: boolean; taskId?: string };
    expect(body.ok).toBe(true);
    expect(body.taskId).toBe(taskId);

    // Verify DB mutation.
    const { data: row } = await supabase
      .from("session_task")
      .select("status, completed_by")
      .eq("id", taskId)
      .single();
    expect(row?.status).toBe("completed");
    expect(row?.completed_by).toBe(SEED_PROFILE_ID);

    // Verify canonical 'task completed' event (not 'session_task completed').
    // Pre-fix the event was never emitted because POST route didn't exist.
    await assertActivityTrailEvent({
      event: "task completed",
      workspaceId: SEED_WORKSPACE_ID,
      actorId: SEED_PROFILE_ID,
      sinceIso,
      poll: { timeoutMs: 20_000 },
    });
  });

  // --------------------------------------------------------------------------
  // T2: Happy path — source=personal → 200
  // --------------------------------------------------------------------------
  //
  // The personal task source routes through the same POST dispatcher.
  // We verify 200 + activity_trail. No DB row to check (personal_task uses
  // a separate table; the task.complete tool body handles it).

  test("T2: source=personal → 200 + activity_trail 'task completed'", async ({ request }) => {
    if (!bearerToken) {
      test.skip(true, "Supabase local not reachable or admin fixture missing");
      return;
    }

    const sinceIso = new Date().toISOString();

    // Seed a personal_task for the admin profile.
    const { data: personalTask, error: ptErr } = await supabase
      .from("personal_task")
      .insert({
        workspace_id: SEED_WORKSPACE_ID,
        profile_id: SEED_PROFILE_ID,
        title: "P0-A T2 personal task",
        status: "open",
        priority: "normal",
      })
      .select("id")
      .single();
    if (ptErr || !personalTask) {
      test.skip(true, `personal_task seed failed: ${ptErr?.message ?? "no data"}`);
      return;
    }
    const personalTaskId = personalTask.id;

    try {
      const response = await request.post(
        `${BFF_BASE}/api/mobile/tasks/${personalTaskId}/complete`,
        {
          headers: {
            Authorization: `Bearer ${bearerToken}`,
            "Content-Type": "application/json",
          },
          data: { source: "personal" },
        },
      );

      expect(response.status(), "P0-A T2: expected 200 — POST route not found (pre-fix?)").toBe(
        200,
      );
      const body = (await response.json()) as { ok?: boolean };
      expect(body.ok).toBe(true);

      await assertActivityTrailEvent({
        event: "task completed",
        workspaceId: SEED_WORKSPACE_ID,
        actorId: SEED_PROFILE_ID,
        sinceIso,
        poll: { timeoutMs: 20_000 },
      });
    } finally {
      await supabase.from("personal_task").delete().eq("id", personalTaskId);
    }
  });

  // --------------------------------------------------------------------------
  // T3: Happy path — source=day_ad_hoc → 200
  // --------------------------------------------------------------------------
  //
  // day_ad_hoc tasks come from schedule_day_task. We seed one and verify the
  // POST dispatcher routes it correctly.

  test("T3: source=day_ad_hoc → 200 + activity_trail 'task completed'", async ({ request }) => {
    if (!bearerToken) {
      test.skip(true, "Supabase local not reachable or admin fixture missing");
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const { data: dayTask, error: dtErr } = await supabase
      .from("schedule_day_task")
      .insert({
        workspace_id: SEED_WORKSPACE_ID,
        department_id: SEED_DEPARTMENT_ID,
        assigned_to: SEED_PROFILE_ID,
        title: "P0-A T3 day_ad_hoc task",
        task_date: today,
        status: "pending",
        priority: "normal",
      })
      .select("id")
      .single();
    if (dtErr || !dayTask) {
      test.skip(
        true,
        `schedule_day_task seed failed: ${dtErr?.message ?? "no data"} — table may not exist in this migration state`,
      );
      return;
    }
    const dayTaskId = dayTask.id;

    const sinceIso = new Date().toISOString();

    try {
      const response = await request.post(`${BFF_BASE}/api/mobile/tasks/${dayTaskId}/complete`, {
        headers: {
          Authorization: `Bearer ${bearerToken}`,
          "Content-Type": "application/json",
        },
        data: { source: "day_ad_hoc" },
      });

      expect(response.status(), "P0-A T3: expected 200 — POST route not found (pre-fix?)").toBe(
        200,
      );
      const body = (await response.json()) as { ok?: boolean };
      expect(body.ok).toBe(true);

      await assertActivityTrailEvent({
        event: "task completed",
        workspaceId: SEED_WORKSPACE_ID,
        actorId: SEED_PROFILE_ID,
        sinceIso,
        poll: { timeoutMs: 20_000 },
      });
    } finally {
      await supabase.from("schedule_day_task").delete().eq("id", dayTaskId);
    }
  });

  // --------------------------------------------------------------------------
  // T4: Missing source field → 422
  // --------------------------------------------------------------------------

  test("T4: missing source field → 422", async ({ request }) => {
    if (!bearerToken) {
      test.skip(true, "Supabase local not reachable or admin fixture missing");
      return;
    }

    // Use a UUID that is syntactically valid but won't exist in DB — we expect
    // 422 from body validation before the DB is even touched.
    const fakeId = "00000000-0000-0000-0000-000000000002";

    const response = await request.post(`${BFF_BASE}/api/mobile/tasks/${fakeId}/complete`, {
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        "Content-Type": "application/json",
      },
      // Empty body — source field is required.
      data: {},
    });

    // Pre-fix: 405 (POST not allowed). Post-fix: 422 (schema validation).
    // We assert 422 to confirm the POST route exists and validates the body.
    expect(
      response.status(),
      "P0-A T4: expected 422 (missing source) — 405 means POST route still absent (pre-fix?)",
    ).toBe(422);
  });

  // --------------------------------------------------------------------------
  // T5: Invalid source value → 422
  // --------------------------------------------------------------------------

  test("T5: invalid source value → 422", async ({ request }) => {
    if (!bearerToken) {
      test.skip(true, "Supabase local not reachable or admin fixture missing");
      return;
    }

    const fakeId = "00000000-0000-0000-0000-000000000003";

    const response = await request.post(`${BFF_BASE}/api/mobile/tasks/${fakeId}/complete`, {
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        "Content-Type": "application/json",
      },
      data: { source: "not_a_valid_source" },
    });

    expect(response.status(), "P0-A T5: expected 422 for invalid source").toBe(422);
  });

  // --------------------------------------------------------------------------
  // T6: Extra unknown body fields rejected (Zod .strict()) → 422
  // --------------------------------------------------------------------------
  //
  // PostRequestSchema is z.strict() — any unknown key must cause a 422.
  // Pre-fix: 405. Post-fix: 422. This verifies the forgeable-body guard.

  test("T6: extra unknown body fields → 422 (.strict() guard)", async ({ request }) => {
    if (!bearerToken) {
      test.skip(true, "Supabase local not reachable or admin fixture missing");
      return;
    }

    const fakeId = "00000000-0000-0000-0000-000000000004";

    const response = await request.post(`${BFF_BASE}/api/mobile/tasks/${fakeId}/complete`, {
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        "Content-Type": "application/json",
      },
      // source is valid but workspace_id is forbidden (ADR-0151 / z.strict()).
      data: { source: "session", workspace_id: SEED_WORKSPACE_ID },
    });

    expect(response.status(), "P0-A T6: expected 422 for extra field (z.strict() violation)").toBe(
      422,
    );
  });
});
