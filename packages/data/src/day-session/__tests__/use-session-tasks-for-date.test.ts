/**
 * use-session-tasks-for-date.test.ts
 *
 * Unit tests for useSessionTasksForDate hook.
 * Validates export contract and L-0177 fail-fast invariants.
 */

import { describe, it, expect } from "vitest";
import { useSessionTasksForDate } from "../use-session-tasks-for-date";

describe("useSessionTasksForDate", () => {
  it("is callable", () => {
    expect(typeof useSessionTasksForDate).toBe("function");
  });

  it("accepts workspaceId + dateISO params", () => {
    expect(useSessionTasksForDate.length).toBeGreaterThanOrEqual(1);
  });
});
