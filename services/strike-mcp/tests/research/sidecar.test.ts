import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { saveSidecar, loadSidecar } from "../../src/research/sidecar.js";

describe("saveSidecar", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "strike-sidecar-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates .local directory if missing", async () => {
    await saveSidecar(tmpDir, "workspace", { name: ["Alpha", "Beta"] });
    expect(existsSync(join(tmpDir, ".local"))).toBe(true);
  });

  it("writes the sidecar JSON file", async () => {
    await saveSidecar(tmpDir, "workspace", { name: ["Alpha", "Beta"], count: [1, 2] });
    expect(existsSync(join(tmpDir, ".local", "workspace.sidecar.json"))).toBe(true);
  });

  it("loadSidecar returns null when file does not exist", async () => {
    const result = await loadSidecar(tmpDir, "nonexistent");
    expect(result).toBeNull();
  });

  it("loadSidecar round-trips the saved sidecar", async () => {
    const sidecar = { name: ["Alpha", "Beta"], count: [1, 2] };
    await saveSidecar(tmpDir, "workspace", sidecar);
    const loaded = await loadSidecar(tmpDir, "workspace");
    expect(loaded).toEqual(sidecar);
  });
});
