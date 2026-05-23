/**
 * packages/ai/src/capabilities/routine/__tests__/create.test.ts
 *
 * TDD tests for routine.create (Task 3 — procedure-engine Phase 1).
 *
 * Test cases:
 *   T1: Happy path — inserts routine bound to procedure + protocol, emits routine.created.
 *   T2: Voice channel guard — rejects voice.
 *   T3: Gate deny — returns error, no insert.
 *   T4: Procedure not found → error, no insert.
 *   T5: Procedure wrong workspace (L-0177) → explicit error, no insert.
 *   T6: Protocol not found → error, no insert.
 *   T7: Protocol wrong workspace (L-0177) → explicit error, no insert.
 *   T8: Insert failure → surfaces DB error message.
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

import { createRoutineTool } from "../tools.js";
import type { AgentToolContext } from "../../types.js";

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const WORKSPACE_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const PROFILE_ID = "bbbbbbbb-0000-0000-0000-000000000001";
const PROCEDURE_ID = "cccccccc-0000-0000-0000-000000000001";
const PROTOCOL_ID = "dddddddd-0000-0000-0000-000000000001";
const ROUTINE_ID = "eeeeeeee-0000-0000-0000-000000000001";

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
  minRoleRequired: "admin",
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
 * Build a minimal Supabase double for create tests.
 *
 * Call sequence (happy path):
 *   1. procedure.select(...).eq(procedure_id).eq(workspace_id?).maybeSingle()
 *   2. protocol.select(...).eq(protocol_id).maybeSingle()
 *   3. routine.insert(...).select("routine_id").single()
 */
function makeSupabase(opts: {
  procedureResult?: { data: Record<string, unknown> | null; error: unknown };
  protocolResult?: { data: Record<string, unknown> | null; error: unknown };
  insertResult?: { data: Record<string, unknown> | null; error: unknown };
  capturedCalls?: TableCall[];
}): SupabaseClient {
  const capturedCalls = opts.capturedCalls ?? [];

  function buildChain(table: string): Record<string, unknown> {
    const chain: Record<string, unknown> = {};

    for (const m of ["eq", "neq", "in", "or", "gte", "lte", "order", "limit", "is", "filter"]) {
      chain[m] = vi.fn(() => chain);
    }

    chain.select = vi.fn(() => chain);

    chain.insert = vi.fn((row: Record<string, unknown>) => {
      capturedCalls.push({ table, op: "insert", row });
      const result = opts.insertResult ?? { data: { routine_id: ROUTINE_ID }, error: null };
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
      if (table === "procedure") {
        return (
          opts.procedureResult ?? {
            data: { procedure_id: PROCEDURE_ID, workspace_id: WORKSPACE_ID },
            error: null,
          }
        );
      }
      if (table === "protocol") {
        return (
          opts.protocolResult ?? {
            data: { protocol_id: PROTOCOL_ID, workspace_id: WORKSPACE_ID },
            error: null,
          }
        );
      }
      return { data: null, error: null };
    });

    chain.single = vi.fn(async () => ({ data: null, error: { message: "no rows" } }));

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
  name: "Stenge-rutine",
  procedure_id: PROCEDURE_ID,
  protocol_id: PROTOCOL_ID,
  trigger_type: "scheduled" as const,
  trigger_config: { times: ["23:30"], days: ["mon", "tue", "wed", "thu", "fri"] },
  // executor_type is optional with default "human" in the Zod schema, but TypeScript
  // infers the execute() parameter type from z.infer<> which requires default fields.
  executor_type: "human" as const,
};

describe("routine.create", () => {
  // ── T1: Happy path ─────────────────────────────────────────────────────────
  it("T1: inserts routine bound to procedure + protocol, emits routine.created", async () => {
    const capturedCalls: TableCall[] = [];
    const supabase = makeSupabase({ capturedCalls });
    const ctx = makeCtx({ supabaseAdmin: supabase });

    const result = await createRoutineTool.execute(BASE_PARAMS, ctx);

    // Returns success string mentioning the routine name.
    expect(result).toContain("Stenge-rutine");
    expect(result).toContain(ROUTINE_ID);

    // Gate called once.
    expect(gateRoutineActionMock).toHaveBeenCalledTimes(1);
    expect(gateRoutineActionMock).toHaveBeenCalledWith(
      expect.anything(),
      WORKSPACE_ID,
      PROFILE_ID,
      expect.objectContaining({ actionType: "routine.create" }),
    );

    // routine.insert was called.
    const insertCall = capturedCalls.find((c) => c.table === "routine" && c.op === "insert");
    expect(insertCall).toBeTruthy();
    expect(insertCall?.row?.name).toBe("Stenge-rutine");
    expect(insertCall?.row?.procedure_id).toBe(PROCEDURE_ID);
    expect(insertCall?.row?.protocol_id).toBe(PROTOCOL_ID);
    expect(insertCall?.row?.trigger_type).toBe("scheduled");
    expect(insertCall?.row?.executor_type).toBe("human"); // default

    // routine.created emitted once with correct shape.
    expect(emitMock).toHaveBeenCalledTimes(1);
    expect(emitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "routine.created",
        workspace_id: WORKSPACE_ID,
        actor_id: PROFILE_ID,
      }),
    );
    const emitArg = emitMock.mock.calls[0]?.[0] as Record<string, unknown>;
    const data = (emitArg?.properties as Record<string, unknown>)?.data as Record<string, unknown>;
    expect(data?.routine_id).toBe(ROUTINE_ID);
    expect(data?.name).toBe("Stenge-rutine");
    expect(data?.executor_type).toBe("human");
  });

  // ── T2: Voice channel guard ────────────────────────────────────────────────
  it("T2: rejects voice channel", async () => {
    const ctx = makeCtx({ channel: "voice" });
    const result = await createRoutineTool.execute(BASE_PARAMS, ctx);
    expect(result).toContain("chat");
    expect(gateRoutineActionMock).not.toHaveBeenCalled();
    expect(emitMock).not.toHaveBeenCalled();
  });

  // ── T3: Gate deny ──────────────────────────────────────────────────────────
  it("T3: returns error when gate denies", async () => {
    gateRoutineActionMock.mockResolvedValue(GATE_DENY);
    const result = await createRoutineTool.execute(BASE_PARAMS, makeCtx());
    const parsed = JSON.parse(result) as Record<string, unknown>;
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toBe("role_below_minimum");
    expect(emitMock).not.toHaveBeenCalled();
  });

  // ── T4: Procedure not found ────────────────────────────────────────────────
  it("T4: returns error when procedure not found", async () => {
    const supabase = makeSupabase({ procedureResult: { data: null, error: null } });
    const result = await createRoutineTool.execute(
      BASE_PARAMS,
      makeCtx({ supabaseAdmin: supabase }),
    );
    const parsed = JSON.parse(result) as Record<string, unknown>;
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toBe("procedure_not_found");
    expect(emitMock).not.toHaveBeenCalled();
  });

  // ── T5: Procedure wrong workspace (L-0177) ────────────────────────────────
  it("T5: returns error when procedure belongs to different workspace (L-0177)", async () => {
    const supabase = makeSupabase({
      procedureResult: {
        data: { procedure_id: PROCEDURE_ID, workspace_id: "ffffffff-ffff-ffff-ffff-ffffffffffff" },
        error: null,
      },
    });
    const result = await createRoutineTool.execute(
      BASE_PARAMS,
      makeCtx({ supabaseAdmin: supabase }),
    );
    const parsed = JSON.parse(result) as Record<string, unknown>;
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toBe("procedure_wrong_workspace");
    expect(emitMock).not.toHaveBeenCalled();
  });

  // ── T6: Protocol not found ─────────────────────────────────────────────────
  it("T6: returns error when protocol not found", async () => {
    const supabase = makeSupabase({ protocolResult: { data: null, error: null } });
    const result = await createRoutineTool.execute(
      BASE_PARAMS,
      makeCtx({ supabaseAdmin: supabase }),
    );
    const parsed = JSON.parse(result) as Record<string, unknown>;
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toBe("protocol_not_found");
    expect(emitMock).not.toHaveBeenCalled();
  });

  // ── T7: Protocol wrong workspace (L-0177) ─────────────────────────────────
  it("T7: returns error when protocol belongs to different workspace (L-0177)", async () => {
    const supabase = makeSupabase({
      protocolResult: {
        data: { protocol_id: PROTOCOL_ID, workspace_id: "ffffffff-ffff-ffff-ffff-ffffffffffff" },
        error: null,
      },
    });
    const result = await createRoutineTool.execute(
      BASE_PARAMS,
      makeCtx({ supabaseAdmin: supabase }),
    );
    const parsed = JSON.parse(result) as Record<string, unknown>;
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toBe("protocol_wrong_workspace");
    expect(emitMock).not.toHaveBeenCalled();
  });

  // ── T8: Insert failure ─────────────────────────────────────────────────────
  it("T8: surfaces DB error message on insert failure", async () => {
    const supabase = makeSupabase({
      insertResult: { data: null, error: { message: "unique_violation" } },
    });
    const result = await createRoutineTool.execute(
      BASE_PARAMS,
      makeCtx({ supabaseAdmin: supabase }),
    );
    const parsed = JSON.parse(result) as Record<string, unknown>;
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toContain("unique_violation");
    expect(emitMock).not.toHaveBeenCalled();
  });
});
