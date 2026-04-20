/**
 * auto_align.determinism.test.ts — Integration test ensuring double-run produces byte-identical output.
 *
 * Council requirement #13: runs auto_align twice, compares outputs byte-for-byte.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  mkdirSync,
  readFileSync,
  readdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { alignEntity, generateEntityReport, generateSummaryReport, computeApprovalHash } from "../../scripts/lib/align.js";
import type { V3Schema } from "../../scripts/lib/align.js";
import type { Mapping } from "../../src/research/mapping.js";

// ─── Synthetic fixtures ───────────────────────────────────────────────────────

const SYNTHETIC_SCHEMA: V3Schema = {
  tables: {
    "public.team": {
      schema: "public",
      name: "team",
      qualified_name: "public.team",
      columns: {
        team_id: {
          name: "team_id",
          type: "uuid",
          nullable: false,
          is_primary_key: true,
          is_array: false,
          default_expr: "gen_random_uuid()",
          foreign_key: null,
        },
        name: {
          name: "name",
          type: "text",
          nullable: false,
          is_primary_key: false,
          is_array: false,
          default_expr: null,
          foreign_key: null,
        },
        is_active: {
          name: "is_active",
          type: "boolean",
          nullable: false,
          is_primary_key: false,
          is_array: false,
          default_expr: "true",
          foreign_key: null,
        },
        created_at: {
          name: "created_at",
          type: "timestamptz",
          nullable: false,
          is_primary_key: false,
          is_array: false,
          default_expr: "now()",
          foreign_key: null,
        },
        updated_at: {
          name: "updated_at",
          type: "timestamptz",
          nullable: false,
          is_primary_key: false,
          is_array: false,
          default_expr: "now()",
          foreign_key: null,
        },
      },
    },
    "public.workspace": {
      schema: "public",
      name: "workspace",
      qualified_name: "public.workspace",
      columns: {
        workspace_id: {
          name: "workspace_id",
          type: "uuid",
          nullable: false,
          is_primary_key: true,
          is_array: false,
          default_expr: "gen_random_uuid()",
          foreign_key: null,
        },
        name: {
          name: "name",
          type: "text",
          nullable: false,
          is_primary_key: false,
          is_array: false,
          default_expr: null,
          foreign_key: null,
        },
        created_at: {
          name: "created_at",
          type: "timestamptz",
          nullable: false,
          is_primary_key: false,
          is_array: false,
          default_expr: "now()",
          foreign_key: null,
        },
      },
    },
  },
};

const SYNTHETIC_MAPPINGS: Mapping[] = [
  {
    entity: "teams",
    bubble_type: "🎎team",
    target_table: null,
    field_map: {
      "Team Name": {
        target: "name",
        transform: null,
        needs_review: true,
        source_value_types: ["string"],
        occurrence_count: 50,
        sample_values: ["string<15>", "string<20>", "string<10>"],
      },
      "_id": {
        target: "id",
        transform: null,
        needs_review: true,
        source_value_types: ["string"],
        occurrence_count: 50,
        sample_values: ["string<32>", "string<32>"],
      },
      "isActive": {
        target: "is_active",
        transform: null,
        needs_review: true,
        source_value_types: ["boolean"],
        occurrence_count: 50,
        sample_values: ["boolean"],
      },
      "Created Date": {
        target: "created_date",
        transform: null,
        needs_review: true,
        source_value_types: ["string"],
        occurrence_count: 50,
        sample_values: ["string<24>", "string<24>"],
      },
      "Old Metric": {
        target: "old_metric",
        transform: null,
        needs_review: true,
        source_value_types: ["string"],
        occurrence_count: 5,
        sample_values: ["string<8>"],
      },
    },
    required_source_fields: [],
    skip_if_missing: [],
    known_quirks: [],
    last_verified: "2026-04-08",
    sample_record_count: 50,
    total_record_count: 200,
    v3_schema_hash: null,
  },
  {
    entity: "workspace",
    bubble_type: "workspace",
    target_table: null,
    field_map: {
      "Titel": {
        target: "name",
        transform: null,
        needs_review: true,
        source_value_types: ["string"],
        occurrence_count: 40,
        sample_values: ["string<15>", "string<11>"],
      },
    },
    required_source_fields: [],
    skip_if_missing: [],
    known_quirks: [],
    last_verified: "2026-04-08",
    sample_record_count: 40,
    total_record_count: 40,
    v3_schema_hash: null,
  },
];

// ─── Helper: run alignment and write outputs ──────────────────────────────────

function runAlignment(
  mappings: Mapping[],
  schema: V3Schema,
  schemaHash: string,
  alignedDir: string,
  reportDir: string,
  timestamp: string,
): void {
  mkdirSync(alignedDir, { recursive: true });
  mkdirSync(reportDir, { recursive: true });

  const results = mappings.map((m) => alignEntity(m, schema));

  for (const result of results) {
    // Write aligned mapping
    const alignedMapping = {
      ...mappings.find((m) => m.entity === result.entity)!,
      target_table: result.targetTable,
      approval_hash: result.approvalHash,
    };
    writeFileSync(
      join(alignedDir, `${result.entity}.json`),
      JSON.stringify(alignedMapping, null, 2) + "\n",
      "utf-8",
    );

    // Write entity report
    const report = generateEntityReport(result);
    writeFileSync(join(reportDir, `${result.entity}.md`), report, "utf-8");
  }

  // Write summary
  const summary = generateSummaryReport(results, schemaHash, timestamp);
  writeFileSync(join(reportDir, "auto_align_SUMMARY.md"), summary, "utf-8");
}

function readAllFiles(dir: string): Map<string, string> {
  const files = new Map<string, string>();
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile()) {
      const content = readFileSync(join(dir, entry.name), "utf-8");
      files.set(entry.name, content);
    }
  }
  return files;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("auto_align determinism", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "strike-align-determinism-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("double run produces byte-identical output", () => {
    const schemaHash = computeApprovalHash(SYNTHETIC_SCHEMA as unknown as Mapping);
    // Fixed timestamp so reports are identical
    const timestamp = "2026-04-08T12:00:00.000Z";

    const run1Aligned = join(tmpDir, "run1", "aligned");
    const run1Reports = join(tmpDir, "run1", "reports");
    const run2Aligned = join(tmpDir, "run2", "aligned");
    const run2Reports = join(tmpDir, "run2", "reports");

    // Run 1
    runAlignment(SYNTHETIC_MAPPINGS, SYNTHETIC_SCHEMA, schemaHash, run1Aligned, run1Reports, timestamp);

    // Run 2 (identical inputs)
    runAlignment(SYNTHETIC_MAPPINGS, SYNTHETIC_SCHEMA, schemaHash, run2Aligned, run2Reports, timestamp);

    // Compare aligned outputs
    const run1AlignedFiles = readAllFiles(run1Aligned);
    const run2AlignedFiles = readAllFiles(run2Aligned);

    expect(run1AlignedFiles.size).toBe(run2AlignedFiles.size);
    for (const [filename, content1] of run1AlignedFiles) {
      const content2 = run2AlignedFiles.get(filename);
      expect(content2).toBeDefined();
      expect(content1).toBe(content2);
    }

    // Compare reports
    const run1ReportFiles = readAllFiles(run1Reports);
    const run2ReportFiles = readAllFiles(run2Reports);

    expect(run1ReportFiles.size).toBe(run2ReportFiles.size);
    for (const [filename, content1] of run1ReportFiles) {
      const content2 = run2ReportFiles.get(filename);
      expect(content2).toBeDefined();
      expect(content1).toBe(content2);
    }
  });

  it("alignEntity is pure — same input always produces same result", () => {
    const mapping = SYNTHETIC_MAPPINGS[0];
    const r1 = alignEntity(mapping, SYNTHETIC_SCHEMA);
    const r2 = alignEntity(mapping, SYNTHETIC_SCHEMA);
    expect(r1.approvalHash).toBe(r2.approvalHash);
    expect(r1.autoConfirmedCount).toBe(r2.autoConfirmedCount);
    expect(r1.droppedCount).toBe(r2.droppedCount);
    expect(r1.reviewQueueCount).toBe(r2.reviewQueueCount);
    expect(JSON.stringify(r1.fields)).toBe(JSON.stringify(r2.fields));
  });

  it("alignEntity — end-to-end with synthetic mapping + schema", () => {
    const mapping = SYNTHETIC_MAPPINGS[0]; // teams
    const result = alignEntity(mapping, SYNTHETIC_SCHEMA);

    expect(result.entity).toBe("teams");
    expect(result.targetTable).toBe("public.team");
    expect(result.entityMatchStatus).toBe("matched");
    expect(result.matchConfidence).toBe("HIGH");
    expect(result.approvalHash).toMatch(/^[0-9a-f]{64}$/);

    // name (text/text) should be auto-confirmed
    const nameField = result.fields.find((f) => f.bubbleField === "Team Name");
    expect(nameField?.verdict).toBe("auto-confirm");

    // is_active (boolean/boolean) should be auto-confirmed
    const isActiveField = result.fields.find((f) => f.bubbleField === "isActive");
    expect(isActiveField?.verdict).toBe("auto-confirm");

    // _id (string<32> → id — no 'id' column in team table) should drop
    const idField = result.fields.find((f) => f.bubbleField === "_id");
    expect(idField?.verdict).toBe("drop");

    // Old Metric (no column in team table) should drop
    const oldMetricField = result.fields.find((f) => f.bubbleField === "Old Metric");
    expect(oldMetricField?.verdict).toBe("drop");
  });
});
