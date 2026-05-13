"use server";

/**
 * confirmShiftAction — Server Action for confirming a schedule_shift.
 *
 * Per ADR-0298 + Spec §4.3:
 * - schedule_shift PK is schedule_shift_id (NOT id)
 * - schedule_shift has confirmed_at + confirmed_by columns
 * - Actor column is employee_id (NOT assigned_to or profile_id)
 * - Identity pre-resolved via ResolvedActor (ADR-0151)
 * - Idempotent: confirmed_at already set → 200 with shiftId
 * - Fail-fast on missing row / workspace mismatch (L-0177)
 *
 * References: ADR-0099, ADR-0114, ADR-0134, ADR-0151, ADR-0298.
 */
import { createAdminClient } from "@smartout/supabase/admin";
import { emit, nonEmpty } from "@smartout/telemetry";

import { gateAction } from "./_shared";
import type { ResolvedActor } from "@/app/api/mobile/_shared/actor";

export type ConfirmShiftResult = { ok: true; shiftId: string } | { ok: false; error: string };

export async function confirmShiftAction(
  shiftId: string,
  actor: ResolvedActor,
  channel: "chat" | "voice" | "system" = "chat",
): Promise<ConfirmShiftResult> {
  const admin = createAdminClient();

  // 1. Load row — fail-fast on missing / wrong workspace (L-0177).
  const { data: row, error: loadErr } = await admin
    .from("schedule_shift")
    .select("workspace_id, employee_id, confirmed_at")
    .eq("schedule_shift_id", shiftId)
    .maybeSingle();

  if (loadErr) {
    return { ok: false, error: `Kunne ikke laste vakten: ${loadErr.message}` };
  }
  if (!row) {
    return { ok: false, error: "Vakten finnes ikke." };
  }
  if (row.workspace_id !== actor.workspaceId) {
    return { ok: false, error: "Vakten tilhører et annet arbeidsrom." };
  }

  // 2. Idempotency — already confirmed.
  if (row.confirmed_at) {
    return { ok: true, shiftId };
  }

  // 3. Gate check.
  /* @authority-gate: capability='schedule.confirm_shift' level='suggest' seed='20260604121000_sortie_1_gate_action_seed.sql' */
  const gate = await gateAction({
    workspaceId: actor.workspaceId,
    capability: "schedule.confirm_shift",
    channel,
    actorProfileId: actor.profileId,
    actionType: "confirm",
    entityId: shiftId,
  });

  if (!gate.allow) {
    return { ok: false, error: gate.reason ?? "Ikke autorisert." };
  }

  // 4. Gated UPDATE.
  const now = new Date().toISOString();
  const { error: updateErr } = await admin
    .from("schedule_shift")
    .update({ confirmed_at: now, confirmed_by: actor.profileId })
    .eq("schedule_shift_id", shiftId);

  if (updateErr) {
    return { ok: false, error: `Kunne ikke bekrefte vakten: ${updateErr.message}` };
  }

  // 5. Telemetry — canonical "shift confirmed" event (registry.ts:996).
  void emit({
    event: "shift confirmed",
    workspace_id: nonEmpty(actor.workspaceId, "workspace_id"),
    actor_id: nonEmpty(actor.profileId, "actor_id"),
    properties: {
      entity: {
        entity_type: "schedule_shift",
        entity_id: shiftId,
      },
      metadata: {
        source: "session",
        channel,
      },
    },
  });

  return { ok: true, shiftId };
}
