/**
 * __tests__/csv.test.ts
 *
 * WHAT: Golden CSV tests for @smartout/payroll-export.
 *
 * WHY: Ensures generateCsv() produces byte-exact output that opens cleanly in
 *      Norwegian Excel. Guards against regressions in:
 *        - BOM prefix (Excel auto-detects UTF-8)
 *        - Semicolon delimiter (not comma)
 *        - nb-NO number format (comma decimal, no thousands separator)
 *        - PII masking (last 4 digits visible)
 *        - Audit variant provenance columns
 *        - Filename format
 *        - Escape rules (fields containing ; " \n)
 *
 * Zero I/O. All fixture data is inline or read from __tests__/fixtures/.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import {
  generateCsv,
  generateFilename,
  computeFileHash,
  formatNok,
  formatDateNo,
  escapeCsvField,
  maskPersonnummer,
  maskBankkonto,
  BOM_UTF8,
  CSV_DELIMITER,
  CSV_LINE_ENDING,
} from "../src/index.js";
import type { AggregateRow, AuditRow, ExportOptions } from "../src/index.js";

// ── Fixture helpers ────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));

function readFixture(name: string): string {
  return readFileSync(join(__dirname, "fixtures", name), "utf8");
}

// ── Test data ──────────────────────────────────────────────────────────────────

const EXPORT_AT = new Date("2026-05-08T12:00:00.000Z");

const BASE_OPTS: ExportOptions = {
  variant: "aggregate",
  includeUnmasked: false,
  workspaceSlug: "restaurant-oslo",
  periodLabel: "2026-04",
  exportedAt: EXPORT_AT,
};

const ROW_WITH_PII: AggregateRow = {
  profile_id: "prof-001",
  profile_name: "Ola Nordmann",
  personnummer: "01017012345",
  bankkonto: "12345678901",
  base_pay: 21500,
  total_supplements: 1500,
  total_deductions: 0,
  total_pay: 23000,
  taxable_pay: 23000,
  feriepenger_basis: 2760,
};

const ROW_NO_PII: AggregateRow = {
  profile_id: "prof-002",
  profile_name: "Kari Larsen",
  personnummer: null,
  bankkonto: null,
  base_pay: 18000,
  total_supplements: 800,
  total_deductions: 0,
  total_pay: 18800,
  taxable_pay: 18800,
  feriepenger_basis: 2256,
};

const AUDIT_ROW: AuditRow = {
  ...ROW_WITH_PII,
  calculation_line_id: "calc-001",
  shift_id: "shift-001",
  shift_date: "2026-04-01",
  rule_id: "rule-evening-001",
  tariff_version: "2025-riksavtalen",
  paragraf: "§4.2.1",
  rule_amount: 1500,
  derivation_version: 1,
};

// ── formatNok ─────────────────────────────────────────────────────────────────

describe("formatNok", () => {
  it("formats positive amount with comma decimal", () => {
    expect(formatNok(1234.56)).toBe("1234,56");
  });

  it("pads to 2 decimal places", () => {
    expect(formatNok(0)).toBe("0,00");
    expect(formatNok(100)).toBe("100,00");
  });

  it("handles negative amounts", () => {
    expect(formatNok(-150.5)).toBe("-150,50");
  });

  it("rounds at 2 decimal places", () => {
    expect(formatNok(1.005)).toBe("1,00"); // floating point: 1.005.toFixed(2) = "1.00"
    expect(formatNok(1.006)).toBe("1,01");
  });

  it("handles large amounts without thousands separator", () => {
    expect(formatNok(123456.78)).toBe("123456,78");
  });
});

// ── formatDateNo ──────────────────────────────────────────────────────────────

describe("formatDateNo", () => {
  it("formats Date object as dd.MM.yyyy", () => {
    expect(formatDateNo(new Date("2026-04-01T00:00:00.000Z"))).toBe("01.04.2026");
  });

  it("formats ISO date string as dd.MM.yyyy", () => {
    expect(formatDateNo("2026-12-31")).toBe("31.12.2026");
  });

  it("zero-pads single-digit day and month", () => {
    expect(formatDateNo("2026-01-05")).toBe("05.01.2026");
  });
});

// ── escapeCsvField ────────────────────────────────────────────────────────────

describe("escapeCsvField", () => {
  it("returns empty string for null", () => {
    expect(escapeCsvField(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(escapeCsvField(undefined)).toBe("");
  });

  it("formats numbers as nb-NO", () => {
    expect(escapeCsvField(1234.56)).toBe("1234,56");
  });

  it("returns plain string unchanged when no special chars", () => {
    expect(escapeCsvField("hello world")).toBe("hello world");
  });

  it("wraps field containing semicolon in quotes", () => {
    expect(escapeCsvField("foo;bar")).toBe('"foo;bar"');
  });

  it("wraps field containing double-quote and doubles the quote", () => {
    expect(escapeCsvField('say "hello"')).toBe('"say ""hello"""');
  });

  it("wraps field containing newline in quotes", () => {
    expect(escapeCsvField("line1\nline2")).toBe('"line1\nline2"');
  });

  it("normalises CRLF to LF before quoting", () => {
    const result = escapeCsvField("line1\r\nline2");
    expect(result).toBe('"line1\nline2"');
    // Must NOT contain \r\n inside the quoted value
    expect(result).not.toContain("\r\n");
  });
});

// ── maskPersonnummer ──────────────────────────────────────────────────────────

describe("maskPersonnummer", () => {
  it("masks first 7 digits of standard 11-digit personnummer", () => {
    expect(maskPersonnummer("01017012345")).toBe("*******2345");
  });

  it("returns empty string for null", () => {
    expect(maskPersonnummer(null)).toBe("");
  });

  it("returns empty string for empty string", () => {
    expect(maskPersonnummer("")).toBe("");
  });

  it("strips non-digit characters before masking", () => {
    // Some systems store formatted as "010170 12345"
    expect(maskPersonnummer("010170 12345")).toBe("*******2345");
  });

  it("masks a short number (all visible digits ≤4)", () => {
    expect(maskPersonnummer("1234")).toBe("****");
  });
});

// ── maskBankkonto ─────────────────────────────────────────────────────────────

describe("maskBankkonto", () => {
  it("masks all but last 4 digits of 11-digit bank account (7 stars)", () => {
    // "12345678901" → 11 chars → 7 mask + 4 visible
    expect(maskBankkonto("12345678901")).toBe("*******8901");
  });

  it("strips dots from formatted account number before masking", () => {
    // "1234.56.78901" → strip dots → "12345678901" → 11 chars → 7 mask + 4 visible
    expect(maskBankkonto("1234.56.78901")).toBe("*******8901");
  });

  it("strips spaces from formatted account number before masking", () => {
    expect(maskBankkonto("1234 56 78901")).toBe("*******8901");
  });

  it("returns empty string for null", () => {
    expect(maskBankkonto(null)).toBe("");
  });

  it("returns empty string for empty string", () => {
    expect(maskBankkonto("")).toBe("");
  });
});

// ── generateCsv — aggregate masked ───────────────────────────────────────────

describe("generateCsv — aggregate masked", () => {
  const opts: ExportOptions = { ...BASE_OPTS, variant: "aggregate", includeUnmasked: false };
  const csv = generateCsv([ROW_WITH_PII, ROW_NO_PII], opts);

  it("starts with UTF-8 BOM", () => {
    expect(csv.startsWith(BOM_UTF8)).toBe(true);
  });

  it("uses semicolon as delimiter", () => {
    const firstDataLine = csv.split(CSV_LINE_ENDING)[1];
    expect(firstDataLine).toContain(CSV_DELIMITER);
    expect(firstDataLine).not.toMatch(/,[A-Za-z]/); // no comma-as-delimiter
  });

  it("uses CRLF line endings", () => {
    expect(csv).toContain(CSV_LINE_ENDING);
    // Header + 2 data rows + trailing CRLF = 4 line-ending sequences
    const lineEndings = csv.match(/\r\n/g);
    expect(lineEndings?.length).toBe(3); // header + 2 rows
  });

  it("masks personnummer to last 4 digits", () => {
    expect(csv).toContain("*******2345");
    expect(csv).not.toContain("01017012345");
  });

  it("masks bankkonto to last 4 digits", () => {
    // "12345678901" → 11 chars → 7 mask stars + 4 visible = "*******8901"
    expect(csv).toContain("*******8901");
    expect(csv).not.toContain("12345678901");
  });

  it("outputs null PII as empty fields (no mask markers)", () => {
    // prof-002 has null personnummer and bankkonto
    const lines = csv.split(CSV_LINE_ENDING);
    const row2 = lines[2]; // index 0 = header, 1 = prof-001, 2 = prof-002
    // Two consecutive semicolons indicate empty PII fields
    expect(row2).toContain("prof-002;Kari Larsen;;");
  });

  it("formats numbers as nb-NO (comma decimal)", () => {
    expect(csv).toContain("21500,00");
    expect(csv).toContain("1500,00");
    expect(csv).toContain("23000,00");
    expect(csv).toContain("2760,00");
  });

  it("matches aggregate-masked golden fixture", () => {
    const golden = readFixture("aggregate-masked.csv");
    expect(csv).toBe(golden);
  });
});

// ── generateCsv — aggregate unmasked ─────────────────────────────────────────

describe("generateCsv — aggregate unmasked", () => {
  const opts: ExportOptions = { ...BASE_OPTS, variant: "aggregate", includeUnmasked: true };
  const csv = generateCsv([ROW_WITH_PII, ROW_NO_PII], opts);

  it("includes raw personnummer when unmasked", () => {
    expect(csv).toContain("01017012345");
    expect(csv).not.toContain("*******2345");
  });

  it("includes raw bankkonto when unmasked", () => {
    expect(csv).toContain("12345678901");
    expect(csv).not.toContain("********8901");
  });

  it("still has BOM prefix", () => {
    expect(csv.startsWith(BOM_UTF8)).toBe(true);
  });

  it("matches aggregate-unmasked golden fixture", () => {
    const golden = readFixture("aggregate-unmasked.csv");
    expect(csv).toBe(golden);
  });
});

// ── generateCsv — audit masked ────────────────────────────────────────────────

describe("generateCsv — audit masked", () => {
  const opts: ExportOptions = { ...BASE_OPTS, variant: "audit", includeUnmasked: false };
  const csv = generateCsv([AUDIT_ROW], opts);

  it("starts with UTF-8 BOM", () => {
    expect(csv.startsWith(BOM_UTF8)).toBe(true);
  });

  it("includes provenance columns in header", () => {
    const headerLine = csv.split(CSV_LINE_ENDING)[0].replace(BOM_UTF8, "");
    expect(headerLine).toContain("Beregningslinje ID");
    expect(headerLine).toContain("Vakt ID");
    expect(headerLine).toContain("Vaktdato");
    expect(headerLine).toContain("Regel ID");
    expect(headerLine).toContain("Tariffversjon");
    expect(headerLine).toContain("Paragraf");
    expect(headerLine).toContain("Regelbeløp (NOK)");
    expect(headerLine).toContain("Derivasjonsversjon");
  });

  it("includes provenance values in data row", () => {
    expect(csv).toContain("calc-001");
    expect(csv).toContain("shift-001");
    expect(csv).toContain("01.04.2026"); // formatDateNo applied
    expect(csv).toContain("rule-evening-001");
    expect(csv).toContain("2025-riksavtalen");
    expect(csv).toContain("§4.2.1");
    expect(csv).toContain("1500,00");
  });

  it("masks PII in audit variant too", () => {
    expect(csv).toContain("*******2345");
    expect(csv).not.toContain("01017012345");
  });

  it("has correct column count (10 aggregate + 8 audit = 18)", () => {
    const headerLine = csv.split(CSV_LINE_ENDING)[0].replace(BOM_UTF8, "");
    const cols = headerLine.split(CSV_DELIMITER);
    expect(cols).toHaveLength(18);
  });

  it("matches audit-masked golden fixture", () => {
    const golden = readFixture("audit-masked.csv");
    expect(csv).toBe(golden);
  });
});

// ── generateCsv — empty rows ──────────────────────────────────────────────────

describe("generateCsv — empty rows", () => {
  it("returns empty string for empty array (not a header-only CSV)", () => {
    const csv = generateCsv([], BASE_OPTS);
    expect(csv).toBe("");
  });
});

// ── generateCsv — unknown variant ────────────────────────────────────────────

describe("generateCsv — unknown variant", () => {
  it("throws on unknown variant", () => {
    const opts = { ...BASE_OPTS, variant: "excel" as unknown as "aggregate" };
    expect(() => generateCsv([ROW_WITH_PII], opts)).toThrow(/Unknown export variant/);
  });
});

// ── generateFilename ──────────────────────────────────────────────────────────

describe("generateFilename", () => {
  it("produces expected filename format", () => {
    const name = generateFilename(BASE_OPTS);
    expect(name).toBe("restaurant-oslo-2026-04-aggregate-20260508T120000Z.csv");
  });

  it("does not contain colons (Windows-safe)", () => {
    const name = generateFilename(BASE_OPTS);
    expect(name).not.toContain(":");
  });

  it("includes variant in filename", () => {
    const auditOpts: ExportOptions = { ...BASE_OPTS, variant: "audit" };
    expect(generateFilename(auditOpts)).toContain("-audit-");
  });

  it("includes period label in filename", () => {
    expect(generateFilename(BASE_OPTS)).toContain("2026-04");
  });

  it("ends with .csv", () => {
    expect(generateFilename(BASE_OPTS)).toMatch(/\.csv$/);
  });
});

// ── computeFileHash ───────────────────────────────────────────────────────────

describe("computeFileHash", () => {
  it("returns 64-char hex string (SHA-256)", () => {
    const hash = computeFileHash("test content");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic for same input", () => {
    const a = computeFileHash("hello");
    const b = computeFileHash("hello");
    expect(a).toBe(b);
  });

  it("differs for different inputs", () => {
    const a = computeFileHash("hello");
    const b = computeFileHash("world");
    expect(a).not.toBe(b);
  });

  it("returns correct SHA-256 for known input", () => {
    // echo -n "abc" | sha256sum = ba7816bf8f01cfea414140de5dae2ec73b00361bbef0469f492c791f8f5e83
    // Trailing "a" completes to: ba7816bf8f01cfea414140de5dae2ec73b003619bbef0469f492c791f8f5e83a
    // Use an easier known value:
    const hash = computeFileHash("");
    // SHA-256 of empty string = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
    expect(hash).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });
});
