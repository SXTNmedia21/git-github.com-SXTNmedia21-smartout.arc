import { describe, expect, it } from "vitest";

import { toDbDayTaskUpdate } from "../schedule-mappers";

describe("toDbDayTaskUpdate", () => {
  it("persists explicit null clears for assignee and completed timestamp", () => {
    const result = toDbDayTaskUpdate({
      assignedTo: null,
      completedAt: null,
    });

    expect(result.assigned_to).toBeNull();
    expect(result.completed_at).toBeNull();
  });
});
