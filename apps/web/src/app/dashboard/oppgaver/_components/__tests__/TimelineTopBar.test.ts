import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = readFileSync(join(__dirname, "..", "TimelineTopBar.tsx"), "utf-8");

describe("TimelineTopBar", () => {
  it("renders brand label via t()", () => {
    expect(SRC).toMatch(/t\(["']oppgaver\.brand["']\)/);
  });
  it("renders date stepper with mono font", () => {
    expect(SRC).toMatch(/font-mono/);
  });
  it("renders Lukk-dagen CTA as disabled placeholder V1", () => {
    expect(SRC).toMatch(/disabled/);
    expect(SRC).toMatch(/t\(["']oppgaver\.lukk_dagen["']\)/);
  });
  it("has no inline OKLCH literals", () => {
    expect(SRC).not.toMatch(/oklch\(/);
  });
  it("has no hardcoded zinc/gray/slate classes", () => {
    expect(SRC).not.toMatch(/\b(zinc|gray|slate)-\d/);
  });
  it("has ARIA labels on icon-only buttons", () => {
    expect(SRC).toMatch(/aria-label/);
  });
});
