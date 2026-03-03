import { describe, it, expect } from "vitest";
import {
  getDepartmentsForIndustry,
  getPositionsForDepartment,
  INDUSTRY_NACE_MAP,
} from "../lib/industry-defaults";

describe("getDepartmentsForIndustry", () => {
  it("returns restaurant defaults for NACE 56.101", () => {
    const deps = getDepartmentsForIndustry("56.101");
    const names = deps.map((d) => d.name);
    expect(names).toContain("Kjøkken");
    expect(names).toContain("Sal");
    expect(names).toContain("Bar");
    expect(deps.slice(0, 3).every((d) => d.selected)).toBe(true);
  });

  it("returns hotel defaults for NACE 55.101", () => {
    const deps = getDepartmentsForIndustry("55.101");
    const names = deps.map((d) => d.name);
    expect(names).toContain("Resepsjon");
    expect(names).toContain("Housekeeping");
  });

  it("returns generic defaults for unknown NACE", () => {
    const deps = getDepartmentsForIndustry("99.999");
    expect(deps.length).toBeGreaterThan(0);
    expect(deps[0].name).toBe("Administrasjon");
  });

  it("maps industry description to NACE code", () => {
    expect(INDUSTRY_NACE_MAP["restaurant"]).toBe("56.101");
    expect(INDUSTRY_NACE_MAP["hotell"]).toBe("55.101");
  });
});

describe("getPositionsForDepartment", () => {
  it("returns kitchen positions for Kjøkken", () => {
    const positions = getPositionsForDepartment("Kjøkken");
    expect(positions).toContain("Kokk");
    expect(positions).toContain("Sous Chef");
    expect(positions).toContain("Kjøkkenassistent");
  });

  it("returns empty array for unknown department", () => {
    const positions = getPositionsForDepartment("Unknown");
    expect(positions).toEqual([]);
  });
});
