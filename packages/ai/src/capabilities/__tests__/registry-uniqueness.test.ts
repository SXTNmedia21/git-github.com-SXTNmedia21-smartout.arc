import { describe, it, expect, vi } from "vitest";

// 30s per-test timeout — cold-start of full real registry import
// (Phase 7f tariff tools pushed cold-start past 10s default; mirrors capabilities-source.test.ts)
describe("registry emitPrefix uniqueness", () => {
  it("throws when two capabilities share the same emitPrefix", { timeout: 30000 }, async () => {
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

  it("does not throw on current registry (HEAD must be valid)", { timeout: 30000 }, async () => {
    vi.doUnmock("../memory/index.js");
    vi.resetModules();
    const { getAllCapabilities } = await import("../registry.js");
    expect(() => getAllCapabilities()).not.toThrow();
  });
});
