/**
 * review.ts — Testable core logic for Phase 3.5b mapping review CLI.
 *
 * Provides pure functions for validating field decisions against v3 schema
 * constraints, applying decisions to mappings, and generating human-readable
 * field descriptions for the interactive review loop.
 */

import type { Mapping, FieldMapEntry } from "../../src/research/mapping.js";
import type { V3Schema, V3Table } from "../../src/research/v3_schema.js";

// ─── Public interfaces ────────────────────────────────────────────────────

export interface ReviewContext {
  mapping: Mapping;
  v3Schema: V3Schema;
  /** Raw sidecar data keyed by field name. null if sidecar not available. */
  sidecar: Record<string, unknown[]> | null;
}

export type FieldAction = "accept" | "skip" | "rename" | "drop";

export interface FieldDecision {
  fieldKey: string;
  action: FieldAction;
  /** Required for "rename" action; the new target column name. */
  newTarget?: string;
  /** Optional free-text reason; surfaced to the audit trail by the CLI. */
  reasoning?: string;
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
  warning?: string;
}

// ─── Internal helpers ──────────────────────────────────────────────────────

/**
 * Resolve the target v3 table for this mapping.
 * Returns null if target_table is not set.
 */
function resolveV3Table(ctx: ReviewContext): V3Table | null {
  if (!ctx.mapping.target_table) return null;
  return ctx.v3Schema.tables[ctx.mapping.target_table] ?? null;
}

/**
 * Compute the occurrence rate (0–1) of a field in the mapping.
 * Returns null if sample_record_count is 0.
 */
function occurrenceRate(
  entry: FieldMapEntry,
  sampleRecordCount: number,
): number | null {
  if (sampleRecordCount === 0) return null;
  return entry.occurrence_count / sampleRecordCount;
}

/**
 * Check if a column exists in a v3 table.
 */
function columnExistsInTable(table: V3Table, columnName: string): boolean {
  return columnName in table.columns;
}

// ─── Core functions ────────────────────────────────────────────────────────

/**
 * Validate a field decision against the v3 schema.
 *
 * Returns:
 * - { valid: false, reason } — decision is blocked (e.g. target doesn't exist)
 * - { valid: true, warning } — decision is allowed but has a warning
 * - { valid: true } — decision is clean
 */
export function validateDecision(
  decision: FieldDecision,
  ctx: ReviewContext,
): ValidationResult {
  const { action, fieldKey, newTarget } = decision;
  const entry = ctx.mapping.field_map[fieldKey];

  if (!entry) {
    return { valid: false, reason: `Field "${fieldKey}" not found in mapping` };
  }

  const v3Table = resolveV3Table(ctx);

  // Skip and Drop are always valid (human is explicitly deciding not to map)
  if (action === "skip" || action === "drop") {
    return { valid: true };
  }

  if (action === "accept") {
    const proposedTarget = entry.target;

    // If no target is proposed, can't accept
    if (!proposedTarget) {
      return {
        valid: false,
        reason: `Field "${fieldKey}" has no proposed target. Use Rename to set one.`,
      };
    }

    // If a v3 table is resolved, validate the target column exists
    if (v3Table) {
      if (!columnExistsInTable(v3Table, proposedTarget)) {
        return {
          valid: false,
          reason: `Target column "${proposedTarget}" does not exist in ${ctx.mapping.target_table}. Use Rename or Skip.`,
        };
      }

      // Check NOT NULL compatibility
      const v3Col = v3Table.columns[proposedTarget];
      if (v3Col && !v3Col.nullable) {
        const rate = occurrenceRate(entry, ctx.mapping.sample_record_count);
        if (rate !== null && rate < 1) {
          const pct = (rate * 100).toFixed(1);
          return {
            valid: true,
            warning: `v3 column "${proposedTarget}" is NOT NULL but only ${pct}% of source records have a value. Consider Rename or Drop.`,
          };
        }
      }
    }

    return { valid: true };
  }

  if (action === "rename") {
    if (!newTarget || newTarget.trim() === "") {
      return { valid: false, reason: "Rename requires a non-empty newTarget column name." };
    }

    const colName = newTarget.trim();

    // If a v3 table is resolved, validate the renamed target exists
    if (v3Table) {
      if (!columnExistsInTable(v3Table, colName)) {
        return {
          valid: false,
          reason: `Column "${colName}" does not exist in ${ctx.mapping.target_table}. Available: ${Object.keys(v3Table.columns).join(", ")}`,
        };
      }

      // Check NOT NULL compatibility for the renamed target
      const v3Col = v3Table.columns[colName];
      if (v3Col && !v3Col.nullable) {
        const rate = occurrenceRate(entry, ctx.mapping.sample_record_count);
        if (rate !== null && rate < 1) {
          const pct = (rate * 100).toFixed(1);
          return {
            valid: true,
            warning: `v3 column "${colName}" is NOT NULL but only ${pct}% of source records have a value.`,
          };
        }
      }
    }

    return { valid: true };
  }

  return { valid: false, reason: `Unknown action "${action as string}"` };
}

/**
 * Apply a field decision to a mapping. Pure — returns a new Mapping.
 * Caller must persist the returned mapping to disk.
 */
export function applyDecision(mapping: Mapping, decision: FieldDecision): Mapping {
  const { fieldKey, action, newTarget } = decision;
  const existingEntry = mapping.field_map[fieldKey];
  if (!existingEntry) return mapping;

  let updatedEntry: FieldMapEntry;

  switch (action) {
    case "accept":
      updatedEntry = { ...existingEntry, needs_review: false };
      break;

    case "skip":
    case "drop":
      updatedEntry = { ...existingEntry, target: null, needs_review: false };
      break;

    case "rename":
      updatedEntry = {
        ...existingEntry,
        target: newTarget?.trim() ?? null,
        needs_review: false,
      };
      break;

    default:
      return mapping;
  }

  return {
    ...mapping,
    field_map: {
      ...mapping.field_map,
      [fieldKey]: updatedEntry,
    },
  };
}

/**
 * Build the human-readable description block shown per field during review.
 *
 * Example output:
 *   Field: "date.start" [needs review]
 *   Types observed: [string]
 *   Occurrences: 500/500 (100%)
 *   Sample values (redacted): ["string<24>", "string<24>"]
 *   Sample values (raw, sidecar): ["2026-03-15T10:00:00.000Z", ...]
 *
 *   Proposed target: starts_at
 *   v3 column: public.shift.starts_at (timestamptz, NOT NULL)
 *   ⚠ v3 column is NOT NULL — source occurrence rate: 100% ✓
 */
export function describeField(fieldKey: string, ctx: ReviewContext): string {
  const entry = ctx.mapping.field_map[fieldKey];
  if (!entry) return `Field "${fieldKey}" not found in mapping.`;

  const lines: string[] = [];

  // Header
  const reviewFlag = entry.needs_review ? " [needs review]" : "";
  lines.push(`Field: "${fieldKey}"${reviewFlag}`);

  // Types and occurrences
  lines.push(`Types observed: [${entry.source_value_types.join(", ")}]`);
  const total = ctx.mapping.sample_record_count;
  if (total > 0) {
    const pct = ((entry.occurrence_count / total) * 100).toFixed(0);
    lines.push(`Occurrences: ${entry.occurrence_count}/${total} (${pct}%)`);
  } else {
    lines.push(`Occurrences: ${entry.occurrence_count}`);
  }

  // Sample values (redacted)
  if (entry.sample_values.length > 0) {
    const redacted = entry.sample_values.map((v) => JSON.stringify(v)).join(", ");
    lines.push(`Sample values (redacted): [${redacted}]`);
  }

  // Raw sidecar values (if available)
  if (ctx.sidecar) {
    const raw = ctx.sidecar[fieldKey];
    if (raw && raw.length > 0) {
      const rawStr = raw.slice(0, 3).map((v) => JSON.stringify(v)).join(", ");
      lines.push(`Sample values (raw, sidecar): [${rawStr}]`);
    }
  }

  lines.push("");

  // Proposed target and v3 schema info
  const proposedTarget = entry.target;
  if (proposedTarget) {
    lines.push(`Proposed target: ${proposedTarget}`);

    const v3Table = resolveV3Table(ctx);
    if (v3Table && proposedTarget in v3Table.columns) {
      const col = v3Table.columns[proposedTarget];
      const nullText = col.nullable ? "nullable" : "NOT NULL";
      const arrayText = col.is_array ? "[]" : "";
      lines.push(
        `v3 column: ${ctx.mapping.target_table}.${proposedTarget} (${col.type}${arrayText}, ${nullText})`,
      );

      // Nullability warning
      if (!col.nullable) {
        const rate = occurrenceRate(entry, total);
        if (rate !== null && rate < 1) {
          const pct = (rate * 100).toFixed(1);
          lines.push(
            `⚠ v3 column is NOT NULL — source occurrence rate: ${pct}% (some records are null)`,
          );
        } else {
          lines.push(`v3 column is NOT NULL — source occurrence rate: 100% ✓`);
        }
      }
    } else if (v3Table) {
      lines.push(
        `⚠ Proposed target "${proposedTarget}" does NOT exist in ${ctx.mapping.target_table}`,
      );
    }
  } else {
    lines.push("Proposed target: (none — will be skipped)");
  }

  return lines.join("\n");
}

/**
 * Count the number of fields in a mapping that still need review.
 */
export function countUnreviewedFields(mapping: Mapping): number {
  return Object.values(mapping.field_map).filter((f) => f.needs_review).length;
}

/**
 * List all field keys that still need review, sorted alphabetically.
 */
export function unreviewedFieldKeys(mapping: Mapping): string[] {
  return Object.entries(mapping.field_map)
    .filter(([, f]) => f.needs_review)
    .map(([key]) => key)
    .sort();
}
