import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeStagedFiles, slugify } from "../../src/migration/staging.js";

describe("slugify", () => {
  it("lowercases", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("replaces non-alphanumeric with dashes", () => {
    expect(slugify("Strøm Mat & Bar")).toBe("strom-mat-bar");
  });

  it("strips leading/trailing dashes and collapses repeats", () => {
    expect(slugify("---hello---world---")).toBe("hello-world");
  });

  it("converts Norwegian characters", () => {
    expect(slugify("Æble & Øst Café")).toBe("ble-ost-cafe");
  });

  it("returns 'unnamed' for empty result", () => {
    expect(slugify("")).toBe("unnamed");
    expect(slugify("!!!")).toBe("unnamed");
  });
});

describe("writeStagedFiles", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "strike-staging-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("writes sql and report files with numbered prefix", async () => {
    const result = await writeStagedFiles({
      stagingDir: tmpDir,
      workspaceSlug: "alpha",
      orderIndex: 1,
      entity: "workspaces",
      sql: "BEGIN;\nCOMMIT;\n",
      report: "# report\n",
    });

    expect(existsSync(result.sqlPath)).toBe(true);
    expect(existsSync(result.reportPath)).toBe(true);
    expect(result.sqlPath).toMatch(/01_workspaces\.sql$/);
    expect(result.reportPath).toMatch(/01_workspaces\.report\.md$/);
    expect(result.sqlPath).toContain("/alpha/");
  });

  it("creates nested directories as needed", async () => {
    const nested = join(tmpDir, "deeply", "nested");
    const result = await writeStagedFiles({
      stagingDir: nested,
      workspaceSlug: "beta",
      orderIndex: 5,
      entity: "shifts",
      sql: "BEGIN;\nCOMMIT;\n",
      report: "# report\n",
    });
    expect(existsSync(result.sqlPath)).toBe(true);
  });

  it("zero-pads order index to 2 digits", async () => {
    const r = await writeStagedFiles({
      stagingDir: tmpDir,
      workspaceSlug: "x",
      orderIndex: 3,
      entity: "users",
      sql: "",
      report: "",
    });
    expect(r.sqlPath).toMatch(/03_users\.sql$/);
  });

  it("contains the SQL content as written", async () => {
    const r = await writeStagedFiles({
      stagingDir: tmpDir,
      workspaceSlug: "x",
      orderIndex: 1,
      entity: "workspaces",
      sql: "BEGIN;\nINSERT INTO workspaces (id) VALUES ('a');\nCOMMIT;\n",
      report: "",
    });
    const content = readFileSync(r.sqlPath, "utf-8");
    expect(content).toContain("INSERT INTO workspaces");
  });
});
