/**
 * expected-cell.schema.ts
 *
 * WHAT: Zod schemas for golden-month expected fixture files.
 *       Validates the per-cell provenance shape mandated by ADR-0341 v1.1.
 *
 * WHY: F6 acceptance gate — every cell in expected/*.json must carry all
 *      16 schema fields before the cents-exact equality comparison runs.
 *      A missing field fails with golden-month.cell_schema_violation.
 *      Schemas use .strict() to catch extra fields that slip in during
 *      worksheet authoring.
 *
 * Authority separation per ADR-0341:
 *   Pontus  → amount, formula, computedBy, computedAt
 *   Lovsen  → paragrafRef, lovsenCitation*, verifiedBy, verifiedAt
 *   Engine  → system under test; never participates in fixture construction
 */

import { z } from "zod";

// ── Per-cell schema (locked per ADR-0341 §H) ──────────────────────────────────
// 16 fields. .strict() catches any extra keys from worksheet copy-paste.

export const ExpectedCellSchema = z
  .object({
    /** Integer øre (1 NOK = 100 øre). Engine must hit this exactly. */
    amount_ore: z.number().int(),

    /** NOK float for human readability. NOT compared by CI. */
    amount_nok_display: z.number(),

    /** UUID matching supplement_rule.id. null for base-pay cells. */
    supplementRuleId: z.string().nullable(),

    /** Human mnemonic (e.g. "kveldstillegg"). Not parsed by CI. */
    ruleLabel: z.string(),

    /** Human-readable paragraph reference (e.g. "Riksavtalen §6"). null for base-pay. */
    paragrafRef: z.string().nullable(),

    /** SHA-256 of the verbatim paragraph text Lovsen returned (ADR-0256). */
    lovsenCitationHash: z.string(),

    /** Verbatim paragraph text (ADR-0256 citation envelope). */
    lovsenCitationText: z.string(),

    /** Source URL (ADR-0256 audit trail). */
    lovsenCitationUrl: z.string(),

    /** ISO-8601 timestamp when Lovsen MCP fetched the paragraph text. */
    lovsenCitationFetchedAt: z.string(),

    /** UUID matching tariff_rate_table.id. null for cells with no tariff row. */
    tariffRateTableId: z.string().nullable(),

    /** Matches TariffRateInput.law_version (e.g. "2026"). null for non-tariff cells. */
    tariffLawVersion: z.string().nullable(),

    /** Human-readable derivation (e.g. "179 min × 70 øre/min = 12530 øre"). */
    formula: z.string(),

    /** Pontus authority: who computed (e.g. "pontus@smartout.no" or "PENDING_PONTUS_SIGN"). */
    computedBy: z.string(),

    /** Pontus authority: ISO-8601 when computed. */
    computedAt: z.string(),

    /** Lovsen authority: which Lovsen version certified (e.g. "lovsen-mcp@v1" or "PENDING_LOVSEN_CERTIFY"). */
    verifiedBy: z.string(),

    /** Lovsen authority: ISO-8601 when certified. */
    verifiedAt: z.string(),
  })
  .strict();

export type ExpectedCell = z.infer<typeof ExpectedCellSchema>;

// ── Container schemas — one per expected/*.json file ─────────────────────────
// Each surface wraps its cells in a typed container so the test runner can
// navigate by shiftId / profileId without scanning flat arrays.

export const ShiftSnapshotsSchema = z
  .object({
    shift_snapshots: z.array(
      z
        .object({
          shiftId: z.string(),
          profileId: z.string(),
          cells: z.array(ExpectedCellSchema),
        })
        .strict(),
    ),
  })
  .strict();

export type ShiftSnapshots = z.infer<typeof ShiftSnapshotsSchema>;

export const AggregatedPeriodsSchema = z
  .object({
    aggregated_periods: z.array(
      z
        .object({
          profileId: z.string(),
          periodStart: z.string(),
          periodEnd: z.string(),
          cells: z.array(ExpectedCellSchema),
        })
        .strict(),
    ),
  })
  .strict();

export type AggregatedPeriods = z.infer<typeof AggregatedPeriodsSchema>;

export const PayrollLinesSchema = z
  .object({
    payroll_lines: z.array(
      z
        .object({
          profileId: z.string(),
          periodStart: z.string(),
          periodEnd: z.string(),
          lines: z.array(ExpectedCellSchema),
        })
        .strict(),
    ),
  })
  .strict();

export type PayrollLines = z.infer<typeof PayrollLinesSchema>;

export const TimebankEntriesSchema = z
  .object({
    timebank_entries: z.array(
      z
        .object({
          profileId: z.string(),
          periodStart: z.string(),
          periodEnd: z.string(),
          entries: z.array(ExpectedCellSchema),
        })
        .strict(),
    ),
  })
  .strict();

export type TimebankEntries = z.infer<typeof TimebankEntriesSchema>;

export const DeviationsSchema = z
  .object({
    deviations: z.array(
      z
        .object({
          profileId: z.string(),
          periodStart: z.string(),
          periodEnd: z.string(),
          cells: z.array(ExpectedCellSchema),
        })
        .strict(),
    ),
  })
  .strict();

export type Deviations = z.infer<typeof DeviationsSchema>;
