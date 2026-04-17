import { describe, it, expect } from "vitest";
import { emitSql } from "../../src/migration/sql_emitter.js";
import type { EmittedRow } from "../../src/migration/types.js";

const sampleRows: EmittedRow[] = [
  {
    table: "workspaces",
    values: {
      id: "8b4f3a8c-6d1e-4a2f-9c5b-1e7d3a8c6f4e",
      name: "Strøm Mat & Bar",
      created_at: "2023-01-15T10:00:00.000Z",
    },
  },
  {
    table: "workspaces",
    values: {
      id: "ab123456-cd78-9012-3456-7890abcdef12",
      name: "Kafé Ost",
      created_at: null,
    },
  },
];

const meta = {
  entity: "workspaces",
  workspaceId: "1612345678901x111111111111111111",
  workspaceSlug: "strom-mat-og-bar",
  generatedAt: "2026-04-07T19:00:00.000Z",
  bubbleSourceRevision: "workspace@2026-04-01",
};

describe("emitSql", () => {
  it("wraps the output in BEGIN; ... COMMIT;", () => {
    const sql = emitSql(sampleRows, meta);
    expect(sql).toMatch(/^BEGIN;/);
    expect(sql.trim()).toMatch(/COMMIT;$/);
  });

  it("includes a header comment with metadata", () => {
    const sql = emitSql(sampleRows, meta);
    expect(sql).toContain("-- strike-mcp generated migration");
    expect(sql).toContain("-- entity: workspaces");
    expect(sql).toContain("-- workspace: 1612345678901x111111111111111111");
    expect(sql).toContain("-- workspace_slug: strom-mat-og-bar");
    expect(sql).toContain("-- generated: 2026-04-07T19:00:00.000Z");
    expect(sql).toContain("-- REVIEW BEFORE APPLYING");
  });

  it("emits one INSERT per row", () => {
    const sql = emitSql(sampleRows, meta);
    const inserts = sql.match(/INSERT INTO/g);
    expect(inserts).toHaveLength(2);
  });

  it("escapes single quotes in string values", () => {
    const rows: EmittedRow[] = [
      {
        table: "workspaces",
        values: { id: "x", name: "O'Brien's Bar" },
      },
    ];
    const sql = emitSql(rows, meta);
    expect(sql).toContain("'O''Brien''s Bar'");
  });

  it("emits NULL for null values without quotes", () => {
    const sql = emitSql(sampleRows, meta);
    expect(sql).toContain("NULL");
    expect(sql).not.toContain("'null'");
  });

  it("handles numbers and booleans without quotes", () => {
    const rows: EmittedRow[] = [
      {
        table: "items",
        values: { id: "x", count: 42, active: true },
      },
    ];
    const sql = emitSql(rows, meta);
    expect(sql).toContain("42");
    expect(sql).toContain("true");
    expect(sql).not.toContain("'42'");
  });

  it("returns an empty migration body (just BEGIN/COMMIT and header) when there are no rows", () => {
    const sql = emitSql([], meta);
    expect(sql).toContain("BEGIN;");
    expect(sql).toContain("COMMIT;");
    expect(sql).not.toContain("INSERT INTO");
  });

  it("never emits DELETE or UPDATE", () => {
    const sql = emitSql(sampleRows, meta);
    expect(sql).not.toMatch(/\bDELETE\b/);
    expect(sql).not.toMatch(/\bUPDATE\b/);
  });

  describe("uuid[] array literal emission", () => {
    it("emits ARRAY['uuid1','uuid2']::uuid[] for an array of UUID strings", () => {
      const rows: EmittedRow[] = [
        {
          table: "profiles",
          values: {
            id: "x",
            departments: [
              "8b4f3a8c-6d1e-4a2f-9c5b-1e7d3a8c6f4e",
              "ab123456-cd78-9012-3456-7890abcdef12",
            ],
          },
        },
      ];
      const sql = emitSql(rows, meta);
      expect(sql).toContain(
        "ARRAY['8b4f3a8c-6d1e-4a2f-9c5b-1e7d3a8c6f4e','ab123456-cd78-9012-3456-7890abcdef12']::uuid[]",
      );
    });

    it("emits ARRAY[]::uuid[] for an empty array of UUIDs", () => {
      const rows: EmittedRow[] = [
        {
          table: "profiles",
          values: { id: "x", departments: [] },
        },
      ];
      const sql = emitSql(rows, meta);
      expect(sql).toContain("ARRAY[]::uuid[]");
    });

    it("emits NULL for null array value", () => {
      const rows: EmittedRow[] = [
        {
          table: "profiles",
          values: { id: "x", departments: null },
        },
      ];
      const sql = emitSql(rows, meta);
      expect(sql).toContain("NULL");
    });

    it("JSON-serializes arrays of non-UUID strings (fallback to jsonb)", () => {
      const rows: EmittedRow[] = [
        {
          table: "items",
          values: { tags: ["hello", "world"] },
        },
      ];
      const sql = emitSql(rows, meta);
      // Should NOT use ARRAY[]::uuid[] syntax
      expect(sql).not.toContain("::uuid[]");
      // Should serialize as JSON string
      expect(sql).toContain('"hello"');
    });

    it("JSON-serializes arrays of numbers (fallback to jsonb)", () => {
      const rows: EmittedRow[] = [
        {
          table: "items",
          values: { counts: [1, 2, 3] },
        },
      ];
      const sql = emitSql(rows, meta);
      expect(sql).not.toContain("::uuid[]");
    });
  });
});
