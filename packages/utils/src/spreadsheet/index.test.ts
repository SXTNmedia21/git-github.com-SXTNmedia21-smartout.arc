// packages/utils/src/spreadsheet/index.test.ts
import { describe, expect, it } from "vitest";
import { parseCsv, type Sheet } from "./index.js";

describe("parseCsv", () => {
  it("parses headered CSV into one Sheet with headers + rows", () => {
    const csv = "name,start,end\nKnut,08:00,16:00\nAnna,16:00,00:00\n";
    const sheets: Sheet[] = parseCsv(csv, { sheetName: "sheet1" });
    expect(sheets).toHaveLength(1);
    expect(sheets[0]!.name).toBe("sheet1");
    expect(sheets[0]!.headers).toEqual(["name", "start", "end"]);
    expect(sheets[0]!.rows).toEqual([
      { name: "Knut", start: "08:00", end: "16:00" },
      { name: "Anna", start: "16:00", end: "00:00" },
    ]);
  });

  it("throws on empty input — fail-fast per L-0177", () => {
    expect(() => parseCsv("", { sheetName: "x" })).toThrow(/empty/i);
  });

  it("throws on header-only input — no data rows", () => {
    expect(() => parseCsv("a,b,c\n", { sheetName: "x" })).toThrow(/no data rows/i);
  });

  it("preserves cell whitespace (no trimming surprises)", () => {
    const csv = "a,b\n  x  ,y\n";
    const sheets = parseCsv(csv, { sheetName: "s" });
    expect(sheets[0]!.rows[0]).toEqual({ a: "  x  ", b: "y" });
  });
});
