// refundPayment — platform-admin initiates a Stripe refund for a
// succeeded payment. This is the ADMIN side of ADR-0133: Stripe executes
// the actual refund; the webhook (charge.refunded) then flips the
// payment row + creates the credit-note via issueCreditNoteForRefund.
//
// This function does NOT write payment.refunded_amount or the credit
// note directly — both are driven by webhook to keep a single source of
// truth for refund state transitions. What this function DOES:
//
//   1. Validates the payment exists + is in a refundable state
//   2. Validates the refund amount fits within the remaining refundable
//      balance (amount - refunded_amount)
//   3. Calls stripe.refunds.create with the PaymentIntent id
//   4. Returns the Stripe refund id for the caller to display
//
// Idempotency:
//   Stripe's refunds.create accepts an idempotency_key header. The
//   caller-provided idempotency_key is sent to Stripe so a retried
//   Server Action call does not create a duplicate refund.
//
// Ref: Fase 3A spec §3.4 + §3.6, ADR-0133.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@smartout/supabase";
import Stripe from "stripe";
import { getStripe } from "../../dispatch/adapters/stripe";
import type { Payment } from "../../types";
import type { AdminActionResult } from "../_shared/withAdmin.types";
import type { RefundReason } from "../../schemas";

type BillingClient = SupabaseClient<Database>;

export type RefundPaymentArgs = {
  payment_id: string;
  amount?: number;
  reason: RefundReason;
  reason_detail: string;
  idempotency_key: string;
};

export type RefundPaymentOutput = {
  refund_id: string;
  refunded_amount: number;
  refund_type: "full" | "partial";
};

const REFUNDABLE_STATUSES = new Set(["succeeded", "partially_refunded"]);

// Stripe's refund reason enum. Our RefundReason maps to this + a free
// text detail captured in billing_activity_log (never in Stripe).
function mapReason(reason: RefundReason): Stripe.RefundCreateParams.Reason | undefined {
  switch (reason) {
    case "duplicate":
      return "duplicate";
    case "fraudulent":
      return "fraudulent";
    case "requested_by_customer":
      return "requested_by_customer";
    case "other":
      return undefined;
  }
}

export async function refundPayment(
  client: BillingClient,
  input: RefundPaymentArgs,
): Promise<AdminActionResult<RefundPaymentOutput>> {
  // 1. Load payment. We need amount + refunded_amount to validate the
  //    requested refund fits, and external_id to target Stripe.
  const { data: paymentRow, error: loadErr } = await client
    .from("payment")
    .select("payment_id, external_id, amount, currency, status, refunded_amount")
    .eq("payment_id", input.payment_id)
    .maybeSingle();

  if (loadErr) {
    return { ok: false, error: loadErr.message, code: "internal_error" };
  }
  if (!paymentRow) {
    return { ok: false, error: "payment_not_found", code: "not_found" };
  }

  const payment = paymentRow as Pick<
    Payment,
    "payment_id" | "external_id" | "amount" | "currency" | "status" | "refunded_amount"
  >;

  if (!REFUNDABLE_STATUSES.has(payment.status)) {
    return {
      ok: false,
      error: `payment_not_refundable:${payment.status}`,
      code: "conflict",
    };
  }
  if (!payment.external_id) {
    return {
      ok: false,
      error: "payment_missing_stripe_reference",
      code: "conflict",
    };
  }

  const originalAmount = Number(payment.amount);
  const alreadyRefunded = Number(payment.refunded_amount ?? 0);
  const refundable = originalAmount - alreadyRefunded;

  // Default full refund when amount omitted.
  const requestedAmount = input.amount ?? refundable;

  if (requestedAmount <= 0) {
    return { ok: false, error: "refund_amount_invalid", code: "invalid_input" };
  }
  if (requestedAmount > refundable) {
    return {
      ok: false,
      error: `refund_exceeds_refundable:${refundable}`,
      code: "invalid_input",
    };
  }

  const refundCents = Math.round(requestedAmount * 100);

  let stripe: Stripe;
  try {
    stripe = getStripe();
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      code: "internal_error",
    };
  }

  let refund: Stripe.Refund;
  try {
    refund = await stripe.refunds.create(
      {
        payment_intent: payment.external_id,
        amount: refundCents,
        reason: mapReason(input.reason),
        metadata: {
          payment_id: payment.payment_id,
          reason_detail: input.reason_detail.slice(0, 500),
        },
      },
      { idempotencyKey: input.idempotency_key },
    );
  } catch (error) {
    if (error instanceof Stripe.errors.StripeError) {
      return {
        ok: false,
        error: `stripe_${error.code ?? error.type}:${error.message}`,
        code: error.type === "StripeInvalidRequestError" ? "invalid_input" : "internal_error",
      };
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      code: "internal_error",
    };
  }

  // NOTE: we deliberately DO NOT UPDATE payment.refunded_amount here.
  // charge.refunded webhook is the single source of truth for that
  // transition per ADR-0133 — it also creates the credit-note. Writing
  // twice risks race conditions + double-counted refunds.
  const refund_type: "full" | "partial" =
    refundCents === Math.round(refundable * 100) ? "full" : "partial";

  return {
    ok: true,
    data: {
      refund_id: refund.id,
      refunded_amount: requestedAmount,
      refund_type,
    },
  };
}
