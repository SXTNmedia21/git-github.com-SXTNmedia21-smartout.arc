import { describe, it, expect } from "vitest";
import {
  validateDecision,
  applyDecision,
  describeField,
  countUnreviewedFields,
  unreviewedFieldKeys,
  type ReviewContext,
  type FieldDecision,
} from "../../scripts/lib/review.js";
import type { Mapping } from "../../src/research/mapping.js";
import type { V3Schema, V3Table } from "../../src/research/v3_schema.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────

function makeV3Table(columns: Record<string, { type?: string; nullable?: boolean; is_array?: boolean }>): V3Table {
  return {
    schema: "public",
    name: "shift",
    qualified_name: "public.shift",
    columns: Object.fromEntries(
      Object.entries(columns).map(([name, opts]) => [
        name,
        {
          name,
          type: opts.type ?? "text",
          nullable: opts.nullable ?? true,
          is_primary_key: name.endsWith("_id"),
          is_array: opts.is_array ?? false,
          default_expr: null,
          foreign_key: null,
        },
      ]),
    ),
  };
}

function makeV3Schema(tables: Record<string, V3Table> = {}): V3Schema {
  return {
    tables,
    computed_at: "2026-04-07T12:00:00.000Z",
    schema_hash: "a".repeat(64),
    source_file_count: 10,
  };
}

function makeMapping(overrides: Partial<Mapping> = {}): Mapping {
  return {
    entity: "shift",
    bubble_type: "shift_satellite",
    target_table: "public.shift",
    field_map: {
      "date.start": {
        target: "starts_at",
        transform: null,
        needs_review: true,
        source_value_types: ["string"],
        occurrence_count: 50,
        sample_values: ["string<24>"],
      },
      name: {
        target: "name",
        transform: null,
        needs_review: false,
        source_value_types: ["string"],
        occurrence_count: 50,
        sample_values: ["string<10>"],
      },
      "optional_field": {
        target: "notes",
        transform: null,
        needs_review: true,
        source_value_types: ["string"],
        occurrence_count: 25,  // Only 25 of 50 records have this
        sample_values: ["string<5>"],
      },
    },
    required_source_fields: [],
    skip_if_missing: [],
    known_quirks: [],
    last_verified: "2026-04-07",
    sample_record_count: 50,
    total_record_count: 500,
    v3_schema_hash: null,
    ...overrides,
  };
}

function makeCtx(overrides: Partial<ReviewContext> = {}): ReviewContext {
  const mapping = overrides.mapping ?? makeMapping();
  const v3Table = makeV3Table({
    shift_id: { type: "uuid", nullable: false },
    starts_at: { type: "timestamptz", nullable: false },
    ends_at: { type: "timestamptz", nullable: true },
    name: { type: "text", nullable: false },
    notes: { type: "text", nullable: true },
  });
  const v3Schema = makeV3Schema({ "public.shift": v3Table });

  return {
    mapping,
    v3Schema,
    sidecar: null,
    ...overrides,
  };
}

// ─── validateDecision tests ────────────────────────────────────────────────

describe("validateDecision", () => {
  it("accepts a field with valid target and 100% occurrence on NOT NULL column", () => {
    const ctx = makeCtx();
    // date.start → starts_at, 50/50 = 100%, NOT NULL in v3
    const decision: FieldDecision = { fieldKey: "date.start", action: "accept" };
    const result = validateDecision(decision, ctx);
    expect(result.valid).toBe(true);
    expect(result.warning).toBeUndefined();
  });

  it("warns when NOT NULL v3 column has nullable source (< 100% occurrence)", () => {
    // Make starts_at NOT NULL but date.start only 25/50
    const mapping = makeMapping({
      field_map: {
        "date.start": {
          target: "starts_at",
          transform: null,
          needs_review: true,
          source_value_types: ["string"],
          occurrence_count: 25,  // Only 50%
          sample_values: ["string<24>"],
        },
      },
    });
    const ctx = makeCtx({ mapping });
    const decision: FieldDecision = { fieldKey: "date.start", action: "accept" };
    const result = validateDecision(decision, ctx);
    expect(result.valid).toBe(true);
    expect(result.warning).toContain("NOT NULL");
    expect(result.warning).toContain("50.0%");
  });

  it("rejects Accept when target column does not exist in v3 table", () => {
    const mapping = makeMapping({
      field_map: {
        phantom: {
          target: "nonexistent_column",
          transform: null,
          needs_review: true,
          source_value_types: ["string"],
          occurrence_count: 50,
          sample_values: ["string<5>"],
        },
      },
    });
    const ctx = makeCtx({ mapping });
    const decision: FieldDecision = { fieldKey: "phantom", action: "accept" };
    const result = validateDecision(decision, ctx);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("nonexistent_column");
    expect(result.reason).toContain("does not exist");
  });

  it("accepts Skip unconditionally", () => {
    const ctx = makeCtx();
    const result = validateDecision({ fieldKey: "date.start", action: "skip" }, ctx);
    expect(result.valid).toBe(true);
  });

  it("accepts Drop unconditionally", () => {
    const ctx = makeCtx();
    const result = validateDecision({ fieldKey: "date.start", action: "drop" }, ctx);
    expect(result.valid).toBe(true);
  });

  it("accepts Rename with an existing v3 column", () => {
    const ctx = makeCtx();
    const decision: FieldDecision = { fieldKey: "date.start", action: "rename", newTarget: "ends_at" };
    const result = validateDecision(decision, ctx);
    expect(result.valid).toBe(true);
  });

  it("rejects Rename with a non-existent v3 column", () => {
    const ctx = makeCtx();
    const decision: FieldDecision = { fieldKey: "date.start", action: "rename", newTarget: "fake_col" };
    const result = validateDecision(decision, ctx);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("fake_col");
    expect(result.reason).toContain("does not exist");
  });

  it("rejects Rename with an empty newTarget", () => {
    const ctx = makeCtx();
    const decision: FieldDecision = { fieldKey: "date.start", action: "rename", newTarget: "" };
    const result = validateDecision(decision, ctx);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("non-empty");
  });

  it("warns on Rename to NOT NULL column with low occurrence rate", () => {
    const mapping = makeMapping({
      field_map: {
        "date.start": {
          target: "starts_at",
          transform: null,
          needs_review: true,
          source_value_types: ["string"],
          occurrence_count: 10,  // 20%
          sample_values: ["string<5>"],
        },
      },
    });
    const ctx = makeCtx({ mapping });
    // ends_at is nullable, name is NOT NULL
    const decision: FieldDecision = { fieldKey: "date.start", action: "rename", newTarget: "name" };
    const result = validateDecision(decision, ctx);
    expect(result.valid).toBe(true);
    expect(result.warning).toContain("NOT NULL");
  });

  it("returns valid=false for unknown field key", () => {
    const ctx = makeCtx();
    const result = validateDecision({ fieldKey: "does_not_exist", action: "accept" }, ctx);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("does_not_exist");
  });

  it("rejects Accept when target is null", () => {
    const mapping = makeMapping({
      field_map: {
        no_target: {
          target: null,
          transform: null,
          needs_review: true,
          source_value_types: ["string"],
          occurrence_count: 5,
          sample_values: [],
        },
      },
    });
    const ctx = makeCtx({ mapping });
    const result = validateDecision({ fieldKey: "no_target", action: "accept" }, ctx);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("no proposed target");
  });
});

// ─── applyDecision tests ───────────────────────────────────────────────────

describe("applyDecision", () => {
  it("sets target and needs_review=false on Accept", () => {
    const mapping = makeMapping();
    const result = applyDecision(mapping, { fieldKey: "date.start", action: "accept" });
    expect(result.field_map["date.start"].needs_review).toBe(false);
    expect(result.field_map["date.start"].target).toBe("starts_at"); // unchanged
  });

  it("sets target=null and needs_review=false on Skip", () => {
    const mapping = makeMapping();
    const result = applyDecision(mapping, { fieldKey: "date.start", action: "skip" });
    expect(result.field_map["date.start"].needs_review).toBe(false);
    expect(result.field_map["date.start"].target).toBeNull();
  });

  it("sets target=null and needs_review=false on Drop", () => {
    const mapping = makeMapping();
    const result = applyDecision(mapping, { fieldKey: "date.start", action: "drop" });
    expect(result.field_map["date.start"].needs_review).toBe(false);
    expect(result.field_map["date.start"].target).toBeNull();
  });

  it("sets target to newTarget and needs_review=false on Rename", () => {
    const mapping = makeMapping();
    const result = applyDecision(mapping, {
      fieldKey: "date.start",
      action: "rename",
      newTarget: "ends_at",
    });
    expect(result.field_map["date.start"].needs_review).toBe(false);
    expect(result.field_map["date.start"].target).toBe("ends_at");
  });

  it("does not mutate the original mapping (pure)", () => {
    const mapping = makeMapping();
    applyDecision(mapping, { fieldKey: "date.start", action: "accept" });
    // Original should be unchanged
    expect(mapping.field_map["date.start"].needs_review).toBe(true);
  });

  it("leaves other fields unchanged", () => {
    const mapping = makeMapping();
    const result = applyDecision(mapping, { fieldKey: "date.start", action: "accept" });
    // name field should be untouched
    expect(result.field_map["name"]).toEqual(mapping.field_map["name"]);
    expect(result.field_map["optional_field"]).toEqual(mapping.field_map["optional_field"]);
  });

  it("returns mapping unchanged for unknown field key", () => {
    const mapping = makeMapping();
    const result = applyDecision(mapping, { fieldKey: "nonexistent", action: "accept" });
    expect(result).toEqual(mapping);
  });
});

// ─── describeField tests ────────────────────────────────────────────────────

describe("describeField", () => {
  it("includes field name in output", () => {
    const ctx = makeCtx();
    const desc = describeField("date.start", ctx);
    expect(desc).toContain("date.start");
  });

  it("shows occurrence rate as percentage", () => {
    const ctx = makeCtx();
    const desc = describeField("date.start", ctx);
    expect(desc).toContain("50/50");
    expect(desc).toContain("100%");
  });

  it("shows proposed target column", () => {
    const ctx = makeCtx();
    const desc = describeField("date.start", ctx);
    expect(desc).toContain("starts_at");
  });

  it("shows v3 schema type info when available", () => {
    const ctx = makeCtx();
    const desc = describeField("date.start", ctx);
    expect(desc).toContain("timestamptz");
    expect(desc).toContain("NOT NULL");
  });

  it("warns when target column does not exist in v3 table", () => {
    const mapping = makeMapping({
      field_map: {
        ghost: {
          target: "missing_col",
          transform: null,
          needs_review: true,
          source_value_types: ["string"],
          occurrence_count: 5,
          sample_values: [],
        },
      },
    });
    const ctx = makeCtx({ mapping });
    const desc = describeField("ghost", ctx);
    expect(desc).toContain("does NOT exist");
    expect(desc).toContain("missing_col");
  });

  it("shows raw sidecar values when sidecar is provided", () => {
    const ctx = makeCtx({
      sidecar: { "date.start": ["2026-03-15T10:00:00.000Z", "2026-03-16T09:00:00.000Z"] },
    });
    const desc = describeField("date.start", ctx);
    expect(desc).toContain("sidecar");
    expect(desc).toContain("2026-03-15T10:00:00.000Z");
  });

  it("returns error text for unknown field key", () => {
    const ctx = makeCtx();
    const desc = describeField("unknown_field", ctx);
    expect(desc).toContain("not found");
  });
});

// ─── countUnreviewedFields / unreviewedFieldKeys ────────────────────────────

describe("countUnreviewedFields", () => {
  it("counts fields with needs_review=true", () => {
    const mapping = makeMapping();
    // date.start and optional_field need review; name does not
    expect(countUnreviewedFields(mapping)).toBe(2);
  });

  it("returns 0 when all fields are reviewed", () => {
    const mapping = makeMapping({
      field_map: {
        name: {
          target: "name",
          transform: null,
          needs_review: false,
          source_value_types: ["string"],
          occurrence_count: 50,
          sample_values: [],
        },
      },
    });
    expect(countUnreviewedFields(mapping)).toBe(0);
  });
});

describe("unreviewedFieldKeys", () => {
  it("returns sorted list of keys needing review", () => {
    const mapping = makeMapping();
    const keys = unreviewedFieldKeys(mapping);
    // date.start and optional_field, sorted alphabetically
    expect(keys).toEqual(["date.start", "optional_field"]);
  });
});
