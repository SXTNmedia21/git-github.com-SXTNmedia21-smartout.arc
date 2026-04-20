import type { BubbleRecord } from "../bubble/types.js";
import type { FieldObservation, FieldStat } from "./mapping.js";

export type { FieldObservation, FieldStat } from "./mapping.js";

export type ObserveMode = "redacted" | "sidecar" | "raw";

function valueType(value: unknown): string {
  if (Array.isArray(value)) return "array";
  if (typeof value === "object") return "object";
  return typeof value;
}

/**
 * Produce a type-only redacted representation of a value for safe git storage.
 * - strings → "string<N>" where N is the length
 * - arrays  → "array<N>" where N is the element count
 * - numbers → "number"
 * - booleans → "boolean"
 * - objects → "object"
 */
function redact(value: unknown): string {
  if (typeof value === "string") return `string<${value.length}>`;
  if (Array.isArray(value)) return `array<${value.length}>`;
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "object") return "object";
  return String(typeof value);
}

function collectStats(records: BubbleRecord[]): Record<
  string,
  {
    occurrences: number;
    valueTypes: Set<string>;
    rawValues: unknown[];
    rawKeys: Set<string>;
  }
> {
  const fields: Record<
    string,
    { occurrences: number; valueTypes: Set<string>; rawValues: unknown[]; rawKeys: Set<string> }
  > = {};

  for (const record of records) {
    for (const [key, value] of Object.entries(record)) {
      if (value === null || value === undefined) continue;

      let stat = fields[key];
      if (!stat) {
        stat = {
          occurrences: 0,
          valueTypes: new Set<string>(),
          rawValues: [],
          rawKeys: new Set<string>(),
        };
        fields[key] = stat;
      }

      stat.occurrences += 1;
      stat.valueTypes.add(valueType(value));

      if (stat.rawValues.length < 3) {
        let sampleKey: string;
        try {
          sampleKey = JSON.stringify(value);
        } catch {
          sampleKey = String(value);
        }
        if (!stat.rawKeys.has(sampleKey)) {
          stat.rawKeys.add(sampleKey);
          stat.rawValues.push(value);
        }
      }
    }
  }

  return fields;
}

/**
 * Pure function: characterize a set of Bubble records by counting field
 * occurrences, capturing distinct value types, and collecting sample values.
 *
 * mode controls how sample values are stored:
 * - "redacted" (default): replace raw values with type signatures like "string<24>"
 * - "raw": preserve raw values (PII risk — do not commit to git)
 * - "sidecar": same as redacted in the main output (raw values handled separately via observeWithSidecar)
 *
 * null and undefined values are treated as non-occurrence.
 * valueTypes is deduped and sorted alphabetically.
 * sampleValues holds up to 3 distinct values (deduped by JSON serialization).
 */
export function observe(records: BubbleRecord[], mode: ObserveMode = "redacted"): FieldObservation {
  const fields = collectStats(records);

  const out: Record<string, FieldStat> = {};
  for (const [key, stat] of Object.entries(fields)) {
    const sampleValues =
      mode === "raw"
        ? stat.rawValues
        : stat.rawValues.map(redact);

    out[key] = {
      occurrences: stat.occurrences,
      valueTypes: [...stat.valueTypes].sort(),
      sampleValues,
    };
  }

  return {
    totalRecords: records.length,
    fields: out,
  };
}

/**
 * Like observe(), but also returns raw values keyed by field name.
 * The returned sidecar should be saved via saveSidecar() to a gitignored .local/ dir.
 */
export function observeWithSidecar(
  records: BubbleRecord[],
  mode: ObserveMode = "redacted",
): { observation: FieldObservation; sidecar: Record<string, unknown[]> } {
  const fields = collectStats(records);
  const sidecar: Record<string, unknown[]> = {};

  const out: Record<string, FieldStat> = {};
  for (const [key, stat] of Object.entries(fields)) {
    sidecar[key] = [...stat.rawValues];

    const sampleValues =
      mode === "raw"
        ? stat.rawValues
        : stat.rawValues.map(redact);

    out[key] = {
      occurrences: stat.occurrences,
      valueTypes: [...stat.valueTypes].sort(),
      sampleValues,
    };
  }

  return {
    observation: { totalRecords: records.length, fields: out },
    sidecar,
  };
}
