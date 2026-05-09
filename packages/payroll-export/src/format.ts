/**
 * packages/payroll-export/src/format.ts
 *
 * WHAT: Pure formatting helpers for Norwegian payroll CSV output.
 *
 * WHY: Norwegian Excel expects:
 *   - Semicolon (;) as column delimiter (not comma — comma is decimal separator in nb-NO)
 *   - BOM (EF BB BF) as first three bytes so Excel auto-detects UTF-8
 *   - Numbers with comma as decimal separator and no thousands separator
 *     (e.g. 1234.56 → "1234,56")
 *   - CRLF line endings (Excel on Windows is strict about this)
 *
 * All functions are pure and throw on invalid input rather than silent fallback
 * (L-0177: fail-fast, no silent skip).
 */

// ─── Constants ────────────────────────────────────────────────────────────────

/** UTF-8 BOM — must be prepended to every CSV output so Excel detects the encoding. */
export const BOM_UTF8 = "﻿";

/** Semicolon delimiter — standard for Norwegian locale CSV (comma is decimal separator). */
export const CSV_DELIMITER = ";";

/** CRLF — Excel on Windows requires carriage-return + line-feed. */
export const CSV_LINE_ENDING = "\r\n";

// ─── Number formatting ────────────────────────────────────────────────────────

/**
 * Format a NOK amount for nb-NO CSV output.
 * Uses comma as decimal separator, 2 decimal places, no thousands separator.
 *
 * Examples:
 *   formatNok(1234.56)  → "1234,56"
 *   formatNok(0)        → "0,00"
 *   formatNok(-150.5)   → "-150,50"
 */
export function formatNok(amount: number): string {
  // toFixed guarantees 2 decimal places; replace dot with comma for nb-NO.
  return amount.toFixed(2).replace(".", ",");
}

// ─── Date formatting ──────────────────────────────────────────────────────────

/**
 * Format a date as dd.MM.yyyy (Norwegian date format).
 *
 * Examples:
 *   formatDateNo(new Date("2026-04-01"))  → "01.04.2026"
 *   formatDateNo("2026-04-15")            → "15.04.2026"
 */
export function formatDateNo(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();
  return `${day}.${month}.${year}`;
}

// ─── CSV field escaping ───────────────────────────────────────────────────────

/**
 * Escape a single CSV field value for semicolon-delimited output.
 *
 * Rules:
 *   - null / undefined → empty string (no quotes)
 *   - number → formatNok (nb-NO decimal)
 *   - string containing ; " \n or \r → wrap in double-quotes, double inner quotes
 *   - \r\n normalised to \n before quoting (prevents double CRLF in Excel)
 *   - plain string with no special chars → returned as-is (no quotes)
 */
export function escapeCsvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "number") {
    return formatNok(value);
  }

  // Normalise Windows line endings before deciding whether to quote.
  const normalised = value.replace(/\r\n/g, "\n");

  const needsQuoting =
    normalised.includes(CSV_DELIMITER) ||
    normalised.includes('"') ||
    normalised.includes("\n") ||
    normalised.includes("\r");

  if (!needsQuoting) {
    return normalised;
  }

  // RFC 4180: wrap in double quotes and double any inner double-quote characters.
  return `"${normalised.replace(/"/g, '""')}"`;
}
