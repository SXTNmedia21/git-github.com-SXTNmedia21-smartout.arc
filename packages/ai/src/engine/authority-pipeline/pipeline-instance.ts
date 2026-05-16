/**
 * pipeline-instance.ts — Read + write engine_state rows scoped to pipeline
 * process ids.
 *
 * All state for pipeline instances lives in engine_state (ADR-0067,
 * ADR-0340 §Q1). The process_id column identifies the blueprint:
 *   "shift_swap_lifecycle"   — 3-stage mutual swap
 *   "marketplace_lifecycle"  — 3-stage open-shift marketplace
 *
 * Workspace-scope: ctx.workspaceId is validated before every DB call
 * (L-0177 / ADR-0151). engine_state.workspace_id MUST equal ctx.workspaceId
 * on every read — rows for other workspaces are invisible (RLS also enforces).
 *
 * ADR-0240 cross-namespace write ban: this file writes ONLY to engine_state.
 * It does NOT write to schedule_shift_offer, schedule_shift.employee_id, or
 * any swap/marketplace-owned tables. Entity-side mutations stay in capability
 * tools and are called by T2/T3, NOT by this engine layer.
 *
 * ADR-0287 single-call invariant: `createPipelineInstance` and
 * `terminatePipelineInstance` (lock acquire + release respectively) MUST
 * be called from inside a mutateWithGate exec callback so the engine_state
 * write is in the same gate-evaluation audit chain. These helpers do not
 * call mutateWithGate themselves — they are the body of the exec callback.
 *
 * References:
 *   ADR-0067 — engine_state is canonical pipeline instance surface
 *   ADR-0151 — workspace_id server-derived, never body-supplied
 *   ADR-0204 — correlation chain
 *   ADR-0240 — no cross-namespace writes
 *   ADR-0287 — single mutateWithGate per atomic write
 *   ADR-0340 §Q1 — engine_state reuse decision
 *   L-0177   — fail-fast on missing context
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  PipelineContextError,
  PipelineCtxSchema,
  PIPELINE_PROCESS_IDS,
  type PipelineCtx,
  type PipelineInstance,
  type PipelineProcessId,
  type PipelineContextData,
} from "./types.js";
import {
  isTerminalStatus,
  resolveTransition,
  type PipelineTransitionIntent,
} from "./stage-transitions.js";

// ─────────────────────────────────────────────────────────────────
// Internal adapter: engine_state Row → PipelineInstance
// ─────────────────────────────────────────────────────────────────

function adaptRow(row: {
  id: string;
  workspace_id: string | null;
  process_id: string;
  entity_id: string | null;
  entity_type: string | null;
  current_step: number;
  status: string;
  context: unknown;
  started_at: string;
  completed_at: string | null;
  parent_state_id: string | null;
}): PipelineInstance {
  if (!row.workspace_id) {
    throw new PipelineContextError(
      "missing_context",
      `Pipeline instance ${row.id} has NULL workspace_id — L-0177 invariant violated.`,
    );
  }
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    processId: row.process_id,
    entityId: row.entity_id,
    entityType: row.entity_type,
    currentStep: row.current_step,
    status: row.status,
    context: (row.context ?? {}) as Record<string, unknown>,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    parentStateId: row.parent_state_id,
  };
}

// ─────────────────────────────────────────────────────────────────
// Read helpers
// ─────────────────────────────────────────────────────────────────

/**
 * Read a single pipeline instance by engine_state.id.
 *
 * Validates workspace_id on the returned row against ctx.workspaceId
 * to catch any RLS bypass or workspace mismatch (L-0177).
 *
 * @param ctx — server-derived workspace + actor
 * @param instanceId — engine_state.id (pipeline_instance_id)
 */
export async function readPipelineInstance(
  client: SupabaseClient,
  ctx: PipelineCtx,
  instanceId: string,
): Promise<PipelineInstance> {
  PipelineCtxSchema.parse(ctx); // L-0177 fail-fast

  const { data, error } = await client
    .from("engine_state")
    .select(
      "id, workspace_id, process_id, entity_id, entity_type, current_step, status, context, started_at, completed_at, parent_state_id",
    )
    .eq("id", instanceId)
    .in("process_id", PIPELINE_PROCESS_IDS)
    .single();

  if (error || !data) {
    throw new PipelineContextError(
      "not_found",
      `Pipeline instance ${instanceId} not found. ${error?.message ?? ""}`,
    );
  }

  const instance = adaptRow(data);

  // Belt-and-suspenders workspace check after RLS (L-0177).
  if (instance.workspaceId !== ctx.workspaceId) {
    throw new PipelineContextError(
      "workspace_mismatch",
      `Pipeline instance ${instanceId} belongs to workspace ${instance.workspaceId} ` +
        `but ctx.workspaceId=${ctx.workspaceId}.`,
    );
  }

  return instance;
}

/**
 * Read active pipeline instances for a given shift.
 *
 * Returns instances that are NOT in a terminal state.
 * Scoped to (workspace, processId) for efficiency.
 *
 * @param ctx — server-derived workspace + actor
 * @param shiftId — the shift whose pipeline instances are queried
 * @param processId — optional: filter to a specific process blueprint
 */
export async function readActivePipelineInstancesForShift(
  client: SupabaseClient,
  ctx: PipelineCtx,
  shiftId: string,
  processId?: PipelineProcessId,
): Promise<PipelineInstance[]> {
  PipelineCtxSchema.parse(ctx);

  let query = client
    .from("engine_state")
    .select(
      "id, workspace_id, process_id, entity_id, entity_type, current_step, status, context, started_at, completed_at, parent_state_id",
    )
    .eq("workspace_id", ctx.workspaceId)
    .eq("entity_id", shiftId)
    .in("process_id", processId ? [processId] : PIPELINE_PROCESS_IDS)
    // Active = any non-terminal status
    .not("status", "in", `(complete,failed,cancelled,escalated,overridden)`)
    .order("started_at", { ascending: false });

  const { data, error } = await query;

  if (error) {
    throw new PipelineContextError(
      "not_found",
      `Failed to query pipeline instances for shift ${shiftId}: ${error.message}`,
    );
  }

  return (data ?? []).map(adaptRow);
}

// ─────────────────────────────────────────────────────────────────
// Write helpers
//
// These helpers write directly to engine_state. They MUST be called
// from inside a mutateWithGate exec callback (ADR-0287). They do NOT
// call mutateWithGate themselves — that is the caller's responsibility.
// ─────────────────────────────────────────────────────────────────

/**
 * Create a new pipeline instance (engine_state row).
 *
 * Sets initial state: status="pending", current_step=0.
 * context stores the PipelineContextData (shiftId, initiatorProfileId, etc.).
 *
 * MUST be called inside a mutateWithGate exec callback (ADR-0287).
 * The lock acquire (acquirePipelineLock) should happen in the SAME exec callback.
 *
 * @param ctx — server-derived workspace + actor
 * @param processId — the pipeline blueprint id
 * @param shiftId — the shift being orchestrated (entity_id)
 * @param contextData — initial pipeline context data
 */
export async function createPipelineInstance(
  client: SupabaseClient,
  ctx: PipelineCtx,
  processId: PipelineProcessId,
  shiftId: string,
  contextData: PipelineContextData,
): Promise<PipelineInstance> {
  PipelineCtxSchema.parse(ctx);

  // Q2 workspace-scope enforcement: sourceWorkspaceId must match ctx.workspaceId.
  if (contextData.sourceWorkspaceId !== ctx.workspaceId) {
    throw new PipelineContextError(
      "workspace_mismatch",
      `contextData.sourceWorkspaceId=${contextData.sourceWorkspaceId} ` +
        `does not match ctx.workspaceId=${ctx.workspaceId}. ` +
        `Cross-workspace pipelines are not permitted (ADR-0340 §Q2).`,
    );
  }

  const { data, error } = await client
    .from("engine_state")
    .insert({
      workspace_id: ctx.workspaceId,
      process_id: processId,
      entity_id: shiftId,
      entity_type: "shift",
      current_step: 0,
      status: "pending",
      context: contextData as unknown as Record<string, unknown>,
      started_at: new Date().toISOString(),
    })
    .select(
      "id, workspace_id, process_id, entity_id, entity_type, current_step, status, context, started_at, completed_at, parent_state_id",
    )
    .single();

  if (error || !data) {
    throw new PipelineContextError(
      "not_found",
      `Failed to create pipeline instance for shift ${shiftId}: ${error?.message ?? "No data returned"}`,
    );
  }

  return adaptRow(data);
}

/**
 * Advance a pipeline instance to the next step.
 *
 * Sets status="running" and increments current_step.
 * Updates context with the latest gate_evaluation_id for ADR-0204 chain.
 *
 * MUST be called inside a mutateWithGate exec callback (ADR-0287).
 *
 * @param ctx — server-derived workspace + actor
 * @param instanceId — engine_state.id
 * @param toStep — target step (must equal currentStep + 1)
 * @param gateEvaluationId — gate_evaluation.id from the current stage gate call
 * @param contextPatch — optional partial context data to merge (e.g. updated lastGateEvaluationId)
 */
export async function advancePipelineInstance(
  client: SupabaseClient,
  ctx: PipelineCtx,
  instanceId: string,
  toStep: number,
  gateEvaluationId: string | null,
  contextPatch?: Partial<PipelineContextData>,
): Promise<PipelineInstance> {
  PipelineCtxSchema.parse(ctx);

  // Read current state for transition validation.
  const current = await readPipelineInstance(client, ctx, instanceId);

  // Resolve transition — throws PipelineTransitionError on invalid move.
  // pending → running (activate) uses "activate" intent, which then implicitly
  // allows the step advance. Running instances use "advance" directly.
  const transitionResult =
    current.status === "pending"
      ? // Activate first (pending → running), then advance step.
        // We model this as two logical steps: the first sets status=running,
        // the second advances step. Both happen in the same DB write below.
        (() => {
          resolveTransition(current.status, current.currentStep, toStep + 1, {
            kind: "activate",
          });
          return resolveTransition("running", current.currentStep, toStep + 1, {
            kind: "advance",
            toStep,
          });
        })()
      : resolveTransition(current.status, current.currentStep, toStep + 1, {
          kind: "advance",
          toStep,
        });

  const { status, step } = transitionResult;

  // Merge context patch + update lastGateEvaluationId.
  const updatedContext: Record<string, unknown> = {
    ...current.context,
    ...(contextPatch ?? {}),
    lastGateEvaluationId: gateEvaluationId,
  };

  const { data, error } = await client
    .from("engine_state")
    .update({
      status,
      current_step: step,
      context: updatedContext,
      updated_at: new Date().toISOString(),
    })
    .eq("id", instanceId)
    .eq("workspace_id", ctx.workspaceId) // belt-and-suspenders workspace scope
    .select(
      "id, workspace_id, process_id, entity_id, entity_type, current_step, status, context, started_at, completed_at, parent_state_id",
    )
    .single();

  if (error || !data) {
    throw new PipelineContextError(
      "not_found",
      `Failed to advance pipeline instance ${instanceId}: ${error?.message ?? "No data returned"}`,
    );
  }

  return adaptRow(data);
}

/**
 * Terminate a pipeline instance by setting a terminal status.
 *
 * Terminal statuses: complete | failed | cancelled | escalated | overridden.
 * Sets completed_at = now(). Updates lastGateEvaluationId in context.
 *
 * The lock release (releasePipelineLock) MUST happen in the SAME exec callback
 * (ADR-0287 single-call invariant + ADR-0340 P0.6 lifecycle).
 *
 * MUST be called inside a mutateWithGate exec callback (ADR-0287).
 *
 * @param ctx — server-derived workspace + actor
 * @param instanceId — engine_state.id
 * @param intent — "complete" | "reject" | "cancel" | "escalate" | "override"
 * @param gateEvaluationId — gate_evaluation.id from the terminal stage gate call
 */
export async function terminatePipelineInstance(
  client: SupabaseClient,
  ctx: PipelineCtx,
  instanceId: string,
  intent: Extract<
    PipelineTransitionIntent,
    { kind: "complete" | "reject" | "cancel" | "escalate" | "override" }
  >,
  gateEvaluationId: string | null,
): Promise<PipelineInstance> {
  PipelineCtxSchema.parse(ctx);

  const current = await readPipelineInstance(client, ctx, instanceId);

  // Validate: must not already be in a terminal state.
  if (isTerminalStatus(current.status)) {
    throw new PipelineContextError(
      "not_found",
      `Pipeline instance ${instanceId} is already in terminal state ${current.status}. ` +
        `Cannot terminate again.`,
    );
  }

  // Resolve target status using transition graph.
  const { status } = resolveTransition(
    current.status,
    current.currentStep,
    current.currentStep, // maxStep irrelevant for terminal transitions
    intent,
  );

  const updatedContext: Record<string, unknown> = {
    ...current.context,
    lastGateEvaluationId: gateEvaluationId,
  };

  const now = new Date().toISOString();

  const { data, error } = await client
    .from("engine_state")
    .update({
      status,
      completed_at: now,
      context: updatedContext,
      updated_at: now,
    })
    .eq("id", instanceId)
    .eq("workspace_id", ctx.workspaceId)
    .select(
      "id, workspace_id, process_id, entity_id, entity_type, current_step, status, context, started_at, completed_at, parent_state_id",
    )
    .single();

  if (error || !data) {
    throw new PipelineContextError(
      "not_found",
      `Failed to terminate pipeline instance ${instanceId}: ${error?.message ?? "No data returned"}`,
    );
  }

  return adaptRow(data);
}
