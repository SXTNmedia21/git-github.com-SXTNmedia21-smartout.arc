import { describe, it, expect } from "vitest";
import { diff } from "../../src/research/diff.js";
import type {
  Mapping,
  FieldObservation,
  FieldMapEntry,
} from "../../src/research/mapping.js";

function entry(partial: Partial<FieldMapEntry> = {}): FieldMapEntry {
  return {
    target: null,
    transform: null,
    needs_review: false,
    source_value_types: ["string"],
    occurrence_count: 1,
    sample_values: [],
    ...partial,
  };
}

function mapping(field_map: Record<string, FieldMapEntry>): Mapping {
  return {
    entity: "workspace",
    bubble_type: "workspace",
    target_table: null,
    field_map,
    required_source_fields: [],
    skip_if_missing: [],
    known_quirks: [],
    last_verified: "2026-04-07",
    sample_record_count: 0,
    total_record_count: null,
  };
}

function obs(
  fields: Record<string, { valueTypes: string[] }>,
): FieldObservation {
  return {
    totalRecords: 1,
    fields: Object.fromEntries(
      Object.entries(fields).map(([k, v]) => [
        k,
        { occurrences: 1, valueTypes: v.valueTypes, sampleValues: [] },
      ]),
    ),
  };
}

describe("diff", () => {
  it("returns empty result when mapping and observation match", () => {
    const m = mapping({
      name: entry({ source_value_types: ["string"] }),
      age: entry({ source_value_types: ["number"] }),
    });
    const o = obs({
      name: { valueTypes: ["string"] },
      age: { valueTypes: ["number"] },
    });
    expect(diff(m, o)).toEqual({
      newFields: [],
      disappearedFields: [],
      typeChanges: [],
    });
  });

  it("detects new fields in observation but not in mapping", () => {
    const m = mapping({ name: entry() });
    const o = obs({
      name: { valueTypes: ["string"] },
      email: { valueTypes: ["string"] },
      created: { valueTypes: ["string"] },
    });
    const result = diff(m, o);
    expect(result.newFields).toEqual(["created", "email"]);
    expect(result.disappearedFields).toEqual([]);
    expect(result.typeChanges).toEqual([]);
  });

  it("detects disappeared fields in mapping but not in observation", () => {
    const m = mapping({
      name: entry(),
      legacy_a: entry(),
      legacy_b: entry(),
    });
    const o = obs({ name: { valueTypes: ["string"] } });
    const result = diff(m, o);
    expect(result.newFields).toEqual([]);
    expect(result.disappearedFields).toEqual(["legacy_a", "legacy_b"]);
    expect(result.typeChanges).toEqual([]);
  });

  it("detects type changes for fields present in both", () => {
    const m = mapping({
      name: entry({ source_value_types: ["string"] }),
      count: entry({ source_value_types: ["number"] }),
    });
    const o = obs({
      name: { valueTypes: ["string"] },
      count: { valueTypes: ["string"] },
    });
    const result = diff(m, o);
    expect(result.newFields).toEqual([]);
    expect(result.disappearedFields).toEqual([]);
    expect(result.typeChanges).toEqual([
      { field: "count", before: ["number"], after: ["string"] },
    ]);
  });

  it("treats value type sets as order-independent", () => {
    const m = mapping({
      mixed: entry({ source_value_types: ["string", "number"] }),
    });
    const o = obs({ mixed: { valueTypes: ["number", "string"] } });
    expect(diff(m, o).typeChanges).toEqual([]);
  });

  it("detects type change when observation has additional type", () => {
    const m = mapping({
      mixed: entry({ source_value_types: ["string"] }),
    });
    const o = obs({ mixed: { valueTypes: ["string", "null"] } });
    expect(diff(m, o).typeChanges).toEqual([
      { field: "mixed", before: ["string"], after: ["null", "string"] },
    ]);
  });

  it("handles combined new, disappeared, and type-changed fields", () => {
    const m = mapping({
      keep: entry({ source_value_types: ["string"] }),
      change: entry({ source_value_types: ["string"] }),
      gone: entry({ source_value_types: ["string"] }),
    });
    const o = obs({
      keep: { valueTypes: ["string"] },
      change: { valueTypes: ["number"] },
      fresh: { valueTypes: ["string"] },
    });
    const result = diff(m, o);
    expect(result.newFields).toEqual(["fresh"]);
    expect(result.disappearedFields).toEqual(["gone"]);
    expect(result.typeChanges).toEqual([
      { field: "change", before: ["string"], after: ["number"] },
    ]);
  });

  it("returns empty observation against empty mapping", () => {
    const m = mapping({});
    const o = obs({});
    expect(diff(m, o)).toEqual({
      newFields: [],
      disappearedFields: [],
      typeChanges: [],
    });
  });
});
