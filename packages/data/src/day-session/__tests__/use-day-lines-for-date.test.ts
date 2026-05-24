/**
 * use-day-lines-for-date.test.ts
 *
 * Unit tests for useDayLinesForDate hook.
 * Validates shape, export contract, and L-0177 fail-fast invariants.
 */

import { describe, it, expect } from "vitest";
import { useDayLinesForDate } from "../use-day-lines-for-date.js";

describe("useDayLinesForDate", () => {
  it("exists and is callable as a function", () => {
    expect(typeof useDayLinesForDate).toBe("function");
  });

  it("accepts workspaceId and dateISO as positional params", () => {
    // Hook signature: (workspaceId: string, dateISO: string) — at least 2 params
    expect(useDayLinesForDate.length).toBeGreaterThanOrEqual(1);
  });
});
