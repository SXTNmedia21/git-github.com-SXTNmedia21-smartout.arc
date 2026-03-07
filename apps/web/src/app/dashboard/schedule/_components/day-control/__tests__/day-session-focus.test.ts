import { describe, expect, it } from "vitest";

import { isTaskFocused, isTaskFieldFocused } from "../day-session-focus";

describe("day-session focus helpers", () => {
  it("matches the focused task id exactly", () => {
    expect(isTaskFocused("task-1", "task-1")).toBe(true);
    expect(isTaskFocused("task-1", "task-2")).toBe(false);
  });

  it("matches focused field prefixes for the same task", () => {
    expect(isTaskFieldFocused("task-1", "assignee:task-1", "assignee")).toBe(true);
    expect(isTaskFieldFocused("task-1", "note:task-1", "note")).toBe(true);
    expect(isTaskFieldFocused("task-1", "measurement:task-2", "measurement")).toBe(false);
    expect(isTaskFieldFocused("task-1", null, "measurement")).toBe(false);
  });
});
