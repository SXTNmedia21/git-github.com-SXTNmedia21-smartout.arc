// =============================================================================
// sortie-p0-fix-sweep-task-created-canonical.spec.ts
//
// P0-B — E2E coverage for:
//   Canonical "task created" event emitted when a session_task is created via
//   POST /api/mobile/tasks (BFF → addTaskAction → createSession.execute).
//
// These tests assert POST-FIX behavior introduced on feat/mobile-p0-fix-sweep.
// They will:
//   FAIL on campaign/mobile (pre-fix — emit fires "session_task.created" NOT
//        "task created", causing assertActivityTrailEvent to time out)
//   PASS  on feat/mobile-p0-fix-sweep (useCreateTask + addTaskAction pipeline
//        both emit canonical "task created")
//
// Run after feat/mobile-p0-fix-sweep merges to campaign/mobile.
//
// Pipe under test:
//   POST /api/mobile/tasks
//     → addTaskAction(input, actor, 'system')
//       → task.create_session.execute()
//         → INSERT session_task
//         → emit({ event: "task created", ... })
//
// Note: this spec tests the BFF pipe, not the React hook (useCreateTask).
// The hook delegates to enqueue() → SyncWorker → BFF; the BFF pipe is what
// actually writes to DB and emits telemetry. Testing the BFF directly is the
// correct level for an API E2E spec.
//
// Auth: Bearer JWT (Supabase signInWithPassword admin@smartout.local).
// DB verify: activity_trail + engine_event rows for event='task created'.
// Seed chain: department_session seeded inline, cleaned up afterAll.
//
// ADR refs: ADR-0132, ADR-0134, ADR-0151, ADR-0266, ADR-0298.
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

async function seedActiveSession(): Promise<string> {
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
  if (error || !data) throw new Error(`seedActiveSession failed: ${error?.message ?? "no data"}`);
  return data.department_session_id;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe("P0-B: POST /api/mobile/tasks → canonical 'task created' event", () => {
  let bearerToken: string | null = null;
  let sessionId: string | null = null;
  let createdTaskId: string | null = null;
  let sinceIso: string;

  test.beforeAll(async () => {
    bearerToken = await getAdminBearerToken();
    if (bearerToken) {
      sessionId = await seedActiveSession();
    }
  });

  test.afterAll(async () => {
    // Cleanup task (FK child) then session.
    if (createdTaskId) {
      await supabase.from("session_task").delete().eq("id", createdTaskId);
    }
    if (sessionId) {
      await supabase.from("department_session").delete().eq("department_session_id", sessionId);
    }
  });

  // --------------------------------------------------------------------------
  // T1: POST /api/mobile/tasks → 200 + task created in DB
  // --------------------------------------------------------------------------
  //
  // The BFF delegates to addTaskAction → createSession.execute which emits
  // "task created". Pre-fix: the hook emitted "session_task.created" (wrong).
  // This test verifies the BFF pipe produces a 200 and returns a taskId.

  test("T1: create session_task via BFF → 200 + taskId in response", async ({ request }) => {
    if (!bearerToken || !sessionId) {
      test.skip(true, "Supabase local not reachable or admin fixture missing");
      return;
    }

    sinceIso = new Date().toISOString();

    const response = await request.post(`${BFF_BASE}/api/mobile/tasks`, {
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        "Content-Type": "application/json",
      },
      data: {
        sessionId,
        title: "P0-B E2E task",
        reason: "E2E test verifying canonical task created event (P0-B)",
        isComplianceRequired: false,
        ownerProfileId: null,
        hookId: null,
      },
    });

    expect(response.status(), "P0-B T1: expected 200 from POST /api/mobile/tasks").toBe(200);
    const body = (await response.json()) as { ok?: boolean; taskId?: string };
    expect(body.ok).toBe(true);
    expect(body.taskId).toBeTruthy();

    // Capture taskId for subsequent tests + cleanup.
    createdTaskId = body.taskId ?? null;

    // Verify the row exists in DB.
    if (createdTaskId) {
      const { data: row } = await supabase
        .from("session_task")
        .select("id, status, workspace_id")
        .eq("id", createdTaskId)
        .single();
      expect(row?.id).toBe(createdTaskId);
      expect(row?.workspace_id).toBe(SEED_WORKSPACE_ID);
      expect(row?.status).toBe("pending");
    }
  });

  // --------------------------------------------------------------------------
  // T2: activity_trail emits event name = 'task created' (canonical)
  // --------------------------------------------------------------------------
  //
  // Pre-fix: useCreateTask emitted 'session_task.created'.
  // Post-fix: emit fires 'task created' (ADR-0298 Sortie 3 canonical event).
  //
  // We poll activity_trail for the post-fix canonical name. This test will time
  // out on campaign/mobile (pre-fix) because the canonical row is never written.

  test("T2: activity_trail contains canonical 'task created' event — NOT 'session_task.created'", async () => {
    if (!bearerToken || !sessionId) {
      test.skip(true, "Supabase local not reachable or admin fixture missing");
      return;
    }
    if (!createdTaskId) {
      test.skip(true, "T2 depends on T1 (task must be created first)");
      return;
    }

    // Assert the canonical post-fix event name.
    // On pre-fix branch this will time out — expected.
    const row = await assertActivityTrailEvent({
      event: "task created",
      workspaceId: SEED_WORKSPACE_ID,
      actorId: SEED_PROFILE_ID,
      sinceIso,
      poll: { timeoutMs: 20_000 },
    });

    expect(row.workspace_id, "T2: workspace_id must match seed workspace").toBe(SEED_WORKSPACE_ID);
    expect(row.actor_id, "T2: actor_id must match seed profile").toBe(SEED_PROFILE_ID);

    // Verify the WRONG pre-fix event name is NOT present.
    // (This is a secondary check — if it fails it means both event names
    // coexist, which indicates a double-emit regression.)
    const { data: wrongRows } = await supabase
      .from("activity_trail")
      .select("id, event")
      .eq("workspace_id", SEED_WORKSPACE_ID)
      .eq("event", "session_task.created")
      .gte("created_at", sinceIso)
      .limit(1);

    expect(
      wrongRows?.length ?? 0,
      "T2: found 'session_task.created' event — this is the pre-fix bug name. " +
        "After P0-B fix only 'task created' should be emitted.",
    ).toBe(0);
  });

  // --------------------------------------------------------------------------
  // T3: engine_event row written with event='task created'
  // --------------------------------------------------------------------------
  //
  // emit() routes to engine_event (workflow automation destination).
  // Pre-fix: engine_event.event='session_task.created'. Post-fix: 'task created'.

  test("T3: engine_event row exists with event='task created'", async () => {
    if (!bearerToken || !sessionId) {
      test.skip(true, "Supabase local not reachable or admin fixture missing");
      return;
    }
    if (!createdTaskId) {
      test.skip(true, "T3 depends on T1");
      return;
    }

    // Poll engine_event for the canonical post-fix name.
    const start = Date.now();
    const timeoutMs = 20_000;
    let found = false;

    while (Date.now() - start < timeoutMs) {
      const { data } = await supabase
        .from("engine_event")
        .select("id, event, workspace_id, created_at")
        .eq("workspace_id", SEED_WORKSPACE_ID)
        .eq("event", "task created")
        .gte("created_at", sinceIso)
        .limit(1);

      if (data && data.length > 0) {
        found = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 500));
    }

    expect(
      found,
      "T3: engine_event row with event='task created' not found within 20s. " +
        "Pre-fix branch emits 'session_task.created' instead.",
    ).toBe(true);
  });

  // --------------------------------------------------------------------------
  // T4: entity_type='session_task' + entity_id matches created task id
  // --------------------------------------------------------------------------
  //
  // The activity_trail row must have entity_type='session_task' and
  // entity_id = the task id returned by the BFF. This validates the metadata
  // shape contract from ADR-0298 Sortie 3.

  test("T4: activity_trail entity_type='session_task' + entity_id=taskId", async () => {
    if (!bearerToken || !sessionId) {
      test.skip(true, "Supabase local not reachable or admin fixture missing");
      return;
    }
    if (!createdTaskId) {
      test.skip(true, "T4 depends on T1");
      return;
    }

    const start = Date.now();
    const timeoutMs = 20_000;
    let matchedRow: { entity_type: string | null; entity_id: string | null } | undefined;

    while (Date.now() - start < timeoutMs) {
      const { data } = await supabase
        .from("activity_trail")
        .select("entity_type, entity_id, event")
        .eq("workspace_id", SEED_WORKSPACE_ID)
        .eq("event", "task created")
        .eq("actor_id", SEED_PROFILE_ID)
        .gte("created_at", sinceIso)
        .limit(5);

      const hit = data?.find(
        (r) => r.entity_type === "session_task" && r.entity_id === createdTaskId,
      );
      if (hit) {
        matchedRow = hit;
        break;
      }
      await new Promise((r) => setTimeout(r, 500));
    }

    expect(
      matchedRow,
      `T4: activity_trail row with entity_type='session_task' + entity_id='${createdTaskId}' not found. ` +
        "Verify P0-B fix wired entity correctly in emit() call.",
    ).toBeTruthy();

    expect(matchedRow?.entity_type).toBe("session_task");
    expect(matchedRow?.entity_id).toBe(createdTaskId);
  });
});
