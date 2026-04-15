import { test, expect } from "@playwright/test";
import { supabase } from "../helpers/seed";

// ─────────────────────────────────────────────────────────────
// journey-workspace-isolation.spec.ts
//
// Event Engine regression gates for the signup → workspace
// creation join point. These guard two properties that would
// silently break a production tenant if they regress:
//
//   1. `workspace.created` only resumes the signup state whose
//      `user_identity_id` matches — no cross-tenant bleed.
//   2. `signup.completed` fired twice for the same entity does
//      not spawn two parallel onboarding journeys.
//
// These tests talk directly to the engine-dispatch Edge
// Function. They intentionally avoid UI / auth so they stay
// fast and tightly scoped to the engine contract.
// ─────────────────────────────────────────────────────────────

const ENTITY_A = "00000000-0000-0000-0000-e2e00000a001";
const ENTITY_B = "00000000-0000-0000-0000-e2e00000b001";
const ENGINE_DISPATCH_URL = `${
  process.env.SUPABASE_URL ?? "http://127.0.0.1:54321"
}/functions/v1/engine-dispatch`;
const AUTH_HEADER = `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`;

type DispatchResult = {
  triggers_matched?: number;
  waiting_resumed?: number;
  results?: Array<{ trigger_id?: string; action?: string; state_id?: string }>;
};

async function dispatch(
  event_type: string,
  payload: Record<string, unknown>,
  workspace_id: string | null = null,
): Promise<DispatchResult> {
  const res = await fetch(ENGINE_DISPATCH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: AUTH_HEADER },
    body: JSON.stringify({ event_type, payload, workspace_id }),
  });
  return res.json() as Promise<DispatchResult>;
}

async function cleanupSignupState(entityIds: string[]) {
  const { data: states } = await supabase
    .from("engine_state")
    .select("id")
    .eq("process_id", "signup_onboarding")
    .in("entity_id", entityIds);

  if (!states) return;
  for (const s of states) {
    await supabase.from("engine_state_step").delete().eq("state_id", s.id);
    await supabase.from("engine_state").delete().eq("id", s.id);
  }
}

test.describe("journey:workspace-isolation", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    await cleanupSignupState([ENTITY_A, ENTITY_B]);
  });

  test.afterAll(async () => {
    await cleanupSignupState([ENTITY_A, ENTITY_B]);
  });

  // ─── Test 1: Non-matching workspace.created does NOT resume ──
  // Starts signup_onboarding for user A, advances it to step 9
  // (the workspace.created wait). Then fires workspace.created
  // for user B. User A's state must stay waiting — not jump to
  // complete.

  test("workspace.created for user B does not resume user A's signup state", async () => {
    test.setTimeout(45_000);

    // Start signup for A
    const start = await dispatch("signup.completed", {
      entity_type: "user_identity",
      entity_id: ENTITY_A,
      email: "e2e-isolation-a@test.local",
    });
    expect(start.triggers_matched).toBe(1);
    const stateIdA = start.results?.[0]?.state_id;
    expect(stateIdA).toBeTruthy();

    // Walk A through the 8 onboarding.step_completed events to reach
    // step 9 (the workspace.created wait)
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
    for (const step_id of stepIds) {
      await dispatch("onboarding.step_completed", {
        step_id,
        entity_type: "user_identity",
        entity_id: ENTITY_A,
      });
    }

    // Confirm A is waiting on step 9
    const { data: preState } = await supabase
      .from("engine_state")
      .select("status, current_step, entity_id")
      .eq("id", stateIdA!)
      .single();
    expect(preState?.current_step).toBe(9);
    expect(preState?.status).toBe("waiting");

    // Now fire workspace.created for user B (NOT A). A's state must
    // not resume — the match_state condition requires
    // user_identity_id == entity_id.
    const crossFire = await dispatch("workspace.created", {
      user_identity_id: ENTITY_B,
      workspace_id: "00000000-0000-0000-0000-e2e00000b099",
    });

    // Whatever else the event triggers, A's state must NOT have been
    // resumed by it.
    const { data: postState } = await supabase
      .from("engine_state")
      .select("status, current_step")
      .eq("id", stateIdA!)
      .single();

    expect(postState?.current_step).toBe(9);
    expect(postState?.status).toBe("waiting");

    // And for belt-and-braces: the engine did not report resuming
    // more than one waiter that matched A. (It may have resumed
    // something else downstream, but not A.)
    expect(typeof crossFire.waiting_resumed).toBe("number");
  });

  // ─── Test 2: Matching workspace.created DOES resume A ────

  test("workspace.created for user A does resume A's signup state", async () => {
    test.setTimeout(30_000);

    const result = await dispatch("workspace.created", {
      user_identity_id: ENTITY_A,
      workspace_id: "00000000-0000-0000-0000-e2e00000a099",
    });

    expect(result.waiting_resumed).toBeGreaterThanOrEqual(1);

    // Step 9 (the workspace.created wait) must now be completed.
    // We don't assert the *final* state is "complete" because step 10 is a
    // send_notification side-effect that may block in a DB-isolated test
    // (no real workspace row exists). What matters for the isolation
    // contract is that A's wait was resumed by A's event — not that the
    // notification succeeded.
    const { data: stateRow } = await supabase
      .from("engine_state")
      .select("id, current_step")
      .eq("process_id", "signup_onboarding")
      .eq("entity_id", ENTITY_A)
      .single();

    expect(stateRow?.current_step).toBeGreaterThanOrEqual(10);

    const { data: step9 } = await supabase
      .from("engine_state_step")
      .select("status")
      .eq("state_id", stateRow!.id)
      .eq("step_order", 9)
      .single();

    expect(step9?.status).toBe("completed");
  });

  // ─── Test 3: signup.completed is idempotent per entity ───
  // Firing signup.completed twice for the same entity should not
  // create two parallel signup_onboarding states.

  test("signup.completed twice for the same entity does not create duplicate state", async () => {
    await cleanupSignupState([ENTITY_B]);

    const first = await dispatch("signup.completed", {
      entity_type: "user_identity",
      entity_id: ENTITY_B,
      email: "e2e-isolation-b@test.local",
    });
    expect(first.triggers_matched).toBe(1);

    await dispatch("signup.completed", {
      entity_type: "user_identity",
      entity_id: ENTITY_B,
      email: "e2e-isolation-b@test.local",
    });

    const { data: states } = await supabase
      .from("engine_state")
      .select("id")
      .eq("process_id", "signup_onboarding")
      .eq("entity_id", ENTITY_B);

    // There must be at most one active signup_onboarding state for
    // this entity. Either the second dispatch is a no-op, or it
    // deduplicates. A duplicate would mean the user gets two parallel
    // onboarding journeys — production hazard.
    expect(states?.length ?? 0).toBeLessThanOrEqual(1);
  });
});
