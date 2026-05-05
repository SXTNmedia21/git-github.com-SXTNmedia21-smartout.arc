import "server-only";

// render-invoice-bundle.ts — PDF artefakt 3: Faktura-bunke.
//
// Generates one A4 page per invoice, then merges all into a single PDF
// using pdf-lib. Each page contains company info + line items + totals.
// If 0 invoices → returns null (the run logs but skips this artifact).
//
// WHY: Erik kan skrive ut hele bunken og sende post hvis kunde ikke har
// e-post (PLAN-avstemming.md §Artefakt 3). Not a full grunnfaktura
// template — just an invoice summary page.
//
// NOTE: Invoice table has no workspace_id — filter by company_ids.
// invoice_line_item columns: amount_excl_vat, amount_incl_vat, vat_amount,
// vat_rate, quantity, unit_price, description.

import React from "react";
import { renderToBuffer, Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { PDFDocument } from "pdf-lib";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@smartout/supabase";

type BillingClient = SupabaseClient<Database>;

// ── Styles ─────────────────────────────────────────────────────────────────

const invoiceStyles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    padding: 48,
    color: "#1a1a1a",
  },
  brandHeader: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
    color: "#111111",
  },
  brandSub: {
    fontSize: 9,
    color: "#6b7280",
    marginBottom: 20,
  },
  invoiceTitle: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    marginBottom: 12,
    color: "#333333",
  },
  infoGrid: {
    flexDirection: "row",
    marginBottom: 16,
  },
  infoCol: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 8,
    color: "#9ca3af",
    marginBottom: 1,
  },
  infoValue: {
    fontSize: 10,
    color: "#111111",
    marginBottom: 4,
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
    paddingBottom: 4,
    marginBottom: 4,
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    color: "#6b7280",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  colDesc: { flex: 3 },
  colQty: { flex: 1, textAlign: "right" },
  colUnit: { flex: 1, textAlign: "right" },
  colVat: { flex: 1, textAlign: "right" },
  colTotal: { flex: 1.5, textAlign: "right" },
  totalsBox: {
    marginTop: 12,
    alignItems: "flex-end",
  },
  totalLine: {
    flexDirection: "row",
    marginBottom: 2,
    minWidth: 200,
  },
  totalLineBold: {
    flexDirection: "row",
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#e5e5e5",
    minWidth: 200,
  },
  totalLabelCell: { flex: 1, textAlign: "right", paddingRight: 8, color: "#6b7280" },
  totalValueCell: { width: 80, textAlign: "right" },
  totalLabelBold: { flex: 1, textAlign: "right", paddingRight: 8, fontFamily: "Helvetica-Bold" },
  totalValueBold: { width: 80, textAlign: "right", fontFamily: "Helvetica-Bold" },
  paymentInfo: {
    marginTop: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e5e5e5",
    fontSize: 9,
    color: "#6b7280",
  },
  footer: {
    marginTop: 16,
    fontSize: 8,
    color: "#9ca3af",
  },
});

// ── Types ──────────────────────────────────────────────────────────────────

type InvoiceRow = {
  invoice_id: string;
  invoice_number: number | null;
  issued_at: string | null;
  due_at: string | null;
  status: string;
  paid_at: string | null;
  company_id: string;
  amount_excl_vat: number;
  vat_amount: number;
  amount_incl_vat: number;
  company: { name: string; org_number: string | null } | null;
  invoice_line_item: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    vat_rate: number;
    amount_excl_vat: number;
  }>;
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatNOK(amount: number): string {
  return new Intl.NumberFormat("no-NO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Render a single invoice page as a Buffer. */
async function renderInvoicePage(inv: InvoiceRow, periodLabel: string): Promise<Buffer> {
  const lineItems = inv.invoice_line_item ?? [];
  const company = inv.company;

  const doc = React.createElement(
    Document,
    { title: `Faktura ${inv.invoice_number ?? inv.invoice_id}` },
    React.createElement(
      Page,
      { size: "A4", style: invoiceStyles.page },
      // Brand
      React.createElement(Text, { style: invoiceStyles.brandHeader }, "Smartout"),
      React.createElement(
        Text,
        { style: invoiceStyles.brandSub },
        `Grunnfakturaer — ${periodLabel}`,
      ),
      React.createElement(
        Text,
        { style: invoiceStyles.invoiceTitle },
        `Faktura #${inv.invoice_number ?? "N/A"}`,
      ),

      // Info grid
      React.createElement(
        View,
        { style: invoiceStyles.infoGrid },
        React.createElement(
          View,
          { style: invoiceStyles.infoCol },
          React.createElement(Text, { style: invoiceStyles.infoLabel }, "Kunde"),
          React.createElement(Text, { style: invoiceStyles.infoValue }, company?.name ?? "—"),
          React.createElement(Text, { style: invoiceStyles.infoLabel }, "Org.nr"),
          React.createElement(Text, { style: invoiceStyles.infoValue }, company?.org_number ?? "—"),
        ),
        React.createElement(
          View,
          { style: invoiceStyles.infoCol },
          React.createElement(Text, { style: invoiceStyles.infoLabel }, "Fakturadato"),
          React.createElement(
            Text,
            { style: invoiceStyles.infoValue },
            inv.issued_at ? inv.issued_at.split("T")[0]! : "—",
          ),
          React.createElement(Text, { style: invoiceStyles.infoLabel }, "Forfallsdato"),
          React.createElement(
            Text,
            { style: invoiceStyles.infoValue },
            inv.due_at ? inv.due_at.split("T")[0]! : "—",
          ),
          React.createElement(Text, { style: invoiceStyles.infoLabel }, "Status"),
          React.createElement(Text, { style: invoiceStyles.infoValue }, inv.status),
        ),
      ),

      // Line items table
      React.createElement(
        View,
        { style: invoiceStyles.tableHeader },
        React.createElement(Text, { style: invoiceStyles.colDesc }, "Beskrivelse"),
        React.createElement(Text, { style: invoiceStyles.colQty }, "Ant"),
        React.createElement(Text, { style: invoiceStyles.colUnit }, "Enhetspris"),
        React.createElement(Text, { style: invoiceStyles.colVat }, "MVA%"),
        React.createElement(Text, { style: invoiceStyles.colTotal }, "Sum ekskl"),
      ),
      ...lineItems.map((li, i) =>
        React.createElement(
          View,
          { key: i, style: invoiceStyles.tableRow },
          React.createElement(Text, { style: invoiceStyles.colDesc }, li.description ?? ""),
          React.createElement(Text, { style: invoiceStyles.colQty }, String(li.quantity ?? 1)),
          React.createElement(
            Text,
            { style: invoiceStyles.colUnit },
            formatNOK(li.unit_price ?? 0),
          ),
          React.createElement(
            Text,
            { style: invoiceStyles.colVat },
            `${((li.vat_rate ?? 0) * 100).toFixed(0)}%`,
          ),
          React.createElement(
            Text,
            { style: invoiceStyles.colTotal },
            formatNOK(li.amount_excl_vat ?? 0),
          ),
        ),
      ),

      // Totals (use pre-computed invoice-level amounts for accuracy)
      React.createElement(
        View,
        { style: invoiceStyles.totalsBox },
        React.createElement(
          View,
          { style: invoiceStyles.totalLine },
          React.createElement(Text, { style: invoiceStyles.totalLabelCell }, "Sum ekskl mva:"),
          React.createElement(
            Text,
            { style: invoiceStyles.totalValueCell },
            `${formatNOK(inv.amount_excl_vat)} NOK`,
          ),
        ),
        React.createElement(
          View,
          { style: invoiceStyles.totalLine },
          React.createElement(Text, { style: invoiceStyles.totalLabelCell }, "MVA:"),
          React.createElement(
            Text,
            { style: invoiceStyles.totalValueCell },
            `${formatNOK(inv.vat_amount)} NOK`,
          ),
        ),
        React.createElement(
          View,
          { style: invoiceStyles.totalLineBold },
          React.createElement(Text, { style: invoiceStyles.totalLabelBold }, "Sum inkl mva:"),
          React.createElement(
            Text,
            { style: invoiceStyles.totalValueBold },
            `${formatNOK(inv.amount_incl_vat)} NOK`,
          ),
        ),
      ),

      // Payment info
      React.createElement(
        View,
        { style: invoiceStyles.paymentInfo },
        React.createElement(
          Text,
          null,
          "Betalingsinformasjon: Se smartout.ai for kontonummer og betalingsdetaljer.",
        ),
      ),

      // Footer
      React.createElement(
        Text,
        { style: invoiceStyles.footer },
        `Smartout AS · admin.smartout.ai · Faktura ID: ${inv.invoice_id}`,
      ),
    ),
  );

  return renderToBuffer(doc);
}

/**
 * Render all invoices for the period into a merged PDF bundle.
 *
 * @param serviceClient - Service-role client (RLS bypassed — caller has verified grants).
 * @param companyIds - Company IDs to include (resolved from workspace_ids in run.ts).
 * @param periodStart - ISO date string.
 * @param periodEnd - ISO date string.
 * @param periodLabel - Human-readable label, e.g. "September 2026".
 * @returns Merged Buffer, or null if there are no invoices in the period.
 */
export async function renderInvoiceBundlePdf(
  serviceClient: BillingClient,
  companyIds: string[],
  periodStart: string,
  periodEnd: string,
  periodLabel: string,
): Promise<Buffer | null> {
  if (companyIds.length === 0) return null;

  // Fetch all invoices with line items for the period.
  // eslint-disable-next-line smartout/no-direct-supabase-write
  const { data: invoices, error } = await serviceClient
    .from("invoice")
    .select(
      `
      invoice_id,
      invoice_number,
      issued_at,
      due_at,
      status,
      paid_at,
      company_id,
      amount_excl_vat,
      vat_amount,
      amount_incl_vat,
      company!inner(name, org_number),
      invoice_line_item(description, quantity, unit_price, vat_rate, amount_excl_vat)
    `,
    )
    .in("company_id", companyIds)
    .gte("period_from", periodStart)
    .lte("period_from", periodEnd)
    .order("period_from", { ascending: true });

  if (error) {
    throw new Error(`renderInvoiceBundlePdf: invoice query failed — ${error.message}`);
  }

  if (!invoices || invoices.length === 0) {
    // 0 invoices — skip this artifact (return null, not throw).
    return null;
  }

  // Render each invoice as a separate single-page PDF in parallel.
  const pageBuffers = await Promise.all(
    (invoices as unknown as InvoiceRow[]).map((inv) => renderInvoicePage(inv, periodLabel)),
  );

  // Merge all pages into a single PDF using pdf-lib.
  const mergedDoc = await PDFDocument.create();

  for (const pageBuffer of pageBuffers) {
    const singleDoc = await PDFDocument.load(pageBuffer);
    const [copiedPage] = await mergedDoc.copyPages(singleDoc, [0]);
    mergedDoc.addPage(copiedPage);
  }

  const mergedBytes = await mergedDoc.save();
  return Buffer.from(mergedBytes);
}
