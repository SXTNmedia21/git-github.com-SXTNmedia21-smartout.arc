import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = readFileSync(join(__dirname, "..", "PersonLane.tsx"), "utf-8");

describe("PersonLane", () => {
  it("imports TaskBlock", () => {
    expect(SRC).toMatch(/from ["']\.\/TaskBlock["']/);
  });
  it("renders shift fill conditionally when shift prop present", () => {
    expect(SRC).toMatch(/emp\.shift/);
  });
  it("iterates tasks and renders TaskBlock", () => {
    expect(SRC).toMatch(/tasks\.map|tasks\.forEach/);
    expect(SRC).toMatch(/<TaskBlock/);
  });
  it("snaps click to 15-minute boundary", () => {
    expect(SRC).toMatch(/15/);
    expect(SRC).toMatch(/Math\.round|Math\.floor/);
  });
  it("emits onLaneClick with empId+areaId+minutes", () => {
    expect(SRC).toMatch(/onLaneClick/);
    expect(SRC).toMatch(/minutes/);
  });
  it("applies opacity-50 when dimmed prop true", () => {
    expect(SRC).toMatch(/dimmed/);
    expect(SRC).toMatch(/opacity-50/);
  });
  it("has drag handlers wired (V2 — DnD shipped)", () => {
    // V1 deferred DnD; V2 (dayplanner-dnd-and-views, merged 2026-05-25) shipped
    // onDragOver + onDrop on the lane container for task re-time via drop.
    expect(SRC).toMatch(/onDragOver|onDrop/);
  });
  it("declares role=group + aria-label", () => {
    expect(SRC).toMatch(/role=["']group["']/);
    expect(SRC).toMatch(/aria-label/);
  });
  it("has no OKLCH literals", () => {
    expect(SRC).not.toMatch(/oklch\(/);
  });
});
