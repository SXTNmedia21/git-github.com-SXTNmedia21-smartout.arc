"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@smartout/supabase/admin";
import { AddDunningNoteInputSchema } from "@smartout/billing";
import { emit, nonEmpty } from "@smartout/telemetry";
import { getSuperAdminId } from "@/lib/platform-admin";

// Phase 7.5 — addDunningNote
//
// Dunning notes live in billing_activity_log (ADR-0125) — the provider
// writes the row when we emit 'dunning_note added'. The invoice row
// itself only needs a light touch: if dunning_status is currently
// 'none' (or NULL), promote it to 'in_negotiation' so the list view
// shows the customer is in the dunning funnel.
//
// We never demote dunning_status here — escalation is a separate
// action. The CHECK constraint relaxed in P1.5 permits any
// dunning_status on active invoice statuses.

export async function addDunningNote(
  rawInput: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const adminId = await getSuperAdminId();
  if (!adminId) return { ok: false, error: "unauthorized" };

  const parsed = AddDunningNoteInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid_input" };
  }
  const input = parsed.data;

  const supabase = createAdminClient();

  const { data: existing, error: loadErr } = await supabase
    .from("invoice")
    .select("invoice_id, company_id, status, dunning_status")
    .eq("invoice_id", input.invoice_id)
    .maybeSingle();

  if (loadErr) {
    console.error("[addDunningNote] load failed:", loadErr);
    return { ok: false, error: loadErr.message };
  }
  if (!existing) {
    return { ok: false, error: "invoice_not_found" };
  }

  // If dunning_status is null or 'none', promote to in_negotiation.
  // Active invoice statuses only — skip on terminal.
  const activeStatuses = ["issued", "sent", "overdue"] as const;
  const isActive = activeStatuses.includes(existing.status as (typeof activeStatuses)[number]);
  if (isActive && (existing.dunning_status === null || existing.dunning_status === "none")) {
    const { error: bumpErr } = await supabase
      .from("invoice")
      .update({ dunning_status: "in_negotiation" })
      .eq("invoice_id", existing.invoice_id);
    if (bumpErr) {
      console.warn("[addDunningNote] dunning_status bump failed (non-fatal):", bumpErr.message);
    }
  }

  // Emit the audit row via the shared pipeline (billing_activity_log
  // provider writes the row, denormalises invoice_id, validates
  // company_id against the DB — no cross-tenant spoof risk).
  await emit({
    event: "dunning_note added",
    actor_id: nonEmpty(adminId, "actor_id"),
    workspace_id: null,
    properties: {
      entity_type: "invoice",
      entity_id: existing.invoice_id,
      data: {
        note: input.note,
      },
    },
  });

  revalidatePath("/platform-admin/billing/invoices");
  revalidatePath(`/platform-admin/billing/invoices/${existing.invoice_id}`);

  return { ok: true };
}
