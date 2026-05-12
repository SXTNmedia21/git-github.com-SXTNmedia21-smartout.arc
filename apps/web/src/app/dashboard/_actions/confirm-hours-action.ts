"use server";

/**
 * confirmHoursAction — Server Action for confirming a shift_approval.
 *
 * Per ADR-0298 + Spec §3.5 + §4.3:
 * - shift_approval PK is approval_id (NOT id)
 * - shift_approval has approved_at + approved_by columns
 * - Status enum: pending | approved | edited | disputed
 * - No direct profile column — JOIN through shift_id → schedule_shift.employee_id
 * - Identity pre-resolved via ResolvedActor (ADR-0151)
 * - Idempotent: status='approved' → 200 with approvalId
 * - Fail-fast on missing row / workspace mismatch (L-0177)
 * - Actor must be shift owner OR manager/admin/owner role
 *
 * References: ADR-0099, ADR-0114, ADR-0134, ADR-0151, ADR-0298.
 */
import { createAdminClient } from "@smartout/supabase/admin";
import { emit } from "@smartout/telemetry";

import { gateAction } from "./_shared";
import type { ResolvedActor } from "@/app/api/mobile/_shared/actor";

export type ConfirmHoursResult = { ok: true; approvalId: string } | { ok: false; error: string };

export async function confirmHoursAction(
  approvalId: string,
  actor: ResolvedActor,
  channel: "chat" | "voice" | "system" = "chat",
): Promise<ConfirmHoursResult> {
  const admin = createAdminClient();

  // 1. Load row with JOIN — fail-fast on missing / wrong workspace (L-0177).
  //    JOIN through shift_id → schedule_shift.employee_id for actor verification
  //    (no direct profile column on shift_approval).
  const { data: row, error: loadErr } = await admin
    .from("shift_approval")
    .select("workspace_id, shift_id, status, schedule_shift:shift_id(employee_id)")
    .eq("approval_id", approvalId)
    .maybeSingle();

  if (loadErr) {
    return { ok: false, error: `Kunne ikke laste timeoppgjøret: ${loadErr.message}` };
  }
  if (!row) {
    return { ok: false, error: "Timeoppgjøret finnes ikke." };
  }
  if (row.workspace_id !== actor.workspaceId) {
    return { ok: false, error: "Timeoppgjøret tilhører et annet arbeidsrom." };
  }

  // 2. Idempotency — already approved.
  if (row.status === "approved") {
    return { ok: true, approvalId };
  }

  // 3. Authorization — actor must own the shift OR be manager/admin/owner.
  const shiftEmployee = (row.schedule_shift as { employee_id: string } | null)?.employee_id;
  const isOwner = shiftEmployee === actor.profileId;
  const isManager = actor.role === "manager" || actor.role === "admin" || actor.role === "owner";
  if (!isOwner && !isManager) {
    return { ok: false, error: "Ikke autorisert: ikke din vakt." };
  }

  // 4. Gate check.
  /* @authority-gate: capability='timesheet.confirm_hours' level='suggest' seed='20260604121000_sortie_1_gate_action_seed.sql' */
  const gate = await gateAction({
    workspaceId: actor.workspaceId,
    capability: "timesheet.confirm_hours",
    channel,
    actorProfileId: actor.profileId,
    actionType: "confirm",
    entityId: approvalId,
  });

  if (!gate.allow) {
    return { ok: false, error: gate.reason ?? "Ikke autorisert." };
  }

  // 5. Gated UPDATE.
  const now = new Date().toISOString();
  const { error: updateErr } = await admin
    .from("shift_approval")
    .update({ status: "approved", approved_at: now, approved_by: actor.profileId })
    .eq("approval_id", approvalId);

  if (updateErr) {
    return { ok: false, error: `Kunne ikke bekrefte timeoppgjøret: ${updateErr.message}` };
  }

  // 6. Telemetry — canonical "hours confirmed" event (registry.ts:1007).
  void emit({
    event: "hours confirmed",
    workspace_id: actor.workspaceId,
    actor_id: actor.profileId,
    properties: {
      entity: {
        entity_type: "shift_approval",
        entity_id: approvalId,
      },
      metadata: {
        source: "session",
        channel,
      },
    },
  });

  return { ok: true, approvalId };
}
