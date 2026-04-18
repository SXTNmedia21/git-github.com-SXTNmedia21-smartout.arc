// ADR-0132 PII redaction — the single choke point for Stripe event
// payloads before they touch the database.
//
// Whitelist-only: every field listed here is explicit. Anything else in
// the Stripe event gets dropped. Any future field expansion MUST go
// through this function. The Deno-side Edge Function inlines an
// identical copy (Deno cannot import @smartout/billing); Vitest here
// is the canonical spec that both sides must agree on.
//
// Allowed keys per Fase 3A spec §3.2 + ADR-0132:
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

import type Stripe from "stripe";

export type RedactedStripeEvent = {
  event_id: string;
  event_type: string;
  created_at: number;
  payment_intent_id: string | null;
  amount: number | null;
  amount_refunded: number | null;
  currency: string | null;
  status: string | null;
  card_brand: string | null;
  card_last4: string | null;
  card_country: string | null;
  error_code: string | null;
  error_message: string | null;
  outcome_network_status: string | null;
  outcome_risk_level: string | null;
};

// Forbidden keys for assertion in tests. Not exported for runtime use.
export const FORBIDDEN_KEYS = [
  "billing_details",
  "customer",
  "source",
  "receipt_url",
  "receipt_email",
  "payment_method_options",
  "shipping",
  "metadata",
  "client_secret",
] as const;

export function redactStripeEvent(evt: Stripe.Event): RedactedStripeEvent {
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
