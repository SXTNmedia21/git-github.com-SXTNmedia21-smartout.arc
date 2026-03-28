/**
 * Unit tests for cockpit staffing/operational risk prioritization.
 *
 * Source: apps/web/src/app/dashboard/_lib/cockpit/risk-priority.ts
 *
 * Ensures both prioritizers produce stable, deterministic output so risk rows
 * never reorder unexpectedly when values are equal or timestamps are invalid.
 */

import { describe, expect, it } from "vitest";
import {
  prioritizeOperationalRisks,
  prioritizeStaffingRisks,
  type OperationalRisk,
  type StaffingRisk,
} from "../risk-priority";

describe("prioritizeStaffingRisks", () => {
  it("orders by uncovered shifts, then affected teams, then shared tie-breakers", () => {
    const input: StaffingRisk[] = [
      {
        id: "staff-warning-strong",
        severity: "warning",
        uncoveredShifts: 3,
        affectedTeams: 2,
        occurredAt: "2026-03-28T08:00:00.000Z",
      },
      {
        id: "staff-critical-low",
        severity: "critical",
        uncoveredShifts: 1,
        affectedTeams: 1,
        occurredAt: "2026-03-28T10:00:00.000Z",
      },
      {
        id: "staff-warning-weak",
        severity: "warning",
        uncoveredShifts: 1,
        affectedTeams: 1,
        occurredAt: "2026-03-28T09:00:00.000Z",
      },
      {
        id: "staff-info",
        severity: "info",
        uncoveredShifts: 0,
        affectedTeams: 3,
        occurredAt: "2026-03-28T11:00:00.000Z",
      },
    ];

    const result = prioritizeStaffingRisks(input);

    expect(result.map((risk) => risk.id)).toEqual([
      "staff-warning-strong",
      "staff-critical-low",
      "staff-warning-weak",
      "staff-info",
    ]);
  });

  it("uses severity, timestamp, then id when numeric values tie", () => {
    const input: StaffingRisk[] = [
      {
        id: "staff-b",
        severity: "critical",
        uncoveredShifts: 2,
        affectedTeams: 2,
        occurredAt: "2026-03-28T11:00:00.000Z",
      },
      {
        id: "staff-c",
        severity: "critical",
        uncoveredShifts: 2,
        affectedTeams: 2,
        occurredAt: "2026-03-28T11:00:00.000Z",
      },
      {
        id: "staff-a",
        severity: "warning",
        uncoveredShifts: 2,
        affectedTeams: 2,
        occurredAt: "2026-03-28T12:00:00.000Z",
      },
    ];

    const result = prioritizeStaffingRisks(input);

    expect(result.map((risk) => risk.id)).toEqual(["staff-b", "staff-c", "staff-a"]);
  });
});

describe("prioritizeOperationalRisks", () => {
  it("orders by deviations, then overdue, then upcoming tasks, then shared tie-breakers", () => {
    const input: OperationalRisk[] = [
      {
        id: "ops-warning-heavy",
        severity: "warning",
        blockingDeviations: 2,
        overdueTasks: 1,
        upcomingTasks: 0,
        occurredAt: "2026-03-28T08:00:00.000Z",
      },
      {
        id: "ops-critical-mid",
        severity: "critical",
        blockingDeviations: 1,
        overdueTasks: 4,
        upcomingTasks: 0,
        occurredAt: "2026-03-28T10:00:00.000Z",
      },
      {
        id: "ops-critical-low",
        severity: "critical",
        blockingDeviations: 1,
        overdueTasks: 1,
        upcomingTasks: 5,
        occurredAt: "2026-03-28T12:00:00.000Z",
      },
      {
        id: "ops-info",
        severity: "info",
        blockingDeviations: 0,
        overdueTasks: 7,
        upcomingTasks: 0,
        occurredAt: "2026-03-28T13:00:00.000Z",
      },
      {
        id: "ops-upcoming-only",
        severity: "warning",
        blockingDeviations: 0,
        overdueTasks: 0,
        upcomingTasks: 9,
        occurredAt: "2026-03-28T09:00:00.000Z",
      },
    ];

    const result = prioritizeOperationalRisks(input);

    expect(result.map((risk) => risk.id)).toEqual([
      "ops-warning-heavy",
      "ops-critical-mid",
      "ops-critical-low",
      "ops-info",
      "ops-upcoming-only",
    ]);
  });

  it("handles invalid timestamps deterministically and keeps id tie-breaks stable", () => {
    const input: OperationalRisk[] = [
      {
        id: "ops-b",
        severity: "warning",
        blockingDeviations: 0,
        overdueTasks: 2,
        upcomingTasks: 0,
        occurredAt: "not-a-date",
      },
      {
        id: "ops-a",
        severity: "warning",
        blockingDeviations: 0,
        overdueTasks: 2,
        upcomingTasks: 0,
        occurredAt: "still-not-a-date",
      },
      {
        id: "ops-c",
        severity: "warning",
        blockingDeviations: 0,
        overdueTasks: 2,
        upcomingTasks: 0,
        occurredAt: "2026-03-28T09:00:00.000Z",
      },
    ];

    const result = prioritizeOperationalRisks(input);

    expect(result.map((risk) => risk.id)).toEqual(["ops-c", "ops-a", "ops-b"]);
  });

  it("prioritizes upcoming tasks only after blocking and overdue debt", () => {
    const input: OperationalRisk[] = [
      {
        id: "ops-overdue",
        severity: "warning",
        blockingDeviations: 0,
        overdueTasks: 1,
        upcomingTasks: 0,
        occurredAt: "2026-03-28T11:00:00.000Z",
      },
      {
        id: "ops-upcoming-high",
        severity: "critical",
        blockingDeviations: 0,
        overdueTasks: 0,
        upcomingTasks: 8,
        occurredAt: "2026-03-28T12:00:00.000Z",
      },
      {
        id: "ops-blocking",
        severity: "info",
        blockingDeviations: 1,
        overdueTasks: 0,
        upcomingTasks: 0,
        occurredAt: "2026-03-28T09:00:00.000Z",
      },
      {
        id: "ops-upcoming-low",
        severity: "critical",
        blockingDeviations: 0,
        overdueTasks: 0,
        upcomingTasks: 2,
        occurredAt: "2026-03-28T13:00:00.000Z",
      },
    ];

    const result = prioritizeOperationalRisks(input);
    expect(result.map((risk) => risk.id)).toEqual([
      "ops-blocking",
      "ops-overdue",
      "ops-upcoming-high",
      "ops-upcoming-low",
    ]);
  });
});
