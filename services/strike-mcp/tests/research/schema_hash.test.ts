import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  computeV3SchemaHash,
  readAndSortMigrationFiles,
} from "../../src/research/schema_hash.js";

describe("readAndSortMigrationFiles", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "strike-schema-hash-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns only .sql files in sorted order", async () => {
    writeFileSync(join(tmpDir, "00003_create_locations.sql"), "C");
    writeFileSync(join(tmpDir, "00001_create_workspaces.sql"), "A");
    writeFileSync(join(tmpDir, "00002_create_users.sql"), "B");
    writeFileSync(join(tmpDir, "README.md"), "not sql");

    const files = await readAndSortMigrationFiles(tmpDir);
    expect(files.map((f) => f.replace(tmpDir + "/", ""))).toEqual([
      "00001_create_workspaces.sql",
      "00002_create_users.sql",
      "00003_create_locations.sql",
    ]);
  });

  it("sorts 14-digit timestamp prefixes correctly", async () => {
    writeFileSync(join(tmpDir, "20260227120000_initial.sql"), "A");
    writeFileSync(join(tmpDir, "20260228000000_add_index.sql"), "B");
    writeFileSync(join(tmpDir, "20260101000000_baseline.sql"), "C");

    const files = await readAndSortMigrationFiles(tmpDir);
    const names = files.map((f) => f.replace(tmpDir + "/", ""));
    expect(names).toEqual([
      "20260101000000_baseline.sql",
      "20260227120000_initial.sql",
      "20260228000000_add_index.sql",
    ]);
  });

  it("handles mixed 5-digit and 14-digit prefixes by numeric value", async () => {
    writeFileSync(join(tmpDir, "00002_early.sql"), "B");
    writeFileSync(join(tmpDir, "20260101000000_later.sql"), "C");
    writeFileSync(join(tmpDir, "00001_earliest.sql"), "A");

    const files = await readAndSortMigrationFiles(tmpDir);
    const names = files.map((f) => f.replace(tmpDir + "/", ""));
    expect(names[0]).toBe("00001_earliest.sql");
    expect(names[1]).toBe("00002_early.sql");
    expect(names[2]).toBe("20260101000000_later.sql");
  });

  it("returns empty array for directory with no .sql files", async () => {
    writeFileSync(join(tmpDir, "README.md"), "no sql here");
    const files = await readAndSortMigrationFiles(tmpDir);
    expect(files).toEqual([]);
  });
});

describe("computeV3SchemaHash", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "strike-schema-hash-compute-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns a hex string", async () => {
    writeFileSync(join(tmpDir, "00001_test.sql"), "CREATE TABLE x (id uuid);");
    const files = await readAndSortMigrationFiles(tmpDir);
    const hash = await computeV3SchemaHash(files);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic: same content produces same hash", async () => {
    writeFileSync(join(tmpDir, "00001_test.sql"), "CREATE TABLE x (id uuid);");
    const files = await readAndSortMigrationFiles(tmpDir);
    const h1 = await computeV3SchemaHash(files);
    const h2 = await computeV3SchemaHash(files);
    expect(h1).toBe(h2);
  });

  it("changes when content changes", async () => {
    writeFileSync(join(tmpDir, "00001_test.sql"), "CREATE TABLE x (id uuid);");
    const files1 = await readAndSortMigrationFiles(tmpDir);
    const h1 = await computeV3SchemaHash(files1);

    writeFileSync(join(tmpDir, "00001_test.sql"), "CREATE TABLE x (id uuid, name text);");
    const files2 = await readAndSortMigrationFiles(tmpDir);
    const h2 = await computeV3SchemaHash(files2);

    expect(h1).not.toBe(h2);
  });

  it("changes when a new file is added", async () => {
    writeFileSync(join(tmpDir, "00001_test.sql"), "CREATE TABLE x (id uuid);");
    const files1 = await readAndSortMigrationFiles(tmpDir);
    const h1 = await computeV3SchemaHash(files1);

    writeFileSync(join(tmpDir, "00002_new.sql"), "CREATE TABLE y (id uuid);");
    const files2 = await readAndSortMigrationFiles(tmpDir);
    const h2 = await computeV3SchemaHash(files2);

    expect(h1).not.toBe(h2);
  });

  it("returns a hash of empty string for empty file list", async () => {
    const hash = await computeV3SchemaHash([]);
    // SHA-256 of empty string
    expect(hash).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });
});
