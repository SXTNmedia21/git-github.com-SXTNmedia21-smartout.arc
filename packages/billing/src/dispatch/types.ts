// Dispatch adapter contract — Spor A of Billing Engine Fase 2.
//
// Every concrete adapter (email / http_api / peppol_ehf / …) implements
// DispatchAdapter. The engine-dispatch 'dispatch_invoice' action-handler
// instantiates the right adapter by channel, calls send(), and persists
// the DispatchResult onto the invoice_dispatch row (ADR-0126).
//
// Keep this file environment-agnostic: Node Server Actions + React Native
// mobile callers import it. No Deno or Next.js-only dependencies.

import type { BillingDispatchChannel, BillingDispatchTemplate, Invoice } from "../types";

/**
 * Input passed to every adapter's send() call.
 *
 * - `invoice`: full invoice row (already loaded by the handler so every
 *   adapter works off the same snapshot)
 * - `target`: channel-specific JSON payload from the matching
 *   billing_dispatch_rule — adapters validate their own expected shape
 * - `template`: optional billing_dispatch_template body/subject the
 *   adapter renders (Mustache-style {{invoice.number}} placeholders)
 */
export type DispatchInput = {
  invoice: Invoice;
  target: Record<string, unknown>;
  template?: BillingDispatchTemplate | null;
  /**
   * Idempotency key passed through to adapters that expose one
   * (e.g. HttpApiAdapter sets `X-Smartout-Invoice-Dispatch-Id`).
   * Resolves to `invoice_dispatch_id` in the handler.
   */
  invoice_dispatch_id: string;
};

/**
 * Discriminated union the handler pattern-matches on. Each variant is
 * persisted to invoice_dispatch columns:
 *
 *  - delivered  → delivered_at, external_reference, status='delivered'
 *  - in_flight  → external_reference, status='in_flight', schedule a
 *                 follow-up poll at check_back_at
 *  - failed     → error_code, error_message; retryable drives whether
 *                 the engine_state retry loop reschedules
 */
export type DispatchResult =
  | { status: "delivered"; external_reference: string }
  | {
      status: "in_flight";
      external_reference: string;
      check_back_at: Date;
    }
  | {
      status: "failed";
      error_code: string;
      error_message: string;
      retryable: boolean;
    };

/**
 * Result of a "Test connection" click (Platform-admin UI).
 *
 * Four-outcome taxonomy matches Fase 2 spec §13 motion specs:
 *   ok | error | timeout | ambiguous (ambiguous is currently folded into
 *   error with a specific message — adapters can widen later without
 *   breaking the interface).
 */
export type TestConnectionResult =
  | { status: "ok" }
  | { status: "error"; message: string }
  | { status: "timeout" };

/**
 * The contract every channel adapter implements.
 *
 * send() MUST be idempotent on `invoice_dispatch_id`: if the remote has
 * already accepted this dispatch, return `delivered` with the original
 * external_reference rather than creating a duplicate.
 */
export type DispatchAdapter = {
  channel: BillingDispatchChannel;
  send(input: DispatchInput): Promise<DispatchResult>;
  testConnection?(target: Record<string, unknown>): Promise<TestConnectionResult>;
};

/**
 * Rendering context for template placeholder resolution. Kept minimal —
 * adapters should not rely on anything not in this shape.
 */
export type TemplateContext = {
  invoice: {
    /** Human-readable invoice number. Column stores an integer per Fase 1
     *  (assign_invoice_number trigger). Null until the invoice is issued. */
    number: number | null;
    invoice_id: string;
    amount_incl_vat: number | string;
    amount_excl_vat: number | string;
    vat_amount: number | string;
    period_from: string;
    period_to: string;
    due_at: string | null;
    status: string;
  };
};
