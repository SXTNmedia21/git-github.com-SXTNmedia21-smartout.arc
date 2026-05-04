import { describe, it, expect, vi } from "vitest";

describe("registry emitPrefix uniqueness", () => {
  it("throws when two capabilities share the same emitPrefix", async () => {
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
