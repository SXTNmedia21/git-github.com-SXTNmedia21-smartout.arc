// =============================================================================
// sortie-1-mobile-task-complete.spec.ts
//
// Sortie 1 Phase 11 — Happy-path E2E for:
//   PATCH /api/mobile/tasks/[id]/complete
//
// Three tests (happy + forgeable-body 422 + no-bearer 401).
//
// Auth: Bearer JWT obtained via Supabase signInWithPassword for
//       admin@smartout.local (the same seed identity used by operations-
//       harness and botsson-harness tests).
//
// DB verify:
//   session_task.status = 'completed' + .completed_by = actor profile_id
//
// Telemetry verify:
//   activity_trail row with event='session_task completed' + actor_id +
//   entity_type='session_task'. Poll up to 20s (fire-and-forget emit).
//
// Seed chain:
//   workspace (SEED_WORKSPACE_ID) is pre-seeded by global-setup.
//   department_session → session_task (seeded inline, cleaned up afterAll).
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

// Seed department_id used in the global seed.
const SEED_DEPARTMENT_ID = "d0000000-0000-0000-0000-000000000000";

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

async function getAdminBearerToken(): Promise<string | null> {
  if (!SERVICE_ROLE_KEY) return null;
  try {
    const anon = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await anon.auth.signInWithPassword({
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
// Seed helpers — inline (no reusable seeder exists for this chain yet)
// ---------------------------------------------------------------------------

async function seedSessionForTask(): Promise<string> {
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
  if (error || !data) throw new Error(`seedSessionForTask failed: ${error?.message ?? "no data"}`);
  return data.department_session_id;
}

async function seedTask(departmentSessionId: string, title = "E2E sortie-1 task"): Promise<string> {
  const { data, error } = await supabase
    .from("session_task")
    .insert({
      workspace_id: SEED_WORKSPACE_ID,
      department_session_id: departmentSessionId,
      assigned_to: SEED_PROFILE_ID,
      title,
      task_type: "general",
      status: "pending",
      priority: "normal",
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`seedTask failed: ${error?.message ?? "no data"}`);
  return data.id;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe("Sortie 1: PATCH /api/mobile/tasks/[id]/complete", () => {
  let bearerToken: string | null = null;
  const sessionIds: string[] = [];
  const taskIds: string[] = [];

  test.beforeAll(async () => {
    bearerToken = await getAdminBearerToken();
  });

  test.afterAll(async () => {
    // Cleanup tasks first (FK child), then sessions.
    if (taskIds.length) {
      await supabase.from("session_task").delete().in("id", taskIds);
    }
    if (sessionIds.length) {
      await supabase.from("department_session").delete().in("department_session_id", sessionIds);
    }
  });

  // --------------------------------------------------------------------------
  // T1: Happy path — 200 + DB mutation + telemetry
  // --------------------------------------------------------------------------

  test("happy path: valid Bearer + owned task → 200 + status=completed + activity_trail", async ({
    request,
  }) => {
    if (!bearerToken) {
      test.skip(true, "Supabase local not reachable or admin fixture missing");
      return;
    }

    const sinceIso = new Date().toISOString();
    const sessionId = await seedSessionForTask();
    sessionIds.push(sessionId);
    const taskId = await seedTask(sessionId);
    taskIds.push(taskId);

    const response = await request.patch(`${BFF_BASE}/api/mobile/tasks/${taskId}/complete`, {
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        "Content-Type": "application/json",
      },
      data: {},
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
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

    // Verify telemetry — poll up to 20s for fire-and-forget emit.
    await assertActivityTrailEvent({
      event: "session_task completed",
      workspaceId: SEED_WORKSPACE_ID,
      actorId: SEED_PROFILE_ID,
      sinceIso,
      poll: { timeoutMs: 20_000 },
    });
  });

  // --------------------------------------------------------------------------
  // T2: Forgeable body → 422 (body must be strict empty)
  // --------------------------------------------------------------------------

  test("forgeable body field → 422, DB not mutated", async ({ request }) => {
    if (!bearerToken) {
      test.skip(true, "Supabase local not reachable or admin fixture missing");
      return;
    }

    const sessionId = await seedSessionForTask();
    sessionIds.push(sessionId);
    const taskId = await seedTask(sessionId, "E2E sortie-1 forgeable task");
    taskIds.push(taskId);

    const response = await request.patch(`${BFF_BASE}/api/mobile/tasks/${taskId}/complete`, {
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        "Content-Type": "application/json",
      },
      // workspace_id is a forbidden body field (ADR-0151 strict empty schema).
      data: { workspace_id: "00000000-0000-0000-0000-00000000DEAD" },
    });

    expect(response.status()).toBe(422);

    // Verify DB NOT mutated.
    const { data: row } = await supabase
      .from("session_task")
      .select("status")
      .eq("id", taskId)
      .single();
    expect(row?.status).not.toBe("completed");
  });

  // --------------------------------------------------------------------------
  // T3: Missing Bearer → 401
  // --------------------------------------------------------------------------

  test("missing Bearer → 401", async ({ request }) => {
    // Use a syntactically valid UUID that won't exist in DB.
    const fakeTaskId = "00000000-0000-0000-0000-000000000001";

    const response = await request.patch(`${BFF_BASE}/api/mobile/tasks/${fakeTaskId}/complete`, {
      data: {},
    });

    expect(response.status()).toBe(401);
  });
});
