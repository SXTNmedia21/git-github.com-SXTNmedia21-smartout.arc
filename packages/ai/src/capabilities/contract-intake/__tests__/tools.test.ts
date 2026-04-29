/**
 * Vitest coverage for contract_intake capability tools.
 *
 * Phase A1 (campaign/botsson-arena) — verifies that:
 *   1. submit_field_group calls gate_action BEFORE any submit_own_pii RPC.
 *   2. On allow → PII is submitted, completion event is fired, output carries
 *      the legacy `{ saved, group, complete }` surface plus the ADR-0138
 *      `{ allowed: true, outcome: "applied" }` fields.
 *   3. On deny → no submit_own_pii call, output carries `allowed: false`,
 *      `outcome: "blocked"`, and the gate reason.
 *   4. On downgrade_to='suggest' → no submit, output carries
 *      `outcome: "confirmation_required"`.
 *   5. On four_eyes_required → no submit, output carries
 *      `outcome: "four_eyes_pending"` with approvers_needed + approvers_present.
 *
 * SS-4 (Council 2026-04-23, ADR-0204): `callGateAction` now delegates to
 * `gatedMutation()` — the ADR-0204 composition orchestrator which calls
 * BOTH `gate_action` AND `cascade_gate_write`. The admin-client mock
 * defaults `cascade_gate_write` to `{allowed:true, outcome:"applied",
 * reason:"no-active-framework"}` so existing tests that stub only
 * `gate_action` keep working. `from("gate_evaluation").update()` is a
 * no-op so the orchestrator's correlation stamp doesn't error.
 *
 * Tests use the same hand-rolled Supabase double style as
 * `shift-lifecycle/__tests__/tools.test.ts`. `@smartout/telemetry` is mocked
 * so emits are silent and non-throwing. `@smartout/utils` is used for real
 * (validatePersonnummer passes Modulus 11 for the fixture below).
 */

import { afterAll, beforeAll, describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { nonEmpty } from "@smartout/telemetry/server";

vi.mock("@smartout/telemetry", () => ({
  emit: vi.fn(async () => undefined),
}));

// SS-4: enable the composition orchestrator for this test file.
const ORIGINAL_ORCHESTRATOR_FLAG = process.env.SMARTOUT_COMPOSITION_ORCHESTRATOR_ENABLED;
beforeAll(() => {
  process.env.SMARTOUT_COMPOSITION_ORCHESTRATOR_ENABLED = "true";
});
afterAll(() => {
  if (ORIGINAL_ORCHESTRATOR_FLAG === undefined) {
    delete process.env.SMARTOUT_COMPOSITION_ORCHESTRATOR_ENABLED;
  } else {
    process.env.SMARTOUT_COMPOSITION_ORCHESTRATOR_ENABLED = ORIGINAL_ORCHESTRATOR_FLAG;
  }
});

import { submitFieldGroup } from "../tools.js";
import type { AgentToolContext, SessionChannel } from "../../types.js";

// ── Test Doubles ────────────────────────────────────────────────────

type RpcCall = { fn: string; args: Record<string, unknown> };

// SS-4 default for Pathway B (`cascade_gate_write`) — the orchestrator's
// sentinel entity_type always hits the `no-active-framework` /
// `no-trigger-match` branch in production.
const DEFAULT_CASCADE_WRITE = {
  allowed: true,
  outcome: "applied",
  reason: "no-active-framework",
  gate_evaluation_id: "gate-eval-b",
};

/**
 * Factory for a Supabase double. The admin client routes `rpc()` through
 * `rpcHandler`; the user client records `submit_own_pii` invocations so
 * tests can assert "mutation did not fire" on deny/downgrade paths.
 */
function makeSupabaseAdmin(
  rpcHandler: (fn: string, args: Record<string, unknown>) => { data: unknown; error: unknown },
  calls: RpcCall[],
): SupabaseClient {
  return {
    from: vi.fn((table: string) => {
      // SS-4: the orchestrator stamps correlation via
      // from("gate_evaluation").update(...).eq(...). Return a no-op
      // chain so the stamp doesn't throw; other tables keep the legacy
      // builder shape.
      if (table === "gate_evaluation") {
        return {
          update: vi.fn(() => ({
            eq: vi.fn(async () => ({ data: null, error: null })),
          })),
        };
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(async () => ({ data: null, error: null })),
            maybeSingle: vi.fn(async () => ({ data: null, error: null })),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(async () => ({ data: null, error: null })),
          })),
        })),
      };
    }),
    rpc: vi.fn(async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      // Ordering: test-supplied handler → SS-4 defaults → bare default.
      const supplied = rpcHandler(fn, args);
      if (
        supplied.error ||
        (supplied.data !== null &&
          typeof supplied.data === "object" &&
          !Array.isArray(supplied.data))
      ) {
        return supplied;
      }
      if (fn === "cascade_gate_write") {
        return { data: DEFAULT_CASCADE_WRITE, error: null };
      }
      return supplied;
    }),
  } as unknown as SupabaseClient;
}

function makeSupabaseUser(calls: RpcCall[]): SupabaseClient {
  return {
    rpc: vi.fn(async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      return { data: null, error: null };
    }),
  } as unknown as SupabaseClient;
}

function makeCtx(overrides: {
  supabaseAdmin: SupabaseClient;
  supabaseUser?: SupabaseClient;
  channel?: SessionChannel;
}): AgentToolContext {
  return {
    workspaceId: nonEmpty("ws-1", "workspaceId"),
    profileId: nonEmpty("profile-1", "profileId"),
    sessionId: "sess-1",
    channel: overrides.channel ?? ("chat" as SessionChannel),
    supabaseAdmin: overrides.supabaseAdmin,
    supabaseUser: overrides.supabaseUser,
  };
}

// A personnummer that passes validatePersonnummer (Modulus 11). Lifted
// from existing onboarding fixtures so we don't introduce a new magic
// number here — if validation changes, this test fails loudly.
const VALID_PNR = "31129956715";

// ── Tests ───────────────────────────────────────────────────────────

describe("submit_field_group — gate_action integration (Phase A1)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("allow: submit_own_pii fires and result carries allowed=true + applied outcome", async () => {
    const adminCalls: RpcCall[] = [];
    const userCalls: RpcCall[] = [];

    const admin = makeSupabaseAdmin((fn) => {
      if (fn === "gate_action") return { data: { allow: true }, error: null };
      if (fn === "check_contract_intake_completion") {
        return { data: { complete: false }, error: null };
      }
      return { data: null, error: null };
    }, adminCalls);

    const user = makeSupabaseUser(userCalls);

    const result = await submitFieldGroup.execute(
      { group: "identity", values: { personal_number: VALID_PNR } },
      makeCtx({ supabaseAdmin: admin, supabaseUser: user }),
    );

    // Gate was called first with correct capability + action_type + entity_id.
    const gateCall = adminCalls.find((c) => c.fn === "gate_action");
    expect(gateCall).toBeDefined();
    expect(gateCall?.args.p_capability).toBe("contract_intake");
    expect(gateCall?.args.p_action_type).toBe("submit_field_group");
    expect(gateCall?.args.p_entity_id).toBe("profile-1");
    expect(gateCall?.args.p_channel).toBe("chat");

    // submit_own_pii was invoked on the user-scoped client (auth.uid resolves).
    const submitCall = userCalls.find((c) => c.fn === "submit_own_pii");
    expect(submitCall).toBeDefined();
    expect(submitCall?.args.p_field_group).toBe("identity");

    const parsed = JSON.parse(result);
    expect(parsed.allowed).toBe(true);
    expect(parsed.outcome).toBe("applied");
    expect(parsed.saved).toBe(true);
    expect(parsed.group).toBe("identity");
    expect(parsed.complete).toBe(false);
    expect(typeof parsed.user_message).toBe("string");
  });

  it("deny: gate blocks → no submit_own_pii call, result carries allowed=false + blocked outcome + reason", async () => {
    const adminCalls: RpcCall[] = [];
    const userCalls: RpcCall[] = [];

    const admin = makeSupabaseAdmin(
      (fn) =>
        fn === "gate_action"
          ? { data: { allow: false, reason: "capability_disabled" }, error: null }
          : { data: null, error: null },
      adminCalls,
    );
    const user = makeSupabaseUser(userCalls);

    const result = await submitFieldGroup.execute(
      { group: "banking", values: { bank_account: "12345678903" } },
      makeCtx({ supabaseAdmin: admin, supabaseUser: user }),
    );

    // PII RPC was NEVER called — gate short-circuited before the user client.
    expect(userCalls.find((c) => c.fn === "submit_own_pii")).toBeUndefined();

    const parsed = JSON.parse(result);
    expect(parsed.allowed).toBe(false);
    expect(parsed.outcome).toBe("blocked");
    expect(parsed.reason).toBe("capability_disabled");
    expect(parsed.user_message).toContain("capability_disabled");
  });

  it("downgrade_to=suggest: no submit, result carries confirmation_required outcome", async () => {
    const adminCalls: RpcCall[] = [];
    const userCalls: RpcCall[] = [];

    const admin = makeSupabaseAdmin(
      (fn) =>
        fn === "gate_action"
          ? {
              // SS-4: real gate_action for min_role downgrade returns
              // `allow:true + downgrade_to:'suggest'` (see
              // supabase/migrations/*gate_action_four_eyes*.sql — v_allow
              // stays true, v_downgrade_to is set). The orchestrator
              // short-circuits this as `{ok:false, denied_by:'capability',
              // downgraded:true}` which the wrapper adapter maps back
              // to `{allow:false, downgradeTo:'suggest'}` for the tool's
              // downgrade branch (L-0133 boolean discriminator).
              //
              // Pre-SS-4 this fixture had `allow:false` — never a real
              // production shape; it worked because the legacy wrapper
              // straight-passed both fields.
              data: { allow: true, downgrade_to: "suggest", reason: "role_below_min" },
              error: null,
            }
          : { data: null, error: null },
      adminCalls,
    );
    const user = makeSupabaseUser(userCalls);

    const result = await submitFieldGroup.execute(
      { group: "identity", values: { personal_number: VALID_PNR } },
      makeCtx({ supabaseAdmin: admin, supabaseUser: user }),
    );

    // No mutation fired.
    expect(userCalls.find((c) => c.fn === "submit_own_pii")).toBeUndefined();

    const parsed = JSON.parse(result);
    expect(parsed.allowed).toBe(false);
    expect(parsed.outcome).toBe("confirmation_required");
    expect(parsed.reason).toBe("downgraded_to_suggest");
    expect(typeof parsed.user_message).toBe("string");
  });

  it("four_eyes_required: no submit, result carries four_eyes_pending outcome + approvers metadata", async () => {
    const adminCalls: RpcCall[] = [];
    const userCalls: RpcCall[] = [];

    // Intentional divergence: the RPC sets `four_eyes_required: true` but
    // `reason` is NOT the string "four_eyes_required" (could be null, or
    // carry a distinct machine code like "approval_required"). The tool
    // must discriminate on the dedicated boolean, not on reason-string
    // pattern-matching — otherwise the four-eyes branch silently falls
    // through to "blocked" and the UI never surfaces the approver selector.
    const admin = makeSupabaseAdmin(
      (fn) =>
        fn === "gate_action"
          ? {
              data: {
                allow: false,
                reason: "approval_required",
                four_eyes_required: true,
                approvers_needed: 2,
                approvers_present: ["profile-1"],
              },
              error: null,
            }
          : { data: null, error: null },
      adminCalls,
    );
    const user = makeSupabaseUser(userCalls);

    const result = await submitFieldGroup.execute(
      { group: "banking", values: { bank_account: "12345678903" } },
      makeCtx({ supabaseAdmin: admin, supabaseUser: user }),
    );

    expect(userCalls.find((c) => c.fn === "submit_own_pii")).toBeUndefined();

    const parsed = JSON.parse(result);
    expect(parsed.allowed).toBe(false);
    // Outgoing contract: regardless of the gate's internal reason code,
    // the tool normalises the LLM-visible reason to "four_eyes_required"
    // so prompt templates have a stable string to key off.
    expect(parsed.outcome).toBe("four_eyes_pending");
    expect(parsed.reason).toBe("four_eyes_required");
    expect(parsed.approvers_needed).toBe(2);
    expect(parsed.approvers_present).toEqual(["profile-1"]);
    expect(typeof parsed.user_message).toBe("string");
  });
});
