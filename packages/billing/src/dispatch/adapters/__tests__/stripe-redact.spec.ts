// ADR-0132 PII redaction spec. This is the canonical test — any
// future change to redactStripeEvent MUST preserve these invariants.
// The Deno-side stripe-webhook inlines an identical copy of the
// function; drift between sides is caught by this suite + review.

import { describe, test, expect } from "vitest";
import type Stripe from "stripe";
import { redactStripeEvent, FORBIDDEN_KEYS } from "../stripe-redact";

// ─── Fixture: realistic Stripe payment_intent.succeeded event ────
function makeSucceededEvent(): Stripe.Event {
  return {
    id: "evt_1Xyz123",
    object: "event",
    api_version: "2025-02-24.acacia",
    created: 1714000000,
    livemode: false,
    pending_webhooks: 0,
    type: "payment_intent.succeeded",
    request: { id: null, idempotency_key: null },
    data: {
      object: {
        id: "pi_1ABC456",
        object: "payment_intent",
        amount: 12500,
        amount_received: 12500,
        currency: "nok",
        status: "succeeded",
        // PII / forbidden keys that MUST be dropped
        billing_details: {
          name: "Kari Nordmann",
          email: "kari@example.com",
          phone: "+4798765432",
          address: {
            line1: "Karl Johans gate 1",
            city: "Oslo",
            postal_code: "0154",
            country: "NO",
          },
        },
        customer: "cus_sensitive",
        receipt_email: "kari@example.com",
        receipt_url: "https://pay.stripe.com/receipts/abc123",
        // Contrived short value — the hook's generic-secret regex rejects
        // any string > 20 chars in this position. We assert redaction by
        // key name, not by string length, so short is fine.
        client_secret: "short_redact",
        shipping: { name: "Kari", address: { line1: "somewhere" } },
        source: { id: "src_tokened", type: "card" },
        metadata: { invoice_id: "some-uuid" },
        payment_method: {
          id: "pm_1XYZ789",
          card: { brand: "visa", last4: "4242", country: "NO" },
        },
        outcome: { network_status: "approved_by_network", risk_level: "normal" },
      },
    },
  } as unknown as Stripe.Event;
}

function makeFailedEvent(): Stripe.Event {
  return {
    id: "evt_1Failed",
    object: "event",
    api_version: "2025-02-24.acacia",
    created: 1714000100,
    livemode: false,
    pending_webhooks: 0,
    type: "payment_intent.payment_failed",
    request: { id: null, idempotency_key: null },
    data: {
      object: {
        id: "pi_1Failed",
        object: "payment_intent",
        amount: 12500,
        currency: "nok",
        status: "requires_payment_method",
        customer: "cus_sensitive",
        billing_details: { email: "pii@example.com" },
        last_payment_error: {
          code: "card_declined",
          message: "Your card was declined.",
          type: "card_error",
          decline_code: "generic_decline",
        },
      },
    },
  } as unknown as Stripe.Event;
}

describe("redactStripeEvent — allowed fields", () => {
  test("keeps the whitelisted fields from a succeeded event", () => {
    const redacted = redactStripeEvent(makeSucceededEvent());
    expect(redacted).toMatchObject({
      event_id: "evt_1Xyz123",
      event_type: "payment_intent.succeeded",
      created_at: 1714000000,
      payment_intent_id: "pi_1ABC456",
      amount: 12500,
      currency: "nok",
      status: "succeeded",
      card_brand: "visa",
      card_last4: "4242",
      card_country: "NO",
      outcome_network_status: "approved_by_network",
      outcome_risk_level: "normal",
    });
  });

  test("captures last_payment_error code + message on a failed event", () => {
    const redacted = redactStripeEvent(makeFailedEvent());
    expect(redacted.error_code).toBe("card_declined");
    expect(redacted.error_message).toBe("Your card was declined.");
  });
});

describe("redactStripeEvent — forbidden fields", () => {
  test.each(FORBIDDEN_KEYS)("strips %s from the output", (key) => {
    const redacted = redactStripeEvent(makeSucceededEvent()) as Record<string, unknown>;
    expect(redacted).not.toHaveProperty(key);
  });

  test("never exposes raw customer id", () => {
    const redacted = redactStripeEvent(makeSucceededEvent()) as Record<string, unknown>;
    expect(JSON.stringify(redacted)).not.toContain("cus_sensitive");
  });

  test("never exposes email or phone from billing_details", () => {
    const redacted = redactStripeEvent(makeSucceededEvent()) as Record<string, unknown>;
    const serialized = JSON.stringify(redacted);
    expect(serialized).not.toContain("kari@example.com");
    expect(serialized).not.toContain("+4798765432");
    expect(serialized).not.toContain("Karl Johans gate");
  });

  test("never exposes receipt_url", () => {
    const redacted = redactStripeEvent(makeSucceededEvent()) as Record<string, unknown>;
    expect(JSON.stringify(redacted)).not.toContain("pay.stripe.com/receipts");
  });

  test("never exposes client_secret", () => {
    const redacted = redactStripeEvent(makeSucceededEvent()) as Record<string, unknown>;
    expect(JSON.stringify(redacted)).not.toContain("short_redact");
  });
});

describe("redactStripeEvent — snapshot", () => {
  // Snapshot the exact shape of a realistic payload. If a future
  // refactor accidentally adds a new field (e.g. via spread), this
  // flips red and forces a review of whether the new key is PCI-safe.
  test("matches canonical shape for payment_intent.succeeded", () => {
    const redacted = redactStripeEvent(makeSucceededEvent());
    expect(redacted).toMatchInlineSnapshot(`
      {
        "amount": 12500,
        "amount_refunded": null,
        "card_brand": "visa",
        "card_country": "NO",
        "card_last4": "4242",
        "created_at": 1714000000,
        "currency": "nok",
        "error_code": null,
        "error_message": null,
        "event_id": "evt_1Xyz123",
        "event_type": "payment_intent.succeeded",
        "outcome_network_status": "approved_by_network",
        "outcome_risk_level": "normal",
        "payment_intent_id": "pi_1ABC456",
        "status": "succeeded",
      }
    `);
  });
});
