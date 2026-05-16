/**
 * event-emitter.ts — Pipeline stage event emission.
 *
 * Emits structured telemetry events for every pipeline stage transition.
 * Each event carries the correlation fields required by ADR-0204:
 *   - pipeline_instance_id (== engine_state.id)
 *   - gate_evaluation_id (from the mutateWithGate call at this stage)
 *
 * Routes to all 4 telemetry destinations (posthog + logger + activity_trail +
 * engine_event) via the @smartout/telemetry registry (ADR-0134).
 * Registry entries added in T4 (packages/telemetry/src/registry.ts).
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
 * ADR-0151: workspaceId is server-derived, never body-supplied (L-0177 guard
 * in PipelineStageEventPayloadSchema.parse() throws on empty workspaceId).
 *
 * References:
 *   ADR-0134 — every mutation emits to 4 destinations
 *   ADR-0204 — correlation chain (gate_evaluation_id + correlation_id)
 *   ADR-0340 §Preservation §3 — additive envelope, not replacement
 *   L-0177 — workspace_id must be non-empty on every event
 */

import type { NonEmptyString } from "@smartout/telemetry";
import { emit } from "@smartout/telemetry";
import type { PipelineStageEventPayload } from "./types.js";
import { PipelineStageEventPayloadSchema } from "./types.js";

// ─────────────────────────────────────────────────────────────────
// Internal emit helper — maps PipelineStageEventPayload onto the
// registry's pipeline.stage_* event shape.
// ─────────────────────────────────────────────────────────────────

function buildEventPayload(
  payload: PipelineStageEventPayload,
  stageStatus: PipelineStageEventPayload["stageStatus"],
) {
  const baseProperties = {
    entity: {
      entity_type: "schedule_shift" as const,
      entity_id: payload.shiftId,
    },
    data: {
      pipeline_instance_id: payload.pipelineInstanceId,
      blueprint_id: payload.processId,
      stage_index: 0 as number, // callers that need the exact index supply it via opts
      action_type: payload.stage,
      gate_evaluation_id: payload.gateEvaluationId,
      entity_id: payload.shiftId,
      entity_type: "schedule_shift" as const,
    },
  };

  return {
    workspace_id: payload.workspaceId as NonEmptyString,
    actor_id: payload.actorProfileId as NonEmptyString,
    properties: baseProperties,
  };
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
 * Routes to posthog + logger + activity_trail + engine_event via
 * @smartout/telemetry registry (ADR-0134).
 *
 * @param payload — validated stage event payload
 */
export async function emitPipelineStageEvent(payload: PipelineStageEventPayload): Promise<void> {
  // Validate before emitting — malformed correlation ids break the audit chain.
  PipelineStageEventPayloadSchema.parse(payload);

  const base = buildEventPayload(payload, payload.stageStatus);

  switch (payload.stageStatus) {
    case "proposed":
      await emit({
        event: "pipeline.stage_proposed",
        workspace_id: base.workspace_id,
        actor_id: base.actor_id,
        properties: base.properties,
      });
      break;

    case "consented":
      await emit({
        event: "pipeline.stage_consented",
        workspace_id: base.workspace_id,
        actor_id: base.actor_id,
        properties: base.properties,
      });
      break;

    case "approved":
      await emit({
        event: "pipeline.stage_approved",
        workspace_id: base.workspace_id,
        actor_id: base.actor_id,
        properties: base.properties,
      });
      break;

    case "rejected":
      await emit({
        event: "pipeline.stage_rejected",
        workspace_id: base.workspace_id,
        actor_id: base.actor_id,
        properties: {
          ...base.properties,
          data: {
            ...base.properties.data,
            rejection_reason: "",
            rejected_by: payload.actorProfileId,
          },
        },
      });
      break;

    case "cancelled":
      await emit({
        event: "pipeline.stage_cancelled",
        workspace_id: base.workspace_id,
        actor_id: base.actor_id,
        properties: base.properties,
      });
      break;

    case "overridden":
      await emit({
        event: "pipeline.stage_overridden",
        workspace_id: base.workspace_id,
        actor_id: base.actor_id,
        properties: {
          ...base.properties,
          data: {
            ...base.properties.data,
            override_reason: "",
            overridden_from_status: "",
            overridden_by: payload.actorProfileId,
          },
        },
      });
      break;

    default: {
      // Exhaustiveness guard — TypeScript narrows stageStatus to never here.
      const _exhaustive: never = payload.stageStatus;
      throw new Error(`Unhandled pipeline stageStatus: ${String(_exhaustive)}`);
    }
  }
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
