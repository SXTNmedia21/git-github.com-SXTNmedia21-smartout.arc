import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { goldenTranscriptSchema } from "../_schema.js";

const thisDir = dirname(fileURLToPath(import.meta.url));

describe("golden-transcript schema", () => {
  it("parses schedule-when-work fixture", () => {
    const raw = JSON.parse(
      readFileSync(join(thisDir, "../fixtures/schedule-when-work.json"), "utf8"),
    );
    const parsed = goldenTranscriptSchema.parse(raw);
    expect(parsed.id).toBe("golden-schedule-when-work-001");
    expect(parsed.expected.intent.capability).toBe("schedule");
  });

  it("rejects fixture with missing expected.intent", () => {
    const bad = { id: "x", description: "y", input: {}, seeded_authority: {}, expected: {} };
    expect(() => goldenTranscriptSchema.parse(bad)).toThrow();
  });

  it("parses all fixtures in fixtures/ directory", () => {
    const fixtureDir = join(thisDir, "../fixtures");
    const files = readdirSync(fixtureDir).filter((f) => f.endsWith(".json"));
    expect(files.length).toBeGreaterThanOrEqual(5);
    for (const file of files) {
      const raw = JSON.parse(readFileSync(join(fixtureDir, file), "utf8"));
      expect(() => goldenTranscriptSchema.parse(raw)).not.toThrow();
    }
  });
});
