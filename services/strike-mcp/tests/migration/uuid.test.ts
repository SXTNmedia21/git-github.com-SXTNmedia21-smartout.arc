import { describe, it, expect } from "vitest";
import { strikeUuid, STRIKE_NAMESPACE_UUID } from "../../src/migration/uuid.js";

describe("strikeUuid", () => {
  it("returns a valid UUID v5", () => {
    const id = strikeUuid("workspaces", "1612345678901x111111111111111111");
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("is deterministic — same inputs produce same UUID", () => {
    const id1 = strikeUuid("workspaces", "1612345678901x111111111111111111");
    const id2 = strikeUuid("workspaces", "1612345678901x111111111111111111");
    expect(id1).toBe(id2);
  });

  it("different entities produce different UUIDs for the same Bubble ID", () => {
    const ws = strikeUuid("workspaces", "abc123");
    const loc = strikeUuid("locations", "abc123");
    expect(ws).not.toBe(loc);
  });

  it("different Bubble IDs produce different UUIDs for the same entity", () => {
    const a = strikeUuid("workspaces", "abc123");
    const b = strikeUuid("workspaces", "def456");
    expect(a).not.toBe(b);
  });

  it("STRIKE_NAMESPACE_UUID is a constant valid UUID", () => {
    expect(STRIKE_NAMESPACE_UUID).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});
