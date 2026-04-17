// addManualLineItem — platform-admin: add a manual (non-derived)
// invoice line to a draft invoice.
//
// Manual lines are distinguished from usage-derived ones by
// `usage_snapshot_id IS NULL` + `line_type = 'adjustment'` (spec §5.2).
// The B1 trigger `prevent_usage_line_mutation_on_locked_invoice`
// enforces invoice-draft state for any mutation of derived rows — we
// also guard here because manual inserts on non-draft invoices are
// equally wrong (the whole point of immutability is "shipped totals
// don't change").
//
// After insert the parent invoice totals are re-derived from the full
// line-item set so caller doesn't need a second round-trip.
//
// Mobile parity: pure async function, no Next.js primitives.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@smartout/supabase";
import type { Invoice, InvoiceLineItem, InvoiceLineItemInsert, InvoiceUpdate } from "../../types";

type BillingClient = SupabaseClient<Database>;

export type AddManualLineItemArgs = {
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
};

export type AddManualLineItemResult =
  | {
      ok: true;
      line_item: InvoiceLineItem;
      invoice: Pick<Invoice, "invoice_id" | "amount_excl_vat" | "vat_amount" | "amount_incl_vat">;
    }
  | { ok: false; error: string };

// Computes excl/vat/incl per line. Kept colocated because the same
// formula must run for the insert AND for the invoice-total recalc.
function computeLineTotals(quantity: number, unitPrice: number, vatRate: number) {
  const excl = Number((quantity * unitPrice).toFixed(2));
  const vat = Number(((excl * vatRate) / 100).toFixed(2));
  const incl = Number((excl + vat).toFixed(2));
  return { amount_excl_vat: excl, vat_amount: vat, amount_incl_vat: incl };
}

export async function addManualLineItem(
  client: BillingClient,
  args: AddManualLineItemArgs,
): Promise<AddManualLineItemResult> {
  // Guard: invoice must exist + be draft.
  const { data: invoice, error: invoiceErr } = await client
    .from("invoice")
    .select("invoice_id, status")
    .eq("invoice_id", args.invoice_id)
    .maybeSingle();

  if (invoiceErr) return { ok: false, error: invoiceErr.message };
  if (!invoice) return { ok: false, error: "invoice_not_found" };
  if (invoice.status !== "draft") {
    return { ok: false, error: "invoice_not_draft" };
  }

  const totals = computeLineTotals(args.quantity, args.unit_price, args.vat_rate);

  const insertRow: InvoiceLineItemInsert = {
    invoice_id: args.invoice_id,
    description: args.description,
    quantity: args.quantity,
    unit_price: args.unit_price,
    vat_rate: args.vat_rate,
    line_type: "adjustment",
    usage_snapshot_id: null,
    ...totals,
  };

  const { data: inserted, error: insertErr } = await client
    .from("invoice_line_item")
    .insert(insertRow)
    .select("*")
    .single();

  if (insertErr) return { ok: false, error: insertErr.message };
  if (!inserted) return { ok: false, error: "insert_failed" };

  // Recalculate invoice totals from the full line-item set. We do this
  // server-side from the DB rather than the client input so concurrent
  // edits produce the correct sum on the last writer's turn.
  const totalsResult = await recalculateInvoiceTotals(client, args.invoice_id);
  if (!totalsResult.ok) return totalsResult;

  return {
    ok: true,
    line_item: inserted as InvoiceLineItem,
    invoice: totalsResult.invoice,
  };
}

// Helper: reads all line-items for invoice, sums them, writes back to
// invoice. Exposed for reuse by update/delete paths so totals stay in
// sync without duplicated aggregation logic.
export async function recalculateInvoiceTotals(
  client: BillingClient,
  invoiceId: string,
): Promise<
  | {
      ok: true;
      invoice: Pick<Invoice, "invoice_id" | "amount_excl_vat" | "vat_amount" | "amount_incl_vat">;
    }
  | { ok: false; error: string }
> {
  const { data: lines, error: linesErr } = await client
    .from("invoice_line_item")
    .select("amount_excl_vat, vat_amount, amount_incl_vat")
    .eq("invoice_id", invoiceId);

  if (linesErr) return { ok: false, error: linesErr.message };

  const excl = (lines ?? []).reduce((sum, l) => sum + Number(l.amount_excl_vat), 0);
  const vat = (lines ?? []).reduce((sum, l) => sum + Number(l.vat_amount), 0);
  const incl = (lines ?? []).reduce((sum, l) => sum + Number(l.amount_incl_vat), 0);

  const updateRow: InvoiceUpdate = {
    amount_excl_vat: Number(excl.toFixed(2)),
    vat_amount: Number(vat.toFixed(2)),
    amount_incl_vat: Number(incl.toFixed(2)),
  };

  const { data: updated, error: updateErr } = await client
    .from("invoice")
    .update(updateRow)
    .eq("invoice_id", invoiceId)
    .select("invoice_id, amount_excl_vat, vat_amount, amount_incl_vat")
    .single();

  if (updateErr) return { ok: false, error: updateErr.message };
  if (!updated) return { ok: false, error: "invoice_update_failed" };

  return { ok: true, invoice: updated };
}
