/**
 * packages/payroll-export/src/csv.ts
 *
 * WHAT: Core CSV generator for payroll period exports.
 *
 * WHY: Payroll period data must be exportable in two variants:
 *   - 'aggregate': one row per profile (totals — matches what Lines tab shows).
 *   - 'audit': one row per calculation line with full provenance (rule_id,
 *              tariff_version, paragraf) for Bokføringsloven §13 audit trail.
 *
 *      Both variants produce semicolon-delimited, BOM-prefixed, CRLF-terminated
 *      UTF-8 CSV that opens cleanly in Norwegian Excel.
 *
 * Design:
 *   - Pure functions — zero I/O. Callers feed typed rows in, get a string back.
 *   - Numbers use nb-NO formatting (comma decimal, no thousands separator).
 *   - SHA-256 hash of the output bytes is returned by computeFileHash() so the
 *     export_event row can record it for audit-replay verification.
 *   - Throws on programmer errors (empty variant, missing required fields).
 *     Does NOT silently skip bad rows — callers must validate inputs (L-0177).
 */

import { createHash } from "crypto";
import {
  BOM_UTF8,
  CSV_DELIMITER,
  CSV_LINE_ENDING,
  escapeCsvField,
  formatDateNo,
} from "./format.js";
import { maskPersonnummer, maskBankkonto } from "./mask.js";
import type { AggregateRow, AuditRow, ExportOptions, ExportVariant } from "./types.js";

// ─── Column headers ────────────────────────────────────────────────────────────

const AGGREGATE_HEADERS: readonly string[] = [
  "Profil ID",
  "Navn",
  "Personnummer",
  "Bankkonto",
  "Grunnlønn (NOK)",
  "Tillegg (NOK)",
  "Trekk (NOK)",
  "Total lønn (NOK)",
  "Skattepliktig lønn (NOK)",
  "Feriepenger opptjent (NOK)",
];

const AUDIT_EXTRA_HEADERS: readonly string[] = [
  "Beregningslinje ID",
  "Vakt ID",
  "Vaktdato",
  "Regel ID",
  "Tariffversjon",
  "Paragraf",
  "Regelbeløp (NOK)",
  "Derivasjonsversjon",
];

// ─── Row serializers ───────────────────────────────────────────────────────────

function serializeAggregateRow(row: AggregateRow, opts: ExportOptions): string {
  const pnr = opts.includeUnmasked ? row.personnummer : maskPersonnummer(row.personnummer);
  const bank = opts.includeUnmasked ? row.bankkonto : maskBankkonto(row.bankkonto);

  const fields = [
    row.profile_id,
    row.profile_name,
    pnr ?? "",
    bank ?? "",
    row.base_pay,
    row.total_supplements,
    row.total_deductions,
    row.total_pay,
    row.taxable_pay,
    row.feriepenger_accrued,
  ];

  return fields.map((f) => escapeCsvField(f as string | number | null)).join(CSV_DELIMITER);
}

function serializeAuditRow(row: AuditRow, opts: ExportOptions): string {
  const baseFields = serializeAggregateRow(row, opts);

  const auditFields = [
    row.calculation_line_id,
    row.shift_id,
    formatDateNo(row.shift_date),
    row.rule_id ?? "",
    row.tariff_version ?? "",
    row.paragraf ?? "",
    row.rule_amount,
    // derivation_version is a counter (integer), not a monetary amount.
    // Emit as plain integer string to avoid "1,00" formatting confusion.
    String(row.derivation_version),
  ];

  return (
    baseFields +
    CSV_DELIMITER +
    auditFields.map((f) => escapeCsvField(f as string | number | null)).join(CSV_DELIMITER)
  );
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Generate a complete CSV string (BOM + headers + rows + CRLF terminators).
 *
 * Throws if:
 *   - rows is empty → returns empty string (explicit contract: no headers for empty export).
 *   - opts.variant is not "aggregate" or "audit" → programmer error, throws.
 *
 * NOTE: When rows is empty the function returns an empty string (not a header-only
 * CSV). This is intentional — an export with 0 rows should produce no file, and the
 * BFF route must check row count before calling this function.
 */
export function generateCsv(rows: AggregateRow[] | AuditRow[], opts: ExportOptions): string {
  if (opts.variant !== "aggregate" && opts.variant !== "audit") {
    throw new Error(`Unknown export variant: "${String(opts.variant)}"`);
  }

  if (rows.length === 0) {
    return "";
  }

  const headers =
    opts.variant === "aggregate"
      ? AGGREGATE_HEADERS
      : [...AGGREGATE_HEADERS, ...AUDIT_EXTRA_HEADERS];

  const headerLine = headers.map((h) => escapeCsvField(h)).join(CSV_DELIMITER);

  const dataLines =
    opts.variant === "aggregate"
      ? (rows as AggregateRow[]).map((r) => serializeAggregateRow(r, opts))
      : (rows as AuditRow[]).map((r) => serializeAuditRow(r, opts));

  const body = [headerLine, ...dataLines].join(CSV_LINE_ENDING);

  // BOM + body + trailing CRLF for Excel compatibility.
  return BOM_UTF8 + body + CSV_LINE_ENDING;
}

/**
 * Generate the canonical export filename.
 *
 * Format: `{workspaceSlug}-{periodLabel}-{variant}-{isoTimestamp}.csv`
 * Example: `restaurant-oslo-2026-04-aggregate-20260508T120000Z.csv`
 *
 * Colons are stripped from the ISO timestamp so the filename is valid on Windows.
 */
export function generateFilename(opts: ExportOptions): string {
  // Strip colons and hyphens from the ISO timestamp to make it Windows-filename-safe.
  // "2026-05-08T12:00:00.000Z" → "20260508T120000Z"
  const isoRaw = opts.exportedAt.toISOString().split(".")[0] + "Z";
  const ts = isoRaw.replace(/:/g, "").replace(/-/g, "");
  return `${opts.workspaceSlug}-${opts.periodLabel}-${opts.variant}-${ts}.csv`;
}

/**
 * Compute a SHA-256 hex digest of the CSV string.
 * Stored in export_event.file_hash for audit-replay verification.
 */
export function computeFileHash(csv: string): string {
  return createHash("sha256").update(csv, "utf8").digest("hex");
}

/**
 * Re-export variant type guard for callers that need runtime narrowing.
 */
export function isAuditVariant(variant: ExportVariant): variant is "audit" {
  return variant === "audit";
}
