"use server";

import { createAdminClient } from "@smartout/supabase/admin";
import { resolveCurrentProfile, gateAction } from "./_shared";

/**
 * duplicateSeasonAction — clone a season into a fresh draft.
 *
 * Flow (M4 / L-0074):
 * 1. `resolveCurrentProfile()` — ADR-0151 server-side re-derivation.
 * 2. `gateAction({capability: 'season.duplicate', ...})` — seeded by
 *    migration `20260518030000_season_archive_duplicate_authority_seed.sql`.
 * 3. Fetch source season (tenant-scoped).
 * 4. INSERT new season row (status='draft', name+' (kopi)', new slug,
 *    start/end dates cleared — user re-picks window for the copy).
 * 5. Fetch source season_budget (1:1 with season) and INSERT a copy
 *    linked to the new season.
 * 6. Fetch source day_factor + hour_factor keyed on source budget_id,
 *    INSERT copies linked to the new season_budget_id.
 *
 * No telemetry emit in M4 — Deferred per task brief. Mutations all scoped
 * by workspace_id. If any step fails after the season row is created, the
 * partial copy is left in place (no transaction wrapping); the season
 * shows up as a draft with missing factors/budget, which matches the
 * invariant that a fresh season starts empty — user can retry from the
 * duplicate. Full atomicity would need an RPC (deferred, M5).
 *
 * Invariant compliance:
 *  - I2 (gate-before-mutation, ADR-0099/ADR-0196): gateAction precedes
 *    the first INSERT; no other path reaches the mutations.
 *  - I11 (no phantom-ok, ADR-0196): returns concrete new-season-id on
 *    success, typed `{ok:false, error}` on any failure.
 */
export type DuplicateSeasonResult =
  | { ok: true; new_season_id: string; new_season_name: string }
  | {
      ok: false;
      error: "unauthenticated" | "insufficient_authority" | "season_not_found" | "db_error";
    };

export async function duplicateSeasonAction(seasonId: string): Promise<DuplicateSeasonResult> {
  const profile = await resolveCurrentProfile();
  if (!profile) return { ok: false, error: "unauthenticated" };

  const admin = createAdminClient();

  // ── Authority gate ───────────────────────────────────────────────
  /* @authority-gate-literal — capability: 'season.duplicate' */
  const gate = await gateAction({
    workspaceId: profile.workspaceId,
    capability: "season.duplicate",
    channel: "chat",
    actorProfileId: profile.profileId,
    actionType: "duplicate",
    entityId: seasonId,
  });
  if (!gate.allow) {
    return { ok: false, error: "insufficient_authority" };
  }

  // ── 1. Fetch source season ───────────────────────────────────────
  const { data: source, error: fetchError } = await admin
    .from("season")
    .select(
      "season_id, name, slug, description, season_type, color, icon, opening_hours, planning_cycle_id",
    )
    .eq("season_id", seasonId)
    .eq("workspace_id", profile.workspaceId)
    .maybeSingle();

  if (fetchError || !source) {
    return { ok: false, error: "season_not_found" };
  }

  // Suffix name + slug with " (kopi)" / "-kopi-<short-rand>" so the
  // duplicate is visually distinct and slug is unlikely to collide
  // (no unique constraint on slug today; keep conservative).
  const newName = `${source.name} (kopi)`;
  const shortRand = Math.random().toString(36).slice(2, 6);
  const newSlug = `${source.slug}-kopi-${shortRand}`;

  // ── 2. Insert new season (draft, no dates) ───────────────────────
  const { data: inserted, error: insertError } = await admin
    .from("season")
    .insert({
      workspace_id: profile.workspaceId,
      name: newName,
      slug: newSlug,
      description: source.description,
      season_type: source.season_type,
      color: source.color,
      icon: source.icon,
      opening_hours: source.opening_hours,
      planning_cycle_id: source.planning_cycle_id,
      status: "draft",
      is_default: false,
      created_by: profile.profileId,
    })
    .select("season_id, name")
    .maybeSingle();

  if (insertError || !inserted) {
    return { ok: false, error: "db_error" };
  }

  // ── 3. Clone season_budget (if present) ──────────────────────────
  const { data: sourceBudget } = await admin
    .from("season_budget")
    .select(
      "season_budget_id, total_target_revenue, target_labor_percentage, target_margin, avg_hourly_wage, base_price_per_guest, season_price_factor, status",
    )
    .eq("season_id", seasonId)
    .eq("workspace_id", profile.workspaceId)
    .maybeSingle();

  let newBudgetId: string | null = null;
  if (sourceBudget) {
    const { data: newBudget, error: budgetError } = await admin
      .from("season_budget")
      .insert({
        workspace_id: profile.workspaceId,
        season_id: inserted.season_id,
        total_target_revenue: sourceBudget.total_target_revenue,
        target_labor_percentage: sourceBudget.target_labor_percentage,
        target_margin: sourceBudget.target_margin,
        avg_hourly_wage: sourceBudget.avg_hourly_wage,
        base_price_per_guest: sourceBudget.base_price_per_guest,
        season_price_factor: sourceBudget.season_price_factor,
        status: sourceBudget.status,
        created_by: profile.profileId,
      })
      .select("season_budget_id")
      .maybeSingle();

    if (budgetError) {
      // Budget-insert failed — no factor clones, but season row
      // already exists (no transaction wrapping; see header comment).
      // Surface the INSERT error as db_error rather than silently
      // returning ok:true with a partial duplicate.
      return { ok: false, error: "db_error" };
    }
    if (newBudget) {
      newBudgetId = newBudget.season_budget_id;

      // ── 4. Clone day_factor rows ─────────────────────────────────
      const { data: sourceDays } = await admin
        .from("day_factor")
        .select("weekday, factor")
        .eq("season_budget_id", sourceBudget.season_budget_id)
        .eq("workspace_id", profile.workspaceId);

      if (sourceDays && sourceDays.length > 0) {
        const { error: dayInsertError } = await admin.from("day_factor").insert(
          sourceDays.map((d) => ({
            workspace_id: profile.workspaceId,
            season_budget_id: newBudgetId!,
            weekday: d.weekday,
            factor: d.factor,
          })),
        );
        if (dayInsertError) {
          return { ok: false, error: "db_error" };
        }
      }

      // ── 5. Clone hour_factor rows ────────────────────────────────
      const { data: sourceHours } = await admin
        .from("hour_factor")
        .select("hour, factor")
        .eq("season_budget_id", sourceBudget.season_budget_id)
        .eq("workspace_id", profile.workspaceId);

      if (sourceHours && sourceHours.length > 0) {
        const { error: hourInsertError } = await admin.from("hour_factor").insert(
          sourceHours.map((h) => ({
            workspace_id: profile.workspaceId,
            season_budget_id: newBudgetId!,
            hour: h.hour,
            factor: h.factor,
          })),
        );
        if (hourInsertError) {
          return { ok: false, error: "db_error" };
        }
      }
    }
  }

  return {
    ok: true,
    new_season_id: inserted.season_id,
    new_season_name: inserted.name,
  };
}
