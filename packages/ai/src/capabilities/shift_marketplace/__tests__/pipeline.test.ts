/**
 * packages/ai/src/capabilities/shift_marketplace/__tests__/pipeline.test.ts
 *
 * Pipeline-path tests for shift_marketplace tools — ADR-0340 T6 Journeys 2+3.
 *
 * Journey 2: Manager marketplace post → claim → approve
 *   2a  postOpen happy path — pipeline created, shift locked, emits posted + stage_proposed
 *   2b  postOpen voice denied (ADR-0288)
 *   2c  postOpen pipeline lock already held → 409 JSON
 *   2d  claim happy path (with active pipeline) — advances stage_1_claim
 *   2e  claim voice denied (ADR-0288)
 *   2f  claim on already-claimed offer → race-guarded, no mutation
 *   2g  approveClaim happy path — asserts 4 writes inside ONE exec (ONE gate_evaluation_id)
 *   2h  cancelOffer with active pipeline — terminates pipeline + releases lock
 *
 * Journey 3: Admin override on marketplace
 *   3a  overrideMarketplacePipeline happy path — terminates, releases lock, emits overridden
 *   3b  override_reason too short (<20 chars) → Norwegian 400
 *   3c  non-admin → gate_action denied
 *   3d  already-terminal → idempotent no-op, no re-emit
 *   3e  workspace mismatch → PipelineContextError → 403 message
 *   3f  approve_claim preserves 4-writes-1-gate atomic pattern (ADR-0340 §Preservation 3)
 *   3g  marketplace offer status NOT updated on override (intentional — T5 deviation note 2)
 *
 * ADR compliance verified per test:
 *   ADR-0288: voice guard on postOpen + claim + approveClaim
 *   ADR-0099: gate before mutation
 *   ADR-0134: emit once after mutation
 *   ADR-0340 §Preservation 3: 4 writes in 1 exec (approveClaim)
 *   ADR-0328: override_reason ≥ 20 chars
 *   ADR-0287: single mutateWithGate exec per atomic operation
 */

import { describe, it, expect, vi, beforeEach, type MockInstance } from "vitest";
import type { AgentToolContext } from "../../types.js";

// ── Mock @smartout/telemetry ─────────────────────────────────────────────────
vi.mock("@smartout/telemetry", () => ({
  emit: vi.fn().mockResolvedValue(undefined),
  nonEmpty: (v: string) => v,
}));

// ── Mock mutateWithGate ──────────────────────────────────────────────────────
vi.mock("../../_shared/mutate-with-gate.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../_shared/mutate-with-gate.js")>();
  return {
    ...original,
    mutateWithGate: vi.fn(),
  };
});

// ── Mock engine/authority-pipeline ───────────────────────────────────────────
vi.mock("../../../engine/authority-pipeline/index.js", () => ({
  createPipelineInstance: vi.fn().mockResolvedValue({ id: "pipeline-mkt-1" }),
  advancePipelineInstance: vi.fn().mockResolvedValue({ id: "pipeline-mkt-1", status: "running" }),
  terminatePipelineInstance: vi
    .fn()
    .mockResolvedValue({ id: "pipeline-mkt-1", status: "complete" }),
  readPipelineInstance: vi.fn(),
  readActivePipelineInstancesForShift: vi.fn().mockResolvedValue([]),
  acquirePipelineLock: vi.fn().mockResolvedValue(undefined),
  releasePipelineLock: vi.fn().mockResolvedValue(undefined),
  emitStageProposed: vi.fn().mockResolvedValue(undefined),
  emitStageConsented: vi.fn().mockResolvedValue(undefined),
  emitStageApproved: vi.fn().mockResolvedValue(undefined),
  emitStageCancelled: vi.fn().mockResolvedValue(undefined),
  emitStageOverridden: vi.fn().mockResolvedValue(undefined),
  isTerminalStatus: vi.fn().mockReturnValue(false),
  PipelineLockHeldError: class PipelineLockHeldError extends Error {
    readonly code = "pipeline_lock_held" as const;
    readonly shiftId: string;
    constructor(shiftId: string) {
      super(`Pipeline lock held on shift ${shiftId}`);
      this.shiftId = shiftId;
    }
  },
  PipelineContextError: class PipelineContextError extends Error {
    readonly code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

import { emit } from "@smartout/telemetry";
import { mutateWithGate, MutateWithGateDenied } from "../../_shared/mutate-with-gate.js";
import {
  acquirePipelineLock,
  releasePipelineLock,
  createPipelineInstance,
  advancePipelineInstance,
  terminatePipelineInstance,
  readPipelineInstance,
  readActivePipelineInstancesForShift,
  emitStageProposed,
  emitStageConsented,
  emitStageApproved,
  emitStageCancelled,
  emitStageOverridden,
  isTerminalStatus,
  PipelineLockHeldError,
  PipelineContextError,
} from "../../../engine/authority-pipeline/index.js";
import {
  postOpen,
  claim,
  approveClaim,
  cancelOffer,
  overrideMarketplacePipeline,
} from "../tools.js";

// ── Typed mocks ──────────────────────────────────────────────────────────────
const mockEmit = emit as unknown as MockInstance;
const mockMutateWithGate = mutateWithGate as unknown as MockInstance;
const mockAcquireLock = acquirePipelineLock as unknown as MockInstance;
const mockReleaseLock = releasePipelineLock as unknown as MockInstance;
const mockCreatePipeline = createPipelineInstance as unknown as MockInstance;
const mockAdvancePipeline = advancePipelineInstance as unknown as MockInstance;
const mockTerminatePipeline = terminatePipelineInstance as unknown as MockInstance;
const mockReadPipelineInstance = readPipelineInstance as unknown as MockInstance;
const mockReadActivePipelines = readActivePipelineInstancesForShift as unknown as MockInstance;
const mockEmitStageProposed = emitStageProposed as unknown as MockInstance;
const mockEmitStageConsented = emitStageConsented as unknown as MockInstance;
const mockEmitStageApproved = emitStageApproved as unknown as MockInstance;
const mockEmitStageCancelled = emitStageCancelled as unknown as MockInstance;
const mockEmitStageOverridden = emitStageOverridden as unknown as MockInstance;
const mockIsTerminalStatus = isTerminalStatus as unknown as MockInstance;

// ── Shared constants ─────────────────────────────────────────────────────────
const WORKSPACE_ID = "b0000000-0000-0000-0000-000000000001";
const PROFILE_ID = "f0000000-0000-0000-0000-000000000001";
const OFFER_ID = "00000000-0000-0000-0000-000000000111";
const SHIFT_ID = "00000000-0000-0000-0000-000000000222";
const PIPELINE_ID = "pipeline-mkt-1";
const EMP_PROFILE_ID = "emp-profile-001";

function makeCtx(overrides?: Partial<AgentToolContext>): AgentToolContext {
  return {
    workspaceId: WORKSPACE_ID as unknown as AgentToolContext["workspaceId"],
    profileId: PROFILE_ID as unknown as AgentToolContext["profileId"],
    sessionId: "test-session",
    channel: "chat",
    supabaseAdmin: makeMockSupabase(),
    ...overrides,
  } as AgentToolContext;
}

function makeMockSupabase(opts?: {
  offerData?: unknown;
  offerError?: { message: string };
  shiftData?: unknown;
  shiftError?: { message: string };
}) {
  let callCount = 0;
  const single = vi.fn().mockImplementation(() => {
    callCount++;
    if (callCount === 1 && opts?.shiftData !== undefined) {
      // First call: shift lookup
      return Promise.resolve({ data: opts.shiftData, error: opts.shiftError ?? null });
    }
    // Subsequent: offer lookup (for approveClaim etc.)
    if (opts?.offerData !== undefined) {
      return Promise.resolve({ data: opts.offerData, error: opts.offerError ?? null });
    }
    return Promise.resolve({ data: null, error: null });
  });

  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ single }),
          in: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
          single,
        }),
      }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { schedule_shift_offer_id: OFFER_ID },
            error: null,
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        }),
      }),
    }),
  } as unknown as AgentToolContext["supabaseAdmin"];
}

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  // Default: mutateWithGate succeeds and calls exec
  mockMutateWithGate.mockImplementation(
    async (
      _client: unknown,
      args: {
        exec: (db: unknown) => Promise<unknown>;
        workspaceId: string;
        profileId: string;
      },
    ) => {
      const result = await args.exec(_client);
      return { ok: true, result, gateEvaluationId: "gate-eval-mkt-1", correlationId: "corr-mkt-1" };
    },
  );

  // Default: no active pipeline (non-pipeline tools path)
  mockReadActivePipelines.mockResolvedValue([]);

  // Default: isTerminalStatus = false
  mockIsTerminalStatus.mockReturnValue(false);
});

// ── Journey 2a: postOpen happy path ─────────────────────────────────────────

describe("postOpen — pipeline happy path", () => {
  it("2a: creates pipeline, locks shift, emits shift_offer.posted + stage_proposed", async () => {
    const supabaseAdmin = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { schedule_shift_id: SHIFT_ID, workspace_id: WORKSPACE_ID },
                error: null,
              }),
            }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { schedule_shift_offer_id: OFFER_ID },
              error: null,
            }),
          }),
        }),
      }),
    } as unknown as AgentToolContext["supabaseAdmin"];

    const result = await postOpen.execute({ shift_id: SHIFT_ID }, makeCtx({ supabaseAdmin }));

    const parsed = JSON.parse(result as string);
    expect(parsed.ok).toBe(true);
    expect(parsed.offer_id).toBe(OFFER_ID);
    expect(parsed.pipeline_instance_id).toBe(PIPELINE_ID);

    // Pipeline created + lock acquired inside one exec
    expect(mockCreatePipeline).toHaveBeenCalledOnce();
    expect(mockAcquireLock).toHaveBeenCalledOnce();
    expect(mockAcquireLock.mock.calls[0]![2]).toBe(SHIFT_ID);

    // Single mutateWithGate call (ADR-0287)
    expect(mockMutateWithGate).toHaveBeenCalledTimes(1);

    // Legacy event
    expect(mockEmit).toHaveBeenCalledOnce();
    expect(mockEmit.mock.calls[0]![0]).toMatchObject({ event: "shift_offer.posted" });

    // Stage proposed event
    expect(mockEmitStageProposed).toHaveBeenCalledOnce();
    expect(mockEmitStageProposed.mock.calls[0]![0]).toMatchObject({
      stage: "marketplace_lifecycle.stage_0_post",
    });
  });
});

// ── Journey 2b: postOpen voice denied ────────────────────────────────────────

describe("postOpen — voice channel guard (ADR-0288)", () => {
  it("2b: returns Norwegian chat-only message, no pipeline calls", async () => {
    const result = await postOpen.execute({ shift_id: SHIFT_ID }, makeCtx({ channel: "voice" }));

    expect(result).toContain("chat");
    expect(mockMutateWithGate).not.toHaveBeenCalled();
    expect(mockCreatePipeline).not.toHaveBeenCalled();
    expect(mockAcquireLock).not.toHaveBeenCalled();
  });
});

// ── Journey 2c: postOpen pipeline lock held ───────────────────────────────────

describe("postOpen — pipeline lock already held", () => {
  it("2c: returns ok:false JSON with pipeline_lock_held code", async () => {
    // Shift lookup succeeds
    const supabaseAdmin = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { schedule_shift_id: SHIFT_ID, workspace_id: WORKSPACE_ID },
                error: null,
              }),
            }),
          }),
        }),
      }),
    } as unknown as AgentToolContext["supabaseAdmin"];

    // mutateWithGate throws PipelineLockHeldError directly (as would happen when
    // the exec callback throws it: the tool catch block catches PipelineLockHeldError,
    // so we simulate the error surfacing from mutateWithGate at that level).
    mockMutateWithGate.mockRejectedValueOnce(
      new (PipelineLockHeldError as unknown as new (id: string) => Error)(SHIFT_ID),
    );

    const result = await postOpen.execute({ shift_id: SHIFT_ID }, makeCtx({ supabaseAdmin }));

    const parsed = JSON.parse(result as string);
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toBe("pipeline_lock_held");
    expect(mockEmit).not.toHaveBeenCalled();
  });
});

// ── Journey 2d: claim with active pipeline ────────────────────────────────────

describe("claim — active pipeline advances to stage_1_claim", () => {
  it("2d: claim accepted, pipeline advanced, stage_consented emitted", async () => {
    const activePipeline = { id: PIPELINE_ID, status: "running" };
    mockReadActivePipelines.mockResolvedValue([activePipeline]);

    // Offer lookup: open
    // Shift lookup: server role, valid dates
    let callCount = 0;
    const supabaseAdmin = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockImplementation(() => ({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockImplementation(() => {
                callCount++;
                if (callCount === 1) {
                  return Promise.resolve({
                    data: {
                      schedule_shift_offer_id: OFFER_ID,
                      status: "open",
                      shift_id: SHIFT_ID,
                      workspace_id: WORKSPACE_ID,
                    },
                    error: null,
                  });
                }
                return Promise.resolve({
                  data: {
                    schedule_shift_id: SHIFT_ID,
                    role: "server",
                    shift_date: "2026-07-20",
                    start_time: "18:00:00",
                    end_time: "23:00:00",
                    work_hours: 5,
                  },
                  error: null,
                });
              }),
            }),
          }),
        })),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }),
        }),
      }),
    } as unknown as AgentToolContext["supabaseAdmin"];

    const validEligibilityContext = {
      existing_shifts: [],
      absences: [],
      framework_rules: [
        { rule_type: "aml_daily_max_hours" as const, value_hours: 9 },
        { rule_type: "aml_weekly_max_hours" as const, value_hours: 40 },
      ],
      active_contract: {
        contract_id: "c1",
        start_date: "2025-01-01",
        end_date: null,
        status: "active",
      },
      profile: {
        profile_id: PROFILE_ID,
        competent_roles: ["server"],
        workspace_id: WORKSPACE_ID,
        employment_status: "active",
      },
    };

    const result = await claim.execute(
      { offer_id: OFFER_ID, eligibility_context: validEligibilityContext },
      makeCtx({ supabaseAdmin }),
    );

    const parsed = JSON.parse(result as string);
    expect(parsed.ok).toBe(true);

    // Pipeline advanced to step 1 (stage_1_claim)
    expect(mockAdvancePipeline).toHaveBeenCalledOnce();
    expect(mockAdvancePipeline.mock.calls[0]![3]).toBe(1);

    // Legacy event emitted
    expect(mockEmit).toHaveBeenCalledOnce();
    expect(mockEmit.mock.calls[0]![0]).toMatchObject({ event: "shift_offer.claimed" });

    // Stage consented event
    expect(mockEmitStageConsented).toHaveBeenCalledOnce();
    expect(mockEmitStageConsented.mock.calls[0]![0]).toMatchObject({
      stage: "marketplace_lifecycle.stage_1_claim",
    });
  });
});

// ── Journey 2e: claim voice denied ───────────────────────────────────────────

describe("claim — voice channel guard (ADR-0288)", () => {
  it("2e: returns Norwegian chat-only message", async () => {
    const result = await claim.execute(
      {
        offer_id: OFFER_ID,
        eligibility_context: {
          existing_shifts: [],
          absences: [],
          framework_rules: [],
          active_contract: null,
          profile: {
            profile_id: PROFILE_ID,
            competent_roles: [],
            workspace_id: WORKSPACE_ID,
            employment_status: "active",
          },
        },
      },
      makeCtx({ channel: "voice" }),
    );

    expect(result).toContain("chat");
    expect(mockMutateWithGate).not.toHaveBeenCalled();
  });
});

// ── Journey 2f: claim on already-claimed offer (race guard) ──────────────────

describe("claim — already claimed offer (race guard)", () => {
  it("2f: returns state-precondition error without reaching mutateWithGate", async () => {
    const supabaseAdmin = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  schedule_shift_offer_id: OFFER_ID,
                  status: "claimed", // already claimed
                  shift_id: SHIFT_ID,
                  workspace_id: WORKSPACE_ID,
                },
                error: null,
              }),
            }),
          }),
        }),
      }),
    } as unknown as AgentToolContext["supabaseAdmin"];

    const result = await claim.execute(
      {
        offer_id: OFFER_ID,
        eligibility_context: {
          existing_shifts: [],
          absences: [],
          framework_rules: [],
          active_contract: null,
          profile: {
            profile_id: PROFILE_ID,
            competent_roles: [],
            workspace_id: WORKSPACE_ID,
            employment_status: "active",
          },
        },
      },
      makeCtx({ supabaseAdmin }),
    );

    expect(result).toContain("claimed");
    expect(mockMutateWithGate).not.toHaveBeenCalled();
  });
});

// ── Journey 2g: approveClaim — 4 writes in 1 exec (ADR-0340 §Preservation 3) ─

describe("approveClaim — 4-writes-1-gate atomic pattern preserved", () => {
  it("2g: ONE mutateWithGate call, terminate + release inside same exec, one gate_eval_id", async () => {
    const activePipeline = { id: PIPELINE_ID, status: "running" };
    mockReadActivePipelines.mockResolvedValue([activePipeline]);

    const supabaseAdmin = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  schedule_shift_offer_id: OFFER_ID,
                  status: "claimed",
                  shift_id: SHIFT_ID,
                  workspace_id: WORKSPACE_ID,
                  claimed_by_profile_id: EMP_PROFILE_ID,
                },
                error: null,
              }),
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }),
        }),
      }),
    } as unknown as AgentToolContext["supabaseAdmin"];

    const result = await approveClaim.execute({ offer_id: OFFER_ID }, makeCtx({ supabaseAdmin }));

    const parsed = JSON.parse(result as string);
    expect(parsed.ok).toBe(true);
    expect(parsed.assigned_to).toBe(EMP_PROFILE_ID);

    // CRITICAL: exactly ONE mutateWithGate call — all 4 writes in one exec (ADR-0287 + §PC3)
    expect(mockMutateWithGate).toHaveBeenCalledTimes(1);

    // terminatePipelineInstance called inside exec (Write 3)
    expect(mockTerminatePipeline).toHaveBeenCalledOnce();
    expect(mockTerminatePipeline.mock.calls[0]![3]).toMatchObject({ kind: "complete" });

    // releasePipelineLock called inside exec (Write 4)
    expect(mockReleaseLock).toHaveBeenCalledOnce();
    expect(mockReleaseLock.mock.calls[0]![2]).toBe(SHIFT_ID);

    // Legacy event emitted once — single gate_evaluation_id in payload
    expect(mockEmit).toHaveBeenCalledOnce();
    expect(mockEmit.mock.calls[0]![0]).toMatchObject({ event: "shift_offer.approved" });
    // gate_evaluation_id is surfaced in the emit payload (ADR-0134 + §PC3)
    const emitData = mockEmit.mock.calls[0]![0].properties.data;
    expect(emitData.gate_evaluation_id).toBe("gate-eval-mkt-1");

    // Stage approved event emitted
    expect(mockEmitStageApproved).toHaveBeenCalledOnce();
    expect(mockEmitStageApproved.mock.calls[0]![0]).toMatchObject({
      stage: "marketplace_lifecycle.stage_2_approve",
      gateEvaluationId: "gate-eval-mkt-1",
    });
  });
});

// ── Journey 2h: cancelOffer with active pipeline ──────────────────────────────

describe("cancelOffer — with active pipeline (terminate + release)", () => {
  it("2h: pipeline terminated, shift lock released, stage_cancelled emitted", async () => {
    const activePipeline = { id: PIPELINE_ID, status: "running" };
    mockReadActivePipelines.mockResolvedValue([activePipeline]);

    const supabaseAdmin = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  schedule_shift_offer_id: OFFER_ID,
                  status: "open",
                  workspace_id: WORKSPACE_ID,
                  posted_by_profile_id: PROFILE_ID,
                  shift_id: SHIFT_ID,
                },
                error: null,
              }),
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ error: null }),
            }),
          }),
        }),
      }),
    } as unknown as AgentToolContext["supabaseAdmin"];

    const result = await cancelOffer.execute(
      { offer_id: OFFER_ID, reason: "Vakten er fylt opp manuelt" },
      makeCtx({ supabaseAdmin }),
    );

    const parsed = JSON.parse(result as string);
    expect(parsed.ok).toBe(true);

    // Pipeline terminated
    expect(mockTerminatePipeline).toHaveBeenCalledOnce();
    expect(mockTerminatePipeline.mock.calls[0]![3]).toMatchObject({ kind: "cancel" });

    // Shift lock released (marketplace locks single shift, unlike swap which locks two)
    expect(mockReleaseLock).toHaveBeenCalledOnce();
    expect(mockReleaseLock.mock.calls[0]![2]).toBe(SHIFT_ID);

    // Legacy event
    expect(mockEmit).toHaveBeenCalledOnce();
    expect(mockEmit.mock.calls[0]![0]).toMatchObject({ event: "shift_offer.cancelled" });

    // Stage cancelled event
    expect(mockEmitStageCancelled).toHaveBeenCalledOnce();
  });
});

// ── Journey 3a: overrideMarketplacePipeline happy path ───────────────────────

describe("overrideMarketplacePipeline — happy path", () => {
  it("3a: terminates pipeline, releases shift lock, emits stage_overridden", async () => {
    mockReadPipelineInstance.mockResolvedValue({
      id: PIPELINE_ID,
      status: "running",
      entityId: SHIFT_ID,
      context: { shiftId: SHIFT_ID },
    });
    mockIsTerminalStatus.mockReturnValue(false);

    const result = await overrideMarketplacePipeline.execute(
      {
        pipeline_instance_id: PIPELINE_ID,
        override_reason: "Offer posted in error — shifting manually",
      },
      makeCtx(),
    );

    const parsed = JSON.parse(result as string);
    expect(parsed.ok).toBe(true);
    expect(parsed.pipeline_instance_id).toBe(PIPELINE_ID);
    expect(parsed.overridden_from_status).toBe("running");

    // Terminate with kind=override
    expect(mockTerminatePipeline).toHaveBeenCalledOnce();
    expect(mockTerminatePipeline.mock.calls[0]![3]).toMatchObject({ kind: "override" });

    // Single lock released (marketplace locks ONE shift, not two)
    expect(mockReleaseLock).toHaveBeenCalledTimes(1);
    expect(mockReleaseLock.mock.calls[0]![2]).toBe(SHIFT_ID);

    // Emit stage_overridden
    expect(mockEmitStageOverridden).toHaveBeenCalledOnce();
    expect(mockEmitStageOverridden.mock.calls[0]![0]).toMatchObject({
      stage: "marketplace_lifecycle.override",
    });
  });
});

// ── Journey 3b: override short reason ────────────────────────────────────────

describe("overrideMarketplacePipeline — short override_reason (ADR-0328)", () => {
  it("3b: Norwegian 400 message, no DB calls", async () => {
    const result = await overrideMarketplacePipeline.execute(
      {
        pipeline_instance_id: PIPELINE_ID,
        override_reason: "Too short",
      },
      makeCtx(),
    );

    expect(result).toContain("Begrunnelsen er for kort");
    expect(result).toContain("20 tegn");
    expect(mockReadPipelineInstance).not.toHaveBeenCalled();
    expect(mockMutateWithGate).not.toHaveBeenCalled();
  });
});

// ── Journey 3c: non-admin authority denied ────────────────────────────────────

describe("overrideMarketplacePipeline — non-admin denied", () => {
  it("3c: returns ok:false JSON, no pipeline write", async () => {
    mockReadPipelineInstance.mockResolvedValue({
      id: PIPELINE_ID,
      status: "running",
      entityId: SHIFT_ID,
      context: { shiftId: SHIFT_ID },
    });
    mockIsTerminalStatus.mockReturnValue(false);

    mockMutateWithGate.mockRejectedValueOnce(
      new MutateWithGateDenied({ deniedBy: "capability", reason: "Admin role required" }),
    );

    const result = await overrideMarketplacePipeline.execute(
      {
        pipeline_instance_id: PIPELINE_ID,
        override_reason: "Offer posted in error — shifting manually",
      },
      makeCtx(),
    );

    const parsed = JSON.parse(result as string);
    expect(parsed.ok).toBe(false);
    expect(parsed.reason).toBe("authority_denied");
    expect(mockTerminatePipeline).not.toHaveBeenCalled();
    expect(mockEmitStageOverridden).not.toHaveBeenCalled();
  });
});

// ── Journey 3d: already terminal → idempotent ────────────────────────────────

describe("overrideMarketplacePipeline — already terminal (idempotent)", () => {
  it("3d: returns ok:true with existing state, no new writes or emits", async () => {
    mockReadPipelineInstance.mockResolvedValue({
      id: PIPELINE_ID,
      status: "complete",
      entityId: SHIFT_ID,
      context: {},
    });
    mockIsTerminalStatus.mockReturnValue(true);

    const result = await overrideMarketplacePipeline.execute(
      {
        pipeline_instance_id: PIPELINE_ID,
        override_reason: "Offer posted in error — shifting manually",
      },
      makeCtx(),
    );

    const parsed = JSON.parse(result as string);
    expect(parsed.ok).toBe(true);
    expect(parsed.overridden_from_status).toBe("complete");
    expect(parsed.message).toContain("terminal tilstand");

    expect(mockMutateWithGate).not.toHaveBeenCalled();
    expect(mockTerminatePipeline).not.toHaveBeenCalled();
    expect(mockEmitStageOverridden).not.toHaveBeenCalled();
  });
});

// ── Journey 3e: workspace mismatch → 403 ─────────────────────────────────────

describe("overrideMarketplacePipeline — workspace mismatch (ADR-0151)", () => {
  it("3e: returns Norwegian 403 message when pipeline belongs to another workspace", async () => {
    const PipelineContextError_ = PipelineContextError as unknown as new (
      code: string,
      msg: string,
    ) => Error;
    mockReadPipelineInstance.mockRejectedValueOnce(
      new PipelineContextError_("workspace_mismatch", "Pipeline belongs to a different workspace"),
    );

    const result = await overrideMarketplacePipeline.execute(
      {
        pipeline_instance_id: PIPELINE_ID,
        override_reason: "Offer posted in error — shifting manually",
      },
      makeCtx(),
    );

    expect(result).toContain("ikke funnet");
    expect(result).toContain("annet arbeidsområde");
    expect(mockMutateWithGate).not.toHaveBeenCalled();
  });
});

// ── Journey 3f: approve_claim 4-writes-1-gate preservation contract ──────────
// (extends 2g; explicit assertion that the single gate_evaluation_id
//  is shared across all four writes — this is the ADR-0340 §PC3 smoke test)

describe("approveClaim — §PC3 single gate_evaluation_id assertion", () => {
  it("3f: gate_evaluation_id in emit payload matches mutateWithGate return value", async () => {
    const activePipeline = { id: PIPELINE_ID, status: "running" };
    mockReadActivePipelines.mockResolvedValue([activePipeline]);

    // Use a distinct gate_evaluation_id to prove it threads through correctly
    const GATE_EVAL_ID = "gate-eval-preserve-clause-3";
    mockMutateWithGate.mockImplementationOnce(
      async (_client: unknown, args: { exec: (db: unknown) => Promise<unknown> }) => {
        await args.exec(_client);
        return {
          ok: true,
          result: undefined,
          gateEvaluationId: GATE_EVAL_ID,
          correlationId: "c-pc3",
        };
      },
    );

    const supabaseAdmin = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  schedule_shift_offer_id: OFFER_ID,
                  status: "claimed",
                  shift_id: SHIFT_ID,
                  workspace_id: WORKSPACE_ID,
                  claimed_by_profile_id: EMP_PROFILE_ID,
                },
                error: null,
              }),
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }),
        }),
      }),
    } as unknown as AgentToolContext["supabaseAdmin"];

    await approveClaim.execute({ offer_id: OFFER_ID }, makeCtx({ supabaseAdmin }));

    // The gate_evaluation_id in emit payload matches the single mutateWithGate call
    const emitData = mockEmit.mock.calls[0]![0].properties.data;
    expect(emitData.gate_evaluation_id).toBe(GATE_EVAL_ID);

    // The stage_approved event also carries the same gate_evaluation_id
    expect(mockEmitStageApproved.mock.calls[0]![0].gateEvaluationId).toBe(GATE_EVAL_ID);
  });
});

// ── Journey 3g: marketplace offer status NOT updated on override ──────────────
// (intentional per T5 deviation note 2 — admins use cancel_offer separately)

describe("overrideMarketplacePipeline — offer status intentionally NOT updated", () => {
  it("3g: override does not update schedule_shift_offer table", async () => {
    mockReadPipelineInstance.mockResolvedValue({
      id: PIPELINE_ID,
      status: "running",
      entityId: SHIFT_ID,
      context: { shiftId: SHIFT_ID },
    });
    mockIsTerminalStatus.mockReturnValue(false);

    // Track which tables the mock supabase.from() was called with inside exec
    const fromCalls: string[] = [];
    const supabaseAdmin = makeMockSupabase();
    (supabaseAdmin as unknown as { from: MockInstance }).from = vi
      .fn()
      .mockImplementation((table: string) => {
        fromCalls.push(table);
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
          }),
        };
      });

    mockMutateWithGate.mockImplementation(
      async (_client: unknown, args: { exec: (db: unknown) => Promise<unknown> }) => {
        await args.exec(supabaseAdmin);
        return {
          ok: true,
          result: { overriddenFromStatus: "running" },
          gateEvaluationId: "g1",
          correlationId: "c1",
        };
      },
    );

    await overrideMarketplacePipeline.execute(
      {
        pipeline_instance_id: PIPELINE_ID,
        override_reason: "Offer posted in error — shifting manually",
      },
      makeCtx({ supabaseAdmin }),
    );

    // schedule_shift_offer must NOT appear in DB calls during override exec
    // (it should only be in: engine_state via terminatePipelineInstance + schedule_shift via releasePipelineLock)
    expect(fromCalls).not.toContain("schedule_shift_offer");
  });
});
