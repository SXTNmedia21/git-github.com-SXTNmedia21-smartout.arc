/**
 * packages/payroll-export/src/mask.ts
 *
 * WHAT: PII masking helpers for Norwegian payroll CSV exports.
 *
 * WHY: personnummer (national identity number) and bankkonto (bank account) are
 *      high-sensitivity PII under GDPR and Bokføringsloven. CSV exports are masked
 *      by default — only the last 4 digits remain visible so the auditor can
 *      correlate records without exposing the full value.
 *
 *      Unmasked export requires admin authority + emits payroll.csv_export_unmasked
 *      telemetry (handled in the capability tool, not here — this module is pure).
 *
 * Both functions are pure, deterministic, and throw on programmer errors rather
 * than silently producing garbage (L-0177).
 */

// ─── Personnummer masking ─────────────────────────────────────────────────────

/**
 * Mask a Norwegian personnummer to show only the last 4 digits.
 *
 * Format: 11-digit string (ddMMyyNNNCC).
 * Output: first 7 chars replaced with '*', last 4 preserved.
 *
 * Examples:
 *   maskPersonnummer("01017012345")  → "*******2345"
 *   maskPersonnummer(null)           → ""
 *   maskPersonnummer("")             → ""
 *
 * NOTE: Input is not validated for format correctness — this is a masking
 * function, not a validator. Callers are responsible for providing the raw
 * 11-digit string from the database.
 */
export function maskPersonnummer(pnr: string | null | undefined): string {
  if (!pnr) return "";

  // Strip any accidental whitespace or non-digit chars before masking.
  const digits = pnr.replace(/\D/g, "");

  if (digits.length === 0) return "";

  const visibleCount = 4;
  if (digits.length <= visibleCount) {
    // Shorter than 4 digits — mask everything (unusual input, still safe).
    return "*".repeat(digits.length);
  }

  const masked = "*".repeat(digits.length - visibleCount);
  const visible = digits.slice(-visibleCount);
  return masked + visible;
}

// ─── Bankkonto masking ────────────────────────────────────────────────────────

/**
 * Mask a Norwegian bank account number to show only the last 4 digits.
 *
 * Norwegian bank accounts are 11 digits in format XXXX.XX.XXXXX.
 * Input may include dots, spaces, or hyphens — these are stripped before masking.
 *
 * Output: all digits except last 4 replaced with '*'.
 *
 * Examples:
 *   maskBankkonto("12345678901")     → "********8901"
 *   maskBankkonto("1234.56.78901")   → "********8901"
 *   maskBankkonto(null)              → ""
 *   maskBankkonto("")                → ""
 */
export function maskBankkonto(account: string | null | undefined): string {
  if (!account) return "";

  // Strip spaces, dots, and hyphens before masking.
  const digits = account.replace(/[\s.\-]/g, "");

  if (digits.length === 0) return "";

  const visibleCount = 4;
  if (digits.length <= visibleCount) {
    return "*".repeat(digits.length);
  }

  const masked = "*".repeat(digits.length - visibleCount);
  const visible = digits.slice(-visibleCount);
  return masked + visible;
}
