import { describe, expect, it } from "vitest";

import type { DayTask, Shift } from "../../_components/schedule-types";
import {
  buildDaySessionSnapshot,
  collectDaySessionProfileIds,
  type EmployeeReadinessSummary,
} from "../day-session-model";

function createShift(overrides: Partial<Shift> = {}): Shift {
  return {
    id: "shift-1",
    employeeId: "profile-1",
    dateId: "2026-03-07",
    role: "Kokk",
    time: "08:00 - 16:00",
    startTime: "08:00",
    endTime: "16:00",
    workHours: 7.5,
    status: "published",
    dayCategory: "morning",
    indicator: "orange",
    isPublished: true,
    breaks: 30,
    createdAt: "2026-03-07T08:00:00.000Z",
    updatedAt: "2026-03-07T08:00:00.000Z",
    ...overrides,
  };
}

function createTask(overrides: Partial<DayTask> = {}): DayTask {
  return {
    id: "task-1",
    dateId: "2026-03-07",
    label: "Mål temperatur på kjølerom",
    status: "completed",
    category: "routine",
    assignedTo: "profile-1",
    highlight: false,
    ...overrides,
  };
}

describe("buildDaySessionSnapshot", () => {
  it("marks temperature tasks as missing evidence and critical when the assignee has expired training", () => {
    const readinessByProfile = new Map<string, EmployeeReadinessSummary>([
      [
        "profile-1",
        {
          profileId: "profile-1",
          readinessPercent: 42,
          completedAssignments: 4,
          pendingAssignments: 2,
          expiredAssignments: 1,
        },
      ],
    ]);

    const snapshot = buildDaySessionSnapshot({
      dateId: "2026-03-07",
      shifts: [createShift()],
      tasks: [createTask()],
      readinessByProfile,
      evidenceDrafts: {},
    });

    expect(snapshot.summary.staffCount).toBe(1);
    expect(snapshot.summary.tasksMissingEvidence).toBe(1);
    expect(snapshot.summary.criticalWarnings).toBe(1);
    expect(snapshot.tasks[0]?.evidence.kind).toBe("measurement");
    expect(snapshot.tasks[0]?.evidence.state).toBe("missing");
    expect(snapshot.tasks[0]?.readiness.level).toBe("critical");
  });

  it("treats a note draft as captured evidence and keeps fully ready assignees warning-free", () => {
    const readinessByProfile = new Map<string, EmployeeReadinessSummary>([
      [
        "profile-2",
        {
          profileId: "profile-2",
          readinessPercent: 100,
          completedAssignments: 6,
          pendingAssignments: 0,
          expiredAssignments: 0,
        },
      ],
    ]);

    const snapshot = buildDaySessionSnapshot({
      dateId: "2026-03-07",
      shifts: [createShift({ id: "shift-2", employeeId: "profile-2" })],
      tasks: [
        createTask({
          id: "task-2",
          label: "Signer hygienekontroll",
          status: "in_progress",
          assignedTo: "profile-2",
        }),
      ],
      readinessByProfile,
      evidenceDrafts: {
        "task-2": {
          note: "Kontroll utført og avvik ikke funnet.",
        },
      },
    });

    expect(snapshot.summary.tasksReadyForSignoff).toBe(0);
    expect(snapshot.summary.criticalWarnings).toBe(0);
    expect(snapshot.tasks[0]?.evidence.kind).toBe("note");
    expect(snapshot.tasks[0]?.evidence.state).toBe("captured");
    expect(snapshot.tasks[0]?.readiness.level).toBe("none");
  });

  it("collects readiness profiles from both scheduled staff and task assignees", () => {
    const profileIds = collectDaySessionProfileIds(
      [createShift({ employeeId: "profile-1" })],
      [createTask({ id: "task-3", assignedTo: "profile-2" })],
    );

    expect(profileIds).toEqual(["profile-1", "profile-2"]);
  });
});
