/**
 * packages/payroll-export/src/pdf/LonnsgrunnlagDocument.tsx
 *
 * WHAT: Root @react-pdf/renderer document template for lønnsgrunnlag.
 *
 * WHY: Composes the 7 sub-components (Header, EmployeeBlock, HoursTable,
 *      SupplementsTable, TipsTable, TotalsBlock, Footer) into a single A4
 *      portrait PDF document per employee.
 *
 *      PDF metadata is set via the <Document> `title`, `author`, `producer`,
 *      `subject`, and `keywords` props — ADR-0294 specifies the full SHA-256
 *      goes into Keywords so audit tools can extract it without parsing the
 *      visible footer text.
 *
 * COMPLIANCE:
 *   - Title MUST be "Lønnsgrunnlag — {workspace} — {period}" (never "Lønnsslipp")
 *   - Footer MUST contain "Dette er et lønnsgrunnlag — ikke en lønnsslipp."
 *   - Both are golden-tested in __tests__/pdf.test.ts (T1.5)
 */

import React from "react";
import { Document, Page, StyleSheet } from "@react-pdf/renderer";
import { Header } from "./components/Header.js";
import { EmployeeBlock } from "./components/EmployeeBlock.js";
import { HoursTable, type HoursBreakdown } from "./components/HoursTable.js";
import { SupplementsTable, type SupplementLine } from "./components/SupplementsTable.js";
import { TipsTable, type TipsDistribution } from "./components/TipsTable.js";
import { TotalsBlock } from "./components/TotalsBlock.js";
import { Footer } from "./components/Footer.js";
import type { AggregateRow } from "../types.js";

// ─── Page layout (A4 portrait, 40pt margins) ──────────────────────────────────

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    paddingTop: 40,
    paddingBottom: 100, // leave space for fixed footer
    paddingHorizontal: 40,
    backgroundColor: "#ffffff",
  },
});

// ─── Props ────────────────────────────────────────────────────────────────────

export type LonnsgrunnlagDocumentProps = {
  row: AggregateRow;
  workspaceName: string;
  workspaceOrgnr: string;
  periodStartDate: string; // dd.MM.yyyy
  periodEndDate: string; // dd.MM.yyyy
  periodId: string;
  tariffVersion?: string;
  /** ISO timestamp string — must be caller-fixed (e.g. opts.exportedAt.toISOString()) for SHA-256 stability */
  generatedAt: string;
  /**
   * 16-char prefix of the SHA-256 hash shown in the visible footer.
   * Full hash stored in PDF Keywords metadata.
   * NOTE: The hash is computed over the rendered buffer by pdf.ts AFTER rendering,
   * so for the first render pass this is a placeholder. The document is re-rendered
   * with the real hash for the final output. See pdf.ts two-pass rendering note.
   */
  sha256Prefix: string;
  /** Full SHA-256 for PDF Keywords metadata field */
  sha256Full: string;
  /** Optional per-tariff supplement detail (requires audit-level data from caller) */
  supplementLines?: SupplementLine[];
  /** Optional hours breakdown (requires hour-level data from caller) */
  hoursBreakdown?: HoursBreakdown;
  /** Optional tips distribution for the period */
  tips?: TipsDistribution | null;
};

// ─── Document component ───────────────────────────────────────────────────────

export function LonnsgrunnlagDocument(props: LonnsgrunnlagDocumentProps): React.ReactElement {
  const {
    row,
    workspaceName,
    workspaceOrgnr,
    periodStartDate,
    periodEndDate,
    periodId,
    tariffVersion,
    generatedAt,
    sha256Prefix,
    sha256Full,
    supplementLines,
    hoursBreakdown,
    tips,
  } = props;

  return (
    <Document
      title={`Lønnsgrunnlag — ${workspaceName} — ${periodStartDate}–${periodEndDate}`}
      author={workspaceName}
      producer="Smartout"
      subject="Lønnsgrunnlag"
      keywords={`sha256:${sha256Full} period:${periodId}`}
    >
      <Page size="A4" style={styles.page}>
        <Header
          workspaceName={workspaceName}
          workspaceOrgnr={workspaceOrgnr}
          periodStartDate={periodStartDate}
          periodEndDate={periodEndDate}
        />

        <EmployeeBlock
          profileName={row.profile_name}
          personnummer={row.personnummer}
          bankkonto={row.bankkonto}
        />

        <HoursTable breakdown={hoursBreakdown} />

        <SupplementsTable
          lines={supplementLines}
          totalSupplements={row.total_supplements}
          tariffVersion={tariffVersion}
        />

        <TipsTable tips={tips} />

        <TotalsBlock row={row} />

        <Footer
          sha256Prefix={sha256Prefix}
          periodId={periodId}
          tariffVersion={tariffVersion}
          generatedAt={generatedAt}
        />
      </Page>
    </Document>
  );
}
