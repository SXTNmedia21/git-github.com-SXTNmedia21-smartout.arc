// createAdHocInvoice — platform-admin: create a one-off invoice from
// scratch (startup fee, consulting charge, custom agreement).
//
// Spec §5.2: `invoice.invoice_type = 'one_off'`, status = 'draft'.
// Every line is manual by definition — `usage_snapshot_id` stays NULL.
//
// The VAT + total aggregation happens server-side so the caller does
// not have to agree with the DB on arithmetic (floating-point drift
// would otherwise slip through into invoice headers).
//
// Mobile parity: pure async function, no Next.js primitives.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@smartout/supabase";
import type { Invoice, InvoiceInsert, InvoiceLineItemInsert } from "../../types";

type BillingClient = SupabaseClient<Database>;

export type AdHocLineInput = {
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
};

export type CreateAdHocInvoiceArgs = {
  company_id: string;
  period_from: string;
  period_to: string;
  currency?: Database["public"]["Enums"]["currency"];
  line_items: AdHocLineInput[];
  created_by?: string | null;
};

export type CreateAdHocInvoiceResult =
  | { ok: true; invoice: Invoice }
  | { ok: false; error: string };

function computeLineTotals(quantity: number, unitPrice: number, vatRate: number) {
  const excl = Number((quantity * unitPrice).toFixed(2));
  const vat = Number(((excl * vatRate) / 100).toFixed(2));
  const incl = Number((excl + vat).toFixed(2));
  return { amount_excl_vat: excl, vat_amount: vat, amount_incl_vat: incl };
}

export async function createAdHocInvoice(
  client: BillingClient,
  args: CreateAdHocInvoiceArgs,
): Promise<CreateAdHocInvoiceResult> {
  if (args.line_items.length === 0) {
    return { ok: false, error: "no_line_items" };
  }

  // Guard: company must exist. Cheaper error surface than catching an
  // FK violation later.
  const { data: company, error: companyErr } = await client
    .from("company")
    .select("company_id")
    .eq("company_id", args.company_id)
    .maybeSingle();
  if (companyErr) return { ok: false, error: companyErr.message };
  if (!company) return { ok: false, error: "company_not_found" };

  // Aggregate totals across all lines. The invoice-level vat_rate is
  // the weighted blended rate; we keep the individual line vat_rates
  // on the line rows for accurate reporting.
  const lineTotals = args.line_items.map((l) =>
    computeLineTotals(l.quantity, l.unit_price, l.vat_rate),
  );
  const amount_excl_vat = Number(lineTotals.reduce((s, t) => s + t.amount_excl_vat, 0).toFixed(2));
  const vat_amount = Number(lineTotals.reduce((s, t) => s + t.vat_amount, 0).toFixed(2));
  const amount_incl_vat = Number(lineTotals.reduce((s, t) => s + t.amount_incl_vat, 0).toFixed(2));
  const blendedVatRate =
    amount_excl_vat > 0 ? Number(((vat_amount / amount_excl_vat) * 100).toFixed(2)) : 0;

  const invoiceRow: InvoiceInsert = {
    company_id: args.company_id,
    invoice_type: "one_off",
    status: "draft",
    period_from: args.period_from,
    period_to: args.period_to,
    currency: args.currency ?? "NOK",
    amount_excl_vat,
    vat_rate: blendedVatRate,
    vat_amount,
    amount_incl_vat,
    created_by: args.created_by ?? null,
  };

  const { data: invoice, error: invoiceErr } = await client
    .from("invoice")
    .insert(invoiceRow)
    .select("*")
    .single();

  if (invoiceErr) return { ok: false, error: invoiceErr.message };
  if (!invoice) return { ok: false, error: "invoice_insert_failed" };

  // Fan out line items in one round-trip.
  const lineRows: InvoiceLineItemInsert[] = args.line_items.map((l, idx) => ({
    invoice_id: invoice.invoice_id,
    line_type: "adjustment",
    description: l.description,
    quantity: l.quantity,
    unit_price: l.unit_price,
    vat_rate: l.vat_rate,
    ...lineTotals[idx]!,
    usage_snapshot_id: null,
  }));

  const { error: linesErr } = await client.from("invoice_line_item").insert(lineRows);
  if (linesErr) {
    // Roll back the header so we don't leave an orphan invoice. This is
    // best-effort — in a perfect world we'd wrap both in a transaction,
    // but Supabase JS doesn't expose one here. The compensation keeps
    // the DB consistent with the returned error.
    await client.from("invoice").delete().eq("invoice_id", invoice.invoice_id);
    return { ok: false, error: linesErr.message };
  }

  return { ok: true, invoice: invoice as Invoice };
}
