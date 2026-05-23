/**
 * packages/ai/src/capabilities/routine/__tests__/add-step.test.ts
 *
 * TDD tests for routine.add_step (Task 5b — procedure-engine Phase 1).
 *
 * Test cases:
 *   T1: Happy path — resolves routine→procedure, inserts step at max+1, emits procedure_step.added.
 *   T2: Voice channel guard — rejects voice.
 *   T3: Routine not found → error.
 *   T4: Routine wrong workspace (L-0177) — explicit rejection, no write.
 *   T5: Gate deny → error, no insert.
 *   T6: First step in procedure (max=null) → step_order = 1.
 *   T7: Subsequent step — step_order = max + 1.
 *   T8: Insert failure → surfaces DB error.
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

import { addStepTool } from "../tools.js";
import type { AgentToolContext } from "../../types.js";

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const WORKSPACE_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const PROFILE_ID = "bbbbbbbb-0000-0000-0000-000000000001";
const ROUTINE_ID = "cccccccc-0000-0000-0000-000000000001";
const PROCEDURE_ID = "dddddddd-0000-0000-0000-000000000001";
const STEP_ID = "eeeeeeee-0000-0000-0000-000000000001";

const ROUTINE_ROW = {
  routine_id: ROUTINE_ID,
  workspace_id: WORKSPACE_ID,
  procedure_id: PROCEDURE_ID,
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
  op: "select" | "insert" | "update" | "delete";
  row?: Record<string, unknown>;
};

/**
 * Build a Supabase double for add-step tests.
 *
 * Call sequence (happy path):
 *   1. routine.select(...).eq(routine_id).maybeSingle()
 *   2. procedure_step.select("step_order").eq(procedure_id).order(...).limit(1).maybeSingle()
 *   3. procedure_step.insert({...}).select("step_id").single()
 */
function makeSupabase(opts: {
  routineResult?: { data: Record<string, unknown> | null; error: unknown };
  maxStepOrderResult?: { data: Record<string, unknown> | null; error: unknown };
  insertResult?: { data: Record<string, unknown> | null; error: unknown };
  capturedCalls?: TableCall[];
}): SupabaseClient {
  const capturedCalls = opts.capturedCalls ?? [];
  let procedureStepSelectCall = 0;

  function buildChain(table: string): Record<string, unknown> {
    const chain: Record<string, unknown> = {};

    for (const m of ["eq", "neq", "in", "or", "gte", "lte", "order", "limit", "is", "filter"]) {
      chain[m] = vi.fn(() => chain);
    }

    chain.select = vi.fn(() => chain);

    chain.insert = vi.fn((row: Record<string, unknown>) => {
      capturedCalls.push({ table, op: "insert", row });
      const result = opts.insertResult ?? { data: { step_id: STEP_ID }, error: null };
      return {
        select: () => ({
          single: vi.fn(async () => result),
          maybeSingle: vi.fn(async () => result),
        }),
        single: vi.fn(async () => result),
      };
    });

    chain.update = vi.fn(() => chain);
    chain.delete = vi.fn(() => chain);

    chain.maybeSingle = vi.fn(async () => {
      capturedCalls.push({ table, op: "select" });
      if (table === "routine") {
        return opts.routineResult ?? { data: ROUTINE_ROW, error: null };
      }
      if (table === "procedure_step") {
        procedureStepSelectCall++;
        return (
          opts.maxStepOrderResult ?? {
            data: { step_order: 3 },
            error: null,
          }
        );
      }
      return { data: null, error: null };
    });

    chain.single = vi.fn(async () => ({ data: null, error: { message: "no rows" } }));

    return chain;
  }

  // Suppress unused variable warning.
  void procedureStepSelectCall;

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
  title: "Vask gulv",
  description: "Mop gulvet med rent vann og godkjent rengjøringsmiddel.",
  is_required: true,
};

describe("routine.add_step", () => {
  // ── T1: Happy path ─────────────────────────────────────────────────────────
  it("T1: resolves routine→procedure, inserts step at max+1, emits procedure_step.added", async () => {
    const capturedCalls: TableCall[] = [];
    const supabase = makeSupabase({
      capturedCalls,
      maxStepOrderResult: { data: { step_order: 3 }, error: null },
    });
    const ctx = makeCtx({ supabaseAdmin: supabase });

    const result = await addStepTool.execute(BASE_PARAMS, ctx);

    // Returns success string with step info.
    expect(result).toContain("Vask gulv");
    expect(result).toContain(STEP_ID);
    expect(result).toContain("4"); // max(3) + 1

    // Gate called with correct action.
    expect(gateRoutineActionMock).toHaveBeenCalledTimes(1);
    expect(gateRoutineActionMock).toHaveBeenCalledWith(
      expect.anything(),
      WORKSPACE_ID,
      PROFILE_ID,
      expect.objectContaining({ actionType: "routine.add_step" }),
    );

    // procedure_step.insert with correct columns.
    const insertCall = capturedCalls.find((c) => c.table === "procedure_step" && c.op === "insert");
    expect(insertCall).toBeTruthy();
    expect(insertCall?.row?.procedure_id).toBe(PROCEDURE_ID);
    expect(insertCall?.row?.title).toBe("Vask gulv");
    expect(insertCall?.row?.description).toBe(
      "Mop gulvet med rent vann og godkjent rengjøringsmiddel.",
    );
    expect(insertCall?.row?.step_order).toBe(4);
    expect(insertCall?.row?.is_required).toBe(true);

    // procedure_step.added emitted.
    expect(emitMock).toHaveBeenCalledTimes(1);
    expect(emitMock).toHaveBeenCalledWith(
      expect.objectContaining({ event: "procedure_step.added" }),
    );
    const emitArg = emitMock.mock.calls[0]?.[0] as Record<string, unknown>;
    const data = (emitArg?.properties as Record<string, unknown>)?.data as Record<string, unknown>;
    expect(data?.procedure_id).toBe(PROCEDURE_ID);
    expect(data?.step_order).toBe(4);
    expect(data?.source_routine_id).toBe(ROUTINE_ID);
    expect(data?.title).toBe("Vask gulv");
  });

  // ── T2: Voice channel guard ────────────────────────────────────────────────
  it("T2: rejects voice channel", async () => {
    const ctx = makeCtx({ channel: "voice" });
    const result = await addStepTool.execute(BASE_PARAMS, ctx);
    expect(result).toContain("chat");
    expect(gateRoutineActionMock).not.toHaveBeenCalled();
    expect(emitMock).not.toHaveBeenCalled();
  });

  // ── T3: Routine not found ──────────────────────────────────────────────────
  it("T3: returns error when routine not found", async () => {
    const supabase = makeSupabase({ routineResult: { data: null, error: null } });
    const result = await addStepTool.execute(BASE_PARAMS, makeCtx({ supabaseAdmin: supabase }));
    const parsed = JSON.parse(result) as Record<string, unknown>;
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toBe("routine_not_found");
    expect(gateRoutineActionMock).not.toHaveBeenCalled();
    expect(emitMock).not.toHaveBeenCalled();
  });

  // ── T4: Routine wrong workspace (L-0177) ──────────────────────────────────
  it("T4: rejects cross-workspace routine (L-0177)", async () => {
    const supabase = makeSupabase({
      routineResult: {
        data: {
          routine_id: ROUTINE_ID,
          workspace_id: "ffffffff-ffff-ffff-ffff-ffffffffffff",
          procedure_id: PROCEDURE_ID,
        },
        error: null,
      },
    });
    const result = await addStepTool.execute(BASE_PARAMS, makeCtx({ supabaseAdmin: supabase }));
    const parsed = JSON.parse(result) as Record<string, unknown>;
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toBe("routine_wrong_workspace");
    expect(gateRoutineActionMock).not.toHaveBeenCalled();
    expect(emitMock).not.toHaveBeenCalled();
  });

  // ── T5: Gate deny ──────────────────────────────────────────────────────────
  it("T5: returns error when gate denies", async () => {
    gateRoutineActionMock.mockResolvedValue(GATE_DENY);
    const result = await addStepTool.execute(BASE_PARAMS, makeCtx());
    const parsed = JSON.parse(result) as Record<string, unknown>;
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toBe("role_below_minimum");
    expect(emitMock).not.toHaveBeenCalled();
  });

  // ── T6: First step (no existing steps) ────────────────────────────────────
  it("T6: first step in procedure → step_order = 1", async () => {
    const capturedCalls: TableCall[] = [];
    const supabase = makeSupabase({
      capturedCalls,
      maxStepOrderResult: { data: null, error: null }, // no existing steps
    });
    const ctx = makeCtx({ supabaseAdmin: supabase });

    await addStepTool.execute(BASE_PARAMS, ctx);

    const insertCall = capturedCalls.find((c) => c.table === "procedure_step" && c.op === "insert");
    expect(insertCall?.row?.step_order).toBe(1);
  });

  // ── T7: Subsequent step ────────────────────────────────────────────────────
  it("T7: subsequent step → step_order = max + 1", async () => {
    const capturedCalls: TableCall[] = [];
    const supabase = makeSupabase({
      capturedCalls,
      maxStepOrderResult: { data: { step_order: 7 }, error: null },
    });
    const ctx = makeCtx({ supabaseAdmin: supabase });

    await addStepTool.execute(BASE_PARAMS, ctx);

    const insertCall = capturedCalls.find((c) => c.table === "procedure_step" && c.op === "insert");
    expect(insertCall?.row?.step_order).toBe(8);
  });

  // ── T8: Insert failure ─────────────────────────────────────────────────────
  it("T8: surfaces DB error on insert failure", async () => {
    const supabase = makeSupabase({
      insertResult: { data: null, error: { message: "check_violation" } },
    });
    const result = await addStepTool.execute(BASE_PARAMS, makeCtx({ supabaseAdmin: supabase }));
    const parsed = JSON.parse(result) as Record<string, unknown>;
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toContain("check_violation");
    expect(emitMock).not.toHaveBeenCalled();
  });
});
