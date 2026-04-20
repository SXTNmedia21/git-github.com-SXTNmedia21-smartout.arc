# strike-mcp Phase 2 Implementation Plan — Research Engine

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend strike-mcp with a research subsystem that characterises Bubble entity shapes once, thoroughly, and stores the findings as a persistent blueprint for all future workspace migrations.

**Architecture:** A pure-functional research pipeline wired into a new MCP tool `research_entity`. The tool samples Bubble records bidirectionally (first N + last N to defeat the sparse-record trap), computes a field observation, diffs against any existing mapping, writes an updated mapping file (machine-readable, in-repo), and updates a markdown narrative in the second-brain vault (human-readable).

**Tech Stack:** Same as Phase 1 — TypeScript 5, Node 20, vitest, `@modelcontextprotocol/sdk`, `zod`. No new runtime dependencies.

**Prerequisites:** Phase 1 merged on `main`. `BubbleClient`, `entities.ts`, `logger`, `config`, error types, and both discovery tools already exist.

---

## File Structure

```
strike-mcp/
├── mappings/                              # NEW — machine-readable research output
│   ├── .gitkeep
│   ├── workspace.json                     # populated by research runs
│   └── locations.json                     # populated by research runs
├── src/
│   ├── bubble/
│   │   └── client.ts                      # MODIFY: add fetchMeta + sampleBidirectional
│   ├── research/                          # NEW subsystem
│   │   ├── mapping.ts                     # Mapping types + load/save
│   │   ├── observation.ts                 # Pure: records → FieldObservation
│   │   ├── diff.ts                        # Pure: old + new → DiffResult
│   │   ├── propose.ts                     # Pure: observation → proposed field_map
│   │   └── narrative.ts                   # Writes vault markdown
│   ├── tools/
│   │   └── research_entity.ts             # NEW tool
│   └── index.ts                           # MODIFY: register new tool
└── tests/
    ├── bubble/
    │   └── client.fetchmeta.test.ts       # NEW (keeps client test file focused)
    │   └── client.sample.test.ts          # NEW
    ├── research/
    │   ├── mapping.test.ts
    │   ├── observation.test.ts
    │   ├── diff.test.ts
    │   ├── propose.test.ts
    │   └── narrative.test.ts
    ├── tools/
    │   └── research_entity.test.ts
    └── fixtures/
        ├── bubble_meta.json               # sample Bubble /api/1.1/meta response
        └── bubble_workspace_sample.json   # realistic workspace records
```

**Decomposition rationale:**

- The research subsystem is mostly pure functions. Each (`observation`, `diff`, `propose`) can be tested in total isolation — no mocks, no IO.
- `mapping.ts` owns file IO for mappings. `narrative.ts` owns vault IO. Separation means we can mock IO at exactly one layer in each test.
- Splitting the client tests across two new files (`fetchmeta`, `sample`) keeps the existing `client.test.ts` focused on the two methods it already tests. The alternative — one giant test file — was rejected in Phase 1 as a growing pain.
- `research_entity.ts` is the only file that wires everything together. Its test uses fakes for every other piece.

---

## Type definitions (cross-task contract)

Every task below depends on these interfaces. They are defined once in `src/research/mapping.ts` and re-exported / imported by others.

```ts
// src/research/mapping.ts (excerpt — full file in Task 2)

export interface FieldMapEntry {
  target: string | null;      // v3 column name, or null if unmapped
  transform: string | null;   // name of a built-in transform, or null
  needs_review: boolean;      // gate: migrate tools refuse if any true
  source_value_types: string[]; // observed JS types: ["string"], ["number","null"], ...
  occurrence_count: number;   // how many of the sampled records had this field
  sample_values: unknown[];   // first 3 non-null values seen (for humans)
}

export interface Mapping {
  entity: string;             // strike-mcp internal name (e.g. "shifts")
  bubble_type: string;        // Bubble API type segment (e.g. "shift_satellite")
  target_table: string | null; // v3 table name, or null if not yet decided
  field_map: Record<string, FieldMapEntry>;
  required_source_fields: string[];
  skip_if_missing: string[];
  known_quirks: string[];
  last_verified: string;      // ISO date
  sample_record_count: number;
  total_record_count: number | null; // null if unknown
}

export interface FieldObservation {
  totalRecords: number;       // how many records were observed
  fields: Record<string, FieldStat>;
}

export interface FieldStat {
  occurrences: number;
  valueTypes: string[];       // sorted, deduped
  sampleValues: unknown[];    // first 3 non-null
}

export interface DiffResult {
  newFields: string[];
  disappearedFields: string[];
  typeChanges: Array<{
    field: string;
    before: string[];
    after: string[];
  }>;
}
```

---

## Task 1: Add `BubbleClient.fetchMeta` for schema introspection

**Files:**
- Modify: `src/bubble/client.ts` (add `fetchMeta` method)
- Create: `tests/bubble/client.fetchmeta.test.ts`
- Create: `tests/fixtures/bubble_meta.json`

**Context:** Bubble exposes schema at `GET /api/1.1/meta`. Response shape per `BubbleMetaResponse` type defined in Phase 1 (`src/bubble/types.ts`).

- [ ] **Step 1: Create fixture**

`tests/fixtures/bubble_meta.json`:

```json
{
  "get": {
    "workspace": {
      "fields": {
        "name_text": { "display": "Name", "type": "text" },
        "created_date": { "display": "Created Date", "type": "date" }
      }
    },
    "shift_satellite": {
      "fields": {
        "workspace": { "display": "workspace", "type": "custom.workspace" },
        "date_start_date": { "display": "date.start 🟢", "type": "date" },
        "titel_text": { "display": "Titel", "type": "text" }
      }
    }
  },
  "post": {}
}
```

- [ ] **Step 2: Write the failing test**

`tests/bubble/client.fetchmeta.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { BubbleClient } from "../../src/bubble/client.js";
import { BubbleAuthError } from "../../src/bubble/errors.js";

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(resolve(__dirname, "..", "fixtures", name), "utf-8"));
}

describe("BubbleClient.fetchMeta", () => {
  it("returns parsed schema from /api/1.1/meta", async () => {
    const fixture = loadFixture("bubble_meta.json");
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify(fixture), { status: 200 })) as unknown as typeof fetch;

    const client = new BubbleClient(
      { bubbleAppUrl: "https://smartout.bubbleapps.io", bubbleApiToken: "tok" },
      fetchSpy,
    );
    const meta = await client.fetchMeta();

    expect(meta.get.workspace).toBeDefined();
    expect(meta.get.workspace.fields.name_text.display).toBe("Name");
    expect(meta.get.shift_satellite.fields["date_start_date"].display).toBe("date.start 🟢");
  });

  it("hits /api/1.1/meta with Bearer auth", async () => {
    const fixture = loadFixture("bubble_meta.json");
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify(fixture), { status: 200 })) as unknown as typeof fetch;

    const client = new BubbleClient(
      { bubbleAppUrl: "https://smartout.bubbleapps.io", bubbleApiToken: "my-secret" },
      fetchSpy,
    );
    await client.fetchMeta();

    const call = (fetchSpy as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const url = call[0] as string;
    const init = call[1] as RequestInit;
    expect(url).toBe("https://smartout.bubbleapps.io/api/1.1/meta");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer my-secret");
  });

  it("throws BubbleAuthError on 401", async () => {
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ error: "nope" }), { status: 401 })) as unknown as typeof fetch;
    const client = new BubbleClient(
      { bubbleAppUrl: "https://x", bubbleApiToken: "t" },
      fetchSpy,
    );
    await expect(client.fetchMeta()).rejects.toBeInstanceOf(BubbleAuthError);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
cd ~/dev/strike-mcp
pnpm test
```

Expected: FAIL — `fetchMeta is not a function`.

- [ ] **Step 4: Implement `fetchMeta`**

Add to `BubbleClient` class in `src/bubble/client.ts`:

```ts
  async fetchMeta(): Promise<BubbleMetaResponse> {
    const url = `${this.config.bubbleAppUrl}/api/1.1/meta`;
    log.info("meta request", { url });

    const res = await this.fetchImpl(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.config.bubbleApiToken}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      const body = await this.safeJson(res);
      throw bubbleErrorFromResponse(res.status, body);
    }

    return (await res.json()) as BubbleMetaResponse;
  }
```

Add to imports at top of file: `import type { BubbleMetaResponse } from "./types.js";` (if not already imported).

- [ ] **Step 5: Run tests**

```bash
pnpm test && pnpm typecheck
```

Expected: all tests pass, typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(bubble): add fetchMeta for schema introspection"
```

---

## Task 2: Mapping types and IO

**Files:**
- Create: `src/research/mapping.ts`
- Create: `tests/research/mapping.test.ts`
- Create: `mappings/.gitkeep`

- [ ] **Step 1: Create the mappings directory placeholder**

```bash
cd ~/dev/strike-mcp
mkdir -p mappings
touch mappings/.gitkeep
```

- [ ] **Step 2: Write the failing test**

`tests/research/mapping.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  loadMapping,
  saveMapping,
  hasUnreviewedFields,
  type Mapping,
} from "../../src/research/mapping.js";

describe("mapping IO", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "strike-mapping-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns null when mapping file does not exist", async () => {
    const result = await loadMapping(tmpDir, "nonexistent");
    expect(result).toBeNull();
  });

  it("round-trips a mapping through save and load", async () => {
    const mapping: Mapping = {
      entity: "workspace",
      bubble_type: "workspace",
      target_table: "workspaces",
      field_map: {
        name_text: {
          target: "name",
          transform: "trim",
          needs_review: false,
          source_value_types: ["string"],
          occurrence_count: 50,
          sample_values: ["Alpha", "Beta", "Gamma"],
        },
      },
      required_source_fields: ["name_text"],
      skip_if_missing: [],
      known_quirks: [],
      last_verified: "2026-04-07",
      sample_record_count: 50,
      total_record_count: 127,
    };

    await saveMapping(tmpDir, mapping);
    const loaded = await loadMapping(tmpDir, "workspace");

    expect(loaded).toEqual(mapping);
  });
});

describe("hasUnreviewedFields", () => {
  const base: Mapping = {
    entity: "x",
    bubble_type: "x",
    target_table: null,
    field_map: {},
    required_source_fields: [],
    skip_if_missing: [],
    known_quirks: [],
    last_verified: "2026-04-07",
    sample_record_count: 0,
    total_record_count: 0,
  };

  it("returns false when field_map is empty", () => {
    expect(hasUnreviewedFields(base)).toBe(false);
  });

  it("returns true when any field has needs_review: true", () => {
    const mapping: Mapping = {
      ...base,
      field_map: {
        a: { target: "x", transform: null, needs_review: false, source_value_types: [], occurrence_count: 0, sample_values: [] },
        b: { target: "y", transform: null, needs_review: true,  source_value_types: [], occurrence_count: 0, sample_values: [] },
      },
    };
    expect(hasUnreviewedFields(mapping)).toBe(true);
  });

  it("returns false when all fields are reviewed", () => {
    const mapping: Mapping = {
      ...base,
      field_map: {
        a: { target: "x", transform: null, needs_review: false, source_value_types: [], occurrence_count: 0, sample_values: [] },
        b: { target: "y", transform: null, needs_review: false, source_value_types: [], occurrence_count: 0, sample_values: [] },
      },
    };
    expect(hasUnreviewedFields(mapping)).toBe(false);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Expected: FAIL — module not found.

- [ ] **Step 4: Implement `src/research/mapping.ts`**

```ts
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

export interface FieldMapEntry {
  target: string | null;
  transform: string | null;
  needs_review: boolean;
  source_value_types: string[];
  occurrence_count: number;
  sample_values: unknown[];
}

export interface Mapping {
  entity: string;
  bubble_type: string;
  target_table: string | null;
  field_map: Record<string, FieldMapEntry>;
  required_source_fields: string[];
  skip_if_missing: string[];
  known_quirks: string[];
  last_verified: string;
  sample_record_count: number;
  total_record_count: number | null;
}

export async function loadMapping(
  mappingsDir: string,
  entity: string,
): Promise<Mapping | null> {
  const path = join(mappingsDir, `${entity}.json`);
  try {
    const content = await readFile(path, "utf-8");
    return JSON.parse(content) as Mapping;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw err;
  }
}

export async function saveMapping(
  mappingsDir: string,
  mapping: Mapping,
): Promise<void> {
  await mkdir(mappingsDir, { recursive: true });
  const path = join(mappingsDir, `${mapping.entity}.json`);
  await writeFile(path, JSON.stringify(mapping, null, 2) + "\n", "utf-8");
}

export function hasUnreviewedFields(mapping: Mapping): boolean {
  return Object.values(mapping.field_map).some((f) => f.needs_review);
}
```

- [ ] **Step 5: Run tests and commit**

```bash
pnpm test && pnpm typecheck
git add -A
git commit -m "feat(research): add Mapping types and load/save helpers"
```

---

## Task 3: Bidirectional sampling on `BubbleClient`

**Files:**
- Modify: `src/bubble/client.ts` (add `sampleBidirectional`)
- Create: `tests/bubble/client.sample.test.ts`

**Why:** Bubble records sort oldest-first. Old records are sparse (few fields populated); recent records are rich. To characterise a type honestly we need samples from both ends. See `bubble-salary-mcp` skill Iron Rule 1.

**Strategy:** One "first" `listType` call for cursor=0, limit=n. Read `remaining` to learn the total count. Then one "last" `listType` call for cursor=max(0, total-n), limit=n. Dedupe in case the collection is smaller than 2n.

- [ ] **Step 1: Write the failing test**

`tests/bubble/client.sample.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { BubbleClient } from "../../src/bubble/client.js";

describe("BubbleClient.sampleBidirectional", () => {
  it("returns first N + last N records for a large collection", async () => {
    const fetchSpy = vi.fn(async (url: string) => {
      const u = new URL(url as string);
      const cursor = Number(u.searchParams.get("cursor"));
      const limit = Number(u.searchParams.get("limit"));
      if (cursor === 0) {
        return new Response(
          JSON.stringify({
            response: {
              results: Array.from({ length: limit }, (_, i) => ({ _id: `first-${i}` })),
              cursor: 0,
              count: limit,
              remaining: 1000 - limit,
            },
          }),
          { status: 200 },
        );
      }
      if (cursor === 950) {
        return new Response(
          JSON.stringify({
            response: {
              results: Array.from({ length: 50 }, (_, i) => ({ _id: `last-${i}` })),
              cursor: 950,
              count: 50,
              remaining: 0,
            },
          }),
          { status: 200 },
        );
      }
      return new Response("{}", { status: 500 });
    }) as unknown as typeof fetch;

    const client = new BubbleClient(
      { bubbleAppUrl: "https://x", bubbleApiToken: "t" },
      fetchSpy,
    );
    const sample = await client.sampleBidirectional("shift_satellite", 50);

    expect(sample.totalCount).toBe(1000);
    expect(sample.firstN).toHaveLength(50);
    expect(sample.lastN).toHaveLength(50);
    expect(sample.firstN[0]._id).toBe("first-0");
    expect(sample.lastN[0]._id).toBe("last-0");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("returns a single set and empty lastN when the collection is smaller than n", async () => {
    const fetchSpy = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          response: {
            results: [{ _id: "a" }, { _id: "b" }, { _id: "c" }],
            cursor: 0,
            count: 3,
            remaining: 0,
          },
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    const client = new BubbleClient(
      { bubbleAppUrl: "https://x", bubbleApiToken: "t" },
      fetchSpy,
    );
    const sample = await client.sampleBidirectional("workspace", 50);

    expect(sample.totalCount).toBe(3);
    expect(sample.firstN).toHaveLength(3);
    expect(sample.lastN).toHaveLength(0);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("returns empty when the collection has zero records", async () => {
    const fetchSpy = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          response: { results: [], cursor: 0, count: 0, remaining: 0 },
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    const client = new BubbleClient(
      { bubbleAppUrl: "https://x", bubbleApiToken: "t" },
      fetchSpy,
    );
    const sample = await client.sampleBidirectional("empty_type", 50);

    expect(sample.totalCount).toBe(0);
    expect(sample.firstN).toEqual([]);
    expect(sample.lastN).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Expected: FAIL — `sampleBidirectional is not a function`.

- [ ] **Step 3: Implement `sampleBidirectional`**

Add to `src/bubble/client.ts`:

```ts
export interface BidirectionalSample {
  firstN: BubbleRecord[];
  lastN: BubbleRecord[];
  totalCount: number;
}

// inside BubbleClient class:
  async sampleBidirectional(
    bubbleType: string,
    n: number,
  ): Promise<BidirectionalSample> {
    const first = await this.listType(bubbleType, { cursor: 0, limit: n });
    const totalCount = first.cursor + first.results.length + first.remaining;

    if (first.remaining === 0) {
      // All records fit in the first page — no need for a second call.
      return { firstN: first.results, lastN: [], totalCount };
    }

    const lastCursor = Math.max(0, totalCount - n);
    const last = await this.listType(bubbleType, { cursor: lastCursor, limit: n });
    return { firstN: first.results, lastN: last.results, totalCount };
  }
```

- [ ] **Step 4: Run tests and commit**

```bash
pnpm test && pnpm typecheck
git add -A
git commit -m "feat(bubble): add sampleBidirectional for first-N + last-N record sampling"
```

---

## Task 4: Field observation (pure)

**Files:**
- Create: `src/research/observation.ts`
- Create: `tests/research/observation.test.ts`

**Purpose:** Given a set of records, compute which keys appear, how often, what types, and up to 3 sample values per key. Pure function — no IO, no client.

- [ ] **Step 1: Write the failing test**

`tests/research/observation.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { observe } from "../../src/research/observation.js";
import type { BubbleRecord } from "../../src/bubble/types.js";

describe("observe", () => {
  it("returns empty observation for zero records", () => {
    const obs = observe([]);
    expect(obs.totalRecords).toBe(0);
    expect(obs.fields).toEqual({});
  });

  it("counts field occurrences and captures value types", () => {
    const records: BubbleRecord[] = [
      { _id: "1", name: "Alpha", count: 10 },
      { _id: "2", name: "Beta", count: 20 },
      { _id: "3", name: null },
    ];
    const obs = observe(records);

    expect(obs.totalRecords).toBe(3);
    expect(obs.fields.name.occurrences).toBe(2);
    expect(obs.fields.name.valueTypes).toEqual(["string"]);
    expect(obs.fields.count.occurrences).toBe(2);
    expect(obs.fields.count.valueTypes).toEqual(["number"]);
    expect(obs.fields._id.occurrences).toBe(3);
  });

  it("dedupes and sorts value types", () => {
    const records: BubbleRecord[] = [
      { _id: "1", mixed: "text" },
      { _id: "2", mixed: 42 },
      { _id: "3", mixed: "more text" },
      { _id: "4", mixed: true },
    ];
    const obs = observe(records);
    expect(obs.fields.mixed.valueTypes).toEqual(["boolean", "number", "string"]);
  });

  it("captures up to 3 non-null sample values", () => {
    const records: BubbleRecord[] = [
      { _id: "1", x: "a" },
      { _id: "2", x: "b" },
      { _id: "3", x: "c" },
      { _id: "4", x: "d" },
      { _id: "5", x: null },
    ];
    const obs = observe(records);
    expect(obs.fields.x.sampleValues).toEqual(["a", "b", "c"]);
  });

  it("treats null/undefined as non-occurrence", () => {
    const records: BubbleRecord[] = [
      { _id: "1", maybe: "here" },
      { _id: "2", maybe: null },
      { _id: "3", maybe: undefined },
    ];
    const obs = observe(records);
    expect(obs.fields.maybe.occurrences).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/research/observation.ts`**

```ts
import type { BubbleRecord } from "../bubble/types.js";
import type { FieldObservation, FieldStat } from "./mapping.js";

// Re-export types to keep imports clean for callers.
export type { FieldObservation, FieldStat } from "./mapping.js";

function jsType(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

export function observe(records: BubbleRecord[]): FieldObservation {
  const fields: Record<string, FieldStat> = {};

  for (const record of records) {
    for (const [key, value] of Object.entries(record)) {
      if (value === null || value === undefined) continue;

      if (!fields[key]) {
        fields[key] = { occurrences: 0, valueTypes: [], sampleValues: [] };
      }
      const stat = fields[key];
      stat.occurrences += 1;

      const type = jsType(value);
      if (!stat.valueTypes.includes(type)) {
        stat.valueTypes.push(type);
      }

      if (stat.sampleValues.length < 3) {
        stat.sampleValues.push(value);
      }
    }
  }

  // Sort valueTypes for stable output
  for (const stat of Object.values(fields)) {
    stat.valueTypes.sort();
  }

  return { totalRecords: records.length, fields };
}
```

Note: `FieldObservation` and `FieldStat` are defined in `mapping.ts` (per the type contract above). This file re-exports them for callers that prefer importing from `observation.ts`.

Wait — `mapping.ts` in Task 2 didn't export `FieldObservation` or `FieldStat`. Add them now. Edit `src/research/mapping.ts` to add these exports:

```ts
export interface FieldObservation {
  totalRecords: number;
  fields: Record<string, FieldStat>;
}

export interface FieldStat {
  occurrences: number;
  valueTypes: string[];
  sampleValues: unknown[];
}

export interface DiffResult {
  newFields: string[];
  disappearedFields: string[];
  typeChanges: Array<{
    field: string;
    before: string[];
    after: string[];
  }>;
}
```

(These can be added in the same file as `Mapping` — they are the full type contract from the header of this plan.)

- [ ] **Step 4: Run tests and commit**

```bash
pnpm test && pnpm typecheck
git add -A
git commit -m "feat(research): add observation function for field characterization"
```

---

## Task 5: Diff logic (pure)

**Files:**
- Create: `src/research/diff.ts`
- Create: `tests/research/diff.test.ts`

**Purpose:** Given an existing mapping and a new field observation, compute what changed. Used to decide whether to propose new mappings and what to flag as `needs_review`.

- [ ] **Step 1: Write the failing test**

`tests/research/diff.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { diff } from "../../src/research/diff.js";
import type { Mapping, FieldObservation } from "../../src/research/mapping.js";

const baseMapping: Mapping = {
  entity: "x",
  bubble_type: "x",
  target_table: null,
  field_map: {},
  required_source_fields: [],
  skip_if_missing: [],
  known_quirks: [],
  last_verified: "2026-04-07",
  sample_record_count: 0,
  total_record_count: 0,
};

function mkMapping(fields: string[]): Mapping {
  return {
    ...baseMapping,
    field_map: Object.fromEntries(
      fields.map((f) => [
        f,
        {
          target: null,
          transform: null,
          needs_review: false,
          source_value_types: ["string"],
          occurrence_count: 1,
          sample_values: [],
        },
      ]),
    ),
  };
}

function mkObs(fields: Record<string, string[]>): FieldObservation {
  return {
    totalRecords: 100,
    fields: Object.fromEntries(
      Object.entries(fields).map(([k, types]) => [
        k,
        { occurrences: 50, valueTypes: types, sampleValues: [] },
      ]),
    ),
  };
}

describe("diff", () => {
  it("returns empty diff when mapping and observation match", () => {
    const mapping = mkMapping(["a", "b"]);
    mapping.field_map.a.source_value_types = ["string"];
    mapping.field_map.b.source_value_types = ["number"];
    const obs = mkObs({ a: ["string"], b: ["number"] });

    const result = diff(mapping, obs);
    expect(result.newFields).toEqual([]);
    expect(result.disappearedFields).toEqual([]);
    expect(result.typeChanges).toEqual([]);
  });

  it("reports fields present in observation but not in mapping as new", () => {
    const mapping = mkMapping(["a"]);
    const obs = mkObs({ a: ["string"], b: ["number"], c: ["boolean"] });
    const result = diff(mapping, obs);

    expect(result.newFields.sort()).toEqual(["b", "c"]);
  });

  it("reports fields present in mapping but not in observation as disappeared", () => {
    const mapping = mkMapping(["a", "b", "c"]);
    const obs = mkObs({ a: ["string"] });
    const result = diff(mapping, obs);

    expect(result.disappearedFields.sort()).toEqual(["b", "c"]);
  });

  it("reports type changes when observed types differ from mapping", () => {
    const mapping = mkMapping(["a"]);
    mapping.field_map.a.source_value_types = ["string"];
    const obs = mkObs({ a: ["string", "number"] });
    const result = diff(mapping, obs);

    expect(result.typeChanges).toHaveLength(1);
    expect(result.typeChanges[0]).toEqual({
      field: "a",
      before: ["string"],
      after: ["string", "number"],
    });
  });

  it("handles an empty mapping (first-time research)", () => {
    const mapping = mkMapping([]);
    const obs = mkObs({ a: ["string"], b: ["number"] });
    const result = diff(mapping, obs);

    expect(result.newFields.sort()).toEqual(["a", "b"]);
    expect(result.disappearedFields).toEqual([]);
    expect(result.typeChanges).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/research/diff.ts`**

```ts
import type { Mapping, FieldObservation, DiffResult } from "./mapping.js";

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

export function diff(mapping: Mapping, obs: FieldObservation): DiffResult {
  const mappedKeys = new Set(Object.keys(mapping.field_map));
  const observedKeys = new Set(Object.keys(obs.fields));

  const newFields: string[] = [];
  const disappearedFields: string[] = [];
  const typeChanges: DiffResult["typeChanges"] = [];

  for (const key of observedKeys) {
    if (!mappedKeys.has(key)) {
      newFields.push(key);
      continue;
    }
    const before = mapping.field_map[key].source_value_types;
    const after = obs.fields[key].valueTypes;
    if (!arraysEqual(before, after)) {
      typeChanges.push({ field: key, before, after });
    }
  }

  for (const key of mappedKeys) {
    if (!observedKeys.has(key)) {
      disappearedFields.push(key);
    }
  }

  return { newFields, disappearedFields, typeChanges };
}
```

- [ ] **Step 4: Run tests and commit**

```bash
pnpm test && pnpm typecheck
git add -A
git commit -m "feat(research): add diff function for mapping vs observation"
```

---

## Task 6: Mapping proposal (pure)

**Files:**
- Create: `src/research/propose.ts`
- Create: `tests/research/propose.test.ts`

**Purpose:** Given a field observation and an existing mapping, produce an updated `Mapping` with:

- Existing reviewed fields preserved unchanged
- New fields added with `needs_review: true` and best-effort `target` guesses (or null)
- Updated occurrence counts, sample values, and types from the observation

This is a pure function — it doesn't write files, it just computes the new mapping.

Target-column guessing is intentionally weak in Phase 2: just normalize the Bubble key (strip emojis, trim, snake_case) and use that as a proposed target. Actual v3 schema alignment happens later, in the migrate tools or via manual review.

- [ ] **Step 1: Write the failing test**

`tests/research/propose.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { propose } from "../../src/research/propose.js";
import type { Mapping, FieldObservation } from "../../src/research/mapping.js";

const base: Mapping = {
  entity: "workspace",
  bubble_type: "workspace",
  target_table: "workspaces",
  field_map: {},
  required_source_fields: [],
  skip_if_missing: [],
  known_quirks: [],
  last_verified: "2026-04-07",
  sample_record_count: 0,
  total_record_count: null,
};

function mkObs(n: number, fields: Record<string, { types: string[]; occ: number; samples: unknown[] }>): FieldObservation {
  return {
    totalRecords: n,
    fields: Object.fromEntries(
      Object.entries(fields).map(([k, v]) => [
        k,
        { occurrences: v.occ, valueTypes: v.types, sampleValues: v.samples },
      ]),
    ),
  };
}

describe("propose", () => {
  it("creates a new mapping from an empty existing mapping", () => {
    const obs = mkObs(50, {
      name_text: { types: ["string"], occ: 50, samples: ["a", "b", "c"] },
      "Created Date": { types: ["string"], occ: 50, samples: ["2023-01-01", "2023-02-01", "2023-03-01"] },
    });

    const updated = propose(base, obs, 50);

    expect(Object.keys(updated.field_map).sort()).toEqual(["Created Date", "name_text"]);
    expect(updated.field_map.name_text.needs_review).toBe(true);
    expect(updated.field_map.name_text.target).toBe("name_text");
    expect(updated.field_map.name_text.source_value_types).toEqual(["string"]);
    expect(updated.field_map.name_text.occurrence_count).toBe(50);
    expect(updated.field_map.name_text.sample_values).toEqual(["a", "b", "c"]);
    expect(updated.sample_record_count).toBe(50);
  });

  it("preserves previously reviewed fields unchanged", () => {
    const existing: Mapping = {
      ...base,
      field_map: {
        name_text: {
          target: "name",
          transform: "trim",
          needs_review: false,
          source_value_types: ["string"],
          occurrence_count: 10,
          sample_values: ["old1", "old2"],
        },
      },
    };
    const obs = mkObs(50, {
      name_text: { types: ["string"], occ: 50, samples: ["new1", "new2", "new3"] },
    });

    const updated = propose(existing, obs, 50);

    // Target and transform preserved (human decisions)
    expect(updated.field_map.name_text.target).toBe("name");
    expect(updated.field_map.name_text.transform).toBe("trim");
    expect(updated.field_map.name_text.needs_review).toBe(false);
    // But occurrences/samples refreshed from new observation
    expect(updated.field_map.name_text.occurrence_count).toBe(50);
    expect(updated.field_map.name_text.sample_values).toEqual(["new1", "new2", "new3"]);
  });

  it("marks new fields as needs_review even when some fields already exist", () => {
    const existing: Mapping = {
      ...base,
      field_map: {
        name_text: {
          target: "name",
          transform: null,
          needs_review: false,
          source_value_types: ["string"],
          occurrence_count: 10,
          sample_values: [],
        },
      },
    };
    const obs = mkObs(50, {
      name_text: { types: ["string"], occ: 50, samples: [] },
      new_field: { types: ["number"], occ: 30, samples: [1, 2, 3] },
    });

    const updated = propose(existing, obs, 50);

    expect(updated.field_map.name_text.needs_review).toBe(false);
    expect(updated.field_map.new_field.needs_review).toBe(true);
    expect(updated.field_map.new_field.target).toBe("new_field");
  });

  it("updates last_verified to a recent ISO date", () => {
    const obs = mkObs(1, {});
    const updated = propose(base, obs, 1);
    expect(updated.last_verified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("normalizes Bubble display-name keys into snake_case targets", () => {
    const obs = mkObs(1, {
      "Created Date": { types: ["string"], occ: 1, samples: [] },
      "date.start 🟢": { types: ["string"], occ: 1, samples: [] },
      "___lookup_custom____network_satellite": { types: ["string"], occ: 1, samples: [] },
    });
    const updated = propose(base, obs, 1);

    expect(updated.field_map["Created Date"].target).toBe("created_date");
    expect(updated.field_map["date.start 🟢"].target).toBe("date_start");
    expect(updated.field_map["___lookup_custom____network_satellite"].target).toBe("lookup_custom_network_satellite");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/research/propose.ts`**

```ts
import type {
  Mapping,
  FieldObservation,
  FieldMapEntry,
} from "./mapping.js";

/**
 * Produce a proposed target column name from a raw Bubble display-name key.
 * Heuristic only — human review is expected.
 */
export function normalizeKey(key: string): string {
  return key
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}_\s.]/gu, "") // drop emojis and weird chars
    .replace(/[\s.]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

export function propose(
  existing: Mapping,
  obs: FieldObservation,
  sampleRecordCount: number,
): Mapping {
  const updatedFieldMap: Record<string, FieldMapEntry> = {};

  for (const [key, stat] of Object.entries(obs.fields)) {
    const prior = existing.field_map[key];
    if (prior) {
      // Preserve human decisions, refresh volatile observation data
      updatedFieldMap[key] = {
        target: prior.target,
        transform: prior.transform,
        needs_review: prior.needs_review,
        source_value_types: stat.valueTypes,
        occurrence_count: stat.occurrences,
        sample_values: stat.sampleValues.slice(0, 3),
      };
    } else {
      // New field — propose normalized target, flag for review
      updatedFieldMap[key] = {
        target: normalizeKey(key) || null,
        transform: null,
        needs_review: true,
        source_value_types: stat.valueTypes,
        occurrence_count: stat.occurrences,
        sample_values: stat.sampleValues.slice(0, 3),
      };
    }
  }

  return {
    ...existing,
    field_map: updatedFieldMap,
    last_verified: new Date().toISOString().slice(0, 10),
    sample_record_count: sampleRecordCount,
  };
}
```

- [ ] **Step 4: Run tests and commit**

```bash
pnpm test && pnpm typecheck
git add -A
git commit -m "feat(research): add propose function for mapping updates"
```

---

## Task 7: Vault narrative writer

**Files:**
- Create: `src/research/narrative.ts`
- Create: `tests/research/narrative.test.ts`

**Purpose:** Write a human-readable markdown file describing what was found during research. Destination is the second-brain vault at `~/dev/second-brain-v2/wiki/migration/bubble-shapes/<entity>.md`.

The file path is provided as an argument (not hardcoded) so tests can write to a tmp dir and the tool can be configured via env if needed.

- [ ] **Step 1: Write the failing test**

`tests/research/narrative.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeNarrative } from "../../src/research/narrative.js";
import type { Mapping, DiffResult } from "../../src/research/mapping.js";

const sampleMapping: Mapping = {
  entity: "workspace",
  bubble_type: "workspace",
  target_table: "workspaces",
  field_map: {
    name_text: {
      target: "name",
      transform: "trim",
      needs_review: false,
      source_value_types: ["string"],
      occurrence_count: 50,
      sample_values: ["Alpha", "Beta"],
    },
    new_field: {
      target: "new_field",
      transform: null,
      needs_review: true,
      source_value_types: ["number"],
      occurrence_count: 12,
      sample_values: [1, 2, 3],
    },
  },
  required_source_fields: [],
  skip_if_missing: [],
  known_quirks: ["pre-2024 records missing foo"],
  last_verified: "2026-04-07",
  sample_record_count: 50,
  total_record_count: 127,
};

const sampleDiff: DiffResult = {
  newFields: ["new_field"],
  disappearedFields: [],
  typeChanges: [],
};

describe("writeNarrative", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "strike-narrative-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates the destination file with YAML frontmatter", async () => {
    await writeNarrative(tmpDir, sampleMapping, sampleDiff);
    const path = join(tmpDir, "workspace.md");

    expect(existsSync(path)).toBe(true);
    const content = readFileSync(path, "utf-8");
    expect(content).toMatch(/^---\n/);
    expect(content).toContain("title: ");
    expect(content).toContain("entity: workspace");
    expect(content).toContain("bubble_type: workspace");
    expect(content).toContain("updated: 2026-04-07");
  });

  it("includes a section about the schema shape", async () => {
    await writeNarrative(tmpDir, sampleMapping, sampleDiff);
    const content = readFileSync(join(tmpDir, "workspace.md"), "utf-8");
    expect(content).toContain("## Fields");
    expect(content).toContain("name_text");
    expect(content).toContain("new_field");
  });

  it("flags unreviewed fields visibly", async () => {
    await writeNarrative(tmpDir, sampleMapping, sampleDiff);
    const content = readFileSync(join(tmpDir, "workspace.md"), "utf-8");
    // The unreviewed field should be called out as needing review
    expect(content.toLowerCase()).toContain("needs review");
  });

  it("records known quirks in a dedicated section", async () => {
    await writeNarrative(tmpDir, sampleMapping, sampleDiff);
    const content = readFileSync(join(tmpDir, "workspace.md"), "utf-8");
    expect(content).toContain("## Known quirks");
    expect(content).toContain("pre-2024 records missing foo");
  });

  it("includes a diff section showing new fields", async () => {
    await writeNarrative(tmpDir, sampleMapping, sampleDiff);
    const content = readFileSync(join(tmpDir, "workspace.md"), "utf-8");
    expect(content).toContain("## Changes since last run");
    expect(content).toContain("new_field");
  });

  it("creates the parent directory if it does not exist", async () => {
    const nested = join(tmpDir, "does", "not", "exist");
    await writeNarrative(nested, sampleMapping, sampleDiff);
    expect(existsSync(join(nested, "workspace.md"))).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/research/narrative.ts`**

```ts
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Mapping, DiffResult, FieldMapEntry } from "./mapping.js";

function formatFieldRow(key: string, entry: FieldMapEntry): string {
  const flag = entry.needs_review ? " **⚠ needs review**" : "";
  const target = entry.target ?? "_(unmapped)_";
  const types = entry.source_value_types.join(" | ") || "_(unknown)_";
  const samples = entry.sample_values.slice(0, 3).map((v) => JSON.stringify(v)).join(", ");
  return [
    `### \`${key}\`${flag}`,
    ``,
    `- **Target:** \`${target}\``,
    `- **Types:** ${types}`,
    `- **Occurrences:** ${entry.occurrence_count}`,
    `- **Samples:** ${samples || "_(none)_"}`,
    ``,
  ].join("\n");
}

export async function writeNarrative(
  destinationDir: string,
  mapping: Mapping,
  diff: DiffResult,
): Promise<void> {
  await mkdir(destinationDir, { recursive: true });

  const frontmatter = [
    "---",
    `title: Bubble shape — ${mapping.entity}`,
    `entity: ${mapping.entity}`,
    `bubble_type: ${mapping.bubble_type}`,
    `target_table: ${mapping.target_table ?? "null"}`,
    `updated: ${mapping.last_verified}`,
    `sample_record_count: ${mapping.sample_record_count}`,
    `total_record_count: ${mapping.total_record_count ?? "unknown"}`,
    "type: bubble-shape",
    "---",
    "",
  ].join("\n");

  const unreviewed = Object.entries(mapping.field_map).filter(([, e]) => e.needs_review);
  const headerNote = unreviewed.length > 0
    ? `> ⚠ **${unreviewed.length} field(s) need review** before this mapping can be used for migration.\n\n`
    : `> ✅ All fields in this mapping have been reviewed.\n\n`;

  const summary = [
    `# ${mapping.entity}`,
    "",
    headerNote,
    `Bubble type: \`${mapping.bubble_type}\` → v3 table: \`${mapping.target_table ?? "(not set)"}\``,
    "",
    `Last verified: **${mapping.last_verified}** from a sample of **${mapping.sample_record_count}** records`,
    mapping.total_record_count !== null ? ` out of **${mapping.total_record_count}** total.` : ".",
    "",
  ].join("");

  const fields = [
    "## Fields",
    "",
    ...Object.entries(mapping.field_map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => formatFieldRow(key, entry)),
  ].join("\n");

  const quirks = mapping.known_quirks.length > 0
    ? [
        "## Known quirks",
        "",
        ...mapping.known_quirks.map((q) => `- ${q}`),
        "",
      ].join("\n")
    : "";

  const changes = [
    "## Changes since last run",
    "",
    diff.newFields.length > 0
      ? `**New fields (${diff.newFields.length}):** ${diff.newFields.join(", ")}`
      : "No new fields.",
    "",
    diff.disappearedFields.length > 0
      ? `**Disappeared fields (${diff.disappearedFields.length}):** ${diff.disappearedFields.join(", ")}`
      : "No disappeared fields.",
    "",
    diff.typeChanges.length > 0
      ? `**Type changes (${diff.typeChanges.length}):**\n${diff.typeChanges.map((c) => `- \`${c.field}\`: ${c.before.join("|")} → ${c.after.join("|")}`).join("\n")}`
      : "No type changes.",
    "",
  ].join("\n");

  const content = frontmatter + summary + fields + "\n" + quirks + changes;

  const path = join(destinationDir, `${mapping.entity}.md`);
  await writeFile(path, content, "utf-8");
}
```

- [ ] **Step 4: Run tests and commit**

```bash
pnpm test && pnpm typecheck
git add -A
git commit -m "feat(research): add vault narrative writer for human-readable shape reports"
```

---

## Task 8: `research_entity` tool

**Files:**
- Create: `src/tools/research_entity.ts`
- Create: `tests/tools/research_entity.test.ts`

**Tool contract:**
- Input: `{ entity: string }` — must match a name in the entity registry
- Output:
  ```ts
  {
    entity: string,
    mappingPath: string,
    narrativePath: string,
    totalRecords: number,
    sampledRecords: number,
    newFields: string[],
    unreviewedCount: number,
    summary: string,
  }
  ```

**Behavior:**
1. Look up entity in `ENTITY_REGISTRY`. Throw if unknown.
2. Sample bidirectionally (first 50 + last 50).
3. Compute observation over the union (deduped by `_id`).
4. Load existing mapping if present, otherwise create an empty mapping.
5. Compute diff.
6. Compute proposed mapping via `propose`.
7. Save the updated mapping to disk.
8. Write narrative to the vault.
9. Return summary.

**Context passed in:** extended from Phase 1's `ToolContext` to include `mappingsDir` and `vaultBubbleShapesDir`.

- [ ] **Step 1: Extend `ToolContext` in `src/tools/list_workspaces.ts`**

Edit `src/tools/list_workspaces.ts` to add the new fields:

```ts
export interface ToolContext {
  bubble: BubbleClient;
  mappingsDir: string;              // NEW
  vaultBubbleShapesDir: string;     // NEW
}
```

Update existing test usages of `ToolContext` in Phase 1 tests if needed — add `mappingsDir: "", vaultBubbleShapesDir: ""` to context literals that don't need these fields. (list_workspaces tests and inspect_workspace tests only use `ctx.bubble`, so TypeScript will require these fields to be present even if unused. Add them as empty strings.)

- [ ] **Step 2: Write the failing test**

`tests/tools/research_entity.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { researchEntityTool } from "../../src/tools/research_entity.js";
import { BubbleClient } from "../../src/bubble/client.js";
import type { BubbleRecord } from "../../src/bubble/types.js";

function makeClient(
  firstN: BubbleRecord[],
  lastN: BubbleRecord[],
  totalCount: number,
): BubbleClient {
  const client = new BubbleClient(
    { bubbleAppUrl: "https://x", bubbleApiToken: "t" },
    vi.fn() as unknown as typeof fetch,
  );
  vi.spyOn(client, "sampleBidirectional").mockResolvedValue({
    firstN,
    lastN,
    totalCount,
  });
  return client;
}

describe("research_entity tool", () => {
  let mappingsDir: string;
  let vaultDir: string;

  beforeEach(() => {
    mappingsDir = mkdtempSync(join(tmpdir(), "strike-mappings-"));
    vaultDir = mkdtempSync(join(tmpdir(), "strike-vault-"));
  });

  afterEach(() => {
    rmSync(mappingsDir, { recursive: true, force: true });
    rmSync(vaultDir, { recursive: true, force: true });
  });

  it("throws on unknown entity name", async () => {
    const client = makeClient([], [], 0);
    await expect(
      researchEntityTool.execute(
        { entity: "doesnotexist" },
        { bubble: client, mappingsDir, vaultBubbleShapesDir: vaultDir },
      ),
    ).rejects.toThrow(/unknown entity/i);
  });

  it("creates a fresh mapping file on first run", async () => {
    const client = makeClient(
      [{ _id: "1", name_text: "Alpha" }, { _id: "2", name_text: "Beta" }],
      [],
      2,
    );
    const result = await researchEntityTool.execute(
      { entity: "workspace" },
      { bubble: client, mappingsDir, vaultBubbleShapesDir: vaultDir },
    );

    expect(existsSync(join(mappingsDir, "workspace.json"))).toBe(true);
    expect(existsSync(join(vaultDir, "workspace.md"))).toBe(true);
    expect(result.totalRecords).toBe(2);
    expect(result.sampledRecords).toBe(2);
    expect(result.newFields).toContain("name_text");
    expect(result.unreviewedCount).toBeGreaterThan(0);
  });

  it("merges union of first and last samples without duplicating by _id", async () => {
    const client = makeClient(
      [{ _id: "1", a: "x" }, { _id: "2", a: "y" }],
      [{ _id: "2", a: "y" }, { _id: "3", a: "z" }],
      3,
    );
    const result = await researchEntityTool.execute(
      { entity: "workspace" },
      { bubble: client, mappingsDir, vaultBubbleShapesDir: vaultDir },
    );

    expect(result.sampledRecords).toBe(3); // deduped
  });

  it("preserves reviewed fields on a subsequent run", async () => {
    // First run
    const client1 = makeClient(
      [{ _id: "1", name_text: "Alpha" }],
      [],
      1,
    );
    await researchEntityTool.execute(
      { entity: "workspace" },
      { bubble: client1, mappingsDir, vaultBubbleShapesDir: vaultDir },
    );

    // Manually mark the field as reviewed (simulating human approval)
    const mappingPath = join(mappingsDir, "workspace.json");
    const mapping = JSON.parse(readFileSync(mappingPath, "utf-8"));
    mapping.field_map.name_text.needs_review = false;
    mapping.field_map.name_text.target = "name";
    mapping.field_map.name_text.transform = "trim";
    require("node:fs").writeFileSync(mappingPath, JSON.stringify(mapping, null, 2));

    // Second run with new data
    const client2 = makeClient(
      [{ _id: "2", name_text: "Beta", new_field: 42 }],
      [],
      2,
    );
    const result2 = await researchEntityTool.execute(
      { entity: "workspace" },
      { bubble: client2, mappingsDir, vaultBubbleShapesDir: vaultDir },
    );

    const updated = JSON.parse(readFileSync(mappingPath, "utf-8"));
    expect(updated.field_map.name_text.needs_review).toBe(false);
    expect(updated.field_map.name_text.target).toBe("name");
    expect(updated.field_map.new_field.needs_review).toBe(true);
    expect(result2.newFields).toContain("new_field");
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Expected: FAIL — module not found.

- [ ] **Step 4: Implement `src/tools/research_entity.ts`**

```ts
import { z } from "zod";
import { getEntityByName } from "../entities.js";
import type { ToolContext } from "./list_workspaces.js";
import type { BubbleRecord } from "../bubble/types.js";
import { loadMapping, saveMapping, hasUnreviewedFields, type Mapping } from "../research/mapping.js";
import { observe } from "../research/observation.js";
import { diff } from "../research/diff.js";
import { propose } from "../research/propose.js";
import { writeNarrative } from "../research/narrative.js";
import { join } from "node:path";

const SAMPLE_SIZE = 50;

export interface ResearchEntityResult {
  entity: string;
  mappingPath: string;
  narrativePath: string;
  totalRecords: number;
  sampledRecords: number;
  newFields: string[];
  unreviewedCount: number;
  summary: string;
}

function dedupeById(records: BubbleRecord[]): BubbleRecord[] {
  const seen = new Set<string>();
  const out: BubbleRecord[] = [];
  for (const r of records) {
    if (seen.has(r._id)) continue;
    seen.add(r._id);
    out.push(r);
  }
  return out;
}

function emptyMapping(entity: string, bubbleType: string): Mapping {
  return {
    entity,
    bubble_type: bubbleType,
    target_table: null,
    field_map: {},
    required_source_fields: [],
    skip_if_missing: [],
    known_quirks: [],
    last_verified: new Date().toISOString().slice(0, 10),
    sample_record_count: 0,
    total_record_count: null,
  };
}

export const researchEntityTool = {
  name: "research_entity",
  description:
    "Sample a Bubble entity type, diff against any existing mapping, and write updated mapping + narrative. Idempotent. New fields are flagged needs_review: true.",
  inputSchema: z.object({
    entity: z.string().min(1),
  }),
  execute: async (
    input: { entity: string },
    ctx: ToolContext,
  ): Promise<ResearchEntityResult> => {
    const entry = getEntityByName(input.entity);
    if (!entry) {
      throw new Error(`Unknown entity: ${input.entity}. See ENTITY_REGISTRY for valid names.`);
    }

    const sample = await ctx.bubble.sampleBidirectional(entry.bubbleType, SAMPLE_SIZE);
    const unified = dedupeById([...sample.firstN, ...sample.lastN]);
    const observation = observe(unified);

    const existing =
      (await loadMapping(ctx.mappingsDir, entry.name)) ??
      emptyMapping(entry.name, entry.bubbleType);

    const diffResult = diff(existing, observation);
    const updated = propose(existing, observation, unified.length);
    updated.total_record_count = sample.totalCount;

    await saveMapping(ctx.mappingsDir, updated);
    await writeNarrative(ctx.vaultBubbleShapesDir, updated, diffResult);

    const unreviewed = Object.values(updated.field_map).filter((f) => f.needs_review).length;

    const summary = hasUnreviewedFields(updated)
      ? `Mapping for "${entry.name}" has ${unreviewed} field(s) marked needs_review. Review before running migrate_${entry.name}.`
      : `Mapping for "${entry.name}" is fully reviewed and ready to migrate.`;

    return {
      entity: entry.name,
      mappingPath: join(ctx.mappingsDir, `${entry.name}.json`),
      narrativePath: join(ctx.vaultBubbleShapesDir, `${entry.name}.md`),
      totalRecords: sample.totalCount,
      sampledRecords: unified.length,
      newFields: diffResult.newFields,
      unreviewedCount: unreviewed,
      summary,
    };
  },
};
```

- [ ] **Step 5: Run tests and commit**

```bash
pnpm test && pnpm typecheck
git add -A
git commit -m "feat(tools): add research_entity tool wiring sample → observe → diff → propose → save"
```

---

## Task 9: Register tool in MCP server + config surface

**Files:**
- Modify: `src/config.ts` (add `mappingsDir` and `vaultBubbleShapesDir` with defaults)
- Modify: `tests/config.test.ts` (add tests for new fields)
- Modify: `src/index.ts` (wire the new context + register `research_entity`)

- [ ] **Step 1: Extend config**

Edit `src/config.ts`:

```ts
export interface Config {
  bubbleAppUrl: string;
  bubbleApiToken: string;
  mappingsDir: string;              // NEW
  vaultBubbleShapesDir: string;     // NEW
}

// inside loadConfig:
  const mappingsDir =
    env.STRIKE_MAPPINGS_DIR ?? "/home/sxtnl/dev/strike-mcp/mappings";
  const vaultBubbleShapesDir =
    env.STRIKE_VAULT_SHAPES_DIR ??
    "/home/sxtnl/dev/second-brain-v2/wiki/migration/bubble-shapes";

  return { bubbleAppUrl, bubbleApiToken, mappingsDir, vaultBubbleShapesDir };
```

- [ ] **Step 2: Add config tests**

Append to `tests/config.test.ts`:

```ts
describe("loadConfig research fields", () => {
  const baseEnv = {
    BUBBLE_APP_URL: "https://x.bubbleapps.io",
    BUBBLE_API_TOKEN: "t",
  };

  it("defaults mappingsDir to the in-repo mappings folder", () => {
    const config = loadConfig(baseEnv);
    expect(config.mappingsDir).toMatch(/mappings$/);
  });

  it("defaults vaultBubbleShapesDir to the vault path", () => {
    const config = loadConfig(baseEnv);
    expect(config.vaultBubbleShapesDir).toMatch(/bubble-shapes$/);
  });

  it("respects STRIKE_MAPPINGS_DIR override", () => {
    const config = loadConfig({ ...baseEnv, STRIKE_MAPPINGS_DIR: "/tmp/custom" });
    expect(config.mappingsDir).toBe("/tmp/custom");
  });

  it("respects STRIKE_VAULT_SHAPES_DIR override", () => {
    const config = loadConfig({ ...baseEnv, STRIKE_VAULT_SHAPES_DIR: "/tmp/vault" });
    expect(config.vaultBubbleShapesDir).toBe("/tmp/vault");
  });
});
```

- [ ] **Step 3: Wire the new context in the server**

Edit `src/index.ts`:

Import the new tool and use the extended config:

```ts
import { researchEntityTool } from "./tools/research_entity.js";

// in main() where ctx is constructed:
  const ctx = {
    bubble,
    mappingsDir: config.mappingsDir,
    vaultBubbleShapesDir: config.vaultBubbleShapesDir,
  };

// in tools array:
  const tools = [listWorkspacesTool, inspectWorkspaceTool, researchEntityTool];
```

- [ ] **Step 4: Verify everything builds and tests pass**

```bash
pnpm test && pnpm typecheck && pnpm build
```

Expected: all tests pass (including new config tests), typecheck clean, build succeeds.

- [ ] **Step 5: Manual tools/list probe**

```bash
BUBBLE_APP_URL=https://fake.bubbleapps.io BUBBLE_API_TOKEN=fake \
  node dist/index.js <<'EOF'
{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}
EOF
```

Expected response includes all three tool names: `list_workspaces`, `inspect_workspace`, `research_entity`. Ctrl+C to exit.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(server): register research_entity tool with mapping + vault config"
```

---

## Task 10: End-to-end smoke test against real Bubble

**Files:**
- Modify: `README.md` (append Phase 2 smoke test procedure)

This task is a manual verification against production Bubble. It requires a real API token from 1Password. Do not run it inside a subagent — a human operator runs it.

- [ ] **Step 1: Append smoke test procedure to README**

Add this section to `README.md`:

```markdown

## Phase 2 smoke test — research engine

1. Ensure strike-mcp is registered with Claude Code (see `.mcp.json.example`)
2. Set `STRIKE_VAULT_SHAPES_DIR` if your second-brain vault is in a different location
3. In a Claude Code session, ask:
   > "Use strike-mcp to research the workspace entity."
4. Expected: a new file at `mappings/workspace.json` and another at
   `~/dev/second-brain-v2/wiki/migration/bubble-shapes/workspace.md`
5. Open the narrative file in Obsidian. Review the field list. Mark fields as
   reviewed (edit `mappings/workspace.json` directly: set `needs_review: false`
   on entries you accept, set the `target` column name correctly).
6. Re-run: "research the workspace entity again"
7. Expected: the narrative shows "No new fields" and the reviewed entries are
   preserved unchanged.
8. Repeat for `locations`.

If research reveals Bubble type names in the registry that are wrong (e.g. the
Bubble API returns 404 for `location` but works for `org_location`), update
`src/entities.ts` with the correct names, rebuild, and re-run.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add Phase 2 smoke test procedure to README"
```

- [ ] **Step 3: Execute smoke test manually**

Run the procedure above. Capture results in `docs/superpowers/notes/phase-2-smoke-test.md`:

- Which entities were researched
- What the narrative looked like for each
- Any Bubble type name corrections needed in `src/entities.ts`
- Any surprises (e.g. unexpected field shapes, sparse records on recent data)

These findings feed directly into Phase 3 (engine + first migrators).

---

## Phase 2 Exit Criteria

- [x] `BubbleClient.fetchMeta` and `BubbleClient.sampleBidirectional` implemented and tested
- [x] `src/research/` subsystem with pure `observe`, `diff`, `propose` functions
- [x] `Mapping` types and IO (load/save) tested
- [x] Vault narrative writer produces valid markdown with frontmatter
- [x] `research_entity` tool wired end-to-end
- [x] Config extended with `mappingsDir` and `vaultBubbleShapesDir`
- [x] All tools registered in MCP server
- [x] Full test suite passes, typecheck clean, build succeeds
- [x] Smoke test executed against production Bubble for at least `workspace` and `locations`
- [x] Any Bubble type name corrections applied to `src/entities.ts`

After Phase 2 is complete, we have:
- A reusable, idempotent way to characterize any Bubble entity
- Two persistent sources of truth for what we've learned (machine + human)
- A safety gate (`needs_review: true`) that blocks migration until fields are confirmed

Phase 3 then adds the actual migration engine on top of these mappings.
