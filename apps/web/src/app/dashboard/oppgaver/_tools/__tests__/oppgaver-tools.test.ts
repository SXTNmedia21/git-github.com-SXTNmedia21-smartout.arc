import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SHELL = readFileSync(
  join(__dirname, "..", "..", "_components", "ManagerTimelineShell.tsx"),
  "utf-8",
);
const BRIDGE = readFileSync(join(__dirname, "..", "oppgaver-tools-bridge.tsx"), "utf-8");

describe("L-0340 emit-site presence", () => {
  it("emits oppgaver.view_opened on mount", () => {
    expect(SHELL + BRIDGE).toMatch(/event:\s*["']oppgaver\.view_opened["']/);
  });
  it("emits oppgaver.view_mode_changed on segment switch", () => {
    expect(SHELL + BRIDGE).toMatch(/event:\s*["']oppgaver\.view_mode_changed["']/);
  });
  it("emits oppgaver.area_filter_changed on chip toggle", () => {
    expect(SHELL + BRIDGE).toMatch(/event:\s*["']oppgaver\.area_filter_changed["']/);
  });
  it("emits oppgaver.date_changed on stepper", () => {
    expect(SHELL + BRIDGE).toMatch(/event:\s*["']oppgaver\.date_changed["']/);
  });
  it("emits oppgaver.task_focused on modal open", () => {
    expect(SHELL + BRIDGE).toMatch(/event:\s*["']oppgaver\.task_focused["']/);
  });
  it("emits oppgaver.context_pinned on bridge effect or pin action", () => {
    expect(BRIDGE + SHELL).toMatch(/event:\s*["']oppgaver\.context_pinned["']/);
  });
});

describe("oppgaver tools bridge", () => {
  it("registers under key 'oppgaver'", () => {
    expect(BRIDGE).toMatch(/useRegisterTools\(["']oppgaver["']/);
  });
});
