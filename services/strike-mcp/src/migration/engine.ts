import { applyTransform } from "./transforms.js";
import type {
  MigrationContext,
  MigrationResult,
  EmittedRow,
  RecordSkip,
} from "./types.js";
import type { Mapping } from "../research/mapping.js";
import type { BubbleRecord } from "../bubble/types.js";
import { hasUnreviewedFields } from "../research/mapping.js";

export function runEngine(
  mapping: Mapping,
  records: BubbleRecord[],
  ctx: MigrationContext,
): MigrationResult {
  if (mapping.target_table === null) {
    throw new Error(
      `Mapping for "${mapping.entity}" has no target_table. Set it in mappings/${mapping.entity}.json before running migration.`,
    );
  }
  if (hasUnreviewedFields(mapping)) {
    const unreviewed = Object.entries(mapping.field_map)
      .filter(([, f]) => f.needs_review)
      .map(([k]) => k);
    throw new Error(
      `Mapping for "${mapping.entity}" has ${unreviewed.length} unreviewed field(s): ${unreviewed.join(", ")}. Review and set needs_review: false before migrating.`,
    );
  }

  const rows: EmittedRow[] = [];
  const skipped: RecordSkip[] = [];
  const warnings: string[] = [];

  for (const record of records) {
    const recordId = String(record._id ?? "(unknown)");

    // Check required fields
    const missingRequired = mapping.required_source_fields.filter((key) => {
      const v = record[key];
      return v === undefined || v === null || v === "";
    });
    if (missingRequired.length > 0) {
      skipped.push({
        recordId,
        reason: `missing required source field(s): ${missingRequired.join(", ")}`,
      });
      continue;
    }

    // Build the row from mapped fields
    const values: Record<string, unknown> = {};
    let recordError: string | null = null;

    for (const [sourceKey, entry] of Object.entries(mapping.field_map)) {
      if (entry.target === null) continue; // explicitly unmapped — drop
      const sourceValue = record[sourceKey];

      try {
        const transformed = applyTransform(entry.transform, sourceValue);
        values[entry.target] = transformed;
      } catch (err) {
        recordError = `transform error on field "${sourceKey}": ${err instanceof Error ? err.message : String(err)}`;
        break;
      }
    }

    if (recordError !== null) {
      skipped.push({ recordId, reason: recordError });
      continue;
    }

    // Derived columns: read from another Bubble field, apply transform, write to v3 column
    // (e.g. slug from name via slugify). Runs after field_map so derived columns can
    // reference fields whose mapping was applied above.
    for (const [target, deriv] of Object.entries(mapping.derived_columns ?? {})) {
      try {
        const sourceValue = record[deriv.from];
        values[target] = applyTransform(deriv.transform, sourceValue);
      } catch (err) {
        recordError = `derived column "${target}" failed (from="${deriv.from}", transform="${deriv.transform}"): ${err instanceof Error ? err.message : String(err)}`;
        break;
      }
    }

    if (recordError !== null) {
      skipped.push({ recordId, reason: recordError });
      continue;
    }

    // Constant columns: literal values injected on every row (e.g. source='bubble_migration')
    for (const [target, value] of Object.entries(mapping.constant_columns ?? {})) {
      values[target] = value;
    }

    // Raw JSON capture: assign the entire source record to a v3 jsonb column.
    // Used by archive-style targets (e.g. payroll_ledger_archive.raw_json) where
    // audit fidelity to the Bubble source matters more than per-field mapping. ADR-0005.
    if (mapping.raw_json_target) {
      values[mapping.raw_json_target] = record;
    }

    rows.push({ table: mapping.target_table, values });
  }

  return { rows, skipped, warnings };
}
