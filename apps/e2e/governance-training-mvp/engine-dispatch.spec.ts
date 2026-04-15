import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Verifies that the update_entity allowlist in supabase/functions/engine-dispatch
 * accepts the two new entities introduced in Phase 0 (Task 10):
 *   - change_proposal
 *   - observer_request
 *
 * Calls the dispatch_engine_action RPC against a local Supabase. Errors will
 * surface as a non-null `error` value when the target is rejected.
 */
test("update_entity allows change_proposal and observer_request", async () => {
  const supa = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { error: cpError } = await supa.rpc("dispatch_engine_action", {
    action_type: "update_entity",
    params: {
      target: "change_proposal",
      id: "00000000-0000-0000-0000-000000000000",
      updates: { status: "approved" },
    },
  });
  expect(cpError).toBeNull();

  const { error: obError } = await supa.rpc("dispatch_engine_action", {
    action_type: "update_entity",
    params: {
      target: "observer_request",
      id: "00000000-0000-0000-0000-000000000000",
      updates: { status: "claimed" },
    },
  });
  expect(obError).toBeNull();
});
