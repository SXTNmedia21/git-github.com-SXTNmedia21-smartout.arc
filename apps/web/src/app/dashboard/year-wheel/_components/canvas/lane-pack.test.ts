// apps/web/src/app/dashboard/year-wheel/_components/canvas/lane-pack.test.ts
import { describe, it, expect } from "vitest";
import { assignLanes, type LaneableSeason } from "./lane-pack";

const mk = (id: string, start: string, end: string): LaneableSeason => ({
  season_id: id,
  start_date: start,
  end_date: end,
});

describe("assignLanes", () => {
  it("places non-overlapping seasons on lane 0", () => {
    const result = assignLanes([
      mk("a", "2026-01-01", "2026-02-01"),
      mk("b", "2026-03-01", "2026-04-01"),
    ]);
    expect(result.map((s) => s.lane)).toEqual([0, 0]);
  });

  it("puts overlapping seasons on separate lanes", () => {
    const result = assignLanes([
      mk("a", "2026-01-01", "2026-06-01"),
      mk("b", "2026-03-01", "2026-09-01"),
    ]);
    expect(result.find((s) => s.season_id === "a")!.lane).toBe(0);
    expect(result.find((s) => s.season_id === "b")!.lane).toBe(1);
  });

  it("reuses lane 0 when an earlier season has ended", () => {
    const result = assignLanes([
      mk("a", "2026-01-01", "2026-02-01"),
      mk("b", "2026-01-15", "2026-03-01"),
      mk("c", "2026-04-01", "2026-05-01"),
    ]);
    expect(result.find((s) => s.season_id === "c")!.lane).toBe(0);
  });

  it("sorts input by start date before assigning", () => {
    const result = assignLanes([
      mk("later", "2026-06-01", "2026-08-01"),
      mk("earlier", "2026-01-01", "2026-03-01"),
    ]);
    expect(result[0]!.season_id).toBe("earlier");
  });

  it("handles seasons with null dates by skipping them", () => {
    const result = assignLanes([
      { season_id: "null", start_date: null, end_date: null },
      mk("ok", "2026-01-01", "2026-02-01"),
    ]);
    expect(result.find((s) => s.season_id === "null")).toBeUndefined();
    expect(result.find((s) => s.season_id === "ok")!.lane).toBe(0);
  });
});
