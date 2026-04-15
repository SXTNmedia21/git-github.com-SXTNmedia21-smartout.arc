import { test, expect } from "@playwright/test";
import { supabase } from "../helpers/seed";

// ─────────────────────────────────────────────────────────────
// journey-onboarding-step-contract.spec.ts
//
// Regression gates on the engine's contract around the 8
// onboarding.step_completed events. These guard two properties:
//
//   1. Unknown step_id is a no-op — it must not skip or
//      resume the state in an unexpected way.
//   2. Firing out-of-order step_id (e.g. "welcome" at step 1)
//      does not jump the state past steps it has not cleared.
//
// Everything runs directly against engine-dispatch. The
// happy-path coverage lives in
// `journey-signup-onboarding.spec.ts`; this file targets the
// adversarial edges.
// ─────────────────────────────────────────────────────────────

const ENTITY_UNKNOWN = "00000000-0000-0000-0000-e2e00000c001";
const ENTITY_OUT_OF_ORDER = "00000000-0000-0000-0000-e2e00000c002";
const ENGINE_DISPATCH_URL = `${
  process.env.SUPABASE_URL ?? "http://127.0.0.1:54321"
}/functions/v1/engine-dispatch`;
const AUTH_HEADER = `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`;

type DispatchResult = {
  triggers_matched?: number;
  waiting_resumed?: number;
  results?: Array<{ state_id?: string }>;
};

async function dispatch(
  event_type: string,
  payload: Record<string, unknown>,
): Promise<DispatchResult> {
  const res = await fetch(ENGINE_DISPATCH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: AUTH_HEADER },
    body: JSON.stringify({ event_type, payload, workspace_id: null }),
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

test.describe("journey:onboarding-step-contract", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    await cleanupSignupState([ENTITY_UNKNOWN, ENTITY_OUT_OF_ORDER]);
  });

  test.afterAll(async () => {
    await cleanupSignupState([ENTITY_UNKNOWN, ENTITY_OUT_OF_ORDER]);
  });

  // ─── Test 1: Unknown step_id is a no-op ──────────────────

  test("unknown step_id does not advance or complete the state", async () => {
    test.setTimeout(30_000);

    // Start a fresh signup_onboarding
    const start = await dispatch("signup.completed", {
      entity_type: "user_identity",
      entity_id: ENTITY_UNKNOWN,
      email: "e2e-unknown@test.local",
    });
    const stateId = start.results?.[0]?.state_id;
    expect(stateId).toBeTruthy();

    // Confirm we're at current_step=1, waiting for the "hero" event.
    const { data: before } = await supabase
      .from("engine_state")
      .select("current_step, status")
      .eq("id", stateId!)
      .single();
    expect(before?.current_step).toBe(1);
    expect(before?.status).toBe("waiting");

    // Fire an event with an entirely unknown step_id.
    await dispatch("onboarding.step_completed", {
      step_id: "this-step-does-not-exist",
      entity_type: "user_identity",
      entity_id: ENTITY_UNKNOWN,
    });

    // State must not have advanced.
    const { data: after } = await supabase
      .from("engine_state")
      .select("current_step, status")
      .eq("id", stateId!)
      .single();

    expect(after?.current_step).toBe(1);
    expect(after?.status).toBe("waiting");

    // And the first step row must still be active (not completed).
    const { data: firstStep } = await supabase
      .from("engine_state_step")
      .select("status")
      .eq("state_id", stateId!)
      .eq("step_order", 1)
      .single();
    expect(firstStep?.status).toBe("active");
  });

  // ─── Test 2: Out-of-order step_id does not skip ahead ────
  // Start at step 1 (waiting for "hero") and fire "welcome"
  // (the step 8 gate). The state must not leap forward — at
  // worst the event is ignored, at best it is rejected. What
  // we are guarding against is a silent jump to complete.

  test("firing a later step_id while waiting on step 1 does not skip ahead", async () => {
    test.setTimeout(30_000);

    const start = await dispatch("signup.completed", {
      entity_type: "user_identity",
      entity_id: ENTITY_OUT_OF_ORDER,
      email: "e2e-out-of-order@test.local",
    });
    const stateId = start.results?.[0]?.state_id;
    expect(stateId).toBeTruthy();

    // Fire the step 8 event while we're still at step 1.
    await dispatch("onboarding.step_completed", {
      step_id: "welcome",
      entity_type: "user_identity",
      entity_id: ENTITY_OUT_OF_ORDER,
    });

    const { data: after } = await supabase
      .from("engine_state")
      .select("current_step, status")
      .eq("id", stateId!)
      .single();

    // Acceptable outcomes:
    //  - Still on step 1 (event was ignored / rejected).
    //  - Moved forward by exactly one if the engine fuzzy-matches.
    // The regression we care about is a silent leap to step 9 or to
    // complete, which would mean user skips the entire onboarding.
    expect(after?.current_step).toBeLessThanOrEqual(2);
    expect(after?.status).not.toBe("complete");
  });
});
