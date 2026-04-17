import { createAdminClient } from "@smartout/supabase/admin";
import type { InvoiceStatus } from "@smartout/ui";
import { InvoiceLineItemEditorClient } from "./InvoiceLineItemEditorClient";

// Fase 2 Spor C — platform-admin invoice line-item editor.
//
// Server Component shell. Responsibilities:
//   1. Guard: only render when invoice.status = 'draft'. Non-draft
//      invoices are immutable by spec (ADR-0119 + B1 trigger) so we
//      hide the editor entirely rather than showing disabled inputs
//      (matches Fase 1 tone — "read-only is an attribute of the row,
//      not a UI state").
//   2. Load line items with the fields the client needs (line_item_id,
//      usage_snapshot_id, totals). The invoice-detail `lineItems` list
//      strips these, so the editor loads its own source of truth.
//   3. Hand off to the client editor which renders the inline form.
//
// The file that wires this into the invoice detail page is
// [id]/page.tsx — see the B5 comment marker there.

type InvoiceLineItemRow = {
  line_item_id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
  amount_excl_vat: number;
  vat_amount: number;
  amount_incl_vat: number;
  line_type: string;
  usage_snapshot_id: string | null;
};

export async function InvoiceLineItemEditor({
  invoiceId,
  invoiceStatus,
}: {
  invoiceId: string;
  invoiceStatus: InvoiceStatus;
}) {
  // Non-draft invoices don't render the editor. The read-only invoice
  // detail view above already shows the lines — duplicating them here
  // would just confuse the eye.
  if (invoiceStatus !== "draft") return null;

  const supabase = createAdminClient();
  const { data: rows } = await supabase
    .from("invoice_line_item")
    .select(
      "line_item_id, invoice_id, description, quantity, unit_price, vat_rate, amount_excl_vat, vat_amount, amount_incl_vat, line_type, usage_snapshot_id",
    )
    .eq("invoice_id", invoiceId)
    .order("created_at", { ascending: true });

  const lineItems: InvoiceLineItemRow[] = (rows ?? []).map((r) => ({
    line_item_id: r.line_item_id,
    invoice_id: r.invoice_id,
    description: r.description,
    quantity: Number(r.quantity),
    unit_price: Number(r.unit_price),
    vat_rate: Number(r.vat_rate),
    amount_excl_vat: Number(r.amount_excl_vat),
    vat_amount: Number(r.vat_amount),
    amount_incl_vat: Number(r.amount_incl_vat),
    line_type: r.line_type,
    usage_snapshot_id: r.usage_snapshot_id,
  }));

  return <InvoiceLineItemEditorClient invoiceId={invoiceId} initialLineItems={lineItems} />;
}

export type { InvoiceLineItemRow };
