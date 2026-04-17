# strike-mcp Phase 3 Implementation Plan — Engine + First Migrators + Full Safety Chain

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the migration engine. After this phase, strike-mcp can take a workspace, run two `migrate_*` tools (workspace + locations), bundle them into a single transactional SQL file, and stage it for human review and manual application against Supabase. The architectural risk of the entire project resolves at the end of this phase.

**Architecture:** A pure config-driven engine that loads a Phase 2 mapping, fetches workspace-scoped records via the Bubble client, applies built-in transforms (with deterministic UUID generation for FK references), and emits per-table INSERT statements wrapped in BEGIN/COMMIT. Output goes to `supabase/migration-staging/<workspace-slug>/` — a directory the Supabase CLI ignores. The engine is `INSERT`-only and never writes to Supabase directly. The only Supabase contact is `verify_target_empty`, which uses a read-only key.

**Tech Stack:** Same as Phase 1+2. Adds `@supabase/supabase-js` (read-only) and `slugify` (or a hand-rolled equivalent — we'll do hand-rolled to avoid the dep).

**Prerequisites:** Phase 1 + Phase 2 merged on `main`. Bubble client, mapping types/IO, observe/diff/propose/narrative, `research_entity` tool all exist. Smoke tests against real Bubble have been run and any provisional Bubble type names in `src/entities.ts` have been corrected.

**Critical safety guarantees enforced by this phase:**
1. No DML execution against Supabase by strike-mcp
2. Output goes to a Supabase-CLI-ignored directory
3. Generated SQL is wrapped in `BEGIN` / `COMMIT`
4. `verify_target_empty` blocks bundling if target workspace already has data
5. Migration tool refuses to run if any field has `needs_review: true`
6. Migration tool refuses if `mapping.target_table` is null
7. Deterministic UUIDv5 namespace ensures re-runs collide with existing data (safety net on top of #4)

---

## File Structure

```
strike-mcp/
├── src/
│   ├── migration/                              # NEW subsystem
│   │   ├── types.ts                            # MigrationContext, EmittedRow, MigrationReport
│   │   ├── uuid.ts                             # deterministic UUIDv5 helper
│   │   ├── transforms.ts                       # built-in transforms (trim, fk_uuid, etc.)
│   │   ├── engine.ts                           # mapping × records → emitted rows
│   │   ├── sql_emitter.ts                      # rows → SQL string with header + BEGIN/COMMIT
│   │   └── staging.ts                          # write SQL + report files to staging dir
│   ├── supabase/                               # NEW
│   │   └── client.ts                           # read-only Supabase REST client (verify_target_empty only)
│   ├── tools/
│   │   ├── migrate_workspace.ts                # NEW
│   │   ├── migrate_locations.ts                # NEW
│   │   ├── plan_migration.ts                   # NEW
│   │   ├── preview_sql.ts                      # NEW
│   │   ├── verify_target_empty.ts              # NEW
│   │   └── bundle_migration.ts                 # NEW
│   ├── config.ts                               # MODIFY: add stagingDir, supabaseUrl, supabaseAnonKey
│   └── index.ts                                # MODIFY: register 6 new tools
├── tests/
│   ├── migration/
│   │   ├── uuid.test.ts
│   │   ├── transforms.test.ts
│   │   ├── engine.test.ts
│   │   ├── sql_emitter.test.ts
│   │   └── staging.test.ts
│   ├── supabase/
│   │   └── client.test.ts
│   ├── tools/
│   │   ├── migrate_workspace.test.ts
│   │   ├── migrate_locations.test.ts
│   │   ├── plan_migration.test.ts
│   │   ├── preview_sql.test.ts
│   │   ├── verify_target_empty.test.ts
│   │   └── bundle_migration.test.ts
│   └── fixtures/
│       └── workspace_records.json              # realistic Bubble workspace records for engine tests
└── supabase/                                   # NEW directory (in strike-mcp repo for staging)
    └── migration-staging/                      # NEW; output target for migration files
        └── .gitkeep
```

**Decomposition rationale:**

- The migration subsystem is split by responsibility: ID generation, transforms, engine logic, SQL serialization, file IO. Each piece is small and testable in isolation.
- `engine.ts` is the only thing that ties them together — and it's still pure (takes mapping + records + ctx, returns rows).
- The `sql_emitter` is pure too (takes rows + metadata, returns a string). Filesystem IO lives only in `staging.ts`.
- `supabase/client.ts` is the *only* file that talks to Supabase, and only for read queries. Putting it in its own directory makes it visually obvious — anyone reviewing the codebase can verify by inspection that nothing else under `src/` imports `@supabase/supabase-js` for write operations.

---

## Type contract (cross-task)

These are defined in `src/migration/types.ts` (Task 1) and imported by all subsequent files.

```ts
import type { Mapping } from "../research/mapping.js";
import type { BubbleRecord } from "../bubble/types.js";

export interface MigrationContext {
  workspaceId: string;       // Bubble workspace ID being migrated
  workspaceSlug: string;     // human-friendly slug used in staging dir name
  mapping: Mapping;          // the mapping for the entity being migrated
}

export interface EmittedRow {
  table: string;             // target Supabase table
  values: Record<string, unknown>; // column → value, JSON-serializable
}

export interface RecordSkip {
  recordId: string;
  reason: string;
}

export interface MigrationResult {
  rows: EmittedRow[];
  skipped: RecordSkip[];
  warnings: string[];
}

export interface MigrationReport {
  entity: string;
  workspaceId: string;
  workspaceSlug: string;
  recordsProcessed: number;
  recordsEmitted: number;
  recordsSkipped: number;
  warnings: string[];
  generatedAt: string;       // ISO timestamp
  sqlFilePath: string;
  reportFilePath: string;
}
```

---

## Task 1: Migration types + namespace constant

**Files:**
- Create: `src/migration/types.ts`
- Create: `src/migration/uuid.ts`
- Create: `tests/migration/uuid.test.ts`

**Why these together:** `uuid.ts` uses the `STRIKE_NAMESPACE_UUID` constant which is the architectural cornerstone. Defining it in the same task as the types ensures it's locked in before any tool depends on it.

- [ ] **Step 1: Create `src/migration/types.ts`**

```ts
import type { Mapping } from "../research/mapping.js";
import type { BubbleRecord } from "../bubble/types.js";

export interface MigrationContext {
  workspaceId: string;
  workspaceSlug: string;
  mapping: Mapping;
}

export interface EmittedRow {
  table: string;
  values: Record<string, unknown>;
}

export interface RecordSkip {
  recordId: string;
  reason: string;
}

export interface MigrationResult {
  rows: EmittedRow[];
  skipped: RecordSkip[];
  warnings: string[];
}

export interface MigrationReport {
  entity: string;
  workspaceId: string;
  workspaceSlug: string;
  recordsProcessed: number;
  recordsEmitted: number;
  recordsSkipped: number;
  warnings: string[];
  generatedAt: string;
  sqlFilePath: string;
  reportFilePath: string;
}

// Re-export for callers
export type { Mapping, BubbleRecord };
```

- [ ] **Step 2: Write the failing test for `uuid.ts`**

`tests/migration/uuid.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { strikeUuid, STRIKE_NAMESPACE_UUID } from "../../src/migration/uuid.js";

describe("strikeUuid", () => {
  it("returns a valid UUID v5", () => {
    const id = strikeUuid("workspaces", "1612345678901x111111111111111111");
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("is deterministic — same inputs produce same UUID", () => {
    const id1 = strikeUuid("workspaces", "1612345678901x111111111111111111");
    const id2 = strikeUuid("workspaces", "1612345678901x111111111111111111");
    expect(id1).toBe(id2);
  });

  it("different entities produce different UUIDs for the same Bubble ID", () => {
    const ws = strikeUuid("workspaces", "abc123");
    const loc = strikeUuid("locations", "abc123");
    expect(ws).not.toBe(loc);
  });

  it("different Bubble IDs produce different UUIDs for the same entity", () => {
    const a = strikeUuid("workspaces", "abc123");
    const b = strikeUuid("workspaces", "def456");
    expect(a).not.toBe(b);
  });

  it("STRIKE_NAMESPACE_UUID is a constant valid UUID", () => {
    expect(STRIKE_NAMESPACE_UUID).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
cd ~/dev/strike-mcp
pnpm test
```

Expected: FAIL — module not found.

- [ ] **Step 4: Implement `src/migration/uuid.ts`**

```ts
import { createHash } from "node:crypto";

/**
 * UUID namespace for strike-mcp generated entities. Constant — must never change.
 * Changing this would break all existing migrations.
 *
 * Generated once via uuidgen on 2026-04-07.
 */
export const STRIKE_NAMESPACE_UUID = "8b4f3a8c-6d1e-4a2f-9c5b-1e7d3a8c6f4e";

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/-/g, "");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesToUuid(bytes: Uint8Array): string {
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20, 32)}`;
}

/**
 * UUIDv5 (RFC 4122 §4.3) using SHA-1.
 */
function uuidv5(name: string, namespace: string): string {
  const namespaceBytes = hexToBytes(namespace);
  const nameBytes = new TextEncoder().encode(name);
  const combined = new Uint8Array(namespaceBytes.length + nameBytes.length);
  combined.set(namespaceBytes, 0);
  combined.set(nameBytes, namespaceBytes.length);

  const hash = createHash("sha1").update(combined).digest();
  const bytes = new Uint8Array(hash.subarray(0, 16));

  // Set version (5) in byte 6
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  // Set variant (RFC 4122) in byte 8
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  return bytesToUuid(bytes);
}

/**
 * Compute the deterministic v3 UUID for a strike-mcp entity.
 * Same inputs always produce the same UUID — re-running migrations collides
 * with existing data, surfacing duplicates as unique-constraint violations.
 */
export function strikeUuid(entity: string, bubbleId: string): string {
  return uuidv5(`${entity}:${bubbleId}`, STRIKE_NAMESPACE_UUID);
}
```

- [ ] **Step 5: Run tests, commit**

```bash
pnpm test && pnpm typecheck
git add -A
git commit -m "feat(migration): add deterministic UUID helper and namespace constant"
```

---

## Task 2: Built-in transforms

**Files:**
- Create: `src/migration/transforms.ts`
- Create: `tests/migration/transforms.test.ts`

**Purpose:** A registry of named transforms that the engine resolves by string. Each transform takes `(value, context)` and returns the transformed value. Pure functions, no IO.

Built-in names:
- `trim` — string trim
- `lowercase`, `uppercase`
- `bubble_date_to_tstz` — Bubble ISO date string → PostgreSQL timestamptz string (passthrough if already valid)
- `fk_uuid:<entity>` — interprets value as a Bubble ID, returns `strikeUuid(entity, value)`
- `nullable` — returns null if input is null/undefined/empty string, else returns input

- [ ] **Step 1: Write the failing test**

`tests/migration/transforms.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { applyTransform } from "../../src/migration/transforms.js";
import { strikeUuid } from "../../src/migration/uuid.js";

describe("applyTransform", () => {
  it("trim removes whitespace", () => {
    expect(applyTransform("trim", "  hello  ")).toBe("hello");
  });

  it("trim passes through non-strings unchanged", () => {
    expect(applyTransform("trim", 42)).toBe(42);
    expect(applyTransform("trim", null)).toBe(null);
  });

  it("lowercase converts strings", () => {
    expect(applyTransform("lowercase", "HELLO")).toBe("hello");
  });

  it("uppercase converts strings", () => {
    expect(applyTransform("uppercase", "hello")).toBe("HELLO");
  });

  it("bubble_date_to_tstz passes through ISO dates", () => {
    const iso = "2026-03-15T10:30:00.000Z";
    expect(applyTransform("bubble_date_to_tstz", iso)).toBe(iso);
  });

  it("bubble_date_to_tstz returns null for null input", () => {
    expect(applyTransform("bubble_date_to_tstz", null)).toBe(null);
  });

  it("fk_uuid:workspaces produces deterministic UUID from Bubble ID", () => {
    const result = applyTransform("fk_uuid:workspaces", "1612345678901x111111111111111111");
    expect(result).toBe(strikeUuid("workspaces", "1612345678901x111111111111111111"));
  });

  it("fk_uuid returns null when input is null", () => {
    expect(applyTransform("fk_uuid:workspaces", null)).toBe(null);
  });

  it("fk_uuid returns null when input is empty string", () => {
    expect(applyTransform("fk_uuid:workspaces", "")).toBe(null);
  });

  it("nullable converts empty string to null", () => {
    expect(applyTransform("nullable", "")).toBe(null);
    expect(applyTransform("nullable", null)).toBe(null);
    expect(applyTransform("nullable", undefined)).toBe(null);
    expect(applyTransform("nullable", "value")).toBe("value");
  });

  it("returns value unchanged when transform name is null", () => {
    expect(applyTransform(null, "anything")).toBe("anything");
  });

  it("throws on unknown transform name", () => {
    expect(() => applyTransform("nonexistent", "x")).toThrow(/unknown transform/i);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/migration/transforms.ts`**

```ts
import { strikeUuid } from "./uuid.js";

const NULLISH = (v: unknown): boolean =>
  v === null || v === undefined || v === "";

export function applyTransform(name: string | null, value: unknown): unknown {
  if (name === null || name === undefined) return value;

  // FK transforms have parameterized names
  if (name.startsWith("fk_uuid:")) {
    const entity = name.slice("fk_uuid:".length);
    if (NULLISH(value)) return null;
    if (typeof value !== "string") {
      throw new Error(`fk_uuid:${entity} expected string Bubble ID, got ${typeof value}`);
    }
    return strikeUuid(entity, value);
  }

  switch (name) {
    case "trim":
      return typeof value === "string" ? value.trim() : value;
    case "lowercase":
      return typeof value === "string" ? value.toLowerCase() : value;
    case "uppercase":
      return typeof value === "string" ? value.toUpperCase() : value;
    case "bubble_date_to_tstz":
      // Bubble already returns ISO 8601 strings; passthrough is correct.
      // null/undefined → null
      return NULLISH(value) ? null : value;
    case "nullable":
      return NULLISH(value) ? null : value;
    default:
      throw new Error(`Unknown transform: ${name}`);
  }
}
```

- [ ] **Step 4: Run tests and commit**

```bash
pnpm test && pnpm typecheck
git add -A
git commit -m "feat(migration): add built-in transforms registry"
```

---

## Task 3: Workspace slug helper + read-only Supabase client

**Files:**
- Create: `src/supabase/client.ts`
- Create: `tests/supabase/client.test.ts`

**Purpose:** Tiny REST client that hits Supabase's PostgREST endpoint for SELECT-only queries. Used exclusively by `verify_target_empty`. Has no service role key. We hand-roll this against `fetch` instead of pulling in `@supabase/supabase-js` because we only need one method (count rows by filter) and adding the SDK would give us write capabilities we explicitly don't want.

- [ ] **Step 1: Write the failing test**

`tests/supabase/client.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { SupabaseReadClient } from "../../src/supabase/client.js";

describe("SupabaseReadClient.count", () => {
  it("returns the count from PostgREST Content-Range header", async () => {
    const fetchSpy = vi.fn(async () => {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: {
          "content-range": "0-0/42",
        },
      });
    }) as unknown as typeof fetch;

    const client = new SupabaseReadClient(
      { url: "https://abc.supabase.co", anonKey: "key" },
      fetchSpy,
    );
    const count = await client.count("workspaces", { slug: "alpha" });
    expect(count).toBe(42);
  });

  it("returns 0 when range header reports zero", async () => {
    const fetchSpy = vi.fn(async () => {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { "content-range": "*/0" },
      });
    }) as unknown as typeof fetch;

    const client = new SupabaseReadClient(
      { url: "https://abc.supabase.co", anonKey: "key" },
      fetchSpy,
    );
    const count = await client.count("workspaces", { slug: "missing" });
    expect(count).toBe(0);
  });

  it("sends auth headers and Prefer: count=exact", async () => {
    const fetchSpy = vi.fn(async () => {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { "content-range": "*/0" },
      });
    }) as unknown as typeof fetch;

    const client = new SupabaseReadClient(
      { url: "https://abc.supabase.co", anonKey: "secret-key" },
      fetchSpy,
    );
    await client.count("workspaces", { slug: "alpha" });

    const init = (fetchSpy as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers["apikey"]).toBe("secret-key");
    expect(headers["Authorization"]).toBe("Bearer secret-key");
    expect(headers["Prefer"]).toContain("count=exact");
  });

  it("builds the URL with eq filter", async () => {
    const fetchSpy = vi.fn(async () => {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { "content-range": "*/0" },
      });
    }) as unknown as typeof fetch;

    const client = new SupabaseReadClient(
      { url: "https://abc.supabase.co", anonKey: "k" },
      fetchSpy,
    );
    await client.count("workspaces", { slug: "alpha" });

    const url = (fetchSpy as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain("/rest/v1/workspaces");
    expect(url).toContain("slug=eq.alpha");
    expect(url).toContain("select=*");
  });

  it("throws on non-2xx response", async () => {
    const fetchSpy = vi.fn(async () => {
      return new Response("nope", { status: 401 });
    }) as unknown as typeof fetch;

    const client = new SupabaseReadClient(
      { url: "https://abc.supabase.co", anonKey: "k" },
      fetchSpy,
    );
    await expect(client.count("workspaces", {})).rejects.toThrow(/401/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/supabase/client.ts`**

```ts
export interface SupabaseClientConfig {
  url: string;       // e.g. https://abc.supabase.co
  anonKey: string;   // anon (read-only) key
}

export class SupabaseReadClient {
  private readonly config: SupabaseClientConfig;
  private readonly fetchImpl: typeof fetch;

  constructor(config: SupabaseClientConfig, fetchImpl: typeof fetch = globalThis.fetch) {
    this.config = config;
    this.fetchImpl = fetchImpl;
  }

  /**
   * Count rows in a table matching equality filters.
   * Uses PostgREST count=exact via the Prefer header.
   */
  async count(table: string, filters: Record<string, string>): Promise<number> {
    const params = new URLSearchParams();
    params.set("select", "*");
    for (const [key, value] of Object.entries(filters)) {
      params.set(key, `eq.${value}`);
    }
    const url = `${this.config.url}/rest/v1/${encodeURIComponent(table)}?${params.toString()}`;

    const res = await this.fetchImpl(url, {
      method: "GET",
      headers: {
        apikey: this.config.anonKey,
        Authorization: `Bearer ${this.config.anonKey}`,
        Prefer: "count=exact",
        "Range-Unit": "items",
      },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Supabase ${res.status}: ${body.slice(0, 200)}`);
    }

    const range = res.headers.get("content-range") ?? "";
    const total = range.split("/")[1] ?? "0";
    return parseInt(total, 10) || 0;
  }
}
```

- [ ] **Step 4: Run tests and commit**

```bash
pnpm test && pnpm typecheck
git add -A
git commit -m "feat(supabase): add read-only count client (no write capability)"
```

---

## Task 4: Migration engine

**Files:**
- Create: `src/migration/engine.ts`
- Create: `tests/migration/engine.test.ts`

**Purpose:** Take a `Mapping` and a list of `BubbleRecord`s, apply field maps + transforms, return `EmittedRow`s. Skip records that fail validation (missing required fields, wrong types). Track skips and warnings.

This is the core of Phase 3. Pure function. No IO. No client. Tested with hand-built mappings and records.

- [ ] **Step 1: Write the failing test**

`tests/migration/engine.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { runEngine } from "../../src/migration/engine.js";
import { strikeUuid } from "../../src/migration/uuid.js";
import type { Mapping } from "../../src/research/mapping.js";
import type { BubbleRecord } from "../../src/bubble/types.js";

function mkMapping(overrides?: Partial<Mapping>): Mapping {
  return {
    entity: "workspaces",
    bubble_type: "workspace",
    target_table: "workspaces",
    field_map: {
      _id: {
        target: "id",
        transform: "fk_uuid:workspaces",
        needs_review: false,
        source_value_types: ["string"],
        occurrence_count: 100,
        sample_values: [],
      },
      name_text: {
        target: "name",
        transform: "trim",
        needs_review: false,
        source_value_types: ["string"],
        occurrence_count: 100,
        sample_values: [],
      },
      "Created Date": {
        target: "created_at",
        transform: "bubble_date_to_tstz",
        needs_review: false,
        source_value_types: ["string"],
        occurrence_count: 100,
        sample_values: [],
      },
    },
    required_source_fields: ["_id", "name_text"],
    skip_if_missing: [],
    known_quirks: [],
    last_verified: "2026-04-07",
    sample_record_count: 100,
    total_record_count: 100,
    ...overrides,
  };
}

describe("runEngine", () => {
  it("emits one row per record with mapped + transformed fields", () => {
    const mapping = mkMapping();
    const records: BubbleRecord[] = [
      {
        _id: "1612345678901x111111111111111111",
        name_text: "  Strøm Mat & Bar  ",
        "Created Date": "2023-01-15T10:00:00.000Z",
      },
      {
        _id: "1612345678902x222222222222222222",
        name_text: "Kafé Ost",
        "Created Date": "2023-02-01T09:00:00.000Z",
      },
    ];

    const result = runEngine(mapping, records, {
      workspaceId: "irrelevant",
      workspaceSlug: "irrelevant",
      mapping,
    });

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].table).toBe("workspaces");
    expect(result.rows[0].values).toEqual({
      id: strikeUuid("workspaces", "1612345678901x111111111111111111"),
      name: "Strøm Mat & Bar",
      created_at: "2023-01-15T10:00:00.000Z",
    });
    expect(result.skipped).toEqual([]);
  });

  it("skips records missing required source fields", () => {
    const mapping = mkMapping();
    const records: BubbleRecord[] = [
      { _id: "a", name_text: "Has name" },
      { _id: "b" }, // missing name_text
    ];

    const result = runEngine(mapping, records, {
      workspaceId: "irrelevant",
      workspaceSlug: "irrelevant",
      mapping,
    });

    expect(result.rows).toHaveLength(1);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].recordId).toBe("b");
    expect(result.skipped[0].reason).toMatch(/required.*name_text/i);
  });

  it("ignores fields whose target is null (unmapped)", () => {
    const mapping = mkMapping();
    mapping.field_map.unmapped_field = {
      target: null,
      transform: null,
      needs_review: false,
      source_value_types: ["string"],
      occurrence_count: 5,
      sample_values: [],
    };
    const records: BubbleRecord[] = [
      { _id: "a", name_text: "alpha", unmapped_field: "should be dropped" },
    ];

    const result = runEngine(mapping, records, {
      workspaceId: "x",
      workspaceSlug: "x",
      mapping,
    });

    expect(result.rows[0].values).not.toHaveProperty("unmapped_field");
    expect(Object.keys(result.rows[0].values).sort()).toEqual(["created_at", "id", "name"]);
  });

  it("throws if any field has needs_review: true", () => {
    const mapping = mkMapping();
    mapping.field_map.name_text.needs_review = true;
    expect(() =>
      runEngine(mapping, [], { workspaceId: "x", workspaceSlug: "x", mapping }),
    ).toThrow(/needs_review/i);
  });

  it("throws if mapping.target_table is null", () => {
    const mapping = mkMapping({ target_table: null });
    expect(() =>
      runEngine(mapping, [], { workspaceId: "x", workspaceSlug: "x", mapping }),
    ).toThrow(/target_table/i);
  });

  it("captures unknown transform errors as record skips, not throws", () => {
    const mapping = mkMapping();
    mapping.field_map.name_text.transform = "nonexistent_transform";
    const records: BubbleRecord[] = [{ _id: "a", name_text: "x" }];

    const result = runEngine(mapping, records, {
      workspaceId: "x",
      workspaceSlug: "x",
      mapping,
    });

    expect(result.rows).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].reason).toMatch(/transform/i);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/migration/engine.ts`**

```ts
import { applyTransform } from "./transforms.js";
import type {
  MigrationContext,
  MigrationResult,
  EmittedRow,
  RecordSkip,
} from "./types.js";
import type { Mapping } from "../research/mapping.js";
import type { BubbleRecord } from "../bubble/types.js";
import { hasUnreviewedFields } from "../research/mapping.js";

export function runEngine(
  mapping: Mapping,
  records: BubbleRecord[],
  ctx: MigrationContext,
): MigrationResult {
  if (mapping.target_table === null) {
    throw new Error(
      `Mapping for "${mapping.entity}" has no target_table. Set it in mappings/${mapping.entity}.json before running migration.`,
    );
  }
  if (hasUnreviewedFields(mapping)) {
    const unreviewed = Object.entries(mapping.field_map)
      .filter(([, f]) => f.needs_review)
      .map(([k]) => k);
    throw new Error(
      `Mapping for "${mapping.entity}" has ${unreviewed.length} unreviewed field(s): ${unreviewed.join(", ")}. Review and set needs_review: false before migrating.`,
    );
  }

  const rows: EmittedRow[] = [];
  const skipped: RecordSkip[] = [];
  const warnings: string[] = [];

  for (const record of records) {
    const recordId = String(record._id ?? "(unknown)");

    // Check required fields
    const missingRequired = mapping.required_source_fields.filter((key) => {
      const v = record[key];
      return v === undefined || v === null || v === "";
    });
    if (missingRequired.length > 0) {
      skipped.push({
        recordId,
        reason: `missing required source field(s): ${missingRequired.join(", ")}`,
      });
      continue;
    }

    // Build the row from mapped fields
    const values: Record<string, unknown> = {};
    let recordError: string | null = null;

    for (const [sourceKey, entry] of Object.entries(mapping.field_map)) {
      if (entry.target === null) continue; // explicitly unmapped — drop
      const sourceValue = record[sourceKey];

      try {
        const transformed = applyTransform(entry.transform, sourceValue);
        values[entry.target] = transformed;
      } catch (err) {
        recordError = `transform error on field "${sourceKey}": ${err instanceof Error ? err.message : String(err)}`;
        break;
      }
    }

    if (recordError !== null) {
      skipped.push({ recordId, reason: recordError });
      continue;
    }

    rows.push({ table: mapping.target_table, values });
  }

  return { rows, skipped, warnings };
}
```

- [ ] **Step 4: Run tests and commit**

```bash
pnpm test && pnpm typecheck
git add -A
git commit -m "feat(migration): add core engine for mapping × records → rows"
```

---

## Task 5: SQL emitter

**Files:**
- Create: `src/migration/sql_emitter.ts`
- Create: `tests/migration/sql_emitter.test.ts`

**Purpose:** Pure function. Takes emitted rows + metadata, returns a SQL string with header comment block, BEGIN/COMMIT wrapping, and one INSERT per row. Properly escapes string values. Handles null. INSERT-only — never DELETE/UPDATE.

- [ ] **Step 1: Write the failing test**

`tests/migration/sql_emitter.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { emitSql } from "../../src/migration/sql_emitter.js";
import type { EmittedRow } from "../../src/migration/types.js";

const sampleRows: EmittedRow[] = [
  {
    table: "workspaces",
    values: {
      id: "8b4f3a8c-6d1e-4a2f-9c5b-1e7d3a8c6f4e",
      name: "Strøm Mat & Bar",
      created_at: "2023-01-15T10:00:00.000Z",
    },
  },
  {
    table: "workspaces",
    values: {
      id: "ab123456-cd78-9012-3456-7890abcdef12",
      name: "Kafé Ost",
      created_at: null,
    },
  },
];

const meta = {
  entity: "workspaces",
  workspaceId: "1612345678901x111111111111111111",
  workspaceSlug: "strom-mat-og-bar",
  generatedAt: "2026-04-07T19:00:00.000Z",
  bubbleSourceRevision: "workspace@2026-04-01",
};

describe("emitSql", () => {
  it("wraps the output in BEGIN; ... COMMIT;", () => {
    const sql = emitSql(sampleRows, meta);
    expect(sql).toMatch(/^BEGIN;/);
    expect(sql.trim()).toMatch(/COMMIT;$/);
  });

  it("includes a header comment with metadata", () => {
    const sql = emitSql(sampleRows, meta);
    expect(sql).toContain("-- strike-mcp generated migration");
    expect(sql).toContain("-- entity: workspaces");
    expect(sql).toContain("-- workspace: 1612345678901x111111111111111111");
    expect(sql).toContain("-- workspace_slug: strom-mat-og-bar");
    expect(sql).toContain("-- generated: 2026-04-07T19:00:00.000Z");
    expect(sql).toContain("-- REVIEW BEFORE APPLYING");
  });

  it("emits one INSERT per row", () => {
    const sql = emitSql(sampleRows, meta);
    const inserts = sql.match(/INSERT INTO/g);
    expect(inserts).toHaveLength(2);
  });

  it("escapes single quotes in string values", () => {
    const rows: EmittedRow[] = [
      {
        table: "workspaces",
        values: { id: "x", name: "O'Brien's Bar" },
      },
    ];
    const sql = emitSql(rows, meta);
    expect(sql).toContain("'O''Brien''s Bar'");
  });

  it("emits NULL for null values without quotes", () => {
    const sql = emitSql(sampleRows, meta);
    expect(sql).toContain("NULL");
    expect(sql).not.toContain("'null'");
  });

  it("handles numbers and booleans without quotes", () => {
    const rows: EmittedRow[] = [
      {
        table: "items",
        values: { id: "x", count: 42, active: true },
      },
    ];
    const sql = emitSql(rows, meta);
    expect(sql).toContain("42");
    expect(sql).toContain("true");
    expect(sql).not.toContain("'42'");
  });

  it("returns an empty migration body (just BEGIN/COMMIT and header) when there are no rows", () => {
    const sql = emitSql([], meta);
    expect(sql).toContain("BEGIN;");
    expect(sql).toContain("COMMIT;");
    expect(sql).not.toContain("INSERT INTO");
  });

  it("never emits DELETE or UPDATE", () => {
    const sql = emitSql(sampleRows, meta);
    expect(sql).not.toMatch(/\bDELETE\b/);
    expect(sql).not.toMatch(/\bUPDATE\b/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/migration/sql_emitter.ts`**

```ts
import type { EmittedRow } from "./types.js";

export interface SqlMeta {
  entity: string;
  workspaceId: string;
  workspaceSlug: string;
  generatedAt: string;
  bubbleSourceRevision?: string;
}

function escapeString(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

function literal(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "string") return escapeString(value);
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "boolean") return value ? "true" : "false";
  // Objects and arrays — JSON-serialize then quote (Postgres jsonb)
  return escapeString(JSON.stringify(value));
}

export function emitSql(rows: EmittedRow[], meta: SqlMeta): string {
  const header = [
    "-- strike-mcp generated migration",
    `-- entity: ${meta.entity}`,
    `-- workspace: ${meta.workspaceId}`,
    `-- workspace_slug: ${meta.workspaceSlug}`,
    `-- generated: ${meta.generatedAt}`,
    `-- rows: ${rows.length}`,
    meta.bubbleSourceRevision ? `-- source bubble revision: ${meta.bubbleSourceRevision}` : null,
    "-- REVIEW BEFORE APPLYING",
    "",
  ]
    .filter((l) => l !== null)
    .join("\n");

  const inserts = rows.map((row) => {
    const cols = Object.keys(row.values);
    const vals = cols.map((c) => literal(row.values[c]));
    return `INSERT INTO ${row.table} (${cols.join(", ")}) VALUES (${vals.join(", ")});`;
  });

  return ["BEGIN;", "", header, ...inserts, "", "COMMIT;", ""].join("\n");
}
```

- [ ] **Step 4: Run tests and commit**

```bash
pnpm test && pnpm typecheck
git add -A
git commit -m "feat(migration): add SQL emitter with BEGIN/COMMIT wrapping and escaping"
```

---

## Task 6: Staging directory writer + slug helper

**Files:**
- Create: `src/migration/staging.ts`
- Create: `tests/migration/staging.test.ts`
- Create: `supabase/migration-staging/.gitkeep`

**Purpose:** Take a SQL string and a report markdown string, write them to `<stagingDir>/<workspaceSlug>/<NN>_<entity>.{sql,md}`. Numbered prefixes ensure deterministic ordering when bundled. Also exports a `slugify` helper used everywhere.

- [ ] **Step 1: Create the staging dir placeholder**

```bash
mkdir -p ~/dev/strike-mcp/supabase/migration-staging
touch ~/dev/strike-mcp/supabase/migration-staging/.gitkeep
```

- [ ] **Step 2: Write the failing test**

`tests/migration/staging.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeStagedFiles, slugify } from "../../src/migration/staging.js";

describe("slugify", () => {
  it("lowercases", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("replaces non-alphanumeric with dashes", () => {
    expect(slugify("Strøm Mat & Bar")).toBe("strom-mat-bar");
  });

  it("strips leading/trailing dashes and collapses repeats", () => {
    expect(slugify("---hello---world---")).toBe("hello-world");
  });

  it("converts Norwegian characters", () => {
    expect(slugify("Æble & Øst Café")).toBe("ble-ost-cafe");
  });

  it("returns 'unnamed' for empty result", () => {
    expect(slugify("")).toBe("unnamed");
    expect(slugify("!!!")).toBe("unnamed");
  });
});

describe("writeStagedFiles", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "strike-staging-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("writes sql and report files with numbered prefix", async () => {
    const result = await writeStagedFiles({
      stagingDir: tmpDir,
      workspaceSlug: "alpha",
      orderIndex: 1,
      entity: "workspaces",
      sql: "BEGIN;\nCOMMIT;\n",
      report: "# report\n",
    });

    expect(existsSync(result.sqlPath)).toBe(true);
    expect(existsSync(result.reportPath)).toBe(true);
    expect(result.sqlPath).toMatch(/01_workspaces\.sql$/);
    expect(result.reportPath).toMatch(/01_workspaces\.report\.md$/);
    expect(result.sqlPath).toContain("/alpha/");
  });

  it("creates nested directories as needed", async () => {
    const nested = join(tmpDir, "deeply", "nested");
    const result = await writeStagedFiles({
      stagingDir: nested,
      workspaceSlug: "beta",
      orderIndex: 5,
      entity: "shifts",
      sql: "BEGIN;\nCOMMIT;\n",
      report: "# report\n",
    });
    expect(existsSync(result.sqlPath)).toBe(true);
  });

  it("zero-pads order index to 2 digits", async () => {
    const r = await writeStagedFiles({
      stagingDir: tmpDir,
      workspaceSlug: "x",
      orderIndex: 3,
      entity: "users",
      sql: "",
      report: "",
    });
    expect(r.sqlPath).toMatch(/03_users\.sql$/);
  });

  it("contains the SQL content as written", async () => {
    const r = await writeStagedFiles({
      stagingDir: tmpDir,
      workspaceSlug: "x",
      orderIndex: 1,
      entity: "workspaces",
      sql: "BEGIN;\nINSERT INTO workspaces (id) VALUES ('a');\nCOMMIT;\n",
      report: "",
    });
    const content = readFileSync(r.sqlPath, "utf-8");
    expect(content).toContain("INSERT INTO workspaces");
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Expected: FAIL — module not found.

- [ ] **Step 4: Implement `src/migration/staging.ts`**

```ts
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export function slugify(input: string): string {
  // Drop diacritics, replace non-alphanumeric with dashes, collapse, trim
  const normalized = input.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  const dashed = normalized
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return dashed === "" ? "unnamed" : dashed;
}

export interface WriteStagedFilesOptions {
  stagingDir: string;       // base staging directory (e.g. supabase/migration-staging)
  workspaceSlug: string;    // subdirectory under stagingDir
  orderIndex: number;       // 1-99 — used as zero-padded prefix
  entity: string;           // e.g. "workspaces", "locations"
  sql: string;
  report: string;
}

export interface StagedFiles {
  sqlPath: string;
  reportPath: string;
  workspaceDir: string;
}

export async function writeStagedFiles(opts: WriteStagedFilesOptions): Promise<StagedFiles> {
  const workspaceDir = join(opts.stagingDir, opts.workspaceSlug);
  await mkdir(workspaceDir, { recursive: true });

  const prefix = String(opts.orderIndex).padStart(2, "0");
  const sqlPath = join(workspaceDir, `${prefix}_${opts.entity}.sql`);
  const reportPath = join(workspaceDir, `${prefix}_${opts.entity}.report.md`);

  await writeFile(sqlPath, opts.sql, "utf-8");
  await writeFile(reportPath, opts.report, "utf-8");

  return { sqlPath, reportPath, workspaceDir };
}
```

- [ ] **Step 5: Run tests and commit**

```bash
pnpm test && pnpm typecheck
git add -A
git commit -m "feat(migration): add staging file writer and slugify helper"
```

---

## Task 7: `migrate_workspace` tool

**Files:**
- Create: `src/tools/migrate_workspace.ts`
- Create: `tests/tools/migrate_workspace.test.ts`

**Tool contract:**
- Input: `{ workspaceId: string }`
- Output: `MigrationReport` (defined in types.ts)

**Behavior:**
1. Load `mappings/workspace.json`. Throw if missing or `target_table` is null or any field needs review.
2. Fetch the single workspace record by ID via `bubble.listType` with constraints, OR via `bubble.listAll` with workspace constraint, OR by listing all and filtering. (Bubble's `bubble_get` would be more direct but we don't have it implemented; use `listAll` with constraint and pick the matching `_id`.)
3. Slugify the workspace name to determine `workspaceSlug`.
4. Run `runEngine(mapping, [record], ctx)`.
5. Emit SQL via `emitSql`.
6. Build a markdown report.
7. Write both files to staging via `writeStagedFiles` with `orderIndex: 1` (workspace is always first).
8. Return `MigrationReport`.

**Tool context extension:** This tool needs `stagingDir` from config, in addition to `bubble`, `mappingsDir`, `vaultBubbleShapesDir`. Extend `ToolContext` accordingly.

- [ ] **Step 1: Extend `ToolContext` in `src/tools/list_workspaces.ts`**

```ts
export interface ToolContext {
  bubble: BubbleClient;
  mappingsDir: string;
  vaultBubbleShapesDir: string;
  stagingDir: string;        // NEW
  supabase: SupabaseReadClient | null; // NEW — null if not configured
}
```

Update existing test files (`list_workspaces.test.ts`, `inspect_workspace.test.ts`, `research_entity.test.ts`) to add `stagingDir: ""` and `supabase: null` to context literals.

Add `import { SupabaseReadClient } from "../supabase/client.js";` at the top.

- [ ] **Step 2: Write the failing test**

`tests/tools/migrate_workspace.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrateWorkspaceTool } from "../../src/tools/migrate_workspace.js";
import { BubbleClient } from "../../src/bubble/client.js";
import type { Mapping } from "../../src/research/mapping.js";

function makeReadyMapping(): Mapping {
  return {
    entity: "workspaces",
    bubble_type: "workspace",
    target_table: "workspaces",
    field_map: {
      _id: {
        target: "id",
        transform: "fk_uuid:workspaces",
        needs_review: false,
        source_value_types: ["string"],
        occurrence_count: 1,
        sample_values: [],
      },
      name_text: {
        target: "name",
        transform: "trim",
        needs_review: false,
        source_value_types: ["string"],
        occurrence_count: 1,
        sample_values: [],
      },
    },
    required_source_fields: ["_id", "name_text"],
    skip_if_missing: [],
    known_quirks: [],
    last_verified: "2026-04-07",
    sample_record_count: 1,
    total_record_count: 1,
  };
}

describe("migrate_workspace tool", () => {
  let mappingsDir: string;
  let stagingDir: string;
  let vaultDir: string;

  beforeEach(() => {
    mappingsDir = mkdtempSync(join(tmpdir(), "strike-m-mappings-"));
    stagingDir = mkdtempSync(join(tmpdir(), "strike-m-staging-"));
    vaultDir = mkdtempSync(join(tmpdir(), "strike-m-vault-"));
    // Write a ready mapping
    writeFileSync(
      join(mappingsDir, "workspaces.json"),
      JSON.stringify(makeReadyMapping(), null, 2),
    );
  });

  afterEach(() => {
    rmSync(mappingsDir, { recursive: true, force: true });
    rmSync(stagingDir, { recursive: true, force: true });
    rmSync(vaultDir, { recursive: true, force: true });
  });

  function makeClient(workspaceRecord: Record<string, unknown>): BubbleClient {
    const client = new BubbleClient(
      { bubbleAppUrl: "https://x", bubbleApiToken: "t" },
      vi.fn() as unknown as typeof fetch,
    );
    vi.spyOn(client, "listAll").mockResolvedValue([workspaceRecord] as never);
    return client;
  }

  it("emits SQL and report files for a known workspace", async () => {
    const client = makeClient({
      _id: "1612345678901x111111111111111111",
      name_text: "Strøm Mat & Bar",
    });

    const result = await migrateWorkspaceTool.execute(
      { workspaceId: "1612345678901x111111111111111111" },
      {
        bubble: client,
        mappingsDir,
        vaultBubbleShapesDir: vaultDir,
        stagingDir,
        supabase: null,
      },
    );

    expect(result.recordsProcessed).toBe(1);
    expect(result.recordsEmitted).toBe(1);
    expect(result.recordsSkipped).toBe(0);
    expect(existsSync(result.sqlFilePath)).toBe(true);
    expect(existsSync(result.reportFilePath)).toBe(true);
    expect(result.workspaceSlug).toBe("strom-mat-bar");
    expect(result.sqlFilePath).toContain("/strom-mat-bar/");
    expect(result.sqlFilePath).toMatch(/01_workspaces\.sql$/);

    const sql = readFileSync(result.sqlFilePath, "utf-8");
    expect(sql).toContain("BEGIN;");
    expect(sql).toContain("COMMIT;");
    expect(sql).toContain("INSERT INTO workspaces");
    expect(sql).toContain("'Strøm Mat & Bar'");
  });

  it("throws if mapping has any unreviewed fields", async () => {
    // Overwrite mapping with one that has needs_review: true
    const m = makeReadyMapping();
    m.field_map.name_text.needs_review = true;
    writeFileSync(join(mappingsDir, "workspaces.json"), JSON.stringify(m, null, 2));

    const client = makeClient({ _id: "x", name_text: "y" });
    await expect(
      migrateWorkspaceTool.execute(
        { workspaceId: "x" },
        { bubble: client, mappingsDir, vaultBubbleShapesDir: vaultDir, stagingDir, supabase: null },
      ),
    ).rejects.toThrow(/needs_review/i);
  });

  it("throws if mappings/workspaces.json does not exist", async () => {
    rmSync(join(mappingsDir, "workspaces.json"));
    const client = makeClient({ _id: "x", name_text: "y" });
    await expect(
      migrateWorkspaceTool.execute(
        { workspaceId: "x" },
        { bubble: client, mappingsDir, vaultBubbleShapesDir: vaultDir, stagingDir, supabase: null },
      ),
    ).rejects.toThrow(/mapping/i);
  });

  it("throws if no record matches the workspace ID", async () => {
    const client = makeClient({ _id: "different-id", name_text: "x" });
    await expect(
      migrateWorkspaceTool.execute(
        { workspaceId: "wanted-id" },
        { bubble: client, mappingsDir, vaultBubbleShapesDir: vaultDir, stagingDir, supabase: null },
      ),
    ).rejects.toThrow(/not found/i);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Expected: FAIL — module not found.

- [ ] **Step 4: Implement `src/tools/migrate_workspace.ts`**

```ts
import { z } from "zod";
import { loadMapping } from "../research/mapping.js";
import { runEngine } from "../migration/engine.js";
import { emitSql } from "../migration/sql_emitter.js";
import { writeStagedFiles, slugify } from "../migration/staging.js";
import type { ToolContext } from "./list_workspaces.js";
import type { MigrationReport } from "../migration/types.js";

const NAME_KEYS = ["name_text", "Name", "Titel", "title", "name"];

function pickName(record: Record<string, unknown>): string {
  for (const k of NAME_KEYS) {
    const v = record[k];
    if (typeof v === "string" && v.trim().length > 0) return v;
  }
  return "(unnamed)";
}

function buildReport(
  entity: string,
  workspaceId: string,
  workspaceSlug: string,
  result: { rows: unknown[]; skipped: { recordId: string; reason: string }[]; warnings: string[] },
  generatedAt: string,
): string {
  const lines = [
    `# Migration report — ${entity}`,
    "",
    `- **Workspace ID:** \`${workspaceId}\``,
    `- **Workspace slug:** \`${workspaceSlug}\``,
    `- **Generated:** ${generatedAt}`,
    `- **Rows emitted:** ${result.rows.length}`,
    `- **Records skipped:** ${result.skipped.length}`,
    "",
  ];
  if (result.skipped.length > 0) {
    lines.push("## Skipped records");
    lines.push("");
    for (const s of result.skipped) {
      lines.push(`- \`${s.recordId}\`: ${s.reason}`);
    }
    lines.push("");
  }
  if (result.warnings.length > 0) {
    lines.push("## Warnings");
    lines.push("");
    for (const w of result.warnings) lines.push(`- ${w}`);
    lines.push("");
  }
  return lines.join("\n");
}

export const migrateWorkspaceTool = {
  name: "migrate_workspace",
  description:
    "Migrate a single workspace record from Bubble to a staged Supabase migration file. Read-only — never writes to Supabase. Output goes to the staging directory for human review.",
  inputSchema: z.object({
    workspaceId: z.string().min(1),
  }),
  execute: async (
    input: { workspaceId: string },
    ctx: ToolContext,
  ): Promise<MigrationReport> => {
    const mapping = await loadMapping(ctx.mappingsDir, "workspaces");
    if (!mapping) {
      throw new Error(
        `mapping for "workspaces" not found at ${ctx.mappingsDir}/workspaces.json. Run research_entity first.`,
      );
    }

    // Fetch all workspaces and find the matching one
    const all = await ctx.bubble.listAll("workspace", {});
    const record = all.find((r) => r._id === input.workspaceId);
    if (!record) {
      throw new Error(`workspace not found: ${input.workspaceId}`);
    }

    const workspaceSlug = slugify(pickName(record));
    const generatedAt = new Date().toISOString();

    const result = runEngine(mapping, [record], {
      workspaceId: input.workspaceId,
      workspaceSlug,
      mapping,
    });

    const sql = emitSql(result.rows, {
      entity: "workspaces",
      workspaceId: input.workspaceId,
      workspaceSlug,
      generatedAt,
    });

    const report = buildReport("workspaces", input.workspaceId, workspaceSlug, result, generatedAt);

    const staged = await writeStagedFiles({
      stagingDir: ctx.stagingDir,
      workspaceSlug,
      orderIndex: 1,
      entity: "workspaces",
      sql,
      report,
    });

    return {
      entity: "workspaces",
      workspaceId: input.workspaceId,
      workspaceSlug,
      recordsProcessed: 1,
      recordsEmitted: result.rows.length,
      recordsSkipped: result.skipped.length,
      warnings: result.warnings,
      generatedAt,
      sqlFilePath: staged.sqlPath,
      reportFilePath: staged.reportPath,
    };
  },
};
```

- [ ] **Step 5: Run tests and commit**

```bash
pnpm test && pnpm typecheck
git add -A
git commit -m "feat(tools): add migrate_workspace tool"
```

---

## Task 8: `migrate_locations` tool

**Files:**
- Create: `src/tools/migrate_locations.ts`
- Create: `tests/tools/migrate_locations.test.ts`

**Difference from migrate_workspace:** locations is multi-record (one workspace can have many locations). Order index 2. Otherwise the structure is identical.

The mapping for locations is `mappings/locations.json` with `target_table: "locations"`. The Bubble type comes from `ENTITY_REGISTRY` lookup. The query uses the workspace constraint from the registry entry.

- [ ] **Step 1: Write the failing test**

`tests/tools/migrate_locations.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrateLocationsTool } from "../../src/tools/migrate_locations.js";
import { BubbleClient } from "../../src/bubble/client.js";
import type { Mapping } from "../../src/research/mapping.js";

function makeReadyMapping(): Mapping {
  return {
    entity: "locations",
    bubble_type: "location",
    target_table: "locations",
    field_map: {
      _id: {
        target: "id",
        transform: "fk_uuid:locations",
        needs_review: false,
        source_value_types: ["string"],
        occurrence_count: 5,
        sample_values: [],
      },
      workspace: {
        target: "workspace_id",
        transform: "fk_uuid:workspaces",
        needs_review: false,
        source_value_types: ["string"],
        occurrence_count: 5,
        sample_values: [],
      },
      name_text: {
        target: "name",
        transform: "trim",
        needs_review: false,
        source_value_types: ["string"],
        occurrence_count: 5,
        sample_values: [],
      },
    },
    required_source_fields: ["_id", "workspace", "name_text"],
    skip_if_missing: [],
    known_quirks: [],
    last_verified: "2026-04-07",
    sample_record_count: 5,
    total_record_count: 5,
  };
}

describe("migrate_locations tool", () => {
  let mappingsDir: string;
  let stagingDir: string;

  beforeEach(() => {
    mappingsDir = mkdtempSync(join(tmpdir(), "strike-l-mappings-"));
    stagingDir = mkdtempSync(join(tmpdir(), "strike-l-staging-"));
    writeFileSync(join(mappingsDir, "locations.json"), JSON.stringify(makeReadyMapping(), null, 2));
    // Also write a workspace mapping so the workspace name lookup works
    writeFileSync(
      join(mappingsDir, "workspaces.json"),
      JSON.stringify({ ...makeReadyMapping(), entity: "workspaces", bubble_type: "workspace", target_table: "workspaces" }, null, 2),
    );
  });

  afterEach(() => {
    rmSync(mappingsDir, { recursive: true, force: true });
    rmSync(stagingDir, { recursive: true, force: true });
  });

  function makeClient(
    workspaceRecord: Record<string, unknown>,
    locationRecords: Array<Record<string, unknown>>,
  ): BubbleClient {
    const client = new BubbleClient(
      { bubbleAppUrl: "https://x", bubbleApiToken: "t" },
      vi.fn() as unknown as typeof fetch,
    );
    vi.spyOn(client, "listAll").mockImplementation(async (type: string) => {
      if (type === "workspace") return [workspaceRecord] as never;
      if (type === "location") return locationRecords as never;
      return [] as never;
    });
    return client;
  }

  it("emits one row per location belonging to the workspace", async () => {
    const client = makeClient(
      { _id: "ws1", name_text: "Alpha Workspace" },
      [
        { _id: "loc1", workspace: "ws1", name_text: "Main Floor" },
        { _id: "loc2", workspace: "ws1", name_text: "Kitchen" },
        { _id: "loc3", workspace: "ws1", name_text: "Bar" },
      ],
    );

    const result = await migrateLocationsTool.execute(
      { workspaceId: "ws1" },
      {
        bubble: client,
        mappingsDir,
        vaultBubbleShapesDir: "",
        stagingDir,
        supabase: null,
      },
    );

    expect(result.recordsEmitted).toBe(3);
    expect(result.recordsSkipped).toBe(0);
    expect(result.sqlFilePath).toMatch(/02_locations\.sql$/);
    expect(result.workspaceSlug).toBe("alpha-workspace");

    const sql = readFileSync(result.sqlFilePath, "utf-8");
    expect((sql.match(/INSERT INTO locations/g) ?? []).length).toBe(3);
    expect(sql).toContain("'Main Floor'");
    expect(sql).toContain("'Kitchen'");
    expect(sql).toContain("'Bar'");
  });

  it("skips records belonging to other workspaces (defensive client-side filter)", async () => {
    const client = makeClient(
      { _id: "ws1", name_text: "Target" },
      [
        { _id: "loc1", workspace: "ws1", name_text: "Mine" },
        { _id: "loc2", workspace: "wsOther", name_text: "Not mine" },
      ],
    );

    const result = await migrateLocationsTool.execute(
      { workspaceId: "ws1" },
      {
        bubble: client,
        mappingsDir,
        vaultBubbleShapesDir: "",
        stagingDir,
        supabase: null,
      },
    );

    expect(result.recordsEmitted).toBe(1);
  });

  it("throws if locations mapping is unreviewed", async () => {
    const m = makeReadyMapping();
    m.field_map.name_text.needs_review = true;
    writeFileSync(join(mappingsDir, "locations.json"), JSON.stringify(m, null, 2));

    const client = makeClient({ _id: "ws1", name_text: "x" }, []);
    await expect(
      migrateLocationsTool.execute(
        { workspaceId: "ws1" },
        { bubble: client, mappingsDir, vaultBubbleShapesDir: "", stagingDir, supabase: null },
      ),
    ).rejects.toThrow(/needs_review/i);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/tools/migrate_locations.ts`**

```ts
import { z } from "zod";
import { loadMapping } from "../research/mapping.js";
import { runEngine } from "../migration/engine.js";
import { emitSql } from "../migration/sql_emitter.js";
import { writeStagedFiles, slugify } from "../migration/staging.js";
import { getEntityByName } from "../entities.js";
import type { ToolContext } from "./list_workspaces.js";
import type { MigrationReport } from "../migration/types.js";

const NAME_KEYS = ["name_text", "Name", "Titel", "title", "name"];

function pickName(record: Record<string, unknown>): string {
  for (const k of NAME_KEYS) {
    const v = record[k];
    if (typeof v === "string" && v.trim().length > 0) return v;
  }
  return "(unnamed)";
}

function buildReport(
  entity: string,
  workspaceId: string,
  workspaceSlug: string,
  result: { rows: unknown[]; skipped: { recordId: string; reason: string }[]; warnings: string[] },
  generatedAt: string,
): string {
  const lines = [
    `# Migration report — ${entity}`,
    "",
    `- **Workspace ID:** \`${workspaceId}\``,
    `- **Workspace slug:** \`${workspaceSlug}\``,
    `- **Generated:** ${generatedAt}`,
    `- **Rows emitted:** ${result.rows.length}`,
    `- **Records skipped:** ${result.skipped.length}`,
    "",
  ];
  if (result.skipped.length > 0) {
    lines.push("## Skipped records", "");
    for (const s of result.skipped) lines.push(`- \`${s.recordId}\`: ${s.reason}`);
    lines.push("");
  }
  return lines.join("\n");
}

export const migrateLocationsTool = {
  name: "migrate_locations",
  description:
    "Migrate all locations belonging to a workspace from Bubble to a staged Supabase migration file. Read-only — never writes to Supabase.",
  inputSchema: z.object({
    workspaceId: z.string().min(1),
  }),
  execute: async (
    input: { workspaceId: string },
    ctx: ToolContext,
  ): Promise<MigrationReport> => {
    const mapping = await loadMapping(ctx.mappingsDir, "locations");
    if (!mapping) {
      throw new Error(`mapping for "locations" not found. Run research_entity first.`);
    }

    const entry = getEntityByName("locations");
    if (!entry || !entry.workspaceFieldKey) {
      throw new Error(`locations entity not in registry or has no workspace key`);
    }

    // Resolve workspace name → slug (we need this even though we're not migrating the workspace itself)
    const workspaces = await ctx.bubble.listAll("workspace", {});
    const ws = workspaces.find((w) => w._id === input.workspaceId);
    if (!ws) throw new Error(`workspace not found: ${input.workspaceId}`);
    const workspaceSlug = slugify(pickName(ws));

    // Fetch all locations and filter client-side (defensive — server-side constraints unreliable)
    const all = await ctx.bubble.listAll(entry.bubbleType, {
      constraints: [
        { key: entry.workspaceFieldKey, constraint_type: "equals", value: input.workspaceId },
      ],
    });
    const filtered = all.filter((r) => r[entry.workspaceFieldKey!] === input.workspaceId);

    const generatedAt = new Date().toISOString();
    const result = runEngine(mapping, filtered, {
      workspaceId: input.workspaceId,
      workspaceSlug,
      mapping,
    });

    const sql = emitSql(result.rows, {
      entity: "locations",
      workspaceId: input.workspaceId,
      workspaceSlug,
      generatedAt,
    });
    const report = buildReport("locations", input.workspaceId, workspaceSlug, result, generatedAt);

    const staged = await writeStagedFiles({
      stagingDir: ctx.stagingDir,
      workspaceSlug,
      orderIndex: 2,
      entity: "locations",
      sql,
      report,
    });

    return {
      entity: "locations",
      workspaceId: input.workspaceId,
      workspaceSlug,
      recordsProcessed: filtered.length,
      recordsEmitted: result.rows.length,
      recordsSkipped: result.skipped.length,
      warnings: result.warnings,
      generatedAt,
      sqlFilePath: staged.sqlPath,
      reportFilePath: staged.reportPath,
    };
  },
};
```

- [ ] **Step 4: Run tests and commit**

```bash
pnpm test && pnpm typecheck
git add -A
git commit -m "feat(tools): add migrate_locations tool"
```

---

## Task 9: `verify_target_empty` tool

**Files:**
- Create: `src/tools/verify_target_empty.ts`
- Create: `tests/tools/verify_target_empty.test.ts`

**Tool contract:**
- Input: `{ workspaceSlug: string }`
- Output: `{ workspaceSlug, empty: boolean, counts: Record<string, number>, message: string }`

**Behavior:**
- Uses `ctx.supabase` (the read-only client). If null, throw with a clear message about needing SUPABASE_URL/SUPABASE_ANON_KEY in env.
- Calls `count("workspaces", { slug: workspaceSlug })`. If > 0, the target is not empty.
- Also counts `locations`, `users`, `shifts` filtered by `workspace_id = (any UUID derived from the slug)`. Since we don't yet know the workspace UUID at this point (no records exist in v3 — that's the assumption we're checking), we just check `slug`.
- Returns `empty: true` if no rows in `workspaces` match the slug; else `empty: false` with counts.

- [ ] **Step 1: Write the failing test**

`tests/tools/verify_target_empty.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { verifyTargetEmptyTool } from "../../src/tools/verify_target_empty.js";
import { SupabaseReadClient } from "../../src/supabase/client.js";
import { BubbleClient } from "../../src/bubble/client.js";

function makeCtx(supabase: SupabaseReadClient | null) {
  return {
    bubble: new BubbleClient(
      { bubbleAppUrl: "https://x", bubbleApiToken: "t" },
      vi.fn() as unknown as typeof fetch,
    ),
    mappingsDir: "",
    vaultBubbleShapesDir: "",
    stagingDir: "",
    supabase,
  };
}

describe("verify_target_empty tool", () => {
  it("returns empty: true when no workspace with the slug exists", async () => {
    const supabase = new SupabaseReadClient(
      { url: "https://x", anonKey: "k" },
      vi.fn() as unknown as typeof fetch,
    );
    vi.spyOn(supabase, "count").mockResolvedValue(0);

    const result = await verifyTargetEmptyTool.execute(
      { workspaceSlug: "alpha" },
      makeCtx(supabase),
    );

    expect(result.empty).toBe(true);
    expect(result.counts.workspaces).toBe(0);
  });

  it("returns empty: false when a workspace with the slug exists", async () => {
    const supabase = new SupabaseReadClient(
      { url: "https://x", anonKey: "k" },
      vi.fn() as unknown as typeof fetch,
    );
    vi.spyOn(supabase, "count").mockResolvedValue(1);

    const result = await verifyTargetEmptyTool.execute(
      { workspaceSlug: "alpha" },
      makeCtx(supabase),
    );

    expect(result.empty).toBe(false);
    expect(result.counts.workspaces).toBe(1);
    expect(result.message).toMatch(/already exists/i);
  });

  it("throws with helpful message when supabase is not configured", async () => {
    await expect(
      verifyTargetEmptyTool.execute({ workspaceSlug: "alpha" }, makeCtx(null)),
    ).rejects.toThrow(/SUPABASE_URL/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/tools/verify_target_empty.ts`**

```ts
import { z } from "zod";
import type { ToolContext } from "./list_workspaces.js";

export interface VerifyTargetEmptyResult {
  workspaceSlug: string;
  empty: boolean;
  counts: Record<string, number>;
  message: string;
}

export const verifyTargetEmptyTool = {
  name: "verify_target_empty",
  description:
    "Read-only Supabase check: confirms the target workspace slug has no existing data. The only tool that talks to Supabase, and only for SELECT.",
  inputSchema: z.object({
    workspaceSlug: z.string().min(1),
  }),
  execute: async (
    input: { workspaceSlug: string },
    ctx: ToolContext,
  ): Promise<VerifyTargetEmptyResult> => {
    if (ctx.supabase === null) {
      throw new Error(
        "Supabase read client not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY environment variables.",
      );
    }

    const wsCount = await ctx.supabase.count("workspaces", { slug: input.workspaceSlug });
    const counts = { workspaces: wsCount };
    const empty = wsCount === 0;
    const message = empty
      ? `Target workspace "${input.workspaceSlug}" is empty. Safe to proceed with bundle_migration.`
      : `Target workspace "${input.workspaceSlug}" already exists in v3 (${wsCount} row(s) in workspaces). bundle_migration will refuse without --acknowledge-target-has-data.`;

    return { workspaceSlug: input.workspaceSlug, empty, counts, message };
  },
};
```

- [ ] **Step 4: Run tests and commit**

```bash
pnpm test && pnpm typecheck
git add -A
git commit -m "feat(tools): add verify_target_empty (read-only Supabase check)"
```

---

## Task 10: `plan_migration` and `preview_sql` tools

**Files:**
- Create: `src/tools/plan_migration.ts`
- Create: `src/tools/preview_sql.ts`
- Create: `tests/tools/plan_migration.test.ts`
- Create: `tests/tools/preview_sql.test.ts`

**plan_migration:** Read-only. Given a workspace ID, returns a recommended migration order based on entity registry dependencies and which entities actually have records in the workspace.

For Phase 3 we only have `migrate_workspace` and `migrate_locations` implemented, so the planner just returns those two when applicable. Future phases extend the order.

**preview_sql:** Given a path to a generated `.sql` file, parse it (or just count INSERTs per table via regex) and return a summary.

- [ ] **Step 1: Write tests**

`tests/tools/plan_migration.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { planMigrationTool } from "../../src/tools/plan_migration.js";
import { BubbleClient } from "../../src/bubble/client.js";

function makeClient(workspaceId: string, locationCount: number): BubbleClient {
  const client = new BubbleClient(
    { bubbleAppUrl: "https://x", bubbleApiToken: "t" },
    vi.fn() as unknown as typeof fetch,
  );
  vi.spyOn(client, "listAll").mockImplementation(async (type: string) => {
    if (type === "workspace") return [{ _id: workspaceId }] as never;
    if (type === "location")
      return Array.from({ length: locationCount }, (_, i) => ({
        _id: `loc${i}`,
        workspace: workspaceId,
      })) as never;
    return [] as never;
  });
  return client;
}

describe("plan_migration tool", () => {
  it("returns migrate_workspace and migrate_locations in order", async () => {
    const client = makeClient("ws1", 3);
    const result = await planMigrationTool.execute(
      { workspaceId: "ws1" },
      {
        bubble: client,
        mappingsDir: "",
        vaultBubbleShapesDir: "",
        stagingDir: "",
        supabase: null,
      },
    );

    expect(result.steps).toHaveLength(2);
    expect(result.steps[0].tool).toBe("migrate_workspace");
    expect(result.steps[0].recordCount).toBe(1);
    expect(result.steps[1].tool).toBe("migrate_locations");
    expect(result.steps[1].recordCount).toBe(3);
  });

  it("omits migrate_locations when there are no locations", async () => {
    const client = makeClient("ws1", 0);
    const result = await planMigrationTool.execute(
      { workspaceId: "ws1" },
      {
        bubble: client,
        mappingsDir: "",
        vaultBubbleShapesDir: "",
        stagingDir: "",
        supabase: null,
      },
    );
    const tools = result.steps.map((s) => s.tool);
    expect(tools).not.toContain("migrate_locations");
  });
});
```

`tests/tools/preview_sql.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { previewSqlTool } from "../../src/tools/preview_sql.js";

describe("preview_sql tool", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "strike-preview-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("counts INSERTs per table", async () => {
    const sqlPath = join(tmpDir, "migration.sql");
    writeFileSync(
      sqlPath,
      [
        "BEGIN;",
        "INSERT INTO workspaces (id, name) VALUES ('a', 'b');",
        "INSERT INTO locations (id, name) VALUES ('c', 'd');",
        "INSERT INTO locations (id, name) VALUES ('e', 'f');",
        "COMMIT;",
      ].join("\n"),
    );

    const result = await previewSqlTool.execute(
      { filePath: sqlPath },
      {
        bubble: null as never,
        mappingsDir: "",
        vaultBubbleShapesDir: "",
        stagingDir: "",
        supabase: null,
      },
    );

    expect(result.totalInserts).toBe(3);
    expect(result.insertsByTable).toEqual({ workspaces: 1, locations: 2 });
    expect(result.hasBegin).toBe(true);
    expect(result.hasCommit).toBe(true);
  });

  it("warns if BEGIN or COMMIT is missing", async () => {
    const sqlPath = join(tmpDir, "bad.sql");
    writeFileSync(sqlPath, "INSERT INTO x (a) VALUES (1);");
    const result = await previewSqlTool.execute(
      { filePath: sqlPath },
      {
        bubble: null as never,
        mappingsDir: "",
        vaultBubbleShapesDir: "",
        stagingDir: "",
        supabase: null,
      },
    );
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("flags presence of forbidden DELETE/UPDATE statements", async () => {
    const sqlPath = join(tmpDir, "bad.sql");
    writeFileSync(sqlPath, "BEGIN;\nDELETE FROM users;\nCOMMIT;");
    const result = await previewSqlTool.execute(
      { filePath: sqlPath },
      {
        bubble: null as never,
        mappingsDir: "",
        vaultBubbleShapesDir: "",
        stagingDir: "",
        supabase: null,
      },
    );
    expect(result.warnings.some((w) => w.toLowerCase().includes("delete"))).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Expected: both fail — modules not found.

- [ ] **Step 3: Implement `src/tools/plan_migration.ts`**

```ts
import { z } from "zod";
import { getEntityByName } from "../entities.js";
import type { ToolContext } from "./list_workspaces.js";

export interface MigrationStep {
  tool: string;
  entity: string;
  recordCount: number;
}

export interface PlanMigrationResult {
  workspaceId: string;
  steps: MigrationStep[];
}

const PHASE_3_ORDER: Array<{ entity: string; tool: string }> = [
  { entity: "workspace", tool: "migrate_workspace" },
  { entity: "locations", tool: "migrate_locations" },
];

export const planMigrationTool = {
  name: "plan_migration",
  description:
    "Read-only. Returns the recommended migration order for a workspace based on dependencies and which entities actually have records.",
  inputSchema: z.object({
    workspaceId: z.string().min(1),
  }),
  execute: async (
    input: { workspaceId: string },
    ctx: ToolContext,
  ): Promise<PlanMigrationResult> => {
    const steps: MigrationStep[] = [];

    for (const { entity, tool } of PHASE_3_ORDER) {
      const entry = getEntityByName(entity);
      if (!entry) continue;

      let count: number;
      if (entity === "workspace") {
        const all = await ctx.bubble.listAll("workspace", {});
        count = all.filter((r) => r._id === input.workspaceId).length;
      } else if (entry.workspaceFieldKey) {
        const all = await ctx.bubble.listAll(entry.bubbleType, {
          constraints: [
            { key: entry.workspaceFieldKey, constraint_type: "equals", value: input.workspaceId },
          ],
        });
        count = all.filter((r) => r[entry.workspaceFieldKey!] === input.workspaceId).length;
      } else {
        count = 0;
      }

      if (count > 0) {
        steps.push({ tool, entity, recordCount: count });
      }
    }

    return { workspaceId: input.workspaceId, steps };
  },
};
```

- [ ] **Step 4: Implement `src/tools/preview_sql.ts`**

```ts
import { z } from "zod";
import { readFile } from "node:fs/promises";
import type { ToolContext } from "./list_workspaces.js";

export interface PreviewSqlResult {
  filePath: string;
  totalInserts: number;
  insertsByTable: Record<string, number>;
  hasBegin: boolean;
  hasCommit: boolean;
  warnings: string[];
}

export const previewSqlTool = {
  name: "preview_sql",
  description:
    "Parse a generated SQL file and return a summary of its INSERTs and any safety warnings. Does not execute SQL.",
  inputSchema: z.object({
    filePath: z.string().min(1),
  }),
  execute: async (
    input: { filePath: string },
    _ctx: ToolContext,
  ): Promise<PreviewSqlResult> => {
    const content = await readFile(input.filePath, "utf-8");
    const insertsByTable: Record<string, number> = {};
    const insertRegex = /INSERT\s+INTO\s+(\w+)/gi;
    let match;
    while ((match = insertRegex.exec(content)) !== null) {
      const table = match[1];
      insertsByTable[table] = (insertsByTable[table] ?? 0) + 1;
    }
    const totalInserts = Object.values(insertsByTable).reduce((a, b) => a + b, 0);

    const hasBegin = /^\s*BEGIN\s*;/m.test(content);
    const hasCommit = /COMMIT\s*;/.test(content);

    const warnings: string[] = [];
    if (!hasBegin) warnings.push("missing BEGIN — migration is not transactional");
    if (!hasCommit) warnings.push("missing COMMIT — migration is incomplete");
    if (/\bDELETE\b/i.test(content)) warnings.push("contains DELETE statements — strike-mcp should never emit DELETE");
    if (/\bUPDATE\b/i.test(content)) warnings.push("contains UPDATE statements — strike-mcp should never emit UPDATE");

    return {
      filePath: input.filePath,
      totalInserts,
      insertsByTable,
      hasBegin,
      hasCommit,
      warnings,
    };
  },
};
```

- [ ] **Step 5: Run tests and commit**

```bash
pnpm test && pnpm typecheck
git add -A
git commit -m "feat(tools): add plan_migration and preview_sql tools"
```

---

## Task 11: `bundle_migration` tool

**Files:**
- Create: `src/tools/bundle_migration.ts`
- Create: `tests/tools/bundle_migration.test.ts`

**Tool contract:**
- Input: `{ workspaceSlug: string, acknowledgeTargetHasData?: boolean }`
- Output: `{ bundlePath, totalInserts, insertsByTable, warnings }`

**Behavior:**
1. Read all `*.sql` files in `<stagingDir>/<workspaceSlug>/`, sorted by filename (so `01_*` comes before `02_*`).
2. If `ctx.supabase` is set, call `verify_target_empty` first. If not empty AND `acknowledgeTargetHasData` is false, throw.
3. Concatenate all SQL files into one bundled file with a single outer `BEGIN;` ... `COMMIT;`.
4. Strip individual `BEGIN;` and `COMMIT;` lines from each file's body during concatenation.
5. Write to `<stagingDir>/<workspaceSlug>/bundled.sql`.
6. Return the result.

- [ ] **Step 1: Write the failing test**

`tests/tools/bundle_migration.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bundleMigrationTool } from "../../src/tools/bundle_migration.js";
import { SupabaseReadClient } from "../../src/supabase/client.js";
import { BubbleClient } from "../../src/bubble/client.js";

function makeBubble(): BubbleClient {
  return new BubbleClient(
    { bubbleAppUrl: "https://x", bubbleApiToken: "t" },
    vi.fn() as unknown as typeof fetch,
  );
}

describe("bundle_migration tool", () => {
  let stagingDir: string;
  let workspaceDir: string;

  beforeEach(() => {
    stagingDir = mkdtempSync(join(tmpdir(), "strike-bundle-"));
    workspaceDir = join(stagingDir, "alpha");
    mkdirSync(workspaceDir, { recursive: true });
    writeFileSync(
      join(workspaceDir, "01_workspaces.sql"),
      "BEGIN;\nINSERT INTO workspaces (id) VALUES ('a');\nCOMMIT;\n",
    );
    writeFileSync(
      join(workspaceDir, "02_locations.sql"),
      "BEGIN;\nINSERT INTO locations (id) VALUES ('b');\nINSERT INTO locations (id) VALUES ('c');\nCOMMIT;\n",
    );
  });

  afterEach(() => {
    rmSync(stagingDir, { recursive: true, force: true });
  });

  function makeCtx(supabase: SupabaseReadClient | null) {
    return {
      bubble: makeBubble(),
      mappingsDir: "",
      vaultBubbleShapesDir: "",
      stagingDir,
      supabase,
    };
  }

  it("concatenates SQL files in order, with single outer BEGIN/COMMIT", async () => {
    const result = await bundleMigrationTool.execute(
      { workspaceSlug: "alpha" },
      makeCtx(null),
    );

    expect(existsSync(result.bundlePath)).toBe(true);
    const sql = readFileSync(result.bundlePath, "utf-8");
    expect(sql.match(/^BEGIN;/m)).toBeTruthy();
    expect(sql.trimEnd()).toMatch(/COMMIT;$/);
    // Internal BEGIN/COMMIT should be stripped — only one of each
    expect((sql.match(/BEGIN;/g) ?? []).length).toBe(1);
    expect((sql.match(/COMMIT;/g) ?? []).length).toBe(1);
    // Both inserts must be present, in order
    const wsIdx = sql.indexOf("INSERT INTO workspaces");
    const locIdx = sql.indexOf("INSERT INTO locations");
    expect(wsIdx).toBeGreaterThan(-1);
    expect(locIdx).toBeGreaterThan(wsIdx);
  });

  it("returns total insert count and per-table breakdown", async () => {
    const result = await bundleMigrationTool.execute(
      { workspaceSlug: "alpha" },
      makeCtx(null),
    );
    expect(result.totalInserts).toBe(3);
    expect(result.insertsByTable.workspaces).toBe(1);
    expect(result.insertsByTable.locations).toBe(2);
  });

  it("calls verify_target_empty when supabase is configured and refuses on non-empty without ack", async () => {
    const supabase = new SupabaseReadClient(
      { url: "https://x", anonKey: "k" },
      vi.fn() as unknown as typeof fetch,
    );
    vi.spyOn(supabase, "count").mockResolvedValue(1);

    await expect(
      bundleMigrationTool.execute({ workspaceSlug: "alpha" }, makeCtx(supabase)),
    ).rejects.toThrow(/already exists/i);
  });

  it("proceeds when target is non-empty but acknowledgeTargetHasData is true", async () => {
    const supabase = new SupabaseReadClient(
      { url: "https://x", anonKey: "k" },
      vi.fn() as unknown as typeof fetch,
    );
    vi.spyOn(supabase, "count").mockResolvedValue(1);

    const result = await bundleMigrationTool.execute(
      { workspaceSlug: "alpha", acknowledgeTargetHasData: true },
      makeCtx(supabase),
    );
    expect(existsSync(result.bundlePath)).toBe(true);
  });

  it("throws when no .sql files exist in the workspace directory", async () => {
    rmSync(workspaceDir, { recursive: true });
    mkdirSync(workspaceDir);
    await expect(
      bundleMigrationTool.execute({ workspaceSlug: "alpha" }, makeCtx(null)),
    ).rejects.toThrow(/no.*sql/i);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/tools/bundle_migration.ts`**

```ts
import { z } from "zod";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ToolContext } from "./list_workspaces.js";

export interface BundleMigrationResult {
  bundlePath: string;
  workspaceSlug: string;
  totalInserts: number;
  insertsByTable: Record<string, number>;
  warnings: string[];
}

export const bundleMigrationTool = {
  name: "bundle_migration",
  description:
    "Concatenate all staged SQL files for a workspace into one transactional migration. Calls verify_target_empty first if Supabase is configured. Refuses if target is non-empty without explicit acknowledgement.",
  inputSchema: z.object({
    workspaceSlug: z.string().min(1),
    acknowledgeTargetHasData: z.boolean().optional(),
  }),
  execute: async (
    input: { workspaceSlug: string; acknowledgeTargetHasData?: boolean },
    ctx: ToolContext,
  ): Promise<BundleMigrationResult> => {
    const workspaceDir = join(ctx.stagingDir, input.workspaceSlug);

    // Verify target empty (if Supabase configured)
    if (ctx.supabase !== null) {
      const wsCount = await ctx.supabase.count("workspaces", { slug: input.workspaceSlug });
      if (wsCount > 0 && !input.acknowledgeTargetHasData) {
        throw new Error(
          `Target workspace "${input.workspaceSlug}" already exists in v3 (${wsCount} row(s)). Pass acknowledgeTargetHasData: true to override.`,
        );
      }
    }

    // Collect SQL files in deterministic order
    const entries = await readdir(workspaceDir);
    const sqlFiles = entries.filter((f) => f.endsWith(".sql") && f !== "bundled.sql").sort();
    if (sqlFiles.length === 0) {
      throw new Error(`no .sql files found in ${workspaceDir}`);
    }

    const bodies: string[] = [];
    const insertsByTable: Record<string, number> = {};

    for (const file of sqlFiles) {
      const content = await readFile(join(workspaceDir, file), "utf-8");
      // Strip individual BEGIN; and COMMIT; lines
      const stripped = content
        .replace(/^\s*BEGIN\s*;\s*$/gm, "")
        .replace(/^\s*COMMIT\s*;\s*$/gm, "");
      bodies.push(`-- from ${file}\n${stripped.trim()}\n`);

      // Count inserts
      const re = /INSERT\s+INTO\s+(\w+)/gi;
      let m;
      while ((m = re.exec(content)) !== null) {
        insertsByTable[m[1]] = (insertsByTable[m[1]] ?? 0) + 1;
      }
    }

    const totalInserts = Object.values(insertsByTable).reduce((a, b) => a + b, 0);

    const bundled = [
      "BEGIN;",
      "",
      `-- strike-mcp bundled migration for workspace: ${input.workspaceSlug}`,
      `-- generated: ${new Date().toISOString()}`,
      `-- total INSERTs: ${totalInserts}`,
      `-- REVIEW BEFORE APPLYING TO PRODUCTION`,
      "",
      ...bodies,
      "COMMIT;",
      "",
    ].join("\n");

    const bundlePath = join(workspaceDir, "bundled.sql");
    await writeFile(bundlePath, bundled, "utf-8");

    return {
      bundlePath,
      workspaceSlug: input.workspaceSlug,
      totalInserts,
      insertsByTable,
      warnings: [],
    };
  },
};
```

- [ ] **Step 4: Run tests and commit**

```bash
pnpm test && pnpm typecheck
git add -A
git commit -m "feat(tools): add bundle_migration with verify_target_empty gate"
```

---

## Task 12: Extend config + register tools in MCP server

**Files:**
- Modify: `src/config.ts`
- Modify: `tests/config.test.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Extend Config interface and loader**

```ts
// src/config.ts — additions to Config interface
export interface Config {
  bubbleAppUrl: string;
  bubbleApiToken: string;
  mappingsDir: string;
  vaultBubbleShapesDir: string;
  stagingDir: string;              // NEW
  supabaseUrl: string | null;      // NEW — null if not configured
  supabaseAnonKey: string | null;  // NEW
}

// in loadConfig — add at end:
const stagingDir = env.STRIKE_STAGING_DIR ?? "/home/sxtnl/dev/strike-mcp/supabase/migration-staging";
const supabaseUrl = env.SUPABASE_URL ?? null;
const supabaseAnonKey = env.SUPABASE_ANON_KEY ?? null;

return { ..., stagingDir, supabaseUrl, supabaseAnonKey };
```

- [ ] **Step 2: Add config tests**

Append to `tests/config.test.ts`:

```ts
describe("loadConfig migration fields", () => {
  const baseEnv = {
    BUBBLE_APP_URL: "https://x.bubbleapps.io",
    BUBBLE_API_TOKEN: "t",
  };

  it("defaults stagingDir to repo staging path", () => {
    const config = loadConfig(baseEnv);
    expect(config.stagingDir).toMatch(/migration-staging$/);
  });

  it("respects STRIKE_STAGING_DIR override", () => {
    const config = loadConfig({ ...baseEnv, STRIKE_STAGING_DIR: "/tmp/x" });
    expect(config.stagingDir).toBe("/tmp/x");
  });

  it("supabase fields are null when env vars are missing", () => {
    const config = loadConfig(baseEnv);
    expect(config.supabaseUrl).toBeNull();
    expect(config.supabaseAnonKey).toBeNull();
  });

  it("supabase fields populate from SUPABASE_URL and SUPABASE_ANON_KEY", () => {
    const config = loadConfig({
      ...baseEnv,
      SUPABASE_URL: "https://abc.supabase.co",
      SUPABASE_ANON_KEY: "key",
    });
    expect(config.supabaseUrl).toBe("https://abc.supabase.co");
    expect(config.supabaseAnonKey).toBe("key");
  });
});
```

- [ ] **Step 3: Update `src/index.ts`**

Import all new tools and the SupabaseReadClient. Build the supabase client only if both env vars are present. Pass it (or null) into the context. Add all 6 new tools to the tools array.

```ts
// new imports
import { migrateWorkspaceTool } from "./tools/migrate_workspace.js";
import { migrateLocationsTool } from "./tools/migrate_locations.js";
import { planMigrationTool } from "./tools/plan_migration.js";
import { previewSqlTool } from "./tools/preview_sql.js";
import { verifyTargetEmptyTool } from "./tools/verify_target_empty.js";
import { bundleMigrationTool } from "./tools/bundle_migration.js";
import { SupabaseReadClient } from "./supabase/client.js";

// in main():
const supabase =
  config.supabaseUrl && config.supabaseAnonKey
    ? new SupabaseReadClient({ url: config.supabaseUrl, anonKey: config.supabaseAnonKey })
    : null;

const ctx = {
  bubble,
  mappingsDir: config.mappingsDir,
  vaultBubbleShapesDir: config.vaultBubbleShapesDir,
  stagingDir: config.stagingDir,
  supabase,
};

const tools = [
  listWorkspacesTool,
  inspectWorkspaceTool,
  researchEntityTool,
  migrateWorkspaceTool,
  migrateLocationsTool,
  planMigrationTool,
  previewSqlTool,
  verifyTargetEmptyTool,
  bundleMigrationTool,
];
```

- [ ] **Step 4: Build and probe**

```bash
pnpm test && pnpm typecheck && pnpm build
BUBBLE_APP_URL=https://fake BUBBLE_API_TOKEN=fake node dist/index.js <<'EOF'
{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}
EOF
```

Expected response includes all 9 tools.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(server): register Phase 3 migration tools and extend config"
```

---

## Task 13: End-to-end smoke test against local Supabase

**Files:**
- Modify: `README.md` (append Phase 3 smoke test procedure)

This task is a manual verification by Pontus. It requires:
- A running local Supabase (or a test Supabase project)
- The v3 schema applied to it
- A test workspace in Bubble with at least one location
- A `mappings/workspaces.json` and `mappings/locations.json` with all fields reviewed and `target_table` set

- [ ] **Step 1: Append the procedure to `README.md`**

```markdown

## Phase 3 smoke test — first migration

Prerequisites:
- A local Supabase instance with the v3 schema applied (from `smartout.ai/supabase/migrations`)
- `SUPABASE_URL` and `SUPABASE_ANON_KEY` set in your environment
- Reviewed `mappings/workspaces.json` and `mappings/locations.json` (no `needs_review: true` fields, both have `target_table` set)
- A test workspace in Bubble that has not been migrated yet

Procedure:
1. In Claude Code, ask: "Use strike-mcp to plan migration for workspace <id>"
2. Expected: a list of steps including migrate_workspace and migrate_locations with record counts
3. Ask: "Migrate workspace <id>"
4. Expected: a `MigrationReport` with the path to a generated `.sql` file in `supabase/migration-staging/<slug>/01_workspaces.sql`
5. Open the generated file. Verify it begins with BEGIN; ends with COMMIT; contains exactly one INSERT INTO workspaces.
6. Ask: "Migrate locations for workspace <id>"
7. Expected: another file at `02_locations.sql` with one INSERT per location
8. Ask: "Bundle migration for workspace <slug>"
9. Expected: `bundled.sql` containing both files merged with one outer transaction
10. Ask: "Preview the bundled SQL"
11. Expected: a summary with insert counts per table and no warnings
12. Manually apply the bundled SQL to the local Supabase: `psql $LOCAL_SUPABASE_URL -f supabase/migration-staging/<slug>/bundled.sql`
13. Verify in Supabase: SELECT * FROM workspaces WHERE slug = '<slug>' returns one row, SELECT count(*) FROM locations WHERE workspace_id = '<uuid>' returns the expected count
14. Re-run step 8 (bundle_migration). Expected: it refuses with "Target workspace already exists" because `verify_target_empty` now sees the data we just inserted
15. Capture all results in `docs/superpowers/notes/phase-3-smoke-test.md`
```

- [ ] **Step 2: Final verification + commit**

```bash
pnpm typecheck && pnpm test && pnpm build
git add README.md
git commit -m "docs: add Phase 3 smoke test procedure"
```

---

## Phase 3 Exit Criteria

- [x] Deterministic UUID helper with locked namespace constant
- [x] Built-in transforms registry (trim, fk_uuid, bubble_date_to_tstz, etc.)
- [x] Read-only Supabase client with no write capability
- [x] Migration engine produces EmittedRows from Mapping × Records
- [x] SQL emitter produces transactional, escaped, INSERT-only SQL
- [x] Staging file writer outputs to ignored directory with numbered prefixes
- [x] migrate_workspace and migrate_locations tools work end-to-end
- [x] verify_target_empty, plan_migration, preview_sql, bundle_migration tools implemented
- [x] All 9 tools registered in MCP server
- [x] Full test suite passes, typecheck clean, build succeeds
- [x] Smoke test executed successfully against a local Supabase with the v3 schema

After Phase 3 the migration architecture is proven for two entities. Phases 4 (identity entities) and 5 (operational entities) are purely additive — each new migrate_<entity> tool follows the same pattern.

If the smoke test reveals issues with the engine or safety chain, fix them in Phase 3 before proceeding. The architectural risk lives entirely in this phase.
