/**
 * packages/payroll-export/src/index.ts
 *
 * WHAT: Public surface of @smartout/payroll-export.
 *       CSV + PDF export engine for payroll lønnsgrunnlag.
 *       Zero I/O (aside from renderToBuffer in pdf.ts). Deterministic.
 *
 * WHY: Isolated from DB/network concerns so export logic can be:
 *        - Unit tested with golden fixtures
 *        - Used by the BFF route (apps/web) without circular deps
 *        - Re-run deterministically for audit-replay (Bokføringsloven §13)
 *
 * WAVES:
 *   Phase 3, Wave A: CSV generation (T1.1–T1.4)
 *   Phase 4, Wave A: PDF generation (T1.1–T1.5)
 *   Wave B: Capability tools import from this package.
 *   Wave C: BFF routes import from this package.
 */

// ── CSV generation ────────────────────────────────────────────────────────────
export { generateCsv, generateFilename, computeFileHash, isAuditVariant } from "./csv.js";

// ── PDF generation (Phase 4 Wave A — ADR-0294) ───────────────────────────────
export {
  generateLonnsgrunnlagPdf,
  generateBundlePdfs,
  formatDateNo as formatDateNoPdf,
} from "./pdf.js";
export type {
  LonnsgrunnlagPdfOptions,
  LonnsgrunnlagPdfResult,
  LonnsgrunnlagBundle,
  HoursBreakdown,
  SupplementLine,
  TipsDistribution,
} from "./pdf.js";

// ── Formatting helpers ────────────────────────────────────────────────────────
export {
  BOM_UTF8,
  CSV_DELIMITER,
  CSV_LINE_ENDING,
  formatNok,
  formatDateNo,
  escapeCsvField,
} from "./format.js";

// ── PII masking ───────────────────────────────────────────────────────────────
export { maskPersonnummer, maskBankkonto } from "./mask.js";

// ── Types ─────────────────────────────────────────────────────────────────────
export type { ExportVariant, AggregateRow, AuditRow, ExportOptions } from "./types.js";
