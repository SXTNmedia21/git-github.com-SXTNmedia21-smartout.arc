import { describe, expect, it, vi } from "vitest";

import { createDaySessionVoiceTools } from "../day-session-voice-tools";

describe("createDaySessionVoiceTools", () => {
  it("registers explicit day-session tools with matching implementations", async () => {
    const focusTask = vi.fn();
    const focusField = vi.fn();
    const updateEvidenceDraft = vi.fn();

    const tools = createDaySessionVoiceTools({
      getDaySessionState: () => ({
        dateId: "2026-03-07",
        shifts: [],
        tasks: [],
        summary: {
          staffCount: 0,
          taskCount: 0,
          completedTaskCount: 0,
          tasksMissingEvidence: 0,
          tasksReadyForSignoff: 0,
          criticalWarnings: 0,
          warningCount: 0,
        },
      }),
      focusTask,
      focusField,
      updateEvidenceDraft,
    });

    expect(tools.definitions.map((tool) => tool.temporaryTool.modelToolName)).toEqual([
      "getDaySessionState",
      "focusTask",
      "focusField",
      "updateEvidenceDraft",
    ]);

    expect(tools.implementations.getDaySessionState).toBeDefined();
    expect(tools.implementations.focusTask).toBeDefined();
    expect(tools.implementations.focusField).toBeDefined();
    expect(tools.implementations.updateEvidenceDraft).toBeDefined();

    expect(tools.implementations.getDaySessionState!({})).toContain('"dateId":"2026-03-07"');

    await tools.implementations.focusTask!({ taskId: "task-1" });
    expect(focusTask).toHaveBeenCalledWith("task-1");

    await tools.implementations.focusField!({ fieldId: "note:task-1" });
    expect(focusField).toHaveBeenCalledWith("note:task-1");

    await tools.implementations.updateEvidenceDraft!({
      taskId: "task-1",
      patch: { note: "Captured by agent" },
    });
    expect(updateEvidenceDraft).toHaveBeenCalledWith("task-1", { note: "Captured by agent" });
  });
});
