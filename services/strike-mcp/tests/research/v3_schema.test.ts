import { describe, it, expect } from "vitest";
import { parseV3Schema, readAndWriteV3Schema } from "../../src/research/v3_schema.js";
import { readAndSortMigrationFiles } from "../../src/research/schema_hash.js";
import { existsSync } from "node:fs";

const MIGRATIONS_DIR = "/home/sxtnl/dev/smartout.ai/supabase/migrations";
const migrationsExist = existsSync(MIGRATIONS_DIR);

describe.skipIf(!migrationsExist)(
  "parseV3Schema (against real v3 migrations)",
  () => {
    it("parses public.workspace with workspace_id PK", async () => {
      const files = await readAndSortMigrationFiles(MIGRATIONS_DIR);
      const schema = await parseV3Schema(files);
      expect(schema.tables["public.workspace"]).toBeDefined();
      const workspace = schema.tables["public.workspace"];
      expect(workspace.columns.workspace_id).toBeDefined();
      expect(workspace.columns.workspace_id.is_primary_key).toBe(true);
      expect(workspace.columns.workspace_id.type).toMatch(/uuid/i);
    });

    it("parses public.profile and captures company_id + workspace_id", async () => {
      const files = await readAndSortMigrationFiles(MIGRATIONS_DIR);
      const schema = await parseV3Schema(files);
      const profile = schema.tables["public.profile"];
      expect(profile).toBeDefined();
      expect(profile.columns.profile_id?.is_primary_key).toBe(true);
      expect(profile.columns.workspace_id).toBeDefined();
      expect(profile.columns.company_id).toBeDefined();
    });

    it("captures array columns like profile.departments as is_array=true", async () => {
      const files = await readAndSortMigrationFiles(MIGRATIONS_DIR);
      const schema = await parseV3Schema(files);
      const profile = schema.tables["public.profile"];
      // departments may or may not exist depending on schema version — guard
      if (profile.columns.departments) {
        expect(profile.columns.departments.is_array).toBe(true);
        expect(profile.columns.departments.type.toLowerCase()).toContain("uuid");
      }
    });

    it("captures public.invitation FK to profile", async () => {
      const files = await readAndSortMigrationFiles(MIGRATIONS_DIR);
      const schema = await parseV3Schema(files);
      const invitation = schema.tables["public.invitation"];
      expect(invitation).toBeDefined();
      // Some FK should reference profile
      const hasProfileFk = Object.values(invitation.columns).some(
        (c) => c.foreign_key?.table.includes("profile"),
      );
      expect(hasProfileFk).toBe(true);
    });

    it("populates schema_hash and computed_at", async () => {
      const files = await readAndSortMigrationFiles(MIGRATIONS_DIR);
      const schema = await parseV3Schema(files);
      expect(schema.schema_hash).toMatch(/^[0-9a-f]{64}$/);
      expect(schema.computed_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(schema.source_file_count).toBeGreaterThan(0);
    });

    it("parsed table count is greater than 20", async () => {
      const files = await readAndSortMigrationFiles(MIGRATIONS_DIR);
      const schema = await parseV3Schema(files);
      expect(Object.keys(schema.tables).length).toBeGreaterThan(20);
    });
  },
);

describe.skipIf(!migrationsExist)("readAndWriteV3Schema", () => {
  it("writes v3_schema.json to disk", async () => {
    const { mkdtempSync, existsSync: fsExistsSync, readFileSync, rmSync } =
      await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const tmp = mkdtempSync(join(tmpdir(), "strike-v3schema-"));
    try {
      const outputPath = join(tmp, "v3_schema.json");
      await readAndWriteV3Schema(MIGRATIONS_DIR, outputPath);
      expect(fsExistsSync(outputPath)).toBe(true);
      const parsed = JSON.parse(readFileSync(outputPath, "utf-8"));
      expect(parsed.tables["public.workspace"]).toBeDefined();
      expect(parsed.schema_hash).toMatch(/^[0-9a-f]{64}$/);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe("parseV3Schema (synthetic SQL)", () => {
  it("parses a minimal CREATE TABLE", async () => {
    const { mkdtempSync, writeFileSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");

    const tmp = mkdtempSync(join(tmpdir(), "strike-v3schema-synth-"));
    try {
      const filePath = join(tmp, "00001_test.sql");
      writeFileSync(
        filePath,
        `
        CREATE TABLE public.widget (
          widget_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
          name text NOT NULL,
          tags uuid[] DEFAULT '{}',
          workspace_id uuid NOT NULL REFERENCES public.workspace(workspace_id),
          is_active boolean NOT NULL DEFAULT true,
          notes text
        );
        `,
      );

      const schema = await parseV3Schema([filePath]);
      const widget = schema.tables["public.widget"];
      expect(widget).toBeDefined();
      expect(widget.schema).toBe("public");
      expect(widget.name).toBe("widget");

      // PK
      expect(widget.columns.widget_id.is_primary_key).toBe(true);
      expect(widget.columns.widget_id.type).toBe("uuid");
      expect(widget.columns.widget_id.nullable).toBe(false);

      // NOT NULL text
      expect(widget.columns.name.nullable).toBe(false);
      expect(widget.columns.name.type).toBe("text");

      // Array column
      expect(widget.columns.tags.is_array).toBe(true);
      expect(widget.columns.tags.type).toBe("uuid");

      // FK
      expect(widget.columns.workspace_id.foreign_key).toEqual({
        table: "public.workspace",
        column: "workspace_id",
      });
      expect(widget.columns.workspace_id.nullable).toBe(false);

      // Boolean with default
      expect(widget.columns.is_active.type).toBe("boolean");
      expect(widget.columns.is_active.is_primary_key).toBe(false);

      // Nullable column
      expect(widget.columns.notes.nullable).toBe(true);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("handles table-level PRIMARY KEY constraint", async () => {
    const { mkdtempSync, writeFileSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");

    const tmp = mkdtempSync(join(tmpdir(), "strike-v3schema-synth2-"));
    try {
      const filePath = join(tmp, "00001_test.sql");
      writeFileSync(
        filePath,
        `
        CREATE TABLE public.thing (
          thing_id uuid NOT NULL,
          name text NOT NULL,
          PRIMARY KEY (thing_id)
        );
        `,
      );

      const schema = await parseV3Schema([filePath]);
      const thing = schema.tables["public.thing"];
      expect(thing.columns.thing_id.is_primary_key).toBe(true);
      expect(thing.columns.thing_id.nullable).toBe(false);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("handles table-level FOREIGN KEY constraint", async () => {
    const { mkdtempSync, writeFileSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");

    const tmp = mkdtempSync(join(tmpdir(), "strike-v3schema-synth3-"));
    try {
      const filePath = join(tmp, "00001_test.sql");
      writeFileSync(
        filePath,
        `
        CREATE TABLE public.thing (
          thing_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
          workspace_id uuid NOT NULL,
          CONSTRAINT fk_thing_workspace FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id)
        );
        `,
      );

      const schema = await parseV3Schema([filePath]);
      const thing = schema.tables["public.thing"];
      expect(thing.columns.workspace_id.foreign_key).toEqual({
        table: "public.workspace",
        column: "workspace_id",
      });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("handles ALTER TABLE ADD COLUMN", async () => {
    const { mkdtempSync, writeFileSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");

    const tmp = mkdtempSync(join(tmpdir(), "strike-v3schema-synth4-"));
    try {
      const f1 = join(tmp, "00001_base.sql");
      const f2 = join(tmp, "00002_alter.sql");
      writeFileSync(
        f1,
        `CREATE TABLE public.thing (thing_id uuid PRIMARY KEY, name text NOT NULL);`,
      );
      writeFileSync(
        f2,
        `ALTER TABLE public.thing ADD COLUMN IF NOT EXISTS join_code CHAR(6) UNIQUE;`,
      );

      const schema = await parseV3Schema([f1, f2]);
      const thing = schema.tables["public.thing"];
      expect(thing.columns.join_code).toBeDefined();
      expect(thing.columns.join_code.type).toBe("char");
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("handles ALTER TABLE DROP COLUMN", async () => {
    const { mkdtempSync, writeFileSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");

    const tmp = mkdtempSync(join(tmpdir(), "strike-v3schema-synth5-"));
    try {
      const f1 = join(tmp, "00001_base.sql");
      const f2 = join(tmp, "00002_drop.sql");
      writeFileSync(
        f1,
        `CREATE TABLE public.thing (thing_id uuid PRIMARY KEY, old_col text, name text NOT NULL);`,
      );
      writeFileSync(f2, `ALTER TABLE public.thing DROP COLUMN IF EXISTS old_col;`);

      const schema = await parseV3Schema([f1, f2]);
      const thing = schema.tables["public.thing"];
      expect(thing.columns.old_col).toBeUndefined();
      expect(thing.columns.name).toBeDefined();
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("source_file_count is accurate", async () => {
    const { mkdtempSync, writeFileSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");

    const tmp = mkdtempSync(join(tmpdir(), "strike-v3schema-synth6-"));
    try {
      const files = [join(tmp, "00001.sql"), join(tmp, "00002.sql")];
      writeFileSync(files[0], "CREATE TABLE public.a (a_id uuid PRIMARY KEY);");
      writeFileSync(files[1], "CREATE TABLE public.b (b_id uuid PRIMARY KEY);");
      const schema = await parseV3Schema(files);
      expect(schema.source_file_count).toBe(2);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
