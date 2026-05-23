/**
 * packages/ai/src/capabilities/routine/__tests__/assign-to-location.test.ts
 *
 * TDD tests for routine.assign_to_location (Task 4 + Task 5 hook wiring).
 *
 * Test cases:
 *   T1: Happy path — assigns location_id, replaces routine_team rows, upserts session_hook per dept.
 *   T2: Voice channel guard — rejects voice.
 *   T3: Routine not found → error.
 *   T4: Routine wrong workspace (L-0177) — explicit rejection, no write.
 *   T5: Gate deny → error, no write.
 *   T6: Empty team_ids — deletes existing teams only (location-wide).
 *   T7: Multiple departments at location → hooks upserted for each dept.
 *   T8: No departments at location → 0 hooks, still success (routine updated).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

// ─── Mock @smartout/telemetry BEFORE importing tool modules ───────────────────
const emitMock = vi.fn();
vi.mock("@smartout/telemetry", () => ({
  emit: (arg: unknown) => emitMock(arg),
  nonEmpty: (v: string) => v,
}));

// ─── Mock routine gate helper ─────────────────────────────────────────────────
const gateRoutineActionMock = vi.fn();
vi.mock("../gate.js", () => ({
  gateRoutineAction: (supabase: unknown, workspaceId: string, profileId: string, args: unknown) =>
    gateRoutineActionMock(supabase, workspaceId, profileId, args),
}));

import { assignRoutineToLocation } from "../tools.js";
import type { AgentToolContext } from "../../types.js";

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const WORKSPACE_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const PROFILE_ID = "bbbbbbbb-0000-0000-0000-000000000001";
const ROUTINE_ID = "cccccccc-0000-0000-0000-000000000001";
const LOCATION_ID = "dddddddd-0000-0000-0000-000000000001";
const TEAM_ID_1 = "eeeeeeee-0000-0000-0000-000000000001";
const TEAM_ID_2 = "ffffffff-0000-0000-0000-000000000001";
const DEPT_ID_1 = "11111111-0000-0000-0000-000000000001";
const DEPT_ID_2 = "22222222-0000-0000-0000-000000000001";

const ROUTINE_ROW = {
  routine_id: ROUTINE_ID,
  workspace_id: WORKSPACE_ID,
  trigger_type: "scheduled",
};

const GATE_ALLOW = {
  allow: true,
  reason: null,
  channelAllowed: true,
  downgradeTo: null,
  minRoleRequired: null,
  requiresFourEyes: false,
  approversNeeded: 0,
  approversPresent: [PROFILE_ID],
  gateEvaluationId: "00000000-0000-0000-0000-000000000001",
};

const GATE_DENY = {
  allow: false,
  reason: "role_below_minimum",
  channelAllowed: true,
  downgradeTo: null,
  minRoleRequired: "manager",
  requiresFourEyes: false,
  approversNeeded: 0,
  approversPresent: [],
  gateEvaluationId: null,
};

type TableCall = {
  table: string;
  op: "select" | "insert" | "update" | "delete" | "upsert";
  payload?: unknown;
};

/**
 * Build a Supabase double for assign-to-location tests.
 *
 * Call sequence (happy path):
 *   1. routine.select(...).eq(routine_id).maybeSingle()
 *   2. routine.update({location_id}).eq(routine_id).eq(workspace_id)
 *   3. routine_team.delete().eq(routine_id).eq(workspace_id)
 *   4. routine_team.insert([...teamRows])   [if team_ids non-empty]
 *   5. department_location.select("department_id").eq(location_id).eq(workspace_id)
 *   6. session_hook.upsert(...)             [per department]
 */
function makeSupabase(opts: {
  routineResult?: { data: Record<string, unknown> | null; error: unknown };
  deptLinks?: Array<{ department_id: string }>;
  capturedCalls?: TableCall[];
  upsertError?: unknown;
}): SupabaseClient {
  const capturedCalls = opts.capturedCalls ?? [];
  const deptLinks = opts.deptLinks ?? [{ department_id: DEPT_ID_1 }];

  function buildChain(table: string): Record<string, unknown> {
    const chain: Record<string, unknown> = {};

    for (const m of ["eq", "neq", "in", "or", "gte", "lte", "order", "limit", "is", "filter"]) {
      chain[m] = vi.fn(() => chain);
    }

    chain.select = vi.fn(() => chain);

    chain.insert = vi.fn((payload: unknown) => {
      capturedCalls.push({ table, op: "insert", payload });
      return { error: null };
    });

    chain.update = vi.fn((payload: unknown) => {
      capturedCalls.push({ table, op: "update", payload });
      return chain;
    });

    chain.delete = vi.fn(() => {
      capturedCalls.push({ table, op: "delete" });
      return chain;
    });

    chain.upsert = vi.fn((payload: unknown) => {
      capturedCalls.push({ table, op: "upsert", payload });
      return {
        select: () =>
          Promise.resolve({ data: [{ id: "hook-1" }], error: opts.upsertError ?? null }),
        then: (resolve: (v: { data: unknown; error: unknown }) => unknown) =>
          resolve({ data: [{ id: "hook-1" }], error: opts.upsertError ?? null }),
      };
    });

    chain.maybeSingle = vi.fn(async () => {
      capturedCalls.push({ table, op: "select" });
      if (table === "routine") {
        return opts.routineResult ?? { data: ROUTINE_ROW, error: null };
      }
      if (table === "department_location") {
        return { data: deptLinks, error: null };
      }
      return { data: null, error: null };
    });

    // department_location returns multiple rows — override maybeSingle for that table
    // by making .select() return itself and then simulating an array response via a
    // resolved promise that the tool awaits.
    // We patch by overriding maybeSingle per-table and also handling the chained call.

    chain.single = vi.fn(async () => ({ data: null, error: { message: "no rows" } }));

    // For department_location, the tool does:
    //   .from("department_location").select("department_id").eq(...).eq(...)
    // which returns multiple rows (not maybeSingle). We need to expose a thenable.
    if (table === "department_location") {
      // Override eq to return a thenable that resolves to the dept list.
      chain.eq = vi.fn(() => {
        const eqChain: Record<string, unknown> = {};
        eqChain.eq = vi.fn(() => eqChain);
        // Make the chain itself awaitable.
        const result = { data: deptLinks, error: null };
        Object.assign(eqChain, {
          then: (
            resolve: (v: { data: unknown; error: unknown }) => unknown,
            reject?: (e: unknown) => unknown,
          ) => Promise.resolve(result).then(resolve, reject),
        });
        return eqChain;
      });
    }

    return chain;
  }

  return {
    from: (table: string) => buildChain(table),
    rpc: vi.fn(async () => ({ data: {}, error: null })),
  } as unknown as SupabaseClient;
}

function makeCtx(override?: Partial<AgentToolContext>): AgentToolContext {
  return {
    workspaceId: WORKSPACE_ID as AgentToolContext["workspaceId"],
    profileId: PROFILE_ID as AgentToolContext["profileId"],
    sessionId: "sess-0001",
    supabaseAdmin: makeSupabase({}) as unknown as SupabaseClient,
    channel: "chat",
    ...override,
  } as AgentToolContext;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  gateRoutineActionMock.mockResolvedValue(GATE_ALLOW);
});

const BASE_PARAMS = {
  routine_id: ROUTINE_ID,
  location_id: LOCATION_ID,
  team_ids: [TEAM_ID_1, TEAM_ID_2],
};

describe("routine.assign_to_location", () => {
  // ── T1: Happy path ─────────────────────────────────────────────────────────
  it("T1: assigns location_id, replaces routine_team, upserts session_hook per dept", async () => {
    const capturedCalls: TableCall[] = [];
    const supabase = makeSupabase({
      capturedCalls,
      deptLinks: [{ department_id: DEPT_ID_1 }],
    });
    const ctx = makeCtx({ supabaseAdmin: supabase });

    const result = await assignRoutineToLocation.execute(BASE_PARAMS, ctx);

    // Returns success string.
    expect(result).toContain(ROUTINE_ID);
    expect(result).toContain(LOCATION_ID);
    expect(result).toContain("session_hook");

    // Gate called with correct action.
    expect(gateRoutineActionMock).toHaveBeenCalledTimes(1);
    expect(gateRoutineActionMock).toHaveBeenCalledWith(
      expect.anything(),
      WORKSPACE_ID,
      PROFILE_ID,
      expect.objectContaining({ actionType: "routine.assign_to_location" }),
    );

    // routine.update called with location_id.
    const updateCall = capturedCalls.find((c) => c.table === "routine" && c.op === "update");
    expect(updateCall).toBeTruthy();
    expect((updateCall?.payload as Record<string, unknown>)?.location_id).toBe(LOCATION_ID);

    // routine_team.delete called.
    expect(capturedCalls.some((c) => c.table === "routine_team" && c.op === "delete")).toBe(true);

    // routine_team.insert called with 2 team rows.
    const insertCall = capturedCalls.find((c) => c.table === "routine_team" && c.op === "insert");
    expect(insertCall).toBeTruthy();
    const rows = insertCall?.payload as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(2);
    expect(rows.some((r) => r.team_id === TEAM_ID_1)).toBe(true);
    expect(rows.some((r) => r.team_id === TEAM_ID_2)).toBe(true);

    // session_hook upsert called per department.
    const upsertCall = capturedCalls.find((c) => c.table === "session_hook" && c.op === "upsert");
    expect(upsertCall).toBeTruthy();
    const hookPayload = upsertCall?.payload as Record<string, unknown>;
    expect(hookPayload?.linked_routine_id).toBe(ROUTINE_ID);
    expect(hookPayload?.workspace_id).toBe(WORKSPACE_ID);
    expect(hookPayload?.department_id).toBe(DEPT_ID_1);
    // scheduled trigger → 'scheduled' hook_type.
    expect(hookPayload?.hook_type).toBe("scheduled");

    // routine.assigned_to_location emitted.
    expect(emitMock).toHaveBeenCalledWith(
      expect.objectContaining({ event: "routine.assigned_to_location" }),
    );
    const emitArg = emitMock.mock.calls[0]?.[0] as Record<string, unknown>;
    const data = (emitArg?.properties as Record<string, unknown>)?.data as Record<string, unknown>;
    expect(data?.location_id).toBe(LOCATION_ID);
    expect(data?.team_ids).toEqual([TEAM_ID_1, TEAM_ID_2]);
  });

  // ── T2: Voice channel guard ────────────────────────────────────────────────
  it("T2: rejects voice channel", async () => {
    const ctx = makeCtx({ channel: "voice" });
    const result = await assignRoutineToLocation.execute(BASE_PARAMS, ctx);
    expect(result).toContain("chat");
    expect(gateRoutineActionMock).not.toHaveBeenCalled();
    expect(emitMock).not.toHaveBeenCalled();
  });

  // ── T3: Routine not found ──────────────────────────────────────────────────
  it("T3: returns error when routine not found", async () => {
    const supabase = makeSupabase({ routineResult: { data: null, error: null } });
    const result = await assignRoutineToLocation.execute(
      BASE_PARAMS,
      makeCtx({ supabaseAdmin: supabase }),
    );
    const parsed = JSON.parse(result) as Record<string, unknown>;
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toBe("routine_not_found");
    expect(gateRoutineActionMock).not.toHaveBeenCalled();
    expect(emitMock).not.toHaveBeenCalled();
  });

  // ── T4: Routine wrong workspace (L-0177) ───────────────────────────────────
  it("T4: rejects cross-workspace routine (L-0177)", async () => {
    const supabase = makeSupabase({
      routineResult: {
        data: {
          routine_id: ROUTINE_ID,
          workspace_id: "ffffffff-ffff-ffff-ffff-ffffffffffff",
          trigger_type: "scheduled",
        },
        error: null,
      },
    });
    const result = await assignRoutineToLocation.execute(
      BASE_PARAMS,
      makeCtx({ supabaseAdmin: supabase }),
    );
    const parsed = JSON.parse(result) as Record<string, unknown>;
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toBe("routine_wrong_workspace");
    expect(gateRoutineActionMock).not.toHaveBeenCalled();
    expect(emitMock).not.toHaveBeenCalled();
  });

  // ── T5: Gate deny ──────────────────────────────────────────────────────────
  it("T5: returns error when gate denies", async () => {
    gateRoutineActionMock.mockResolvedValue(GATE_DENY);
    const result = await assignRoutineToLocation.execute(BASE_PARAMS, makeCtx());
    const parsed = JSON.parse(result) as Record<string, unknown>;
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toBe("role_below_minimum");
    expect(emitMock).not.toHaveBeenCalled();
  });

  // ── T6: Empty team_ids — location-wide ────────────────────────────────────
  it("T6: empty team_ids — deletes existing teams only, still assigns location", async () => {
    const capturedCalls: TableCall[] = [];
    const supabase = makeSupabase({
      capturedCalls,
      deptLinks: [{ department_id: DEPT_ID_1 }],
    });
    const ctx = makeCtx({ supabaseAdmin: supabase });

    const result = await assignRoutineToLocation.execute({ ...BASE_PARAMS, team_ids: [] }, ctx);

    expect(result).toContain("alle team");

    // routine_team.delete called (cleanup).
    expect(capturedCalls.some((c) => c.table === "routine_team" && c.op === "delete")).toBe(true);
    // routine_team.insert NOT called (empty teams).
    expect(capturedCalls.some((c) => c.table === "routine_team" && c.op === "insert")).toBe(false);

    // Emit fires.
    expect(emitMock).toHaveBeenCalledWith(
      expect.objectContaining({ event: "routine.assigned_to_location" }),
    );
  });

  // ── T7: Multiple departments at location ───────────────────────────────────
  it("T7: upserts one session_hook per department when multiple depts at location", async () => {
    const capturedCalls: TableCall[] = [];
    const supabase = makeSupabase({
      capturedCalls,
      deptLinks: [{ department_id: DEPT_ID_1 }, { department_id: DEPT_ID_2 }],
    });
    const ctx = makeCtx({ supabaseAdmin: supabase });

    const result = await assignRoutineToLocation.execute({ ...BASE_PARAMS, team_ids: [] }, ctx);

    // 2 session_hook upserts.
    const upsertCalls = capturedCalls.filter(
      (c) => c.table === "session_hook" && c.op === "upsert",
    );
    expect(upsertCalls).toHaveLength(2);

    const deptIds = upsertCalls.map((c) => (c.payload as Record<string, unknown>).department_id);
    expect(deptIds).toContain(DEPT_ID_1);
    expect(deptIds).toContain(DEPT_ID_2);

    // Emit shows hooks_upserted = 2.
    const emitArg = emitMock.mock.calls[0]?.[0] as Record<string, unknown>;
    const data = (emitArg?.properties as Record<string, unknown>)?.data as Record<string, unknown>;
    expect(data?.hooks_upserted).toBe(2);

    expect(result).toContain("2 session_hook");
  });

  // ── T8: No departments at location ────────────────────────────────────────
  it("T8: 0 departments at location — 0 hooks upserted, still success", async () => {
    const capturedCalls: TableCall[] = [];
    const supabase = makeSupabase({
      capturedCalls,
      deptLinks: [],
    });
    const ctx = makeCtx({ supabaseAdmin: supabase });

    const result = await assignRoutineToLocation.execute({ ...BASE_PARAMS, team_ids: [] }, ctx);

    // No session_hook upserts.
    expect(capturedCalls.some((c) => c.table === "session_hook" && c.op === "upsert")).toBe(false);

    expect(result).toContain("0 session_hook");

    const emitArg = emitMock.mock.calls[0]?.[0] as Record<string, unknown>;
    const data = (emitArg?.properties as Record<string, unknown>)?.data as Record<string, unknown>;
    expect(data?.hooks_upserted).toBe(0);
  });
});
