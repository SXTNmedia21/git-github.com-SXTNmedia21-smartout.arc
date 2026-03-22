import { describe, it, expect } from "vitest";
import { buildEntityContext } from "../build-entity-context";

type ShiftInput = {
  startTime: string;
  endTime: string;
  date: string;
};

function makeShift(overrides: Partial<ShiftInput> = {}): ShiftInput {
  return {
    startTime: "09:00",
    endTime: "17:00",
    date: "2026-03-23",
    ...overrides,
  };
}

describe("buildEntityContext", () => {
  it("single shift on a day → dailyHoursWorked = shift duration", () => {
    const draft = makeShift({ startTime: "10:00", endTime: "18:00" });
    const result = buildEntityContext([], draft, { birthDate: null, contractType: null });

    expect(result.dailyHoursWorked).toBe(8);
    expect(result.weeklyHoursWorked).toBe(8);
  });

  it("multiple shifts same day → dailyHoursWorked = sum of durations", () => {
    const existing = [makeShift({ startTime: "06:00", endTime: "10:00", date: "2026-03-23" })];
    const draft = makeShift({ startTime: "12:00", endTime: "18:00", date: "2026-03-23" });
    const result = buildEntityContext(existing, draft, { birthDate: null, contractType: null });

    // 4h existing + 6h draft = 10h
    expect(result.dailyHoursWorked).toBe(10);
  });

  it("shifts across week → weeklyHoursWorked = sum of all", () => {
    // ISO week: Mon 2026-03-23 to Sun 2026-03-29
    const existing = [
      makeShift({ startTime: "09:00", endTime: "17:00", date: "2026-03-23" }), // Mon 8h
      makeShift({ startTime: "09:00", endTime: "17:00", date: "2026-03-24" }), // Tue 8h
    ];
    const draft = makeShift({ startTime: "09:00", endTime: "17:00", date: "2026-03-25" }); // Wed 8h

    const result = buildEntityContext(existing, draft, { birthDate: null, contractType: null });

    expect(result.weeklyHoursWorked).toBe(24); // 8+8+8
    expect(result.dailyHoursWorked).toBe(8); // Only the draft day
  });

  it("draft shift added to existing → both included in totals", () => {
    const existing = [makeShift({ startTime: "06:00", endTime: "14:00", date: "2026-03-23" })];
    const draft = makeShift({ startTime: "16:00", endTime: "22:00", date: "2026-03-23" });

    const result = buildEntityContext(existing, draft, { birthDate: null, contractType: null });

    // Daily: 8h existing + 6h draft = 14h
    expect(result.dailyHoursWorked).toBe(14);
    // Weekly: same
    expect(result.weeklyHoursWorked).toBe(14);
  });

  it("lastShiftEnd = closest prior shift end before draft start", () => {
    const existing = [
      makeShift({ startTime: "06:00", endTime: "14:00", date: "2026-03-23" }),
      makeShift({ startTime: "08:00", endTime: "12:00", date: "2026-03-22" }),
    ];
    const draft = makeShift({ startTime: "16:00", endTime: "22:00", date: "2026-03-23" });

    const result = buildEntityContext(existing, draft, { birthDate: null, contractType: null });

    // The 14:00 shift end on the same day is the closest prior end
    expect(result.lastShiftEnd).toBe("2026-03-23T14:00");
  });

  it("employeeAge computed from birth date vs shift date", () => {
    const draft = makeShift({ date: "2026-03-23" });
    const result = buildEntityContext([], draft, {
      birthDate: "2000-03-23",
      contractType: "full_time",
    });

    expect(result.employeeAge).toBe(26);
    expect(result.contractType).toBe("full_time");
  });

  it("employee born day after shift date → age not yet reached", () => {
    const draft = makeShift({ date: "2026-03-22" });
    const result = buildEntityContext([], draft, {
      birthDate: "2000-03-23",
      contractType: null,
    });

    expect(result.employeeAge).toBe(25);
  });

  it("no existing shifts → all zeros except draft", () => {
    const draft = makeShift({ startTime: "10:00", endTime: "14:00" });
    const result = buildEntityContext([], draft, { birthDate: null, contractType: null });

    expect(result.dailyHoursWorked).toBe(4);
    expect(result.weeklyHoursWorked).toBe(4);
    expect(result.lastShiftEnd).toBeUndefined();
    expect(result.employeeAge).toBeUndefined();
  });

  it("handles overnight shift (endTime < startTime)", () => {
    const draft = makeShift({ startTime: "22:00", endTime: "06:00", date: "2026-03-23" });
    const result = buildEntityContext([], draft, { birthDate: null, contractType: null });

    expect(result.dailyHoursWorked).toBe(8);
    expect(result.weeklyHoursWorked).toBe(8);
  });
});
