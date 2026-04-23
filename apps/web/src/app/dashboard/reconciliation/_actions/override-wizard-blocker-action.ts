"use server";

import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";
import { emit, nonEmpty } from "@smartout/telemetry";
import { resolveCurrentProfile, gateAction } from "@/app/dashboard/_actions/_shared";

/**
 * overrideWizardBlockerAction — M2 admin override of wizard preflight blocker.
 *
 * Clone of overrideReconciliationAction but targets the wizard-level
 * blocker path. Invariant #9: admin may submit a reconciliation even
 * when wizard preflight surfaces a blocker (e.g. missing cash count,
 * missing HACCP deviation resolution) — as long as a 20+ char reason
 * is supplied and the override is audit-tagged.
 *
 * Authority:
 *   - gate_action RPC with capability=`reconciliation.wizard_submit_with_blocker`
 *     (seeded confirm, admin floor — ADR-0189).
 *
 * Differs from overrideReconciliationAction in two ways:
 *   1. Targets wizard preflight flow (status 'open' → 'submitted' with
 *      [OVERRIDE BLOCKER] prefix), not post-submit admin approval.
 *   2. Capability is wizard_submit_with_blocker, not override.
 */
const InputSchema = z.object({
  sessionId: z.string().uuid(),
  reason: z.string().min(20, "Begrunnelse må være minst 20 tegn."),
  blockerCodes: z.array(z.string().min(1).max(64)).min(1, "Blokkeringskode(r) må oppgis."),
});

export type OverrideWizardBlockerInput = z.infer<typeof InputSchema>;

export type OverrideWizardBlockerResult =
  | { ok: true; reconciliationId: string }
  | { ok: false; error: string };

export async function overrideWizardBlockerAction(
  input: OverrideWizardBlockerInput,
): Promise<OverrideWizardBlockerResult> {
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

  // Resolve session → recon.
  const { data: session, error: sessionError } = await admin
    .from("department_session")
    .select("department_session_id, workspace_id, duty_leader_id, opened_by")
    .eq("department_session_id", parsed.data.sessionId)
    .maybeSingle();

  if (sessionError || !session) {
    return { ok: false, error: "Fant ikke økt." };
  }
  if (session.workspace_id !== profile.workspaceId) {
    return { ok: false, error: "Økt tilhører annet workspace." };
  }

  const { data: recon, error: reconError } = await admin
    .from("daily_reconciliation")
    .select("reconciliation_id, status, approval_notes")
    .eq("session_id", parsed.data.sessionId)
    .maybeSingle();

  if (reconError) {
    return { ok: false, error: "Kunne ikke lese avstemming." };
  }
  if (!recon) {
    return { ok: false, error: "Ingen avstemming å overstyre." };
  }
  if (recon.status === "approved" || recon.status === "locked") {
    return { ok: false, error: "Avstemming er allerede godkjent." };
  }

  // Authority gate — admin + confirm, via seeded capability.
  const gate = await gateAction({
    workspaceId: session.workspace_id,
    capability: "reconciliation.wizard_submit_with_blocker",
    channel: "chat",
    actorProfileId: profile.profileId,
    actionType: "submitted",
    entityId: recon.reconciliation_id,
  });

  if (!gate.allow) {
    return {
      ok: false,
      error: gate.reason ?? "Ikke autorisert for å overstyre blokker.",
    };
  }

  const now = new Date().toISOString();
  const blockerList = parsed.data.blockerCodes.join(", ");
  const overrideNotes = `[OVERRIDE BLOCKER: ${blockerList}] ${parsed.data.reason}`;

  const { error: updateError } = await admin
    .from("daily_reconciliation")
    .update({
      status: "submitted",
      settled_by: profile.profileId,
      settled_at: now,
      approval_notes: overrideNotes,
      updated_at: now,
    })
    .eq("reconciliation_id", recon.reconciliation_id);

  if (updateError) {
    return { ok: false, error: "Kunne ikke oppdatere avstemming." };
  }

  // Emit admin_action with override tag — activity_trail picks up override=true
  // via the approval_notes `[OVERRIDE BLOCKER]` prefix + event metadata.
  await emit({
    event: "reconciliation admin_action",
    workspace_id: nonEmpty(session.workspace_id, "workspace_id"),
    actor_id: nonEmpty(profile.profileId, "actor_id"),
    properties: {
      data: {
        reconciliation_id: recon.reconciliation_id,
        action: "approved",
      },
    },
  });

  return { ok: true, reconciliationId: recon.reconciliation_id };
}
