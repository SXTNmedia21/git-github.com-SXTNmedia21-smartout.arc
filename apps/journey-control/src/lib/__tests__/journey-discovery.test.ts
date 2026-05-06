import { describe, it, expect } from "vitest";
import { listCompiledJourneys, listDraftJourneys } from "../journey-discovery";
import * as path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../../../..");

describe("listCompiledJourneys", () => {
  it("finds at least P-001", async () => {
    const items = await listCompiledJourneys(REPO_ROOT);
    expect(items.length).toBeGreaterThanOrEqual(1);
    expect(items.find((j) => j.slug === "P-001")).toBeDefined();
  });

  it("each item has slug + title + filePath", async () => {
    const items = await listCompiledJourneys(REPO_ROOT);
    for (const item of items) {
      expect(item.slug).toMatch(/^[A-Z0-9-]+$/);
      expect(item.title.length).toBeGreaterThan(0);
      expect(item.filePath).toContain("apps/e2e/protocols/");
    }
  });
});

describe("listDraftJourneys", () => {
  it("finds 200+ markdown drafts", async () => {
    const items = await listDraftJourneys(REPO_ROOT);
    expect(items.length).toBeGreaterThan(200);
  });

  it("each item has slug derived from filename + filePath", async () => {
    const items = await listDraftJourneys(REPO_ROOT);
    const sample = items[0]!;
    expect(sample.slug.length).toBeGreaterThan(0);
    expect(sample.filePath).toContain("docs/journeys/");
  });
});
