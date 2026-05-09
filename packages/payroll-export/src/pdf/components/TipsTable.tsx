/**
 * packages/payroll-export/src/pdf/components/TipsTable.tsx
 *
 * WHAT: Tips (drikkepenger) distribution table for lønnsgrunnlag — conditional.
 *
 * WHY: Not all workspaces use tip distribution. When tips data is present, the
 *      employee and accountant need to see the tip amount included in gross pay.
 *      When tips data is absent, this component returns null — the section is
 *      omitted entirely from the PDF layout to avoid confusing empty sections.
 *
 *      Tips are part of gross pay (brutto) per Norwegian tax rules on gratuities
 *      distributed through the employer. They appear separately so the
 *      accountant can verify the tip pool split.
 */

import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";
import { formatNok } from "../../format.js";

const BRAND_DARK = "#18181b";
const BRAND_MUTED = "#71717a";
const BRAND_BORDER = "#e4e4e7";
const BRAND_HEADER_BG = "#f4f4f5";
const BRAND_TIPS_ACCENT = "#fef3c7"; // amber-100 equivalent — tips are distinct income type

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
    backgroundColor: BRAND_TIPS_ACCENT,
  },
  col1: { width: "50%", fontSize: 9 },
  col2: { width: "25%", fontSize: 9 },
  col3: { width: "25%", fontSize: 9, textAlign: "right" },
  headerText: { color: BRAND_MUTED, fontWeight: "bold" },
  dataText: { color: BRAND_DARK },
  note: {
    fontSize: 7,
    color: BRAND_MUTED,
    marginTop: 3,
    fontStyle: "italic",
  },
});

export type TipsDistribution = {
  /** Distribution ID for traceability */
  distributionId: string;
  /** Total tip pool (before split) */
  poolTotal: number;
  /** This employee's share */
  employeeShare: number;
  /** Pool period label, e.g. "April 2026" */
  periodLabel: string;
};

type TipsTableProps = {
  tips?: TipsDistribution | null;
};

export function TipsTable({ tips }: TipsTableProps): React.ReactElement | null {
  if (!tips) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Drikkepenger (tips)</Text>
      <View style={styles.table}>
        <View style={styles.headerRow}>
          <Text style={[styles.col1, styles.headerText]}>Beskrivelse</Text>
          <Text style={[styles.col2, styles.headerText]}>Periode</Text>
          <Text style={[styles.col3, styles.headerText]}>Beløp (NOK)</Text>
        </View>
        <View style={styles.dataRow}>
          <Text style={[styles.col1, styles.dataText]}>Tips — andel av pool</Text>
          <Text style={[styles.col2, styles.dataText]}>{tips.periodLabel}</Text>
          <Text style={[styles.col3, styles.dataText]}>{formatNok(tips.employeeShare)}</Text>
        </View>
      </View>
      <Text style={styles.note}>
        Pool-ID: {tips.distributionId} | Pool-total: {formatNok(tips.poolTotal)} NOK
      </Text>
    </View>
  );
}
