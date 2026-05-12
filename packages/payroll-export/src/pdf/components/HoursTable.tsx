/**
 * packages/payroll-export/src/pdf/components/HoursTable.tsx
 *
 * WHAT: Hours breakdown table for lønnsgrunnlag — regular / overtime / absence.
 *
 * WHY: AggregateRow carries monetary totals but not hour breakdowns. The PDF
 *      generator receives an optional HoursBreakdown object when the caller
 *      wants to show hour detail. When absent, the component renders a minimal
 *      "Hours not detailed" row so the table section is never empty (avoids
 *      layout gaps). Accountants need to see hours to validate base pay per hour.
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
  col1: { width: "40%", fontSize: 9 },
  col2: { width: "20%", fontSize: 9, textAlign: "right" },
  col3: { width: "20%", fontSize: 9, textAlign: "right" },
  col4: { width: "20%", fontSize: 9, textAlign: "right" },
  headerText: { color: BRAND_MUTED, fontWeight: "bold" },
  dataText: { color: BRAND_DARK },
  emptyText: { fontSize: 9, color: BRAND_MUTED, fontStyle: "italic", padding: "4pt 6pt" },
});

export type HoursBreakdown = {
  regularHours: number;
  overtimeHours: number;
  absenceHours: number;
  effectiveHours: number; // regular + overtime - absence
  hourlyRate?: number; // NOK per hour if applicable
};

type HoursTableProps = {
  breakdown?: HoursBreakdown;
};

export function HoursTable({ breakdown }: HoursTableProps): React.ReactElement {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Timer</Text>
      <View style={styles.table}>
        <View style={styles.headerRow}>
          <Text style={[styles.col1, styles.headerText]}>Type</Text>
          <Text style={[styles.col2, styles.headerText]}>Timer</Text>
          <Text style={[styles.col3, styles.headerText]}>Timesats (NOK)</Text>
          <Text style={[styles.col4, styles.headerText]}>Beløp (NOK)</Text>
        </View>

        {!breakdown ? (
          <Text style={styles.emptyText}>Timedetaljer ikke tilgjengelig i aggregert eksport</Text>
        ) : (
          <>
            <View style={styles.dataRow}>
              <Text style={[styles.col1, styles.dataText]}>Ordinære timer</Text>
              <Text style={[styles.col2, styles.dataText]}>
                {breakdown.regularHours.toFixed(2)}
              </Text>
              <Text style={[styles.col3, styles.dataText]}>
                {breakdown.hourlyRate !== undefined ? formatNok(breakdown.hourlyRate) : "—"}
              </Text>
              <Text style={[styles.col4, styles.dataText]}>
                {breakdown.hourlyRate !== undefined
                  ? formatNok(breakdown.regularHours * breakdown.hourlyRate)
                  : "—"}
              </Text>
            </View>

            {breakdown.overtimeHours > 0 && (
              <View style={styles.dataRow}>
                <Text style={[styles.col1, styles.dataText]}>Overtid</Text>
                <Text style={[styles.col2, styles.dataText]}>
                  {breakdown.overtimeHours.toFixed(2)}
                </Text>
                <Text style={[styles.col3, styles.dataText]}>—</Text>
                <Text style={[styles.col4, styles.dataText]}>—</Text>
              </View>
            )}

            {breakdown.absenceHours > 0 && (
              <View style={styles.dataRow}>
                <Text style={[styles.col1, styles.dataText]}>Fravær</Text>
                <Text style={[styles.col2, styles.dataText]}>
                  -{breakdown.absenceHours.toFixed(2)}
                </Text>
                <Text style={[styles.col3, styles.dataText]}>—</Text>
                <Text style={[styles.col4, styles.dataText]}>—</Text>
              </View>
            )}

            <View style={styles.lastDataRow}>
              <Text style={[styles.col1, { ...styles.dataText, fontWeight: "bold" }]}>
                Effektive timer
              </Text>
              <Text style={[styles.col2, { ...styles.dataText, fontWeight: "bold" }]}>
                {breakdown.effectiveHours.toFixed(2)}
              </Text>
              <Text style={[styles.col3, styles.dataText]}></Text>
              <Text style={[styles.col4, styles.dataText]}></Text>
            </View>
          </>
        )}
      </View>
    </View>
  );
}
