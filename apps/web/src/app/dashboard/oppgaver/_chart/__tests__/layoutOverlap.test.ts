import { describe, it, expect } from "vitest";
import { layoutOverlap } from "../layoutOverlap";

describe("layoutOverlap", () => {
  it("0 tasks → totalCols 1, items []", () => {
    const out = layoutOverlap([]);
    expect(out.totalCols).toBe(1);
    expect(out.items).toHaveLength(0);
  });

  it("1 task → col 0, totalCols 1", () => {
    const out = layoutOverlap([{ id: "a", start: "08:00", end: "09:00" }]);
    expect(out.totalCols).toBe(1);
    expect(out.items[0]).toEqual({
      task: expect.objectContaining({ id: "a" }),
      col: 0,
    });
  });

  it("2 non-overlapping → both col 0", () => {
    const out = layoutOverlap([
      { id: "a", start: "08:00", end: "09:00" },
      { id: "b", start: "09:00", end: "10:00" },
    ]);
    expect(out.totalCols).toBe(1);
    expect(out.items.map((x) => x.col)).toEqual([0, 0]);
  });

  it("2 overlapping → cols 0 and 1, totalCols 2", () => {
    const out = layoutOverlap([
      { id: "a", start: "08:00", end: "09:30" },
      { id: "b", start: "09:00", end: "10:00" },
    ]);
    expect(out.totalCols).toBe(2);
    expect(out.items.map((x) => x.col).sort()).toEqual([0, 1]);
  });

  it("sort is stable when starts equal: longer first", () => {
    const out = layoutOverlap([
      { id: "short", start: "08:00", end: "08:30" },
      { id: "long", start: "08:00", end: "09:30" },
    ]);
    expect(out.items[0]!.task.id).toBe("long");
  });
});
