/**
 * Vitest coverage for shift_lifecycle capability tools.
 *
 * Phase 5 (ADR-0095) — verifies that:
 *   1. publish_shift calls gate_action first; on deny it aborts without mutating.
 *   2. approve_shift surfaces a four-eyes pending response when the gate says so.
 *   3. interpret_shift forwards to derive_shift_hours and returns the interpretation_id.
 *   4. settle_shift is idempotent — repeat calls reuse the existing snapshot.
 *   5. check_readiness returns correct missing_* arrays.
 *
 * SS-4 (Council 2026-04-23, ADR-0204): `callGateAction` now delegates to
 * the composition orchestrator `gatedMutation()` which calls BOTH
 * `gate_action` (Pathway A) AND `cascade_gate_write` (Pathway B) for
 * every authority check. Tests that previously stubbed only `gate_action`
 * now need a sensible default for `cascade_gate_write` too — the
 * orchestrator's sentinel entity_type triggers the `no-active-framework`
 * / `no-trigger-match` branches so Pathway B always short-circuits
 * `applied`. The `makeSupabase` helper now auto-fills that shape when a
 * test-supplied `rpc` handler returns a non-object or an error for
 * `cascade_gate_write` — tests don't have to care about Pathway B.
 *
 * Tests use a hand-rolled Supabase client double. `@smartout/telemetry`
 * is mocked so emits are silent and non-throwing.
 */

import { afterEach, beforeAll, describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { nonEmpty } from "@smartout/telemetry/server";

vi.mock("@smartout/telemetry", () => ({
  emit: vi.fn(async () => undefined),
  nonEmpty: (v: string) => v,
}));

// SS-4: enable the composition orchestrator for the whole test module.
// Without this, `callGateAction` → `gatedMutation` → throws
// `not_implemented:` → adapter maps that to a fail-closed deny, so
// every test that expects `allow:true` would fail. `beforeAll` rather
// than `beforeEach` because process.env is global state and the
// orchestrator reads it lazily on each call.
const ORIGINAL_ORCHESTRATOR_FLAG = process.env.SMARTOUT_COMPOSITION_ORCHESTRATOR_ENABLED;
beforeAll(() => {
  process.env.SMARTOUT_COMPOSITION_ORCHESTRATOR_ENABLED = "true";
});
afterEach(() => {
  // Individual tests may have flipped the flag; restore to on for the
  // next case. Full teardown happens implicitly at process exit.
  process.env.SMARTOUT_COMPOSITION_ORCHESTRATOR_ENABLED = "true";
});
// Leave the original value untouched outside the module — vitest runs
// each file in its own process so this doesn't leak across files.
void ORIGINAL_ORCHESTRATOR_FLAG;

import { publishShift, approveShift, interpretShift, settleShift } from "../tools.js";
import { checkReadiness } from "../../governance/tools.js";
import type { AgentToolContext, SessionChannel } from "../../types.js";

// ── Test Doubles ────────────────────────────────────────────────────

type QueryPlan = {
  result?: { data: unknown; error: unknown };
  update?: { data: unknown; error: unknown };
};

/**
 * Mini builder-style Supabase double. Each from() call is scripted via a
 * per-test table→plan map. The builder returns itself for chained filters
 * and terminates on .maybeSingle()/.limit()/etc using the matching plan.
 */
function makeSupabase(opts: {
  rpc?: (fn: string, args: Record<string, unknown>) => { data: unknown; error: unknown };
  tables?: Record<string, QueryPlan>;
  recordUpdates?: Array<{ table: string; payload: Record<string, unknown> }>;
}): SupabaseClient {
  const tables = opts.tables ?? {};
  const updates = opts.recordUpdates ?? [];

  const builder = (table: string): Record<string, unknown> => {
    const plan = tables[table] ?? {};
    const api: Record<string, unknown> = {};
    let isUpdate = false;
    let updatePayload: Record<string, unknown> | null = null;

    const self = () => api;

    api.select = vi.fn(() => self());
    api.eq = vi.fn(() => self());
    api.order = vi.fn(() => self());
    api.limit = vi.fn(() => self());
    api.in = vi.fn(() => self());
    api.gte = vi.fn(() => self());
    api.lte = vi.fn(() => self());
    api.neq = vi.fn(() => self());
    api.gt = vi.fn(() => self());
    api.lt = vi.fn(() => self());

    // .update() captures the payload and returns a builder whose
    // terminal (await) resolves with plan.update.
    api.update = vi.fn((payload: Record<string, unknown>) => {
      isUpdate = true;
      updatePayload = payload;
      return self();
    });

    api.maybeSingle = vi.fn(async () => plan.result ?? { data: null, error: null });
    api.single = vi.fn(async () => plan.result ?? { data: null, error: null });

    // Support `await query` for update chains — Supabase builder is thenable.
    (api as unknown as { then: (resolve: (v: unknown) => void) => void }).then = (
      resolve: (v: unknown) => void,
    ) => {
      if (isUpdate) {
        if (updatePayload) updates.push({ table, payload: updatePayload });
        resolve(plan.update ?? { data: null, error: null });
      } else {
        resolve(plan.result ?? { data: null, error: null });
      }
    };

    return api;
  };

  // SS-4: orchestrator RPC defaults.
  //
  // `callGateAction` → `gatedMutation` → { rpc("gate_action"),
  // rpc("cascade_gate_write"), from("gate_evaluation").update(...) }.
  // Tests only need to script `gate_action`; Pathway B + stamp default
  // to "allow everything" so the existing legacy assertions hold.
  //
  // If the caller-supplied handler returns `{data: null, error: null}`
  // for an fn, we fall back to the default.
  const DEFAULT_GATE_ACTION = { allow: true, gate_evaluation_id: "gate-eval-a" };
  const DEFAULT_CASCADE_WRITE = {
    allowed: true,
    outcome: "applied",
    reason: "no-active-framework",
    gate_evaluation_id: "gate-eval-b",
  };
  function rpcWithDefaults(
    fn: string,
    args: Record<string, unknown>,
  ): { data: unknown; error: unknown } {
    const supplied = opts.rpc ? opts.rpc(fn, args) : null;
    if (supplied) {
      // If the caller explicitly returned an error, honour it.
      if (supplied.error) return supplied;
      // If the caller returned usable data, honour it.
      if (
        supplied.data !== null &&
        typeof supplied.data === "object" &&
        !Array.isArray(supplied.data)
      ) {
        return supplied;
      }
      // Caller returned {data:null,error:null} — probably "don't care";
      // fall through to the default for this fn.
    }
    if (fn === "gate_action") return { data: DEFAULT_GATE_ACTION, error: null };
    if (fn === "cascade_gate_write") return { data: DEFAULT_CASCADE_WRITE, error: null };
    if (!opts.rpc) return { data: null, error: { message: "not stubbed" } };
    // Unknown fn and caller returned null/null — propagate.
    return supplied ?? { data: null, error: { message: "not stubbed" } };
  }

  return {
    from: vi.fn((table: string) => builder(table)),
    rpc: vi.fn(async (fn: string, args: Record<string, unknown>) => rpcWithDefaults(fn, args)),
  } as unknown as SupabaseClient;
}

function makeCtx(overrides: Partial<AgentToolContext> = {}): AgentToolContext {
  return {
    workspaceId: nonEmpty("ws-1", "workspaceId"),
    profileId: nonEmpty("profile-1", "profileId"),
    sessionId: "sess-1",
    channel: "chat" as SessionChannel,
    supabaseAdmin: {} as SupabaseClient,
    ...overrides,
  };
}

// ── Tests ───────────────────────────────────────────────────────────

// A "ready" protocol_assignment fixture for check_readiness — single
// completed row means ready=true per governance/tools.ts logic.
const READY_PROTOCOL_ROWS = [
  {
    assignment_id: "a1",
    protocol_id: "p1",
    status: "completed",
    completed_at: "2026-04-10T10:00:00Z",
    assigned_at: "2026-04-01T10:00:00Z",
    protocol: { protocol_id: "p1", policy_id: "pol-1" },
  },
];

const UNREADY_PROTOCOL_ROWS = [
  {
    assignment_id: "a1",
    protocol_id: "p1",
    status: "completed",
    completed_at: "2026-04-10T10:00:00Z",
    assigned_at: "2026-04-01T10:00:00Z",
    protocol: { protocol_id: "p1", policy_id: "pol-1" },
  },
  {
    assignment_id: "a2",
    protocol_id: "p2",
    status: "pending",
    completed_at: null,
    assigned_at: "2026-04-14T10:00:00Z",
    protocol: { protocol_id: "p2", policy_id: "pol-2" },
  },
];

const SHIFT_FIXTURE = {
  schedule_shift_id: "11111111-1111-1111-1111-111111111111",
  workspace_id: "ws-1",
  employee_id: "emp-1",
  department_id: "dept-1",
  status: "created",
};

describe("publish_shift", () => {
  beforeEach(() => vi.clearAllMocks());

  it("blocks without mutating when the employee is not ready (readiness_gap)", async () => {
    const updates: Array<{ table: string; payload: Record<string, unknown> }> = [];
    const rpcCalls: string[] = [];
    const supabase = makeSupabase({
      recordUpdates: updates,
      tables: {
        schedule_shift: {
          result: { data: SHIFT_FIXTURE, error: null },
          update: { data: null, error: null },
        },
        profile: {
          result: { data: { profile_id: "emp-1", workspace_id: "ws-1" }, error: null },
        },
        protocol_assignment: {
          result: { data: UNREADY_PROTOCOL_ROWS, error: null },
        },
      },
      rpc: (fn) => {
        rpcCalls.push(fn);
        return { data: null, error: null };
      },
    });

    const result = await publishShift.execute(
      { shift_id: SHIFT_FIXTURE.schedule_shift_id },
      makeCtx({ supabaseAdmin: supabase }),
    );

    // Readiness must block BEFORE gate_action is ever called.
    expect(rpcCalls).not.toContain("gate_action");
    expect(updates).toHaveLength(0);
    const parsed = JSON.parse(result);
    expect(parsed.allowed).toBe(false);
    expect(parsed.reason).toBe("readiness_gap");
    expect(parsed.missing_protocols).toContain("p2");
    expect(parsed.missing_policies).toContain("pol-2");
  });

  it("aborts without mutating when gate_action denies", async () => {
    const updates: Array<{ table: string; payload: Record<string, unknown> }> = [];
    const supabase = makeSupabase({
      recordUpdates: updates,
      tables: {
        schedule_shift: {
          result: { data: SHIFT_FIXTURE, error: null },
          update: { data: null, error: null },
        },
        profile: {
          result: { data: { profile_id: "emp-1", workspace_id: "ws-1" }, error: null },
        },
        protocol_assignment: {
          result: { data: READY_PROTOCOL_ROWS, error: null },
        },
      },
      rpc: (fn) => {
        if (fn === "gate_action") {
          return { data: { allow: false, reason: "role_below_min" }, error: null };
        }
        return { data: null, error: null };
      },
    });

    const result = await publishShift.execute(
      { shift_id: SHIFT_FIXTURE.schedule_shift_id },
      makeCtx({ supabaseAdmin: supabase }),
    );

    expect(supabase.rpc).toHaveBeenCalledWith(
      "gate_action",
      expect.objectContaining({
        p_capability: "shift_lifecycle.publish",
        p_entity_id: SHIFT_FIXTURE.schedule_shift_id,
      }),
    );
    expect(updates).toHaveLength(0);
    expect(result).toContain('"allowed":false');
    expect(result).toContain("role_below_min");
  });

  it("updates schedule_shift to published when ready and gate allows", async () => {
    const updates: Array<{ table: string; payload: Record<string, unknown> }> = [];
    const supabase = makeSupabase({
      recordUpdates: updates,
      tables: {
        schedule_shift: {
          result: { data: SHIFT_FIXTURE, error: null },
          update: { data: null, error: null },
        },
        profile: {
          result: { data: { profile_id: "emp-1", workspace_id: "ws-1" }, error: null },
        },
        protocol_assignment: {
          result: { data: READY_PROTOCOL_ROWS, error: null },
        },
      },
      rpc: (fn) =>
        fn === "gate_action" ? { data: { allow: true }, error: null } : { data: null, error: null },
    });

    const result = await publishShift.execute(
      { shift_id: SHIFT_FIXTURE.schedule_shift_id },
      makeCtx({ supabaseAdmin: supabase }),
    );

    expect(updates.some((u) => u.table === "schedule_shift")).toBe(true);
    const payload = updates.find((u) => u.table === "schedule_shift")?.payload;
    expect(payload?.status).toBe("published");
    expect(payload?.is_published).toBe(true);
    expect(result).toContain('"allowed":true');
  });
});

describe("approve_shift", () => {
  beforeEach(() => vi.clearAllMocks());

  it("blocks without mutating when the employee is not ready (readiness_gap)", async () => {
    const updates: Array<{ table: string; payload: Record<string, unknown> }> = [];
    const rpcCalls: string[] = [];
    const supabase = makeSupabase({
      recordUpdates: updates,
      tables: {
        schedule_shift: {
          result: {
            data: {
              schedule_shift_id: "22222222-2222-2222-2222-222222222222",
              workspace_id: "ws-1",
              employee_id: "emp-1",
              department_id: "dept-1",
              status: "published",
            },
            error: null,
          },
        },
        profile: {
          result: { data: { profile_id: "emp-1", workspace_id: "ws-1" }, error: null },
        },
        protocol_assignment: {
          result: { data: UNREADY_PROTOCOL_ROWS, error: null },
        },
      },
      rpc: (fn) => {
        rpcCalls.push(fn);
        return { data: null, error: null };
      },
    });

    const result = await approveShift.execute(
      {
        shift_id: "22222222-2222-2222-2222-222222222222",
        approved_hours: 8,
      },
      makeCtx({ supabaseAdmin: supabase, channel: "chat" }),
    );

    expect(rpcCalls).not.toContain("gate_action");
    expect(updates).toHaveLength(0);
    const parsed = JSON.parse(result);
    expect(parsed.allowed).toBe(false);
    expect(parsed.reason).toBe("readiness_gap");
    expect(parsed.missing_protocols).toContain("p2");
  });

  it("returns pending-second-approver when gate signals four_eyes_required", async () => {
    const supabase = makeSupabase({
      tables: {
        schedule_shift: {
          result: {
            data: {
              schedule_shift_id: "22222222-2222-2222-2222-222222222222",
              workspace_id: "ws-1",
              employee_id: "emp-1",
              department_id: "dept-1",
              status: "published",
            },
            error: null,
          },
        },
        profile: {
          result: { data: { profile_id: "emp-1", workspace_id: "ws-1" }, error: null },
        },
        protocol_assignment: {
          result: { data: READY_PROTOCOL_ROWS, error: null },
        },
        // approveShift reads the pending shift_approval row before calling
        // mutateWithGate (read-before-gate per tools.ts). Without this entry
        // the function short-circuits with the Norwegian "not found" string
        // before the gate is ever evaluated.
        shift_approval: {
          result: {
            data: {
              approval_id: "approval-22222222",
              status: "pending",
              calculated_hours: 8,
            },
            error: null,
          },
        },
      },
      rpc: (fn) => {
        if (fn === "gate_action") {
          return {
            data: {
              allow: false,
              reason: "four_eyes_required",
              four_eyes_required: true,
              approvers_needed: 2,
              approvers_present: ["profile-1"],
            },
            error: null,
          };
        }
        return { data: null, error: null };
      },
    });

    const result = await approveShift.execute(
      {
        shift_id: "22222222-2222-2222-2222-222222222222",
        approved_hours: 8,
      },
      makeCtx({ supabaseAdmin: supabase, channel: "chat" }),
    );

    const parsed = JSON.parse(result);
    expect(parsed.allowed).toBe(false);
    expect(parsed.four_eyes_pending).toBe(true);
    expect(parsed.reason).toBe("four_eyes_required");
    expect(parsed.approvers_needed).toBe(2);
  });
});

describe("interpret_shift", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls derive_shift_hours and returns the interpretation_id", async () => {
    const interpretationId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const supabase = makeSupabase({
      rpc: (fn) => {
        if (fn === "gate_action") return { data: { allow: true }, error: null };
        if (fn === "derive_shift_hours") {
          // Match jsonb return shape post-20260510100000 migration
          return {
            data: {
              interpretation_id: interpretationId,
              session_date: "2026-04-15",
              department_id: "dept-1",
              workspace_id: "ws-1",
            },
            error: null,
          };
        }
        return { data: null, error: null };
      },
    });

    const result = await interpretShift.execute(
      { shift_id: "33333333-3333-3333-3333-333333333333" },
      makeCtx({ supabaseAdmin: supabase, channel: "system" }),
    );

    expect(supabase.rpc).toHaveBeenCalledWith(
      "derive_shift_hours",
      expect.objectContaining({ p_shift_id: "33333333-3333-3333-3333-333333333333" }),
    );
    const parsed = JSON.parse(result);
    expect(parsed.allowed).toBe(true);
    expect(parsed.interpretation_id).toBe(interpretationId);
  });
});

describe("settle_shift", () => {
  beforeEach(() => vi.clearAllMocks());

  it("is idempotent — returns existing snapshot without calling snapshot_shift_cost", async () => {
    const existingSnapshotId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    let snapshotRpcCalled = false;

    const supabase = makeSupabase({
      tables: {
        shift_hour_interpretation: {
          result: {
            data: { interpretation_id: "interp-1", derivation_version: 3 },
            error: null,
          },
        },
        shift_cost_snapshot: {
          result: { data: { id: existingSnapshotId }, error: null },
        },
      },
      rpc: (fn) => {
        if (fn === "gate_action") return { data: { allow: true }, error: null };
        if (fn === "snapshot_shift_cost") {
          snapshotRpcCalled = true;
          // Match jsonb return shape post-20260510100000 migration
          return {
            data: {
              cost_snapshot_id: "new-snap",
              session_date: "2026-04-15",
              department_id: "dept-1",
              workspace_id: "ws-1",
            },
            error: null,
          };
        }
        return { data: null, error: null };
      },
    });

    const result = await settleShift.execute(
      { shift_id: "44444444-4444-4444-4444-444444444444" },
      makeCtx({ supabaseAdmin: supabase, channel: "system" }),
    );

    const parsed = JSON.parse(result);
    expect(parsed.idempotent).toBe(true);
    expect(parsed.snapshot_id).toBe(existingSnapshotId);
    expect(snapshotRpcCalled).toBe(false);
  });
});

describe("check_readiness", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns missing arrays when assignments are incomplete", async () => {
    const supabase = makeSupabase({
      tables: {
        profile: {
          result: {
            data: { profile_id: "emp-1", workspace_id: "ws-1" },
            error: null,
          },
        },
        protocol_assignment: {
          result: {
            data: [
              {
                assignment_id: "a1",
                protocol_id: "p1",
                status: "completed",
                completed_at: "2026-04-10T10:00:00Z",
                assigned_at: "2026-04-01T10:00:00Z",
                protocol: { protocol_id: "p1", policy_id: "pol-1" },
              },
              {
                assignment_id: "a2",
                protocol_id: "p2",
                status: "pending",
                completed_at: null,
                assigned_at: "2026-04-14T10:00:00Z",
                protocol: { protocol_id: "p2", policy_id: "pol-2" },
              },
              {
                assignment_id: "a3",
                protocol_id: "p3",
                status: "expired",
                completed_at: null,
                assigned_at: "2026-04-13T10:00:00Z",
                protocol: { protocol_id: "p3", policy_id: "pol-1" },
              },
            ],
            error: null,
          },
        },
      },
    });

    const result = await checkReadiness.execute(
      { profile_id: "emp-1" },
      makeCtx({ supabaseAdmin: supabase }),
    );

    const parsed = JSON.parse(result);
    expect(parsed.ready).toBe(false);
    expect(parsed.missing_protocols).toEqual(expect.arrayContaining(["p2", "p3"]));
    expect(parsed.missing_protocols).not.toContain("p1");
    expect(parsed.missing_policies).toEqual(expect.arrayContaining(["pol-1", "pol-2"]));
    expect(parsed.last_attempt_at).toBeTruthy();
  });
});
