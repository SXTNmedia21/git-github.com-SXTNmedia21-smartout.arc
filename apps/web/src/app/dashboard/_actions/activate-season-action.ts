"use server";

import { createAdminClient } from "@smartout/supabase/admin";
import { emit, nonEmpty } from "@smartout/telemetry";
import { resolveCurrentProfile, gateAction } from "./_shared";

/**
 * activateSeasonAction — atomic season activation via `activate_season` RPC
 * per ADR-0200 §Decision Layer 3.
 *
 * Flow:
 * 1. `resolveCurrentProfile()` server-side re-derivation (ADR-0151).
 * 2. `gateAction()` on capability `season.activate` (channel='chat'),
 *    seeded by migration `20260518010000_season_activate_authority_seed.sql`.
 * 3. Server-side validation — mirrors `packages/year-wheel/src/hooks/
 *    use-seasons.ts:140-173` (budget with revenue > 0, day_factor keyed
 *    on `season_budget_id`, hour_factor keyed on `season_budget_id`).
 * 4. `adminClient.rpc('activate_season', …)` — archives current active
 *    season + activates target + fires D1 trigger fanout inside a
 *    single transaction (Layer 1 + Layer 2 of ADR-0200).
 * 5. Emits `season activated` (enriched) only on `{ok:true}` branches.
 *    Failure paths emit `season activation_failed`. Never both.
 *
 * Invariant compliance:
 *  - I2 (gate-before-mutation, ADR-0099): `gateAction` call precedes the
 *    RPC call; no other path reaches the RPC from application code.
 *  - I3 (single successful emit, ADR-0200): `emit('season activated')`
 *    appears exactly once, inside the `{ok:true}` branch. No emit on
 *    `{ok:false}` returns (L-0094 / L-0118 / L-0125 phantom-emit fix).
 *  - I11 (no phantom-ok, ADR-0196): always returns concrete RPC state
 *    OR a typed `{ok:false, error}`; never a phantom-ok shape.
 */
export type ActivateSeasonResult =
  | {
      ok: true;
      season_id: string;
      departments_affected: number;
      rows_generated: number;
      rows_newly_inserted: number;
      archived_season_id?: string | null;
      skipped?: boolean;
      reason?: string;
    }
  | {
      ok: false;
      error:
        | "unauthenticated"
        | "insufficient_authority"
        | "missing_budget"
        | "missing_day_factors"
        | "missing_hour_factors"
        | "season_not_found"
        | "rpc_error";
    };

type ActivateSeasonRpcResponse = {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  error?: string;
  season_id?: string;
  departments_affected?: number;
  rows_generated?: number;
  rows_newly_inserted?: number;
  archived_season_id?: string | null;
};

export async function activateSeasonAction(seasonId: string): Promise<ActivateSeasonResult> {
  const profile = await resolveCurrentProfile();
  if (!profile) return { ok: false, error: "unauthenticated" };

  const admin = createAdminClient();

  // Entity ref reused by every emit path below. Keeps the `season`
  // prefix consistent with `use-seasons.ts:211` (legacy emit) and the
  // registry interfaces in `packages/telemetry/src/registry.ts`.
  const entity = { entity_type: "season" as const, entity_id: seasonId };

  // ── Authority gate (Invariant 2) ─────────────────────────────────
  /* @authority-gate-literal — capability: 'season.activate' */
  const gate = await gateAction({
    workspaceId: profile.workspaceId,
    capability: "season.activate",
    channel: "chat",
    actorProfileId: profile.profileId,
    actionType: "activate",
    entityId: seasonId,
  });
  if (!gate.allow) {
    // Gate denial is user-actionable observability. Matches the
    // registry reason enum ('missing_budget' | 'missing_day_factors'
    // | 'missing_hour_factors' | 'rpc_error') — 'insufficient_authority'
    // has no dedicated reason, so the gate-level denial is folded into
    // 'rpc_error' for the telemetry fanout, matching how `gate_action`
    // denials surface in other actions. We do NOT emit
    // `season activated` here (Invariant 3).
    await emit({
      event: "season activation_failed",
      workspace_id: nonEmpty(profile.workspaceId, "workspace_id"),
      actor_id: nonEmpty(profile.profileId, "actor_id"),
      properties: {
        entity,
        data: { reason: "rpc_error" },
      },
    });
    return { ok: false, error: "insufficient_authority" };
  }

  // ── Server-side validation (mirrors use-seasons.ts:140-173) ──────
  // day_factor / hour_factor are keyed on `season_budget_id`, not
  // `workspace_id` directly — that's the authoritative shape the
  // existing hook validates against. Budget lookup carries the tenant
  // guard via `.eq("workspace_id", …)` to prevent cross-tenant reuse.
  const budgetPromise = admin
    .from("season_budget")
    .select("season_budget_id, total_target_revenue")
    .eq("season_id", seasonId)
    .eq("workspace_id", profile.workspaceId)
    .maybeSingle();

  const { data: budget, error: budgetError } = await budgetPromise;

  if (budgetError || !budget || !budget.total_target_revenue || budget.total_target_revenue <= 0) {
    await emit({
      event: "season activation_failed",
      workspace_id: nonEmpty(profile.workspaceId, "workspace_id"),
      actor_id: nonEmpty(profile.profileId, "actor_id"),
      properties: {
        entity,
        data: { reason: "missing_budget" },
      },
    });
    return { ok: false, error: "missing_budget" };
  }

  const [dayFactorsResult, hourFactorsResult] = await Promise.all([
    admin
      .from("day_factor")
      .select("*", { count: "exact", head: true })
      .eq("season_budget_id", budget.season_budget_id)
      .eq("workspace_id", profile.workspaceId),
    admin
      .from("hour_factor")
      .select("*", { count: "exact", head: true })
      .eq("season_budget_id", budget.season_budget_id),
  ]);

  if (!dayFactorsResult.count || dayFactorsResult.count === 0) {
    await emit({
      event: "season activation_failed",
      workspace_id: nonEmpty(profile.workspaceId, "workspace_id"),
      actor_id: nonEmpty(profile.profileId, "actor_id"),
      properties: {
        entity,
        data: { reason: "missing_day_factors" },
      },
    });
    return { ok: false, error: "missing_day_factors" };
  }

  if (!hourFactorsResult.count || hourFactorsResult.count === 0) {
    await emit({
      event: "season activation_failed",
      workspace_id: nonEmpty(profile.workspaceId, "workspace_id"),
      actor_id: nonEmpty(profile.profileId, "actor_id"),
      properties: {
        entity,
        data: { reason: "missing_hour_factors" },
      },
    });
    return { ok: false, error: "missing_hour_factors" };
  }

  // ── Atomic RPC call (Invariant 2 — only path to the RPC) ─────────
  const { data: rpcData, error: rpcError } = await admin.rpc("activate_season", {
    p_workspace_id: profile.workspaceId,
    p_season_id: seasonId,
  });

  if (rpcError) {
    await emit({
      event: "season activation_failed",
      workspace_id: nonEmpty(profile.workspaceId, "workspace_id"),
      actor_id: nonEmpty(profile.profileId, "actor_id"),
      properties: {
        entity,
        data: { reason: "rpc_error" },
      },
    });
    return { ok: false, error: "rpc_error" };
  }

  const response = (rpcData ?? {}) as ActivateSeasonRpcResponse;

  // RPC rejected for missing `auth.uid()` — pass-through. No emit:
  // neither success nor a user-actionable failure reason.
  if (response.ok === false && response.error === "unauthenticated") {
    return { ok: false, error: "unauthenticated" };
  }

  if (response.ok === false) {
    // Any other RPC-level `{ok:false}` — e.g. future reasons that don't
    // yet map to a typed error. Log as rpc_error for observability.
    await emit({
      event: "season activation_failed",
      workspace_id: nonEmpty(profile.workspaceId, "workspace_id"),
      actor_id: nonEmpty(profile.profileId, "actor_id"),
      properties: {
        entity,
        data: { reason: "rpc_error" },
      },
    });
    return { ok: false, error: "rpc_error" };
  }

  // ── Success path (Invariant 3 — single `season activated` emit) ──
  const departmentsAffected = response.departments_affected ?? 0;
  const rowsGenerated = response.rows_generated ?? 0;
  const rowsNewlyInserted = response.rows_newly_inserted ?? 0;
  const archivedSeasonId = response.archived_season_id ?? null;
  const skipped = response.skipped === true;

  // Idempotent skip (already-active): final state matches requested
  // state, so the workspace model is consistent. We treat this as a
  // successful activation for telemetry — departments_affected=0 and
  // had_existing_hours=true signal "no-op" downstream.
  const hadExistingHours = skipped ? true : rowsGenerated === 0 && departmentsAffected > 0;

  // M5.5 phantom-consumer fix — the RPC's Step 1 archives the
  // previously-active season atomically inside the same transaction.
  // Emit `season archived` for that displaced row BEFORE the
  // `season activated` emit for the target. NULL when no season
  // was previously active (first-ever activation, or all drafts).
  if (archivedSeasonId) {
    await emit({
      event: "season archived",
      workspace_id: nonEmpty(profile.workspaceId, "workspace_id"),
      actor_id: nonEmpty(profile.profileId, "actor_id"),
      properties: {
        entity: { entity_type: "season", entity_id: archivedSeasonId },
        data: { status: "archived" },
      },
    });
  }

  await emit({
    event: "season activated",
    workspace_id: nonEmpty(profile.workspaceId, "workspace_id"),
    actor_id: nonEmpty(profile.profileId, "actor_id"),
    properties: {
      entity,
      data: {
        status: "active",
        departments_affected: departmentsAffected,
        rows_generated: rowsGenerated,
        had_existing_hours: hadExistingHours,
      },
    },
  });

  // D1 fanout signal — only when the trigger actually inserted new rows.
  // `rows_newly_inserted` is the authoritative delta (post-trigger minus
  // pre-trigger count) from the RPC per the 20260518040001 migration.
  // Re-activating a previously-archived season short-circuits the
  // trigger's NOT EXISTS guard (rows already exist for this season_id),
  // yielding rows_newly_inserted=0 even when rows_generated>0. Emitting
  // `operating_hours_generated` in that case is an ADR-0196 Invariant 11
  // class phantom-artefact claim — guard against it here.
  if (rowsNewlyInserted > 0) {
    await emit({
      event: "season operating_hours_generated",
      workspace_id: nonEmpty(profile.workspaceId, "workspace_id"),
      actor_id: nonEmpty(profile.profileId, "actor_id"),
      properties: {
        entity,
        data: {
          departments_affected: departmentsAffected,
          rows_generated: rowsGenerated,
          rows_newly_inserted: rowsNewlyInserted,
          source: "auto_copy_on_activate_trigger",
        },
      },
    });
  }

  if (skipped) {
    return {
      ok: true,
      season_id: seasonId,
      departments_affected: 0,
      rows_generated: 0,
      rows_newly_inserted: 0,
      ...(archivedSeasonId ? { archived_season_id: archivedSeasonId } : {}),
      skipped: true,
      reason: response.reason ?? "already_active",
    };
  }

  return {
    ok: true,
    season_id: seasonId,
    departments_affected: departmentsAffected,
    rows_generated: rowsGenerated,
    rows_newly_inserted: rowsNewlyInserted,
    ...(archivedSeasonId ? { archived_season_id: archivedSeasonId } : {}),
  };
}
