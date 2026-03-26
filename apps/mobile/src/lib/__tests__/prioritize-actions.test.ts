/**
 * Tests for prioritizeActions() — the priority engine powering the Smart Home Hub.
 *
 * The function is pure: it takes current state and returns sorted action cards.
 * Tests use fake timers so Date.now() is deterministic.
 *
 * Fixed reference point: 2026-03-26T14:00:00Z
 */

import {
  prioritizeActions,
  type Shift,
  type Task,
  type Signal,
  type TimeEntry,
} from "../prioritize-actions";

// Fixed reference: 14:00 UTC on 2026-03-26
const NOW = new Date("2026-03-26T14:00:00Z").getTime();

describe("prioritizeActions", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // --- Shared fixtures ---

  const activeShift: Shift = {
    id: "shift-1",
    start_time: "2026-03-26T12:00:00Z",
    end_time: "2026-03-26T20:00:00Z",
    position: "Server",
    department_name: "Restaurant",
  };

  // 30 min from NOW
  const futureShift: Shift = {
    id: "shift-2",
    start_time: "2026-03-26T14:30:00Z",
    end_time: "2026-03-26T22:00:00Z",
    position: "Bartender",
    department_name: "Bar",
  };

  const clockedInEntry: TimeEntry = {
    id: "te-1",
    clock_in: "2026-03-26T12:00:00Z",
  };

  // --- Baseline ---

  it("returns only the info card when no active context and no_shift", () => {
    const result = prioritizeActions("no_shift", null, null, [], [], 0, null);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("info");
    expect(result[0].id).toBe("no-shift");
  });

  // --- Priority 1: Punch in ---

  it("prioritizes punch-in (P1) during shift without time entry", () => {
    const result = prioritizeActions("during_shift", activeShift, null, [], [], 0, null);
    expect(result[0].type).toBe("punch");
    expect(result[0].priority).toBe(1);
    expect(result[0].urgency).toBe("immediate");
    expect(result[0].id).toBe("punch-shift-1");
    expect(result[0].route).toBe("/(app)/(shifts)/punch");
  });

  it("does NOT show punch-in when already clocked in", () => {
    const result = prioritizeActions("during_shift", activeShift, null, [], [], 0, clockedInEntry);
    expect(result.find((a) => a.type === "punch")).toBeUndefined();
  });

  it("does NOT show punch-in outside during_shift phase", () => {
    const result = prioritizeActions("before_shift", activeShift, null, [], [], 0, null);
    expect(result.find((a) => a.type === "punch")).toBeUndefined();
  });

  // --- Priority 2: Break alert ---

  it("shows break alert (P2) when break exceeds 30 minutes", () => {
    // break_start = 40 min before NOW
    const timeEntry: TimeEntry = {
      id: "te-1",
      clock_in: "2026-03-26T12:00:00Z",
      break_start: "2026-03-26T13:20:00Z",
    };
    const result = prioritizeActions("during_shift", activeShift, null, [], [], 0, timeEntry);
    const breakAlert = result.find((a) => a.id.startsWith("break-"));
    expect(breakAlert).toBeDefined();
    expect(breakAlert!.priority).toBe(2);
    expect(breakAlert!.urgency).toBe("immediate");
    expect(breakAlert!.title).toContain("40 min");
  });

  it("does NOT show break alert when break is under 30 minutes", () => {
    // break_start = 20 min before NOW
    const timeEntry: TimeEntry = {
      id: "te-1",
      clock_in: "2026-03-26T12:00:00Z",
      break_start: "2026-03-26T13:40:00Z",
    };
    const result = prioritizeActions("during_shift", activeShift, null, [], [], 0, timeEntry);
    expect(result.find((a) => a.id.startsWith("break-"))).toBeUndefined();
  });

  it("does NOT show break alert when no break_start", () => {
    const result = prioritizeActions("during_shift", activeShift, null, [], [], 0, clockedInEntry);
    expect(result.find((a) => a.id.startsWith("break-"))).toBeUndefined();
  });

  // --- Priority 3: Overdue tasks ---

  it("shows overdue tasks (P3) with correct title", () => {
    const tasks: Task[] = [
      { id: "t-1", title: "Temperaturkontroll", due_at: "2026-03-26T13:00:00Z" }, // 1h overdue
      { id: "t-2", title: "Future task", due_at: "2026-03-26T16:00:00Z" }, // future
    ];
    const result = prioritizeActions(
      "during_shift",
      activeShift,
      null,
      tasks,
      [],
      0,
      clockedInEntry,
    );
    const overdue = result.filter((a) => a.id.startsWith("task-overdue"));
    expect(overdue).toHaveLength(1);
    expect(overdue[0].title).toContain("Temperaturkontroll");
    expect(overdue[0].title).toContain("forfalt");
    expect(overdue[0].urgency).toBe("immediate");
  });

  it("creates one action per overdue task", () => {
    const tasks: Task[] = [
      { id: "t-1", title: "Task A", due_at: "2026-03-26T10:00:00Z" },
      { id: "t-2", title: "Task B", due_at: "2026-03-26T11:00:00Z" },
      { id: "t-3", title: "Task C", due_at: "2026-03-26T16:00:00Z" }, // not overdue
    ];
    const result = prioritizeActions("no_shift", null, null, tasks, [], 0, null);
    const overdue = result.filter((a) => a.id.startsWith("task-overdue"));
    expect(overdue).toHaveLength(2);
  });

  it("shows no overdue actions when all tasks are in the future", () => {
    const tasks: Task[] = [{ id: "t-1", title: "Future", due_at: "2026-03-26T18:00:00Z" }];
    const result = prioritizeActions("no_shift", null, null, tasks, [], 0, null);
    expect(result.find((a) => a.id.startsWith("task-overdue"))).toBeUndefined();
  });

  it("ignores tasks without due_at", () => {
    const tasks: Task[] = [{ id: "t-1", title: "No due date" }];
    const result = prioritizeActions("no_shift", null, null, tasks, [], 0, null);
    expect(result.find((a) => a.id.startsWith("task-overdue"))).toBeUndefined();
  });

  // --- Priority 4: Guardian signals ---

  it("shows guardian signals (P4) with correct urgency for critical severity", () => {
    const signals: Signal[] = [
      { id: "s-1", title: "Avvik i Kjøkken", severity: "critical", department_name: "Kjøkken" },
    ];
    const result = prioritizeActions(
      "during_shift",
      activeShift,
      null,
      [],
      signals,
      0,
      clockedInEntry,
    );
    const alert = result.find((a) => a.id === "signal-s-1");
    expect(alert).toBeDefined();
    expect(alert!.priority).toBe(4);
    expect(alert!.urgency).toBe("immediate");
    expect(alert!.subtitle).toBe("Kjøkken");
  });

  it("shows guardian signals with soon urgency for warning severity", () => {
    const signals: Signal[] = [{ id: "s-2", title: "Lavt lager", severity: "warning" }];
    const result = prioritizeActions(
      "during_shift",
      activeShift,
      null,
      [],
      signals,
      0,
      clockedInEntry,
    );
    const alert = result.find((a) => a.id === "signal-s-2");
    expect(alert!.urgency).toBe("soon");
  });

  it("shows guardian signals with soon urgency for info severity", () => {
    const signals: Signal[] = [{ id: "s-3", title: "Påminnelse", severity: "info" }];
    const result = prioritizeActions("no_shift", null, null, [], signals, 0, null);
    const alert = result.find((a) => a.id === "signal-s-3");
    expect(alert!.urgency).toBe("soon");
  });

  // --- Priority 5: Upcoming shift ---

  it("shows upcoming shift (P5) when shift starts within 60 min", () => {
    // futureShift starts 30 min from NOW
    const result = prioritizeActions("before_shift", null, futureShift, [], [], 0, null);
    const upcoming = result.find((a) => a.type === "shift_upcoming");
    expect(upcoming).toBeDefined();
    expect(upcoming!.title).toContain("30 min");
    expect(upcoming!.priority).toBe(5);
  });

  it("marks upcoming shift as soon when > 15 min away", () => {
    const result = prioritizeActions("before_shift", null, futureShift, [], [], 0, null);
    const upcoming = result.find((a) => a.type === "shift_upcoming");
    expect(upcoming!.urgency).toBe("soon"); // 30 min > 15 min threshold
  });

  it("marks upcoming shift as immediate when <= 15 min away", () => {
    const soonShift: Shift = {
      ...futureShift,
      id: "shift-soon",
      start_time: "2026-03-26T14:10:00Z", // 10 min from NOW
    };
    const result = prioritizeActions("before_shift", null, soonShift, [], [], 0, null);
    const upcoming = result.find((a) => a.type === "shift_upcoming");
    expect(upcoming!.urgency).toBe("immediate");
  });

  it("does NOT show upcoming shift when it starts more than 60 min away", () => {
    const farShift: Shift = {
      ...futureShift,
      id: "shift-far",
      start_time: "2026-03-26T16:00:00Z", // 120 min away
    };
    const result = prioritizeActions("no_shift", null, farShift, [], [], 0, null);
    expect(result.find((a) => a.type === "shift_upcoming")).toBeUndefined();
  });

  it("does NOT show upcoming shift during an active shift", () => {
    // Employee is already clocked in — don't nag about next shift yet
    const result = prioritizeActions(
      "during_shift",
      activeShift,
      futureShift,
      [],
      [],
      0,
      clockedInEntry,
    );
    expect(result.find((a) => a.type === "shift_upcoming")).toBeUndefined();
  });

  it("includes subtitle with position and department", () => {
    const result = prioritizeActions("before_shift", null, futureShift, [], [], 0, null);
    const upcoming = result.find((a) => a.type === "shift_upcoming");
    expect(upcoming!.subtitle).toContain("Bartender");
    expect(upcoming!.subtitle).toContain("Bar");
  });

  // --- Priority 6: Confirm hours ---

  it("shows confirm-hours (P6) in after_shift phase", () => {
    const result = prioritizeActions("after_shift", null, null, [], [], 0, null);
    const confirm = result.find((a) => a.id === "confirm-hours");
    expect(confirm).toBeDefined();
    expect(confirm!.priority).toBe(6);
    expect(confirm!.urgency).toBe("soon");
  });

  it("does NOT show confirm-hours outside after_shift phase", () => {
    const result = prioritizeActions("during_shift", activeShift, null, [], [], 0, clockedInEntry);
    expect(result.find((a) => a.id === "confirm-hours")).toBeUndefined();
  });

  // --- Priority 7: Unread messages ---

  it("shows unread messages (P7) with correct count", () => {
    const result = prioritizeActions("no_shift", null, null, [], [], 5, null);
    const msg = result.find((a) => a.type === "message");
    expect(msg).toBeDefined();
    expect(msg!.title).toBe("5 uleste meldinger");
    expect(msg!.priority).toBe(7);
    expect(msg!.urgency).toBe("soon");
  });

  it("does NOT show messages when unreadCount is 0", () => {
    const result = prioritizeActions("no_shift", null, null, [], [], 0, null);
    expect(result.find((a) => a.type === "message")).toBeUndefined();
  });

  // --- Priority 8: No shift info ---

  it("shows no-shift info (P8) when no shift today and no nextShift", () => {
    const result = prioritizeActions("no_shift", null, null, [], [], 0, null);
    const info = result.find((a) => a.id === "no-shift");
    expect(info).toBeDefined();
    expect(info!.urgency).toBe("info");
    expect(info!.priority).toBe(8);
  });

  it("shows next-shift-info with day/time when nextShift exists in no_shift phase", () => {
    const nextDay: Shift = {
      id: "shift-tomorrow",
      start_time: "2026-03-27T08:00:00Z",
      end_time: "2026-03-27T16:00:00Z",
    };
    const result = prioritizeActions("no_shift", null, nextDay, [], [], 0, null);
    const info = result.find((a) => a.id === "next-shift-info");
    expect(info).toBeDefined();
    expect(info!.title).toContain("Ingen skift i dag");
    expect(info!.route).toBe("/(app)/(shifts)/shift-tomorrow");
  });

  // --- Sort order ---

  it("returns actions sorted by priority (lowest number first)", () => {
    const tasks: Task[] = [{ id: "t-1", title: "Overdue task", due_at: "2026-03-26T13:00:00Z" }];
    const signals: Signal[] = [{ id: "s-1", title: "Signal", severity: "warning" }];
    const result = prioritizeActions(
      "during_shift",
      activeShift,
      null,
      tasks,
      signals,
      3,
      null, // no time entry → punch-in appears
    );
    const priorities = result.map((a) => a.priority);
    expect(priorities).toEqual([...priorities].sort((a, b) => a - b));
  });

  it("punch-in appears before overdue tasks in sorted order", () => {
    const tasks: Task[] = [{ id: "t-1", title: "Overdue", due_at: "2026-03-26T10:00:00Z" }];
    const result = prioritizeActions("during_shift", activeShift, null, tasks, [], 0, null);
    expect(result[0].type).toBe("punch");
    expect(result[1].id).toBe("task-overdue-t-1");
  });

  // --- Combined scenarios ---

  it("handles the full busy-shift scenario correctly", () => {
    const tasks: Task[] = [
      { id: "t-1", title: "Temperaturkontroll", due_at: "2026-03-26T13:00:00Z" },
    ];
    const signals: Signal[] = [{ id: "s-1", title: "Avvik", severity: "critical" }];
    const timeEntry: TimeEntry = {
      id: "te-1",
      clock_in: "2026-03-26T12:00:00Z",
      break_start: "2026-03-26T13:00:00Z", // 60 min on break
    };
    const result = prioritizeActions(
      "during_shift",
      activeShift,
      null,
      tasks,
      signals,
      2,
      timeEntry,
    );

    // Should have: break alert (P2), overdue task (P3), guardian signal (P4), message (P7)
    expect(result.find((a) => a.id.startsWith("break-"))).toBeDefined();
    expect(result.find((a) => a.id.startsWith("task-overdue"))).toBeDefined();
    expect(result.find((a) => a.id.startsWith("signal-"))).toBeDefined();
    expect(result.find((a) => a.type === "message")).toBeDefined();

    // Break alert must be highest priority
    expect(result[0].id.startsWith("break-")).toBe(true);
  });
});
