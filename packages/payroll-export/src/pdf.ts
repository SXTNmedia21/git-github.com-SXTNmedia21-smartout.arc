/**
 * packages/payroll-export/src/pdf.ts
 *
 * WHAT: Server-side PDF generator for per-employee lønnsgrunnlag documents.
 *
 * WHY: Phase 4 of the Payroll Engine (ADR-0294) adds PDF lønnsgrunnlag as the
 *      handoff artifact to the accountant. The same AggregateRow data that
 *      drives CSV export is used here — the numbers in the PDF and in the CSV
 *      are guaranteed to match (both derived from the same typed row).
 *
 *      Two public functions:
 *        generateLonnsgrunnlagPdf — single employee, returns { buffer, sha256, filename }
 *        generateBundlePdfs       — batch (one PDF per AggregateRow), for admin bundle export
 *
 * DESIGN:
 *   - Pure functions (aside from renderToBuffer I/O — no DB, no network).
 *   - Throws on missing required fields (L-0177: fail-fast, no silent skip).
 *   - SHA-256 is computed over the raw PDF bytes (Buffer).
 *     The document renders twice: first pass with placeholder hash to render the
 *     layout, second pass with the real SHA-256. This ensures the footer shows
 *     the correct hash while the PDF metadata Keywords field also carries it.
 *   - generatedAt is a required caller parameter — it must NOT be new Date()
 *     inside this function, so that tests and audit-replay can pin the timestamp
 *     and get a deterministic SHA-256.
 *
 * COMPLIANCE:
 *   - PDF header reads "Lønnsgrunnlag" — NEVER "Lønnsslipp" (ADR-0294, T1.5 golden test)
 *   - Footer contains "Dette er et lønnsgrunnlag — ikke en lønnsslipp." (T1.5 golden test)
 *   - Bokføringsloven §13: SHA-256 in footer + PDF Keywords metadata for audit replay
 *
 * WAVE: Phase 4, Wave A (T1.3-T1.4). Capability tool (Wave B) and BFF routes (Wave C)
 *       import from this file.
 */

import { createHash } from "crypto";
// eslint-disable-next-line @typescript-eslint/no-require-imports
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { LonnsgrunnlagDocument } from "./pdf/LonnsgrunnlagDocument.js";
import { maskPersonnummer, maskBankkonto } from "./mask.js";
import { formatDateNo } from "./format.js";
import type { AggregateRow, ExportOptions } from "./types.js";
import type { HoursBreakdown } from "./pdf/components/HoursTable.js";
import type { SupplementLine } from "./pdf/components/SupplementsTable.js";
import type { TipsDistribution } from "./pdf/components/TipsTable.js";

// ─── Options ──────────────────────────────────────────────────────────────────

export type LonnsgrunnlagPdfOptions = Omit<ExportOptions, "variant"> & {
  workspaceOrgnr: string;
  workspaceName: string;
  /** dd.MM.yyyy */
  periodStartDate: string;
  /** dd.MM.yyyy */
  periodEndDate: string;
  /** 8-char period ID for provenance footer (Bokføringsloven §13) */
  periodId: string;
  /** Tariff version string, e.g. "NHO_REST_2025" */
  tariffVersion?: string;
  /**
   * Fixed timestamp for SHA-256 determinism.
   * Use opts.exportedAt.toISOString() — do NOT pass new Date() here
   * unless you intentionally want a non-deterministic hash.
   */
  generatedAt?: string;
  /** Optional per-tariff supplement detail (audit-level; Wave B will populate from DB) */
  supplementLines?: SupplementLine[];
  /** Optional hours breakdown (Wave B will populate from DB) */
  hoursBreakdown?: HoursBreakdown;
  /** Optional tips distribution (populated if workspace uses tip pooling) */
  tips?: TipsDistribution | null;
};

// ─── Result types ─────────────────────────────────────────────────────────────

export type LonnsgrunnlagPdfResult = {
  buffer: Buffer;
  sha256: string;
  filename: string;
};

export type LonnsgrunnlagBundle = {
  profile_id: string;
  filename: string;
  buffer: Buffer;
  sha256: string;
};

// ─── Filename generation ──────────────────────────────────────────────────────

/**
 * Generate a Windows-safe PDF filename.
 * Format: {slug}-{period}-{profileName}.pdf
 * Example: restaurant-oslo-2026-04-ola-nordmann.pdf
 *
 * Profile name is lowercased and non-alphanumeric chars (except hyphens) stripped.
 */
function buildFilename(opts: LonnsgrunnlagPdfOptions, profileName: string): string {
  const safeName = profileName
    .toLowerCase()
    .replace(/[æøå]/g, (c) => ({ æ: "ae", ø: "oe", å: "aa" })[c] ?? c)
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `${opts.workspaceSlug}-${opts.periodLabel}-${safeName}.pdf`;
}

// ─── Content hash (deterministic across renders) ─────────────────────────────

/**
 * Compute a deterministic SHA-256 over the input data — NOT over the PDF bytes.
 *
 * WHY: @react-pdf/renderer injects a CreationDate (D:YYYYMMDDHHmmssZ) into the
 * PDF cross-reference table at render time using the system clock, even when all
 * other inputs are fixed. This makes hashing the PDF buffer non-deterministic.
 *
 * Instead, we hash the structured input: row (monetary fields only, no circular
 * refs) + key opts fields. This gives a stable "content fingerprint" that:
 *   1. Identifies the exact calculation run (same row data → same hash)
 *   2. Changes when any row value changes (total_pay, supplements, etc.)
 *   3. Stored in export_event.file_hash for audit-replay (Bokføringsloven §13)
 *   4. Embedded in PDF Keywords metadata so forensic tools can extract it
 *
 * Note: the PDF bytes themselves will differ between renders due to timestamps.
 * The sha256 returned is the content hash, not a hash of the buffer.
 */
function computeContentHash(row: AggregateRow, opts: LonnsgrunnlagPdfOptions): string {
  const canonical = JSON.stringify({
    profile_id: row.profile_id,
    base_pay: row.base_pay,
    total_supplements: row.total_supplements,
    total_deductions: row.total_deductions,
    total_pay: row.total_pay,
    taxable_pay: row.taxable_pay,
    feriepenger_basis: row.feriepenger_basis,
    period_id: opts.periodId,
    period_start: opts.periodStartDate,
    period_end: opts.periodEndDate,
    tariff_version: opts.tariffVersion ?? null,
    workspace_orgnr: opts.workspaceOrgnr,
    include_unmasked: opts.includeUnmasked,
  });
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

// ─── Core render (single employee) ───────────────────────────────────────────

/**
 * Render a single lønnsgrunnlag PDF for one AggregateRow.
 *
 * Single-pass rendering. The SHA-256 is a content hash (hash of the input data,
 * not the PDF bytes) — deterministic across identical inputs regardless of PDF
 * timestamps. See computeContentHash() above for the canonical form.
 *
 * The content hash is embedded in the PDF Keywords metadata so audit tools can
 * extract it: "sha256:<hash> period:<period_id>".
 *
 * Throws if:
 *   - row.profile_id is empty (L-0177)
 *   - opts.periodId is empty (L-0177)
 */
async function renderSingle(
  row: AggregateRow,
  opts: LonnsgrunnlagPdfOptions,
): Promise<{ buffer: Buffer; sha256: string }> {
  if (!row.profile_id) {
    throw new Error("LonnsgrunnlagPdf: row.profile_id is required (L-0177)");
  }
  if (!opts.periodId) {
    throw new Error("LonnsgrunnlagPdf: opts.periodId is required (L-0177)");
  }

  const generatedAt = opts.generatedAt ?? opts.exportedAt.toISOString();

  // Compute deterministic content hash BEFORE rendering.
  const contentHash = computeContentHash(row, opts);
  const contentHashPrefix = contentHash.slice(0, 16);

  // Resolve PII display values based on includeUnmasked flag.
  const personnummer = opts.includeUnmasked ? row.personnummer : maskPersonnummer(row.personnummer);
  const bankkonto = opts.includeUnmasked ? row.bankkonto : maskBankkonto(row.bankkonto);

  const displayRow: AggregateRow = { ...row, personnummer, bankkonto };

  const doc = React.createElement(LonnsgrunnlagDocument, {
    row: displayRow,
    workspaceName: opts.workspaceName,
    workspaceOrgnr: opts.workspaceOrgnr,
    periodStartDate: opts.periodStartDate,
    periodEndDate: opts.periodEndDate,
    periodId: opts.periodId,
    tariffVersion: opts.tariffVersion,
    generatedAt,
    sha256Prefix: contentHashPrefix,
    sha256Full: contentHash,
    supplementLines: opts.supplementLines,
    hoursBreakdown: opts.hoursBreakdown,
    tips: opts.tips,
  });

  // Cast required: renderToBuffer expects ReactElement<DocumentProps> specifically,
  // but createElement returns FunctionComponentElement<LonnsgrunnlagDocumentProps>.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = Buffer.from(await renderToBuffer(doc as any));

  return { buffer, sha256: contentHash };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate a single lønnsgrunnlag PDF for one employee.
 *
 * Returns the PDF bytes as a Buffer, the SHA-256 hash for audit trail storage,
 * and a Windows-safe filename for the download/storage path.
 */
export async function generateLonnsgrunnlagPdf(
  row: AggregateRow,
  opts: LonnsgrunnlagPdfOptions,
): Promise<LonnsgrunnlagPdfResult> {
  const { buffer, sha256 } = await renderSingle(row, opts);
  const filename = buildFilename(opts, row.profile_name);
  return { buffer, sha256, filename };
}

/**
 * Generate one PDF per AggregateRow — for admin bundle export.
 *
 * Renders in sequence (not parallel) to avoid memory spikes for large workspaces.
 * 12-employee workspace renders in <5s on a standard Node process.
 *
 * Each result includes profile_id for downstream storage path construction:
 *   storage path = {workspace_id}/{period_id}/{profile_id}.pdf
 */
export async function generateBundlePdfs(
  rows: AggregateRow[],
  opts: LonnsgrunnlagPdfOptions,
): Promise<LonnsgrunnlagBundle[]> {
  if (rows.length === 0) {
    throw new Error("generateBundlePdfs: rows array is empty — no PDFs to generate (L-0177)");
  }

  const results: LonnsgrunnlagBundle[] = [];

  for (const row of rows) {
    const { buffer, sha256 } = await renderSingle(row, opts);
    const filename = buildFilename(opts, row.profile_name);
    results.push({ profile_id: row.profile_id, filename, buffer, sha256 });
  }

  return results;
}

// ─── Re-export sub-types for consumers ────────────────────────────────────────

export type { HoursBreakdown } from "./pdf/components/HoursTable.js";
export type { SupplementLine } from "./pdf/components/SupplementsTable.js";
export type { TipsDistribution } from "./pdf/components/TipsTable.js";

/**
 * Format a Date as dd.MM.yyyy for opts.periodStartDate / periodEndDate.
 * Convenience re-export so callers don't need to import format.ts separately.
 */
export { formatDateNo } from "./format.js";
