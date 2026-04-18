// initiatePayment — "Betal nå" entrypoint. Creates a Stripe Checkout
// Session for an invoice in a payable state, INSERTs a payment row in
// 'pending' status, and returns the checkout URL + payment_id for the
// caller to redirect the user to Stripe.
//
// Pure async function per mobile parity: web Server Action wraps it,
// React Native callers invoke it directly after their own auth gate.
// The caller supplies the Supabase client (service-role for Server
// Actions, workspace-scoped JWT client for mobile — RLS handles both).
//
// Why NOT go through StripeDispatchAdapter.send()?
//   The adapter interface returns a DispatchResult discriminant (in_flight
//   / delivered / failed) optimised for engine-dispatch orchestration.
//   The "Betal nå" flow needs the session URL directly to redirect the
//   user, which is orthogonal to the dispatch contract. Calling the
//   Stripe SDK here reuses the same pinned API version + error mapping
//   via the shared getStripe() helper without twisting the adapter
//   contract.
//
// Invoice status gate:
//   Only 'issued', 'sent', 'overdue' → payable. 'draft' means the
//   platform-admin hasn't finalised the invoice yet. 'paid', 'void',
//   'uncollectible' → return guarded error (UI shows disabled button).
//
// Ref: Fase 3A spec §3.3–§3.4, ADR-0131.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@smartout/supabase";
import Stripe from "stripe";
import { getStripe } from "../../dispatch/adapters/stripe";
import type { Invoice, Payment } from "../../types";
import type { AdminActionResult } from "../_shared/withAdmin.types";

type BillingClient = SupabaseClient<Database>;

export type InitiatePaymentArgs = {
  invoice_id: string;
};

export type InitiatePaymentOutput = {
  payment_id: string;
  checkout_url: string;
  external_id: string;
};

const PAYABLE_STATUSES = new Set(["issued", "sent", "overdue"]);
const CHECKOUT_EXPIRY_HOURS = 24;

function toStripeAmount(decimalAmount: number | string): number {
  const n = typeof decimalAmount === "string" ? Number(decimalAmount) : decimalAmount;
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`Invalid amount for Stripe: ${decimalAmount}`);
  }
  return Math.round(n * 100);
}

export async function initiatePayment(
  client: BillingClient,
  input: InitiatePaymentArgs,
): Promise<AdminActionResult<InitiatePaymentOutput>> {
  // 1. Load invoice + validate status. Load full row for metadata build.
  const { data: invoiceRow, error: loadErr } = await client
    .from("invoice")
    .select("*")
    .eq("invoice_id", input.invoice_id)
    .maybeSingle();

  if (loadErr) {
    return { ok: false, error: loadErr.message, code: "internal_error" };
  }
  if (!invoiceRow) {
    return { ok: false, error: "invoice_not_found", code: "not_found" };
  }

  const invoice = invoiceRow as Invoice;
  if (!PAYABLE_STATUSES.has(invoice.status)) {
    return {
      ok: false,
      error: `invoice_not_payable:${invoice.status}`,
      code: "conflict",
    };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3060";
  const invoiceLabel = invoice.invoice_number
    ? `Faktura ${invoice.invoice_number}`
    : `Faktura ${invoice.invoice_id.slice(0, 8)}`;

  let unitAmount: number;
  try {
    unitAmount = toStripeAmount(invoice.amount_incl_vat);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      code: "invalid_input",
    };
  }

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

  // 2. Create Checkout Session. idempotencyKey on invoice_id means a
  //    double-click produces the same Session (Stripe returns the
  //    existing one). Safe against users retrying after a network hiccup.
  const expiresAt = Math.floor(Date.now() / 1000) + CHECKOUT_EXPIRY_HOURS * 3600;

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        client_reference_id: invoice.invoice_id,
        expires_at: expiresAt,
        line_items: [
          {
            price_data: {
              currency: invoice.currency.toLowerCase(),
              product_data: { name: invoiceLabel },
              unit_amount: unitAmount,
            },
            quantity: 1,
          },
        ],
        payment_intent_data: {
          description: invoiceLabel,
          metadata: {
            invoice_id: invoice.invoice_id,
            invoice_number: invoice.invoice_number?.toString() ?? "",
            company_id: invoice.company_id,
          },
        },
        metadata: {
          invoice_id: invoice.invoice_id,
          company_id: invoice.company_id,
        },
        success_url: `${appUrl}/dashboard/billing/${invoice.invoice_id}?payment=success`,
        cancel_url: `${appUrl}/dashboard/billing/${invoice.invoice_id}?payment=cancelled`,
      },
      {
        // A second call with the same invoice_id returns the same Session
        // for as long as Stripe holds the idempotency record (~24h).
        idempotencyKey: `initiate-payment-${invoice.invoice_id}`,
      },
    );
  } catch (error) {
    if (error instanceof Stripe.errors.StripeError) {
      return {
        ok: false,
        error: `stripe_${error.code ?? error.type}:${error.message}`,
        code:
          error.type === "StripeRateLimitError" || error.type === "StripeConnectionError"
            ? "internal_error"
            : "invalid_input",
      };
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      code: "internal_error",
    };
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);

  if (!paymentIntentId) {
    return {
      ok: false,
      error: "stripe_no_payment_intent",
      code: "internal_error",
    };
  }
  if (!session.url) {
    return {
      ok: false,
      error: "stripe_no_checkout_url",
      code: "internal_error",
    };
  }

  // 3. INSERT payment row (status='pending'). If Stripe already returned
  //    a Session (via idempotency) and we previously inserted, the
  //    UNIQUE partial index on external_id surfaces a conflict — we
  //    upsert by checking first to keep the happy-path visible.
  const { data: existing } = await client
    .from("payment")
    .select("payment_id")
    .eq("external_id", paymentIntentId)
    .maybeSingle();

  let paymentId: string;
  if (existing) {
    paymentId = (existing as Pick<Payment, "payment_id">).payment_id;
  } else {
    const { data: payment, error: insertErr } = await client
      .from("payment")
      .insert({
        invoice_id: invoice.invoice_id,
        company_id: invoice.company_id,
        payment_method: "stripe_card",
        amount: invoice.amount_incl_vat,
        currency: invoice.currency,
        status: "pending",
        external_id: paymentIntentId,
      })
      .select("payment_id")
      .single();

    if (insertErr) {
      return {
        ok: false,
        error: `payment_insert_failed:${insertErr.message}`,
        code: "internal_error",
      };
    }
    if (!payment) {
      return { ok: false, error: "payment_insert_failed", code: "internal_error" };
    }
    paymentId = (payment as Pick<Payment, "payment_id">).payment_id;
  }

  return {
    ok: true,
    data: {
      payment_id: paymentId,
      checkout_url: session.url,
      external_id: paymentIntentId,
    },
  };
}
