/**
 * lock.ts — CAS acquire + release helpers for schedule_shift.pipeline_lock_state_id.
 *
 * The lock column points at the engine_state row owning the pipeline lock for a
 * given shift. Acquire uses a CAS-style UPDATE ... WHERE pipeline_lock_state_id IS NULL
 * to guarantee atomicity — zero rows updated means another pipeline instance is
 * already active.
 *
 * Design: ADR-0340 P0.6.
 * Workspace-scope: ctx.workspaceId validated against the shift's workspace_id
 * before any write (L-0177 / ADR-0151 fail-fast).
 *
 * IMPORTANT: acquire and release MUST each be called from inside the exec callback
 * of a mutateWithGate call (ADR-0287 single-call invariant). These helpers are
 * NOT standalone DB calls — they are helpers for the pipeline-instance exec body.
 *
 * Cross-namespace write note (ADR-0240): this file writes ONLY to
 * schedule_shift.pipeline_lock_state_id — the pipeline-orchestration column.
 * It does NOT write to schedule_shift.employee_id or any swap/marketplace tables.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  PipelineContextError,
  PipelineLockHeldError,
  PipelineCtxSchema,
  type PipelineCtx,
} from "./types.js";

// ─────────────────────────────────────────────────────────────────
// acquire
// ─────────────────────────────────────────────────────────────────

/**
 * Acquire the pipeline lock on a shift by pointing its
 * pipeline_lock_state_id at the given engine_state id.
 *
 * CAS pattern: UPDATE ... WHERE pipeline_lock_state_id IS NULL.
 * Throws PipelineLockHeldError (HTTP 409 semantics) when 0 rows updated.
 *
 * MUST be called inside a mutateWithGate exec callback so the lock write
 * is part of the same gate-evaluation audit chain (ADR-0287).
 *
 * @param client — Supabase client from the mutateWithGate exec callback
 * @param ctx — server-derived workspace + actor (L-0177 fail-fast)
 * @param shiftId — the shift to lock
 * @param pipelineStateId — engine_state.id of the pipeline instance acquiring the lock
 */
export async function acquirePipelineLock(
  client: SupabaseClient,
  ctx: PipelineCtx,
  shiftId: string,
  pipelineStateId: string,
): Promise<void> {
  PipelineCtxSchema.parse(ctx); // L-0177 fail-fast

  if (!shiftId || shiftId.trim() === "") {
    throw new PipelineContextError(
      "missing_context",
      "shiftId is required to acquire pipeline lock",
    );
  }
  if (!pipelineStateId || pipelineStateId.trim() === "") {
    throw new PipelineContextError(
      "missing_context",
      "pipelineStateId is required to acquire pipeline lock",
    );
  }

  // Verify shift belongs to the expected workspace before writing.
  // Silent workspace fallback is the L-0177 bug class — reject early.
  const { data: shiftRow, error: fetchError } = await client
    .from("schedule_shift")
    .select("schedule_shift_id, workspace_id, pipeline_lock_state_id")
    .eq("schedule_shift_id", shiftId)
    .single();

  if (fetchError || !shiftRow) {
    throw new PipelineContextError(
      "not_found",
      `Shift ${shiftId} not found or not accessible. ${fetchError?.message ?? ""}`,
    );
  }

  if (shiftRow.workspace_id !== ctx.workspaceId) {
    throw new PipelineContextError(
      "workspace_mismatch",
      `Shift ${shiftId} belongs to workspace ${shiftRow.workspace_id} but ctx.workspaceId=${ctx.workspaceId}. ` +
        `Cross-workspace pipeline entry is not permitted (ADR-0340 §Q2 / L-0177).`,
    );
  }

  // CAS acquire: only succeeds when lock is NULL.
  // Returns the updated row(s); empty array means lock was already held.
  const { data: updated, error: updateError } = await client
    .from("schedule_shift")
    .update({ pipeline_lock_state_id: pipelineStateId })
    .eq("schedule_shift_id", shiftId)
    .is("pipeline_lock_state_id", null)
    .eq("workspace_id", ctx.workspaceId) // belt-and-suspenders workspace scope
    .select("schedule_shift_id");

  if (updateError) {
    throw new PipelineContextError(
      "not_found",
      `Failed to acquire pipeline lock on shift ${shiftId}: ${updateError.message}`,
    );
  }

  if (!updated || updated.length === 0) {
    throw new PipelineLockHeldError(shiftId);
  }
}

// ─────────────────────────────────────────────────────────────────
// release
// ─────────────────────────────────────────────────────────────────

/**
 * Release the pipeline lock on a shift by setting pipeline_lock_state_id
 * back to NULL.
 *
 * MUST be called inside the terminal-state exec callback of mutateWithGate
 * so the lock release is part of the same gate-evaluation audit chain
 * (ADR-0287). Terminal states: complete | failed | cancelled | escalated |
 * overridden.
 *
 * Idempotent: if the shift is already unlocked (NULL), the UPDATE succeeds
 * silently (0 rows updated is not an error on release).
 *
 * MUST only release the lock owned by the given pipelineStateId — prevents
 * a stale override of a lock that was re-acquired by a newer pipeline run.
 *
 * @param client — Supabase client from the mutateWithGate exec callback
 * @param ctx — server-derived workspace + actor (L-0177 fail-fast)
 * @param shiftId — the shift to unlock
 * @param pipelineStateId — engine_state.id of the pipeline instance releasing the lock
 */
export async function releasePipelineLock(
  client: SupabaseClient,
  ctx: PipelineCtx,
  shiftId: string,
  pipelineStateId: string,
): Promise<void> {
  PipelineCtxSchema.parse(ctx); // L-0177 fail-fast

  if (!shiftId || shiftId.trim() === "") {
    throw new PipelineContextError(
      "missing_context",
      "shiftId is required to release pipeline lock",
    );
  }
  if (!pipelineStateId || pipelineStateId.trim() === "") {
    throw new PipelineContextError(
      "missing_context",
      "pipelineStateId is required to release pipeline lock",
    );
  }

  // Only release the lock that matches THIS pipeline state id.
  // Scoped to workspace_id for belt-and-suspenders isolation.
  const { error } = await client
    .from("schedule_shift")
    .update({ pipeline_lock_state_id: null })
    .eq("schedule_shift_id", shiftId)
    .eq("pipeline_lock_state_id", pipelineStateId) // only release OUR lock
    .eq("workspace_id", ctx.workspaceId);

  if (error) {
    throw new PipelineContextError(
      "not_found",
      `Failed to release pipeline lock on shift ${shiftId}: ${error.message}`,
    );
  }
  // 0 rows updated = already released or lock was held by another instance.
  // Silent success on release is intentional (idempotent).
}
