import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { previewSqlTool } from "../../src/tools/preview_sql.js";

describe("preview_sql tool", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "strike-preview-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("counts INSERTs per table", async () => {
    const sqlPath = join(tmpDir, "migration.sql");
    writeFileSync(
      sqlPath,
      [
        "BEGIN;",
        "INSERT INTO workspaces (id, name) VALUES ('a', 'b');",
        "INSERT INTO locations (id, name) VALUES ('c', 'd');",
        "INSERT INTO locations (id, name) VALUES ('e', 'f');",
        "COMMIT;",
      ].join("\n"),
    );

    const result = await previewSqlTool.execute(
      { filePath: sqlPath },
      {
        bubble: null as never,
        mappingsDir: "",
        vaultBubbleShapesDir: "",
        stagingDir: "",
        supabase: null,
      },
    );

    expect(result.totalInserts).toBe(3);
    expect(result.insertsByTable).toEqual({ workspaces: 1, locations: 2 });
    expect(result.hasBegin).toBe(true);
    expect(result.hasCommit).toBe(true);
  });

  it("warns if BEGIN or COMMIT is missing", async () => {
    const sqlPath = join(tmpDir, "bad.sql");
    writeFileSync(sqlPath, "INSERT INTO x (a) VALUES (1);");
    const result = await previewSqlTool.execute(
      { filePath: sqlPath },
      {
        bubble: null as never,
        mappingsDir: "",
        vaultBubbleShapesDir: "",
        stagingDir: "",
        supabase: null,
      },
    );
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("flags presence of forbidden DELETE/UPDATE statements", async () => {
    const sqlPath = join(tmpDir, "bad.sql");
    writeFileSync(sqlPath, "BEGIN;\nDELETE FROM users;\nCOMMIT;");
    const result = await previewSqlTool.execute(
      { filePath: sqlPath },
      {
        bubble: null as never,
        mappingsDir: "",
        vaultBubbleShapesDir: "",
        stagingDir: "",
        supabase: null,
      },
    );
    expect(result.warnings.some((w) => w.toLowerCase().includes("delete"))).toBe(true);
  });

  it("counts INSERTs for dot-qualified table names like auth.users", async () => {
    const sqlPath = join(tmpDir, "auth.sql");
    writeFileSync(
      sqlPath,
      "BEGIN;\nINSERT INTO auth.users (id) VALUES ('x');\nINSERT INTO public.profiles (id) VALUES ('y');\nCOMMIT;",
    );
    const result = await previewSqlTool.execute(
      { filePath: sqlPath },
      {
        bubble: null as never,
        mappingsDir: "",
        vaultBubbleShapesDir: "",
        stagingDir: "",
        supabase: null,
      },
    );
    expect(result.insertsByTable["auth.users"]).toBe(1);
    expect(result.insertsByTable["public.profiles"]).toBe(1);
    expect(result.totalInserts).toBe(2);
  });
});
