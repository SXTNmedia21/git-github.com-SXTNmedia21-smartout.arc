"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@smartout/supabase/admin";
import { WriteOffUncollectibleInputSchema } from "@smartout/billing";
import { emit } from "@smartout/telemetry";
import { getSuperAdminId } from "@/lib/platform-admin";

// Phase 7.4 — markInvoiceUncollectible
//
// Writes an invoice off as uncollectible. Only transitions from
// 'overdue' are permitted — the assumption is that the dunning
// funnel has been exhausted before giving up on collection.
//
// Permitted transitions: overdue → uncollectible.
// `dunning_status` is cleared because uncollectible is a terminal
// state (ADR-0120 + P1.5 CHECK: terminal statuses require
// dunning_status IS NULL).

export async function markInvoiceUncollectible(
  rawInput: unknown,
): Promise<{ ok: true; invoice_id: string } | { ok: false; error: string }> {
  const adminId = await getSuperAdminId();
  if (!adminId) return { ok: false, error: "unauthorized" };

  const parsed = WriteOffUncollectibleInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "invalid_input",
    };
  }
  const input = parsed.data;

  const supabase = createAdminClient();

  const { data: existing, error: loadErr } = await supabase
    .from("invoice")
    .select("invoice_id, company_id, status, invoice_number")
    .eq("invoice_id", input.invoice_id)
    .maybeSingle();

  if (loadErr) {
    console.error("[markInvoiceUncollectible] load failed:", loadErr);
    return { ok: false, error: loadErr.message };
  }
  if (!existing) {
    return { ok: false, error: "invoice_not_found" };
  }
  if (existing.status !== "overdue") {
    return {
      ok: false,
      error: `only_overdue_invoices_are_write_offable:${existing.status}`,
    };
  }

  const { data, error } = await supabase
    .from("invoice")
    .update({
      status: "uncollectible",
      dunning_status: null, // terminal state per P1.5 CHECK
      void_reason: `${input.reason}: ${input.reason_detail}`,
    })
    .eq("invoice_id", input.invoice_id)
    .eq("status", "overdue")
    .select("invoice_id, company_id")
    .maybeSingle();

  if (error) {
    console.error("[markInvoiceUncollectible] update failed:", error);
    return { ok: false, error: error.message };
  }
  if (!data) {
    return { ok: false, error: "write_off_failed_race_or_missing" };
  }

  await emit({
    event: "invoice marked_uncollectible",
    actor_id: adminId,
    workspace_id: null,
    properties: {
      entity_type: "invoice",
      entity_id: data.invoice_id,
      data: {
        company_id: data.company_id,
        reason: input.reason,
        reason_detail: input.reason_detail,
      },
    },
  });

  revalidatePath("/platform-admin/billing/invoices");
  revalidatePath(`/platform-admin/billing/invoices/${data.invoice_id}`);
  revalidatePath("/platform-admin/billing/dunning");

  return { ok: true, invoice_id: data.invoice_id };
}
