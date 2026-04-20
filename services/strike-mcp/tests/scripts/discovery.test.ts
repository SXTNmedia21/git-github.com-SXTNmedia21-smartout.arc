import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  runDiscovery,
  runDiscoveryForEntity,
  formatProgress,
  type DiscoveryContext,
  type DiscoveryResult,
} from "../../scripts/lib/discovery.js";
import type { EntityEntry } from "../../src/entities.js";
import type { BubbleClient } from "../../src/bubble/client.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────

const SAMPLE_RECORDS = [
  {
    _id: "aaa",
    _type: "widget",
    "Created Date": "2026-01-01",
    "Modified Date": "2026-01-02",
    name: "Alpha Widget",
    is_active: true,
  },
  {
    _id: "bbb",
    _type: "widget",
    "Created Date": "2026-01-03",
    "Modified Date": "2026-01-04",
    name: "Beta Widget",
    is_active: false,
  },
];

function makeMockBubble(records = SAMPLE_RECORDS): BubbleClient {
  return {
    sampleBidirectional: vi.fn().mockResolvedValue({
      firstN: records,
      lastN: [],
      totalCount: records.length,
    }),
  } as unknown as BubbleClient;
}

function makeEntity(name = "widget"): EntityEntry {
  return {
    name,
    bubbleType: name,
    workspaceFieldKey: "workspace",
    description: `Test ${name} entity`,
  };
}

function makeCtx(
  mappingsDir: string,
  overrides: Partial<DiscoveryContext> = {},
): DiscoveryContext {
  return {
    bubble: makeMockBubble(),
    mappingsDir,
    workspaceId: "ws-test-123",
    force: false,
    enableSidecar: true,
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe("runDiscovery", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "strike-discovery-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("calls research for each entity in the list", async () => {
    const entities = [makeEntity("widget"), makeEntity("gadget")];
    const mockBubble = makeMockBubble();
    const ctx = makeCtx(tmpDir, { bubble: mockBubble });
    const results = await runDiscovery(entities, ctx);

    expect(results).toHaveLength(2);
    expect(mockBubble.sampleBidirectional).toHaveBeenCalledTimes(2);
    expect(results.every((r) => r.status === "success")).toBe(true);
  });

  it("skips entities that already have mapping files unless force=true", async () => {
    const entity = makeEntity("widget");
    // Pre-create a mapping file
    const mappingContent = JSON.stringify({
      entity: "widget",
      bubble_type: "widget",
      target_table: null,
      field_map: {},
      required_source_fields: [],
      skip_if_missing: [],
      known_quirks: [],
      last_verified: "2026-01-01",
      sample_record_count: 5,
      total_record_count: 5,
      v3_schema_hash: null,
    });
    writeFileSync(join(tmpDir, "widget.json"), mappingContent);

    const mockBubble = makeMockBubble();
    const ctx = makeCtx(tmpDir, { bubble: mockBubble, force: false });
    const results = await runDiscovery([entity], ctx);

    expect(results[0].status).toBe("skipped");
    expect(mockBubble.sampleBidirectional).not.toHaveBeenCalled();
  });

  it("does NOT skip when force=true even if mapping file exists", async () => {
    const entity = makeEntity("widget");
    writeFileSync(join(tmpDir, "widget.json"), JSON.stringify({
      entity: "widget",
      bubble_type: "widget",
      target_table: null,
      field_map: {},
      required_source_fields: [],
      skip_if_missing: [],
      known_quirks: [],
      last_verified: "2026-01-01",
      sample_record_count: 5,
      total_record_count: 5,
      v3_schema_hash: null,
    }));

    const mockBubble = makeMockBubble();
    const ctx = makeCtx(tmpDir, { bubble: mockBubble, force: true });
    const results = await runDiscovery([entity], ctx);

    expect(results[0].status).toBe("success");
    expect(mockBubble.sampleBidirectional).toHaveBeenCalledOnce();
  });

  it("captures per-entity errors without aborting the run", async () => {
    const entities = [makeEntity("good"), makeEntity("bad"), makeEntity("also-good")];
    const mockBubble = {
      sampleBidirectional: vi
        .fn()
        .mockResolvedValueOnce({ firstN: SAMPLE_RECORDS, lastN: [], totalCount: 2 })
        .mockRejectedValueOnce(new Error("Bubble API error"))
        .mockResolvedValueOnce({ firstN: SAMPLE_RECORDS, lastN: [], totalCount: 2 }),
    } as unknown as BubbleClient;

    const ctx = makeCtx(tmpDir, { bubble: mockBubble });
    const results = await runDiscovery(entities, ctx);

    expect(results).toHaveLength(3);
    expect(results[0].status).toBe("success");
    expect(results[1].status).toBe("error");
    expect(results[1].errorMessage).toContain("Bubble API error");
    expect(results[2].status).toBe("success");
  });

  it("writes error sentinel files for failed entities", async () => {
    const entity = makeEntity("broken");
    const mockBubble = {
      sampleBidirectional: vi.fn().mockRejectedValue(new Error("timeout")),
    } as unknown as BubbleClient;

    const ctx = makeCtx(tmpDir, { bubble: mockBubble });
    await runDiscovery([entity], ctx);

    const sentinelPath = join(tmpDir, ".local", "broken.error.json");
    expect(existsSync(sentinelPath)).toBe(true);
    const sentinel = JSON.parse(readFileSync(sentinelPath, "utf-8"));
    expect(sentinel.error).toContain("timeout");
  });

  it("writes sidecar files when enableSidecar=true", async () => {
    const entity = makeEntity("widget");
    const ctx = makeCtx(tmpDir, { enableSidecar: true });
    await runDiscovery([entity], ctx);

    const sidecarPath = join(tmpDir, ".local", "widget.sidecar.json");
    expect(existsSync(sidecarPath)).toBe(true);
  });

  it("does not write sidecar files when enableSidecar=false", async () => {
    const entity = makeEntity("widget");
    const ctx = makeCtx(tmpDir, { enableSidecar: false });
    await runDiscovery([entity], ctx);

    const sidecarPath = join(tmpDir, ".local", "widget.sidecar.json");
    expect(existsSync(sidecarPath)).toBe(false);
  });

  it("calls onProgress after each entity", async () => {
    const entities = [makeEntity("a"), makeEntity("b")];
    const progressCalls: Array<{ result: DiscoveryResult; index: number; total: number }> = [];
    const ctx = makeCtx(tmpDir, {
      onProgress(result, index, total) {
        progressCalls.push({ result, index, total });
      },
    });

    await runDiscovery(entities, ctx);

    expect(progressCalls).toHaveLength(2);
    expect(progressCalls[0].index).toBe(0);
    expect(progressCalls[0].total).toBe(2);
    expect(progressCalls[1].index).toBe(1);
  });

  it("writes mapping files for successful entities", async () => {
    const entity = makeEntity("widget");
    const ctx = makeCtx(tmpDir);
    await runDiscovery([entity], ctx);

    const mappingPath = join(tmpDir, "widget.json");
    expect(existsSync(mappingPath)).toBe(true);
    const mapping = JSON.parse(readFileSync(mappingPath, "utf-8"));
    expect(mapping.entity).toBe("widget");
    expect(mapping.sample_record_count).toBe(2);
  });
});

describe("formatProgress", () => {
  it("formats a success result", () => {
    const result: DiscoveryResult = {
      entity: "workspace",
      status: "success",
      recordCount: 50,
      newFieldCount: 12,
    };
    const line = formatProgress(result, 2, 14);
    expect(line).toContain("[3/14]");
    expect(line).toContain("workspace");
    expect(line).toContain("50 records");
    expect(line).toContain("12 new fields");
    expect(line).toContain("✓");
  });

  it("formats a skipped result", () => {
    const result: DiscoveryResult = { entity: "locations", status: "skipped" };
    const line = formatProgress(result, 0, 5);
    expect(line).toContain("[1/5]");
    expect(line).toContain("locations");
    expect(line).toContain("skipped");
  });

  it("formats an error result", () => {
    const result: DiscoveryResult = {
      entity: "shifts",
      status: "error",
      errorMessage: "404 Not Found",
    };
    const line = formatProgress(result, 5, 14);
    expect(line).toContain("[6/14]");
    expect(line).toContain("shifts");
    expect(line).toContain("404 Not Found");
    expect(line).toContain("✗");
  });

  it("shows index+1 (1-based) position", () => {
    const result: DiscoveryResult = { entity: "a", status: "skipped" };
    const line = formatProgress(result, 0, 10);
    expect(line).toMatch(/\[1\/10\]/);
  });
});

describe("runDiscoveryForEntity", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "strike-discovery-entity-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns newFieldCount equal to number of new fields discovered", async () => {
    const entity = makeEntity("widget");
    const ctx = makeCtx(tmpDir, { force: true });
    const result = await runDiscoveryForEntity(entity, ctx);

    expect(result.status).toBe("success");
    // All fields are new on first run
    expect(result.newFieldCount).toBeGreaterThan(0);
    expect(result.recordCount).toBe(SAMPLE_RECORDS.length);
  });

  it("returns 0 new fields on second run (same records)", async () => {
    const entity = makeEntity("widget");
    const ctx = makeCtx(tmpDir, { force: true });

    // First run
    await runDiscoveryForEntity(entity, ctx);
    // Second run with same data — all fields already in mapping
    const result2 = await runDiscoveryForEntity(entity, ctx);
    expect(result2.status).toBe("success");
    expect(result2.newFieldCount).toBe(0);
  });
});
