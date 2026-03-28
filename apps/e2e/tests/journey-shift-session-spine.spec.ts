// ============================================
// journey-shift-session-spine.spec.ts
// Verifies the operational spine from shift publish
// into Engine dispatch and session runtime artifacts.
// Why: this is a production-critical chain that must
// be continuously proven end-to-end.
// ============================================

import { test, expect } from "@playwright/test";
import { supabase, seedWorkspace, seedDepartment } from "../helpers/seed";

const ENGINE_DISPATCH_URL = `${process.env.SUPABASE_URL ?? "http://127.0.0.1:54321"}/functions/v1/engine-dispatch`;
const AUTH_HEADER = `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`;

let workspaceId: string | null = null;
let departmentId: string | null = null;
let departmentSessionId: string | null = null;
let sessionLifecycleStateId: string | null = null;
let hookDispatcherStateId: string | null = null;

/**
 * Throws with context when a Supabase operation returns an error.
 *
 * Why: setup failures can otherwise look like runtime orchestration failures.
 *
 * @returns Nothing. Throws on error.
 */
function assertNoSupabaseError(error: { message: string } | null, context: string) {
  if (error) {
    throw new Error(`${context}: ${error.message}`);
  }
}

/**
 * Ensures the department_session_lifecycle process exists in local test DB.
 *
 * Why: some local environments can drift on seed data. This keeps the E2E
 * spine deterministic by self-healing the required process + trigger records.
 *
 * @returns Promise resolved when process seed records are present.
 */
async function ensureDepartmentSessionLifecycleSeed() {
  const processResult = await supabase.from("engine_process").upsert(
    {
      id: "department_session_lifecycle",
      name: "Department Session Lifecycle",
      description:
        "Auto-creates department sessions when shifts are published. Schedules session hooks for the day.",
    },
    { onConflict: "id" },
  );
  assertNoSupabaseError(processResult.error, "seed department_session_lifecycle process");

  const stepsResult = await supabase.from("engine_step").upsert(
    [
      {
        process_id: "department_session_lifecycle",
        step_order: 1,
        step_group: null,
        action_type: "upsert_session",
        action_payload: {
          description:
            "Create department_session rows for each published date x department combination",
        },
        assignee_rule: null,
      },
      {
        process_id: "department_session_lifecycle",
        step_order: 2,
        step_group: null,
        action_type: "schedule_control",
        action_payload: {
          description:
            "Schedule session hooks based on first/last shift times for each department session",
          hooks: ["pre_open", "open", "pre_close", "close"],
        },
        assignee_rule: null,
      },
      {
        process_id: "department_session_lifecycle",
        step_order: 3,
        step_group: null,
        action_type: "wait_for_event",
        action_payload: {
          event: "session.pending_signoff",
          timeout: "24h",
          on_timeout: "auto_close",
          description: "Wait for the session day to complete and move to signoff",
        },
        assignee_rule: null,
      },
      {
        process_id: "department_session_lifecycle",
        step_order: 4,
        step_group: null,
        action_type: "update_entity",
        action_payload: {
          entity: "department_session",
          set: { status: "closed" },
          description: "Mark session as closed after signoff",
        },
        assignee_rule: null,
      },
    ],
    { onConflict: "process_id,step_order" },
  );
  assertNoSupabaseError(stepsResult.error, "seed department_session_lifecycle steps");

  const { data: existingTrigger } = await supabase
    .from("engine_trigger")
    .select("id")
    .eq("event_type", "shift.published")
    .eq("process_id", "department_session_lifecycle")
    .maybeSingle();

  if (!existingTrigger) {
    const triggerInsertResult = await supabase.from("engine_trigger").insert({
      event_type: "shift.published",
      process_id: "department_session_lifecycle",
      condition: null,
      is_active: true,
    });
    assertNoSupabaseError(triggerInsertResult.error, "seed shift.published trigger");
  }

  const { data: existingPluralTrigger } = await supabase
    .from("engine_trigger")
    .select("id")
    .eq("event_type", "shifts.published")
    .eq("process_id", "department_session_lifecycle")
    .maybeSingle();

  if (!existingPluralTrigger) {
    const triggerInsertResult = await supabase.from("engine_trigger").insert({
      event_type: "shifts.published",
      process_id: "department_session_lifecycle",
      condition: null,
      is_active: true,
    });
    assertNoSupabaseError(triggerInsertResult.error, "seed shifts.published trigger");
  }
}

/**
 * Ensures the session_hook_dispatcher process exists in local test DB.
 *
 * Why: this test validates hook fired -> task creation. The process must be
 * present even when local seed/migration state is partial.
 *
 * @returns Promise resolved when dispatcher seed records are present.
 */
async function ensureSessionHookDispatcherSeed() {
  const processResult = await supabase.from("engine_process").upsert(
    {
      id: "session_hook_dispatcher",
      name: "Session Hook Dispatcher",
      description:
        "Handles session hook events. Creates session tasks and notifies assigned employees.",
    },
    { onConflict: "id" },
  );
  assertNoSupabaseError(processResult.error, "seed session_hook_dispatcher process");

  const stepsResult = await supabase.from("engine_step").upsert(
    [
      {
        process_id: "session_hook_dispatcher",
        step_order: 1,
        step_group: null,
        action_type: "create_session_task",
        action_payload: {
          title: "Hook task",
          description: "Session task created from hook trigger",
          compliance_required: true,
        },
        assignee_rule: "self",
      },
      {
        process_id: "session_hook_dispatcher",
        step_order: 2,
        step_group: null,
        action_type: "send_notification",
        action_payload: {
          template: "session_hook_task",
          channel: "push",
          description: "Notify assigned employee that a session hook task is ready",
        },
        assignee_rule: "self",
      },
      {
        process_id: "session_hook_dispatcher",
        step_order: 3,
        step_group: null,
        action_type: "wait_for_event",
        action_payload: {
          event: "session_task.completed",
          timeout: "4h",
          on_timeout: "escalate",
          description: "Wait for the employee to complete the session hook task",
        },
        assignee_rule: null,
      },
    ],
    { onConflict: "process_id,step_order" },
  );
  assertNoSupabaseError(stepsResult.error, "seed session_hook_dispatcher steps");

  const { data: existingTrigger } = await supabase
    .from("engine_trigger")
    .select("id")
    .eq("event_type", "session.hook_fired")
    .eq("process_id", "session_hook_dispatcher")
    .maybeSingle();

  if (!existingTrigger) {
    const triggerInsertResult = await supabase.from("engine_trigger").insert({
      event_type: "session.hook_fired",
      process_id: "session_hook_dispatcher",
      condition: null,
      is_active: true,
    });
    assertNoSupabaseError(triggerInsertResult.error, "seed session.hook_fired trigger");
  }
}

/**
 * Sends an event to the engine-dispatch edge function.
 *
 * Why: this mirrors the real telemetry -> engine_event path
 * without requiring UI interactions, so we can validate runtime
 * orchestration behavior deterministically.
 *
 * @returns Parsed JSON payload from engine-dispatch.
 */
async function dispatch(
  eventType: string,
  payload: Record<string, unknown>,
  targetWorkspaceId: string,
) {
  const res = await fetch(ENGINE_DISPATCH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: AUTH_HEADER },
    body: JSON.stringify({
      event_type: eventType,
      payload,
      workspace_id: targetWorkspaceId,
    }),
  });

  return res.json();
}

/**
 * Returns date string in YYYY-MM-DD format.
 *
 * Why: session rows are keyed by session_date and should
 * match the dates sent in shift publish event payloads.
 *
 * @returns Current ISO date (date-part only).
 */
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

test.describe("journey:shift-publish-session-spine", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    await ensureDepartmentSessionLifecycleSeed();
    await ensureSessionHookDispatcherSeed();

    const workspace = await seedWorkspace({
      name: "E2E Shift Spine Workspace",
      slug: `e2e-shift-spine-${Date.now()}`,
    });
    workspaceId = workspace.workspace_id;

    const department = await seedDepartment(workspace.workspace_id, {
      name: "E2E Operations Department",
      slug: `e2e-ops-${Date.now()}`,
    });
    departmentId = department.department_id;

    // Keep this explicit so upsert_session never filters out the test department.
    const departmentUpdateResult = await supabase
      .from("department")
      .update({ department_type: "operational" })
      .eq("department_id", department.department_id);
    assertNoSupabaseError(departmentUpdateResult.error, "set department_type on seeded department");
  });

  test.afterAll(async () => {
    if (departmentSessionId) {
      await supabase.from("session_task").delete().eq("department_session_id", departmentSessionId);
    }

    if (hookDispatcherStateId) {
      await supabase.from("engine_state_step").delete().eq("state_id", hookDispatcherStateId);
      await supabase.from("engine_state").delete().eq("id", hookDispatcherStateId);
    }

    if (sessionLifecycleStateId) {
      await supabase.from("engine_state_step").delete().eq("state_id", sessionLifecycleStateId);
      await supabase.from("engine_state").delete().eq("id", sessionLifecycleStateId);
    }

    if (departmentSessionId) {
      await supabase
        .from("department_session")
        .delete()
        .eq("department_session_id", departmentSessionId);
    }

    if (departmentId) {
      await supabase.from("department").delete().eq("department_id", departmentId);
    }

    if (workspaceId) {
      await supabase.from("workspace").delete().eq("workspace_id", workspaceId);
    }
  });

  test("shift.published creates and advances department_session_lifecycle state", async () => {
    expect(workspaceId).toBeTruthy();
    expect(departmentId).toBeTruthy();

    const targetDate = todayISO();
    const result = await dispatch(
      "shifts.published",
      {
        entity_type: "shift",
        entity_id: crypto.randomUUID(),
        dates: [targetDate],
        department_ids: [departmentId!],
        data: {
          dates: [targetDate],
          department_ids: [departmentId!],
          shift_ids: [],
          shift_count: 0,
        },
      },
      workspaceId!,
    );

    expect(result).toBeTruthy();
    expect(result.error).toBeUndefined();
    expect((result.triggers_matched as number) ?? 0).toBeGreaterThanOrEqual(1);

    const { data: session } = await supabase
      .from("department_session")
      .select("department_session_id, status, session_date, department_id")
      .eq("workspace_id", workspaceId!)
      .eq("department_id", departmentId!)
      .eq("session_date", targetDate)
      .single();

    expect(session).toBeTruthy();
    expect(session!.status).toBe("upcoming");
    departmentSessionId = session!.department_session_id;

    const startedStateIds = ((result.results as Array<{ action: string; state_id?: string }>) ?? [])
      .filter((entry) => entry.action === "started" && entry.state_id)
      .map((entry) => entry.state_id!) as string[];

    let lifecycleState: {
      id: string;
      process_id: string;
      status: string;
      current_step: number;
    } | null = null;
    for (const stateId of startedStateIds) {
      const { data: candidate } = await supabase
        .from("engine_state")
        .select("id, process_id, status, current_step")
        .eq("id", stateId)
        .maybeSingle();

      if (candidate?.process_id === "department_session_lifecycle") {
        lifecycleState = candidate;
        break;
      }
    }

    expect(lifecycleState).toBeTruthy();
    expect(lifecycleState!.status).toBe("waiting");
    expect(lifecycleState!.current_step).toBe(3);
    sessionLifecycleStateId = lifecycleState!.id;
  });

  test("session.hook_fired creates session_task via session_hook_dispatcher", async () => {
    expect(workspaceId).toBeTruthy();
    expect(departmentSessionId).toBeTruthy();

    const result = await dispatch(
      "session.hook_fired",
      {
        entity_type: "department_session",
        entity_id: departmentSessionId!,
        department_session_id: departmentSessionId!,
      },
      workspaceId!,
    );

    expect(result).toBeTruthy();
    expect((result.triggers_matched as number) ?? 0).toBeGreaterThanOrEqual(1);

    const { data: task } = await supabase
      .from("session_task")
      .select("id, status, title, department_session_id")
      .eq("workspace_id", workspaceId!)
      .eq("department_session_id", departmentSessionId!)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    expect(task).toBeTruthy();
    expect(task!.department_session_id).toBe(departmentSessionId);
    expect(task!.status).toBe("available");
    expect(task!.title).toBe("Hook task");

    const startedStateIds = ((result.results as Array<{ action: string; state_id?: string }>) ?? [])
      .filter((entry) => entry.action === "started" && entry.state_id)
      .map((entry) => entry.state_id!) as string[];

    let dispatcherState: {
      id: string;
      process_id: string;
      status: string;
      current_step: number;
    } | null = null;
    for (const stateId of startedStateIds) {
      const { data: candidate } = await supabase
        .from("engine_state")
        .select("id, process_id, status, current_step")
        .eq("id", stateId)
        .maybeSingle();

      if (candidate?.process_id === "session_hook_dispatcher") {
        dispatcherState = candidate;
        break;
      }
    }

    expect(dispatcherState).toBeTruthy();
    expect(dispatcherState!.status).toBe("waiting");
    expect(dispatcherState!.current_step).toBe(3);
    hookDispatcherStateId = dispatcherState!.id;
  });

  test("trigger contract keeps both shift.published and shifts.published wired", async () => {
    const { data: triggerRows, error } = await supabase
      .from("engine_trigger")
      .select("event_type, process_id, is_active")
      .in("event_type", ["shift.published", "shifts.published"])
      .eq("process_id", "department_session_lifecycle")
      .eq("is_active", true);

    expect(error).toBeNull();
    expect(triggerRows).toBeTruthy();

    const eventTypes = new Set((triggerRows ?? []).map((row) => row.event_type));
    expect(eventTypes.has("shift.published")).toBeTruthy();
    expect(eventTypes.has("shifts.published")).toBeTruthy();
  });
});
