/**
 * packages/ai/src/capabilities/org/__tests__/tools.test.ts
 *
 * Vitest unit-test coverage for the org capability (ADR-0367 BT2).
 *
 * Test cases:
 *   T1: Voice channel guard — update_dept_areas rejects voice.
 *   T2: department not found → error returned, no gate, no emit.
 *   T3: department wrong workspace → error returned, no gate, no emit (L-0177 cross-workspace guard).
 *   T4: Gate deny → error returned, no write, no emit.
 *   T5: Happy path "add" — upsert called, org.dept_areas_updated emitted.
 *   T6: Happy path "remove" — delete called, org.dept_areas_updated emitted.
 *   T7: Upsert error on "add" → error returned, no emit.
 *
 * Mocking strategy:
 *   - @smartout/telemetry: vi.mock → emit = vi.fn(), nonEmpty = identity passthrough.
 *   - gateOrgAction (./gate.ts): vi.mock → default allow; override per test.
 *   - Supabase hand-rolled double (builder pattern matching task/__tests__/tools.test.ts).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

// ─── Mock @smartout/telemetry BEFORE importing tool modules ───────────────────
const emitMock = vi.fn();
vi.mock("@smartout/telemetry", () => ({
  emit: (arg: unknown) => emitMock(arg),
  nonEmpty: (v: string) => v,
}));

// ─── Mock gate helper ─────────────────────────────────────────────────────────
const gateOrgActionMock = vi.fn();
vi.mock("../gate.js", () => ({
  gateOrgAction: (supabase: unknown, workspaceId: string, profileId: string, args: unknown) =>
    gateOrgActionMock(supabase, workspaceId, profileId, args),
}));

import { updateDeptAreas } from "../tools.js";
import type { AgentToolContext } from "../../types.js";

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const WORKSPACE_ID = "aaaaaaaa-0000-0000-0000-000000000002";
const PROFILE_ID = "bbbbbbbb-0000-0000-0000-000000000002";
const DEPT_ID = "cccccccc-0000-0000-0000-000000000002";
const LOCATION_ID = "dddddddd-0000-0000-0000-000000000002";

const DEFAULT_DEPT_ROW = {
  id: DEPT_ID,
  workspace_id: WORKSPACE_ID,
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
  gateEvaluationId: "00000000-0000-0000-0000-000000000002",
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

type UpsertCapture = { table: string; row: Record<string, unknown>; opts?: unknown };
type DeleteCapture = { table: string };

/** Build a minimal chainable Supabase double. */
function makeSupabase(opts: {
  deptResult?: { data: Record<string, unknown> | null; error: unknown };
  upsertError?: { message: string } | null;
  capturedUpserts?: UpsertCapture[];
  capturedDeletes?: DeleteCapture[];
}): SupabaseClient {
  const capturedUpserts = opts.capturedUpserts ?? [];
  const capturedDeletes = opts.capturedDeletes ?? [];

  function buildChain(table: string): Record<string, unknown> {
    const chain: Record<string, unknown> = {};

    for (const m of ["eq", "neq", "in", "or", "gte", "lte", "order", "limit", "is", "filter"]) {
      chain[m] = vi.fn(() => chain);
    }

    chain.select = vi.fn(() => chain);

    chain.upsert = vi.fn((row: Record<string, unknown>, upsertOpts?: unknown) => {
      capturedUpserts.push({ table, row, opts: upsertOpts });
      // Return thennable result
      const result = opts.upsertError
        ? { data: null, error: opts.upsertError }
        : { data: null, error: null };
      return Promise.resolve(result);
    });

    chain.delete = vi.fn(() => {
      capturedDeletes.push({ table });
      return chain;
    });

    chain.insert = vi.fn(() => chain);
    chain.update = vi.fn(() => chain);

    chain.maybeSingle = vi.fn(async () => {
      if (table === "department") {
        return opts.deptResult ?? { data: DEFAULT_DEPT_ROW, error: null };
      }
      return { data: null, error: null };
    });

    chain.single = vi.fn(async () => {
      return { data: null, error: { message: "no rows" } };
    });

    // Thenability — `await supabase.from("x").delete().eq().eq().eq()` resolves void.
    (chain as unknown as { then: (resolve: (v: unknown) => void) => void }).then = (
      resolve: (v: unknown) => void,
    ) => {
      resolve({ data: null, error: null });
    };

    return chain;
  }

  return {
    from: (table: string) => buildChain(table),
    rpc: vi.fn(),
  } as unknown as SupabaseClient;
}

/** Build a minimal AgentToolContext. */
function makeCtx(override?: Partial<AgentToolContext>): AgentToolContext {
  return {
    workspaceId: WORKSPACE_ID as AgentToolContext["workspaceId"],
    profileId: PROFILE_ID as AgentToolContext["profileId"],
    sessionId: "sess-0002",
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
  gateOrgActionMock.mockResolvedValue(GATE_ALLOW);
});

describe("org.update_dept_areas", () => {
  // ── T1: Voice channel guard ────────────────────────────────────────────────
  it("T1: rejects voice channel (ADR-0078 V1 chat-only)", async () => {
    const ctx = makeCtx({ channel: "voice" });
    const result = await updateDeptAreas.execute(
      { department_id: DEPT_ID, location_id: LOCATION_ID, action: "add" },
      ctx,
    );
    expect(result).toContain("chat");
    expect(gateOrgActionMock).not.toHaveBeenCalled();
    expect(emitMock).not.toHaveBeenCalled();
  });

  // ── T2: department not found ───────────────────────────────────────────────
  it("T2: returns error when department not found", async () => {
    const supabase = makeSupabase({ deptResult: { data: null, error: null } });
    const ctx = makeCtx({ supabaseAdmin: supabase });

    const result = await updateDeptAreas.execute(
      { department_id: DEPT_ID, location_id: LOCATION_ID, action: "add" },
      ctx,
    );

    const parsed = JSON.parse(result) as Record<string, unknown>;
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toBe("department_not_found");
    expect(gateOrgActionMock).not.toHaveBeenCalled();
    expect(emitMock).not.toHaveBeenCalled();
  });

  // ── T3: department wrong workspace (L-0177) ────────────────────────────────
  it("T3: returns error when department belongs to a different workspace (L-0177)", async () => {
    const supabase = makeSupabase({
      deptResult: {
        data: { id: DEPT_ID, workspace_id: "ffffffff-ffff-ffff-ffff-ffffffffffff" },
        error: null,
      },
    });
    const ctx = makeCtx({ supabaseAdmin: supabase });

    const result = await updateDeptAreas.execute(
      { department_id: DEPT_ID, location_id: LOCATION_ID, action: "add" },
      ctx,
    );

    const parsed = JSON.parse(result) as Record<string, unknown>;
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toBe("department_wrong_workspace");
    expect(gateOrgActionMock).not.toHaveBeenCalled();
    expect(emitMock).not.toHaveBeenCalled();
  });

  // ── T4: Gate deny ──────────────────────────────────────────────────────────
  it("T4: returns error when gate denies (role below minimum admin)", async () => {
    gateOrgActionMock.mockResolvedValue(GATE_DENY);

    const result = await updateDeptAreas.execute(
      { department_id: DEPT_ID, location_id: LOCATION_ID, action: "add" },
      makeCtx({}),
    );

    const parsed = JSON.parse(result) as Record<string, unknown>;
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toBe("role_below_minimum");
    expect(emitMock).not.toHaveBeenCalled();
  });

  // ── T5: Happy path "add" ───────────────────────────────────────────────────
  it("T5: 'add' calls upsert with ignoreDuplicates and emits org.dept_areas_updated", async () => {
    const capturedUpserts: UpsertCapture[] = [];
    const supabase = makeSupabase({ capturedUpserts });
    const ctx = makeCtx({ supabaseAdmin: supabase });

    const result = await updateDeptAreas.execute(
      { department_id: DEPT_ID, location_id: LOCATION_ID, action: "add" },
      ctx,
    );

    const parsed = JSON.parse(result) as Record<string, unknown>;
    expect(parsed.ok).toBe(true);
    expect(parsed.action).toBe("add");

    // Upsert was called on department_location.
    expect(capturedUpserts).toHaveLength(1);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const firstUpsert = capturedUpserts[0]!;
    expect(firstUpsert.table).toBe("department_location");
    expect(firstUpsert.row).toMatchObject({
      department_id: DEPT_ID,
      location_id: LOCATION_ID,
      workspace_id: WORKSPACE_ID,
    });
    const upsertOpts = firstUpsert.opts as Record<string, unknown>;
    expect(upsertOpts.ignoreDuplicates).toBe(true);

    // Gate fired once.
    expect(gateOrgActionMock).toHaveBeenCalledTimes(1);
    expect(gateOrgActionMock).toHaveBeenCalledWith(
      expect.anything(),
      WORKSPACE_ID,
      PROFILE_ID,
      expect.objectContaining({ actionType: "org.update_dept_areas" }),
    );

    // Emit fired once.
    expect(emitMock).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const emitArg = emitMock.mock.calls[0]![0] as Record<string, unknown>;
    expect(emitArg.event).toBe("org.dept_areas_updated");
    expect((emitArg.properties as Record<string, unknown>).entity).toMatchObject({
      entity_type: "department",
      entity_id: DEPT_ID,
    });
    expect((emitArg.properties as Record<string, unknown>).data).toMatchObject({
      department_id: DEPT_ID,
      location_id: LOCATION_ID,
      action: "add",
    });
  });

  // ── T6: Happy path "remove" ────────────────────────────────────────────────
  it("T6: 'remove' calls delete with workspace scope and emits org.dept_areas_updated", async () => {
    const capturedDeletes: DeleteCapture[] = [];
    const supabase = makeSupabase({ capturedDeletes });
    const ctx = makeCtx({ supabaseAdmin: supabase });

    const result = await updateDeptAreas.execute(
      { department_id: DEPT_ID, location_id: LOCATION_ID, action: "remove" },
      ctx,
    );

    const parsed = JSON.parse(result) as Record<string, unknown>;
    expect(parsed.ok).toBe(true);
    expect(parsed.action).toBe("remove");

    // delete was called on department_location.
    expect(capturedDeletes).toHaveLength(1);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(capturedDeletes[0]!.table).toBe("department_location");

    // Emit fired once.
    expect(emitMock).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const emitArg = emitMock.mock.calls[0]![0] as Record<string, unknown>;
    expect(emitArg.event).toBe("org.dept_areas_updated");
    expect((emitArg.properties as Record<string, unknown>).data).toMatchObject({
      action: "remove",
    });
  });

  // ── T7: Upsert error on "add" ──────────────────────────────────────────────
  it("T7: 'add' upsert DB error → error returned, no emit", async () => {
    const supabase = makeSupabase({
      upsertError: { message: "foreign key violation" },
    });
    const ctx = makeCtx({ supabaseAdmin: supabase });

    const result = await updateDeptAreas.execute(
      { department_id: DEPT_ID, location_id: LOCATION_ID, action: "add" },
      ctx,
    );

    const parsed = JSON.parse(result) as Record<string, unknown>;
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toBe("foreign key violation");
    expect(emitMock).not.toHaveBeenCalled();
  });
});
