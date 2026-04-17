import { describe, it, expect, vi } from "vitest";
import { inspectWorkspaceTool } from "../../src/tools/inspect_workspace.js";
import { BubbleClient } from "../../src/bubble/client.js";
import { BubbleNotFoundError, BubbleApiError } from "../../src/bubble/errors.js";

function makeClientWith(
  perType: Record<string, Array<Record<string, unknown>> | Error>,
): BubbleClient {
  const client = new BubbleClient(
    { bubbleAppUrl: "https://x", bubbleApiToken: "t" },
    vi.fn() as unknown as typeof fetch,
  );
  vi.spyOn(client, "listAll").mockImplementation(async (type: string) => {
    const entry = perType[type];
    if (entry === undefined) return [] as never;
    if (entry instanceof Error) throw entry;
    return entry as never;
  });
  return client;
}

describe("inspect_workspace tool", () => {
  it("returns counts for each entity type", async () => {
    const client = makeClientWith({
      location: [{ _id: "l1" }, { _id: "l2" }],
      "🏠department": [{ _id: "d1" }],
      "🎎team": [],
      user: [{ _id: "u1" }, { _id: "u2" }, { _id: "u3" }],
      shift: [{ _id: "s1" }],
      shift_template: [],
      task: [],
      routine: [],
      manual: [],
      training: [],
      inventory_item: [],
      supplement: [],
      rule: [],
    });
    const result = await inspectWorkspaceTool.execute(
      { workspaceId: "ws-1" },
      { bubble: client, mappingsDir: "", vaultBubbleShapesDir: "", stagingDir: "", supabase: null },
    );
    expect(result.workspaceId).toBe("ws-1");
    expect(result.counts.locations).toBe(2);
    expect(result.counts.departments).toBe(1);
    expect(result.counts.users).toBe(3);
    expect(result.counts.shifts).toBe(1);
    expect(result.errors).toEqual([]);
  });

  it("records 404 errors per entity without failing the tool", async () => {
    const client = makeClientWith({
      location: [{ _id: "l1" }],
      "🏠department": new BubbleNotFoundError("type not found", null),
      "🎎team": [],
      user: [],
      shift_satellite: [],
      shift_template: [],
      task: [],
      routine: [],
      manual: [],
      training: [],
      inventory_item: [],
      supplement: [],
      rule: [],
    });
    const result = await inspectWorkspaceTool.execute(
      { workspaceId: "ws-1" },
      { bubble: client, mappingsDir: "", vaultBubbleShapesDir: "", stagingDir: "", supabase: null },
    );
    expect(result.counts.locations).toBe(1);
    expect(result.counts.departments).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].entity).toBe("departments");
  });

  it("rethrows non-404 Bubble errors", async () => {
    const client = makeClientWith({
      location: new BubbleApiError("boom", 500, null),
      "🏠department": [],
      "🎎team": [],
      user: [],
      shift_satellite: [],
      shift_template: [],
      task: [],
      routine: [],
      manual: [],
      training: [],
      inventory_item: [],
      supplement: [],
      rule: [],
    });
    await expect(
      inspectWorkspaceTool.execute({ workspaceId: "ws-1" }, { bubble: client, mappingsDir: "", vaultBubbleShapesDir: "", stagingDir: "", supabase: null }),
    ).rejects.toBeInstanceOf(BubbleApiError);
  });

  it("passes the workspace constraint to listAll for non-workspace entities", async () => {
    const client = new BubbleClient(
      { bubbleAppUrl: "https://x", bubbleApiToken: "t" },
      vi.fn() as unknown as typeof fetch,
    );
    const spy = vi.spyOn(client, "listAll").mockResolvedValue([] as never);

    await inspectWorkspaceTool.execute(
      { workspaceId: "ws-1" },
      { bubble: client, mappingsDir: "", vaultBubbleShapesDir: "", stagingDir: "", supabase: null },
    );

    const firstCall = spy.mock.calls.find((c) => c[0] === "location");
    expect(firstCall).toBeDefined();
    const opts = firstCall![1] as { constraints?: unknown[] };
    expect(opts.constraints).toBeDefined();
    expect(opts.constraints).toHaveLength(1);
  });
});
