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
    // PR #487 stripped the "oppgaver." prefix — useTranslation("oppgaver") scopes
    // the bundle, so keys are looked up relative to the namespace root.
    expect(SRC).toMatch(/t\(["']task_modal/);
  });
  it("has no OKLCH literals", () => expect(SRC).not.toMatch(/oklch\(/));
  it("has no hardcoded zinc/gray/slate", () => expect(SRC).not.toMatch(/\b(zinc|gray|slate)-\d/));

  // HIGH-1: editTime state must be initialised from task.start, not from ""
  // — a blank controlled input disabled Save and broke keyboard a11y.
  it("HIGH-1: editTime initialised from task.start via lazy useState initialiser", () => {
    // useState<string>(() => task?.start ?? "") is the required pattern
    expect(SRC).toMatch(/useState<string>\(\(\) =>/);
    expect(SRC).toMatch(/task\?\.start/);
    // defaultValue must NOT appear on the time input (controlled + uncontrolled conflict)
    expect(SRC).not.toMatch(/defaultValue=\{t_\s*\?/);
  });

  // HIGH-1 continued: useEffect must sync editTime when task changes while modal stays mounted
  it("HIGH-1: useEffect syncs editTime when task prop changes while modal is open", () => {
    expect(SRC).toMatch(/useEffect\(/);
    // Must set editTime from task.start inside the effect
    expect(SRC).toMatch(/setEditTime\(task\.start\)/);
    // Effect must depend on task and editMode
    expect(SRC).toMatch(/\[task,\s*editMode\]/);
  });

  // HIGH-2 + MEDIUM-1: isoScheduledAt must use dateISO prop (not new Date()) and
  // local setHours (not string-interpolated UTC Z suffix).
  it("HIGH-2: isoScheduledAt built via setHours (local time), not hardcoded Z suffix", () => {
    // Must NOT contain the old pattern that hardcodes Z
    expect(SRC).not.toMatch(/`\$\{datePart\}T\$\{editTime\}:00\.000Z`/);
    // Must use d.setHours pattern matching useDragRetiming
    expect(SRC).toMatch(/d\.setHours\(hh/);
    expect(SRC).toMatch(/d\.toISOString\(\)/);
  });

  it("MEDIUM-1: datePart uses dateISO prop, not new Date()", () => {
    // The old pattern: new Date().toISOString().slice(0, 10) must be gone from handleSaveEdit
    expect(SRC).not.toMatch(/new Date\(\)\.toISOString\(\)\.slice\(0, 10\)/);
    // dateISO prop must appear in Props type and be used when constructing the Date
    expect(SRC).toMatch(/dateISO:\s*string/);
    expect(SRC).toMatch(/new Date\(dateISO/);
  });
});
