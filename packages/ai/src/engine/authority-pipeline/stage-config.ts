/**
 * stage-config.ts — Read engine_authority_pipeline blueprint rows.
 *
 * Resolves stage requirements (required_role, max_wait_minutes, escalation_action)
 * for a given (workspace, capability, stage_index or action_type) from the DB.
 *
 * Workspace-scoped: workspaceId must be server-derived (L-0177 / ADR-0151).
 * Every public function accepts PipelineCtx as first arg and validates it via
 * the Zod schema before any DB access.
 *
 * ADR-0340 T1: read-only helpers. No writes here.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  PipelineContextError,
  PipelineCtxSchema,
  type PipelineCtx,
  type PipelineStageConfig,
} from "./types.js";

// ─────────────────────────────────────────────────────────────────
// Row → domain type adapter
// ─────────────────────────────────────────────────────────────────

function adaptRow(row: {
  id: string;
  workspace_id: string;
  capability: string;
  action_type: string;
  stage_index: number;
  required_role: string;
  max_wait_minutes: number | null;
  escalation_action: string | null;
}): PipelineStageConfig {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    capability: row.capability,
    actionType: row.action_type,
    stageIndex: row.stage_index,
    requiredRole: row.required_role,
    maxWaitMinutes: row.max_wait_minutes,
    escalationAction: row.escalation_action,
  };
}

// ─────────────────────────────────────────────────────────────────
// Public helpers
// ─────────────────────────────────────────────────────────────────

/**
 * Load all stage configs for a (workspace, capability) pair.
 *
 * Returns stages ordered by stage_index ASC.
 * Throws PipelineContextError("not_found") when no rows exist for the
 * capability in this workspace (likely missing bootstrap seed).
 *
 * @param ctx — server-derived workspace + actor. Validated via Zod.
 * @param capability — the pipeline blueprint id (e.g. "shift_swap_lifecycle").
 */
export async function loadPipelineStages(
  client: SupabaseClient,
  ctx: PipelineCtx,
  capability: string,
): Promise<PipelineStageConfig[]> {
  PipelineCtxSchema.parse(ctx); // L-0177 fail-fast

  const { data, error } = await client
    .from("engine_authority_pipeline")
    .select(
      "id, workspace_id, capability, action_type, stage_index, required_role, max_wait_minutes, escalation_action",
    )
    .eq("workspace_id", ctx.workspaceId)
    .eq("capability", capability)
    .order("stage_index", { ascending: true });

  if (error) {
    throw new PipelineContextError(
      "not_found",
      `Failed to load pipeline stages for capability=${capability} workspace=${ctx.workspaceId}: ${error.message}`,
    );
  }

  if (!data || data.length === 0) {
    throw new PipelineContextError(
      "not_found",
      `No pipeline stages found for capability=${capability} in workspace=${ctx.workspaceId}. ` +
        `Bootstrap seed may be missing (ADR-0340 §Migration §2).`,
    );
  }

  return data.map(adaptRow);
}

/**
 * Load a single stage config by action_type.
 *
 * action_type uniquely identifies a stage within a (workspace, capability)
 * pair (UNIQUE constraint on the table).
 *
 * Throws PipelineContextError("not_found") when no matching row exists.
 *
 * @param ctx — server-derived workspace + actor. Validated via Zod.
 * @param actionType — e.g. "shift_swap_lifecycle.stage_0_propose"
 */
export async function loadStageByActionType(
  client: SupabaseClient,
  ctx: PipelineCtx,
  actionType: string,
): Promise<PipelineStageConfig> {
  PipelineCtxSchema.parse(ctx); // L-0177 fail-fast

  const { data, error } = await client
    .from("engine_authority_pipeline")
    .select(
      "id, workspace_id, capability, action_type, stage_index, required_role, max_wait_minutes, escalation_action",
    )
    .eq("workspace_id", ctx.workspaceId)
    .eq("action_type", actionType)
    .single();

  if (error || !data) {
    throw new PipelineContextError(
      "not_found",
      `Pipeline stage not found: action_type=${actionType} workspace=${ctx.workspaceId}. ` +
        `${error?.message ?? "No rows returned"}`,
    );
  }

  return adaptRow(data);
}

/**
 * Load a single stage config by (capability, stage_index).
 *
 * Convenient when the caller knows the stage position but not the full
 * action_type string.
 *
 * Throws PipelineContextError("not_found") when no matching row exists.
 *
 * @param ctx — server-derived workspace + actor. Validated via Zod.
 * @param capability — e.g. "marketplace_lifecycle"
 * @param stageIndex — 0-based stage index
 */
export async function loadStageByIndex(
  client: SupabaseClient,
  ctx: PipelineCtx,
  capability: string,
  stageIndex: number,
): Promise<PipelineStageConfig> {
  PipelineCtxSchema.parse(ctx); // L-0177 fail-fast

  const { data, error } = await client
    .from("engine_authority_pipeline")
    .select(
      "id, workspace_id, capability, action_type, stage_index, required_role, max_wait_minutes, escalation_action",
    )
    .eq("workspace_id", ctx.workspaceId)
    .eq("capability", capability)
    .eq("stage_index", stageIndex)
    .single();

  if (error || !data) {
    throw new PipelineContextError(
      "not_found",
      `Pipeline stage not found: capability=${capability} stage_index=${stageIndex} workspace=${ctx.workspaceId}. ` +
        `${error?.message ?? "No rows returned"}`,
    );
  }

  return adaptRow(data);
}
