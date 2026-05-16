/**
 * packages/ai/src/capabilities/shift-swap/__tests__/pipeline.test.ts
 *
 * Pipeline-path tests for shift-swap tools — ADR-0340 T6 Journey 1.
 *
 * These tests activate the pipeline helpers (unlike the baseline tools.test.ts
 * which mocks readActivePipelineInstancesForShift to return []).
 *
 * Journeys covered:
 *   1a  requestSwap happy path — pipeline created, both shifts locked, one gate_eval_id
 *   1b  requestSwap voice channel denied (ADR-0288)
 *   1c  requestSwap gate_action denied — no pipeline created
 *   1d  requestSwap eligibility-fail simulation via PipelineLockHeldError (lock held)
 *   1e  respondToSwap accept — advances to stage_1_consent
 *   1f  cancelSwap — terminates pipeline, releases both locks
 *   1g  override_swap_pipeline happy path — terminates, releases both locks, emits overridden
 *   1h  override_swap_pipeline short reason (<20 chars) → Norwegian 400
 *   1i  override_swap_pipeline non-admin → gate_action denied
 *   1j  override_swap_pipeline already-terminal → idempotent no-op (no re-emit)
 *   1k  override_swap_pipeline workspace mismatch → PipelineContextError → 403 message
 *
 * ADR compliance verified per test:
 *   ADR-0288: voice channel guard
 *   ADR-0099: gate_action before mutation
 *   ADR-0134: emit() called once after successful mutation
 *   ADR-0340 §Q-lock-both: both locks released on cancel + override
 *   ADR-0328: override_reason ≥ 20 chars
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

// ── Mock ./gate.js (callGateAction) ─────────────────────────────────────────
vi.mock("../gate.js", () => ({
  callGateAction: vi.fn(),
}));

// ── Mock engine/authority-pipeline ───────────────────────────────────────────
vi.mock("../../../engine/authority-pipeline/index.js", () => ({
  createPipelineInstance: vi.fn().mockResolvedValue({ id: "pipeline-swap-1" }),
  advancePipelineInstance: vi.fn().mockResolvedValue({ id: "pipeline-swap-1", status: "running" }),
  terminatePipelineInstance: vi
    .fn()
    .mockResolvedValue({ id: "pipeline-swap-1", status: "cancelled" }),
  readPipelineInstance: vi.fn(),
  readActivePipelineInstancesForShift: vi.fn().mockResolvedValue([]),
  acquirePipelineLock: vi.fn().mockResolvedValue(undefined),
  releasePipelineLock: vi.fn().mockResolvedValue(undefined),
  emitStageProposed: vi.fn().mockResolvedValue(undefined),
  emitStageConsented: vi.fn().mockResolvedValue(undefined),
  emitStageApproved: vi.fn().mockResolvedValue(undefined),
  emitStageRejected: vi.fn().mockResolvedValue(undefined),
  emitStageCancelled: vi.fn().mockResolvedValue(undefined),
  emitStageOverridden: vi.fn().mockResolvedValue(undefined),
  isTerminalStatus: vi.fn().mockReturnValue(false),
  PIPELINE_PROCESS_IDS: ["shift_swap_lifecycle"],
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
import { callGateAction } from "../gate.js";
import {
  acquirePipelineLock,
  releasePipelineLock,
  createPipelineInstance,
  advancePipelineInstance,
  terminatePipelineInstance,
  readPipelineInstance,
  emitStageProposed,
  emitStageConsented,
  emitStageCancelled,
  emitStageOverridden,
  isTerminalStatus,
  PipelineLockHeldError,
  PipelineContextError,
} from "../../../engine/authority-pipeline/index.js";
import { requestSwap, respondToSwap, cancelSwap, overrideSwapPipeline } from "../tools.js";

// ── Typed mocks ──────────────────────────────────────────────────────────────
const mockEmit = emit as unknown as MockInstance;
const mockMutateWithGate = mutateWithGate as unknown as MockInstance;
const mockCallGateAction = callGateAction as unknown as MockInstance;
const mockAcquireLock = acquirePipelineLock as unknown as MockInstance;
const mockReleaseLock = releasePipelineLock as unknown as MockInstance;
const mockCreatePipeline = createPipelineInstance as unknown as MockInstance;
const mockAdvancePipeline = advancePipelineInstance as unknown as MockInstance;
const mockTerminatePipeline = terminatePipelineInstance as unknown as MockInstance;
const mockReadPipelineInstance = readPipelineInstance as unknown as MockInstance;
const mockEmitStageProposed = emitStageProposed as unknown as MockInstance;
const mockEmitStageConsented = emitStageConsented as unknown as MockInstance;
const mockEmitStageCancelled = emitStageCancelled as unknown as MockInstance;
const mockEmitStageOverridden = emitStageOverridden as unknown as MockInstance;
const mockIsTerminalStatus = isTerminalStatus as unknown as MockInstance;

// ── Shared constants ─────────────────────────────────────────────────────────
const WORKSPACE_ID = "b0000000-0000-0000-0000-000000000001";
const PROFILE_ID = "f0000000-0000-0000-0000-000000000001";
const REQUESTER_SHIFT_ID = "11110000-0000-0000-0000-000000000001";
const TARGET_SHIFT_ID = "22220000-0000-0000-0000-000000000002";
const TARGET_PROFILE_ID = "f0000000-0000-0000-0000-000000000099";
const SWAP_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const PIPELINE_ID = "pipeline-swap-1";

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

function makeMockSupabase() {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    }),
    rpc: vi.fn().mockResolvedValue({ data: SWAP_ID, error: null }),
  } as unknown as AgentToolContext["supabaseAdmin"];
}

const ALLOW_GATE = {
  allow: true,
  reason: null,
  channelAllowed: true,
  downgradeTo: null,
  minRoleRequired: null,
  requiresFourEyes: false,
  approversNeeded: 0,
  approversPresent: [PROFILE_ID],
  gateEvaluationId: "gate-eval-swap-1",
};

const DENY_GATE = {
  allow: false,
  reason: "Role employee required",
  channelAllowed: true,
  downgradeTo: null,
  minRoleRequired: "employee",
  requiresFourEyes: false,
  approversNeeded: 0,
  approversPresent: [],
  gateEvaluationId: null,
};

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  // Default: gate allows
  mockCallGateAction.mockResolvedValue(ALLOW_GATE);

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
      return {
        ok: true,
        result,
        gateEvaluationId: "gate-eval-swap-1",
        correlationId: "corr-swap-1",
      };
    },
  );

  // Default: isTerminalStatus = false (pipeline is active)
  mockIsTerminalStatus.mockReturnValue(false);
});

// ── Journey 1a: requestSwap happy path ──────────────────────────────────────

describe("requestSwap — pipeline happy path", () => {
  it("1a: creates pipeline, locks both shifts, emits shift_swap.requested + stage_proposed", async () => {
    const result = await requestSwap.execute(
      {
        requester_shift_id: REQUESTER_SHIFT_ID,
        target_profile_id: TARGET_PROFILE_ID,
        target_shift_id: TARGET_SHIFT_ID,
        reason: "Need to attend an event",
      },
      makeCtx(),
    );

    const parsed = JSON.parse(result as string);
    expect(parsed.success).toBe(true);
    expect(parsed.swap_id).toBe(SWAP_ID);
    expect(parsed.pipeline_instance_id).toBe(PIPELINE_ID);

    // Gate was called before mutation
    expect(mockCallGateAction).toHaveBeenCalledOnce();

    // mutateWithGate was called (contains pipeline + lock + rpc)
    expect(mockMutateWithGate).toHaveBeenCalledOnce();
    const mutArgs = mockMutateWithGate.mock.calls[0]![1];
    expect(mutArgs.workspaceId).toBe(WORKSPACE_ID);
    expect(mutArgs.profileId).toBe(PROFILE_ID);

    // Pipeline created inside exec (indirectly: createPipelineInstance called)
    expect(mockCreatePipeline).toHaveBeenCalledOnce();

    // Both shifts locked inside the same exec (ADR-0340 §Q-lock-both)
    expect(mockAcquireLock).toHaveBeenCalledTimes(2);
    const lockCalls = mockAcquireLock.mock.calls;
    const lockedShifts = lockCalls.map((c: unknown[]) => (c as unknown[])[2]);
    expect(lockedShifts).toContain(REQUESTER_SHIFT_ID);
    expect(lockedShifts).toContain(TARGET_SHIFT_ID);

    // Legacy event emitted
    expect(mockEmit).toHaveBeenCalledOnce();
    expect(mockEmit.mock.calls[0]![0]).toMatchObject({ event: "shift_swap.requested" });

    // Stage event emitted
    expect(mockEmitStageProposed).toHaveBeenCalledOnce();
    expect(mockEmitStageProposed.mock.calls[0]![0]).toMatchObject({
      stage: "shift_swap_lifecycle.stage_0_propose",
    });
  });
});

// ── Journey 1b: voice channel denied ────────────────────────────────────────

describe("requestSwap — voice channel guard (ADR-0288)", () => {
  it("1b: returns Norwegian chat-only message, no gate/pipeline calls", async () => {
    const result = await requestSwap.execute(
      {
        requester_shift_id: REQUESTER_SHIFT_ID,
        target_profile_id: TARGET_PROFILE_ID,
        target_shift_id: TARGET_SHIFT_ID,
      },
      makeCtx({ channel: "voice" }),
    );

    expect(result).toContain("chat");
    expect(mockCallGateAction).not.toHaveBeenCalled();
    expect(mockMutateWithGate).not.toHaveBeenCalled();
    expect(mockCreatePipeline).not.toHaveBeenCalled();
  });
});

// ── Journey 1c: gate_action denied ─────────────────────────────────────────

describe("requestSwap — authority denied", () => {
  it("1c: returns ok:false JSON, no pipeline created, no emit", async () => {
    mockCallGateAction.mockResolvedValue(DENY_GATE);

    const result = await requestSwap.execute(
      {
        requester_shift_id: REQUESTER_SHIFT_ID,
        target_profile_id: TARGET_PROFILE_ID,
        target_shift_id: TARGET_SHIFT_ID,
      },
      makeCtx(),
    );

    const parsed = JSON.parse(result as string);
    expect(parsed.ok).toBe(false);
    expect(parsed.reason).toBe("authority_denied");

    expect(mockMutateWithGate).not.toHaveBeenCalled();
    expect(mockCreatePipeline).not.toHaveBeenCalled();
    expect(mockEmit).not.toHaveBeenCalled();
  });
});

// ── Journey 1d: pipeline lock held ──────────────────────────────────────────

describe("requestSwap — pipeline lock held (409)", () => {
  it("1d: returns Norwegian lock-held message when other pipeline holds the shift", async () => {
    // mutateWithGate exec throws PipelineLockHeldError (simulating lock CAS failure)
    mockMutateWithGate.mockImplementation(
      async (_client: unknown, args: { exec: (db: unknown) => Promise<unknown> }) => {
        await args.exec(_client); // triggers acquireLock which throws
        return { ok: true, result: null, gateEvaluationId: "g1", correlationId: "c1" };
      },
    );
    mockAcquireLock.mockRejectedValueOnce(
      new (PipelineLockHeldError as unknown as new (id: string) => Error)(REQUESTER_SHIFT_ID),
    );

    const result = await requestSwap.execute(
      {
        requester_shift_id: REQUESTER_SHIFT_ID,
        target_profile_id: TARGET_PROFILE_ID,
        target_shift_id: TARGET_SHIFT_ID,
      },
      makeCtx(),
    );

    // Should contain a Norwegian lock message, not a JSON ok:true
    expect(result).toContain("låst");
    expect(mockEmit).not.toHaveBeenCalled();
  });
});

// ── Journey 1e: respondToSwap accept ────────────────────────────────────────

describe("respondToSwap — accept advances to stage_1_consent", () => {
  it("1e: RPC called, pipeline advanced, stage_consented emitted", async () => {
    // Supabase returns active pipeline instance in engine_state
    const supabaseAdmin = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: SWAP_ID,
                    current_step: 0,
                    context: {
                      shiftId: REQUESTER_SHIFT_ID,
                      targetShiftId: TARGET_SHIFT_ID,
                      initiatorProfileId: PROFILE_ID,
                    },
                  },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    } as unknown as AgentToolContext["supabaseAdmin"];

    const result = await respondToSwap.execute(
      { swap_id: SWAP_ID, accepted: true },
      makeCtx({ supabaseAdmin }),
    );

    expect(result).toBe("Bytte akseptert. Venter nå på godkjenning fra leder.");

    // Gate was evaluated
    expect(mockCallGateAction).toHaveBeenCalledOnce();

    // mutateWithGate called (RPC + pipeline advance inside exec)
    expect(mockMutateWithGate).toHaveBeenCalledOnce();

    // Pipeline advanced to step 1 (stage_1_consent)
    expect(mockAdvancePipeline).toHaveBeenCalledOnce();
    expect(mockAdvancePipeline.mock.calls[0]![3]).toBe(1);

    // Legacy event emitted
    expect(mockEmit).toHaveBeenCalledOnce();
    expect(mockEmit.mock.calls[0]![0]).toMatchObject({ event: "shift_swap.accepted" });

    // Stage event emitted
    expect(mockEmitStageConsented).toHaveBeenCalledOnce();
    expect(mockEmitStageConsented.mock.calls[0]![0]).toMatchObject({
      stage: "shift_swap_lifecycle.stage_1_consent",
    });
  });
});

// ── Journey 1f: cancelSwap ───────────────────────────────────────────────────

describe("cancelSwap — terminates pipeline and releases both locks", () => {
  it("1f: pipeline terminated, both shifts unlocked, stage_cancelled emitted", async () => {
    // Supabase returns active pipeline instance with context
    const supabaseAdmin = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: SWAP_ID,
                    current_step: 0,
                    context: {
                      shiftId: REQUESTER_SHIFT_ID,
                      targetShiftId: TARGET_SHIFT_ID,
                    },
                  },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    } as unknown as AgentToolContext["supabaseAdmin"];

    const result = await cancelSwap.execute({ swap_id: SWAP_ID }, makeCtx({ supabaseAdmin }));

    expect(result).toBe("Byttforespørsel avbrutt.");

    // Pipeline terminated
    expect(mockTerminatePipeline).toHaveBeenCalledOnce();
    expect(mockTerminatePipeline.mock.calls[0]![3]).toMatchObject({ kind: "cancel" });

    // Both locks released (ADR-0340 §Q-lock-both)
    expect(mockReleaseLock).toHaveBeenCalledTimes(2);
    const releasedShifts = mockReleaseLock.mock.calls.map((c: unknown[]) => c[2]);
    expect(releasedShifts).toContain(REQUESTER_SHIFT_ID);
    expect(releasedShifts).toContain(TARGET_SHIFT_ID);

    // Legacy event emitted
    expect(mockEmit).toHaveBeenCalledOnce();
    expect(mockEmit.mock.calls[0]![0]).toMatchObject({ event: "shift_swap.cancelled" });

    // Stage cancelled event emitted
    expect(mockEmitStageCancelled).toHaveBeenCalledOnce();
  });
});

// ── Journey 1g: override_swap_pipeline happy path ───────────────────────────

describe("overrideSwapPipeline — happy path", () => {
  it("1g: terminates pipeline, releases both locks, emits stage_overridden", async () => {
    mockReadPipelineInstance.mockResolvedValue({
      id: PIPELINE_ID,
      status: "running",
      entityId: REQUESTER_SHIFT_ID,
      context: { shiftId: REQUESTER_SHIFT_ID, targetShiftId: TARGET_SHIFT_ID },
    });
    // isTerminalStatus returns false (pipeline is active)
    mockIsTerminalStatus.mockReturnValue(false);

    const result = await overrideSwapPipeline.execute(
      {
        pipeline_instance_id: PIPELINE_ID,
        override_reason: "Pipeline stuck — manager approval unavailable for 48h",
      },
      makeCtx(),
    );

    const parsed = JSON.parse(result as string);
    expect(parsed.ok).toBe(true);
    expect(parsed.pipeline_instance_id).toBe(PIPELINE_ID);
    expect(parsed.overridden_from_status).toBe("running");

    // Terminate called with kind=override
    expect(mockTerminatePipeline).toHaveBeenCalledOnce();
    expect(mockTerminatePipeline.mock.calls[0]![3]).toMatchObject({ kind: "override" });

    // Both locks released (ADR-0340 §Q-lock-both: swap locks both shifts)
    expect(mockReleaseLock).toHaveBeenCalledTimes(2);
    const releasedShifts = mockReleaseLock.mock.calls.map((c: unknown[]) => c[2]);
    expect(releasedShifts).toContain(REQUESTER_SHIFT_ID);
    expect(releasedShifts).toContain(TARGET_SHIFT_ID);

    // stage_overridden emitted (ADR-0134)
    expect(mockEmitStageOverridden).toHaveBeenCalledOnce();
    expect(mockEmitStageOverridden.mock.calls[0]![0]).toMatchObject({
      stage: "shift_swap_lifecycle.override",
    });
  });
});

// ── Journey 1h: override short reason ───────────────────────────────────────

describe("overrideSwapPipeline — short override_reason (ADR-0328)", () => {
  it("1h: returns Norwegian 400 message before any DB call", async () => {
    const result = await overrideSwapPipeline.execute(
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
    expect(mockEmit).not.toHaveBeenCalled();
  });
});

// ── Journey 1i: non-admin denied ────────────────────────────────────────────

describe("overrideSwapPipeline — non-admin authority denied", () => {
  it("1i: returns ok:false JSON, no pipeline terminated", async () => {
    mockReadPipelineInstance.mockResolvedValue({
      id: PIPELINE_ID,
      status: "running",
      entityId: REQUESTER_SHIFT_ID,
      context: { shiftId: REQUESTER_SHIFT_ID, targetShiftId: TARGET_SHIFT_ID },
    });
    mockIsTerminalStatus.mockReturnValue(false);

    mockMutateWithGate.mockRejectedValueOnce(
      new MutateWithGateDenied({ deniedBy: "capability", reason: "Admin role required" }),
    );

    const result = await overrideSwapPipeline.execute(
      {
        pipeline_instance_id: PIPELINE_ID,
        override_reason: "Pipeline stuck — manager approval unavailable for 48h",
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

// ── Journey 1j: already terminal → idempotent ───────────────────────────────

describe("overrideSwapPipeline — already terminal (idempotent)", () => {
  it("1j: returns ok:true with existing state, no new writes or emits", async () => {
    mockReadPipelineInstance.mockResolvedValue({
      id: PIPELINE_ID,
      status: "overridden",
      entityId: REQUESTER_SHIFT_ID,
      context: {},
    });
    // Already terminal
    mockIsTerminalStatus.mockReturnValue(true);

    const result = await overrideSwapPipeline.execute(
      {
        pipeline_instance_id: PIPELINE_ID,
        override_reason: "Pipeline stuck — manager approval unavailable for 48h",
      },
      makeCtx(),
    );

    const parsed = JSON.parse(result as string);
    expect(parsed.ok).toBe(true);
    expect(parsed.overridden_from_status).toBe("overridden");
    expect(parsed.message).toContain("allerede overstyrt");

    // No new writes or emits
    expect(mockMutateWithGate).not.toHaveBeenCalled();
    expect(mockTerminatePipeline).not.toHaveBeenCalled();
    expect(mockEmitStageOverridden).not.toHaveBeenCalled();
  });
});

// ── Journey 1k: workspace mismatch → 403 ────────────────────────────────────

describe("overrideSwapPipeline — workspace mismatch (ADR-0151)", () => {
  it("1k: returns Norwegian 403 message when pipeline belongs to another workspace", async () => {
    const PipelineContextError_ = PipelineContextError as unknown as new (
      code: string,
      msg: string,
    ) => Error;
    mockReadPipelineInstance.mockRejectedValueOnce(
      new PipelineContextError_("workspace_mismatch", "Pipeline belongs to a different workspace"),
    );

    const result = await overrideSwapPipeline.execute(
      {
        pipeline_instance_id: PIPELINE_ID,
        override_reason: "Pipeline stuck — manager approval unavailable for 48h",
      },
      makeCtx(),
    );

    expect(result).toContain("ikke funnet");
    expect(result).toContain("annet arbeidsområde");
    expect(mockMutateWithGate).not.toHaveBeenCalled();
  });
});
