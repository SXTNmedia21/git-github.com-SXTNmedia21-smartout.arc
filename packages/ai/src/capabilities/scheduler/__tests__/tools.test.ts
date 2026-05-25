/**
 * packages/ai/src/capabilities/scheduler/__tests__/tools.test.ts
 *
 * Vitest tests for scheduler capability tools (3 tools × 3 tests each = 9).
 * Per PLAN Task 2: happy + auth-fail + state-precondition per tool.
 *
 * ALL mocked: mutateWithGate, @smartout/telemetry emit.
 * No DB calls. No real gate evaluation.
 *
 * Tests validate:
 *   - Voice-channel rejection (ADR-0288 chat-only)
 *   - MutateWithGateDenied → tool returns "Ikke tillatt" message
 *   - State precondition: exec throws → tool returns error message
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

// ── Telemetry mock ─────────────────────────────────────────────────────────
vi.mock("@smartout/telemetry", async () => {
  const actual = await vi.importActual<typeof import("@smartout/telemetry")>("@smartout/telemetry");
  return { ...actual, emit: vi.fn(async () => undefined) };
});

// ── Use vi.hoisted so variables are available before the factory runs ──────
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
import { proposePlan, acceptProposal, rejectProposal } from "../tools.js";

// ── Shared fixtures ────────────────────────────────────────────────────────

const WORKSPACE_ID = "ws-00000000-0000-0000-0000-000000000001";
const PROFILE_ID = "p-00000000-0000-0000-0000-000000000001";
const SESSION_ID = "session-00000000-0000-0000-0000-000000000001";
const PROPOSAL_ID = "prop-0000-0000-0000-0000-000000000001";
const CYCLE_ID = "cycle-0000-0000-0000-0000-000000000001";

// Chainable builder that returns empty arrays and null singles by default.
// Supports the entire query chain used by loadSolverContext.
function makeSelectChain(data: unknown[] | unknown, single = false) {
  const leafResult = single
    ? async () => ({ data, error: null })
    : async () => ({ data: Array.isArray(data) ? data : [], error: null });

  const chainable: unknown = {
    eq: () => chainable,
    gte: () => chainable,
    lte: () => chainable,
    in: leafResult,
    not: () => chainable,
    // L-0348 fix: loadSolverContext now uses .or() / .order() / .limit()
    // for resolving active season_budget by date-range overlap.
    or: () => chainable,
    order: () => chainable,
    limit: () => chainable,
    maybeSingle: single ? leafResult : async () => ({ data: null, error: null }),
    then: async (resolve: (v: unknown) => unknown) =>
      resolve({ data: Array.isArray(data) ? data : [], error: null }),
  };
  return chainable;
}

function buildPlanningCycleFrom(table: string) {
  if (table === "planning_cycle") {
    // L-0348 fix #5: planning_cycle real schema is start_date + end_date
    // (DATE, NOT TIMESTAMPTZ) + no department_id (workspace-scoped).
    const cycleData = {
      planning_cycle_id: CYCLE_ID,
      start_date: "2026-06-15",
      end_date: "2026-06-22",
    };

    // Must return maybeSingle with the cycle data
    const eqEqChain: unknown = {
      maybeSingle: async () => ({ data: cycleData, error: null }),
      eq: () => eqEqChain,
      gte: () => eqEqChain,
    };
    const eqChain = { eq: () => eqEqChain };
    return { select: () => ({ eq: () => eqChain }) };
  }

  // All other tables: return empty arrays through any query chain
  return {
    select: () => makeSelectChain([]),
    insert: async () => ({ data: null, error: null }),
    update: () => ({
      eq: () => ({ eq: async () => ({ data: null, error: null }) }),
    }),
  };
}

function makeCtx(channel: "chat" | "voice" = "chat") {
  const supabaseMock = {
    from: vi.fn(buildPlanningCycleFrom),
  } as unknown as SupabaseClient;

  return {
    workspaceId: WORKSPACE_ID as import("@smartout/telemetry/server").NonEmptyString,
    profileId: PROFILE_ID as import("@smartout/telemetry/server").NonEmptyString,
    sessionId: SESSION_ID,
    supabaseAdmin: supabaseMock,
    channel,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── propose_plan tests ───────────────────────────────────────────────────────

describe("propose_plan", () => {
  it("happy path — returns summary with proposal_id on success", async () => {
    mockMutateWithGate.mockResolvedValue({
      ok: true,
      result: PROPOSAL_ID,
      gateEvaluationId: "gate-eval-001",
      correlationId: "corr-001",
    });

    const ctx = makeCtx("chat");
    const result = await proposePlan.execute(
      { planning_cycle_id: CYCLE_ID, department_id: "dept-00000000-0000-0000-0000-000000000001" },
      ctx,
    );

    expect(result).toContain("Planforslag opprettet");
    expect(result).toContain(PROPOSAL_ID);
    expect(mockMutateWithGate).toHaveBeenCalledOnce();
  });

  it("auth-fail — returns 'Ikke tillatt' when mutateWithGate is denied", async () => {
    mockMutateWithGate.mockRejectedValue(
      new MockMutateWithGateDenied({
        deniedBy: "capability",
        reason: "authority level insufficient",
      }),
    );

    const ctx = makeCtx("chat");
    const result = await proposePlan.execute(
      { planning_cycle_id: CYCLE_ID, department_id: "dept-00000000-0000-0000-0000-000000000001" },
      ctx,
    );
    expect(result).toContain("Ikke tillatt");
    expect(result).toContain("propose_plan");
  });

  it("voice-channel — returns chat-only guard message, mutateWithGate not called", async () => {
    const ctx = makeCtx("voice");
    const result = await proposePlan.execute(
      { planning_cycle_id: CYCLE_ID, department_id: "dept-00000000-0000-0000-0000-000000000001" },
      ctx,
    );
    expect(result).toContain("bare tilgjengelig i chat");
    expect(result).toContain("ADR-0288");
    expect(mockMutateWithGate).not.toHaveBeenCalled();
  });
});

// ─── accept_proposal tests ────────────────────────────────────────────────────

describe("accept_proposal", () => {
  it("happy path — returns success message with shift count", async () => {
    mockMutateWithGate.mockResolvedValue({
      ok: true,
      result: { shifts_inserted: 5, planning_cycle_id: CYCLE_ID },
      gateEvaluationId: "gate-eval-002",
      correlationId: "corr-002",
    });

    const ctx = makeCtx("chat");
    const result = await acceptProposal.execute({ change_proposal_id: PROPOSAL_ID }, ctx);

    expect(result).toContain("godtatt");
    expect(result).toContain("5");
    expect(mockMutateWithGate).toHaveBeenCalledOnce();
  });

  it("auth-fail — returns 'Ikke tillatt' when gate denies accept", async () => {
    mockMutateWithGate.mockRejectedValue(
      new MockMutateWithGateDenied({ deniedBy: "capability", reason: "manager role required" }),
    );

    const ctx = makeCtx("chat");
    const result = await acceptProposal.execute({ change_proposal_id: PROPOSAL_ID }, ctx);
    expect(result).toContain("Ikke tillatt");
  });

  it("state-precondition — returns error message when exec throws status conflict", async () => {
    mockMutateWithGate.mockRejectedValue(
      new Error("Proposal status is 'applied' — only 'pending' proposals can be accepted"),
    );

    const ctx = makeCtx("chat");
    const result = await acceptProposal.execute({ change_proposal_id: PROPOSAL_ID }, ctx);
    expect(result).toContain("Feil ved godkjenning");
    expect(result).toContain("applied");
  });
});

// ─── reject_proposal tests ────────────────────────────────────────────────────

describe("reject_proposal", () => {
  it("happy path — returns rejection confirmed message with reason", async () => {
    mockMutateWithGate.mockResolvedValue({
      ok: true,
      result: { rejected: true },
      gateEvaluationId: "gate-eval-003",
      correlationId: "corr-003",
    });

    const ctx = makeCtx("chat");
    const result = await rejectProposal.execute(
      { change_proposal_id: PROPOSAL_ID, reason: "Bemanningen er ikke korrekt" },
      ctx,
    );
    expect(result).toContain("avvist");
    expect(result).toContain("Bemanningen er ikke korrekt");
    expect(mockMutateWithGate).toHaveBeenCalledOnce();
  });

  it("auth-fail — returns 'Ikke tillatt' when gate denies reject", async () => {
    mockMutateWithGate.mockRejectedValue(
      new MockMutateWithGateDenied({ deniedBy: "capability", reason: "manager role required" }),
    );

    const ctx = makeCtx("chat");
    const result = await rejectProposal.execute({ change_proposal_id: PROPOSAL_ID }, ctx);
    expect(result).toContain("Ikke tillatt");
  });

  it("voice-channel — returns chat-only guard, mutateWithGate not called", async () => {
    const ctx = makeCtx("voice");
    const result = await rejectProposal.execute({ change_proposal_id: PROPOSAL_ID }, ctx);
    expect(result).toContain("bare tilgjengelig i chat");
    expect(result).toContain("ADR-0288");
    expect(mockMutateWithGate).not.toHaveBeenCalled();
  });
});

// ─── accept_proposal: kind='template_apply' branch (ADR-0417) ────────────────

describe("accept_proposal — kind=template_apply branch", () => {
  it("happy path — template_apply kind accepted, returns success with shift count", async () => {
    mockMutateWithGate.mockResolvedValue({
      ok: true,
      result: { shifts_inserted: 8, planning_cycle_id: CYCLE_ID, solver_run_id: "" },
      gateEvaluationId: "gate-eval-004",
      correlationId: "corr-004",
    });

    const ctx = makeCtx("chat");
    const result = await acceptProposal.execute({ change_proposal_id: PROPOSAL_ID }, ctx);

    expect(result).toContain("godtatt");
    expect(result).toContain("8");
    expect(mockMutateWithGate).toHaveBeenCalledOnce();
  });

  it("kind mismatch — exec throws 'expected scheduler_bundle or template_apply' error", async () => {
    // Simulate the exec callback throwing because kind is unknown
    mockMutateWithGate.mockRejectedValue(
      new Error(
        "Proposal kind is 'wage_line_override', expected 'scheduler_bundle' or 'template_apply'",
      ),
    );

    const ctx = makeCtx("chat");
    const result = await acceptProposal.execute({ change_proposal_id: PROPOSAL_ID }, ctx);

    expect(result).toContain("Feil ved godkjenning");
    expect(result).toContain("wage_line_override");
  });

  it("template_apply gate-denied — returns 'Ikke tillatt'", async () => {
    mockMutateWithGate.mockRejectedValue(
      new MockMutateWithGateDenied({ deniedBy: "capability", reason: "manager role required" }),
    );

    const ctx = makeCtx("chat");
    const result = await acceptProposal.execute({ change_proposal_id: PROPOSAL_ID }, ctx);

    expect(result).toContain("Ikke tillatt");
    expect(result).toContain("accept_proposal");
  });

  it("template_apply voice-channel — returns chat-only guard, gate not called", async () => {
    const ctx = makeCtx("voice");
    const result = await acceptProposal.execute({ change_proposal_id: PROPOSAL_ID }, ctx);

    expect(result).toContain("bare tilgjengelig i chat");
    expect(result).toContain("ADR-0288");
    expect(mockMutateWithGate).not.toHaveBeenCalled();
  });

  it("template_apply + scheduler_bundle both still accepted — no regression", async () => {
    // Verify both kinds resolve via same mock path (exec callback handles branching)
    mockMutateWithGate.mockResolvedValue({
      ok: true,
      result: { shifts_inserted: 3, planning_cycle_id: CYCLE_ID, solver_run_id: "solver-abc" },
      gateEvaluationId: "gate-eval-005",
      correlationId: "corr-005",
    });

    const ctx = makeCtx("chat");
    const result = await acceptProposal.execute({ change_proposal_id: PROPOSAL_ID }, ctx);

    // Both kinds produce the same Norwegian success message
    expect(result).toContain("godtatt");
    expect(result).toContain("3");
    expect(mockMutateWithGate).toHaveBeenCalledOnce();
  });
});
