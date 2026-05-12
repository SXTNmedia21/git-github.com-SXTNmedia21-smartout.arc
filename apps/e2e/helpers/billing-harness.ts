// =============================================================================
// helpers/billing-harness.ts
//
// Billing-capability–specific assertion helpers for billing-query-harness-e2e.spec.ts.
//
// Builds on the base assertion helpers in botsson-harness.ts.  This file adds:
//
//   assertBillingToolFired(sessionId, toolName, opts)
//     — polls agent_session_recording for a tool_call row naming the tool.
//
//   assertBillingCapabilityClassified(sessionId, sinceIso, poll)
//     — polls agent_session_recording for a classifier_output row where
//       intent === 'billing_query'.
//
//   assertBotssontoolInvokedFor(toolName, sinceIso, opts)
//     — polls activity_trail for "botsson.tool_invoked" with data.tool
//       matching the given tool name.
//
//   seedInvoiceForSeedCompanyIfAbsent()
//     — inserts a minimal paid invoice for company a0000000-...0 (seed company)
//       so list_my_invoices returns at least one row.  Idempotent.
//
//   assertNoFinancialPiiInResponse(responseText, context)
//     — asserts the response does NOT leak raw invoice amounts in a way that
//       exposes card numbers, IBAN, or account sequences.
//       Note: invoice amounts (e.g. "3125 NOK") are NOT PII — they are the
//       data the billing tool legitimately narrates.  This guard targets
//       raw card numbers and IBAN sequences only.
//
// ADR refs: ADR-0078 (channel guard), ADR-0099 (gate_action),
//           ADR-0118 (billing engine), ADR-0134 (telemetry),
//           ADR-0151 (server-side profile_id derivation), ADR-0184 (recorder).
// =============================================================================

import { expect } from "@playwright/test";
import {
  assertRecordingPhase,
  assertActivityTrailEvent,
  type RecordingRow,
  type ActivityTrailRow,
  SEED_WORKSPACE_ID,
  SEED_PROFILE_ID,
} from "./botsson-harness";
import { supabase } from "./seed";

export { SEED_WORKSPACE_ID, SEED_PROFILE_ID };

// Seed company for the primary seed workspace.
// workspace b0000000 → company a0000000 (Smartout AS) per seed.sql line 20.
export const SEED_COMPANY_ID = "a0000000-0000-0000-0000-000000000000";

// Sentinel invoice_id used by the seed helper — deterministic so the helper
// is idempotent across test runs without accumulating rows.
export const SEED_INVOICE_ID = "b1ll1111-e2e0-0000-0000-000000000001";

// ---------------------------------------------------------------------------
// PollOptions — mirrors the unexported type in botsson-harness.ts
// ---------------------------------------------------------------------------
export type PollOptions = {
  timeoutMs?: number;
  intervalMs?: number;
};

// ---------------------------------------------------------------------------
// seedInvoiceForSeedCompanyIfAbsent
// ---------------------------------------------------------------------------

/**
 * Ensure at least one invoice exists for the seed company (a0000000-...0) so
 * list_my_invoices returns a non-empty result.  Uses a fixed invoice_id so
 * the insert is idempotent (ON CONFLICT DO NOTHING).
 *
 * Returns the invoice_id of either the pre-existing or newly inserted row.
 */
export async function seedInvoiceForSeedCompanyIfAbsent(): Promise<string> {
  const { data: existing } = await supabase
    .from("invoice")
    .select("invoice_id")
    .eq("invoice_id", SEED_INVOICE_ID)
    .maybeSingle();

  if (existing) return SEED_INVOICE_ID;

  const { data: inserted, error } = await supabase
    .from("invoice")
    .insert({
      invoice_id: SEED_INVOICE_ID,
      company_id: SEED_COMPANY_ID,
      invoice_type: "recurring",
      status: "paid",
      period_from: "2026-01-01",
      period_to: "2026-01-31",
      issued_at: "2026-02-01T08:00:00+00:00",
      due_at: "2026-02-14",
      sent_at: "2026-02-01T09:00:00+00:00",
      paid_at: "2026-02-10T14:30:00+00:00",
      amount_excl_vat: 2000.0,
      vat_rate: 25.0,
      vat_amount: 500.0,
      amount_incl_vat: 2500.0,
      currency: "NOK",
    })
    .select("invoice_id")
    .single();

  if (error || !inserted) {
    console.warn(
      `seedInvoiceForSeedCompanyIfAbsent: insert failed: ${error?.message ?? "no row"}. ` +
        "list_my_invoices will return empty; tests will degrade gracefully.",
    );
    return SEED_INVOICE_ID;
  }

  return inserted.invoice_id as string;
}

// ---------------------------------------------------------------------------
// assertBillingToolFired
// ---------------------------------------------------------------------------

/**
 * Poll agent_session_recording for a `tool_call` row naming the given billing tool.
 * Returns the matched row.
 */
export async function assertBillingToolFired(
  sessionId: string,
  toolName: string,
  opts: {
    sinceIso?: string;
    poll?: PollOptions;
  } = {},
): Promise<RecordingRow> {
  return assertRecordingPhase({
    sessionId,
    phase: "tool_call",
    turnKind: "tool_invocation",
    contentPredicate: (c) => {
      const content = c as Record<string, unknown>;
      return typeof content?.tool_name === "string" && content.tool_name === toolName;
    },
    sinceIso: opts.sinceIso,
    poll: opts.poll ?? { timeoutMs: 20_000 },
  });
}

// ---------------------------------------------------------------------------
// assertBillingCapabilityClassified
// ---------------------------------------------------------------------------

/**
 * Poll agent_session_recording for a classifier_output row where
 * intent === 'billing_query'.  Returns the matched row.
 */
export async function assertBillingCapabilityClassified(
  sessionId: string,
  sinceIso: string,
  poll?: PollOptions,
): Promise<RecordingRow> {
  return assertRecordingPhase({
    sessionId,
    phase: "classifier_output",
    turnKind: "user_input",
    contentPredicate: (c) => {
      const content = c as Record<string, unknown>;
      return typeof content?.intent === "string" && content.intent === "billing_query";
    },
    sinceIso,
    poll: poll ?? { timeoutMs: 20_000 },
  });
}

// ---------------------------------------------------------------------------
// assertBotssontoolInvokedFor
// ---------------------------------------------------------------------------

/**
 * Poll activity_trail for a "botsson.tool_invoked" event where data.tool
 * matches the given billing tool name.
 */
export async function assertBotssontoolInvokedFor(
  toolName: string,
  sinceIso: string,
  opts: {
    workspaceId?: string;
    actorId?: string;
    poll?: PollOptions;
  } = {},
): Promise<ActivityTrailRow> {
  return assertActivityTrailEvent({
    event: "botsson.tool_invoked",
    workspaceId: opts.workspaceId ?? SEED_WORKSPACE_ID,
    actorId: opts.actorId ?? SEED_PROFILE_ID,
    dataPredicate: (d) => {
      const data = d as Record<string, unknown>;
      return data?.tool === toolName;
    },
    sinceIso,
    poll: opts.poll ?? { timeoutMs: 20_000 },
  });
}

// ---------------------------------------------------------------------------
// assertNoFinancialPiiInResponse
// ---------------------------------------------------------------------------

/**
 * Assert that the response text does NOT contain raw financial account
 * identifiers: IBAN sequences, card numbers (16 digits), or Norwegian
 * bank account numbers in dotted format.
 *
 * Note: invoice amounts, amounts_incl_vat, currency values are NOT PII
 * in the billing context — they are the legitimate narration output.
 * This guard targets account-holder identifiers only.
 */
export function assertNoFinancialPiiInResponse(responseText: string, context: string): void {
  // IBAN — up to 34 alphanumeric chars starting with two letters + two digits.
  // Simplified heuristic: two uppercase letters followed by 15–32 digits.
  const ibanPattern = /[A-Z]{2}\d{15,32}/;
  expect(
    ibanPattern.test(responseText),
    `${context}: response contains IBAN-like sequence. ` +
      `Response: "${responseText.slice(0, 200)}"`,
  ).toBe(false);

  // Card numbers — 16 consecutive digits (common pattern for Visa/MC/Amex padded).
  const cardNumberPattern = /\b\d{16}\b/;
  expect(
    cardNumberPattern.test(responseText),
    `${context}: response contains 16-digit sequence (possible card number). ` +
      `Response: "${responseText.slice(0, 200)}"`,
  ).toBe(false);

  // Norwegian bank account in BBBBB.BB.BBBBB dotted form.
  const bankAccountPattern = /\d{4,5}\.\d{2}\.\d{5}/;
  expect(
    bankAccountPattern.test(responseText),
    `${context}: response contains Norwegian bank account format. ` +
      `Response: "${responseText.slice(0, 200)}"`,
  ).toBe(false);
}
