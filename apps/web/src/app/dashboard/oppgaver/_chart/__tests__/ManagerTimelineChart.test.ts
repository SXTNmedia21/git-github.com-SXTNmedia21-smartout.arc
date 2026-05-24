import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = readFileSync(join(__dirname, "..", "ManagerTimelineChart.tsx"), "utf-8");

describe("ManagerTimelineChart", () => {
  it("imports all chart primitives", () => {
    expect(SRC).toMatch(/from ["']\.\/TimeGutter["']/);
    expect(SRC).toMatch(/from ["']\.\/RoutineStrips["']/);
    expect(SRC).toMatch(/from ["']\.\/NowLine["']/);
    expect(SRC).toMatch(/from ["']\.\/PastDim["']/);
    expect(SRC).toMatch(/from ["']\.\/AreaBand["']/);
  });
  it("uses CSS grid with gutter + body columns", () => {
    expect(SRC).toMatch(/grid-cols-\[.*80px.*1fr\]|gridTemplateColumns/);
  });
  it("declares aria-label on scroll container", () => {
    expect(SRC).toMatch(/aria-label=["'].*[Tt]imeline.*["']/);
  });
  it("declares tabIndex on scroll container for keyboard scroll", () => {
    expect(SRC).toMatch(/tabIndex=\{0\}|tabIndex="0"/);
  });
  it("renders bands via bands.map", () => {
    expect(SRC).toMatch(/bands\.map/);
  });
  it("passes nowMinutes to NowLine and PastDim", () => {
    expect(SRC).toMatch(/<NowLine[\s\S]*currentMin|currentMin=\{nowMinutes\}/);
    expect(SRC).toMatch(/<PastDim/);
  });
  it("sets --hour-h CSS var on chart root from pxPerHour", () => {
    expect(SRC).toMatch(/--hour-h|--hour-height/);
  });
  it("has no inline OKLCH literals", () => {
    expect(SRC).not.toMatch(/oklch\(/);
  });
});
