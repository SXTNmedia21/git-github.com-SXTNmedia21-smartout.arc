// updateManualLineItem — platform-admin: edit a manual invoice line
// on a draft invoice.
//
// Manual-only — if the row has usage_snapshot_id NOT NULL the B1
// trigger rejects the UPDATE with a check_violation. We also refuse
// upfront to avoid leaking the DB error surface through the UI.
//
// The handler returns a before/after snapshot so the wrapper can emit
// `invoice line_item edited` with a structured diff.
//
// Mobile parity: pure async function, no Next.js primitives.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@smartout/supabase";
import type { InvoiceLineItem } from "../../types";
import { recalculateInvoiceTotals } from "./addManualLineItem";

type BillingClient = SupabaseClient<Database>;

export type UpdateManualLineItemArgs = {
  line_item_id: string;
  description?: string;
  quantity?: number;
  unit_price?: number;
  vat_rate?: number;
};

export type UpdateManualLineItemResult =
  | {
      ok: true;
      before: InvoiceLineItem;
      after: InvoiceLineItem;
    }
  | { ok: false; error: string };

function computeLineTotals(quantity: number, unitPrice: number, vatRate: number) {
  const excl = Number((quantity * unitPrice).toFixed(2));
  const vat = Number(((excl * vatRate) / 100).toFixed(2));
  const incl = Number((excl + vat).toFixed(2));
  return { amount_excl_vat: excl, vat_amount: vat, amount_incl_vat: incl };
}

export async function updateManualLineItem(
  client: BillingClient,
  args: UpdateManualLineItemArgs,
): Promise<UpdateManualLineItemResult> {
  const { data: before, error: loadErr } = await client
    .from("invoice_line_item")
    .select("*")
    .eq("line_item_id", args.line_item_id)
    .maybeSingle();

  if (loadErr) return { ok: false, error: loadErr.message };
  if (!before) return { ok: false, error: "line_item_not_found" };
  if (before.usage_snapshot_id !== null) {
    // Surfacing a clearer message than the trigger-raised exception.
    // The DB trigger still fires — this is belt + suspenders.
    return { ok: false, error: "cannot_edit_derived_line_item" };
  }

  // Recompute with the post-patch shape so totals stay consistent.
  const quantity = args.quantity ?? Number(before.quantity);
  const unitPrice = args.unit_price ?? Number(before.unit_price);
  const vatRate = args.vat_rate ?? Number(before.vat_rate);
  const totals = computeLineTotals(quantity, unitPrice, vatRate);

  const { data: after, error: updateErr } = await client
    .from("invoice_line_item")
    .update({
      description: args.description ?? before.description,
      quantity,
      unit_price: unitPrice,
      vat_rate: vatRate,
      ...totals,
    })
    .eq("line_item_id", args.line_item_id)
    .select("*")
    .single();

  if (updateErr) return { ok: false, error: updateErr.message };
  if (!after) return { ok: false, error: "update_failed" };

  // Keep parent invoice totals in sync.
  const recalc = await recalculateInvoiceTotals(client, before.invoice_id);
  if (!recalc.ok) return recalc;

  return {
    ok: true,
    before: before as InvoiceLineItem,
    after: after as InvoiceLineItem,
  };
}
