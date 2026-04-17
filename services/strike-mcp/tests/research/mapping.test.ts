import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  loadMapping,
  saveMapping,
  hasUnreviewedFields,
  hasMappingLevelReview,
  type Mapping,
} from "../../src/research/mapping.js";

describe("mapping IO", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "strike-mapping-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns null when mapping file does not exist", async () => {
    const result = await loadMapping(tmpDir, "nonexistent");
    expect(result).toBeNull();
  });

  it("round-trips a mapping through save and load", async () => {
    const mapping: Mapping = {
      entity: "workspace",
      bubble_type: "workspace",
      target_table: "workspaces",
      field_map: {
        name_text: {
          target: "name",
          transform: "trim",
          needs_review: false,
          source_value_types: ["string"],
          occurrence_count: 50,
          sample_values: ["Alpha", "Beta", "Gamma"],
        },
      },
      required_source_fields: ["name_text"],
      skip_if_missing: [],
      known_quirks: [],
      last_verified: "2026-04-07",
      sample_record_count: 50,
      total_record_count: 127,
    };

    await saveMapping(tmpDir, mapping);
    const loaded = await loadMapping(tmpDir, "workspace");

    expect(loaded).toEqual(mapping);
  });
});

describe("v3_schema_hash field", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "strike-mapping-hash-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("round-trips v3_schema_hash as null when not set", async () => {
    const mapping: Mapping = {
      entity: "workspace",
      bubble_type: "workspace",
      target_table: "workspaces",
      field_map: {},
      required_source_fields: [],
      skip_if_missing: [],
      known_quirks: [],
      last_verified: "2026-04-07",
      sample_record_count: 5,
      total_record_count: 10,
      v3_schema_hash: null,
    };

    await saveMapping(tmpDir, mapping);
    const loaded = await loadMapping(tmpDir, "workspace");
    expect(loaded?.v3_schema_hash).toBeNull();
  });

  it("round-trips a non-null v3_schema_hash", async () => {
    const mapping: Mapping = {
      entity: "workspace",
      bubble_type: "workspace",
      target_table: "workspaces",
      field_map: {},
      required_source_fields: [],
      skip_if_missing: [],
      known_quirks: [],
      last_verified: "2026-04-07",
      sample_record_count: 5,
      total_record_count: 10,
      v3_schema_hash: "abc123deadbeef",
    };

    await saveMapping(tmpDir, mapping);
    const loaded = await loadMapping(tmpDir, "workspace");
    expect(loaded?.v3_schema_hash).toBe("abc123deadbeef");
  });
});

describe("zero-records attestation gate", () => {
  const base: Mapping = {
    entity: "x",
    bubble_type: "x",
    target_table: null,
    field_map: {},
    required_source_fields: [],
    skip_if_missing: [],
    known_quirks: [],
    last_verified: "2026-04-07",
    sample_record_count: 0,
    total_record_count: 0,
    v3_schema_hash: null,
  };

  it("hasMappingLevelReview returns true when sample_record_count is 0 with no attestation", () => {
    expect(hasMappingLevelReview(base)).toBe(true);
  });

  it("hasMappingLevelReview returns false when sample_record_count > 0", () => {
    expect(hasMappingLevelReview({ ...base, sample_record_count: 5 })).toBe(false);
  });

  it("hasMappingLevelReview returns false when known_empty_source is true", () => {
    expect(hasMappingLevelReview({ ...base, known_empty_source: true })).toBe(false);
  });

  it("hasUnreviewedFields returns true when mapping-level gate is triggered", () => {
    expect(hasUnreviewedFields(base)).toBe(true);
  });

  it("hasUnreviewedFields returns false when mapping-level gate passes and all fields reviewed", () => {
    const m: Mapping = {
      ...base,
      sample_record_count: 5,
      field_map: {
        a: { target: "a", transform: null, needs_review: false, source_value_types: [], occurrence_count: 0, sample_values: [] },
      },
    };
    expect(hasUnreviewedFields(m)).toBe(false);
  });
});

describe("hasUnreviewedFields", () => {
  // Use sample_record_count > 0 so the zero-records gate doesn't interfere
  const base: Mapping = {
    entity: "x",
    bubble_type: "x",
    target_table: null,
    field_map: {},
    required_source_fields: [],
    skip_if_missing: [],
    known_quirks: [],
    last_verified: "2026-04-07",
    sample_record_count: 5,
    total_record_count: 10,
    v3_schema_hash: null,
  };

  it("returns false when field_map is empty", () => {
    expect(hasUnreviewedFields(base)).toBe(false);
  });

  it("returns true when any field has needs_review: true", () => {
    const mapping: Mapping = {
      ...base,
      field_map: {
        a: { target: "x", transform: null, needs_review: false, source_value_types: [], occurrence_count: 0, sample_values: [] },
        b: { target: "y", transform: null, needs_review: true,  source_value_types: [], occurrence_count: 0, sample_values: [] },
      },
    };
    expect(hasUnreviewedFields(mapping)).toBe(true);
  });

  it("returns false when all fields are reviewed", () => {
    const mapping: Mapping = {
      ...base,
      field_map: {
        a: { target: "x", transform: null, needs_review: false, source_value_types: [], occurrence_count: 0, sample_values: [] },
        b: { target: "y", transform: null, needs_review: false, source_value_types: [], occurrence_count: 0, sample_values: [] },
      },
    };
    expect(hasUnreviewedFields(mapping)).toBe(false);
  });
});
