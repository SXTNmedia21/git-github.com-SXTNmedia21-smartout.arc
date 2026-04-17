import { describe, it, expect } from "vitest";
import { runEngine } from "../../src/migration/engine.js";
import { strikeUuid } from "../../src/migration/uuid.js";
import type { Mapping } from "../../src/research/mapping.js";
import type { BubbleRecord } from "../../src/bubble/types.js";

function mkMapping(overrides?: Partial<Mapping>): Mapping {
  return {
    entity: "workspaces",
    bubble_type: "workspace",
    target_table: "workspaces",
    field_map: {
      _id: {
        target: "id",
        transform: "fk_uuid:workspaces",
        needs_review: false,
        source_value_types: ["string"],
        occurrence_count: 100,
        sample_values: [],
      },
      name_text: {
        target: "name",
        transform: "trim",
        needs_review: false,
        source_value_types: ["string"],
        occurrence_count: 100,
        sample_values: [],
      },
      "Created Date": {
        target: "created_at",
        transform: "bubble_date_to_tstz",
        needs_review: false,
        source_value_types: ["string"],
        occurrence_count: 100,
        sample_values: [],
      },
    },
    required_source_fields: ["_id", "name_text"],
    skip_if_missing: [],
    known_quirks: [],
    last_verified: "2026-04-07",
    sample_record_count: 100,
    total_record_count: 100,
    ...overrides,
  };
}

describe("runEngine", () => {
  it("emits one row per record with mapped + transformed fields", () => {
    const mapping = mkMapping();
    const records: BubbleRecord[] = [
      {
        _id: "1612345678901x111111111111111111",
        name_text: "  Strøm Mat & Bar  ",
        "Created Date": "2023-01-15T10:00:00.000Z",
      },
      {
        _id: "1612345678902x222222222222222222",
        name_text: "Kafé Ost",
        "Created Date": "2023-02-01T09:00:00.000Z",
      },
    ];

    const result = runEngine(mapping, records, {
      workspaceId: "irrelevant",
      workspaceSlug: "irrelevant",
      mapping,
      companyId: null,
    });

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].table).toBe("workspaces");
    expect(result.rows[0].values).toEqual({
      id: strikeUuid("workspaces", "1612345678901x111111111111111111"),
      name: "Strøm Mat & Bar",
      created_at: "2023-01-15T10:00:00.000Z",
    });
    expect(result.skipped).toEqual([]);
  });

  it("skips records missing required source fields", () => {
    const mapping = mkMapping();
    const records: BubbleRecord[] = [
      { _id: "a", name_text: "Has name" },
      { _id: "b" }, // missing name_text
    ];

    const result = runEngine(mapping, records, {
      workspaceId: "irrelevant",
      workspaceSlug: "irrelevant",
      mapping,
      companyId: null,
    });

    expect(result.rows).toHaveLength(1);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].recordId).toBe("b");
    expect(result.skipped[0].reason).toMatch(/required.*name_text/i);
  });

  it("ignores fields whose target is null (unmapped)", () => {
    const mapping = mkMapping();
    mapping.field_map.unmapped_field = {
      target: null,
      transform: null,
      needs_review: false,
      source_value_types: ["string"],
      occurrence_count: 5,
      sample_values: [],
    };
    const records: BubbleRecord[] = [
      { _id: "a", name_text: "alpha", unmapped_field: "should be dropped" },
    ];

    const result = runEngine(mapping, records, {
      workspaceId: "x",
      workspaceSlug: "x",
      mapping,
      companyId: null,
    });

    expect(result.rows[0].values).not.toHaveProperty("unmapped_field");
    expect(Object.keys(result.rows[0].values).sort()).toEqual(["created_at", "id", "name"]);
  });

  it("throws if any field has needs_review: true", () => {
    const mapping = mkMapping();
    mapping.field_map.name_text.needs_review = true;
    expect(() =>
      runEngine(mapping, [], { workspaceId: "x", workspaceSlug: "x", mapping, companyId: null }),
    ).toThrow(/needs_review/i);
  });

  it("throws if mapping.target_table is null", () => {
    const mapping = mkMapping({ target_table: null });
    expect(() =>
      runEngine(mapping, [], { workspaceId: "x", workspaceSlug: "x", mapping, companyId: null }),
    ).toThrow(/target_table/i);
  });

  it("captures unknown transform errors as record skips, not throws", () => {
    const mapping = mkMapping();
    mapping.field_map.name_text.transform = "nonexistent_transform";
    const records: BubbleRecord[] = [{ _id: "a", name_text: "x" }];

    const result = runEngine(mapping, records, {
      workspaceId: "x",
      workspaceSlug: "x",
      mapping,
      companyId: null,
    });

    expect(result.rows).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].reason).toMatch(/transform/i);
  });

  it("processes derived_columns by reading another Bubble field through a transform", () => {
    const mapping = mkMapping({
      derived_columns: {
        slug: { from: "name_text", transform: "slugify" },
      },
    });
    const records: BubbleRecord[] = [
      { _id: "1612345678901x111111111111111111", name_text: "Wrightegaarden Langesund AS" },
    ];

    const result = runEngine(mapping, records, {
      workspaceId: "x",
      workspaceSlug: "x",
      mapping,
      companyId: null,
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].values.slug).toBe("wrightegaarden-langesund-as");
    expect(result.rows[0].values.name).toBe("Wrightegaarden Langesund AS");
  });

  it("captures derived_column errors as record skips with target name in the reason", () => {
    const mapping = mkMapping({
      derived_columns: {
        slug: { from: "bad_field", transform: "slugify" },
      },
    });
    // bad_field is a number — slugify rejects non-string input
    const records: BubbleRecord[] = [
      { _id: "1612345678901x111111111111111111", name_text: "x", bad_field: 42 },
    ];

    const result = runEngine(mapping, records, {
      workspaceId: "x",
      workspaceSlug: "x",
      mapping,
      companyId: null,
    });

    expect(result.rows).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].reason).toMatch(/derived column "slug"/);
  });

  it("injects constant_columns as literal values on every emitted row", () => {
    const mapping = mkMapping({
      constant_columns: { source: "bubble_migration", is_active: true },
    });
    const records: BubbleRecord[] = [
      { _id: "1612345678901x111111111111111111", name_text: "x" },
      { _id: "1612345678902x222222222222222222", name_text: "y" },
    ];

    const result = runEngine(mapping, records, {
      workspaceId: "x",
      workspaceSlug: "x",
      mapping,
      companyId: null,
    });

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].values.source).toBe("bubble_migration");
    expect(result.rows[0].values.is_active).toBe(true);
    expect(result.rows[1].values.source).toBe("bubble_migration");
  });

  it("captures the entire source record into raw_json_target column (ADR-0005)", () => {
    const mapping = mkMapping({ raw_json_target: "raw_json" });
    const records: BubbleRecord[] = [
      {
        _id: "1612345678901x111111111111111111",
        name_text: "Wrightegaarden",
        custom_unmapped: "preserve me",
        nested: { count: 3 },
      },
    ];

    const result = runEngine(mapping, records, {
      workspaceId: "x",
      workspaceSlug: "x",
      mapping,
      companyId: null,
    });

    expect(result.rows).toHaveLength(1);
    // The full record (including unmapped fields) is captured verbatim
    expect(result.rows[0].values.raw_json).toEqual(records[0]);
    // Mapped fields are still present on the row
    expect(result.rows[0].values.name).toBe("Wrightegaarden");
  });

  it("raw_json_target overwrites a same-named field_map column (later phase wins)", () => {
    const mapping = mkMapping({
      field_map: {
        _id: {
          target: "id",
          transform: "fk_uuid:workspaces",
          needs_review: false,
          source_value_types: ["string"],
          occurrence_count: 1,
          sample_values: [],
        },
        name_text: {
          target: "raw_json", // intentional collision
          transform: "trim",
          needs_review: false,
          source_value_types: ["string"],
          occurrence_count: 1,
          sample_values: [],
        },
      },
      raw_json_target: "raw_json",
    });
    const records: BubbleRecord[] = [
      { _id: "1612345678901x111111111111111111", name_text: "loser" },
    ];

    const result = runEngine(mapping, records, {
      workspaceId: "x",
      workspaceSlug: "x",
      mapping,
      companyId: null,
    });

    // raw_json_target ran AFTER field_map — record object wins
    expect(result.rows[0].values.raw_json).toEqual(records[0]);
  });
});
