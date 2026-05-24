import { describe, it, expect } from "vitest";
import { useRolesForPositions } from "../use-roles-for-positions";

describe("useRolesForPositions", () => {
  it("is callable", () => {
    expect(typeof useRolesForPositions).toBe("function");
  });
  it("accepts workspaceId + dateISO params", () => {
    expect(useRolesForPositions.length).toBeGreaterThanOrEqual(1);
  });
});
