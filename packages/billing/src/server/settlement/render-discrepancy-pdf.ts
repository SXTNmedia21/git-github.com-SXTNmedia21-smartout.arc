import "server-only";

// render-discrepancy-pdf.ts — PDF artefakt 4: Avvik-liste.
//
// Renders only the items Erik must act on: overdue invoices, partial
// payments, orders without payment > 30 days, missing org.nr.
// Grouped by severity (high / medium / low).
// If discrepancies is empty → renders a "✓ Ingen avvik"-page.
// Per PLAN-avstemming.md §Artefakt 4.

import React from "react";
import { renderToBuffer, Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import type { SettlementDiscrepancy } from "./types";

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    padding: 40,
    color: "#1a1a1a",
  },
  header: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
    color: "#111111",
  },
  meta: {
    fontSize: 9,
    color: "#6b7280",
    marginBottom: 16,
  },
  sectionHeader: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginTop: 14,
    marginBottom: 6,
    paddingBottom: 4,
    borderBottomWidth: 1,
  },
  sectionHigh: { borderBottomColor: "#ef4444", color: "#ef4444" },
  sectionMedium: { borderBottomColor: "#f59e0b", color: "#f59e0b" },
  sectionLow: { borderBottomColor: "#6b7280", color: "#6b7280" },
  tableHeader: {
    flexDirection: "row",
    fontSize: 8,
    color: "#9ca3af",
    fontFamily: "Helvetica-Bold",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
    paddingBottom: 3,
    marginBottom: 2,
  },
  colType: { width: "15%" },
  colCompany: { width: "25%" },
  colRef: { width: "15%" },
  colMessage: { width: "30%" },
  colAction: { width: "15%", textAlign: "right" },
  row: {
    flexDirection: "row",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#f9f9f9",
  },
  rowAlt: {
    backgroundColor: "#fef9f0",
  },
  okPage: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  okIcon: {
    fontSize: 48,
    color: "#16a34a",
    marginBottom: 12,
  },
  okText: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: "#16a34a",
  },
  okSub: {
    fontSize: 10,
    color: "#6b7280",
    marginTop: 4,
  },
  footer: {
    marginTop: 20,
    fontSize: 8,
    color: "#9ca3af",
    borderTopWidth: 1,
    borderTopColor: "#e5e5e5",
    paddingTop: 6,
  },
});

// ── Helpers ─────────────────────────────────────────────────────────────────

function discrepancyAction(d: SettlementDiscrepancy): string {
  if (d.type === "overdue") return "Send purring";
  if (d.type === "partial_payment") return "Verifiser betaling";
  return "Oppdater info";
}

function discrepancyRef(d: SettlementDiscrepancy): string {
  if ("invoice_id" in d) return d.invoice_id.slice(0, 8) + "…";
  if ("company_id" in d) return d.company_id.slice(0, 8) + "…";
  return "—";
}

function discrepancyCompany(d: SettlementDiscrepancy): string {
  if ("company_name" in d) return d.company_name;
  return "—";
}

function discrepancyMessage(d: SettlementDiscrepancy): string {
  if (d.type === "overdue") return `Forfalt ${d.days_overdue} dager`;
  if (d.type === "partial_payment")
    return `Forventet ${d.expected.toFixed(0)}, mottatt ${d.received.toFixed(0)} NOK`;
  return "Manglende org.nr";
}

function discrepancyType(d: SettlementDiscrepancy): string {
  if (d.type === "overdue") return "Forfalt";
  if (d.type === "partial_payment") return "Delvis";
  return "Mangler info";
}

/** Render rows for a list of discrepancies. */
function renderDiscrepancyRows(items: SettlementDiscrepancy[]): React.ReactElement[] {
  return items.map((d, i) =>
    React.createElement(
      View,
      {
        key: i,
        style: i % 2 === 0 ? styles.row : { ...styles.row, ...styles.rowAlt },
      },
      React.createElement(Text, { style: styles.colType }, discrepancyType(d)),
      React.createElement(Text, { style: styles.colCompany }, discrepancyCompany(d)),
      React.createElement(Text, { style: styles.colRef }, discrepancyRef(d)),
      React.createElement(Text, { style: styles.colMessage }, discrepancyMessage(d)),
      React.createElement(Text, { style: styles.colAction }, discrepancyAction(d)),
    ),
  );
}

/** Table header row. */
function renderTableHeader(): React.ReactElement {
  return React.createElement(
    View,
    { style: styles.tableHeader },
    React.createElement(Text, { style: styles.colType }, "TYPE"),
    React.createElement(Text, { style: styles.colCompany }, "SELSKAP"),
    React.createElement(Text, { style: styles.colRef }, "REF"),
    React.createElement(Text, { style: styles.colMessage }, "BESKRIVELSE"),
    React.createElement(Text, { style: styles.colAction }, "HANDLING"),
  );
}

/**
 * Render the discrepancy PDF.
 *
 * @param discrepancies - Array from SettlementSummary.discrepancies.
 * @param periodLabel - Human-readable period, e.g. "September 2026".
 * @returns Buffer containing the PDF bytes.
 */
export async function renderDiscrepancyPdf(
  discrepancies: SettlementDiscrepancy[],
  periodLabel: string,
): Promise<Buffer> {
  // Empty discrepancies → "✓ Ingen avvik"-page.
  if (discrepancies.length === 0) {
    const okDoc = React.createElement(
      Document,
      { title: `Avvik — ${periodLabel}` },
      React.createElement(
        Page,
        { size: "A4", style: styles.page },
        React.createElement(Text, { style: styles.header }, `Avvik — ${periodLabel}`),
        React.createElement(
          Text,
          { style: styles.meta },
          `Generert ${new Date().toLocaleDateString("no-NO")}`,
        ),
        React.createElement(
          View,
          { style: styles.okPage },
          React.createElement(Text, { style: styles.okIcon }, "✓"),
          React.createElement(Text, { style: styles.okText }, "Ingen avvik"),
          React.createElement(
            Text,
            { style: styles.okSub },
            "Alle fakturaer i perioden er uten avvik.",
          ),
        ),
        React.createElement(
          Text,
          { style: styles.footer },
          `Smartout Avvik · Konfidensielt · ${new Date().toISOString()}`,
        ),
      ),
    );
    return renderToBuffer(okDoc);
  }

  const high = discrepancies.filter((d) => d.severity === "high");
  const medium = discrepancies.filter((d) => d.severity === "medium");
  const low = discrepancies.filter((d) => d.severity === "low");

  const sections: React.ReactElement[] = [];

  if (high.length > 0) {
    sections.push(
      React.createElement(
        Text,
        { style: { ...styles.sectionHeader, ...styles.sectionHigh } },
        `▲ Høy alvorlighet (${high.length})`,
      ),
      renderTableHeader(),
      ...renderDiscrepancyRows(high),
    );
  }

  if (medium.length > 0) {
    sections.push(
      React.createElement(
        Text,
        { style: { ...styles.sectionHeader, ...styles.sectionMedium } },
        `⚠ Middels alvorlighet (${medium.length})`,
      ),
      renderTableHeader(),
      ...renderDiscrepancyRows(medium),
    );
  }

  if (low.length > 0) {
    sections.push(
      React.createElement(
        Text,
        { style: { ...styles.sectionHeader, ...styles.sectionLow } },
        `◯ Lav alvorlighet (${low.length})`,
      ),
      renderTableHeader(),
      ...renderDiscrepancyRows(low),
    );
  }

  const doc = React.createElement(
    Document,
    { title: `Avvik — ${periodLabel}` },
    React.createElement(
      Page,
      { size: "A4", style: styles.page },
      React.createElement(Text, { style: styles.header }, `Avvik — ${periodLabel}`),
      React.createElement(
        Text,
        { style: styles.meta },
        `${discrepancies.length} avvik · Generert ${new Date().toLocaleDateString("no-NO")}`,
      ),
      ...sections,
      React.createElement(
        Text,
        { style: styles.footer },
        `Smartout Avvik · Konfidensielt · ${new Date().toISOString()}`,
      ),
    ),
  );

  return renderToBuffer(doc);
}
