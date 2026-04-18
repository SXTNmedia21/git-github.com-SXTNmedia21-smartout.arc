"use server";

import { revalidatePath } from "next/cache";
import {
  RefundPaymentInputSchema,
  refundPayment,
  type AdminActionResult,
  type RefundPaymentOutput,
} from "@smartout/billing";
import { emit } from "@smartout/telemetry";
import { withPlatformAdmin } from "@/lib/billing/withAdmin";

// Fase 3A B2.4 — platform-admin initiates a Stripe refund.
//
// Flow:
//   1. withPlatformAdmin gate (godmode check)
//   2. Zod validate input
//   3. Call pure refundPayment() which hits Stripe.refunds.create
//   4. emit "payment refunded" (initiation event; webhook will also emit
//      after it processes charge.refunded and updates the DB)
//   5. revalidatePath on payments dashboard + invoice detail
//
// NOTE: The DB state transitions (payment.status, payment.refunded_amount,
// credit-note creation) happen in the webhook handler — not here. This
// keeps charge.refunded as the single write source per ADR-0142.

export async function refundPaymentAction(
  rawInput: unknown,
): Promise<AdminActionResult<RefundPaymentOutput>> {
  return withPlatformAdmin(async (adminId, supabase) => {
    const parsed = RefundPaymentInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "invalid_input",
        code: "invalid_input",
      };
    }

    // Load company_id for emit BEFORE calling Stripe so a successful
    // refund never lacks audit context. Stripe state is the source of
    // truth once the call succeeds; we're just logging the initiation.
    const { data: paymentRow } = await supabase
      .from("payment")
      .select("payment_id, invoice_id, company_id, currency")
      .eq("payment_id", parsed.data.payment_id)
      .maybeSingle();

    const result = await refundPayment(supabase, parsed.data);
    if (!result.ok) {
      return result;
    }

    // Initiation event — distinct from the webhook's own "payment refunded"
    // event which fires after Stripe confirms the state change. Both are
    // useful for audit (who asked for the refund vs when it cleared).
    if (paymentRow) {
      await emit({
        event: "payment refunded",
        actor_id: adminId,
        workspace_id: null,
        properties: {
          entity_type: "payment",
          entity_id: parsed.data.payment_id,
          data: {
            invoice_id: paymentRow.invoice_id,
            company_id: paymentRow.company_id,
            refunded_amount: result.data.refunded_amount,
            currency: paymentRow.currency,
            refund_type: result.data.refund_type,
          },
        },
      });
    }

    revalidatePath("/platform-admin/billing/payments");
    if (paymentRow?.invoice_id) {
      revalidatePath(`/platform-admin/billing/invoices/${paymentRow.invoice_id}`);
    }

    return result;
  });
}
