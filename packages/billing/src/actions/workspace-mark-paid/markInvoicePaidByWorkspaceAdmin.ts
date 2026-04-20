// markInvoicePaidByWorkspaceAdmin — workspace-admin self-serve
// "marker betalt" for an issued invoice that they paid via bank.
//
// Spec §5.2 reversal semantics (ADR-0120 bekreftelse):
//   - Allowed only when `invoice.status = 'issued'`. Anything else
//     (paid, void, uncollectible, draft) refuses. In particular we do
//     NOT accept 'sent' / 'overdue' — Fase 2 narrows this path to
//     "customer paid an issued invoice by bank transfer" only.
//   - Not reversible by the workspace-admin. Reversal requires a
//     platform-admin credit note. UI copy warns the user.
//   - `payment_channel` is hard-coded `bank_transfer` — there is no
//     channel picker on the workspace surface. If ops needs broader
//     channels, that stays a platform-admin action.
//
// Mobile parity: pure async function, no Next.js primitives. Web and
// React Native callers both invoke this after their own auth gate.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@smartout/supabase";
import type { Invoice } from "../../types";

type BillingClient = SupabaseClient<Database>;

export type MarkInvoicePaidByWorkspaceAdminArgs = {
  invoice_id: string;
  payment_date: string;
  payment_reference: string;
  note?: string;
};

export type MarkInvoicePaidByWorkspaceAdminResult =
  | { ok: true; invoice: Invoice }
  | { ok: false; error: string };

export async function markInvoicePaidByWorkspaceAdmin(
  client: BillingClient,
  args: MarkInvoicePaidByWorkspaceAdminArgs,
): Promise<MarkInvoicePaidByWorkspaceAdminResult> {
  // Status guard in WHERE — if invoice is not 'issued', UPDATE hits
  // zero rows and maybeSingle() returns null. Explicit load first to
  // distinguish "not found" from "wrong status" for the error surface.
  const { data: existing, error: loadErr } = await client
    .from("invoice")
    .select("invoice_id, status")
    .eq("invoice_id", args.invoice_id)
    .maybeSingle();

  if (loadErr) return { ok: false, error: loadErr.message };
  if (!existing) return { ok: false, error: "invoice_not_found" };
  if (existing.status !== "issued") {
    return { ok: false, error: "invoice_not_issued" };
  }

  const { data: updated, error: updateErr } = await client
    .from("invoice")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      payment_date: args.payment_date,
      payment_reference: args.payment_reference,
      payment_channel: "bank_transfer",
    })
    .eq("invoice_id", args.invoice_id)
    .eq("status", "issued")
    .select("*")
    .maybeSingle();

  if (updateErr) return { ok: false, error: updateErr.message };
  if (!updated) {
    // Race: another writer flipped the status between our load and
    // update. Safer than pretending success.
    return { ok: false, error: "invoice_status_changed" };
  }

  return { ok: true, invoice: updated as Invoice };
}
