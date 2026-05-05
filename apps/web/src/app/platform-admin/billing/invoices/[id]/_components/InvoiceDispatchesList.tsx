import { createAdminClient } from "@smartout/supabase/admin";
import { fetchInvoiceDispatches } from "@smartout/billing";

import { InvoiceDispatchesListClient } from "./InvoiceDispatchesListClient";

// Fase 2 B3 — platform-admin per-invoice dispatches section.
//
// Server Component shell: loads invoice_dispatch rows (with the joined
// rule for channel/action context) and hands off to the client that
// owns the retry + ad-hoc actions. One network round-trip here keeps
// the invoice detail page snappy.
//
// Wired into [id]/page.tsx under the {/* B3: dispatches */} marker.
//
// Query extracted to @smartout/billing fetchInvoiceDispatches (M3 ADR-B).

export async function InvoiceDispatchesList({ invoiceId }: { invoiceId: string }) {
  const supabase = createAdminClient();
  const dispatches = await fetchInvoiceDispatches(supabase, invoiceId);

  // Map to the serialisable shape the client component expects.
  // attempts / timestamps survive as-is; the joined rule (from the
  // LEFT JOIN) surfaces dispatch_rule_id for "this came from rule X" UX.
  const rows = dispatches.map((d) => ({
    invoice_dispatch_id: d.invoice_dispatch_id,
    invoice_id: d.invoice_id,
    dispatch_rule_id: d.dispatch_rule_id,
    channel: d.channel,
    target: d.target,
    status: d.status,
    attempts: d.attempts,
    last_attempt_at: d.last_attempt_at,
    delivered_at: d.delivered_at,
    error_code: d.error_code,
    error_message: d.error_message,
    external_reference: d.external_reference,
    created_at: d.created_at,
    rule_source: d.rule
      ? d.rule.workspace_id
        ? ("workspace" as const)
        : ("platform" as const)
      : ("ad_hoc" as const),
  }));

  return <InvoiceDispatchesListClient invoiceId={invoiceId} rows={rows} />;
}

export type InvoiceDispatchRow = {
  invoice_dispatch_id: string;
  invoice_id: string;
  dispatch_rule_id: string | null;
  channel: string;
  target: unknown;
  status: string;
  attempts: number;
  last_attempt_at: string | null;
  delivered_at: string | null;
  error_code: string | null;
  error_message: string | null;
  external_reference: string | null;
  created_at: string | null;
  rule_source: "platform" | "workspace" | "ad_hoc";
};
