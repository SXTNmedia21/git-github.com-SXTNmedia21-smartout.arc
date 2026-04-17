import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeNarrative } from "../../src/research/narrative.js";
import type { Mapping, DiffResult } from "../../src/research/mapping.js";

const sampleMapping: Mapping = {
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
      sample_values: ["Alpha", "Beta"],
    },
    new_field: {
      target: "new_field",
      transform: null,
      needs_review: true,
      source_value_types: ["number"],
      occurrence_count: 12,
      sample_values: [1, 2, 3],
    },
  },
  required_source_fields: [],
  skip_if_missing: [],
  known_quirks: ["pre-2024 records missing foo"],
  last_verified: "2026-04-07",
  sample_record_count: 50,
  total_record_count: 127,
};

const sampleDiff: DiffResult = {
  newFields: ["new_field"],
  disappearedFields: [],
  typeChanges: [],
};

describe("writeNarrative", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "strike-narrative-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates the destination file with YAML frontmatter", async () => {
    await writeNarrative(tmpDir, sampleMapping, sampleDiff);
    const path = join(tmpDir, "workspace.md");

    expect(existsSync(path)).toBe(true);
    const content = readFileSync(path, "utf-8");
    expect(content).toMatch(/^---\n/);
    expect(content).toContain("title: ");
    expect(content).toContain("entity: workspace");
    expect(content).toContain("bubble_type: workspace");
    expect(content).toContain("updated: 2026-04-07");
  });

  it("includes a section about the schema shape", async () => {
    await writeNarrative(tmpDir, sampleMapping, sampleDiff);
    const content = readFileSync(join(tmpDir, "workspace.md"), "utf-8");
    expect(content).toContain("## Fields");
    expect(content).toContain("name_text");
    expect(content).toContain("new_field");
  });

  it("flags unreviewed fields visibly", async () => {
    await writeNarrative(tmpDir, sampleMapping, sampleDiff);
    const content = readFileSync(join(tmpDir, "workspace.md"), "utf-8");
    expect(content.toLowerCase()).toContain("needs review");
  });

  it("records known quirks in a dedicated section", async () => {
    await writeNarrative(tmpDir, sampleMapping, sampleDiff);
    const content = readFileSync(join(tmpDir, "workspace.md"), "utf-8");
    expect(content).toContain("## Known quirks");
    expect(content).toContain("pre-2024 records missing foo");
  });

  it("includes a diff section showing new fields", async () => {
    await writeNarrative(tmpDir, sampleMapping, sampleDiff);
    const content = readFileSync(join(tmpDir, "workspace.md"), "utf-8");
    expect(content).toContain("## Changes since last run");
    expect(content).toContain("new_field");
  });

  it("creates the parent directory if it does not exist", async () => {
    const nested = join(tmpDir, "does", "not", "exist");
    await writeNarrative(nested, sampleMapping, sampleDiff);
    expect(existsSync(join(nested, "workspace.md"))).toBe(true);
  });
});
