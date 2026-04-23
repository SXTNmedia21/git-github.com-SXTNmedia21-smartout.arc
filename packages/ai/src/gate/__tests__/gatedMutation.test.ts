// packages/ai/src/gate/__tests__/gatedMutation.test.ts
//
// SS-3 coverage for the composition orchestrator (ADR-0204).
//
// These tests enforce the behavioural contract the orchestrator commits to:
//
//   1. Authority FIRST (ADR-0204 §4). Pathway A runs before Pathway B.
//   2. Correlation chain. Both audit rows are stamped with the same
//      correlation_id via a post-RPC UPDATE; row 2 additionally carries
//      parent_evaluation_id pointing at row 1.
//   3. Short-circuit on authority deny. Pathway B is NOT called if
//      Pathway A denies (channel guard / four-eyes leak prevention).
//   4. Short-circuit on downgrade. `downgrade_to='suggest'` returns as
//      a capability deny WITHOUT running Pathway B — the caller has no
//      consent surface here.
//   5. Four-eyes passthrough. The authority deny carries
//      `four_eyes_required`, `approvers_needed`, `approvers_present` so
//      a UI can surface an approver selector (L-0133: discriminate on
//      the dedicated boolean, NOT on reason-string pattern-matching).
//   6. Proposal path returns `ok:true` with `proposal_id` and does NOT
//      invoke the domain `execute` callback.
//   7. Data-rule deny returns `ok:false, denied_by:'data_rule'` with a
//      correlation chain intact (both rows stamped).
//   8. Feature flag OFF throws `not_implemented:` synchronously — no
//      DB write, no emit, no partial work (ADR-0196 Invariant 11).
//
// L-0125 spirit: each test asserts on the *captured RPC + UPDATE calls*,
// not merely on the return-shape. A return shape without a backing DB
// row would be a phantom capability.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { gatedMutation, type GatedMutationArgs } from "../gatedMutation.js";

type RpcCall = { fn: string; args: Record<string, unknown> };
type UpdateCall = {
  table: string;
  patch: Record<string, unknown>;
  eq?: { column: string; value: unknown };
};

type RpcHandler = (
  fn: string,
  args: Record<string, unknown>,
) => { data: unknown; error: { message: string } | null };

function buildClient(opts: {
  rpcHandler: RpcHandler;
  rpcCaptures: RpcCall[];
  updateCaptures: UpdateCall[];
}): SupabaseClient {
  const fake = {
    rpc: vi.fn((fn: string, args: Record<string, unknown>) => {
      opts.rpcCaptures.push({ fn, args });
      return Promise.resolve(opts.rpcHandler(fn, args));
    }),
    from(table: string) {
      return {
        update(patch: Record<string, unknown>) {
          const call: UpdateCall = { table, patch };
          opts.updateCaptures.push(call);
          return {
            eq(column: string, value: unknown) {
              call.eq = { column, value };
              return Promise.resolve({ data: null, error: null });
            },
          };
        },
      };
    },
  };
  return fake as unknown as SupabaseClient;
}

function baseArgs(overrides: Partial<GatedMutationArgs> = {}): GatedMutationArgs {
  return {
    workspace_id: "00000000-0000-0000-0000-000000000001",
    actor_profile_id: "00000000-0000-0000-0000-00000000000a",
    capability: "memory",
    channel: "chat",
    action_type: "save",
    entity_id: "00000000-0000-0000-0000-00000000000b",
    entity_type: "engine_memory",
    action: "create",
    proposed_data: { content: "test" },
    current_data: null,
    execute: vi.fn(async () => ({ ok: true as const })),
    ...overrides,
  };
}

describe("gatedMutation — composition orchestrator (ADR-0204)", () => {
  const originalFlag = process.env.SMARTOUT_COMPOSITION_ORCHESTRATOR_ENABLED;

  beforeEach(() => {
    process.env.SMARTOUT_COMPOSITION_ORCHESTRATOR_ENABLED = "true";
  });

  afterEach(() => {
    if (originalFlag === undefined) {
      delete process.env.SMARTOUT_COMPOSITION_ORCHESTRATOR_ENABLED;
    } else {
      process.env.SMARTOUT_COMPOSITION_ORCHESTRATOR_ENABLED = originalFlag;
    }
  });

  // ─── (a) Both policies allow ────────────────────────────────────────
  it("(a) authority allow + data-rule allow → both rows written, same correlation_id, execute runs", async () => {
    const rpcCaptures: RpcCall[] = [];
    const updateCaptures: UpdateCall[] = [];

    const client = buildClient({
      rpcCaptures,
      updateCaptures,
      rpcHandler: (fn) => {
        if (fn === "gate_action") {
          return {
            data: { allow: true, gate_evaluation_id: "eval-auth-1" },
            error: null,
          };
        }
        if (fn === "cascade_gate_write") {
          return {
            data: {
              allowed: true,
              outcome: "applied",
              gate_evaluation_id: "eval-data-1",
              reason: null,
            },
            error: null,
          };
        }
        return { data: null, error: null };
      },
    });

    const execute = vi.fn(async () => ({ ok: true as const }));
    const result = await gatedMutation(client, baseArgs({ execute }));

    // Order: gate_action FIRST, cascade_gate_write SECOND.
    expect(rpcCaptures.map((c) => c.fn)).toEqual(["gate_action", "cascade_gate_write"]);

    // Return shape.
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.gate_evaluation_id).toBe("eval-data-1");
    expect(result.correlation_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/);

    // Domain execute ran exactly once.
    expect(execute).toHaveBeenCalledTimes(1);

    // Both gate_evaluation rows were stamped with the same correlation_id.
    expect(updateCaptures).toHaveLength(2);
    expect(updateCaptures[0]?.table).toBe("gate_evaluation");
    expect(updateCaptures[0]?.eq).toEqual({ column: "id", value: "eval-auth-1" });
    expect(updateCaptures[0]?.patch.correlation_id).toBe(result.correlation_id);
    expect(updateCaptures[0]?.patch.parent_evaluation_id).toBeNull();

    expect(updateCaptures[1]?.eq).toEqual({ column: "id", value: "eval-data-1" });
    expect(updateCaptures[1]?.patch.correlation_id).toBe(result.correlation_id);
    // Row 2 points back at row 1 via parent_evaluation_id.
    expect(updateCaptures[1]?.patch.parent_evaluation_id).toBe("eval-auth-1");
  });

  // ─── (b) Authority deny → short-circuit ─────────────────────────────
  it("(b) authority deny → NO cascade_gate_write call, row 1 stamped only", async () => {
    const rpcCaptures: RpcCall[] = [];
    const updateCaptures: UpdateCall[] = [];

    const client = buildClient({
      rpcCaptures,
      updateCaptures,
      rpcHandler: (fn) => {
        if (fn === "gate_action") {
          return {
            data: {
              allow: false,
              reason: "capability_disabled",
              gate_evaluation_id: "eval-auth-2",
            },
            error: null,
          };
        }
        return { data: null, error: null };
      },
    });

    const execute = vi.fn(async () => ({ ok: true as const }));
    const result = await gatedMutation(client, baseArgs({ execute }));

    // Pathway B never called.
    expect(rpcCaptures.map((c) => c.fn)).toEqual(["gate_action"]);
    expect(execute).not.toHaveBeenCalled();

    // Result is a capability deny with the row id.
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.denied_by).toBe("capability");
    expect(result.reason).toBe("capability_disabled");
    expect(result.gate_evaluation_id).toBe("eval-auth-2");
    expect(result.correlation_id).toBeDefined();

    // Only row 1 was stamped — row 2 never existed.
    expect(updateCaptures).toHaveLength(1);
    expect(updateCaptures[0]?.eq).toEqual({ column: "id", value: "eval-auth-2" });
    expect(updateCaptures[0]?.patch.parent_evaluation_id).toBeNull();
  });

  // ─── (c) downgrade_to='suggest' → confirmation-required ─────────────
  it("(c) authority downgrade_to=suggest → capability deny, no cascade call", async () => {
    const rpcCaptures: RpcCall[] = [];
    const updateCaptures: UpdateCall[] = [];

    const client = buildClient({
      rpcCaptures,
      updateCaptures,
      rpcHandler: (fn) => {
        if (fn === "gate_action") {
          return {
            data: {
              allow: true,
              downgrade_to: "suggest",
              reason: "role_below_min",
              gate_evaluation_id: "eval-auth-3",
            },
            error: null,
          };
        }
        return { data: null, error: null };
      },
    });

    const execute = vi.fn(async () => ({ ok: true as const }));
    const result = await gatedMutation(client, baseArgs({ execute }));

    expect(rpcCaptures.map((c) => c.fn)).toEqual(["gate_action"]);
    expect(execute).not.toHaveBeenCalled();

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.denied_by).toBe("capability");
    expect(result.reason).toBe("role_below_min");
    expect(result.gate_evaluation_id).toBe("eval-auth-3");

    // Row 1 stamped, no row 2.
    expect(updateCaptures).toHaveLength(1);
  });

  // ─── (d) Four-eyes required → discriminate on boolean, NOT string ───
  it("(d) authority four-eyes (boolean discriminator per L-0133) → passthrough, no cascade call", async () => {
    const rpcCaptures: RpcCall[] = [];
    const updateCaptures: UpdateCall[] = [];

    // L-0133 regression guard: reason is a machine code unrelated to
    // "four_eyes_required" — the orchestrator MUST read the dedicated
    // boolean, not regex the reason string.
    const client = buildClient({
      rpcCaptures,
      updateCaptures,
      rpcHandler: (fn) => {
        if (fn === "gate_action") {
          return {
            data: {
              allow: false,
              reason: "approval_required",
              four_eyes_required: true,
              approvers_needed: 2,
              approvers_present: ["00000000-0000-0000-0000-00000000000a"],
              gate_evaluation_id: "eval-auth-4",
            },
            error: null,
          };
        }
        return { data: null, error: null };
      },
    });

    const execute = vi.fn(async () => ({ ok: true as const }));
    const result = await gatedMutation(client, baseArgs({ execute }));

    expect(rpcCaptures.map((c) => c.fn)).toEqual(["gate_action"]);
    expect(execute).not.toHaveBeenCalled();

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.denied_by).toBe("capability");
    expect(result.four_eyes_required).toBe(true);
    expect(result.approvers_needed).toBe(2);
    expect(result.approvers_present).toEqual(["00000000-0000-0000-0000-00000000000a"]);
    expect(result.reason).toBe("approval_required"); // <-- NOT matched by "four_eyes_required"

    expect(updateCaptures).toHaveLength(1);
  });

  // ─── (e) Data-rule returns proposal → ok:true + proposal_id ─────────
  it("(e) authority allow + data-rule proposal → proposal_id returned, execute NOT invoked", async () => {
    const rpcCaptures: RpcCall[] = [];
    const updateCaptures: UpdateCall[] = [];

    const client = buildClient({
      rpcCaptures,
      updateCaptures,
      rpcHandler: (fn) => {
        if (fn === "gate_action") {
          return {
            data: { allow: true, gate_evaluation_id: "eval-auth-5" },
            error: null,
          };
        }
        if (fn === "cascade_gate_write") {
          return {
            data: {
              allowed: false,
              outcome: "proposed",
              proposal_id: "prop-42",
              reason: "framework-trigger-matched",
              gate_evaluation_id: "eval-data-5",
            },
            error: null,
          };
        }
        return { data: null, error: null };
      },
    });

    const execute = vi.fn(async () => ({ ok: true as const }));
    const result = await gatedMutation(client, baseArgs({ execute }));

    // Both RPCs were called.
    expect(rpcCaptures.map((c) => c.fn)).toEqual(["gate_action", "cascade_gate_write"]);
    // Execute MUST NOT run on the proposal path.
    expect(execute).not.toHaveBeenCalled();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.proposal_id).toBe("prop-42");
    expect(result.gate_evaluation_id).toBe("eval-data-5");
    expect(result.reason).toBe("framework-trigger-matched");

    // Both rows stamped with the same correlation id; row 2 points at row 1.
    expect(updateCaptures).toHaveLength(2);
    expect(updateCaptures[0]?.eq?.value).toBe("eval-auth-5");
    expect(updateCaptures[1]?.eq?.value).toBe("eval-data-5");
    expect(updateCaptures[1]?.patch.parent_evaluation_id).toBe("eval-auth-5");
    expect(updateCaptures[0]?.patch.correlation_id).toBe(updateCaptures[1]?.patch.correlation_id);
  });

  // ─── (f) Data-rule deny → both rows, chain intact ───────────────────
  it("(f) authority allow + data-rule blocked → denied_by:data_rule, chain intact", async () => {
    const rpcCaptures: RpcCall[] = [];
    const updateCaptures: UpdateCall[] = [];

    const client = buildClient({
      rpcCaptures,
      updateCaptures,
      rpcHandler: (fn) => {
        if (fn === "gate_action") {
          return {
            data: { allow: true, gate_evaluation_id: "eval-auth-6" },
            error: null,
          };
        }
        if (fn === "cascade_gate_write") {
          return {
            data: {
              allowed: false,
              outcome: "blocked",
              reason: "rule-violation",
              gate_evaluation_id: "eval-data-6",
            },
            error: null,
          };
        }
        return { data: null, error: null };
      },
    });

    const execute = vi.fn(async () => ({ ok: true as const }));
    const result = await gatedMutation(client, baseArgs({ execute }));

    expect(rpcCaptures.map((c) => c.fn)).toEqual(["gate_action", "cascade_gate_write"]);
    expect(execute).not.toHaveBeenCalled();

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.denied_by).toBe("data_rule");
    expect(result.reason).toBe("rule-violation");
    expect(result.gate_evaluation_id).toBe("eval-data-6");
    expect(result.correlation_id).toBeDefined();

    // Both rows stamped — correlation chain complete even on deny.
    expect(updateCaptures).toHaveLength(2);
    expect(updateCaptures[1]?.patch.parent_evaluation_id).toBe("eval-auth-6");
    expect(updateCaptures[0]?.patch.correlation_id).toBe(updateCaptures[1]?.patch.correlation_id);
  });

  // ─── (g) Feature flag OFF → throw, NO side effects ──────────────────
  it("(g) feature flag OFF → throws not_implemented, NO rpc, NO update (Invariant 11)", async () => {
    delete process.env.SMARTOUT_COMPOSITION_ORCHESTRATOR_ENABLED;

    const rpcCaptures: RpcCall[] = [];
    const updateCaptures: UpdateCall[] = [];

    const client = buildClient({
      rpcCaptures,
      updateCaptures,
      rpcHandler: () => ({ data: null, error: null }),
    });

    const execute = vi.fn(async () => ({ ok: true as const }));

    await expect(gatedMutation(client, baseArgs({ execute }))).rejects.toThrow(/^not_implemented:/);

    // The core Invariant 11 claim: NO side effects before the implementation
    // is ready. No RPC, no UPDATE, no execute, no emit (not wired in SS-3).
    expect(rpcCaptures).toHaveLength(0);
    expect(updateCaptures).toHaveLength(0);
    expect(execute).not.toHaveBeenCalled();
  });

  // ─── Extra: RPC shape drift → not_implemented, NO execute ───────────
  it("(h) gate_action returns bad shape → not_implemented, NO cascade call, NO execute", async () => {
    const rpcCaptures: RpcCall[] = [];
    const updateCaptures: UpdateCall[] = [];

    const client = buildClient({
      rpcCaptures,
      updateCaptures,
      rpcHandler: (fn) => {
        if (fn === "gate_action") {
          // Array instead of object — orchestrator must fail-closed.
          return { data: ["unexpected"], error: null };
        }
        return { data: null, error: null };
      },
    });

    const execute = vi.fn(async () => ({ ok: true as const }));
    const result = await gatedMutation(client, baseArgs({ execute }));

    expect(rpcCaptures.map((c) => c.fn)).toEqual(["gate_action"]);
    expect(execute).not.toHaveBeenCalled();
    expect(updateCaptures).toHaveLength(0);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.denied_by).toBe("not_implemented");
    expect(result.reason).toContain("gate_rpc_failure:gate_action");
  });
});
