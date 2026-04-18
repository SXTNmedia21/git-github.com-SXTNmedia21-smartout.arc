// issueCreditNoteForRefund — ADR-0133 auto credit-note generator,
// invoked by the stripe-webhook when a charge.refunded event fires.
//
// ADR-0133 describes the semantic behaviour (full refund = balances
// original; partial = credit for refund amount only). The STORAGE of
// credit-note amounts follows ADR-0120 §8 — POSITIVE numbers, with
// invoice_type='credit_note' as the accounting-sign flag. Consumer
// code (EHF export, Stripe sync, accounting reconciliation) negates
// at read time. This avoids the nested contradiction between ADR-0133
// (which describes negative numbers) and ADR-0120 (which is the
// foundational sign-storage rule). See handoff notes for deviation.
//
// The credit-note lifecycle:
//   1. Load original invoice + its line items
//   2. Compute VAT split from the refund amount + original VAT rate
//   3. INSERT new invoice row (invoice_type='credit_note',
//      credits_invoice_id=original, status='issued' so the sequence
//      trigger assigns an invoice_number immediately)
//   4. INSERT credit-note line items:
//      - Full: copy original line items 1:1 (same descriptions,
//        same amounts — sign-flip done at read time per ADR-0120 §8)
//      - Partial: single "Delvis refusjon — {stripe_refund_id}" line
//   5. Return the new credit_note invoice_id
//
// The caller (webhook handler) emits the `invoice credit_note_auto_created`
// event with the returned invoice_id.
//
// Ref: Fase 3A spec §3.4, ADR-0133, ADR-0120 §8.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@smartout/supabase";
import type { AdminActionResult } from "../_shared/withAdmin.types";

type BillingClient = SupabaseClient<Database>;

export type IssueCreditNoteForRefundArgs = {
  original_invoice_id: string;
  refund_amount: number;
  stripe_refund_id: string;
  is_full_refund: boolean;
};

export type IssueCreditNoteForRefundOutput = {
  credit_note_invoice_id: string;
  invoice_number: number | null;
  amount_incl_vat: number;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function issueCreditNoteForRefund(
  client: BillingClient,
  args: IssueCreditNoteForRefundArgs,
): Promise<AdminActionResult<IssueCreditNoteForRefundOutput>> {
  // 1. Load original invoice. We need company_id + period + VAT rate +
  //    currency to mirror onto the credit-note.
  const { data: original, error: loadErr } = await client
    .from("invoice")
    .select(
      "invoice_id, company_id, invoice_type, status, period_from, period_to, currency, delivery_channel, vat_rate, amount_excl_vat, vat_amount, amount_incl_vat",
    )
    .eq("invoice_id", args.original_invoice_id)
    .maybeSingle();

  if (loadErr) return { ok: false, error: loadErr.message, code: "internal_error" };
  if (!original) return { ok: false, error: "original_invoice_not_found", code: "not_found" };

  if (original.invoice_type === "credit_note") {
    // ADR-0120 no-nested-credit-notes trigger would reject the insert
    // anyway; we short-circuit for a cleaner error message.
    return { ok: false, error: "cannot_credit_a_credit_note", code: "conflict" };
  }

  // 2. Compute the credit-note amount split. For a FULL refund we mirror
  //    the original's amounts exactly (preserves VAT rounding). For a
  //    PARTIAL refund we compute from refund_amount + original VAT rate.
  const vat_rate = Number(original.vat_rate);
  let amount_incl_vat: number;
  let amount_excl_vat: number;
  let vat_amount: number;

  if (args.is_full_refund) {
    // Mirror original exactly. Avoids rounding drift where recomputing
    // from vat_rate could produce 999.99 vs original 1000.00.
    amount_incl_vat = Number(original.amount_incl_vat);
    amount_excl_vat = Number(original.amount_excl_vat);
    vat_amount = Number(original.vat_amount);
  } else {
    amount_incl_vat = round2(args.refund_amount);
    amount_excl_vat = round2(amount_incl_vat / (1 + vat_rate / 100));
    vat_amount = round2(amount_incl_vat - amount_excl_vat);
  }

  // 3. INSERT credit-note invoice. status='issued' directly — credit notes
  //    don't go through draft (ADR-0120 §8). void_reason captures the
  //    Stripe refund id for audit; NULL created_by = system-generated.
  const reasonTag = args.is_full_refund ? "stripe_full_refund" : "stripe_partial_refund";
  const { data: creditNote, error: insErr } = await client
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
      delivery_channel: original.delivery_channel,
      void_reason: `${reasonTag}: ${args.stripe_refund_id}`,
      created_by: null,
    })
    .select("invoice_id, invoice_number")
    .maybeSingle();

  if (insErr) return { ok: false, error: insErr.message, code: "internal_error" };
  if (!creditNote) return { ok: false, error: "credit_note_insert_failed", code: "internal_error" };

  // 4. INSERT line items for the credit-note. Sign stays positive per
  //    ADR-0120 §8 (invoice_type is the sign flag, not the amount).
  if (args.is_full_refund) {
    // Copy original's line items. usage_snapshot_id NULLed because the
    // credit note is not backed by a usage period of its own — it
    // inherits the original's billing period but not its usage linkage.
    const { data: originalLines, error: linesErr } = await client
      .from("invoice_line_item")
      .select("description, line_type, quantity, unit_price, vat_rate, addon_key, period_reference")
      .eq("invoice_id", original.invoice_id);

    if (linesErr) return { ok: false, error: linesErr.message, code: "internal_error" };

    const creditLines = (originalLines ?? []).map((line) => {
      const qty = Number(line.quantity);
      const unitPrice = Number(line.unit_price);
      const lineVatRate = Number(line.vat_rate);
      const lineExcl = round2(qty * unitPrice);
      const lineVat = round2(lineExcl * (lineVatRate / 100));
      const lineIncl = round2(lineExcl + lineVat);
      return {
        invoice_id: creditNote.invoice_id,
        description: line.description,
        line_type: line.line_type,
        quantity: qty,
        unit_price: unitPrice,
        vat_rate: lineVatRate,
        amount_excl_vat: lineExcl,
        vat_amount: lineVat,
        amount_incl_vat: lineIncl,
        addon_key: line.addon_key,
        period_reference: line.period_reference,
        usage_snapshot_id: null,
      };
    });

    if (creditLines.length > 0) {
      const { error: insLineErr } = await client.from("invoice_line_item").insert(creditLines);
      if (insLineErr) return { ok: false, error: insLineErr.message, code: "internal_error" };
    }
  } else {
    // Partial refund: one synthetic line "Delvis refusjon — {refund_id}".
    // line_type='adjustment' reflects the ledger semantic without
    // polluting base_plan / user_overage counts in reports.
    const { error: insLineErr } = await client.from("invoice_line_item").insert({
      invoice_id: creditNote.invoice_id,
      description: `Delvis refusjon — ${args.stripe_refund_id}`,
      line_type: "adjustment",
      quantity: 1,
      unit_price: amount_excl_vat,
      vat_rate,
      amount_excl_vat,
      vat_amount,
      amount_incl_vat,
      usage_snapshot_id: null,
    });
    if (insLineErr) return { ok: false, error: insLineErr.message, code: "internal_error" };
  }

  return {
    ok: true,
    data: {
      credit_note_invoice_id: creditNote.invoice_id,
      invoice_number: creditNote.invoice_number,
      amount_incl_vat,
    },
  };
}
