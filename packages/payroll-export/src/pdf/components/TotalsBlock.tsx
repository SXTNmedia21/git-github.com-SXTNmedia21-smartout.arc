/**
 * packages/payroll-export/src/pdf/components/TotalsBlock.tsx
 *
 * WHAT: Brutto total block for lønnsgrunnlag — explicitly labelled "Før skatt".
 *
 * WHY: This document is a LØNNSGRUNNLAG (wage basis), not a lønnsslipp (payslip).
 *      We show ONLY the gross (brutto) figure. Net pay, skattetrekk, and A-melding
 *      line items are EXPLICITLY OUT OF SCOPE (ADR-0294, user instruction 2026-05-08).
 *      The "Før skatt" label is load-bearing: it tells the reader this is before tax,
 *      preventing any confusion that the total is net take-home pay.
 *
 *      Breakdown:
 *        base_pay          — Grunnlønn
 *        total_supplements — Tillegg
 *        total_deductions  — Trekk (negative items like union dues if applicable)
 *        total_pay         — Brutto total (= base_pay + supplements - deductions)
 *        feriepenger_basis — Feriepenger-grunnlag (basis only, ADR-0295)
 */

import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";
import { formatNok } from "../../format.js";
import type { AggregateRow } from "../../types.js";

const BRAND_DARK = "#18181b";
const BRAND_MUTED = "#71717a";
const BRAND_BORDER = "#e4e4e7";
const BRAND_TOTAL_BG = "#18181b"; // dark row for the grand total

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
  row: {
    flexDirection: "row",
    padding: "4pt 8pt",
    borderBottom: `0.5pt solid ${BRAND_BORDER}`,
  },
  totalRow: {
    flexDirection: "row",
    padding: "6pt 8pt",
    backgroundColor: BRAND_TOTAL_BG,
    borderRadius: "0pt 0pt 3pt 3pt",
  },
  label: {
    flex: 1,
    fontSize: 9,
    color: BRAND_MUTED,
  },
  amount: {
    fontSize: 9,
    color: BRAND_DARK,
    textAlign: "right",
  },
  totalLabel: {
    flex: 1,
    fontSize: 11,
    fontWeight: "bold",
    color: "#ffffff",
  },
  totalAmount: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#ffffff",
    textAlign: "right",
  },
  totalSub: {
    fontSize: 8,
    color: "#a1a1aa",
    marginTop: 1,
  },
  feriepenger: {
    marginTop: 6,
    padding: "4pt 8pt",
    border: `1pt dashed ${BRAND_BORDER}`,
    borderRadius: 3,
    flexDirection: "row",
  },
  feriepengerLabel: {
    flex: 1,
    fontSize: 8,
    color: BRAND_MUTED,
    fontStyle: "italic",
  },
  feriepengerAmount: {
    fontSize: 8,
    color: BRAND_MUTED,
    fontStyle: "italic",
    textAlign: "right",
  },
});

type TotalsBlockProps = {
  row: Pick<
    AggregateRow,
    | "base_pay"
    | "total_supplements"
    | "total_deductions"
    | "total_pay"
    | "taxable_pay"
    | "feriepenger_basis"
  >;
};

export function TotalsBlock({ row }: TotalsBlockProps): React.ReactElement {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Lønnssammendrag</Text>
      <View style={styles.table}>
        <View style={styles.row}>
          <Text style={styles.label}>Grunnlønn</Text>
          <Text style={styles.amount}>{formatNok(row.base_pay)} NOK</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Tillegg</Text>
          <Text style={styles.amount}>+ {formatNok(row.total_supplements)} NOK</Text>
        </View>
        {row.total_deductions !== 0 && (
          <View style={styles.row}>
            <Text style={styles.label}>Trekk</Text>
            <Text style={styles.amount}>- {formatNok(row.total_deductions)} NOK</Text>
          </View>
        )}
        <View style={styles.totalRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.totalLabel}>Brutto total</Text>
            <Text style={styles.totalSub}>Før skatt</Text>
          </View>
          <Text style={styles.totalAmount}>{formatNok(row.total_pay)} NOK</Text>
        </View>
      </View>

      {/* Feriepenger-grunnlag (basis only, ADR-0295) — regnskapsfører beregner utbetaling */}
      <View style={styles.feriepenger}>
        <Text style={styles.feriepengerLabel}>Feriepenger-grunnlag (regnskapsfører beregner)</Text>
        <Text style={styles.feriepengerAmount}>{formatNok(row.feriepenger_basis)} NOK</Text>
      </View>
    </View>
  );
}
