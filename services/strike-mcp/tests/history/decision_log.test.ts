import { describe, it, expect } from "vitest";
import { mkdtemp, readFile, stat, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  appendDecision,
  type DecisionEntry,
} from "../../src/history/decision_log.js";

async function makeTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "strike-decision-log-"));
}

async function readLines(historyDir: string): Promise<string[]> {
  const raw = await readFile(join(historyDir, "decisions.jsonl"), "utf-8");
  const parts = raw.split("\n");
  // Trailing newline produces an empty final element — drop it
  return parts[parts.length - 1] === "" ? parts.slice(0, -1) : parts;
}

function baseEntry(overrides: Partial<DecisionEntry> = {}): DecisionEntry {
  return {
    ts: "2026-04-15T10:00:00.000Z",
    scope: "schema",
    workspace: "strom-mat-og-bar",
    entity: "locations",
    action: "field_approved",
    field: "Address",
    target: "address_line",
    by: "pontus",
    ...overrides,
  };
}

describe("appendDecision", () => {
  it("writes one line terminated by a single newline", async () => {
    const dir = await makeTempDir();
    try {
      await appendDecision(dir, baseEntry());

      const raw = await readFile(join(dir, "decisions.jsonl"), "utf-8");
      expect(raw.endsWith("\n")).toBe(true);
      // JSON.stringify escapes embedded newlines to \\n, so exactly one real \n is expected
      expect(raw.match(/\n/g)?.length).toBe(1);

      const parsed = JSON.parse(raw.trimEnd());
      expect(parsed.entity).toBe("locations");
      expect(parsed.scope).toBe("schema");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("appends multiple lines in insertion order", async () => {
    const dir = await makeTempDir();
    try {
      await appendDecision(dir, baseEntry({ field: "A" }));
      await appendDecision(dir, baseEntry({ field: "B" }));
      await appendDecision(dir, baseEntry({ field: "C" }));

      const lines = await readLines(dir);
      expect(lines).toHaveLength(3);
      expect(lines.map((l) => JSON.parse(l).field)).toEqual(["A", "B", "C"]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("auto-fills ts when caller omits it", async () => {
    const dir = await makeTempDir();
    try {
      const before = Date.now();
      await appendDecision(dir, {
        scope: "schema",
        workspace: "strom-mat-og-bar",
        entity: "workspace",
        action: "target_table_set",
        target: "workspace",
        by: "review_mapping",
      });
      const after = Date.now();

      const [line] = await readLines(dir);
      const parsed = JSON.parse(line);
      expect(parsed.ts).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
      const writtenAt = Date.parse(parsed.ts);
      expect(writtenAt).toBeGreaterThanOrEqual(before);
      expect(writtenAt).toBeLessThanOrEqual(after);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("creates the history directory when it does not exist", async () => {
    const parent = await makeTempDir();
    const dir = join(parent, "nested", "does", "not", "exist");
    try {
      await appendDecision(dir, baseEntry());

      const s = await stat(join(dir, "decisions.jsonl"));
      expect(s.isFile()).toBe(true);
    } finally {
      await rm(parent, { recursive: true, force: true });
    }
  });

  it("preserves Unicode (Norwegian characters and emoji) in reasoning", async () => {
    const dir = await makeTempDir();
    try {
      await appendDecision(
        dir,
        baseEntry({
          action: "field_dropped",
          reasoning: "Felt brukes ikke i v3 — 🗑️ droppet etter gjennomgang æøå",
        }),
      );

      const [line] = await readLines(dir);
      const parsed = JSON.parse(line);
      expect(parsed.reasoning).toBe(
        "Felt brukes ikke i v3 — 🗑️ droppet etter gjennomgang æøå",
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("does not lose entries under concurrent appends", async () => {
    const dir = await makeTempDir();
    const n = 50;
    try {
      await Promise.all(
        Array.from({ length: n }, (_, i) =>
          appendDecision(dir, baseEntry({ field: `f${i}` })),
        ),
      );

      const lines = await readLines(dir);
      expect(lines).toHaveLength(n);

      // Every line must parse as valid JSON — no torn writes
      for (const line of lines) {
        expect(() => JSON.parse(line)).not.toThrow();
      }

      const fields = new Set(lines.map((l) => JSON.parse(l).field));
      expect(fields.size).toBe(n);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("omits optional fields that are undefined from the JSON output", async () => {
    const dir = await makeTempDir();
    try {
      await appendDecision(dir, baseEntry({ action: "field_dropped" }));

      const [line] = await readLines(dir);
      const parsed = JSON.parse(line);
      expect("reasoning" in parsed).toBe(false);
      expect("approval_hash" in parsed).toBe(false);
      expect("metadata" in parsed).toBe(false);
      expect("confidence" in parsed).toBe(false);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("emits target: null as an explicit null (distinct from absent)", async () => {
    const dir = await makeTempDir();
    try {
      await appendDecision(
        dir,
        baseEntry({ action: "field_review_deferred", target: null }),
      );

      const [line] = await readLines(dir);
      expect(line).toMatch(/"target":null/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("accepts pattern_auto_applied as a valid action (reserved for future use)", async () => {
    const dir = await makeTempDir();
    try {
      await appendDecision(
        dir,
        baseEntry({ action: "pattern_auto_applied", by: "auto_align" }),
      );

      const [line] = await readLines(dir);
      const parsed = JSON.parse(line);
      expect(parsed.action).toBe("pattern_auto_applied");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("includes scope in the emitted JSON (schema and workspace_migration)", async () => {
    const dir = await makeTempDir();
    try {
      await appendDecision(dir, baseEntry({ scope: "schema" }));
      await appendDecision(
        dir,
        baseEntry({ scope: "workspace_migration", action: "mapping_committed" }),
      );

      const lines = await readLines(dir);
      expect(JSON.parse(lines[0]).scope).toBe("schema");
      expect(JSON.parse(lines[1]).scope).toBe("workspace_migration");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("preserves arbitrary metadata as nested JSON", async () => {
    const dir = await makeTempDir();
    try {
      await appendDecision(
        dir,
        baseEntry({
          action: "mapping_committed",
          metadata: {
            fields_approved: 12,
            fields_dropped: 3,
            session_duration_ms: 145000,
            nested: { foo: ["bar", "baz"] },
          },
        }),
      );

      const [line] = await readLines(dir);
      const parsed = JSON.parse(line);
      expect(parsed.metadata.fields_approved).toBe(12);
      expect(parsed.metadata.nested.foo).toEqual(["bar", "baz"]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("surfaces filesystem errors to the caller (no silent fail)", async () => {
    // A regular file blocks mkdir from creating a directory at the same path — ENOTDIR
    const parent = await makeTempDir();
    const blocker = join(parent, "blocker");
    await writeFile(blocker, "x", "utf-8");
    const unusableDir = join(blocker, "inside");

    try {
      await expect(appendDecision(unusableDir, baseEntry())).rejects.toThrow();
    } finally {
      await rm(parent, { recursive: true, force: true });
    }
  });
});
