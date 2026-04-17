import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

export interface FieldMapEntry {
  target: string | null;
  transform: string | null;
  needs_review: boolean;
  source_value_types: string[];
  occurrence_count: number;
  sample_values: unknown[];
  sample_value_mode?: "redacted" | "sidecar" | "raw";
}

/**
 * Derived column: produces a v3 column value from another Bubble field via a transform.
 * Used when one Bubble field needs to populate two v3 columns (e.g., Titel → name AND slug).
 * `from` references a Bubble source field; `transform` is a registered transform name.
 */
export interface DerivedColumn {
  from: string;
  transform: string;
}

export interface Mapping {
  entity: string;
  bubble_type: string;
  target_table: string | null;
  field_map: Record<string, FieldMapEntry>;
  /** v3 columns derived from a Bubble source field via a transform (e.g. slug from name). */
  derived_columns?: Record<string, DerivedColumn>;
  /** v3 columns set to a literal constant per migration run (e.g. source='bubble_migration'). */
  constant_columns?: Record<string, string | number | boolean | null>;
  /**
   * v3 jsonb column that captures the entire Bubble source record per row.
   * Engine assigns the raw record object after field_map / derived / constant
   * processing, then SQL emitter JSON.stringifies it. ADR-0005.
   */
  raw_json_target?: string;
  required_source_fields: string[];
  skip_if_missing: string[];
  known_quirks: string[];
  last_verified: string;
  sample_record_count: number;
  total_record_count: number | null;
  v3_schema_hash: string | null;
  approval_hash?: string;
  known_empty_source?: boolean;
  attested_by?: string;
  attested_on?: string;
}

export interface FieldStat {
  occurrences: number;
  valueTypes: string[];
  sampleValues: unknown[];
}

export interface FieldObservation {
  totalRecords: number;
  fields: Record<string, FieldStat>;
}

export interface DiffResult {
  newFields: string[];
  disappearedFields: string[];
  typeChanges: Array<{
    field: string;
    before: string[];
    after: string[];
  }>;
}

export async function loadMapping(
  mappingsDir: string,
  entity: string,
): Promise<Mapping | null> {
  const path = join(mappingsDir, `${entity}.json`);
  try {
    const content = await readFile(path, "utf-8");
    return JSON.parse(content) as Mapping;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw err;
  }
}

export async function saveMapping(
  mappingsDir: string,
  mapping: Mapping,
): Promise<void> {
  await mkdir(mappingsDir, { recursive: true });
  const path = join(mappingsDir, `${mapping.entity}.json`);
  await writeFile(path, JSON.stringify(mapping, null, 2) + "\n", "utf-8");
}

/**
 * Returns true if the mapping-level attestation gate is triggered:
 * sample_record_count is 0 AND known_empty_source is not set to true.
 */
export function hasMappingLevelReview(mapping: Mapping): boolean {
  return mapping.sample_record_count === 0 && !mapping.known_empty_source;
}

/**
 * Returns true if any field needs review OR if the mapping-level
 * zero-records attestation gate is triggered.
 */
export function hasUnreviewedFields(mapping: Mapping): boolean {
  if (hasMappingLevelReview(mapping)) return true;
  return Object.values(mapping.field_map).some((f) => f.needs_review);
}
