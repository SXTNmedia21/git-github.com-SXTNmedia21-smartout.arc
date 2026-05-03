import { createAdminClient } from "@smartout/supabase/admin";
import { fetchInvoicePayments } from "@smartout/billing";

import { InvoicePaymentsHistoryClient } from "./InvoicePaymentsHistoryClient";

// Fase 3A B3.5 — per-invoice payment history (platform-admin).
//
// Server Component shell. Loads payments for the invoice and hands a
// flat list to the accordion client. Attempts load lazily via the
// same fetchPaymentAttemptsAction the /payments dashboard uses, so
// this page stays cheap when an invoice has many payments.
//
// Accordion-in-list pattern per Frontend R6:
//   - 1 payment → flat summary row
//   - Multiple payments OR any failed attempts → expandable per row
//
// Workspace-admin sees a pared-down version in the workspace invoice
// page (no attempt metadata, payment_attempt RLS-gated).
//
// Query extracted to @smartout/billing fetchInvoicePayments (M3 ADR-B).

export async function InvoicePaymentsHistory({ invoiceId }: { invoiceId: string }) {
  const supabase = createAdminClient();
  const payments = await fetchInvoicePayments(supabase, invoiceId);

  const rows = payments.map((p) => ({
    payment_id: p.payment_id,
    invoice_id: p.invoice_id,
    amount: Number(p.amount),
    refunded_amount: p.refunded_amount != null ? Number(p.refunded_amount) : null,
    currency: p.currency,
    status: p.status,
    payment_method: p.payment_method,
    external_id: p.external_id,
    paid_at: p.paid_at,
    created_at: p.created_at,
  }));

  return <InvoicePaymentsHistoryClient payments={rows} />;
}

export type InvoicePaymentRow = {
  payment_id: string;
  invoice_id: string;
  amount: number;
  refunded_amount: number | null;
  currency: string;
  status: "pending" | "processing" | "succeeded" | "failed" | "refunded" | "partially_refunded";
  payment_method: string;
  external_id: string | null;
  paid_at: string | null;
  created_at: string;
};
