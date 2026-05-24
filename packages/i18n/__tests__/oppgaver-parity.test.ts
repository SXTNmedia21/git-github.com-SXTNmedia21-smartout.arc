import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const nb = JSON.parse(
  readFileSync(join(__dirname, "..", "locales", "nb", "dashboard.json"), "utf-8"),
);
const en = JSON.parse(
  readFileSync(join(__dirname, "..", "locales", "en", "dashboard.json"), "utf-8"),
);

function flatten(obj: unknown, prefix = ""): string[] {
  if (obj === null || typeof obj !== "object") return [];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    typeof v === "object" && v !== null
      ? flatten(v, prefix ? `${prefix}.${k}` : k)
      : [prefix ? `${prefix}.${k}` : k],
  );
}

describe("oppgaver i18n key parity", () => {
  it("nb and en have identical oppgaver.* key sets", () => {
    const nbKeys = flatten(nb.oppgaver ?? {})
      .map((k) => `oppgaver.${k}`)
      .sort();
    const enKeys = flatten(en.oppgaver ?? {})
      .map((k) => `oppgaver.${k}`)
      .sort();
    expect(nbKeys).toEqual(enKeys);
  });

  it("oppgaver.* key count is between 25 and 50", () => {
    const n = flatten(nb.oppgaver ?? {}).length;
    expect(n).toBeGreaterThanOrEqual(25);
    expect(n).toBeLessThanOrEqual(50);
  });
});
