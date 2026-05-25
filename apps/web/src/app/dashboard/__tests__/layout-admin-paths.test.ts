import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("dashboard/layout ADMIN_ONLY_PATH_PREFIXES", () => {
  it("includes /dashboard/oppgaver", () => {
    const src = readFileSync(join(__dirname, "..", "layout.tsx"), "utf-8");
    expect(src).toMatch(/"\/dashboard\/oppgaver"/);
  });
});
