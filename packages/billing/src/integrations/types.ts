// Integration adapter contract — Spor B of Billing Engine Fase 2.
//
// Every concrete integration (fiken / tripletex / stripe / placeholder)
// implements IntegrationAdapter. The engine-dispatch 'sync_integration'
// action-handler instantiates the right adapter by integration_type,
// calls sync(), and persists the outcome onto billing_integration
// (last_sync_at, last_sync_status) per ADR-0126.
//
// ADR-0129: the PlaceholderAdapter MUST return { status: 'mocked' }
// rather than 'succeeded' so the audit trail preserves truth. The
// sync_integration handler also asserts is_placeholder alignment:
// a real adapter returning 'succeeded' on an is_placeholder=true row
// emits 'integration audit violation' and aborts the engine step.
//
// Keep this file environment-agnostic: Node Server Actions + React
// Native mobile callers import it. No Deno or Next.js-only
// dependencies here.
//
// Fase 3 replaces PlaceholderAdapter entries in the registry with real
// Fiken / Tripletex / Stripe / PeppolEhfAdapter implementations. The
// enum already covers those types so the registry signature is stable.

import type { BillingIntegration, BillingIntegrationType } from "../types";

/**
 * Entity kinds that an integration can sync outbound. Each integration
 * adapter advertises the subset it supports via `supports[]`; the
 * handler filters before calling `sync()`.
 */
export type IntegrationEntity = "customer" | "invoice" | "contract" | "product" | "plan";

/**
 * Operation kind mirrors the lifecycle event that triggered the sync.
 * `delete` covers termination / cancellation flows; adapters may map
 * this to archive semantics in the remote system if hard-delete is
 * unsupported.
 */
export type IntegrationOperation = "create" | "update" | "delete";

/**
 * Input passed to every adapter's sync() call.
 *
 * - `integration`: full billing_integration row so the adapter sees
 *   config + is_placeholder without a secondary lookup.
 * - `entity_type`: the domain entity being synced.
 * - `operation`: lifecycle verb that drove this sync.
 * - `payload`: entity snapshot the handler pre-loaded. Shape varies
 *   per entity_type; adapters validate what they expect.
 */
export type SyncInput = {
  integration: BillingIntegration;
  entity_type: IntegrationEntity;
  operation: IntegrationOperation;
  payload: Record<string, unknown>;
};

/**
 * Discriminated union the handler pattern-matches on. Each variant is
 * persisted to billing_integration + emits a distinct telemetry event:
 *
 *  - succeeded → last_sync_status='ok', emits 'integration sync succeeded'
 *  - mocked    → last_sync_status='ok', emits 'integration sync mocked'
 *                (ADR-0129 — PlaceholderAdapter ONLY)
 *  - failed    → last_sync_status='error', emits 'integration sync failed';
 *                retryable drives whether the engine_state retry loop
 *                reschedules.
 */
export type SyncResult =
  | { status: "succeeded"; external_reference: string }
  | { status: "mocked"; external_reference: null }
  | {
      status: "failed";
      error_code: string;
      error_message: string;
      retryable: boolean;
    };

/**
 * Result of a "Test connection" click (Platform-admin UI). Four-outcome
 * taxonomy matches Fase 2 spec §13 micro-interaction specs.
 *
 * `is_placeholder: true` on an `ok` result signals the UI to render the
 * distinct placeholder badge — test succeeded, but the adapter is a
 * mock.
 *
 * Renamed away from `TestConnectionResult` to avoid a barrel-export
 * collision with the dispatch sub-package's test-connection type.
 */
export type IntegrationTestConnectionResult =
  | { status: "ok"; is_placeholder?: boolean }
  | { status: "error"; message: string }
  | { status: "ambiguous"; message: string }
  | { status: "timeout" };

/**
 * Result of an inbound-poll cycle for Fase 3B Spor D (ADR-0138).
 *
 * `payments` lists everything the vendor returned since `since`. The
 * handler matches each entry against Smartout invoices by
 * `invoice_reference` (= invoice_number or invoice.external_reference)
 * plus amount + currency. Unmatched entries fire
 * `integration poll_no_match`; matched entries fire
 * `integration poll_found_payment` and create a `payment` row.
 *
 * Adapter guarantees: all timestamps are ISO-8601 UTC strings; amounts
 * are positive decimals in the integration's currency; external_id is
 * stable across re-polls (idempotens key for the UNIQUE partial index
 * `payment_external_id_company_unique`).
 */
export type PollResult =
  | {
      status: "ok";
      payments: ReadonlyArray<{
        external_id: string; // vendor's payment id (Fiken: bet-id, Tripletex: voucher-id)
        invoice_reference: string; // their reference matching Smartout invoice_number or invoice.external_reference
        amount: number;
        currency: string;
        paid_at: string; // ISO-8601 UTC
      }>;
    }
  | {
      status: "error";
      error_message: string;
    };

/**
 * The contract every integration adapter implements.
 *
 * sync() MUST be idempotent on (integration_id, entity_type, entity_id):
 * if the remote already holds this entity snapshot, return `succeeded`
 * with the remote external_reference rather than creating a duplicate.
 * The PlaceholderAdapter trivially satisfies this by returning `mocked`
 * on every call.
 *
 * pollPayments() is OPTIONAL (ADR-0138): only Fiken + Tripletex
 * implement it in Fase 3B. PlaceholderAdapter + Stripe leave it
 * undefined — the `poll_integration_payments` handler filters via
 * `include_types` in its action_payload plus a runtime `typeof
 * adapter.pollPayments === 'function'` check.
 */
export type IntegrationAdapter = {
  type: BillingIntegrationType;
  /** Entity kinds this adapter can sync. Handler filters before calling. */
  supports: readonly IntegrationEntity[];
  sync(input: SyncInput): Promise<SyncResult>;
  testConnection(integration: BillingIntegration): Promise<IntegrationTestConnectionResult>;
  /**
   * Inbound-poll of vendor payments since `since`. Fiken + Tripletex
   * implement this in Fase 3B B2; PlaceholderAdapter + StripeAdapter
   * leave it undefined (Stripe payments arrive via webhook, not poll).
   */
  pollPayments?(integration: BillingIntegration, since: Date): Promise<PollResult>;
};
