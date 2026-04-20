import { describe, it, expect } from "vitest";
import {
  ENTITY_REGISTRY,
  getEntityByName,
  allEntityNames,
} from "../src/entities.js";

describe("entity registry", () => {
  it("includes workspace as a known entity", () => {
    const ws = getEntityByName("workspace");
    expect(ws).toBeDefined();
    expect(ws?.bubbleType).toBe("workspace");
  });

  it("lists all entity names", () => {
    const names = allEntityNames();
    expect(names).toContain("workspace");
    expect(names).toContain("locations");
    expect(names).toContain("shifts");
    expect(names.length).toBeGreaterThan(5);
  });

  it("returns undefined for unknown entity", () => {
    expect(getEntityByName("nonexistent")).toBeUndefined();
  });

  it("each entry has a description", () => {
    for (const entry of ENTITY_REGISTRY) {
      expect(entry.description.length).toBeGreaterThan(0);
    }
  });
});
