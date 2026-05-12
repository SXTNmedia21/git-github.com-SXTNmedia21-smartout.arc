/**
 * packages/payroll-export/src/pdf/components/SupplementsTable.tsx
 *
 * WHAT: Supplement (tillegg) breakdown table for lønnsgrunnlag.
 *
 * WHY: AggregateRow.total_supplements is a single sum. When per-tariff-code
 *      detail is available (SupplementLine[]), the accountant can verify each
 *      supplement type against the collective agreement (tariff). Tariff version
 *      is shown as a footnote to satisfy Bokføringsloven §13 traceability.
 *      If no supplement lines are provided, the section shows the aggregate
 *      sum from AggregateRow so the document is never inconsistent.
 */

import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";
import { formatNok } from "../../format.js";

const BRAND_DARK = "#18181b";
const BRAND_MUTED = "#71717a";
const BRAND_BORDER = "#e4e4e7";
const BRAND_HEADER_BG = "#f4f4f5";

const styles = StyleSheet.create({
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: "bold",
    color: BRAND_DARK,
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  table: {
    border: `1pt solid ${BRAND_BORDER}`,
    borderRadius: 3,
  },
  headerRow: {
    flexDirection: "row",
    backgroundColor: BRAND_HEADER_BG,
    padding: "4pt 6pt",
    borderBottom: `1pt solid ${BRAND_BORDER}`,
  },
  dataRow: {
    flexDirection: "row",
    padding: "3pt 6pt",
    borderBottom: `0.5pt solid ${BRAND_BORDER}`,
  },
  lastDataRow: {
    flexDirection: "row",
    padding: "3pt 6pt",
  },
  col1: { width: "45%", fontSize: 9 },
  col2: { width: "20%", fontSize: 9 },
  col3: { width: "35%", fontSize: 9, textAlign: "right" },
  headerText: { color: BRAND_MUTED, fontWeight: "bold" },
  dataText: { color: BRAND_DARK },
  footnote: {
    fontSize: 7,
    color: BRAND_MUTED,
    marginTop: 3,
    fontStyle: "italic",
  },
  emptyText: { fontSize: 9, color: BRAND_MUTED, fontStyle: "italic", padding: "4pt 6pt" },
});

export type SupplementLine = {
  /** Human-readable name, e.g. "Kveldskveld §4.2" */
  name: string;
  /** Tariff code reference, e.g. "NHO_REST_2025_4.2" */
  tariffCode?: string;
  amount: number;
};

type SupplementsTableProps = {
  /** Per-tariff-code supplement lines (optional — requires audit-level data) */
  lines?: SupplementLine[];
  /** Aggregate total from AggregateRow.total_supplements (always available) */
  totalSupplements: number;
  /** Tariff version used in the period, for Bokføringsloven §13 footnote */
  tariffVersion?: string;
};

export function SupplementsTable({
  lines,
  totalSupplements,
  tariffVersion,
}: SupplementsTableProps): React.ReactElement {
  const hasLines = lines && lines.length > 0;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Tillegg</Text>
      <View style={styles.table}>
        <View style={styles.headerRow}>
          <Text style={[styles.col1, styles.headerText]}>Tilleggstype</Text>
          <Text style={[styles.col2, styles.headerText]}>Kode</Text>
          <Text style={[styles.col3, styles.headerText]}>Beløp (NOK)</Text>
        </View>

        {!hasLines ? (
          <>
            <View style={styles.lastDataRow}>
              <Text style={[styles.col1, styles.dataText]}>Tillegg (samlet)</Text>
              <Text style={[styles.col2, styles.dataText]}>—</Text>
              <Text style={[styles.col3, styles.dataText]}>{formatNok(totalSupplements)}</Text>
            </View>
          </>
        ) : (
          <>
            {lines.map((line, idx) => {
              const isLast = idx === lines.length - 1;
              return (
                <View key={`supp-${idx}`} style={isLast ? styles.lastDataRow : styles.dataRow}>
                  <Text style={[styles.col1, styles.dataText]}>{line.name}</Text>
                  <Text style={[styles.col2, styles.dataText]}>{line.tariffCode ?? "—"}</Text>
                  <Text style={[styles.col3, styles.dataText]}>{formatNok(line.amount)}</Text>
                </View>
              );
            })}
          </>
        )}
      </View>

      {tariffVersion && <Text style={styles.footnote}>* Tariffversjon: {tariffVersion}</Text>}
    </View>
  );
}
