/**
 * mission-resolution.ts — Canonical read path: journey_version_id → engine_missions
 *
 * Resolves the single active `engine_missions` row (with ordered `engine_stages`)
 * for a given `journey_version_id` and `workspaceId`. This is the read complement
 * to `publish_mission`'s write and the `activateMissionAction`'s `is_active` flip.
 *
 * Architecture (Phase 3 #2 — REMEDIATION AMENDMENT 2026-04-23):
 *   journey_version.journey_id → engine_missions.journey_id (ADR-0194 hybrid mapping)
 *   Two-step join: journey_version → journey → engine_missions(is_active=true)
 *
 * Binding ADRs:
 *   - ADR-0099  callGateAction is for mutations ONLY. This resolver is read-only —
 *               there is NO callGateAction call here and there MUST NOT be one added.
 *   - ADR-0132  Mobile AI Routing — this function runs server-side inside the BFF
 *               (/api/journey/guided/start) and is therefore mobile-compatible without
 *               any mobile-specific code path.
 *   - ADR-0134  workspaceId MUST be server-derived by the caller (profile → workspace_id)
 *               before passing to this function. Never accept workspaceId from a client
 *               request body.
 *   - ADR-0176  Invariant 3: server-side BFF re-derivation is the CVE-class red line.
 *               workspaceId flows from resolveAuth() in route.ts — never from request body.
 *   - ADR-0194  JourneyIR v2.1 → engine_missions hybrid mapping. engine_missions has
 *               journey_id FK (not journey_version_id). Resolution requires the two-step join.
 *
 * Binding learnings:
 *   - L-0023  dev-tracking ≠ runtime-state. This resolver reads engine_missions (runtime
 *             mission store), not journey_event (dev-tracking table). Never conflate.
 *
 * Plan: docs/plans/PLAN-mission-resolution-layer.md
 *
 * STUB — implementation deferred to the next sub-sortie.
 * The body MUST typecheck. The throw is intentional; callers must handle it.
 * Replace `throw new Error("not_implemented…")` with the real two-SELECT body.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@smartout/supabase";

// ─── Type aliases — use canonical DB row types, never re-define ──────────────

/** Full row from `engine_missions`. */
export type EngineMissionRow = Database["public"]["Tables"]["engine_missions"]["Row"];

/** Full row from `engine_stages`. */
export type EngineStageRow = Database["public"]["Tables"]["engine_stages"]["Row"];

// ─── Contract ─────────────────────────────────────────────────────────────────

/** Parameters for the mission resolver. */
export interface ResolveMissionParams {
  /**
   * UUID of the `journey_version` row to resolve a mission for.
   * The resolver joins journey_version → journey → engine_missions via journey_id.
   */
  journeyVersionId: string;

  /**
   * Workspace scope guard. MUST be server-derived from the authenticated session
   * (ADR-0176 Invariant 3, ADR-0134). NEVER accept from a client request body.
   */
  workspaceId: string;

  /**
   * Supabase admin client provided by the caller. Admin client is used so the
   * resolver can enforce explicit workspace_id guards without RLS interfering.
   * The caller is responsible for ensuring workspaceId is server-derived before
   * passing the admin client.
   */
  supabaseAdmin: SupabaseClient<Database>;
}

/** Successful resolution result. */
export interface ResolveMissionSuccess {
  ok: true;
  mission: EngineMissionRow;
  /** Ordered by `stage_order ASC`. */
  stages: EngineStageRow[];
}

/**
 * Failure reasons:
 *   - `version_not_found`  — journey_version does not exist in this workspace.
 *   - `not_found`          — no engine_missions row with is_active=true for this journey.
 *                            Most likely: mission not yet published, or not yet author-enriched
 *                            and activated (ADR-0194 Gate — is_active stays false until
 *                            activateMissionAction() is called with all stages complete).
 *   - `multiple_active`    — two or more is_active=true rows for the same journey_id.
 *                            Data integrity bug — logged to console.error by the resolver.
 *   - `stages_empty`       — mission found but engine_stages SELECT returned zero rows.
 *                            Indicates a partial publish (stages insert rolled back).
 */
export type ResolveMissionFailureReason =
  | "version_not_found"
  | "not_found"
  | "multiple_active"
  | "stages_empty";

/** Failure result. */
export interface ResolveMissionFailure {
  ok: false;
  reason: ResolveMissionFailureReason;
  detail?: string;
}

/** Discriminated union return type. */
export type ResolveMissionResult = ResolveMissionSuccess | ResolveMissionFailure;

// ─── Implementation ───────────────────────────────────────────────────────────

/**
 * Resolve the active mission for a given journey version.
 *
 * Algorithm (two-SELECT, workspace-scoped):
 *   1. SELECT journey_version WHERE journey_version_id = params.journeyVersionId
 *      AND workspace_id = params.workspaceId → get journey_id.
 *      If null → return { ok: false, reason: "version_not_found" }.
 *   2. SELECT engine_missions WHERE journey_id = <above>
 *      AND workspace_id = params.workspaceId AND is_active = true
 *      ORDER BY created_at DESC (deterministic tie-break).
 *      0 rows → "not_found".  >1 rows → log + "multiple_active".  1 row → continue.
 *   3. SELECT engine_stages WHERE mission_id = mission.id
 *      AND workspace_id = params.workspaceId ORDER BY stage_order ASC.
 *      0 rows → "stages_empty".
 *   4. Return { ok: true, mission, stages }.
 *
 * Authorization model:
 *   - Read-only. NO callGateAction (ADR-0099: gate is for mutations only).
 *   - Workspace guard is explicit (.eq("workspace_id", workspaceId)) on every SELECT.
 *   - workspaceId must be server-derived before this function is called (ADR-0134, ADR-0176).
 *
 * Caching:
 *   - None. Mission activation is rare (admin event). Content is frozen post-activation.
 *   - Revisit only with profiling evidence. Invalidation would tie to activateMissionAction
 *     (which already calls revalidatePath).
 *
 * Telemetry:
 *   - None. Read-only resolution emits nothing. No emit() calls here.
 *
 * @see docs/plans/PLAN-mission-resolution-layer.md
 * @see ADR-0099 (gate on mutations only — NOT applicable here; read-only)
 * @see ADR-0132 (Mobile AI Routing — BFF-callable)
 * @see ADR-0194 (JourneyIR v2.1 → engine_missions hybrid mapping; two-step join)
 * @see L-0023 (dev-tracking ≠ runtime-state; this resolver reads engine_missions, not journey_event)
 */
export async function resolveMissionForJourneyVersion(
  params: ResolveMissionParams,
): Promise<ResolveMissionResult> {
  const { journeyVersionId, workspaceId, supabaseAdmin } = params;

  // ── Step 1: Resolve journey_version → journey_id ────────────────────────
  // Two-step join: journey_version → journey → engine_missions (ADR-0194 hybrid mapping).
  // engine_missions has journey_id FK, not journey_version_id — the join is intentional.
  const { data: versionRow, error: versionErr } = await supabaseAdmin
    .from("journey_version")
    .select("journey_id")
    .eq("journey_version_id", journeyVersionId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (versionErr || !versionRow) {
    return {
      ok: false,
      reason: "version_not_found",
      detail: versionErr?.message ?? `journey_version ${journeyVersionId} not found in workspace`,
    };
  }

  const journeyId = versionRow.journey_id;

  // ── Step 2: Find the single active engine_missions row ───────────────────
  // Ordered by created_at DESC for deterministic tie-break should data integrity
  // be violated (>1 active row). The multiple_active branch surfaces the bug loudly.
  const { data: missions, error: missionsErr } = await supabaseAdmin
    .from("engine_missions")
    .select("*")
    .eq("journey_id", journeyId)
    .eq("workspace_id", workspaceId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (missionsErr) {
    return {
      ok: false,
      reason: "not_found",
      detail: `engine_missions query failed: ${missionsErr.message}`,
    };
  }

  if (!missions || missions.length === 0) {
    return {
      ok: false,
      reason: "not_found",
      detail:
        `No active mission found for journey ${journeyId} in workspace ${workspaceId}. ` +
        "Publish a mission and enrich all stages (activateMissionAction) before starting a guided run.",
    };
  }

  if (missions.length > 1) {
    // Data integrity bug — activateMissionAction should prevent this, but we
    // guard defensively. Log loudly so ops can detect and correct the bad rows.
    console.error(
      "[mission-resolution] DATA INTEGRITY BUG: multiple is_active=true missions for " +
        `journey_id=${journeyId} workspace_id=${workspaceId}. ` +
        `Count: ${missions.length}. Mission IDs: ${missions.map((m) => m.id).join(", ")}. ` +
        "Run: UPDATE engine_missions SET is_active=false WHERE id != '<correct_id>' AND journey_id='<id>'.",
    );
    return {
      ok: false,
      reason: "multiple_active",
      detail:
        `${missions.length} active missions found for journey ${journeyId}. ` +
        `IDs: ${missions.map((m) => m.id).join(", ")}. This is a data integrity bug.`,
    };
  }

  const mission = missions[0]!;

  // ── Step 3: Load ordered engine_stages ───────────────────────────────────
  // stage_order is the canonical ORDER BY column (confirmed in database.types.ts Row).
  // workspace_id guard applied for defense-in-depth even though mission FK implies it.
  const { data: stages, error: stagesErr } = await supabaseAdmin
    .from("engine_stages")
    .select("*")
    .eq("mission_id", mission.id)
    .eq("workspace_id", workspaceId)
    .order("stage_order", { ascending: true });

  if (stagesErr) {
    return {
      ok: false,
      reason: "stages_empty",
      detail: `engine_stages query failed: ${stagesErr.message}`,
    };
  }

  if (!stages || stages.length === 0) {
    return {
      ok: false,
      reason: "stages_empty",
      detail: `Mission ${mission.id} has no stages. Partial publish — stages insert may have been rolled back.`,
    };
  }

  // ── Step 4: Return success ────────────────────────────────────────────────
  return {
    ok: true,
    mission,
    stages,
  };
}
