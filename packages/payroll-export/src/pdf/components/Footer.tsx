/**
 * packages/payroll-export/src/pdf/components/Footer.tsx
 *
 * WHAT: PDF footer for lønnsgrunnlag — disclaimer + provenance + SHA-256.
 *
 * WHY: Three compliance requirements drive this footer:
 *
 *   1. DISCLAIMER (load-bearing, golden-tested in T1.5):
 *      "Dette er et lønnsgrunnlag — ikke en lønnsslipp."
 *      + "Skattetrekk, A-melding og netto utbetaling beregnes av regnskapsfører."
 *      This text is the legal-positioning anchor of the document. It prevents
 *      the document from being misread as a tax-compliant payslip (lønnsslipp).
 *      See ADR-0294 + user instruction 2026-05-08. MUST NEVER be removed.
 *
 *   2. PROVENANCE (Bokføringsloven §13):
 *      period_id, tariff_version, generated_at timestamp so the document can be
 *      traced back to the source calculation run.
 *
 *   3. SHA-256 (16-char prefix visible, full hash in PDF Keywords metadata):
 *      Allows audit replay — recompute hash from re-export with same inputs
 *      and compare against the stored hash in payroll.export_event.
 */

import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";

const BRAND_BORDER = "#e4e4e7";
const BRAND_MUTED = "#71717a";
const BRAND_WARNING_BG = "#fef3c7"; // amber-100 — disclaimer needs visual emphasis
const BRAND_WARNING_BORDER = "#fbbf24"; // amber-400

const styles = StyleSheet.create({
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
  },
  disclaimer: {
    padding: "6pt 8pt",
    backgroundColor: BRAND_WARNING_BG,
    border: `1pt solid ${BRAND_WARNING_BORDER}`,
    borderRadius: 3,
    marginBottom: 6,
  },
  disclaimerMain: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#92400e", // amber-800
    marginBottom: 2,
  },
  disclaimerSub: {
    fontSize: 7,
    color: "#92400e",
  },
  provenance: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTop: `0.5pt solid ${BRAND_BORDER}`,
    paddingTop: 4,
  },
  provenanceText: {
    fontSize: 6,
    color: BRAND_MUTED,
  },
  hashText: {
    fontSize: 6,
    color: BRAND_MUTED,
    fontFamily: "Courier", // monospace for hash
  },
});

type FooterProps = {
  /** 16-char prefix of the SHA-256 hash (full hash goes into PDF Keywords metadata) */
  sha256Prefix: string;
  periodId: string;
  tariffVersion?: string;
  /** ISO timestamp string (caller-fixed for determinism) */
  generatedAt: string;
};

export function Footer({
  sha256Prefix,
  periodId,
  tariffVersion,
  generatedAt,
}: FooterProps): React.ReactElement {
  return (
    <View style={styles.footer} fixed>
      <View style={styles.disclaimer}>
        <Text style={styles.disclaimerMain}>Dette er et lønnsgrunnlag — ikke en lønnsslipp.</Text>
        <Text style={styles.disclaimerSub}>
          Skattetrekk, A-melding og netto utbetaling beregnes av regnskapsfører.
        </Text>
      </View>
      <View style={styles.provenance}>
        <Text style={styles.provenanceText}>
          Periode: {periodId} | Tariff: {tariffVersion ?? "—"} | Generert: {generatedAt}
        </Text>
        <Text style={styles.hashText}>SHA-256: {sha256Prefix}...</Text>
      </View>
    </View>
  );
}
