// Fase 2 Spor A — Server Action building blocks (mobile-parity layer).
//
// Every function here is a PURE ASYNC FUNCTION that takes a Supabase
// client. Web Server Actions wrap these in auth-gate + revalidatePath;
// React Native mobile callers invoke them directly. No Next.js-only
// dependencies in this module.
//
// The actions cover three Fase 2 B2 scenarios:
//   1. enqueueDispatchesForInvoice — called when an invoice transitions
//      draft → issued. Reads effective_dispatch_rules, creates one
//      invoice_dispatch row per matching rule, and starts an engine_state
//      per row with the 'dispatch_invoice' action. Fan-out pattern.
//   2. retryDispatch — manually re-runs a failed dispatch. Resets
//      attempts, flips status to pending, starts a fresh engine_state.
//   3. createAdHocDispatch — platform-admin "Send på nytt" for an invoice
//      without tying to a rule (dispatch_rule_id NULL).
//
// Ref: Fase 2 spec §3.4, ADR-0126 (engine-orchestrated).

export {
  enqueueDispatchesForInvoice,
  type EnqueueDispatchesResult,
} from "./enqueueDispatchesForInvoice";
export { retryDispatch, type RetryDispatchResult } from "./retryDispatch";
export { createAdHocDispatch, type CreateAdHocDispatchResult } from "./createAdHocDispatch";
