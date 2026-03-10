import { test, expect } from "@playwright/test";
import { supabase } from "../helpers/seed";

// ─── Constants ─────────────────────────────────────────────
const TEST_ENTITY_ID = "00000000-0000-0000-0000-e2e000000001";
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

test.describe("journey:sign-up-create-workspace", () => {
  test.describe.configure({ mode: "serial" });

  test.afterAll(async () => {
    if (engineStateId) {
      await supabase.from("engine_state_step").delete().eq("state_id", engineStateId);
      await supabase.from("engine_state").delete().eq("id", engineStateId);
    }
    // Clean up any engine events from test
    await supabase.from("engine_event").delete().like("payload->>entity_id", TEST_ENTITY_ID);
  });

  // ─── Test 1: signup.completed triggers engine_state creation ──

  test("signup.completed creates engine_state for signup_onboarding", async () => {
    const result = await dispatch("signup.completed", {
      entity_type: "user_identity",
      entity_id: TEST_ENTITY_ID,
      email: "e2e-journey@test.local",
    });

    expect(result.triggers_matched).toBe(1);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].action).toBe("started");
    engineStateId = result.results[0].state_id;
    expect(engineStateId).toBeTruthy();

    // Verify engine_state
    const { data: state } = await supabase
      .from("engine_state")
      .select("*")
      .eq("id", engineStateId!)
      .single();

    expect(state).toBeTruthy();
    expect(state!.process_id).toBe("signup_onboarding");
    expect(state!.status).toBe("waiting");
    expect(state!.current_step).toBe(1);
    expect(state!.entity_type).toBe("user_identity");
    expect(state!.entity_id).toBe(TEST_ENTITY_ID);

    // Verify engine_state_step rows
    const { data: steps } = await supabase
      .from("engine_state_step")
      .select("step_order, status, action_type")
      .eq("state_id", engineStateId!)
      .order("step_order");

    expect(steps).toBeTruthy();
    expect(steps!.length).toBe(10); // 8 onboarding + workspace.created + send_notification
    expect(steps![0]!.status).toBe("active");
    expect(steps![0]!.action_type).toBe("wait_for_event");
    for (let i = 1; i < steps!.length; i++) {
      expect(steps![i]!.status).toBe("pending");
    }
  });

  // ─── Test 2: onboarding.step_completed advances engine_state ──

  test("onboarding.step_completed events advance through steps 1-8", async () => {
    expect(engineStateId).toBeTruthy();

    const stepIds = [
      "hero",
      "business",
      "departments",
      "locations",
      "procedures",
      "season",
      "contract",
      "welcome",
    ];

    for (let i = 0; i < stepIds.length; i++) {
      const result = await dispatch("onboarding.step_completed", {
        step_id: stepIds[i],
        entity_type: "user_identity",
        entity_id: TEST_ENTITY_ID,
      });

      expect(result.waiting_resumed).toBe(1);

      // Verify state advanced
      const { data: state } = await supabase
        .from("engine_state")
        .select("status, current_step")
        .eq("id", engineStateId!)
        .single();

      expect(state!.current_step).toBe(i + 2); // step 1 → 2, step 2 → 3, etc.
      expect(state!.status).toBe("waiting"); // still waiting for next event

      // Verify completed step
      const { data: stepRow } = await supabase
        .from("engine_state_step")
        .select("status")
        .eq("state_id", engineStateId!)
        .eq("step_order", i + 1)
        .single();

      expect(stepRow!.status).toBe("completed");
    }
  });

  // ─── Test 3: workspace.created with match_state resumes step 9 ──

  test("workspace.created with match_state completes the process", async () => {
    expect(engineStateId).toBeTruthy();

    // Verify we're at step 9 (workspace.created wait)
    const { data: preState } = await supabase
      .from("engine_state")
      .select("current_step, status")
      .eq("id", engineStateId!)
      .single();

    expect(preState!.current_step).toBe(9);
    expect(preState!.status).toBe("waiting");

    // Fire workspace.created — match_state condition requires user_identity_id = entity_id
    const result = await dispatch("workspace.created", {
      user_identity_id: TEST_ENTITY_ID,
      workspace_id: "00000000-0000-0000-0000-e2e000000099",
    });

    expect(result.waiting_resumed).toBe(1);

    // Verify process is complete (step 10 = send_notification, auto-advances)
    const { data: finalState } = await supabase
      .from("engine_state")
      .select("status, current_step")
      .eq("id", engineStateId!)
      .single();

    expect(finalState!.status).toBe("complete");

    // Verify ALL steps are completed
    const { data: allSteps } = await supabase
      .from("engine_state_step")
      .select("step_order, status")
      .eq("state_id", engineStateId!)
      .order("step_order");

    expect(allSteps).toBeTruthy();
    expect(allSteps!.length).toBe(10);
    for (const step of allSteps!) {
      expect(step.status).toBe("completed");
    }
  });
});
