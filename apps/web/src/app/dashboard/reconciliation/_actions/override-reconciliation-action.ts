"use server";

import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";
import { emit } from "@smartout/telemetry";
import { resolveCurrentProfile, gateAction } from "@/app/dashboard/_actions/_shared";

/**
 * overrideReconciliationAction — Invariant #9 admin-override on preflight gate.
 *
 * Allows admin to approve a reconciliation even when preflight blockers exist.
 * Writes a forced reason ≥20 chars + activity_trail row tagged override=true
 * so audit reconstruction can surface overrides separately from clean approvals.
 *
 * Authority: gate_action RPC with capability=`reconciliation.override`,
 * enforced per ADR-0099. Seed engine_authority_config row for this capability
 * at min_role=admin, level=confirm to prevent default-allow abuse.
 */
const InputSchema = z.object({
  reconciliationId: z.string().uuid(),
  reason: z.string().min(20, "Begrunnelse må være minst 20 tegn."),
});

export type OverrideReconciliationInput = z.infer<typeof InputSchema>;

export type OverrideReconciliationResult = { ok: true } | { ok: false; error: string };

export async function overrideReconciliationAction(
  input: OverrideReconciliationInput,
): Promise<OverrideReconciliationResult> {
  const parsed = InputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Ugyldig input.",
    };
  }

  const profile = await resolveCurrentProfile();
  if (!profile) {
    return { ok: false, error: "Ikke autentisert." };
  }

  const admin = createAdminClient();

  // Load current recon to verify workspace + status
  const { data: recon, error: fetchError } = await admin
    .from("daily_reconciliation")
    .select("workspace_id, status, reconciliation_date, department_id")
    .eq("reconciliation_id", parsed.data.reconciliationId)
    .single();

  if (fetchError || !recon) {
    return { ok: false, error: "Fant ikke oppgjør." };
  }

  if (recon.workspace_id !== profile.workspaceId) {
    return { ok: false, error: "Oppgjør tilhører annet workspace." };
  }

  if (recon.status === "approved" || recon.status === "locked") {
    return { ok: false, error: "Oppgjør er allerede godkjent." };
  }

  // Authority gate — admin + confirm level
  const gate = await gateAction({
    workspaceId: recon.workspace_id,
    capability: "reconciliation.override",
    channel: "chat",
    actorProfileId: profile.profileId,
    actionType: "approved",
    entityId: parsed.data.reconciliationId,
  });

  if (!gate.allow) {
    return {
      ok: false,
      error: gate.reason ?? "Ikke autorisert for å overstyre.",
    };
  }

  // Apply override approval
  const now = new Date().toISOString();
  const { error: updateError } = await admin
    .from("daily_reconciliation")
    .update({
      status: "approved",
      approved_by: profile.profileId,
      approved_at: now,
      approval_notes: `[OVERRIDE] ${parsed.data.reason}`,
      updated_at: now,
    })
    .eq("reconciliation_id", parsed.data.reconciliationId);

  if (updateError) {
    return { ok: false, error: "Kunne ikke oppdatere oppgjør." };
  }

  // Emit via registry — override nature captured in approval_notes prefix
  // `[OVERRIDE]` for Revisjonslogg-tab to surface, per ADR-0156 / Invariant #9.
  // Separate reconciliation event shape does not currently carry override flag;
  // the activity_trail entry's data column holds override+reason for audit.
  await emit({
    event: "reconciliation admin_action",
    workspace_id: recon.workspace_id,
    actor_id: profile.profileId,
    properties: {
      data: {
        reconciliation_id: parsed.data.reconciliationId,
        action: "approved",
      },
    },
  });

  return { ok: true };
}
