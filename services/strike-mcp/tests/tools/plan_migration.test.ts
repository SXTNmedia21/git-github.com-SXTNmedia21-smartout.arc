import { describe, it, expect, vi } from "vitest";
import { planMigrationTool } from "../../src/tools/plan_migration.js";
import { BubbleClient } from "../../src/bubble/client.js";

function makeClient(workspaceId: string, locationCount: number): BubbleClient {
  const client = new BubbleClient(
    { bubbleAppUrl: "https://x", bubbleApiToken: "t" },
    vi.fn() as unknown as typeof fetch,
  );
  vi.spyOn(client, "listAll").mockImplementation(async (type: string) => {
    if (type === "workspace") return [{ _id: workspaceId }] as never;
    if (type === "location")
      return Array.from({ length: locationCount }, (_, i) => ({
        _id: `loc${i}`,
        "🏰 Workspace": workspaceId,
      })) as never;
    return [] as never;
  });
  return client;
}

describe("plan_migration tool", () => {
  it("returns migrate_workspace and migrate_locations in order", async () => {
    const client = makeClient("ws1", 3);
    const result = await planMigrationTool.execute(
      { workspaceId: "ws1" },
      {
        bubble: client,
        mappingsDir: "",
        vaultBubbleShapesDir: "",
        stagingDir: "",
        supabase: null,
      },
    );

    expect(result.steps).toHaveLength(2);
    expect(result.steps[0].tool).toBe("migrate_workspace");
    expect(result.steps[0].recordCount).toBe(1);
    expect(result.steps[1].tool).toBe("migrate_locations");
    expect(result.steps[1].recordCount).toBe(3);
  });

  it("omits migrate_locations when there are no locations", async () => {
    const client = makeClient("ws1", 0);
    const result = await planMigrationTool.execute(
      { workspaceId: "ws1" },
      {
        bubble: client,
        mappingsDir: "",
        vaultBubbleShapesDir: "",
        stagingDir: "",
        supabase: null,
      },
    );
    const tools = result.steps.map((s) => s.tool);
    expect(tools).not.toContain("migrate_locations");
  });
});
