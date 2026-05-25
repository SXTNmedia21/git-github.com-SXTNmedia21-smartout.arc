import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = readFileSync(join(__dirname, "..", "segment-group.tsx"), "utf-8");

describe("SegmentGroup", () => {
  it("declares radiogroup role", () => expect(SRC).toMatch(/role=["']radiogroup["']/));

  it("declares radio role per segment", () => expect(SRC).toMatch(/role=["']radio["']/));

  it("declares aria-checked binding", () => expect(SRC).toMatch(/aria-checked/));

  it("has no OKLCH literals", () => expect(SRC).not.toMatch(/oklch\(/));

  it("has no zinc/gray/slate hardcoded color classes", () =>
    expect(SRC).not.toMatch(/\b(zinc|gray|slate)-\d/));

  it("uses semantic tokens", () =>
    expect(SRC).toMatch(/bg-muted|bg-background|text-foreground|text-muted-foreground/));

  it("exports SegmentGroup as named export", () =>
    expect(SRC).toMatch(/export (function|const) SegmentGroup/));

  it("uses cn from ../lib/utils (no hardcoded @/ alias)", () =>
    expect(SRC).toMatch(/from ["']\.\.\/lib\/utils["']/));

  it("accepts onValueChange callback prop", () => expect(SRC).toMatch(/onValueChange/));

  it("accepts segments prop", () => expect(SRC).toMatch(/segments/));

  it("uses focus-visible ring (WCAG 2.4.7)", () => expect(SRC).toMatch(/focus-visible/));
});
