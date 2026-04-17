import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bundleMigrationTool } from "../../src/tools/bundle_migration.js";
import { SupabaseReadClient } from "../../src/supabase/client.js";
import { BubbleClient } from "../../src/bubble/client.js";

function makeBubble(): BubbleClient {
  return new BubbleClient(
    { bubbleAppUrl: "https://x", bubbleApiToken: "t" },
    vi.fn() as unknown as typeof fetch,
  );
}

describe("bundle_migration tool", () => {
  let stagingDir: string;
  let workspaceDir: string;

  beforeEach(() => {
    stagingDir = mkdtempSync(join(tmpdir(), "strike-bundle-"));
    workspaceDir = join(stagingDir, "alpha");
    mkdirSync(workspaceDir, { recursive: true });
    writeFileSync(
      join(workspaceDir, "01_workspaces.sql"),
      "BEGIN;\nINSERT INTO workspaces (id) VALUES ('a');\nCOMMIT;\n",
    );
    writeFileSync(
      join(workspaceDir, "02_locations.sql"),
      "BEGIN;\nINSERT INTO locations (id) VALUES ('b');\nINSERT INTO locations (id) VALUES ('c');\nCOMMIT;\n",
    );
  });

  afterEach(() => {
    rmSync(stagingDir, { recursive: true, force: true });
  });

  function makeCtx(supabase: SupabaseReadClient | null) {
    return {
      bubble: makeBubble(),
      mappingsDir: "",
      vaultBubbleShapesDir: "",
      stagingDir,
      supabase,
    };
  }

  it("concatenates SQL files in order, with single outer BEGIN/COMMIT", async () => {
    const result = await bundleMigrationTool.execute(
      { workspaceSlug: "alpha" },
      makeCtx(null),
    );

    expect(existsSync(result.bundlePath)).toBe(true);
    const sql = readFileSync(result.bundlePath, "utf-8");
    expect(sql.match(/^BEGIN;/m)).toBeTruthy();
    expect(sql.trimEnd()).toMatch(/COMMIT;$/);
    // Internal BEGIN/COMMIT should be stripped — only one of each
    expect((sql.match(/BEGIN;/g) ?? []).length).toBe(1);
    expect((sql.match(/COMMIT;/g) ?? []).length).toBe(1);
    // Both inserts must be present, in order
    const wsIdx = sql.indexOf("INSERT INTO workspaces");
    const locIdx = sql.indexOf("INSERT INTO locations");
    expect(wsIdx).toBeGreaterThan(-1);
    expect(locIdx).toBeGreaterThan(wsIdx);
  });

  it("returns total insert count and per-table breakdown", async () => {
    const result = await bundleMigrationTool.execute(
      { workspaceSlug: "alpha" },
      makeCtx(null),
    );
    expect(result.totalInserts).toBe(3);
    expect(result.insertsByTable.workspaces).toBe(1);
    expect(result.insertsByTable.locations).toBe(2);
  });

  it("calls verify_target_empty when supabase is configured and refuses on non-empty without ack", async () => {
    const supabase = new SupabaseReadClient(
      { url: "https://x", anonKey: "k" },
      vi.fn() as unknown as typeof fetch,
    );
    vi.spyOn(supabase, "count").mockResolvedValue(1);

    await expect(
      bundleMigrationTool.execute({ workspaceSlug: "alpha" }, makeCtx(supabase)),
    ).rejects.toThrow(/already exists/i);
  });

  it("proceeds when target is non-empty but acknowledgeTargetHasData is true", async () => {
    const supabase = new SupabaseReadClient(
      { url: "https://x", anonKey: "k" },
      vi.fn() as unknown as typeof fetch,
    );
    vi.spyOn(supabase, "count").mockResolvedValue(1);

    const result = await bundleMigrationTool.execute(
      { workspaceSlug: "alpha", acknowledgeTargetHasData: true },
      makeCtx(supabase),
    );
    expect(existsSync(result.bundlePath)).toBe(true);
  });

  it("throws when no .sql files exist in the workspace directory", async () => {
    rmSync(workspaceDir, { recursive: true });
    mkdirSync(workspaceDir);
    await expect(
      bundleMigrationTool.execute({ workspaceSlug: "alpha" }, makeCtx(null)),
    ).rejects.toThrow(/no.*sql/i);
  });

  it("counts INSERTs for dot-qualified table names like auth.users", async () => {
    writeFileSync(
      join(workspaceDir, "03_auth.sql"),
      "BEGIN;\nINSERT INTO auth.users (id) VALUES ('x');\nINSERT INTO auth.users (id) VALUES ('y');\nCOMMIT;\n",
    );

    const result = await bundleMigrationTool.execute(
      { workspaceSlug: "alpha" },
      makeCtx(null),
    );

    expect(result.insertsByTable["auth.users"]).toBe(2);
  });
});
