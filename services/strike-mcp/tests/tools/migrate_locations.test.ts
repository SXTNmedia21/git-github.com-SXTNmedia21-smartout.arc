import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrateLocationsTool } from "../../src/tools/migrate_locations.js";
import { BubbleClient } from "../../src/bubble/client.js";
import type { Mapping } from "../../src/research/mapping.js";

function makeReadyMapping(): Mapping {
  return {
    entity: "locations",
    bubble_type: "location",
    target_table: "locations",
    field_map: {
      _id: {
        target: "id",
        transform: "fk_uuid:locations",
        needs_review: false,
        source_value_types: ["string"],
        occurrence_count: 5,
        sample_values: [],
      },
      "🏰 Workspace": {
        target: "workspace_id",
        transform: "fk_uuid:workspaces",
        needs_review: false,
        source_value_types: ["string"],
        occurrence_count: 5,
        sample_values: [],
      },
      name_text: {
        target: "name",
        transform: "trim",
        needs_review: false,
        source_value_types: ["string"],
        occurrence_count: 5,
        sample_values: [],
      },
    },
    required_source_fields: ["_id", "🏰 Workspace", "name_text"],
    skip_if_missing: [],
    known_quirks: [],
    last_verified: "2026-04-07",
    sample_record_count: 5,
    total_record_count: 5,
  };
}

describe("migrate_locations tool", () => {
  let mappingsDir: string;
  let stagingDir: string;

  beforeEach(() => {
    mappingsDir = mkdtempSync(join(tmpdir(), "strike-l-mappings-"));
    stagingDir = mkdtempSync(join(tmpdir(), "strike-l-staging-"));
    writeFileSync(join(mappingsDir, "locations.json"), JSON.stringify(makeReadyMapping(), null, 2));
    writeFileSync(
      join(mappingsDir, "workspaces.json"),
      JSON.stringify(
        { ...makeReadyMapping(), entity: "workspaces", bubble_type: "workspace", target_table: "workspaces" },
        null,
        2,
      ),
    );
  });

  afterEach(() => {
    rmSync(mappingsDir, { recursive: true, force: true });
    rmSync(stagingDir, { recursive: true, force: true });
  });

  function makeClient(
    workspaceRecord: Record<string, unknown>,
    locationRecords: Array<Record<string, unknown>>,
  ): BubbleClient {
    const client = new BubbleClient(
      { bubbleAppUrl: "https://x", bubbleApiToken: "t" },
      vi.fn() as unknown as typeof fetch,
    );
    vi.spyOn(client, "listAll").mockImplementation(async (type: string) => {
      if (type === "workspace") return [workspaceRecord] as never;
      if (type === "location") return locationRecords as never;
      return [] as never;
    });
    return client;
  }

  it("emits one row per location belonging to the workspace", async () => {
    const client = makeClient(
      { _id: "ws1", name_text: "Alpha Workspace" },
      [
        { _id: "loc1", "🏰 Workspace": "ws1", name_text: "Main Floor" },
        { _id: "loc2", "🏰 Workspace": "ws1", name_text: "Kitchen" },
        { _id: "loc3", "🏰 Workspace": "ws1", name_text: "Bar" },
      ],
    );

    const result = await migrateLocationsTool.execute(
      { workspaceId: "ws1" },
      {
        bubble: client,
        mappingsDir,
        vaultBubbleShapesDir: "",
        stagingDir,
        supabase: null,
      },
    );

    expect(result.recordsEmitted).toBe(3);
    expect(result.recordsSkipped).toBe(0);
    expect(result.sqlFilePath).toMatch(/02_locations\.sql$/);
    expect(result.workspaceSlug).toBe("alpha-workspace");

    const sql = readFileSync(result.sqlFilePath, "utf-8");
    expect((sql.match(/INSERT INTO locations/g) ?? []).length).toBe(3);
    expect(sql).toContain("'Main Floor'");
    expect(sql).toContain("'Kitchen'");
    expect(sql).toContain("'Bar'");
  });

  it("skips records belonging to other workspaces (defensive client-side filter)", async () => {
    const client = makeClient(
      { _id: "ws1", name_text: "Target" },
      [
        { _id: "loc1", "🏰 Workspace": "ws1", name_text: "Mine" },
        { _id: "loc2", "🏰 Workspace": "wsOther", name_text: "Not mine" },
      ],
    );

    const result = await migrateLocationsTool.execute(
      { workspaceId: "ws1" },
      {
        bubble: client,
        mappingsDir,
        vaultBubbleShapesDir: "",
        stagingDir,
        supabase: null,
      },
    );

    expect(result.recordsEmitted).toBe(1);
  });

  it("throws if locations mapping is unreviewed", async () => {
    const m = makeReadyMapping();
    m.field_map.name_text.needs_review = true;
    writeFileSync(join(mappingsDir, "locations.json"), JSON.stringify(m, null, 2));

    const client = makeClient({ _id: "ws1", name_text: "x" }, []);
    await expect(
      migrateLocationsTool.execute(
        { workspaceId: "ws1" },
        { bubble: client, mappingsDir, vaultBubbleShapesDir: "", stagingDir, supabase: null },
      ),
    ).rejects.toThrow(/needs_review/i);
  });
});
