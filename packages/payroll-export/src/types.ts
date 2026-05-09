/**
 * packages/payroll-export/src/types.ts
 *
 * WHAT: Type definitions for the @smartout/payroll-export package.
 *
 * WHY: Shared between csv.ts (generator), the BFF route, and the capability
 *      tool so that the same AggregateRow / AuditRow shapes drive both the
 *      generated CSV and the export_line.line_payload JSONB stored in the DB.
 *      Pure types — no runtime code, no I/O.
 */

// ─── Variants ─────────────────────────────────────────────────────────────────

/**
 * 'aggregate' — one row per profile; totals only (no line-level provenance).
 * 'audit'     — one row per calculation_line; includes rule_id, tariff_version,
 *               paragraf for auditor-level traceability (Bokføringsloven §13).
 */
export type ExportVariant = "aggregate" | "audit";

// ─── Row shapes ───────────────────────────────────────────────────────────────

/**
 * One row in an aggregate CSV export.
 * All monetary fields are in NOK (decimal), not øre.
 *
 * personnummer and bankkonto are pre-masked by the caller unless
 * ExportOptions.includeUnmasked = true.
 */
export type AggregateRow = {
  profile_id: string;
  profile_name: string;
  personnummer: string | null; // masked: "*******2345" or raw 11-digit
  bankkonto: string | null; // masked: "********8901" or raw
  base_pay: number;
  total_supplements: number;
  total_deductions: number;
  total_pay: number;
  taxable_pay: number;
  feriepenger_accrued: number;
};

/**
 * One row in an audit CSV export.
 * Extends AggregateRow with per-calculation-line provenance columns.
 * Each AuditRow corresponds to one payroll.calculation row.
 */
export type AuditRow = AggregateRow & {
  calculation_line_id: string;
  shift_id: string;
  shift_date: string; // ISO date "2026-04-01"
  rule_id: string | null;
  tariff_version: string | null;
  paragraf: string | null; // e.g. "§4.2.1"
  rule_amount: number;
  derivation_version: number;
};

// ─── Options ──────────────────────────────────────────────────────────────────

export type ExportOptions = {
  variant: ExportVariant;
  /**
   * When true, PII fields (personnummer, bankkonto) are included as raw values.
   * The caller is responsible for:
   *   1. Verifying admin authority (gate_action before calling generateCsv).
   *   2. Emitting payroll.csv_export_unmasked telemetry event after generation.
   */
  includeUnmasked: boolean;
  /** Workspace slug — included in filename, e.g. "restaurant-oslo" */
  workspaceSlug: string;
  /** Period label in yyyy-MM format, e.g. "2026-04" */
  periodLabel: string;
  /** Timestamp of the export operation (used in filename + audit header) */
  exportedAt: Date;
};
