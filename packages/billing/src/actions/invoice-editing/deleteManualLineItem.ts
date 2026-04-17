// deleteManualLineItem — platform-admin: remove a manual invoice line
// from a draft invoice.
//
// Same manual-only rule as updateManualLineItem. Derived rows are
// protected by the B1 trigger; we refuse upfront for a cleaner error
// shape.
//
// Mobile parity: pure async function, no Next.js primitives.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@smartout/supabase";
import type { InvoiceLineItem } from "../../types";
import { recalculateInvoiceTotals } from "./addManualLineItem";

type BillingClient = SupabaseClient<Database>;

export type DeleteManualLineItemArgs = {
  line_item_id: string;
};

export type DeleteManualLineItemResult =
  | {
      ok: true;
      removed: InvoiceLineItem;
    }
  | { ok: false; error: string };

export async function deleteManualLineItem(
  client: BillingClient,
  args: DeleteManualLineItemArgs,
): Promise<DeleteManualLineItemResult> {
  const { data: removed, error: loadErr } = await client
    .from("invoice_line_item")
    .select("*")
    .eq("line_item_id", args.line_item_id)
    .maybeSingle();

  if (loadErr) return { ok: false, error: loadErr.message };
  if (!removed) return { ok: false, error: "line_item_not_found" };
  if (removed.usage_snapshot_id !== null) {
    return { ok: false, error: "cannot_delete_derived_line_item" };
  }

  const { error: deleteErr } = await client
    .from("invoice_line_item")
    .delete()
    .eq("line_item_id", args.line_item_id);

  if (deleteErr) return { ok: false, error: deleteErr.message };

  const recalc = await recalculateInvoiceTotals(client, removed.invoice_id);
  if (!recalc.ok) return recalc;

  return { ok: true, removed: removed as InvoiceLineItem };
}
