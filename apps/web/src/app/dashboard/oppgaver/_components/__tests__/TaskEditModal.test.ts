import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = readFileSync(join(__dirname, "..", "TaskEditModal.tsx"), "utf-8");

describe("TaskEditModal", () => {
  it("imports Sheet (or Dialog) from shadcn/ui", () => {
    expect(SRC).toMatch(/from ["']@\/components\/ui\/(sheet|dialog)["']/);
  });
  it("imports completeSessionTaskAction (no direct supabase write)", () => {
    expect(SRC).toMatch(/completeSessionTaskAction/);
    expect(SRC).not.toMatch(/supabase\.from\(["'].*["']\)\.(insert|update|delete|upsert)/);
  });
  it("renders task.title", () => expect(SRC).toMatch(/task\.title/));
  it("renders time range", () => {
    expect(SRC).toMatch(/task\.start/);
    expect(SRC).toMatch(/task\.end/);
  });
  it("renders complete button conditionally on status", () => {
    expect(SRC).toMatch(/task\.status/);
  });
  it("uses t() for labels via @smartout/i18n", () => {
    expect(SRC).toMatch(/useTranslation/);
    expect(SRC).toMatch(/t\(["']oppgaver\.task_modal/);
  });
  it("has no OKLCH literals", () => expect(SRC).not.toMatch(/oklch\(/));
  it("has no hardcoded zinc/gray/slate", () => expect(SRC).not.toMatch(/\b(zinc|gray|slate)-\d/));
});
