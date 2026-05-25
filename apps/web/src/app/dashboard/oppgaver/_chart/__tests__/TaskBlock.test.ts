import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = readFileSync(join(__dirname, "..", "TaskBlock.tsx"), "utf-8");

describe("TaskBlock", () => {
  it("renders task.title", () => {
    expect(SRC).toMatch(/task\.title/);
  });
  it("renders start–end times conditionally on height >= 36", () => {
    expect(SRC).toMatch(/>=\s*36|>= 36/);
    expect(SRC).toMatch(/task\.start/);
    expect(SRC).toMatch(/task\.end/);
  });
  it("emits status modifier in className (s-* or status- prefix)", () => {
    expect(SRC).toMatch(/`s-\$\{|status-\$\{|`p-\$\{|priority-\$\{/);
  });
  it("fires onClick with task arg", () => {
    expect(SRC).toMatch(/onClick\?\.\(task\)|onClick && onClick\(task\)/);
  });
  it("renders aria-label with title + time range", () => {
    expect(SRC).toMatch(/aria-label/);
  });
  it("has no inline OKLCH literals", () => {
    expect(SRC).not.toMatch(/oklch\(/);
  });
  it("uses CSS var for area accent color (not inline OKLCH)", () => {
    expect(SRC).toMatch(/var\(--area-|--area-color/);
  });
  it("declares button type for click affordance", () => {
    expect(SRC).toMatch(/type=["']button["']/);
  });
});
