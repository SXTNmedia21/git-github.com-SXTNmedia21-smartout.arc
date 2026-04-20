import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrateWorkspaceTool } from "../../src/tools/migrate_workspace.js";
import { BubbleClient } from "../../src/bubble/client.js";
import type { Mapping } from "../../src/research/mapping.js";

function makeReadyMapping(): Mapping {
  return {
    entity: "workspace",
    bubble_type: "workspace",
    target_table: "public.workspace",
    field_map: {
      _id: {
        target: "id",
        transform: "fk_uuid:workspace",
        needs_review: false,
        source_value_types: ["string"],
        occurrence_count: 1,
        sample_values: [],
      },
      name_text: {
        target: "name",
        transform: "trim",
        needs_review: false,
        source_value_types: ["string"],
        occurrence_count: 1,
        sample_values: [],
      },
    },
    required_source_fields: ["_id", "name_text"],
    skip_if_missing: [],
    known_quirks: [],
    last_verified: "2026-04-07",
    sample_record_count: 1,
    total_record_count: 1,
  };
}

describe("migrate_workspace tool", () => {
  let mappingsDir: string;
  let stagingDir: string;
  let vaultDir: string;

  beforeEach(() => {
    mappingsDir = mkdtempSync(join(tmpdir(), "strike-m-mappings-"));
    stagingDir = mkdtempSync(join(tmpdir(), "strike-m-staging-"));
    vaultDir = mkdtempSync(join(tmpdir(), "strike-m-vault-"));
    writeFileSync(
      join(mappingsDir, "workspace.json"),
      JSON.stringify(makeReadyMapping(), null, 2),
    );
  });

  afterEach(() => {
    rmSync(mappingsDir, { recursive: true, force: true });
    rmSync(stagingDir, { recursive: true, force: true });
    rmSync(vaultDir, { recursive: true, force: true });
  });

  function makeClient(workspaceRecord: Record<string, unknown>): BubbleClient {
    const client = new BubbleClient(
      { bubbleAppUrl: "https://x", bubbleApiToken: "t" },
      vi.fn() as unknown as typeof fetch,
    );
    vi.spyOn(client, "listAll").mockResolvedValue([workspaceRecord] as never);
    return client;
  }

  it("emits SQL and report files for a known workspace", async () => {
    const client = makeClient({
      _id: "1612345678901x111111111111111111",
      name_text: "Strøm Mat & Bar",
    });

    const result = await migrateWorkspaceTool.execute(
      { workspaceId: "1612345678901x111111111111111111" },
      {
        bubble: client,
        mappingsDir,
        vaultBubbleShapesDir: vaultDir,
        stagingDir,
        supabase: null,
      },
    );

    expect(result.recordsProcessed).toBe(1);
    expect(result.recordsEmitted).toBe(1);
    expect(result.recordsSkipped).toBe(0);
    expect(existsSync(result.sqlFilePath)).toBe(true);
    expect(existsSync(result.reportFilePath)).toBe(true);
    expect(result.workspaceSlug).toBe("strom-mat-bar");
    expect(result.sqlFilePath).toContain("/strom-mat-bar/");
    expect(result.sqlFilePath).toMatch(/01_workspace\.sql$/);

    const sql = readFileSync(result.sqlFilePath, "utf-8");
    expect(sql).toContain("BEGIN;");
    expect(sql).toContain("COMMIT;");
    expect(sql).toContain("INSERT INTO public.workspace");
    expect(sql).toContain("'Strøm Mat & Bar'");
  });

  it("throws if mapping has any unreviewed fields", async () => {
    const m = makeReadyMapping();
    m.field_map.name_text.needs_review = true;
    writeFileSync(join(mappingsDir, "workspace.json"), JSON.stringify(m, null, 2));

    const client = makeClient({ _id: "x", name_text: "y" });
    await expect(
      migrateWorkspaceTool.execute(
        { workspaceId: "x" },
        { bubble: client, mappingsDir, vaultBubbleShapesDir: vaultDir, stagingDir, supabase: null },
      ),
    ).rejects.toThrow(/needs_review/i);
  });

  it("throws if mappings/workspace.json does not exist", async () => {
    rmSync(join(mappingsDir, "workspace.json"));
    const client = makeClient({ _id: "x", name_text: "y" });
    await expect(
      migrateWorkspaceTool.execute(
        { workspaceId: "x" },
        { bubble: client, mappingsDir, vaultBubbleShapesDir: vaultDir, stagingDir, supabase: null },
      ),
    ).rejects.toThrow(/mapping/i);
  });

  it("throws if no record matches the workspace ID", async () => {
    const client = makeClient({ _id: "different-id", name_text: "x" });
    await expect(
      migrateWorkspaceTool.execute(
        { workspaceId: "wanted-id" },
        { bubble: client, mappingsDir, vaultBubbleShapesDir: vaultDir, stagingDir, supabase: null },
      ),
    ).rejects.toThrow(/not found/i);
  });
});
