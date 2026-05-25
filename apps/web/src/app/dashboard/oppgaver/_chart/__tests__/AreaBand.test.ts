import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = readFileSync(join(__dirname, "..", "AreaBand.tsx"), "utf-8");

describe("AreaBand", () => {
  it("imports PersonLane and TaskBlock", () => {
    expect(SRC).toMatch(/from ["']\.\/PersonLane["']/);
    expect(SRC).toMatch(/from ["']\.\/TaskBlock["']/);
  });
  it("imports layoutOverlap for role/person modes", () => {
    expect(SRC).toMatch(/from ["']\.\/layoutOverlap["']/);
  });
  it("renders band header with band.name", () => {
    expect(SRC).toMatch(/band\.name/);
  });
  it("renders employees-on-shift count", () => {
    expect(SRC).toMatch(/employees\.length|employees\.filter|onShift/);
  });
  it("filters tasks by area for mode=area", () => {
    expect(SRC).toMatch(/task\.area === band\.id|task\.area === band|areaTasks/);
  });
  it("renders PersonLane per employee in mode=area", () => {
    expect(SRC).toMatch(/employees\.map/);
    expect(SRC).toMatch(/<PersonLane/);
  });
  it("renders an UnassignedLane for area-anchored tasks without emp", () => {
    expect(SRC).toMatch(/Unassigned|unassigned|!emp|emp == null|emp === null/);
  });
  it("dimmed prop adds opacity-50", () => {
    expect(SRC).toMatch(/dimmed/);
    expect(SRC).toMatch(/opacity-50/);
  });
  it("handles mode=role with layoutOverlap", () => {
    expect(SRC).toMatch(/mode === ["']role["']|mode === "role"/);
    expect(SRC).toMatch(/layoutOverlap/);
  });
  it("has no OKLCH literals", () => {
    expect(SRC).not.toMatch(/oklch\(/);
  });
});
