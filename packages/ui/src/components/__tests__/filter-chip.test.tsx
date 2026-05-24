import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = readFileSync(join(__dirname, "..", "filter-chip.tsx"), "utf-8");

describe("FilterChip", () => {
  it("declares aria-pressed binding", () => {
    expect(SRC).toMatch(/aria-pressed/);
  });
  it("declares button type", () => {
    expect(SRC).toMatch(/type=["']button["']/);
  });
  it("handles onToggle callback", () => {
    expect(SRC).toMatch(/onToggle/);
  });
  it("renders count badge conditionally", () => {
    expect(SRC).toMatch(/count\s*[>!&]/);
  });
  it("supports destructive tone", () => {
    expect(SRC).toMatch(/destructive/);
  });
  it("declares focus-visible ring per WCAG 2.4.11", () => {
    expect(SRC).toMatch(/focus-visible:ring-2/);
  });
  it("uses semantic Nordic Split tokens (no hardcoded)", () => {
    expect(SRC).toMatch(
      /bg-foreground|bg-muted|text-foreground|text-background|text-muted-foreground/,
    );
    expect(SRC).not.toMatch(/\b(zinc|gray|slate)-\d/);
    expect(SRC).not.toMatch(/oklch\(/);
  });
  it("exports FilterChip + FilterChipProps", () => {
    expect(SRC).toMatch(/export (function|const) FilterChip/);
    expect(SRC).toMatch(/export type FilterChipProps/);
  });
});
