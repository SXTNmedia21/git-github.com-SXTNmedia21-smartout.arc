"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@smartout/supabase/admin";
import { IssueCreditNoteInputSchema } from "@smartout/billing";
import { emit, nonEmpty } from "@smartout/telemetry";
import { getSuperAdminId } from "@/lib/platform-admin";

// Phase 7.3 — issueCreditNote
//
// Creates a NEW `invoice` row with invoice_type = 'credit_note' and
// credits_invoice_id linking to the original. Amounts are stored as
// positive numbers (ADR-0120 §8) — the credit_note type flag is the
// accounting-sign switch for consuming code.
//
// Nested credit notes are blocked at the DB level by the
// prevent_nested_credit_notes trigger (Task 1.4). We also guard here
// for a clean error message instead of a trigger exception bubbling
// up as a generic 500.
//
// VAT rate is mirrored from the original invoice (not a hardcoded
// constant) so historical rates + future rate changes propagate
// correctly to credit notes.

export async function issueCreditNote(rawInput: unknown): Promise<
  | {
      ok: true;
      credit_note_id: string;
      invoice_number: number | null;
    }
  | { ok: false; error: string }
> {
  const adminId = await getSuperAdminId();
  if (!adminId) return { ok: false, error: "unauthorized" };

  const parsed = IssueCreditNoteInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid_input" };
  }
  const input = parsed.data;

  const supabase = createAdminClient();

  const { data: original, error: loadErr } = await supabase
    .from("invoice")
    .select(
      "invoice_id, company_id, invoice_type, status, period_from, period_to, currency, vat_rate",
    )
    .eq("invoice_id", input.original_invoice_id)
    .maybeSingle();

  if (loadErr) {
    console.error("[issueCreditNote] load failed:", loadErr);
    return { ok: false, error: loadErr.message };
  }
  if (!original) {
    return { ok: false, error: "original_invoice_not_found" };
  }
  if (original.invoice_type === "credit_note") {
    return { ok: false, error: "cannot_credit_a_credit_note" };
  }
  const crediable = ["issued", "sent", "paid", "overdue"] as const;
  if (!crediable.includes(original.status as (typeof crediable)[number])) {
    return {
      ok: false,
      error: `status_not_creditable:${original.status}`,
    };
  }

  // Inclusive amount -> split into excl_vat + vat_amount components
  // consistent with invoice.amount_* columns. VAT rate mirrors the
  // original invoice (NOT a hardcoded constant — historical rates
  // carry through; future rate changes stay consistent per invoice).
  const vat_rate = Number(original.vat_rate);
  const amount_incl_vat = round2(input.amount);
  const amount_excl_vat = round2(amount_incl_vat / (1 + vat_rate / 100));
  const vat_amount = round2(amount_incl_vat - amount_excl_vat);

  const { data: creditNote, error: insErr } = await supabase
    .from("invoice")
    .insert({
      company_id: original.company_id,
      invoice_type: "credit_note",
      status: "issued",
      credits_invoice_id: original.invoice_id,
      period_from: original.period_from,
      period_to: original.period_to,
      amount_excl_vat,
      vat_rate,
      vat_amount,
      amount_incl_vat,
      currency: original.currency,
      void_reason: `${input.reason}: ${input.reason_detail}`,
      created_by: adminId,
    })
    .select("invoice_id, invoice_number")
    .maybeSingle();

  if (insErr) {
    console.error("[issueCreditNote] insert failed:", insErr);
    return { ok: false, error: insErr.message };
  }
  if (!creditNote) {
    return { ok: false, error: "credit_note_insert_failed" };
  }

  await emit({
    event: "invoice credit_note_issued",
    actor_id: nonEmpty(adminId, "actor_id"),
    workspace_id: null,
    properties: {
      entity_type: "invoice",
      entity_id: creditNote.invoice_id,
      data: {
        original_invoice_id: original.invoice_id,
        amount_incl_vat,
        reason: input.reason,
      },
    },
  });

  revalidatePath("/platform-admin/billing/invoices");
  revalidatePath(`/platform-admin/billing/invoices/${original.invoice_id}`);
  revalidatePath(`/platform-admin/billing/invoices/${creditNote.invoice_id}`);

  return {
    ok: true,
    credit_note_id: creditNote.invoice_id,
    invoice_number: creditNote.invoice_number,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
