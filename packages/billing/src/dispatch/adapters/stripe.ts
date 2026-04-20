// StripeDispatchAdapter — creates a Stripe Checkout Session for an
// issued invoice and returns the checkout URL + PaymentIntent reference.
//
// Per Fase 3A spec §3.3 and ADR-0131 (Smartout-owned merchant-of-record
// model): Smartout is the Stripe account holder. `payment.company_id` is
// the customer company; funds settle into Smartout's bank and are
// reconciled internally outside this adapter's scope.
//
// Design separation from other DispatchAdapters:
//
//   - EmailCustomerAdapter / HttpApiAdapter write NOTHING to the database.
//     They call the remote and return a DispatchResult that engine-dispatch
//     persists onto the matching invoice_dispatch row.
//
//   - This adapter is the SAME: it does NOT INSERT the payment row. The
//     pure function `initiatePayment()` (see ../../actions/payments/) owns
//     that INSERT, calls this adapter, and uses the returned
//     external_reference (Stripe payment_intent_id) to link the payment
//     row to the Stripe state. Keeps the adapter pure + testable.
//
// Idempotency: Stripe's own idempotency-key header is set to
// input.invoice_dispatch_id. A duplicate engine-dispatch retry for the
// same dispatch row will return the exact same Session object on the
// Stripe side. Webhook idempotency is handled separately in the
// stripe-webhook Edge Function via payment_attempt.stripe_event_id UNIQUE.

import Stripe from "stripe";
import type {
  DispatchAdapter,
  DispatchInput,
  DispatchResult,
  TestConnectionResult,
} from "../types";

// Pinned Stripe API version — matches the SDK's LatestApiVersion for v17.x
// so we always roll forward together. Pinning explicitly prevents silent
// behavior changes when Stripe rolls a new API version as default. Upgrade
// path: bump both SDK + this string.
const STRIPE_API_VERSION: Stripe.LatestApiVersion = "2025-02-24.acacia";

const DEFAULT_CHECKOUT_EXPIRY_HOURS = 24;

type StripeTarget = {
  // Optional success_url override per-rule. Falls back to
  // NEXT_PUBLIC_APP_URL/dashboard/billing/{invoice_id}?payment=success.
  success_url?: string;
  cancel_url?: string;
};

function parseTarget(target: Record<string, unknown>): StripeTarget {
  const success_url =
    typeof target["success_url"] === "string" ? (target["success_url"] as string) : undefined;
  const cancel_url =
    typeof target["cancel_url"] === "string" ? (target["cancel_url"] as string) : undefined;
  return { success_url, cancel_url };
}

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  return new Stripe(key, { apiVersion: STRIPE_API_VERSION });
}

function toStripeAmount(decimalAmount: number | string): number {
  // Stripe expects amounts in the smallest currency unit (øre / cents).
  // amount_incl_vat arrives as a numeric string or number from Postgres;
  // round-trip through Number + Math.round to avoid floating-point drift.
  const n = typeof decimalAmount === "string" ? Number(decimalAmount) : decimalAmount;
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`Invalid amount for Stripe: ${decimalAmount}`);
  }
  return Math.round(n * 100);
}

export const StripeDispatchAdapter: DispatchAdapter = {
  channel: "stripe_invoice",

  async send(input: DispatchInput): Promise<DispatchResult> {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3060";
    const target = parseTarget(input.target);

    let stripe: Stripe;
    try {
      stripe = getStripe();
    } catch (err) {
      return {
        status: "failed",
        error_code: "config_missing",
        error_message: err instanceof Error ? err.message : String(err),
        retryable: false,
      };
    }

    // Final guard before Stripe call — pricing is decimal(12,2) in DB so
    // this should never fire in practice, but keep the adapter defensive
    // against NULL amounts from future invoice_type variants.
    let unitAmount: number;
    try {
      unitAmount = toStripeAmount(input.invoice.amount_incl_vat);
    } catch (err) {
      return {
        status: "failed",
        error_code: "invalid_amount",
        error_message: err instanceof Error ? err.message : String(err),
        retryable: false,
      };
    }

    const invoiceNumberLabel = input.invoice.invoice_number
      ? `Faktura ${input.invoice.invoice_number}`
      : `Faktura ${input.invoice.invoice_id.slice(0, 8)}`;

    const successUrl =
      target.success_url ??
      `${appUrl}/dashboard/billing/${input.invoice.invoice_id}?payment=success`;
    const cancelUrl =
      target.cancel_url ??
      `${appUrl}/dashboard/billing/${input.invoice.invoice_id}?payment=cancelled`;

    // Stripe Checkout expires after 24h by default per Stripe docs. We set
    // it explicitly so dispatch check_back_at aligns.
    const expiresAt = Math.floor(Date.now() / 1000) + DEFAULT_CHECKOUT_EXPIRY_HOURS * 3600;

    try {
      const session = await stripe.checkout.sessions.create(
        {
          mode: "payment",
          client_reference_id: input.invoice.invoice_id,
          expires_at: expiresAt,
          line_items: [
            {
              price_data: {
                currency: input.invoice.currency.toLowerCase(),
                product_data: { name: invoiceNumberLabel },
                unit_amount: unitAmount,
              },
              quantity: 1,
            },
          ],
          payment_intent_data: {
            description: invoiceNumberLabel,
            metadata: {
              invoice_id: input.invoice.invoice_id,
              invoice_dispatch_id: input.invoice_dispatch_id,
              invoice_number: input.invoice.invoice_number?.toString() ?? "",
              company_id: input.invoice.company_id,
            },
          },
          metadata: {
            invoice_id: input.invoice.invoice_id,
            invoice_dispatch_id: input.invoice_dispatch_id,
            company_id: input.invoice.company_id,
          },
          success_url: successUrl,
          cancel_url: cancelUrl,
        },
        {
          // Same dispatch row retried by engine-dispatch returns the same
          // session — Stripe idempotency guarantees exact-replay semantics.
          idempotencyKey: `invoice-dispatch-${input.invoice_dispatch_id}`,
        },
      );

      const paymentIntentId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : (session.payment_intent?.id ?? null);

      if (!paymentIntentId) {
        // Checkout sessions in 'payment' mode always expose a payment_intent
        // once created, but the TypeScript type permits null. Guard defensively
        // — without the PI id we can't later reconcile via webhook.
        return {
          status: "failed",
          error_code: "no_payment_intent",
          error_message: "Stripe Checkout Session did not return a payment_intent id.",
          retryable: true,
        };
      }

      // Webhook flips this to 'delivered' when payment_intent.succeeded
      // fires. Until then, engine-dispatch parks the dispatch row in
      // in_flight status and reschedules a poll at check_back_at.
      return {
        status: "in_flight",
        external_reference: paymentIntentId,
        check_back_at: new Date(expiresAt * 1000),
      };
    } catch (error) {
      // Stripe errors carry a .type discriminant (StripeCardError,
      // StripeInvalidRequestError, StripeAPIError, StripeConnectionError,
      // StripeAuthenticationError, StripeRateLimitError). Rate-limit +
      // connection + API errors are transient; everything else is the
      // caller's fault.
      if (error instanceof Stripe.errors.StripeError) {
        const retryable =
          error.type === "StripeAPIError" ||
          error.type === "StripeConnectionError" ||
          error.type === "StripeRateLimitError";
        return {
          status: "failed",
          error_code: error.code ?? error.type ?? "stripe_error",
          error_message: error.message.slice(0, 500),
          retryable,
        };
      }
      return {
        status: "failed",
        error_code: "stripe_unknown",
        error_message: error instanceof Error ? error.message : String(error),
        retryable: true,
      };
    }
  },

  async testConnection(_target: Record<string, unknown>): Promise<TestConnectionResult> {
    let stripe: Stripe;
    try {
      stripe = getStripe();
    } catch (err) {
      return {
        status: "error",
        message: err instanceof Error ? err.message : String(err),
      };
    }

    // A minimal read that validates credentials without side effects.
    // retrieveBalance hits Stripe's auth layer; failure here is always a
    // key-or-network problem.
    try {
      await stripe.balance.retrieve();
      return { status: "ok" };
    } catch (error) {
      if (error instanceof Stripe.errors.StripeError) {
        return { status: "error", message: error.message };
      }
      return { status: "error", message: error instanceof Error ? error.message : String(error) };
    }
  },
};

// Exported for webhook + action-layer reuse. The webhook needs the same
// pinned API version + client construction; actions may want to construct
// refunds or retrieve PaymentIntents.
export { getStripe, STRIPE_API_VERSION };
