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
 * Tests use a hand-rolled Supabase client double. `@smartout/telemetry`
 * is mocked so emits are silent and non-throwing.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@smartout/telemetry", () => ({
  emit: vi.fn(async () => undefined),
}));

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

  return {
    from: vi.fn((table: string) => builder(table)),
    rpc: vi.fn(async (fn: string, args: Record<string, unknown>) =>
      opts.rpc ? opts.rpc(fn, args) : { data: null, error: { message: "not stubbed" } },
    ),
  } as unknown as SupabaseClient;
}

function makeCtx(overrides: Partial<AgentToolContext> = {}): AgentToolContext {
  return {
    workspaceId: "ws-1",
    profileId: "profile-1",
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
      },
      rpc: (fn) => {
        if (fn === "gate_action") {
          return {
            data: {
              allow: false,
              reason: "four_eyes_required",
              requires_four_eyes: true,
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
