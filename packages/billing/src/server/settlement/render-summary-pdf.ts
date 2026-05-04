import "server-only";

// render-summary-pdf.ts — PDF artefakt 1: Sammendrag (1 A4-side).
//
// Generates a single-page A4 PDF summarising the settlement period
// for all included workspaces. Format matches PLAN-avstemming.md §Artefakt 1.
// Uses @react-pdf/renderer renderToBuffer (Node-safe, no browser canvas).

import React from "react";
import { renderToBuffer, Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import type { SettlementSummary } from "./types";

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    padding: 40,
    color: "#1a1a1a",
    backgroundColor: "#ffffff",
  },
  header: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
    color: "#111111",
  },
  subheader: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginTop: 16,
    marginBottom: 6,
    color: "#333333",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
    paddingBottom: 4,
  },
  tableRow: {
    flexDirection: "row",
    marginBottom: 3,
    paddingVertical: 2,
  },
  tableRowAlt: {
    flexDirection: "row",
    marginBottom: 3,
    paddingVertical: 2,
    backgroundColor: "#f9f9f9",
  },
  cellName: { width: "35%", paddingRight: 4 },
  cellCount: { width: "10%", textAlign: "right" },
  cellAmount: { width: "20%", textAlign: "right" },
  cellStatus: { width: "35%", paddingLeft: 8, color: "#555555" },
  totalRow: {
    flexDirection: "row",
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#e5e5e5",
  },
  totalLabel: { width: "60%", fontFamily: "Helvetica-Bold" },
  totalValue: { width: "40%", textAlign: "right", fontFamily: "Helvetica-Bold" },
  totalsSection: {
    marginTop: 8,
    paddingTop: 8,
  },
  totalsRow: {
    flexDirection: "row",
    marginBottom: 3,
  },
  totalsLabel: { width: "55%" },
  totalsValue: { width: "45%", textAlign: "right" },
  discrepancyItem: {
    marginBottom: 3,
    paddingLeft: 4,
    borderLeftWidth: 2,
    borderLeftColor: "#f59e0b",
    paddingVertical: 2,
  },
  discrepancyHigh: {
    borderLeftColor: "#ef4444",
  },
  discrepancyLow: {
    borderLeftColor: "#6b7280",
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

function formatNOK(amount: number): string {
  return new Intl.NumberFormat("no-NO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function statusIcon(statusSummary: string): string {
  if (statusSummary.startsWith("100%")) return "✓";
  if (statusSummary.startsWith("0%")) return "◯";
  return "⚠";
}

/**
 * Render the 1-page settlement summary PDF.
 *
 * @param summary - SettlementSummary from compute_period_aggregates RPC.
 * @param periodLabel - Human-readable period, e.g. "September 2026".
 * @returns Buffer containing the PDF bytes.
 */
export async function renderSummaryPdf(
  summary: SettlementSummary,
  periodLabel: string,
): Promise<Buffer> {
  const workspaceEntries = Object.entries(summary.by_workspace);

  const document = React.createElement(
    Document,
    { title: `Smartout Avstemming — ${periodLabel}` },
    React.createElement(
      Page,
      { size: "A4", style: styles.page },
      // Header
      React.createElement(Text, { style: styles.header }, `SMARTOUT AVSTEMMING — ${periodLabel}`),
      React.createElement(
        Text,
        { style: { fontSize: 9, color: "#6b7280", marginBottom: 12 } },
        `Generert ${new Date().toLocaleDateString("no-NO")} · ${workspaceEntries.length} workspaces`,
      ),

      // Per-workspace table
      React.createElement(Text, { style: styles.subheader }, "Pr workspace"),
      ...workspaceEntries.map(([_wsId, ws], idx) =>
        React.createElement(
          View,
          { key: _wsId, style: idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt },
          React.createElement(
            Text,
            { style: styles.cellName },
            `${statusIcon(ws.status_summary)} ${ws.workspace_name}`,
          ),
          React.createElement(Text, { style: styles.cellCount }, `${ws.count_orders} ordre`),
          React.createElement(
            Text,
            { style: styles.cellAmount },
            `${formatNOK(ws.amount_excl_vat)} NOK`,
          ),
          React.createElement(Text, { style: styles.cellStatus }, ws.status_summary),
        ),
      ),

      // Totals
      React.createElement(Text, { style: styles.subheader }, "Totalt"),
      React.createElement(
        View,
        { style: styles.totalsSection },
        React.createElement(
          View,
          { style: styles.totalsRow },
          React.createElement(Text, { style: styles.totalsLabel }, "Fakturert ekskl mva:"),
          React.createElement(
            Text,
            { style: styles.totalsValue },
            `${formatNOK(summary.totals.amount_excl_vat)} NOK`,
          ),
        ),
        React.createElement(
          View,
          { style: styles.totalsRow },
          React.createElement(Text, { style: styles.totalsLabel }, "MVA (25/15/12%):"),
          React.createElement(
            Text,
            { style: styles.totalsValue },
            `${formatNOK(
              summary.totals.vat_breakdown["0.25"] +
                summary.totals.vat_breakdown["0.15"] +
                summary.totals.vat_breakdown["0.12"],
            )} NOK`,
          ),
        ),
        React.createElement(
          View,
          { style: { ...styles.totalsRow, ...styles.totalRow } },
          React.createElement(Text, { style: styles.totalLabel }, "Fakturert inkl mva:"),
          React.createElement(
            Text,
            { style: styles.totalValue },
            `${formatNOK(summary.totals.amount_incl_vat)} NOK`,
          ),
        ),
        React.createElement(
          View,
          { style: styles.totalsRow },
          React.createElement(Text, { style: styles.totalsLabel }, "Mottatt:"),
          React.createElement(
            Text,
            { style: styles.totalsValue },
            `${formatNOK(summary.totals.amount_paid)} NOK`,
          ),
        ),
        React.createElement(
          View,
          { style: styles.totalsRow },
          React.createElement(Text, { style: styles.totalsLabel }, "Utestående:"),
          React.createElement(
            Text,
            { style: styles.totalsValue },
            `${formatNOK(summary.totals.amount_outstanding)} NOK`,
          ),
        ),
      ),

      // Discrepancies
      ...(summary.discrepancies.length > 0
        ? [
            React.createElement(
              Text,
              { style: styles.subheader },
              `Avvik (${summary.discrepancies.length} stk)`,
            ),
            ...summary.discrepancies.map((d, i) =>
              React.createElement(
                View,
                {
                  key: i,
                  style: {
                    ...styles.discrepancyItem,
                    ...(d.severity === "high" ? styles.discrepancyHigh : {}),
                    ...(d.severity === "low" ? styles.discrepancyLow : {}),
                  },
                },
                React.createElement(
                  Text,
                  null,
                  d.type === "overdue"
                    ? `⚠ ${d.company_name} — forfalt ${d.days_overdue} dager`
                    : d.type === "partial_payment"
                      ? `⚠ Delvis betaling — forventet ${formatNOK(d.expected)}, mottatt ${formatNOK(d.received)} NOK`
                      : `◯ ${d.company_name} — manglende org.nr`,
                ),
              ),
            ),
          ]
        : [
            React.createElement(
              View,
              { style: { marginTop: 12 } },
              React.createElement(
                Text,
                { style: { color: "#16a34a" } },
                "✓ Ingen avvik registrert",
              ),
            ),
          ]),

      // Footer
      React.createElement(
        Text,
        { style: styles.footer },
        `Smartout Avstemming · Konfidensielt · ${new Date().toISOString()}`,
      ),
    ),
  );

  return renderToBuffer(document);
}
