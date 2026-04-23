"use server";

import { createAdminClient } from "@smartout/supabase/admin";
import { resolveCurrentProfile, gateAction } from "./_shared";

/**
 * archiveSeasonAction — soft state change from draft|active → archived.
 *
 * Flow (M4 / L-0074):
 * 1. `resolveCurrentProfile()` — ADR-0151 server-side re-derivation.
 * 2. `gateAction({capability: 'season.archive', ...})` — seeded by
 *    migration `20260518030000_season_archive_duplicate_authority_seed.sql`.
 * 3. Validate season exists + current status ∈ {draft, active}.
 *    (`archived` → archived is a no-op but still returns ok:true.)
 * 4. `UPDATE season SET status='archived'` scoped by workspace_id.
 *
 * No telemetry emit in M4 — archive is a reversible admin operation and
 * season status-change downstream triggers (`trg_season_activated`) only
 * fire on status→active, not on status→archived. Deferred to a later
 * milestone if analytics value emerges.
 *
 * Invariant compliance:
 *  - I2 (gate-before-mutation, ADR-0099/ADR-0196): gateAction call precedes
 *    UPDATE; no other path reaches the mutation from application code.
 *  - I11 (no phantom-ok, ADR-0196): returns `{ok:false}` when gate denies
 *    or the row does not exist; no emit on the denied paths.
 */
export type ArchiveSeasonResult =
  | { ok: true; season_id: string; was_already_archived: boolean }
  | {
      ok: false;
      error: "unauthenticated" | "insufficient_authority" | "season_not_found" | "db_error";
    };

export async function archiveSeasonAction(seasonId: string): Promise<ArchiveSeasonResult> {
  const profile = await resolveCurrentProfile();
  if (!profile) return { ok: false, error: "unauthenticated" };

  const admin = createAdminClient();

  // ── Authority gate ───────────────────────────────────────────────
  /* @authority-gate-literal — capability: 'season.archive' */
  const gate = await gateAction({
    workspaceId: profile.workspaceId,
    capability: "season.archive",
    channel: "chat",
    actorProfileId: profile.profileId,
    actionType: "archive",
    entityId: seasonId,
  });
  if (!gate.allow) {
    return { ok: false, error: "insufficient_authority" };
  }

  // ── Fetch current season (tenant-scoped) ─────────────────────────
  const { data: current, error: fetchError } = await admin
    .from("season")
    .select("season_id, status")
    .eq("season_id", seasonId)
    .eq("workspace_id", profile.workspaceId)
    .maybeSingle();

  if (fetchError || !current) {
    return { ok: false, error: "season_not_found" };
  }

  // Idempotent short-circuit — already archived.
  if (current.status === "archived") {
    return { ok: true, season_id: seasonId, was_already_archived: true };
  }

  // ── Mutation ─────────────────────────────────────────────────────
  const { error: updateError } = await admin
    .from("season")
    .update({ status: "archived" })
    .eq("season_id", seasonId)
    .eq("workspace_id", profile.workspaceId);

  if (updateError) {
    return { ok: false, error: "db_error" };
  }

  return { ok: true, season_id: seasonId, was_already_archived: false };
}
