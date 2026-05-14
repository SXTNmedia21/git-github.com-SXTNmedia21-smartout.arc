/**
 * mutate-with-gate.test.ts — coverage for the ADR-0287 ergonomic helper.
 *
 * Behavioural contract (mirrors the helper docstring):
 *
 *   1. L-0177 fail-fast guards throw MutateWithGateError on missing
 *      workspaceId / profileId / capability / actionType BEFORE any RPC
 *      call.
 *   2. Granted path runs `exec`, emits `gate_evaluated(allow=true)`,
 *      returns `{ ok: true, result, ... }`.
 *   3. Capability deny throws MutateWithGateDenied with denied_by =
 *      "capability" and full ADR-0099/0101 metadata. `exec` is NOT
 *      called. `gate_evaluated(allow=false, denied_by="capability")` is
 *      emitted.
 *   4. Data-rule deny throws MutateWithGateDenied with denied_by =
 *      "data_rule".
 *   5. RPC transport failure (`denied_by:not_implemented` from
 *      gatedMutation) throws MutateWithGateError(code=gate_unavailable)
 *      — fail CLOSED, never default-allow.
 *   6. gate_evaluation row id is recorded on every emit (allow + deny
 *      paths) — captured via the mock client's RPC return.
 *   7. Caller-supplied cascade args are forwarded; when omitted, the
 *      sentinel `__authority_shadow_<cap>__` entity_type is used so
 *      Pathway B short-circuits applied.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { mutateWithGate, MutateWithGateError, MutateWithGateDenied } from "../mutate-with-gate.js";

// Telemetry emit is mocked so we can assert on calls without wiring
// PostHog/activity_trail.
vi.mock("@smartout/telemetry", async () => {
  const actual = await vi.importActual<typeof import("@smartout/telemetry")>("@smartout/telemetry");
  return {
    ...actual,
    emit: vi.fn(async () => undefined),
  };
});
import { emit } from "@smartout/telemetry";

// Lightweight Supabase client mock that captures RPC + `from().update().eq()`
// calls the orchestrator uses for correlation stamping.
type RpcCall = { fn: string; args: Record<string, unknown> };
type RpcHandler = (
  fn: string,
  args: Record<string, unknown>,
) => { data: unknown; error: { message: string } | null };

function buildClient(opts: { rpcCaptures: RpcCall[]; rpcHandler: RpcHandler }): SupabaseClient {
  const fake = {
    rpc: vi.fn((fn: string, args: Record<string, unknown>) => {
      opts.rpcCaptures.push({ fn, args });
      return Promise.resolve(opts.rpcHandler(fn, args));
    }),
    from() {
      return {
        update() {
          return {
            eq() {
              return Promise.resolve({ data: null, error: null });
            },
          };
        },
      };
    },
  };
  return fake as unknown as SupabaseClient;
}

const WS = "00000000-0000-0000-0000-000000000001";
const PROFILE = "00000000-0000-0000-0000-00000000000a";

describe("mutateWithGate — ergonomic wrapper (ADR-0287)", () => {
  const originalFlag = process.env.SMARTOUT_COMPOSITION_ORCHESTRATOR_ENABLED;

  beforeEach(() => {
    process.env.SMARTOUT_COMPOSITION_ORCHESTRATOR_ENABLED = "true";
    vi.mocked(emit).mockClear();
  });

  afterEach(() => {
    if (originalFlag === undefined) {
      delete process.env.SMARTOUT_COMPOSITION_ORCHESTRATOR_ENABLED;
    } else {
      process.env.SMARTOUT_COMPOSITION_ORCHESTRATOR_ENABLED = originalFlag;
    }
  });

  // ─── L-0177 fail-fast ────────────────────────────────────────────────
  it("throws MutateWithGateError(missing_workspace_id) on empty workspaceId", async () => {
    const rpcCaptures: RpcCall[] = [];
    const client = buildClient({
      rpcCaptures,
      rpcHandler: () => ({ data: null, error: null }),
    });

    const exec = vi.fn(async () => "should-not-run");
    await expect(
      mutateWithGate(client, {
        workspaceId: "",
        profileId: PROFILE,
        capability: "task",
        actionType: "save",
        exec,
      }),
    ).rejects.toMatchObject({
      name: "MutateWithGateError",
      code: "missing_workspace_id",
    });

    // L-0177: NO RPC call should have fired before the guard threw.
    expect(rpcCaptures).toHaveLength(0);
    expect(exec).not.toHaveBeenCalled();
    expect(vi.mocked(emit)).not.toHaveBeenCalled();
  });

  it("throws MutateWithGateError(missing_profile_id) on empty profileId", async () => {
    const client = buildClient({
      rpcCaptures: [],
      rpcHandler: () => ({ data: null, error: null }),
    });

    await expect(
      mutateWithGate(client, {
        workspaceId: WS,
        profileId: "   ", // whitespace-only — same class
        capability: "task",
        actionType: "save",
        exec: async () => "x",
      }),
    ).rejects.toMatchObject({
      name: "MutateWithGateError",
      code: "missing_profile_id",
    });
  });

  it("throws MutateWithGateError(missing_capability) on empty capability", async () => {
    const client = buildClient({
      rpcCaptures: [],
      rpcHandler: () => ({ data: null, error: null }),
    });

    await expect(
      mutateWithGate(client, {
        workspaceId: WS,
        profileId: PROFILE,
        capability: "",
        actionType: "save",
        exec: async () => "x",
      }),
    ).rejects.toMatchObject({
      name: "MutateWithGateError",
      code: "missing_capability",
    });
  });

  it("throws MutateWithGateError(missing_action_type) on empty actionType", async () => {
    const client = buildClient({
      rpcCaptures: [],
      rpcHandler: () => ({ data: null, error: null }),
    });

    await expect(
      mutateWithGate(client, {
        workspaceId: WS,
        profileId: PROFILE,
        capability: "task",
        actionType: "",
        exec: async () => "x",
      }),
    ).rejects.toMatchObject({
      name: "MutateWithGateError",
      code: "missing_action_type",
    });
  });

  // ─── Granted path ────────────────────────────────────────────────────
  it("granted path executes exec + emits gate_evaluated(allow=true) + returns result", async () => {
    const rpcCaptures: RpcCall[] = [];
    const client = buildClient({
      rpcCaptures,
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

    const exec = vi.fn(async () => ({ shift_id: "abc-123" }));
    const result = await mutateWithGate(client, {
      workspaceId: WS,
      profileId: PROFILE,
      capability: "task",
      actionType: "save",
      channel: "chat",
      exec,
    });

    expect(result.ok).toBe(true);
    expect(result.result).toEqual({ shift_id: "abc-123" });
    expect(result.gateEvaluationId).toBe("eval-data-1");
    expect(result.correlationId).toMatch(/^[0-9a-f]{8}-/);

    // exec ran exactly once (gatedMutation contract).
    expect(exec).toHaveBeenCalledTimes(1);

    // Both RPCs called in order: gate_action FIRST.
    expect(rpcCaptures.map((c) => c.fn)).toEqual(["gate_action", "cascade_gate_write"]);

    // Emit fired once on success path.
    const emitMock = vi.mocked(emit);
    expect(emitMock).toHaveBeenCalledTimes(1);
    const call = emitMock.mock.calls[0]![0] as {
      event: string;
      properties: { data: Record<string, unknown> };
    };
    expect(call.event).toBe("gate_evaluated");
    expect(call.properties.data.allow).toBe(true);
    expect(call.properties.data.denied_by).toBeNull();
    expect(call.properties.data.capability).toBe("task");
    expect(call.properties.data.action_type).toBe("save");
    expect(call.properties.data.gate_evaluation_id).toBe("eval-data-1");
  });

  it("omitted cascade args use sentinel entity_type so Pathway B short-circuits", async () => {
    const rpcCaptures: RpcCall[] = [];
    const client = buildClient({
      rpcCaptures,
      rpcHandler: (fn) => {
        if (fn === "gate_action") {
          return { data: { allow: true, gate_evaluation_id: "e1" }, error: null };
        }
        return {
          data: { allowed: true, outcome: "applied", gate_evaluation_id: "e2" },
          error: null,
        };
      },
    });

    await mutateWithGate(client, {
      workspaceId: WS,
      profileId: PROFILE,
      capability: "memory",
      actionType: "save",
      exec: async () => "ok",
    });

    const cascadeCall = rpcCaptures.find((c) => c.fn === "cascade_gate_write");
    expect(cascadeCall).toBeDefined();
    expect(cascadeCall?.args.p_entity_type).toBe("__authority_shadow_memory__");
    expect(cascadeCall?.args.p_action).toBe("create");
  });

  it("caller-supplied cascade args are forwarded verbatim", async () => {
    const rpcCaptures: RpcCall[] = [];
    const client = buildClient({
      rpcCaptures,
      rpcHandler: (fn) => {
        if (fn === "gate_action") {
          return { data: { allow: true, gate_evaluation_id: "e1" }, error: null };
        }
        return {
          data: { allowed: true, outcome: "applied", gate_evaluation_id: "e2" },
          error: null,
        };
      },
    });

    await mutateWithGate(client, {
      workspaceId: WS,
      profileId: PROFILE,
      capability: "schedule",
      actionType: "create_shift",
      targetId: "shift-123",
      cascade: {
        entityType: "schedule_shift",
        action: "create",
        proposedData: { start_at: "2026-05-13T10:00:00Z" },
        currentData: null,
      },
      exec: async () => "ok",
    });

    const cascadeCall = rpcCaptures.find((c) => c.fn === "cascade_gate_write");
    expect(cascadeCall?.args.p_entity_type).toBe("schedule_shift");
    expect(cascadeCall?.args.p_action).toBe("create");
    expect(cascadeCall?.args.p_proposed_data).toEqual({
      start_at: "2026-05-13T10:00:00Z",
    });
  });

  // ─── Denied paths ────────────────────────────────────────────────────
  it("capability deny throws MutateWithGateDenied(capability) + emits + does NOT run exec", async () => {
    const rpcCaptures: RpcCall[] = [];
    const client = buildClient({
      rpcCaptures,
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

    const exec = vi.fn(async () => "should-not-run");
    await expect(
      mutateWithGate(client, {
        workspaceId: WS,
        profileId: PROFILE,
        capability: "task",
        actionType: "save",
        exec,
      }),
    ).rejects.toBeInstanceOf(MutateWithGateDenied);

    // exec never invoked.
    expect(exec).not.toHaveBeenCalled();

    // Pathway B was NOT called (gatedMutation short-circuits on capability
    // deny so channel guard + four-eyes never leak intent).
    expect(rpcCaptures.map((c) => c.fn)).toEqual(["gate_action"]);

    // Emit fired once with allow=false, denied_by="capability".
    const emitMock = vi.mocked(emit);
    expect(emitMock).toHaveBeenCalledTimes(1);
    const call = emitMock.mock.calls[0]![0] as {
      properties: { data: { allow: boolean; denied_by: string | null } };
    };
    expect(call.properties.data.allow).toBe(false);
    expect(call.properties.data.denied_by).toBe("capability");
  });

  it("capability deny exception carries reason + correlationId + gateEvaluationId", async () => {
    const client = buildClient({
      rpcCaptures: [],
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

    try {
      await mutateWithGate(client, {
        workspaceId: WS,
        profileId: PROFILE,
        capability: "task",
        actionType: "save",
        exec: async () => "x",
      });
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(MutateWithGateDenied);
      const denied = err as MutateWithGateDenied;
      expect(denied.deniedBy).toBe("capability");
      expect(denied.message).toBe("capability_disabled");
      expect(denied.gateEvaluationId).toBe("eval-auth-2");
      expect(denied.correlationId).toMatch(/^[0-9a-f]{8}-/);
    }
  });

  it("downgrade_to=suggest surfaces as MutateWithGateDenied with downgradedTo set", async () => {
    const client = buildClient({
      rpcCaptures: [],
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

    try {
      await mutateWithGate(client, {
        workspaceId: WS,
        profileId: PROFILE,
        capability: "schedule",
        actionType: "create_shift",
        exec: async () => "x",
      });
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(MutateWithGateDenied);
      const denied = err as MutateWithGateDenied;
      expect(denied.deniedBy).toBe("capability");
      // L-0133: discriminate on the dedicated `downgradedTo` field, NOT
      // on reason-string pattern matching.
      expect(denied.downgradedTo).toBe("suggest");
    }
  });

  it("data_rule deny throws MutateWithGateDenied(data_rule) + emits", async () => {
    const client = buildClient({
      rpcCaptures: [],
      rpcHandler: (fn) => {
        if (fn === "gate_action") {
          return { data: { allow: true, gate_evaluation_id: "e1" }, error: null };
        }
        return {
          data: {
            allowed: false,
            outcome: "blocked",
            reason: "framework_rule_violation",
            gate_evaluation_id: "e2",
          },
          error: null,
        };
      },
    });

    const exec = vi.fn(async () => "x");
    await expect(
      mutateWithGate(client, {
        workspaceId: WS,
        profileId: PROFILE,
        capability: "schedule",
        actionType: "create_shift",
        cascade: {
          entityType: "schedule_shift",
          action: "create",
          proposedData: { start_at: "..." },
        },
        exec,
      }),
    ).rejects.toMatchObject({
      name: "MutateWithGateDenied",
      deniedBy: "data_rule",
      message: "framework_rule_violation",
    });

    expect(exec).not.toHaveBeenCalled();

    // Emit fired with allow=false, denied_by="data_rule".
    const emitMock = vi.mocked(emit);
    const call = emitMock.mock.calls[0]![0] as {
      properties: { data: { allow: boolean; denied_by: string | null } };
    };
    expect(call.properties.data.allow).toBe(false);
    expect(call.properties.data.denied_by).toBe("data_rule");
  });

  // ─── RPC transport failure → fail closed ─────────────────────────────
  it("gate transport failure throws MutateWithGateError(gate_unavailable) — fail CLOSED", async () => {
    const client = buildClient({
      rpcCaptures: [],
      rpcHandler: (fn) => {
        if (fn === "gate_action") {
          return { data: null, error: { message: "connection_refused" } };
        }
        return { data: null, error: null };
      },
    });

    const exec = vi.fn(async () => "x");
    await expect(
      mutateWithGate(client, {
        workspaceId: WS,
        profileId: PROFILE,
        capability: "task",
        actionType: "save",
        exec,
      }),
    ).rejects.toMatchObject({
      name: "MutateWithGateError",
      code: "gate_unavailable",
    });

    expect(exec).not.toHaveBeenCalled();

    // Emit STILL fires with denied_by="not_implemented" so the failure
    // is observable in dashboards even though it's a transport issue,
    // not a policy decision.
    const emitMock = vi.mocked(emit);
    expect(emitMock).toHaveBeenCalledTimes(1);
    const call = emitMock.mock.calls[0]![0] as {
      properties: { data: { allow: boolean; denied_by: string | null } };
    };
    expect(call.properties.data.allow).toBe(false);
    expect(call.properties.data.denied_by).toBe("not_implemented");
  });
});
