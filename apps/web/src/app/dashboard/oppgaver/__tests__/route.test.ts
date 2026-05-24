import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROUTE_DIR = join(__dirname, "..");

describe("dashboard/oppgaver route", () => {
  it("has a layout.tsx that opts out of default page-scroll", () => {
    const layoutPath = join(ROUTE_DIR, "layout.tsx");
    expect(existsSync(layoutPath)).toBe(true);
    const src = readFileSync(layoutPath, "utf-8");
    expect(src).toMatch(/h-full overflow-hidden|h-\[100dvh\] overflow-hidden/);
  });

  it("has a page.tsx that renders ManagerTimelineShell", () => {
    const pagePath = join(ROUTE_DIR, "page.tsx");
    expect(existsSync(pagePath)).toBe(true);
    const src = readFileSync(pagePath, "utf-8");
    expect(src).toMatch(/ManagerTimelineShell/);
  });
});
