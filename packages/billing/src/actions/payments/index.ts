// Fase 3A — Stripe payment pure functions. Mobile parity: web Server
// Actions wrap these; React Native callers invoke directly after their
// own auth gate. Every function takes a Supabase client + args + returns
// AdminActionResult<T> for consistent error handling.

export { initiatePayment } from "./initiatePayment";
export type { InitiatePaymentArgs, InitiatePaymentOutput } from "./initiatePayment";

export { refundPayment } from "./refundPayment";
export type { RefundPaymentArgs, RefundPaymentOutput } from "./refundPayment";

export { reconcileInvoiceOnPayment } from "./reconcileInvoiceOnPayment";
export type { ReconcileInvoiceResult } from "./reconcileInvoiceOnPayment";

export { issueCreditNoteForRefund } from "./issueCreditNoteForRefund";
export type {
  IssueCreditNoteForRefundArgs,
  IssueCreditNoteForRefundOutput,
} from "./issueCreditNoteForRefund";
