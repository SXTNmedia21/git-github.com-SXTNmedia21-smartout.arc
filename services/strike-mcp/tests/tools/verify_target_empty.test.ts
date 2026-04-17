import { describe, it, expect, vi } from "vitest";
import { verifyTargetEmptyTool } from "../../src/tools/verify_target_empty.js";
import { SupabaseReadClient } from "../../src/supabase/client.js";
import { BubbleClient } from "../../src/bubble/client.js";

function makeCtx(supabase: SupabaseReadClient | null) {
  return {
    bubble: new BubbleClient(
      { bubbleAppUrl: "https://x", bubbleApiToken: "t" },
      vi.fn() as unknown as typeof fetch,
    ),
    mappingsDir: "",
    vaultBubbleShapesDir: "",
    stagingDir: "",
    supabase,
  };
}

describe("verify_target_empty tool", () => {
  it("returns empty: true when no workspace with the slug exists", async () => {
    const supabase = new SupabaseReadClient(
      { url: "https://x", anonKey: "k" },
      vi.fn() as unknown as typeof fetch,
    );
    vi.spyOn(supabase, "count").mockResolvedValue(0);

    const result = await verifyTargetEmptyTool.execute(
      { workspaceSlug: "alpha" },
      makeCtx(supabase),
    );

    expect(result.empty).toBe(true);
    expect(result.counts.workspaces).toBe(0);
  });

  it("returns empty: false when a workspace with the slug exists", async () => {
    const supabase = new SupabaseReadClient(
      { url: "https://x", anonKey: "k" },
      vi.fn() as unknown as typeof fetch,
    );
    vi.spyOn(supabase, "count").mockResolvedValue(1);

    const result = await verifyTargetEmptyTool.execute(
      { workspaceSlug: "alpha" },
      makeCtx(supabase),
    );

    expect(result.empty).toBe(false);
    expect(result.counts.workspaces).toBe(1);
    expect(result.message).toMatch(/already exists/i);
  });

  it("throws with helpful message when supabase is not configured", async () => {
    await expect(
      verifyTargetEmptyTool.execute({ workspaceSlug: "alpha" }, makeCtx(null)),
    ).rejects.toThrow(/SUPABASE_URL/);
  });
});
