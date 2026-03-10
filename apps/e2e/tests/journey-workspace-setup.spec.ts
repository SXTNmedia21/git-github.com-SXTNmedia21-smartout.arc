import { test, expect } from "@playwright/test";
import { supabase } from "../helpers/seed";

// ─── Constants ─────────────────────────────────────────────
const TEST_ENTITY_ID = "00000000-0000-0000-0000-e2e000000002";
const ENGINE_DISPATCH_URL = `${process.env.SUPABASE_URL ?? "http://127.0.0.1:54321"}/functions/v1/engine-dispatch`;
const AUTH_HEADER = `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`;

// Track state for cleanup
let engineStateId: string | null = null;

async function dispatch(
  event_type: string,
  payload: Record<string, unknown>,
  workspace_id: string | null = null,
) {
  const res = await fetch(ENGINE_DISPATCH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: AUTH_HEADER },
    body: JSON.stringify({ event_type, payload, workspace_id }),
  });
  return res.json();
}

// ─── Tests ─────────────────────────────────────────────────

test.describe("journey:configure-organization-setup-wizard", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    // Clean up any leftover workspace_setup states from other tests
    const { data: staleStates } = await supabase
      .from("engine_state")
      .select("id")
      .eq("process_id", "workspace_setup");

    if (staleStates) {
      for (const s of staleStates) {
        await supabase.from("engine_state_step").delete().eq("state_id", s.id);
        await supabase.from("engine_state").delete().eq("id", s.id);
      }
    }
  });

  test.afterAll(async () => {
    if (engineStateId) {
      await supabase.from("engine_state_step").delete().eq("state_id", engineStateId);
      await supabase.from("engine_state").delete().eq("id", engineStateId);
    }
  });

  // ─── Test 1: workspace.created triggers workspace_setup process ──

  test("workspace.created creates engine_state for workspace_setup", async () => {
    const result = await dispatch("workspace.created", {
      entity_type: "workspace",
      entity_id: TEST_ENTITY_ID,
    });

    expect(result.triggers_matched).toBe(1);

    // Find the workspace_setup state (not signup_onboarding)
    const wsResult = result.results.find(
      (r: { trigger_id: string; action: string; state_id?: string }) => r.state_id,
    );
    expect(wsResult).toBeTruthy();
    engineStateId = wsResult.state_id;

    // Verify it's workspace_setup
    const { data: state } = await supabase
      .from("engine_state")
      .select("process_id, status, current_step, entity_type, entity_id")
      .eq("id", engineStateId!)
      .single();

    expect(state).toBeTruthy();
    expect(state!.process_id).toBe("workspace_setup");
    expect(state!.status).toBe("waiting");
    expect(state!.current_step).toBe(1);

    // Verify 9 engine_state_step rows
    const { data: steps } = await supabase
      .from("engine_state_step")
      .select("step_order, status, action_type")
      .eq("state_id", engineStateId!)
      .order("step_order");

    expect(steps).toBeTruthy();
    expect(steps!.length).toBe(9);
    expect(steps![0]!.status).toBe("active");
    for (let i = 1; i < steps!.length; i++) {
      expect(steps![i]!.status).toBe("pending");
    }
  });

  // ─── Test 2: wizard.step_completed events advance all 9 steps ──

  test("wizard.step_completed events advance through all 9 steps", async () => {
    expect(engineStateId).toBeTruthy();

    const stepIds = [
      "welcome",
      "document-drop",
      "governance",
      "payroll",
      "employment",
      "team",
      "shift-template",
      "season",
      "handbook",
    ];

    for (let i = 0; i < stepIds.length; i++) {
      const result = await dispatch("wizard.step_completed", {
        step_id: stepIds[i],
      });

      expect(result.waiting_resumed).toBe(1);

      const { data: state } = await supabase
        .from("engine_state")
        .select("status, current_step")
        .eq("id", engineStateId!)
        .single();

      if (i < stepIds.length - 1) {
        // Not the last step — should be waiting at next step
        expect(state!.current_step).toBe(i + 2);
        expect(state!.status).toBe("waiting");
      } else {
        // Last step — process complete (no more steps after 9)
        expect(state!.status).toBe("complete");
      }
    }
  });

  // ─── Test 3: All steps marked completed ──

  test("all engine_state_step rows are completed", async () => {
    expect(engineStateId).toBeTruthy();

    const { data: steps } = await supabase
      .from("engine_state_step")
      .select("step_order, status")
      .eq("state_id", engineStateId!)
      .order("step_order");

    expect(steps).toBeTruthy();
    expect(steps!.length).toBe(9);
    for (const step of steps!) {
      expect(step.status).toBe("completed");
    }
  });
});
