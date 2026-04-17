import { describe, it, expect, vi } from "vitest";
import { listWorkspacesTool } from "../../src/tools/list_workspaces.js";
import { BubbleClient } from "../../src/bubble/client.js";

function makeClient(records: Array<Record<string, unknown>>): BubbleClient {
  const client = new BubbleClient(
    { bubbleAppUrl: "https://x", bubbleApiToken: "t" },
    vi.fn() as unknown as typeof fetch,
  );
  vi.spyOn(client, "listAll").mockResolvedValue(records as never);
  return client;
}

describe("list_workspaces tool", () => {
  it("returns an empty list when no workspaces exist", async () => {
    const client = makeClient([]);
    const result = await listWorkspacesTool.execute({}, { bubble: client, mappingsDir: "", vaultBubbleShapesDir: "", stagingDir: "", supabase: null });
    expect(result.workspaces).toEqual([]);
  });

  it("maps Bubble records to workspace summary objects", async () => {
    const client = makeClient([
      {
        _id: "1612345678901x111111111111111111",
        "Created Date": "2023-01-15T10:00:00.000Z",
        "Modified Date": "2026-03-20T08:42:00.000Z",
        name_text: "Strøm Mat & Bar",
      },
      {
        _id: "1612345678902x222222222222222222",
        "Created Date": "2023-02-01T09:00:00.000Z",
        "Modified Date": "2026-01-10T14:00:00.000Z",
        name_text: "Kafé Ost",
      },
    ]);
    const result = await listWorkspacesTool.execute({}, { bubble: client, mappingsDir: "", vaultBubbleShapesDir: "", stagingDir: "", supabase: null });
    expect(result.workspaces).toHaveLength(2);
    expect(result.workspaces[0]).toEqual({
      id: "1612345678901x111111111111111111",
      name: "Strøm Mat & Bar",
      createdAt: "2023-01-15T10:00:00.000Z",
      modifiedAt: "2026-03-20T08:42:00.000Z",
    });
  });

  it("falls back to '(unnamed)' when no known name key is present", async () => {
    const client = makeClient([
      {
        _id: "abc",
        "Created Date": "2023-01-01T00:00:00.000Z",
      },
    ]);
    const result = await listWorkspacesTool.execute({}, { bubble: client, mappingsDir: "", vaultBubbleShapesDir: "", stagingDir: "", supabase: null });
    expect(result.workspaces[0].name).toBe("(unnamed)");
  });

  it("tries multiple candidate name keys", async () => {
    const client = makeClient([
      { _id: "a", Name: "Alpha" },
      { _id: "b", Titel: "Bravo" },
      { _id: "c", name_text: "Charlie" },
    ]);
    const result = await listWorkspacesTool.execute({}, { bubble: client, mappingsDir: "", vaultBubbleShapesDir: "", stagingDir: "", supabase: null });
    expect(result.workspaces.map((w) => w.name)).toEqual([
      "Alpha",
      "Bravo",
      "Charlie",
    ]);
  });
});
