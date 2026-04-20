import type {
  FieldMapEntry,
  FieldObservation,
  Mapping,
} from "./mapping.js";

/**
 * Normalize a Bubble field key into a canonical target column name.
 * - Lowercases
 * - Strips emoji and any non [a-z0-9_ .-] characters
 * - Replaces spaces, dots, and dashes with underscores
 * - Collapses runs of underscores into a single underscore
 * - Trims leading/trailing underscores
 */
export function normalizeKey(key: string): string {
  return key
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function todayIso(): string {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Pure function: produce an updated Mapping by merging a new FieldObservation
 * into an existing Mapping.
 *
 * Rules:
 * - Fields present in both existing mapping and observation:
 *   PRESERVE human decisions (target, transform, needs_review).
 *   REFRESH source_value_types, occurrence_count, sample_values from observation.
 * - Fields newly seen in observation (not in existing mapping):
 *   PROPOSE a normalized target name, mark needs_review: true.
 * - Fields present in existing mapping but absent from observation:
 *   PRESERVE as-is (diff reporting handles disappearance separately).
 * - Updates last_verified to today (UTC, YYYY-MM-DD).
 * - Updates sample_record_count to the provided value.
 */
export function propose(
  existing: Mapping,
  obs: FieldObservation,
  sampleRecordCount: number,
): Mapping {
  const nextFieldMap: Record<string, FieldMapEntry> = {};

  // Carry over every existing field first (preserves disappeared fields).
  for (const [key, entry] of Object.entries(existing.field_map)) {
    nextFieldMap[key] = { ...entry, sample_values: [...entry.sample_values], source_value_types: [...entry.source_value_types] };
  }

  for (const [key, stat] of Object.entries(obs.fields)) {
    const prior = existing.field_map[key];
    if (prior) {
      nextFieldMap[key] = {
        target: prior.target,
        transform: prior.transform,
        needs_review: prior.needs_review,
        source_value_types: [...stat.valueTypes],
        occurrence_count: stat.occurrences,
        sample_values: [...stat.sampleValues],
      };
    } else {
      nextFieldMap[key] = {
        target: normalizeKey(key),
        transform: null,
        needs_review: true,
        source_value_types: [...stat.valueTypes],
        occurrence_count: stat.occurrences,
        sample_values: [...stat.sampleValues],
      };
    }
  }

  return {
    ...existing,
    field_map: nextFieldMap,
    last_verified: todayIso(),
    sample_record_count: sampleRecordCount,
  };
}
