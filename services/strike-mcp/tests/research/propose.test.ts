import { describe, it, expect } from "vitest";
import { propose, normalizeKey } from "../../src/research/propose.js";
import type { Mapping, FieldObservation } from "../../src/research/mapping.js";

describe("normalizeKey", () => {
  it("lowercases", () => {
    expect(normalizeKey("FullName")).toBe("fullname");
  });

  it("replaces spaces and dots with underscores", () => {
    expect(normalizeKey("first name")).toBe("first_name");
    expect(normalizeKey("user.email")).toBe("user_email");
  });

  it("collapses runs of underscores", () => {
    expect(normalizeKey("a___b")).toBe("a_b");
    expect(normalizeKey("a   b...c")).toBe("a_b_c");
  });

  it("strips emojis and weird unicode", () => {
    expect(normalizeKey("🚀rocket")).toBe("rocket");
    expect(normalizeKey("name 👤 text")).toBe("name_text");
  });

  it("trims leading and trailing underscores", () => {
    expect(normalizeKey("  hello  ")).toBe("hello");
    expect(normalizeKey("__a__")).toBe("a");
  });

  it("preserves digits and underscores", () => {
    expect(normalizeKey("field_1_value")).toBe("field_1_value");
  });
});

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const baseMapping: Mapping = {
  entity: "shift",
  bubble_type: "shift",
  target_table: "shifts",
  field_map: {
    name_text: {
      target: "name",
      transform: "trim",
      needs_review: false,
      source_value_types: ["string"],
      occurrence_count: 10,
      sample_values: ["A"],
    },
  },
  required_source_fields: ["name_text"],
  skip_if_missing: [],
  known_quirks: [],
  last_verified: "2026-01-01",
  sample_record_count: 10,
  total_record_count: 100,
};

describe("propose", () => {
  it("preserves human decisions on existing fields and refreshes observation data", () => {
    const obs: FieldObservation = {
      totalRecords: 50,
      fields: {
        name_text: {
          occurrences: 50,
          valueTypes: ["string"],
          sampleValues: ["A", "B", "C"],
        },
      },
    };

    const result = propose(baseMapping, obs, 50);
    const entry = result.field_map.name_text!;

    expect(entry.target).toBe("name");
    expect(entry.transform).toBe("trim");
    expect(entry.needs_review).toBe(false);
    expect(entry.occurrence_count).toBe(50);
    expect(entry.sample_values).toEqual(["A", "B", "C"]);
    expect(entry.source_value_types).toEqual(["string"]);
  });

  it("proposes normalized target name and marks needs_review for new fields", () => {
    const obs: FieldObservation = {
      totalRecords: 20,
      fields: {
        "Start Time": {
          occurrences: 20,
          valueTypes: ["date"],
          sampleValues: ["2026-01-01"],
        },
      },
    };

    const result = propose(baseMapping, obs, 20);
    const entry = result.field_map["Start Time"]!;

    expect(entry.target).toBe("start_time");
    expect(entry.transform).toBeNull();
    expect(entry.needs_review).toBe(true);
    expect(entry.source_value_types).toEqual(["date"]);
    expect(entry.occurrence_count).toBe(20);
  });

  it("updates last_verified to today's ISO date", () => {
    const obs: FieldObservation = { totalRecords: 0, fields: {} };
    const result = propose(baseMapping, obs, 0);
    expect(result.last_verified).toMatch(ISO_DATE);
    expect(result.last_verified).not.toBe("2026-01-01");
  });

  it("updates sample_record_count", () => {
    const obs: FieldObservation = { totalRecords: 0, fields: {} };
    const result = propose(baseMapping, obs, 77);
    expect(result.sample_record_count).toBe(77);
  });

  it("preserves fields that disappeared from observation", () => {
    const obs: FieldObservation = { totalRecords: 0, fields: {} };
    const result = propose(baseMapping, obs, 0);
    expect(result.field_map.name_text).toBeDefined();
    expect(result.field_map.name_text!.target).toBe("name");
  });

  it("does not mutate the input mapping", () => {
    const obs: FieldObservation = {
      totalRecords: 5,
      fields: {
        new_field: {
          occurrences: 5,
          valueTypes: ["number"],
          sampleValues: [1, 2],
        },
      },
    };

    const snapshot = JSON.parse(JSON.stringify(baseMapping));
    propose(baseMapping, obs, 5);
    expect(baseMapping).toEqual(snapshot);
  });

  it("preserves other Mapping fields untouched", () => {
    const obs: FieldObservation = { totalRecords: 0, fields: {} };
    const result = propose(baseMapping, obs, 0);
    expect(result.entity).toBe("shift");
    expect(result.bubble_type).toBe("shift");
    expect(result.target_table).toBe("shifts");
    expect(result.required_source_fields).toEqual(["name_text"]);
    expect(result.total_record_count).toBe(100);
  });
});
