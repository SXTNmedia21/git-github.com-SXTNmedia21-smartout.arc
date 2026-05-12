/**
 * packages/payroll-export/src/pdf/components/Header.tsx
 *
 * WHAT: PDF header for lønnsgrunnlag — workspace identity + period range.
 *
 * WHY: Every lønnsgrunnlag page must identify the producing workspace (name +
 *      orgnr) and the payroll period so the document is unambiguous when printed
 *      or archived. The "Lønnsgrunnlag" title is the compliance anchor per
 *      ADR-0294 (must never read "Lønnsslipp").
 */

import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";

// ─── Brand colours (inline — Tailwind/CSS vars not available in PDF context) ──

const BRAND_DARK = "#18181b"; // zinc-900 equivalent
const BRAND_MUTED = "#71717a"; // zinc-500 equivalent
const BRAND_BORDER = "#e4e4e7"; // zinc-200 equivalent

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
    paddingBottom: 12,
    borderBottom: `1pt solid ${BRAND_BORDER}`,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: BRAND_DARK,
    marginBottom: 6,
  },
  meta: {
    fontSize: 9,
    color: BRAND_MUTED,
    flexDirection: "row",
    gap: 0,
  },
  metaItem: {
    marginRight: 16,
  },
  period: {
    fontSize: 11,
    color: BRAND_DARK,
    marginTop: 4,
  },
});

type HeaderProps = {
  workspaceName: string;
  workspaceOrgnr: string;
  periodStartDate: string; // dd.MM.yyyy
  periodEndDate: string; // dd.MM.yyyy
};

export function Header({
  workspaceName,
  workspaceOrgnr,
  periodStartDate,
  periodEndDate,
}: HeaderProps): React.ReactElement {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Lønnsgrunnlag</Text>
      <View style={styles.meta}>
        <Text style={styles.metaItem}>{workspaceName}</Text>
        <Text style={styles.metaItem}>Org.nr. {workspaceOrgnr}</Text>
      </View>
      <Text style={styles.period}>
        Periode: {periodStartDate} – {periodEndDate}
      </Text>
    </View>
  );
}
