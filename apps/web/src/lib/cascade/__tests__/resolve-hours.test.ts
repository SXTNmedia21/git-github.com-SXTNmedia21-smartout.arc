import { describe, it, expect } from "vitest";
import { resolveEffectiveHours } from "../resolve-hours";
import type {
  DepartmentOperatingHoursRow,
  DepartmentHoursOverrideRow,
} from "../types";

const deptId = "dept-001";
const locId = "loc-001";
const seasonId = "season-summer";

// Helper to create a weekly hours row
function weeklyRow(
  overrides: Partial<DepartmentOperatingHoursRow> & { day_of_week: number },
): DepartmentOperatingHoursRow {
  return {
    id: `wh-${overrides.day_of_week}`,
    department_id: deptId,
    location_id: null,
    season_id: null,
    open_time: "10:00",
    close_time: "22:00",
    is_closed: false,
    ...overrides,
  };
}

describe("resolveEffectiveHours", () => {
  it("resolves default weekly hours for a normal weekday", () => {
    const weekly = [weeklyRow({ day_of_week: 1 })]; // Tuesday
    const result = resolveEffectiveHours(deptId, null, "2026-04-07", weekly, []);

    expect(result.isOpen).toBe(true);
    expect(result.openTime).toBe("10:00");
    expect(result.closeTime).toBe("22:00");
    expect(result.crossesMidnight).toBe(false);
    expect(result.source).toBe("default_weekly");
  });

  it("returns closed when no matching weekly hours exist", () => {
    const result = resolveEffectiveHours(deptId, null, "2026-04-07", [], []);

    expect(result.isOpen).toBe(false);
    expect(result.source).toBe("closed");
  });

  it("returns closed when is_closed is true", () => {
    const weekly = [weeklyRow({ day_of_week: 1, is_closed: true, open_time: null, close_time: null })];
    const result = resolveEffectiveHours(deptId, null, "2026-04-07", weekly, []);

    expect(result.isOpen).toBe(false);
    expect(result.source).toBe("default_weekly");
  });

  it("override takes precedence over weekly hours", () => {
    const weekly = [weeklyRow({ day_of_week: 1 })];
    const overrides: DepartmentHoursOverrideRow[] = [
      {
        id: "ov-1",
        department_id: deptId,
        location_id: null,
        override_date: "2026-04-07",
        open_time: "12:00",
        close_time: "20:00",
        is_closed: false,
        reason: "Holiday hours",
      },
    ];

    const result = resolveEffectiveHours(deptId, null, "2026-04-07", weekly, overrides);

    expect(result.isOpen).toBe(true);
    expect(result.openTime).toBe("12:00");
    expect(result.closeTime).toBe("20:00");
    expect(result.source).toBe("override");
  });

  it("closed override takes precedence", () => {
    const weekly = [weeklyRow({ day_of_week: 1 })];
    const overrides: DepartmentHoursOverrideRow[] = [
      {
        id: "ov-1",
        department_id: deptId,
        location_id: null,
        override_date: "2026-04-07",
        open_time: null,
        close_time: null,
        is_closed: true,
        reason: "Christmas Eve",
      },
    ];

    const result = resolveEffectiveHours(deptId, null, "2026-04-07", weekly, overrides);

    expect(result.isOpen).toBe(false);
    expect(result.source).toBe("override");
  });

  it("season-specific hours override defaults", () => {
    const weekly = [
      weeklyRow({ day_of_week: 1 }), // default
      weeklyRow({ day_of_week: 1, season_id: seasonId, open_time: "08:00", close_time: "23:00", id: "wh-1-summer" }),
    ];

    const result = resolveEffectiveHours(deptId, null, "2026-04-07", weekly, [], seasonId);

    expect(result.openTime).toBe("08:00");
    expect(result.closeTime).toBe("23:00");
    expect(result.source).toBe("season_weekly");
  });

  it("handles overnight spans (close < open)", () => {
    const weekly = [weeklyRow({ day_of_week: 5, open_time: "16:00", close_time: "02:00" })]; // Saturday bar
    const result = resolveEffectiveHours(deptId, null, "2026-04-11", weekly, []);

    expect(result.isOpen).toBe(true);
    expect(result.crossesMidnight).toBe(true);
    expect(result.openTime).toBe("16:00");
    expect(result.closeTime).toBe("02:00");
    expect(result.effectiveCloseTimestamp).toBe("2026-04-12T02:00");
  });

  it("location-specific hours override null-location defaults", () => {
    const weekly = [
      weeklyRow({ day_of_week: 1 }), // default (null location)
      weeklyRow({ day_of_week: 1, location_id: locId, open_time: "11:00", close_time: "21:00", id: "wh-1-loc" }),
    ];

    const result = resolveEffectiveHours(deptId, locId, "2026-04-07", weekly, []);

    expect(result.openTime).toBe("11:00");
    expect(result.closeTime).toBe("21:00");
  });

  it("falls back to null-location when no location-specific row exists", () => {
    const weekly = [weeklyRow({ day_of_week: 1 })]; // null location
    const result = resolveEffectiveHours(deptId, locId, "2026-04-07", weekly, []);

    expect(result.openTime).toBe("10:00");
    expect(result.closeTime).toBe("22:00");
  });
});
