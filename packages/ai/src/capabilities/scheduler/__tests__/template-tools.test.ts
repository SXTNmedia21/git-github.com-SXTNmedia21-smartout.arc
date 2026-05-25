/**
 * packages/ai/src/capabilities/scheduler/__tests__/template-tools.test.ts
 *
 * Vitest unit tests for list_week_templates + apply_week_template (tools-template.ts).
 *
 * 7 tests:
 *   1. listWeekTemplates happy — returns 3 past cycles with counts
 *   2. listWeekTemplates empty — "Ingen tidligere uker å bruke som mal"
 *   3. applyWeekTemplate happy — returns proposal_id, mutateWithGate called once
 *   4. applyWeekTemplate voice-channel — chat-only guard returned, gate not called
 *   5. applyWeekTemplate target-not-empty — existing shifts error path
 *   6. applyWeekTemplate gate-denied — "Ikke tillatt" via MutateWithGateDenied
 *   7. applyWeekTemplate source-empty — no source shifts error path
 *
 * All DB calls mocked. No real Supabase. Telemetry mocked.
 * mutateWithGate mocked via vi.mock.
 *
 * ADR-0417 + L-0177 (fail-fast) + L-0247 (single gate) + ADR-0288 (chat-only).
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

// ── Telemetry mock ─────────────────────────────────────────────────────────
vi.mock("@smartout/telemetry", async () => {
  const actual = await vi.importActual<typeof import("@smartout/telemetry")>("@smartout/telemetry");
  return { ...actual, emit: vi.fn(async () => undefined) };
});

// ── mutateWithGate mock (hoisted so available before factory) ─────────────
const { mockMutateWithGate, MockMutateWithGateDenied } = vi.hoisted(() => {
  class MockMutateWithGateDenied extends Error {
    deniedBy: "capability" | "data_rule";
    correlationId: string | undefined = undefined;
    gateEvaluationId: string | undefined = undefined;
    downgradedTo: string | undefined = undefined;
    fourEyesRequired = false;
    approversNeeded: number | undefined = undefined;
    approversPresent: string[] | undefined = undefined;
    proposalId: string | undefined = undefined;

    constructor(opts: { deniedBy: "capability" | "data_rule"; reason: string }) {
      super(opts.reason);
      this.name = "MutateWithGateDenied";
      this.deniedBy = opts.deniedBy;
    }
  }

  return {
    mockMutateWithGate: vi.fn(),
    MockMutateWithGateDenied,
  };
});

vi.mock("../../_shared/mutate-with-gate.js", () => ({
  mutateWithGate: mockMutateWithGate,
  MutateWithGateDenied: MockMutateWithGateDenied,
}));

// Import tools AFTER mocks are configured.
import { listWeekTemplates, applyWeekTemplate } from "../tools-template.js";

// ── Fixtures ───────────────────────────────────────────────────────────────

const WORKSPACE_ID = "ws-00000000-0000-0000-0000-000000000001";
const PROFILE_ID = "p-00000000-0000-0000-0000-000000000001";
const SESSION_ID = "session-00000000-0000-0000-0000-000000000001";
const PROPOSAL_ID = "prop-0000-0000-0000-0000-000000000001";
const DEPT_ID = "dept-0000-0000-0000-0000-000000000001";

const SOURCE_CYCLE_ID = "src-cycle-00-0000-0000-0000-000000000001";
const TARGET_CYCLE_ID = "tgt-cycle-00-0000-0000-0000-000000000001";

function makeCtx(channel: "chat" | "voice" = "chat") {
  return {
    workspaceId: WORKSPACE_ID as import("@smartout/telemetry/server").NonEmptyString,
    profileId: PROFILE_ID as import("@smartout/telemetry/server").NonEmptyString,
    sessionId: SESSION_ID,
    supabaseAdmin: null as unknown as SupabaseClient, // overridden per test
    channel,
  };
}

// ── Chainable Supabase mock builder ───────────────────────────────────────

/**
 * Build a minimal chainable query mock that terminates at common chain ends.
 * `finalResult` is what the last awaitable call resolves to.
 *
 * The chain object supports `.select()`, `.eq()`, `.gte()`, `.lte()`, etc.,
 * all returning itself so chains like `.from("t").select("x").eq("y","z").maybeSingle()`
 * work regardless of depth.
 */
function makeChain(finalResult: unknown) {
  const chain: Record<string, unknown> = {};
  const leaf = async () => finalResult;

  const methods = [
    "select",
    "eq",
    "gte",
    "lte",
    "lt",
    "order",
    "limit",
    "neq",
    "or",
    "not",
    "in",
    "insert",
    "update",
    "delete",
  ];
  for (const m of methods) {
    chain[m] = () => chain;
  }
  chain["maybeSingle"] = leaf;
  chain["single"] = leaf;
  chain["then"] = async (resolve: (v: unknown) => unknown) => resolve(finalResult);

  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── list_week_templates tests ────────────────────────────────────────────────

describe("list_week_templates", () => {
  it("happy — returns list of 3 past cycles with shift counts", async () => {
    const cycles = [
      { planning_cycle_id: "cyc-1", start_date: "2026-06-01", end_date: "2026-06-07" },
      { planning_cycle_id: "cyc-2", start_date: "2026-05-25", end_date: "2026-05-31" },
      { planning_cycle_id: "cyc-3", start_date: "2026-05-18", end_date: "2026-05-24" },
    ];

    // Shift counts returned for each cycle: 5, 3, 7
    let shiftCountCallIndex = 0;
    const shiftCounts = [5, 3, 7];

    const supabaseMock = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "planning_cycle") {
          return makeChain({ data: cycles, error: null });
        }
        if (table === "schedule_shift") {
          const count = shiftCounts[shiftCountCallIndex++ % shiftCounts.length];
          return makeChain({ count, error: null });
        }
        return makeChain({ data: [], error: null });
      }),
    } as unknown as SupabaseClient;

    const ctx = { ...makeCtx("chat"), supabaseAdmin: supabaseMock };
    const result = await listWeekTemplates.execute({ limit: 10 }, ctx);

    expect(result).toContain("maler");
    expect(result).toContain("cyc-1");
    expect(result).toContain("cyc-2");
    expect(result).toContain("cyc-3");
    // Should mention shift counts somewhere
    expect(result).toMatch(/\d+ vakter?/);
  });

  it("empty — returns Norwegian 'ingen maler' message when no archived cycles", async () => {
    const supabaseMock = {
      from: vi.fn().mockReturnValue(makeChain({ data: [], error: null })),
    } as unknown as SupabaseClient;

    const ctx = { ...makeCtx("chat"), supabaseAdmin: supabaseMock };
    const result = await listWeekTemplates.execute({ limit: 10 }, ctx);

    expect(result).toContain("Ingen");
    expect(result.toLowerCase()).toMatch(/mal|arkivert/);
  });
});

// ─── apply_week_template tests ────────────────────────────────────────────────

/**
 * Build a state-tracking Supabase mock for apply_week_template tests.
 *
 * tools-template.ts execution order for apply_week_template:
 *   1. supabase.from("planning_cycle") → maybeSingle → source cycle (L-0177: fail on miss)
 *   2. supabase.from("planning_cycle") → maybeSingle → target cycle (L-0177: fail on miss)
 *   3. supabase.from("schedule_shift") → data array → source shifts (non-head, awaited then)
 *   4. supabase.from("schedule_shift") → count (head: true) → target overlap guard
 *   5. mutateWithGate exec callback: client.from("change_proposal").insert(...)
 *
 * NOTE: In tools-template.ts the actual order is:
 *   1. source cycle load, 2. source status check, 3. target cycle load,
 *   4. span check (same days), 5. source shifts load, 6. target count check,
 *   7. mutateWithGate.
 *
 * The mock routes by tracking how many times each table is called.
 */
function makeApplyMock(options: {
  sourceCycle?: Record<string, unknown> | null;
  targetCycle?: Record<string, unknown> | null;
  sourceShifts?: unknown[];
  targetExistingCount?: number;
}) {
  const {
    sourceCycle = {
      planning_cycle_id: SOURCE_CYCLE_ID,
      start_date: "2026-06-01",
      end_date: "2026-06-07",
      status: "archived",
    },
    targetCycle = {
      planning_cycle_id: TARGET_CYCLE_ID,
      start_date: "2026-06-08",
      end_date: "2026-06-14",
      status: "draft",
    },
    sourceShifts = [
      {
        schedule_shift_id: "shift-001",
        shift_date: "2026-06-01",
        role: "employee",
        start_time: "08:00:00",
        end_time: "16:00:00",
        position_id: null,
        department_id: DEPT_ID,
      },
    ],
    targetExistingCount = 0,
  } = options;

  let planningCycleCallCount = 0;
  let scheduleShiftCallCount = 0;

  const makeMaybeSingleChain = (data: unknown) => {
    const chain: Record<string, unknown> = {};
    const leafSingle = async () => ({ data, error: null });
    const methods = [
      "select",
      "eq",
      "gte",
      "lte",
      "lt",
      "order",
      "limit",
      "neq",
      "or",
      "not",
      "in",
    ];
    for (const m of methods) {
      chain[m] = () => chain;
    }
    chain["maybeSingle"] = leafSingle;
    chain["single"] = leafSingle;
    // Awaiting the chain directly returns a data array shape
    chain["then"] = async (resolve: (v: unknown) => unknown) =>
      resolve({ data: Array.isArray(data) ? data : [], error: null });
    return chain;
  };

  const makeCountChain = (count: number) => {
    const chain: Record<string, unknown> = {};
    const leaf = async () => ({ count, error: null });
    const methods = [
      "select",
      "eq",
      "gte",
      "lte",
      "lt",
      "order",
      "limit",
      "neq",
      "or",
      "not",
      "in",
    ];
    for (const m of methods) {
      chain[m] = () => chain;
    }
    chain["maybeSingle"] = async () => ({ data: null, error: null });
    chain["single"] = async () => ({ data: null, error: null });
    chain["then"] = async (resolve: (v: unknown) => unknown) => resolve({ count, error: null });
    return chain;
  };

  const makeDataChain = (dataArr: unknown[]) => {
    const chain: Record<string, unknown> = {};
    const methods = [
      "select",
      "eq",
      "gte",
      "lte",
      "lt",
      "order",
      "limit",
      "neq",
      "or",
      "not",
      "in",
    ];
    for (const m of methods) {
      chain[m] = () => chain;
    }
    chain["maybeSingle"] = async () => ({ data: null, error: null });
    chain["single"] = async () => ({ data: null, error: null });
    chain["then"] = async (resolve: (v: unknown) => unknown) =>
      resolve({ data: dataArr, error: null });
    return chain;
  };

  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "planning_cycle") {
        planningCycleCallCount++;
        if (planningCycleCallCount === 1) {
          return makeMaybySingleForPlanningCycle(sourceCycle);
        }
        return makeMaybySingleForPlanningCycle(targetCycle);
      }

      if (table === "schedule_shift") {
        scheduleShiftCallCount++;
        // Call 1: source shifts fetch (data array, no head)
        // Call 2: target overlap count (head: true)
        if (scheduleShiftCallCount === 1) {
          return makeDataChain(sourceShifts);
        }
        return makeCountChain(targetExistingCount);
      }

      return makeChain({ data: null, error: null });
    }),
  } as unknown as SupabaseClient;

  function makeMaybySingleForPlanningCycle(data: Record<string, unknown> | null) {
    return makeMaybySingle(data);
  }

  function makeMaybySingle(data: unknown) {
    const chain: Record<string, unknown> = {};
    const leafSingle = async () => ({ data, error: null });
    const methods = [
      "select",
      "eq",
      "gte",
      "lte",
      "lt",
      "order",
      "limit",
      "neq",
      "or",
      "not",
      "in",
    ];
    for (const m of methods) {
      chain[m] = () => chain;
    }
    chain["maybeSingle"] = leafSingle;
    chain["single"] = leafSingle;
    chain["then"] = async (resolve: (v: unknown) => unknown) => resolve({ data, error: null });
    return chain;
  }
}

describe("apply_week_template", () => {
  const baseParams = {
    source_cycle_id: SOURCE_CYCLE_ID,
    target_cycle_id: TARGET_CYCLE_ID,
    department_id: DEPT_ID,
  };

  it("happy — writes change_proposal and returns proposal_id", async () => {
    mockMutateWithGate.mockResolvedValue({
      ok: true,
      result: PROPOSAL_ID,
      gateEvaluationId: "gate-001",
      correlationId: "corr-001",
    });

    const supabaseMock = makeApplyMock({});
    const ctx = { ...makeCtx("chat"), supabaseAdmin: supabaseMock };
    const result = await applyWeekTemplate.execute(baseParams, ctx);

    expect(result).toContain("proposal_id=");
    expect(result).toContain(PROPOSAL_ID);
    expect(mockMutateWithGate).toHaveBeenCalledOnce();
  });

  it("voice-channel — returns chat-only guard, mutateWithGate not called", async () => {
    const ctx = { ...makeCtx("voice"), supabaseAdmin: null as unknown as SupabaseClient };
    const result = await applyWeekTemplate.execute(baseParams, ctx);

    expect(result).toContain("bare tilgjengelig i chat");
    expect(result).toContain("ADR-0288");
    expect(mockMutateWithGate).not.toHaveBeenCalled();
  });

  it("target-not-empty — returns error when department already has shifts in target cycle", async () => {
    // Source shifts present, target overlap count = 3 → error before mutateWithGate
    const supabaseMock = makeApplyMock({ targetExistingCount: 3 });
    const ctx = { ...makeCtx("chat"), supabaseAdmin: supabaseMock };
    const result = await applyWeekTemplate.execute(baseParams, ctx);

    expect(result).toContain("3");
    expect(result.toLowerCase()).toMatch(/eksisterende|allerede|vakter/);
    expect(mockMutateWithGate).not.toHaveBeenCalled();
  });

  it("gate-denied — returns 'Ikke tillatt' when mutateWithGate denies", async () => {
    const supabaseMock = makeApplyMock({});
    mockMutateWithGate.mockRejectedValue(
      new MockMutateWithGateDenied({
        deniedBy: "capability",
        reason: "manager role required",
      }),
    );

    const ctx = { ...makeCtx("chat"), supabaseAdmin: supabaseMock };
    const result = await applyWeekTemplate.execute(baseParams, ctx);

    expect(result).toContain("Ikke tillatt");
    expect(result).toContain("apply_week_template");
  });

  it("source-empty — returns error when source cycle has no shifts for department", async () => {
    // Source shifts = empty array → should fail before mutateWithGate
    const supabaseMock = makeApplyMock({ sourceShifts: [] });
    const ctx = { ...makeCtx("chat"), supabaseAdmin: supabaseMock };
    const result = await applyWeekTemplate.execute(baseParams, ctx);

    expect(result.toLowerCase()).toMatch(/ingen|kilde|vakter|tom/);
    expect(mockMutateWithGate).not.toHaveBeenCalled();
  });
});
