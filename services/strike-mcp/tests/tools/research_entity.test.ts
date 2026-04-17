import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { researchEntityTool } from "../../src/tools/research_entity.js";
import { BubbleClient } from "../../src/bubble/client.js";
import { saveMapping, type Mapping } from "../../src/research/mapping.js";

function makeClient(
  firstN: Array<Record<string, unknown>>,
  lastN: Array<Record<string, unknown>>,
  totalCount: number,
): BubbleClient {
  const client = new BubbleClient(
    { bubbleAppUrl: "https://x", bubbleApiToken: "t" },
    vi.fn() as unknown as typeof fetch,
  );
  vi.spyOn(client, "sampleBidirectional").mockResolvedValue({
    firstN: firstN as never,
    lastN: lastN as never,
    totalCount,
  });
  return client;
}

describe("research_entity tool", () => {
  let mappingsDir: string;
  let vaultDir: string;

  beforeEach(() => {
    mappingsDir = mkdtempSync(join(tmpdir(), "strike-research-map-"));
    vaultDir = mkdtempSync(join(tmpdir(), "strike-research-vault-"));
  });

  afterEach(() => {
    rmSync(mappingsDir, { recursive: true, force: true });
    rmSync(vaultDir, { recursive: true, force: true });
  });

  it("throws on unknown entity", async () => {
    const client = makeClient([], [], 0);
    await expect(
      researchEntityTool.execute(
        { entity: "nope-not-real" },
        { bubble: client, mappingsDir, vaultBubbleShapesDir: vaultDir, stagingDir: "", supabase: null },
      ),
    ).rejects.toThrow(/Unknown entity/);
  });

  it("creates a fresh mapping when none exists, marking all fields needs_review", async () => {
    const client = makeClient(
      [
        { _id: "a", name_text: "Alpha", "Created Date": "2026-01-01" },
        { _id: "b", name_text: "Beta" },
      ],
      [{ _id: "c", name_text: "Gamma" }],
      3,
    );

    const result = await researchEntityTool.execute(
      { entity: "workspace" },
      { bubble: client, mappingsDir, vaultBubbleShapesDir: vaultDir, stagingDir: "", supabase: null },
    );

    expect(result.entity).toBe("workspace");
    expect(result.bubbleType).toBe("workspace");
    expect(result.sampleRecordCount).toBe(3);
    expect(result.totalRecordCount).toBe(3);
    expect(result.newFields.sort()).toEqual(
      ["Created Date", "_id", "name_text"].sort(),
    );
    expect(result.disappearedFields).toEqual([]);
    expect(result.typeChanges).toEqual([]);
    expect(result.unreviewedFieldCount).toBeGreaterThan(0);

    expect(existsSync(join(mappingsDir, "workspace.json"))).toBe(true);
    expect(existsSync(join(vaultDir, "workspace.md"))).toBe(true);

    const saved = JSON.parse(
      readFileSync(join(mappingsDir, "workspace.json"), "utf-8"),
    ) as Mapping;
    expect(saved.entity).toBe("workspace");
    expect(saved.bubble_type).toBe("workspace");
    expect(saved.total_record_count).toBe(3);
    expect(saved.sample_record_count).toBe(3);
    expect(saved.field_map.name_text.needs_review).toBe(true);
  });

  it("dedupes records by _id when firstN and lastN overlap", async () => {
    const client = makeClient(
      [
        { _id: "a", name_text: "Alpha" },
        { _id: "b", name_text: "Beta" },
      ],
      [
        { _id: "b", name_text: "Beta" },
        { _id: "c", name_text: "Gamma" },
      ],
      3,
    );

    const result = await researchEntityTool.execute(
      { entity: "workspace" },
      { bubble: client, mappingsDir, vaultBubbleShapesDir: vaultDir, stagingDir: "", supabase: null },
    );

    expect(result.sampleRecordCount).toBe(3);
  });

  it("preserves human decisions on existing mapping fields", async () => {
    const existing: Mapping = {
      entity: "workspace",
      bubble_type: "workspace",
      target_table: "workspaces",
      field_map: {
        name_text: {
          target: "display_name",
          transform: "trim",
          needs_review: false,
          source_value_types: ["string"],
          occurrence_count: 10,
          sample_values: ["Old"],
        },
      },
      required_source_fields: [],
      skip_if_missing: [],
      known_quirks: ["legacy quirk"],
      last_verified: "2026-01-01",
      sample_record_count: 10,
      total_record_count: 10,
    };
    await saveMapping(mappingsDir, existing);

    const client = makeClient(
      [
        { _id: "a", name_text: "Alpha", new_field: "x" },
        { _id: "b", name_text: "Beta" },
      ],
      [],
      2,
    );

    const result = await researchEntityTool.execute(
      { entity: "workspace" },
      { bubble: client, mappingsDir, vaultBubbleShapesDir: vaultDir, stagingDir: "", supabase: null },
    );

    const saved = JSON.parse(
      readFileSync(join(mappingsDir, "workspace.json"), "utf-8"),
    ) as Mapping;

    expect(saved.field_map.name_text.target).toBe("display_name");
    expect(saved.field_map.name_text.transform).toBe("trim");
    expect(saved.field_map.name_text.needs_review).toBe(false);
    expect(saved.field_map.name_text.occurrence_count).toBe(2);
    expect(saved.target_table).toBe("workspaces");
    expect(saved.known_quirks).toEqual(["legacy quirk"]);

    expect(result.newFields).toContain("new_field");
    expect(saved.field_map.new_field.needs_review).toBe(true);
  });

  it("returns mapping and narrative paths", async () => {
    const client = makeClient([{ _id: "a" }], [], 1);
    const result = await researchEntityTool.execute(
      { entity: "workspace" },
      { bubble: client, mappingsDir, vaultBubbleShapesDir: vaultDir, stagingDir: "", supabase: null },
    );
    expect(result.mappingPath).toBe(join(mappingsDir, "workspace.json"));
    expect(result.narrativePath).toBe(join(vaultDir, "workspace.md"));
  });
});
