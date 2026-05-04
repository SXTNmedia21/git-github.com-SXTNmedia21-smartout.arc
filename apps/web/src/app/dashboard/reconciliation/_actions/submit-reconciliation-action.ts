"use server";

import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";
import { emit, nonEmpty } from "@smartout/telemetry";
import { resolveCurrentProfile, gateAction } from "@/app/dashboard/_actions/_shared";

/**
 * submitReconciliationAction — M2 clockout-wizard final submit.
 *
 * Transitions `daily_reconciliation.status` from 'open' → 'submitted'
 * after the shift leader confirms the wizard summary (Step 05 → 06).
 * Writes a `session_note(note_type='closing')` carrying a concise
 * generated summary of the wizard snapshot for audit reconstruction.
 *
 * Authority:
 *   - gate_action RPC with capability=`reconciliation.submit`
 *     (seeded confirm, manager floor — ADR-0189).
 *   - Role check: duty_leader_id ?? opened_by must match actor.
 *
 * Telemetry:
 *   - emit("reconciliation submitted")
 */
const WizardSnapshotSchema = z
  .object({
    revenue_total: z.number().optional(),
    revenue_cash: z.number().optional(),
    revenue_card: z.number().optional(),
    revenue_transactions: z.number().optional(),
    deviations_count: z.number().optional(),
    tips_total: z.number().optional(),
    notes: z.string().optional(),
  })
  .passthrough();

const InputSchema = z.object({
  sessionId: z.string().uuid(),
  wizardSnapshot: WizardSnapshotSchema,
});

export type SubmitReconciliationInput = z.infer<typeof InputSchema>;

export type SubmitReconciliationResult =
  | { ok: true; reconciliationId: string }
  | { ok: false; error: string };

function buildClosingSummary(snapshot: z.infer<typeof WizardSnapshotSchema>): string {
  const parts: string[] = [];
  if (typeof snapshot.revenue_total === "number") {
    parts.push(`Omsetning: ${snapshot.revenue_total.toFixed(0)} kr`);
  }
  if (typeof snapshot.revenue_cash === "number") {
    parts.push(`Kontant: ${snapshot.revenue_cash.toFixed(0)} kr`);
  }
  if (typeof snapshot.revenue_card === "number") {
    parts.push(`Kort: ${snapshot.revenue_card.toFixed(0)} kr`);
  }
  if (typeof snapshot.deviations_count === "number") {
    parts.push(`Avvik: ${snapshot.deviations_count}`);
  }
  if (snapshot.notes && snapshot.notes.trim().length > 0) {
    parts.push(`Notat: ${snapshot.notes.trim()}`);
  }
  return parts.length ? parts.join(" · ") : "Avstemming fullført.";
}

export async function submitReconciliationAction(
  input: SubmitReconciliationInput,
): Promise<SubmitReconciliationResult> {
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

  // Resolve session + role.
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

  const effectiveLeader = session.duty_leader_id ?? session.opened_by;
  if (effectiveLeader !== profile.profileId) {
    return { ok: false, error: "Bare vaktleder kan sende inn avstemming." };
  }

  // Resolve reconciliation row.
  const { data: recon, error: reconError } = await admin
    .from("daily_reconciliation")
    .select("reconciliation_id, status")
    .eq("session_id", parsed.data.sessionId)
    .maybeSingle();

  if (reconError) {
    return { ok: false, error: "Kunne ikke lese avstemming." };
  }
  if (!recon) {
    return { ok: false, error: "Ingen avstemming å sende inn — start wizard først." };
  }
  if (recon.status !== "open") {
    return { ok: false, error: `Avstemming er allerede i status '${recon.status}'.` };
  }

  // Authority gate — seeded confirm, manager floor.
  const gate = await gateAction({
    workspaceId: session.workspace_id,
    capability: "reconciliation.submit",
    channel: "chat",
    actorProfileId: profile.profileId,
    actionType: "submitted",
    entityId: recon.reconciliation_id,
  });

  if (!gate.allow) {
    return {
      ok: false,
      error: gate.reason ?? "Ikke autorisert for å sende inn avstemming.",
    };
  }

  const now = new Date().toISOString();
  const summary = buildClosingSummary(parsed.data.wizardSnapshot);

  const { error: updateError } = await admin
    .from("daily_reconciliation")
    .update({
      status: "submitted",
      settled_by: profile.profileId,
      settled_at: now,
      updated_at: now,
    })
    .eq("reconciliation_id", recon.reconciliation_id);

  if (updateError) {
    return { ok: false, error: "Kunne ikke oppdatere avstemming." };
  }

  // Insert closing session_note for audit reconstruction.
  const { error: noteError } = await admin.from("session_note").insert({
    workspace_id: session.workspace_id,
    department_session_id: session.department_session_id,
    note_type: "closing",
    content: summary,
    created_by: profile.profileId,
  });
  if (noteError) {
    // Non-fatal — the submission is durable; note is audit-supplementary.
    // Log via emit for visibility but do not roll back.
    console.warn("[submitReconciliationAction] session_note insert failed", noteError);
  }

  await emit({
    event: "reconciliation submitted",
    workspace_id: nonEmpty(session.workspace_id, "workspace_id"),
    actor_id: nonEmpty(profile.profileId, "actor_id"),
    properties: {
      data: {
        reconciliation_id: recon.reconciliation_id,
      },
    },
  });

  return { ok: true, reconciliationId: recon.reconciliation_id };
}
