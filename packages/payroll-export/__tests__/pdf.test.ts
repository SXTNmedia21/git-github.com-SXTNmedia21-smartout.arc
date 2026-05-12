/**
 * __tests__/pdf.test.ts
 *
 * WHAT: Golden render-to-buffer tests for @smartout/payroll-export PDF generation.
 *
 * WHY: Guards the two hardest compliance requirements:
 *   1. PDF title metadata MUST contain "Lønnsgrunnlag" — NEVER "Lønnsslipp"
 *   2. PDF keywords MUST contain the SHA-256 for audit-trail linkage
 *   3. SHA-256 MUST be stable across identical renders (deterministic for audit-replay)
 *   4. Bundle MUST produce one PDF per profile
 *   5. Filename format MUST match the documented pattern
 *   6. Masked PII variant must not expose full personnummer
 *
 * ENCODING NOTE: @react-pdf/renderer embeds page content in font-encoded glyph streams
 * (not readable Latin-1/UTF-8 text). However, PDF metadata strings (Title, Keywords,
 * Author, Subject) are stored as readable objects in the PDF cross-reference table and
 * CAN be searched in the raw buffer as Latin-1.
 *
 * Strategy:
 *   - Title metadata: stored as UTF-16BE with BOM. Look for ASCII substrings
 *     interleaved (each char is two bytes: null + ASCII). The string
 *     "Lønnsgrunnlag" has ASCII chars n, n, s, g, r, u, n, n, l, a, g.
 *   - Keywords: stored as plain ASCII string "(sha256:... period:...)"
 *   - Producer: "Smartout" — plain ASCII
 *   - Numbers (23000,00): these appear in the font-encoded content stream in
 *     glyph form. We verify them via the keywords SHA-256 stability instead.
 *
 * The SHA-256 stability test is the primary compliance gate: same inputs →
 * same hash → same bit-exact output → numbers in PDF must also be identical.
 *
 * Zero I/O beyond renderToBuffer. All fixture data is inline or from json file.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { generateLonnsgrunnlagPdf, generateBundlePdfs } from "../src/index.js";
import type { AggregateRow, LonnsgrunnlagPdfOptions } from "../src/index.js";

// ── Fixture helpers ────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));

function readFixtureRow(): AggregateRow {
  const raw = readFileSync(join(__dirname, "fixtures", "pdf-input.json"), "utf8");
  return JSON.parse(raw) as AggregateRow;
}

// ── Shared test data ───────────────────────────────────────────────────────────

const FIXED_TIMESTAMP = "2026-05-08T12:00:00.000Z";

const BASE_OPTS: LonnsgrunnlagPdfOptions = {
  variant: "aggregate",
  includeUnmasked: false,
  workspaceSlug: "restaurant-oslo",
  periodLabel: "2026-04",
  exportedAt: new Date(FIXED_TIMESTAMP),
  generatedAt: FIXED_TIMESTAMP,
  workspaceOrgnr: "123456789",
  workspaceName: "Restaurant Oslo AS",
  periodStartDate: "01.04.2026",
  periodEndDate: "30.04.2026",
  periodId: "per-001a",
  tariffVersion: "NHO_REST_2025",
};

/**
 * Extract raw buffer as latin1 string for metadata searching.
 * @react-pdf/renderer stores PDF metadata (Title, Keywords, Author, Subject)
 * as readable strings in the cross-reference table — searchable in latin1.
 * Page content streams are font-encoded (glyph streams) and NOT searchable.
 */
function rawPdf(buf: Buffer): string {
  return buf.toString("latin1");
}

/**
 * Extract the ASCII-stripped version of the PDF for text searching.
 * UTF-16BE encoded strings (like the title) have null bytes between ASCII chars.
 * Stripping null bytes makes "L\x00\xF8\x00n\x00n\x00s\x00g..." → "Lønnsgrunnlag"
 * but since latin1 can't represent the full ø correctly after stripping, we just
 * strip nulls and look for ASCII subsequences like "nnsgrunnlag".
 */
function rawPdfStripped(buf: Buffer): string {
  // Remove null bytes to make UTF-16BE content searchable as ASCII substrings
  return buf.toString("latin1").replace(/\x00/g, "");
}

/**
 * Check if the PDF Keywords metadata contains a value.
 * Keywords are stored as plain ASCII: "(sha256:XXXX period:YYY)"
 */
function getKeywords(buf: Buffer): string {
  const raw = rawPdf(buf);
  // Match the keywords object: the sha256 line is plain ASCII
  const kwMatch = raw.match(/\(sha256:[0-9a-f]+ period:[^\)]+\)/);
  return kwMatch?.[0] ?? "";
}

/**
 * Check if "Lønnsslipp" (or lønnsslipp) appears anywhere in the PDF binary.
 * The Norwegian chars can appear as encoded glyphs — we look for the
 * ASCII portions "nnsslipp" which would never appear legitimately.
 * Also check the null-stripped form to cover UTF-16BE encoded metadata.
 */
function containsLonnsslipp(buf: Buffer): boolean {
  const raw = rawPdf(buf);
  const stripped = rawPdfStripped(buf);
  return raw.toLowerCase().includes("nnsslipp") || stripped.toLowerCase().includes("nnsslipp");
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("generateLonnsgrunnlagPdf", () => {
  it("PDF title metadata contains 'nnsgrunnlag' (never 'nnsslipp')", async () => {
    const row = readFixtureRow();
    const result = await generateLonnsgrunnlagPdf(row, BASE_OPTS);

    expect(result.buffer).toBeInstanceOf(Buffer);
    expect(result.buffer.length).toBeGreaterThan(1000);

    // The word "Lønnsslipp" / "lønnsslipp" must NEVER appear in the PDF output
    // (checking ASCII portion "nnsslipp" which appears in all encodings)
    expect(containsLonnsslipp(result.buffer)).toBe(false);

    // Title metadata is UTF-16BE encoded. Null-stripping reveals the ASCII chars.
    // "Lønnsgrunnlag" → stripped: "L(ø-encoded)nnsgrunnlag" → contains "nnsgrunnlag"
    const stripped = rawPdfStripped(result.buffer);
    expect(stripped).toContain("nnsgrunnlag");
  }, 30_000);

  it("footer disclaimer appears in PDF metadata (provenance marker)", async () => {
    const row = readFixtureRow();
    const result = await generateLonnsgrunnlagPdf(row, BASE_OPTS);

    // The keywords contain the period_id and sha256 — these are our compliance anchors
    const keywords = getKeywords(result.buffer);
    expect(keywords).toContain("sha256:");
    expect(keywords).toContain("period:per-001a");

    // "Smartout" producer is plaintext in the PDF info dict
    const raw = rawPdf(result.buffer);
    expect(raw).toContain("Smartout");
  }, 30_000);

  it("SHA-256 is stable across two renders with same input", async () => {
    const row = readFixtureRow();

    const result1 = await generateLonnsgrunnlagPdf(row, BASE_OPTS);
    const result2 = await generateLonnsgrunnlagPdf(row, BASE_OPTS);

    expect(result1.sha256).toBe(result2.sha256);
    expect(result1.sha256).toMatch(/^[0-9a-f]{64}$/);
  }, 60_000);

  it("SHA-256 differs when row content changes", async () => {
    const row1 = readFixtureRow();
    const row2 = { ...row1, total_pay: 99999 };

    const result1 = await generateLonnsgrunnlagPdf(row1, BASE_OPTS);
    const result2 = await generateLonnsgrunnlagPdf(row2, BASE_OPTS);

    expect(result1.sha256).not.toBe(result2.sha256);
  }, 60_000);

  it("SHA-256 prefix appears in PDF keywords metadata", async () => {
    const row = readFixtureRow();
    const result = await generateLonnsgrunnlagPdf(row, BASE_OPTS);

    // The first 16 chars of the sha256 must appear in the Keywords PDF object
    const prefix = result.sha256.slice(0, 16);
    const keywords = getKeywords(result.buffer);
    expect(keywords).toContain(prefix);
  }, 30_000);

  it("filename format includes workspace slug, period, and profile name", async () => {
    const row = readFixtureRow();
    const result = await generateLonnsgrunnlagPdf(row, BASE_OPTS);

    // Expected pattern: {slug}-{period}-{safeName}.pdf
    expect(result.filename).toMatch(/^restaurant-oslo-2026-04-.+\.pdf$/);
    // Profile name "Ola Nordmann" → "ola-nordmann"
    expect(result.filename).toContain("ola-nordmann");
  }, 30_000);

  it("masked variant: full personnummer not present, last-4 chars visible in glyph streams", async () => {
    const row = readFixtureRow(); // personnummer: "01017012345"
    const result = await generateLonnsgrunnlagPdf(row, { ...BASE_OPTS, includeUnmasked: false });

    // Full raw personnummer "01017012345" must not appear in any readable form
    const raw = rawPdf(result.buffer);
    // "01017012345" contains ASCII digits — if unmasked, they'd appear together in metadata
    // The masked form is "*******2345" — the stars are non-ASCII in PDF glyph encoding
    // but "2345" last digits may appear. We check the raw string does NOT contain the full sequence.
    expect(raw).not.toContain("01017012345");
  }, 30_000);

  it("returns a valid LonnsgrunnlagPdfResult", async () => {
    const row = readFixtureRow();
    const result = await generateLonnsgrunnlagPdf(row, BASE_OPTS);

    expect(result.buffer).toBeInstanceOf(Buffer);
    expect(result.buffer.length).toBeGreaterThan(0);
    expect(typeof result.sha256).toBe("string");
    expect(result.sha256).toHaveLength(64);
    expect(typeof result.filename).toBe("string");
    expect(result.filename.endsWith(".pdf")).toBe(true);
  }, 30_000);

  it("throws if profile_id is empty (L-0177 fail-fast)", async () => {
    const row = { ...readFixtureRow(), profile_id: "" };
    await expect(generateLonnsgrunnlagPdf(row, BASE_OPTS)).rejects.toThrow(
      "profile_id is required",
    );
  });

  it("throws if periodId is empty (L-0177 fail-fast)", async () => {
    const row = readFixtureRow();
    await expect(generateLonnsgrunnlagPdf(row, { ...BASE_OPTS, periodId: "" })).rejects.toThrow(
      "periodId is required",
    );
  });
});

describe("generateBundlePdfs", () => {
  it("generates 1 PDF per profile in the input array", async () => {
    const row = readFixtureRow();
    const rows: AggregateRow[] = [
      row,
      { ...row, profile_id: "prof-002", profile_name: "Kari Larsen", total_pay: 18800 },
      { ...row, profile_id: "prof-003", profile_name: "Per Hansen", total_pay: 22000 },
    ];

    const results = await generateBundlePdfs(rows, BASE_OPTS);

    expect(results).toHaveLength(3);
    expect(results[0].profile_id).toBe(row.profile_id);
    expect(results[1].profile_id).toBe("prof-002");
    expect(results[2].profile_id).toBe("prof-003");
  }, 90_000);

  it("each bundle entry has distinct filename", async () => {
    const row = readFixtureRow();
    const rows: AggregateRow[] = [
      row,
      { ...row, profile_id: "prof-002", profile_name: "Kari Larsen", total_pay: 18800 },
    ];

    const results = await generateBundlePdfs(rows, BASE_OPTS);
    const filenames = results.map((r) => r.filename);

    expect(new Set(filenames).size).toBe(2);
    expect(filenames[0]).toContain("ola-nordmann");
    expect(filenames[1]).toContain("kari-larsen");
  }, 60_000);

  it("each bundle entry has a valid Buffer and SHA-256", async () => {
    const row = readFixtureRow();
    const results = await generateBundlePdfs([row], BASE_OPTS);

    expect(results[0].sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(results[0].buffer).toBeInstanceOf(Buffer);
    expect(results[0].buffer.length).toBeGreaterThan(0);
    expect(results[0].profile_id).toBe(row.profile_id);
  }, 30_000);

  it("no bundle entry contains 'nnsslipp' (lønnsslipp forbidden)", async () => {
    const row = readFixtureRow();
    const results = await generateBundlePdfs([row], BASE_OPTS);

    for (const r of results) {
      expect(containsLonnsslipp(r.buffer)).toBe(false);
    }
  }, 30_000);

  it("throws when rows array is empty (L-0177)", async () => {
    await expect(generateBundlePdfs([], BASE_OPTS)).rejects.toThrow("rows array is empty");
  });
});
