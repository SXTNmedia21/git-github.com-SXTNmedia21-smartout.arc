import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(__dirname, "..");
const gutter = readFileSync(join(dir, "TimeGutter.tsx"), "utf-8");
const strips = readFileSync(join(dir, "RoutineStrips.tsx"), "utf-8");
const now = readFileSync(join(dir, "NowLine.tsx"), "utf-8");
const past = readFileSync(join(dir, "PastDim.tsx"), "utf-8");
const phases = readFileSync(join(dir, "routinePhases.ts"), "utf-8");

describe("TimeGutter", () => {
  it("uses font-mono for hour labels", () => {
    expect(gutter).toMatch(/font-mono/);
  });
  it("uses text-muted-foreground", () => {
    expect(gutter).toMatch(/text-muted-foreground/);
  });
  it("has no OKLCH literals", () => {
    expect(gutter).not.toMatch(/oklch\(/);
  });
});

describe("RoutineStrips", () => {
  it("references phase tokens (CSS var or TS import)", () => {
    expect(strips).toMatch(/--phase-|tokens\.phase|phase\./);
  });
  it("has no inline OKLCH literals", () => {
    expect(strips).not.toMatch(/oklch\(/);
  });
  it("has no hardcoded zinc/gray/slate", () => {
    expect(strips).not.toMatch(/\b(zinc|gray|slate)-\d/);
  });
});

describe("NowLine", () => {
  it("imports useReducedMotion from framer-motion", () => {
    expect(now).toMatch(/useReducedMotion.*framer-motion|framer-motion.*useReducedMotion/);
  });
  it("gates animation on prefersReducedMotion", () => {
    expect(now).toMatch(/prefersReducedMotion|reducedMotion/);
  });
  it("has no inline OKLCH literals", () => {
    expect(now).not.toMatch(/oklch\(/);
  });
});

describe("PastDim", () => {
  it("uses semantic foreground opacity, not inline OKLCH alpha", () => {
    expect(past).toMatch(/bg-foreground\/\d+/);
    expect(past).not.toMatch(/oklch\(/);
  });
});

describe("routinePhases", () => {
  it("exports 8 phases mirroring fixture ROUTINE", () => {
    const matches = phases.match(/\{[^}]*name:/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(8);
  });
  it("each phase has name + start + end + phase-kind", () => {
    expect(phases).toMatch(/start:/);
    expect(phases).toMatch(/end:/);
    expect(phases).toMatch(/kind:/);
  });
});
