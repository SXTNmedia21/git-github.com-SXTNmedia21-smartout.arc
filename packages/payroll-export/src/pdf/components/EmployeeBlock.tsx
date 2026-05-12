/**
 * packages/payroll-export/src/pdf/components/EmployeeBlock.tsx
 *
 * WHAT: Employee identity block for lønnsgrunnlag — name, personnummer, bankkonto.
 *
 * WHY: Personnummer and bankkonto are required content in a lønnsgrunnlag (wage
 *      basis document) so the employee can verify their identity and the
 *      accountant can route payment. Masking is controlled by the caller via the
 *      AggregateRow fields — if opts.includeUnmasked=true was passed to the
 *      generator, the raw values arrive here; otherwise they are pre-masked by
 *      mask.ts before reaching this component.
 *
 *      This component does NOT mask — it renders whatever value it receives.
 *      Masking decisions live in the pdf.ts generator layer (L-0177: fail-fast
 *      at the caller, not silent handling here).
 */

import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";

const BRAND_DARK = "#18181b";
const BRAND_MUTED = "#71717a";
const BRAND_BORDER = "#e4e4e7";
const BRAND_BG_LIGHT = "#fafafa";

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    padding: 10,
    backgroundColor: BRAND_BG_LIGHT,
    borderRadius: 4,
    border: `1pt solid ${BRAND_BORDER}`,
  },
  name: {
    fontSize: 13,
    fontWeight: "bold",
    color: BRAND_DARK,
    marginBottom: 6,
  },
  row: {
    flexDirection: "row",
    marginBottom: 2,
  },
  label: {
    fontSize: 9,
    color: BRAND_MUTED,
    width: 110,
  },
  value: {
    fontSize: 9,
    color: BRAND_DARK,
  },
  emptyValue: {
    fontSize: 9,
    color: BRAND_MUTED,
    fontStyle: "italic",
  },
});

type EmployeeBlockProps = {
  profileName: string;
  /** Pre-masked or raw personnummer depending on caller opts */
  personnummer: string | null;
  /** Pre-masked or raw bankkonto depending on caller opts */
  bankkonto: string | null;
};

export function EmployeeBlock({
  profileName,
  personnummer,
  bankkonto,
}: EmployeeBlockProps): React.ReactElement {
  return (
    <View style={styles.container}>
      <Text style={styles.name}>{profileName}</Text>
      <View style={styles.row}>
        <Text style={styles.label}>Personnummer:</Text>
        {personnummer ? (
          <Text style={styles.value}>{personnummer}</Text>
        ) : (
          <Text style={styles.emptyValue}>Ikke registrert</Text>
        )}
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Bankkonto:</Text>
        {bankkonto ? (
          <Text style={styles.value}>{bankkonto}</Text>
        ) : (
          <Text style={styles.emptyValue}>Ikke registrert</Text>
        )}
      </View>
    </View>
  );
}
