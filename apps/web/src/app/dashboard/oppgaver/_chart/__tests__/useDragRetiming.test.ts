/**
 * useDragRetiming tests — pure logic via createDragRetimer().
 *
 * createDragRetimer() is the React-free factory extracted from useDragRetiming.
 * We test it directly in the Node environment (no React dispatcher needed).
 * The hook wrapper (useRef) is covered by integration; unit coverage is here.
 */

import { describe, it, expect } from "vitest";
import { createDragRetimer } from "../useDragRetiming";
import { DAY_START_HOUR, DAY_MINUTES } from "../timeMath";

// ─── Constants ────────────────────────────────────────────────────────────────

const DATE_ISO = "2026-05-25";
const TASK_ID = "00000000-0000-0000-0000-000000000010";
const ASSIGNEE_A = "00000000-0000-0000-0000-000000000001";
const ASSIGNEE_B = "00000000-0000-0000-0000-000000000002";

const DAY_START_MIN = DAY_START_HOUR * 60; // 360 (06:00)
const PX_PER_HOUR = 60;

// Helper: mouseY such that pixel→min calc lands on absoluteMinutes
// rawMin = (mouseY / pxPerHour) * 60 + DAY_START_MIN → mouseY = absoluteMin - DAY_START_MIN
function minToMouseY(absoluteMinutes: number): number {
  return absoluteMinutes - DAY_START_MIN;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("createDragRetimer (pure logic — no React)", () => {
  describe("basic drop", () => {
    it("returns correct newScheduledAt for a simple 13:00 drop", () => {
      const api = createDragRetimer();

      const fromMinutes = 12 * 60; // 720 = 12:00
      const dropMinutes = 13 * 60; // 780 = 13:00

      api.onDragStart(TASK_ID, fromMinutes, ASSIGNEE_A, DATE_ISO);
      api.onDragOver("lane-1", minToMouseY(dropMinutes), 0, PX_PER_HOUR);

      const drop = api.onDragEnd(ASSIGNEE_A);

      expect(drop).not.toBeNull();
      expect(drop!.taskId).toBe(TASK_ID);
      const d = new Date(drop!.newScheduledAt);
      expect(d.getHours()).toBe(13);
      expect(d.getMinutes()).toBe(0);
    });
  });

  describe("snap-to-grid", () => {
    it("snaps down: 13:02 → 13:00 (nearest 5-min, round down)", () => {
      const api = createDragRetimer();

      // 13:02 = 782 min; nearest 5-min = 780 = 13:00
      api.onDragStart(TASK_ID, 12 * 60, null, DATE_ISO);
      api.onDragOver("lane-1", minToMouseY(13 * 60 + 2), 0, PX_PER_HOUR);

      const drop = api.onDragEnd(null);
      expect(drop).not.toBeNull();
      const d = new Date(drop!.newScheduledAt);
      expect(d.getHours()).toBe(13);
      expect(d.getMinutes()).toBe(0);
    });

    it("snaps up: 13:03 → 13:05 (nearest 5-min, round up)", () => {
      const api = createDragRetimer();

      // 13:03 = 783 min; nearest 5-min = 785 = 13:05
      api.onDragStart(TASK_ID, 12 * 60, null, DATE_ISO);
      api.onDragOver("lane-1", minToMouseY(13 * 60 + 3), 0, PX_PER_HOUR);

      const drop = api.onDragEnd(null);
      expect(drop).not.toBeNull();
      const d = new Date(drop!.newScheduledAt);
      expect(d.getHours()).toBe(13);
      expect(d.getMinutes()).toBe(5);
    });
  });

  describe("boundary clamping", () => {
    it("clamps below DAY_START (above top of chart) to DAY_START = 06:00", () => {
      const api = createDragRetimer();

      // mouseY=-100 → rawMin = (-100/60)*60 + 360 = 260 → clamp to 360 (06:00)
      api.onDragStart(TASK_ID, 12 * 60, null, DATE_ISO);
      api.onDragOver("lane-1", -100, 0, PX_PER_HOUR);

      const drop = api.onDragEnd(null);
      expect(drop).not.toBeNull();
      const d = new Date(drop!.newScheduledAt);
      expect(d.getHours()).toBe(6);
      expect(d.getMinutes()).toBe(0);
    });

    it("clamps above DAY_END_LAST_SLOT to last valid slot (01:00 next day)", () => {
      const api = createDragRetimer();

      // DAY_END_LAST_SLOT = 360 + 1200 - 60 = 1500 (25:00 = next day 01:00)
      // mouseY=2000 → far beyond → clamp to 1500
      api.onDragStart(TASK_ID, 12 * 60, null, DATE_ISO);
      api.onDragOver("lane-1", 2000, 0, PX_PER_HOUR);

      const drop = api.onDragEnd(null);
      expect(drop).not.toBeNull();
      const d = new Date(drop!.newScheduledAt);
      // 1500 min = 25 hours from midnight = next day 01:00
      expect(d.getHours()).toBe(1);
      expect(d.getMinutes()).toBe(0);
    });
  });

  describe("no-op detection", () => {
    it("returns null when dropped at same time AND same assignee", () => {
      const api = createDragRetimer();

      const fromMinutes = 13 * 60; // 780 = 13:00
      api.onDragStart(TASK_ID, fromMinutes, ASSIGNEE_A, DATE_ISO);
      api.onDragOver("lane-1", minToMouseY(fromMinutes), 0, PX_PER_HOUR);

      const drop = api.onDragEnd(ASSIGNEE_A);
      expect(drop).toBeNull();
    });

    it("returns non-null when same time but different assignee", () => {
      const api = createDragRetimer();

      const fromMinutes = 13 * 60;
      api.onDragStart(TASK_ID, fromMinutes, ASSIGNEE_A, DATE_ISO);
      api.onDragOver("lane-1", minToMouseY(fromMinutes), 0, PX_PER_HOUR);

      const drop = api.onDragEnd(ASSIGNEE_B);
      expect(drop).not.toBeNull();
      expect(drop!.newAssignee).toBe(ASSIGNEE_B);
      expect(drop!.fromAssignee).toBe(ASSIGNEE_A);
    });
  });

  describe("reset", () => {
    it("clears state after reset — onDragEnd returns null", () => {
      const api = createDragRetimer();

      api.onDragStart(TASK_ID, 12 * 60, null, DATE_ISO);
      api.onDragOver("lane-1", 400, 0, PX_PER_HOUR);
      api.reset();

      const drop = api.onDragEnd(null);
      expect(drop).toBeNull();
    });
  });

  // ─── Boundary constant verification ────────────────────────────────────────
  // Confirms the constants in the implementation match timeMath expectations.
  it("DAY_START_MIN + DAY_MINUTES - 60 = last valid slot", () => {
    const LAST_SLOT = DAY_START_HOUR * 60 + DAY_MINUTES - 60;
    expect(LAST_SLOT).toBe(1500); // 25:00 = next day 01:00
  });
});
