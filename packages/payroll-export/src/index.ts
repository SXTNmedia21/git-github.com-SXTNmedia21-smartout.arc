/**
 * packages/payroll-export/src/index.ts
 *
 * WHAT: Public surface of @smartout/payroll-export.
 *       Pure-function payroll CSV export engine.
 *       Zero I/O. Deterministic. Takes typed rows in, returns CSV strings out.
 *
 * WHY: Isolated from DB/network concerns so export logic can be:
 *        - Unit tested with golden fixtures
 *        - Used by the BFF route (apps/web) without circular deps
 *        - Re-run deterministically for audit-replay (Bokføringsloven §13)
 *
 * WAVE: Phase 3, Wave A (T1.1–T1.4). Capability tool (Wave B) and UI (Wave C)
 *       import from this package.
 */

// ── CSV generation ────────────────────────────────────────────────────────────
export { generateCsv, generateFilename, computeFileHash, isAuditVariant } from "./csv.js";

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
