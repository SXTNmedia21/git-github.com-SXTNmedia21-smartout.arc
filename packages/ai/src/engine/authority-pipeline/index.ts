/**
 * index.ts — Barrel export for the authority-pipeline engine package.
 *
 * Public surface consumed by T2 (shift-swap), T3 (marketplace), and T5
 * (override_pipeline tool). T4 imports types for telemetry wiring.
 *
 * ADR-0340 T1 — Pipeline engine TS package.
 *
 * Import path: @smartout/ai/engine/authority-pipeline
 * (subpath registered in packages/ai/package.json "exports")
 */

// ─── Types ─────────────────────────────────────────────────────────────────
export {
  // Zod schemas
  PipelineCtxSchema,
  PipelineStageConfigSchema,
  PipelineInstanceSchema,
  PipelineContextDataSchema,
  PipelineStageEventPayloadSchema,
  // TypeScript types
  type PipelineCtx,
  type PipelineStageConfig,
  type PipelineInstance,
  type PipelineContextData,
  type PipelineStageEventPayload,
  // Enums / constants
  PIPELINE_PROCESS_IDS,
  SHIFT_SWAP_STAGES,
  MARKETPLACE_STAGES,
  TERMINAL_STATUSES,
  ACTIVE_STATUSES,
  type PipelineProcessId,
  type PipelineStage,
  type ShiftSwapStage,
  type MarketplaceStage,
  type PipelineStatus,
  type TerminalStatus,
  type ActiveStatus,
  // Error classes
  PipelineLockHeldError,
  PipelineContextError,
  PipelineTransitionError,
} from "./types.js";

// ─── Stage Config ───────────────────────────────────────────────────────────
export { loadPipelineStages, loadStageByActionType, loadStageByIndex } from "./stage-config.js";

// ─── Lock ───────────────────────────────────────────────────────────────────
export { acquirePipelineLock, releasePipelineLock } from "./lock.js";

// ─── Stage Transitions (pure) ───────────────────────────────────────────────
export {
  assertStatusTransition,
  assertStepAdvance,
  isTerminalStatus,
  isActiveStatus,
  stagOutcomeToStatus,
  finalStageApprovedStatus,
  resolveTransition,
  type PipelineTransitionIntent,
} from "./stage-transitions.js";

// ─── Event Emitter ─────────────────────────────────────────────────────────
export {
  emitPipelineStageEvent,
  emitStageProposed,
  emitStageConsented,
  emitStageApproved,
  emitStageRejected,
  emitStageCancelled,
  emitStageOverridden,
} from "./event-emitter.js";

// ─── Pipeline Instance ─────────────────────────────────────────────────────
export {
  readPipelineInstance,
  readActivePipelineInstancesForShift,
  createPipelineInstance,
  advancePipelineInstance,
  terminatePipelineInstance,
} from "./pipeline-instance.js";
