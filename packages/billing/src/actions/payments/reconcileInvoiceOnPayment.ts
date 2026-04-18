// reconcileInvoiceOnPayment — helper invoked by the stripe-webhook Edge
// Function after a successful payment_intent.succeeded. Checks whether
// the cumulative sum of succeeded payments >= invoice.amount_incl_vat
// and, if so, flips invoice.status to 'paid'.
//
// Guard (spec §3.4):
//   Only flips if current invoice.status IN ('issued','sent','overdue').
//   This is defensive against workspace-admin having already marked the
//   invoice paid via bank-transfer before Stripe's webhook landed —
//   in that case we don't overwrite the audit trail.
//
// Returns nothing meaningful — the webhook emits its own telemetry. We
// do return ok/error so callers can log failures for observability.
//
// Ref: Fase 3A spec §3.4, ADR-0120 (invoice lifecycle).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@smartout/supabase";

type BillingClient = SupabaseClient<Database>;

export type ReconcileInvoiceResult =
  | { ok: true; invoice_settled: boolean }
  | { ok: false; error: string };

export async function reconcileInvoiceOnPayment(
  client: BillingClient,
  payment_id: string,
): Promise<ReconcileInvoiceResult> {
  // 1. Load payment + its invoice. We need invoice.status + amount_incl_vat
  //    to decide on the flip.
  const { data: payment, error: payErr } = await client
    .from("payment")
    .select("payment_id, invoice_id")
    .eq("payment_id", payment_id)
    .maybeSingle();

  if (payErr) return { ok: false, error: payErr.message };
  if (!payment) return { ok: false, error: "payment_not_found" };

  const { data: invoice, error: invErr } = await client
    .from("invoice")
    .select("invoice_id, status, amount_incl_vat")
    .eq("invoice_id", payment.invoice_id)
    .maybeSingle();

  if (invErr) return { ok: false, error: invErr.message };
  if (!invoice) return { ok: false, error: "invoice_not_found" };

  // 2. Only flip from a payable state. 'paid' → no-op (already settled).
  //    'void' / 'uncollectible' → payment post-dates the decision; the
  //    platform-admin needs to handle this out-of-band (Stripe refund
  //    or manual reconciliation). 'draft' should never see a payment.
  if (invoice.status !== "issued" && invoice.status !== "sent" && invoice.status !== "overdue") {
    return { ok: true, invoice_settled: false };
  }

  // 3. Sum all succeeded payments for this invoice. Including
  //    'partially_refunded' would undercount — the original payment row
  //    is still 'succeeded' until it is fully refunded.
  const { data: payments, error: sumErr } = await client
    .from("payment")
    .select("amount")
    .eq("invoice_id", invoice.invoice_id)
    .in("status", ["succeeded", "partially_refunded"]);

  if (sumErr) return { ok: false, error: sumErr.message };

  const totalPaid = (payments ?? []).reduce((acc, row) => acc + Number(row.amount), 0);
  const totalOwed = Number(invoice.amount_incl_vat);

  if (totalPaid < totalOwed) {
    // Partial payment — keep invoice open for the next attempt.
    return { ok: true, invoice_settled: false };
  }

  // 4. Flip invoice.status='paid'. WHERE status IN (...) guards against
  //    a concurrent webhook having already flipped the row. If zero
  //    rows update we treat it as settled anyway (webhook race is fine
  //    — another one flipped it first).
  const { error: updErr } = await client
    .from("invoice")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
    })
    .eq("invoice_id", invoice.invoice_id)
    .in("status", ["issued", "sent", "overdue"]);

  if (updErr) return { ok: false, error: updErr.message };

  return { ok: true, invoice_settled: true };
}
