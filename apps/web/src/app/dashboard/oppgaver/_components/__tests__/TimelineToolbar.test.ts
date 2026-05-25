import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = readFileSync(join(__dirname, "..", "TimelineToolbar.tsx"), "utf-8");

describe("TimelineToolbar", () => {
  it("imports SegmentGroup + FilterChip from @smartout/ui", () => {
    expect(SRC).toMatch(/from ["']@smartout\/ui["']/);
    expect(SRC).toMatch(/SegmentGroup/);
    expect(SRC).toMatch(/FilterChip/);
  });
  it("declares 3 view-mode segments (area, role, person)", () => {
    expect(SRC).toMatch(/value: ["']area["']/);
    expect(SRC).toMatch(/value: ["']role["']/);
    expect(SRC).toMatch(/value: ["']person["']/);
  });
  it("maps over areas prop for chip-bar", () => {
    expect(SRC).toMatch(/areas\.map/);
  });
  // PR #487 stripped the "oppgaver." prefix from t() calls — useTranslation("oppgaver")
  // already scopes the bundle, so keys are looked up relative to the namespace root.
  it("renders Kun åpne + Avvik filter chips via t()", () => {
    expect(SRC).toMatch(/t\(["']filter\.only_open["']\)/);
    expect(SRC).toMatch(/t\(["']filter\.deviations["']\)/);
  });
  it("renders view-mode labels via t()", () => {
    expect(SRC).toMatch(/t\(["']view_mode\.area["']\)/);
    expect(SRC).toMatch(/t\(["']view_mode\.role["']\)/);
    expect(SRC).toMatch(/t\(["']view_mode\.person["']\)/);
  });
  it("has no inline OKLCH literals", () => {
    expect(SRC).not.toMatch(/oklch\(/);
  });
  it("has no hardcoded zinc/gray/slate classes", () => {
    expect(SRC).not.toMatch(/\b(zinc|gray|slate)-\d/);
  });
  it("declares aria-labels on zoom buttons", () => {
    expect(SRC).toMatch(/aria-label/);
  });
});
