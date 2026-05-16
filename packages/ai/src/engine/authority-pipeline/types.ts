/**
 * types.ts — Zod schemas + TypeScript types for the authority pipeline engine.
 *
 * Covers:
 *   - Blueprint stage row (read from engine_authority_pipeline)
 *   - Pipeline context (workspace + actor) — required by every helper (L-0177)
 *   - Stage event payload (emitted via event-emitter.ts)
 *   - Pipeline instance context (engine_state row projections)
 *   - Terminal status enum + stage name discriminants
 *
 * ADR-0340 §T1: pure type surface. No DB access.
 * ADR-0151: workspaceId is server-derived, never body-supplied.
 * L-0177: fail-fast on missing workspaceId / profileId in all helpers.
 */

import { z } from "zod";

// ─────────────────────────────────────────────────────────────────
// Pipeline process IDs — match engine_process.id seeds from T0
// ─────────────────────────────────────────────────────────────────

export const PIPELINE_PROCESS_IDS = ["shift_swap_lifecycle", "marketplace_lifecycle"] as const;

export type PipelineProcessId = (typeof PIPELINE_PROCESS_IDS)[number];

// ─────────────────────────────────────────────────────────────────
// Stage names per blueprint — match action_type seeds from T0
// ─────────────────────────────────────────────────────────────────

export const SHIFT_SWAP_STAGES = [
  "shift_swap_lifecycle.stage_0_propose",
  "shift_swap_lifecycle.stage_1_consent",
  "shift_swap_lifecycle.stage_2_approve",
] as const;

export const MARKETPLACE_STAGES = [
  "marketplace_lifecycle.stage_0_post",
  "marketplace_lifecycle.stage_1_claim",
  "marketplace_lifecycle.stage_2_approve",
] as const;

export type ShiftSwapStage = (typeof SHIFT_SWAP_STAGES)[number];
export type MarketplaceStage = (typeof MARKETPLACE_STAGES)[number];
export type PipelineStage = ShiftSwapStage | MarketplaceStage;

// ─────────────────────────────────────────────────────────────────
// Terminal states — match engine_state.status values
// ─────────────────────────────────────────────────────────────────

export const TERMINAL_STATUSES = [
  "complete",
  "failed",
  "cancelled",
  "escalated",
  "overridden",
] as const;

export type TerminalStatus = (typeof TERMINAL_STATUSES)[number];

export const ACTIVE_STATUSES = ["pending", "running"] as const;
export type ActiveStatus = (typeof ACTIVE_STATUSES)[number];

export type PipelineStatus = TerminalStatus | ActiveStatus;

// ─────────────────────────────────────────────────────────────────
// Pipeline context — required by all engine helpers
//
// Workspace + actor identity sourced from the server-side session,
// never from the request body (L-0177 + ADR-0151).
// ─────────────────────────────────────────────────────────────────

export const PipelineCtxSchema = z.object({
  workspaceId: z.string().min(1, "workspaceId required (L-0177)"),
  profileId: z.string().min(1, "profileId required (L-0177)"),
});

export type PipelineCtx = z.infer<typeof PipelineCtxSchema>;

// ─────────────────────────────────────────────────────────────────
// Blueprint stage row — projection of engine_authority_pipeline Row
// ─────────────────────────────────────────────────────────────────

export const PipelineStageConfigSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  capability: z.string().min(1),
  actionType: z.string().min(1),
  stageIndex: z.number().int().min(0),
  requiredRole: z.string().min(1),
  maxWaitMinutes: z.number().int().positive().nullable(),
  escalationAction: z.string().nullable(),
});

export type PipelineStageConfig = z.infer<typeof PipelineStageConfigSchema>;

// ─────────────────────────────────────────────────────────────────
// Pipeline instance — projection of engine_state for pipeline rows
// ─────────────────────────────────────────────────────────────────

export const PipelineInstanceSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  processId: z.string().min(1),
  entityId: z.string().uuid().nullable(),
  entityType: z.string().nullable(),
  currentStep: z.number().int().min(0),
  status: z.string().min(1),
  context: z.record(z.unknown()),
  startedAt: z.string(),
  completedAt: z.string().nullable(),
  parentStateId: z.string().uuid().nullable(),
});

export type PipelineInstance = z.infer<typeof PipelineInstanceSchema>;

// ─────────────────────────────────────────────────────────────────
// Pipeline context stored in engine_state.context
//
// The context JSONB column carries pipeline-specific fields for
// cross-stage correlation and workspace-scope enforcement (Q2: single
// workspace only until V2.1 ADR).
// ─────────────────────────────────────────────────────────────────

export const PipelineContextDataSchema = z.object({
  /** The shift being orchestrated. Engine entity_id also points here. */
  shiftId: z.string().uuid(),
  /** Workspace of the source shift. MUST equal engine_state.workspace_id
   *  (Q2 single-workspace constraint, ADR-0340 §Decision Q2). */
  sourceWorkspaceId: z.string().uuid(),
  /** Profile that initiated the pipeline (stage-0 actor). */
  initiatorProfileId: z.string().min(1),
  /**
   * Optional: second shift involved in a mutual swap.
   * Present only for shift_swap_lifecycle.
   */
  targetShiftId: z.string().uuid().optional(),
  /**
   * Optional: peer profile expected at stage_1_consent.
   * Present only for shift_swap_lifecycle.
   */
  targetProfileId: z.string().optional(),
  /**
   * gate_evaluation_id from the most recent stage advancement.
   * Updated each time a stage completes. Preserves ADR-0204 chain.
   */
  lastGateEvaluationId: z.string().nullable().optional(),
});

export type PipelineContextData = z.infer<typeof PipelineContextDataSchema>;

// ─────────────────────────────────────────────────────────────────
// Stage event payload — emitted by event-emitter.ts
//
// Every stage advancement emits one of the pipeline.stage_* events.
// ADR-0204 correlation chain: pipeline_instance_id + gate_evaluation_id
// are required on every emission to correlate stages across writes.
// ─────────────────────────────────────────────────────────────────

export const PipelineStageEventPayloadSchema = z.object({
  /** The pipeline process (blueprint id). */
  processId: z.enum(PIPELINE_PROCESS_IDS),
  /** The stage action type (e.g. "shift_swap_lifecycle.stage_0_propose"). */
  stage: z.string().min(1),
  /** "proposed" | "consented" | "approved" | "rejected" | "cancelled" | "overridden" */
  stageStatus: z.enum(["proposed", "consented", "approved", "rejected", "cancelled", "overridden"]),
  /** engine_state.id for this pipeline run. */
  pipelineInstanceId: z.string().uuid(),
  /** gate_evaluation.id from the gate call at this stage. ADR-0204 chain. */
  gateEvaluationId: z.string().nullable(),
  /** Shift being orchestrated. */
  shiftId: z.string().uuid(),
  /** Workspace scope. */
  workspaceId: z.string().uuid(),
  /** Profile that performed this stage action. */
  actorProfileId: z.string().min(1),
});

export type PipelineStageEventPayload = z.infer<typeof PipelineStageEventPayloadSchema>;

// ─────────────────────────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────────────────────────

export class PipelineLockHeldError extends Error {
  public readonly code = "pipeline_lock_held" as const;
  public readonly shiftId: string;

  constructor(shiftId: string) {
    super(
      `Pipeline lock is already held on shift ${shiftId}. Another pipeline instance is active. (ADR-0340 P0.6)`,
    );
    this.name = "PipelineLockHeldError";
    this.shiftId = shiftId;
  }
}

export class PipelineContextError extends Error {
  public readonly code: "missing_context" | "workspace_mismatch" | "not_found";

  constructor(code: PipelineContextError["code"], message: string) {
    super(message);
    this.name = "PipelineContextError";
    this.code = code;
  }
}

export class PipelineTransitionError extends Error {
  public readonly code: "invalid_transition" | "wrong_terminal_state";
  public readonly from: string;
  public readonly to: string;

  constructor(code: PipelineTransitionError["code"], from: string, to: string) {
    super(`Invalid pipeline transition: ${from} → ${to} (code=${code})`);
    this.name = "PipelineTransitionError";
    this.code = code;
    this.from = from;
    this.to = to;
  }
}
