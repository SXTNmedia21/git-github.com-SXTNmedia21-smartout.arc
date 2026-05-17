import { describe, it, expect, vi } from "vitest";

describe("registry emitPrefix uniqueness", () => {
  // 30s timeout: this test calls vi.resetModules() + vi.doMock() then re-imports
  // ../registry.js which transitively re-compiles every capability module. Cost
  // grows with each new capability sibling (legal added amendment-classifier
  // 2026-05-17 Phase 7d Track 5). Default 10s timeout is too tight under
  // full-suite load — passes in 6-7s isolated but hits the limit when other
  // suites compete for the transform pipeline.
  it("throws when two capabilities share the same emitPrefix", { timeout: 30_000 }, async () => {
    vi.resetModules();
    vi.doMock("../memory/index.js", () => ({
      memoryCapability: {
        name: "memory",
        description: "t",
        tools: [],
        readOnlyTools: [],
        allowedChannels: ["chat"],
        toolAuthPattern: "direct_admin",
        emitPrefix: "schedule", // COLLISION with scheduleCapability
      },
    }));

    const { getAllCapabilities } = await import("../registry.js");
    expect(() => getAllCapabilities()).toThrow(/emitPrefix.*collision/i);
  });

  it("does not throw on current registry (HEAD must be valid)", async () => {
    vi.doUnmock("../memory/index.js");
    vi.resetModules();
    const { getAllCapabilities } = await import("../registry.js");
    expect(() => getAllCapabilities()).not.toThrow();
  });
});
