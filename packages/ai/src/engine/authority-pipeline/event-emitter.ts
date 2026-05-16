/**
 * event-emitter.ts — Pipeline stage event emission.
 *
 * Emits structured log events for every pipeline stage transition.
 * Each event carries the correlation fields required by ADR-0204:
 *   - pipeline_instance_id (== engine_state.id)
 *   - gate_evaluation_id (from the mutateWithGate call at this stage)
 *
 * PENDING T4: pipeline.stage_* events are not yet registered in
 * @smartout/telemetry registry. This emitter uses structured logging
 * until T4 adds the registry entries and routes these events to
 * posthog + activity_trail + engine_event destinations.
 *
 * T4 MIGRATION CONTRACT:
 *   1. T4 adds pipeline.stage_* interfaces to packages/telemetry/src/registry.ts.
 *   2. T4 replaces the `structuredLog()` call in `emitPipelineStageEvent` below
 *      with `emit(event)` where event satisfies the new SmartoutEvent union member.
 *   3. T4 removes the `// PENDING T4` comment.
 *
 * ADR-0204 correlation chain: pipelineInstanceId + gateEvaluationId must be
 * present on every emission. gateEvaluationId may be null when the gate was
 * not called (e.g. internal state advancement without a new gate call —
 * callers should pass null only when explicitly no gate was involved).
 *
 * ADR-0340 Preservation §3: pipeline.stage_* are additive — they do NOT
 * replace shift_swap.* or shift_offer.* events. Existing event consumers
 * continue unchanged.
 *
 * References:
 *   ADR-0204 — correlation chain (gate_evaluation_id + correlation_id)
 *   ADR-0340 §Preservation §3 — additive envelope, not replacement
 *   L-0177 — workspace_id must be non-empty on every event
 */

import type { PipelineStageEventPayload } from "./types.js";
import { PipelineStageEventPayloadSchema } from "./types.js";

// ─────────────────────────────────────────────────────────────────
// Internal structured logger
//
// PENDING T4: Replace with emit() from @smartout/telemetry once
// pipeline.stage_* events are registered in registry.ts.
// ─────────────────────────────────────────────────────────────────

function structuredLog(payload: PipelineStageEventPayload): void {
  // Use JSON-serialisable format so log aggregators can parse it.
  console.log(
    JSON.stringify({
      level: "info",
      event: `pipeline.stage_${payload.stageStatus}`,
      process_id: payload.processId,
      stage: payload.stage,
      stage_status: payload.stageStatus,
      pipeline_instance_id: payload.pipelineInstanceId,
      gate_evaluation_id: payload.gateEvaluationId,
      shift_id: payload.shiftId,
      workspace_id: payload.workspaceId,
      actor_profile_id: payload.actorProfileId,
    }),
  );
}

// ─────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────

/**
 * Emit a pipeline stage event.
 *
 * Validates the payload via Zod (L-0177 workspace_id non-empty guard +
 * pipelineInstanceId uuid guard). Throws on invalid payload — the caller
 * should never send a stage event with missing correlation ids.
 *
 * Currently logs to stdout (PENDING T4 registry wiring).
 *
 * @param payload — validated stage event payload
 */
export async function emitPipelineStageEvent(payload: PipelineStageEventPayload): Promise<void> {
  // Validate before emitting — malformed correlation ids break the audit chain.
  PipelineStageEventPayloadSchema.parse(payload);

  // PENDING T4: replace structuredLog with emit() from @smartout/telemetry.
  structuredLog(payload);
}

// ─────────────────────────────────────────────────────────────────
// Convenience builders — one per stage outcome
//
// These reduce boilerplate at call sites and ensure stage_status values
// are always drawn from the canonical payload discriminant.
// ─────────────────────────────────────────────────────────────────

/** Stage-0 proposed (pipeline initiated). */
export async function emitStageProposed(
  opts: Omit<PipelineStageEventPayload, "stageStatus">,
): Promise<void> {
  return emitPipelineStageEvent({ ...opts, stageStatus: "proposed" });
}

/** Stage-1 consented (peer accepted the swap / employee claimed the shift). */
export async function emitStageConsented(
  opts: Omit<PipelineStageEventPayload, "stageStatus">,
): Promise<void> {
  return emitPipelineStageEvent({ ...opts, stageStatus: "consented" });
}

/** Final stage approved (pipeline reaches complete terminal state). */
export async function emitStageApproved(
  opts: Omit<PipelineStageEventPayload, "stageStatus">,
): Promise<void> {
  return emitPipelineStageEvent({ ...opts, stageStatus: "approved" });
}

/** Stage rejected (pipeline reaches failed terminal state). */
export async function emitStageRejected(
  opts: Omit<PipelineStageEventPayload, "stageStatus">,
): Promise<void> {
  return emitPipelineStageEvent({ ...opts, stageStatus: "rejected" });
}

/** Pipeline cancelled (initiator or manager cancelled). */
export async function emitStageCancelled(
  opts: Omit<PipelineStageEventPayload, "stageStatus">,
): Promise<void> {
  return emitPipelineStageEvent({ ...opts, stageStatus: "cancelled" });
}

/** Pipeline overridden (admin T5 override). */
export async function emitStageOverridden(
  opts: Omit<PipelineStageEventPayload, "stageStatus">,
): Promise<void> {
  return emitPipelineStageEvent({ ...opts, stageStatus: "overridden" });
}
