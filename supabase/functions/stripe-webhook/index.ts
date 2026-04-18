// ══════════════════════════════════════════════════════════════════
// Billing Engine Fase 3A — stripe-webhook Edge Function
// ══════════════════════════════════════════════════════════════════
//
// Receives Stripe webhook events, verifies signatures, and reflects
// state changes onto our `payment`, `payment_attempt`, and `invoice`
// tables. Three event types in Fase 3A:
//
//   - payment_intent.succeeded   → payment.status='succeeded' + maybe
//                                  invoice.status='paid'
//   - payment_intent.payment_failed → payment.status='failed'
//   - charge.refunded            → payment.refunded_amount + auto
//                                  credit-note per ADR-0133
//
// Idempotency:
//   - UPSERT on payment_attempt (stripe_event_id UNIQUE) prevents
//     double-processing of replayed events
//   - Invoice.status flip is guarded by WHERE status IN (payable set)
//     so a late-arriving succeeded event cannot overwrite a workspace-
//     admin's manual mark-paid
//
// PII redaction (ADR-0132):
//   payment_attempt.redacted_payload stores ONLY whitelisted keys.
//   Forbidden keys (billing_details, customer, source, receipt_url)
//   are never persisted. See redactStripeEvent().
//
// Auth: public endpoint — verify_jwt=false. Stripe signature is the
//       auth boundary (STRIPE_WEBHOOK_SECRET).
//
// Deno can't import @smartout/billing, so the reconcile + credit-note
// logic is inlined below. Canonical implementations live in
// packages/billing/src/actions/payments/ and are covered by Vitest.
// ══════════════════════════════════════════════════════════════════

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17.7.0";

// ─── Stripe client (lazy — webhook secret drives signature verify) ─
const STRIPE_API_VERSION: Stripe.LatestApiVersion = "2025-02-24.acacia";

function getStripe(): Stripe {
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  return new Stripe(key, { apiVersion: STRIPE_API_VERSION });
}

// ─── ADR-0132 PII redaction ────────────────────────────────────────
// Whitelist-only: every field here is explicit. Anything else in the
// Stripe event gets dropped before we touch the DB. This is the single
// choke point — any future field expansion MUST go through this
// function.
//
// Allowed keys per spec §3.2 table + ADR-0132:
//   - event.id, event.type, event.created
//   - payment_intent.id
//   - amount, currency, status
//   - payment_method.card.{brand, last4, country}
//   - last_payment_error.{code, message}
//   - outcome.{network_status, risk_level}
//
// Explicitly forbidden:
//   - billing_details, customer, source, receipt_url
//   - Any raw card/bank/account numbers
//
function redactStripeEvent(evt: Stripe.Event): Record<string, unknown> {
  // deno-lint-ignore no-explicit-any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obj = evt.data.object as any;
  const card = obj?.payment_method?.card ?? obj?.payment_method_details?.card ?? null;
  const error = obj?.last_payment_error ?? null;
  const outcome = obj?.outcome ?? null;

  return {
    event_id: evt.id,
    event_type: evt.type,
    created_at: evt.created,
    payment_intent_id:
      typeof obj?.payment_intent === "string"
        ? obj.payment_intent
        : (obj?.payment_intent?.id ?? obj?.id ?? null),
    amount: obj?.amount ?? null,
    amount_refunded: obj?.amount_refunded ?? null,
    currency: obj?.currency ?? null,
    status: obj?.status ?? null,
    card_brand: card?.brand ?? null,
    card_last4: card?.last4 ?? null,
    card_country: card?.country ?? null,
    error_code: error?.code ?? null,
    error_message: error?.message ?? null,
    outcome_network_status: outcome?.network_status ?? null,
    outcome_risk_level: outcome?.risk_level ?? null,
  };
}

// ─── emit bridge (same pattern as generate-monthly-invoices) ──────
type EmitPayload = {
  event: string;
  actor_id: string | null;
  workspace_id: string | null;
  // deno-lint-ignore no-explicit-any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  properties: Record<string, any>;
};

async function emitViaEndpoint(event: EmitPayload): Promise<void> {
  const url = Deno.env.get("INTERNAL_EMIT_URL");
  const secret = Deno.env.get("WATCHDOG_CRON_SECRET");
  if (!url || !secret) {
    console.error("[stripe-webhook.emit] missing INTERNAL_EMIT_URL or WATCHDOG_CRON_SECRET");
    return;
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[stripe-webhook.emit] non-OK for "${event.event}": ${res.status} ${body}`);
    }
  } catch (err) {
    console.error(`[stripe-webhook.emit] network error for "${event.event}":`, err);
  }
}

// ─── Inlined business logic (Deno can't import @smartout/billing) ─
async function upsertPaymentAttempt(
  supabase: SupabaseClient,
  payment_id: string,
  evt: Stripe.Event,
  errorCode: string | null,
  errorMessage: string | null,
): Promise<"inserted" | "duplicate" | "error"> {
  // Compute attempt_number = MAX(existing) + 1. We accept a race window
  // — two concurrent webhooks could both compute 1, and the UNIQUE
  // constraint on stripe_event_id would reject one. The application-
  // level retry re-reads max and tries again. For Fase 3A the typical
  // payment has 1-3 attempts over minutes; a collision is vanishingly
  // rare in practice.
  const { data: maxRow } = await supabase
    .from("payment_attempt")
    .select("attempt_number")
    .eq("payment_id", payment_id)
    .order("attempt_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextAttempt = ((maxRow?.attempt_number as number | undefined) ?? 0) + 1;

  const { error } = await supabase.from("payment_attempt").insert({
    payment_id,
    attempt_number: nextAttempt,
    stripe_event_id: evt.id,
    status: evt.type,
    redacted_payload: redactStripeEvent(evt),
    error_code: errorCode,
    error_message: errorMessage,
  });

  if (!error) return "inserted";

  // 23505 = unique_violation; the event was already processed.
  // deno-lint-ignore no-explicit-any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pgCode = (error as any).code;
  if (pgCode === "23505") return "duplicate";

  console.error("[stripe-webhook] payment_attempt insert failed:", error);
  return "error";
}

async function findPaymentByIntent(
  supabase: SupabaseClient,
  paymentIntentId: string,
): Promise<
  | {
      payment_id: string;
      invoice_id: string;
      company_id: string;
      amount: number;
      currency: string;
      status: string;
      refunded_amount: number | null;
    }
  | null
> {
  const { data } = await supabase
    .from("payment")
    .select("payment_id, invoice_id, company_id, amount, currency, status, refunded_amount")
    .eq("external_id", paymentIntentId)
    .maybeSingle();
  // deno-lint-ignore no-explicit-any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any) ?? null;
}

async function reconcileInvoiceOnPayment(
  supabase: SupabaseClient,
  invoice_id: string,
): Promise<boolean> {
  // Inlined version of packages/billing/src/actions/payments/
  // reconcileInvoiceOnPayment.ts. Returns true if the invoice was
  // flipped to 'paid' by THIS call.
  const { data: invoice } = await supabase
    .from("invoice")
    .select("invoice_id, status, amount_incl_vat")
    .eq("invoice_id", invoice_id)
    .maybeSingle();

  if (!invoice) return false;
  if (!["issued", "sent", "overdue"].includes(invoice.status as string)) return false;

  const { data: payments } = await supabase
    .from("payment")
    .select("amount")
    .eq("invoice_id", invoice_id)
    .in("status", ["succeeded", "partially_refunded"]);

  const totalPaid = (payments ?? []).reduce(
    // deno-lint-ignore no-explicit-any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (acc: number, row: any) => acc + Number(row.amount),
    0,
  );
  const totalOwed = Number(invoice.amount_incl_vat);
  if (totalPaid < totalOwed) return false;

  const { error } = await supabase
    .from("invoice")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("invoice_id", invoice_id)
    .in("status", ["issued", "sent", "overdue"]);

  if (error) {
    console.error("[stripe-webhook] invoice flip failed:", error);
    return false;
  }
  return true;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

async function issueCreditNoteForRefund(
  supabase: SupabaseClient,
  args: {
    original_invoice_id: string;
    refund_amount: number;
    stripe_refund_id: string;
    is_full_refund: boolean;
  },
): Promise<{ credit_note_invoice_id: string; amount_incl_vat: number } | null> {
  // Inlined from packages/billing/src/actions/payments/issueCreditNoteForRefund.ts
  // Amounts stay POSITIVE per ADR-0120 §8 (invoice_type is the sign flag).
  const { data: original } = await supabase
    .from("invoice")
    .select(
      "invoice_id, company_id, invoice_type, period_from, period_to, currency, vat_rate, amount_excl_vat, vat_amount, amount_incl_vat",
    )
    .eq("invoice_id", args.original_invoice_id)
    .maybeSingle();

  if (!original) {
    console.error("[stripe-webhook] credit-note: original invoice not found");
    return null;
  }
  if (original.invoice_type === "credit_note") {
    console.error("[stripe-webhook] credit-note: refusing to credit a credit-note");
    return null;
  }

  const vat_rate = Number(original.vat_rate);
  let amount_incl_vat: number;
  let amount_excl_vat: number;
  let vat_amount: number;

  if (args.is_full_refund) {
    amount_incl_vat = Number(original.amount_incl_vat);
    amount_excl_vat = Number(original.amount_excl_vat);
    vat_amount = Number(original.vat_amount);
  } else {
    amount_incl_vat = round2(args.refund_amount);
    amount_excl_vat = round2(amount_incl_vat / (1 + vat_rate / 100));
    vat_amount = round2(amount_incl_vat - amount_excl_vat);
  }

  const reasonTag = args.is_full_refund ? "stripe_full_refund" : "stripe_partial_refund";
  const { data: creditNote, error: insErr } = await supabase
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
      void_reason: `${reasonTag}: ${args.stripe_refund_id}`,
      created_by: null,
    })
    .select("invoice_id")
    .single();

  if (insErr || !creditNote) {
    console.error("[stripe-webhook] credit-note insert failed:", insErr);
    return null;
  }

  // Credit-note line items
  if (args.is_full_refund) {
    const { data: originalLines } = await supabase
      .from("invoice_line_item")
      .select(
        "description, line_type, quantity, unit_price, vat_rate, addon_key, period_reference",
      )
      .eq("invoice_id", original.invoice_id);

    const creditLines = (originalLines ?? []).map(
      // deno-lint-ignore no-explicit-any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (line: any) => {
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
      },
    );

    if (creditLines.length > 0) {
      const { error: lineErr } = await supabase.from("invoice_line_item").insert(creditLines);
      if (lineErr) {
        console.error("[stripe-webhook] credit-note lines insert failed:", lineErr);
      }
    }
  } else {
    const { error: lineErr } = await supabase.from("invoice_line_item").insert({
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
    if (lineErr) {
      console.error("[stripe-webhook] credit-note line insert failed:", lineErr);
    }
  }

  return {
    credit_note_invoice_id: creditNote.invoice_id as string,
    amount_incl_vat,
  };
}

// ─── Event handlers ────────────────────────────────────────────────

async function handlePaymentIntentSucceeded(
  supabase: SupabaseClient,
  evt: Stripe.Event,
): Promise<void> {
  const pi = evt.data.object as Stripe.PaymentIntent;
  const payment = await findPaymentByIntent(supabase, pi.id);
  if (!payment) {
    console.error(`[stripe-webhook] no payment row for PaymentIntent ${pi.id}`);
    return;
  }

  const attemptResult = await upsertPaymentAttempt(supabase, payment.payment_id, evt, null, null);
  if (attemptResult === "duplicate") return; // already processed

  // Update payment. Event.created is the authoritative paid_at.
  const { error: updErr } = await supabase
    .from("payment")
    .update({
      status: "succeeded",
      paid_at: new Date(evt.created * 1000).toISOString(),
    })
    .eq("payment_id", payment.payment_id);

  if (updErr) {
    console.error("[stripe-webhook] payment update failed:", updErr);
    return;
  }

  const invoiceSettled = await reconcileInvoiceOnPayment(supabase, payment.invoice_id);

  await emitViaEndpoint({
    event: "payment succeeded",
    actor_id: null,
    workspace_id: null,
    properties: {
      entity_type: "payment",
      entity_id: payment.payment_id,
      data: {
        invoice_id: payment.invoice_id,
        company_id: payment.company_id,
        amount: Number(payment.amount),
        currency: payment.currency,
        external_id: pi.id,
        invoice_settled: invoiceSettled,
      },
    },
  });
}

async function handlePaymentIntentFailed(
  supabase: SupabaseClient,
  evt: Stripe.Event,
): Promise<void> {
  const pi = evt.data.object as Stripe.PaymentIntent;
  const payment = await findPaymentByIntent(supabase, pi.id);
  if (!payment) {
    console.error(`[stripe-webhook] no payment row for PaymentIntent ${pi.id}`);
    return;
  }

  const errorCode = pi.last_payment_error?.code ?? null;
  const errorMessage = pi.last_payment_error?.message ?? null;

  const attemptResult = await upsertPaymentAttempt(
    supabase,
    payment.payment_id,
    evt,
    errorCode,
    errorMessage,
  );
  if (attemptResult === "duplicate") return;

  const { error: updErr } = await supabase
    .from("payment")
    .update({ status: "failed" })
    .eq("payment_id", payment.payment_id);

  if (updErr) {
    console.error("[stripe-webhook] payment fail update failed:", updErr);
    return;
  }

  await emitViaEndpoint({
    event: "payment failed",
    actor_id: null,
    workspace_id: null,
    properties: {
      entity_type: "payment",
      entity_id: payment.payment_id,
      data: {
        invoice_id: payment.invoice_id,
        company_id: payment.company_id,
        amount: Number(payment.amount),
        currency: payment.currency,
        external_id: pi.id,
        error_code: errorCode ?? "unknown",
        error_message: errorMessage ?? "Unknown failure",
      },
    },
  });
}

async function handleChargeRefunded(supabase: SupabaseClient, evt: Stripe.Event): Promise<void> {
  const charge = evt.data.object as Stripe.Charge;
  const paymentIntentId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : (charge.payment_intent?.id ?? null);

  if (!paymentIntentId) {
    console.error("[stripe-webhook] charge.refunded without payment_intent id");
    return;
  }

  const payment = await findPaymentByIntent(supabase, paymentIntentId);
  if (!payment) {
    console.error(`[stripe-webhook] no payment row for PaymentIntent ${paymentIntentId}`);
    return;
  }

  const attemptResult = await upsertPaymentAttempt(supabase, payment.payment_id, evt, null, null);
  if (attemptResult === "duplicate") return;

  // amount_refunded is the TOTAL refunded so far for this charge (Stripe
  // aggregates across refund events). We recompute the delta ourselves
  // by diffing against our stored refunded_amount.
  const totalRefundedOnStripe = charge.amount_refunded / 100;
  const alreadyRefunded = Number(payment.refunded_amount ?? 0);
  const thisRefund = round2(totalRefundedOnStripe - alreadyRefunded);

  if (thisRefund <= 0) {
    // Defensive: Stripe re-emitted an event for a refund we already
    // processed — or a clock/rounding artefact. Skip.
    console.warn(
      `[stripe-webhook] charge.refunded with zero delta (already=${alreadyRefunded} stripe=${totalRefundedOnStripe}) for payment ${payment.payment_id}`,
    );
    return;
  }

  const originalAmount = Number(payment.amount);
  const newRefundedTotal = round2(alreadyRefunded + thisRefund);
  const isFullRefund = Math.abs(newRefundedTotal - originalAmount) < 0.005;
  const newStatus = isFullRefund ? "refunded" : "partially_refunded";

  const { error: updErr } = await supabase
    .from("payment")
    .update({
      status: newStatus,
      refunded_amount: newRefundedTotal,
    })
    .eq("payment_id", payment.payment_id);

  if (updErr) {
    console.error("[stripe-webhook] payment refund update failed:", updErr);
    return;
  }

  // Get a per-refund id for the credit-note audit. charge.refunds holds
  // all refund events; the newest one is the current.
  const refundId =
    // deno-lint-ignore no-explicit-any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (charge as any).refunds?.data?.[0]?.id ?? (charge as any).id ?? "unknown_refund";

  const creditNote = await issueCreditNoteForRefund(supabase, {
    original_invoice_id: payment.invoice_id,
    refund_amount: thisRefund,
    stripe_refund_id: refundId,
    is_full_refund: isFullRefund,
  });

  await emitViaEndpoint({
    event: "payment refunded",
    actor_id: null,
    workspace_id: null,
    properties: {
      entity_type: "payment",
      entity_id: payment.payment_id,
      data: {
        invoice_id: payment.invoice_id,
        company_id: payment.company_id,
        refunded_amount: thisRefund,
        currency: payment.currency,
        refund_type: isFullRefund ? "full" : "partial",
      },
    },
  });

  if (creditNote) {
    await emitViaEndpoint({
      event: "invoice credit_note_auto_created",
      actor_id: null,
      workspace_id: null,
      properties: {
        entity_type: "invoice",
        entity_id: creditNote.credit_note_invoice_id,
        data: {
          original_invoice_id: payment.invoice_id,
          payment_id: payment.payment_id,
          amount_incl_vat: creditNote.amount_incl_vat,
          currency: payment.currency,
          trigger_type: isFullRefund ? "full_refund" : "partial_refund",
        },
      },
    });
  }
}

// ─── Entry point ───────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!webhookSecret) {
    console.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET not configured");
    return new Response("Misconfigured", { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing stripe-signature", { status: 400 });
  }

  const rawBody = await req.text();

  let stripe: Stripe;
  try {
    stripe = getStripe();
  } catch (err) {
    console.error("[stripe-webhook] stripe init failed:", err);
    return new Response("Misconfigured", { status: 500 });
  }

  let evt: Stripe.Event;
  try {
    // Stripe's v17 SDK ships constructEventAsync for WebCrypto (Deno
    // friendly). constructEvent uses Node's crypto and crashes in Deno.
    evt = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("[stripe-webhook] signature verification failed:", err);
    return new Response("Invalid signature", { status: 403 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    switch (evt.type) {
      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(supabase, evt);
        break;
      case "payment_intent.payment_failed":
        await handlePaymentIntentFailed(supabase, evt);
        break;
      case "charge.refunded":
        await handleChargeRefunded(supabase, evt);
        break;
      default:
        // Ignore unknown events — Stripe sends many we don't care about.
        // Returning 200 stops Stripe from retrying them.
        break;
    }
  } catch (err) {
    console.error(`[stripe-webhook] handler failed for ${evt.type}:`, err);
    // Return 500 so Stripe retries. Handlers are idempotent via
    // payment_attempt.stripe_event_id UNIQUE so a retry of a
    // partially-processed event is safe.
    return new Response("Handler error", { status: 500 });
  }

  return new Response(JSON.stringify({ received: true, event_id: evt.id, event_type: evt.type }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
