# strike-mcp Phase 4 Implementation Plan — Identity Entities

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add migration tools for the remaining identity & structure entities: departments, teams, users (with profiles + memberships), and roles/rules. After this phase, strike-mcp can migrate the full "skeleton" of a workspace — every structural record except shifts and operational data.

**Architecture:** Most tasks are purely additive, following the `migrate_locations` pattern from Phase 3. Only `migrate_users` introduces a new pattern — **multi-mapping emission**, where a single tool runs the engine multiple times with different mappings to emit rows into multiple v3 tables from the same Bubble source records.

**Prerequisites:** Phase 3 merged on `main`. The migration engine, SQL emitter, staging writer, safety chain, and the `migrate_workspace` + `migrate_locations` tools all exist. Smoke test for Phase 3 has been executed successfully against a local Supabase.

---

## The multi-mapping pattern (new in Phase 4)

A single Bubble entity type can map to **multiple** v3 tables. Bubble users, for example, are a single `User` type, but in v3 they become rows in `auth.users` + `profiles` + `memberships` (the workspace link).

The existing Phase 3 `Mapping` type has a single `target_table` — so we cannot express "one source → three targets" in one file. Instead, we use **three separate mapping files** that all share the same `bubble_type`:

```
mappings/
  users.json          # bubble_type: "User", target_table: "auth.users"
  profiles.json       # bubble_type: "User", target_table: "profiles"
  memberships.json    # bubble_type: "User", target_table: "memberships"
```

The `migrate_users` tool fetches the Bubble user records **once**, then runs `runEngine` **three times** — one per mapping — and concatenates the emitted rows with a **table priority order** so that parent rows come before child rows:

```
auth.users → profiles → memberships
```

FK resolution works automatically via `fk_uuid:users` on the `user_id` column in `profiles` and `memberships` — the same Bubble ID produces the same v3 UUID in all three tables.

This pattern generalizes: any Phase 4+ entity that needs multi-table emission uses the same trio (or quartet) of mapping files with a shared `bubble_type`.

---

## File Structure

```
strike-mcp/
├── src/
│   ├── migration/
│   │   └── multi_mapping.ts                    # NEW — runs engine over multiple mappings, orders by table priority
│   └── tools/
│       ├── migrate_departments.ts              # NEW
│       ├── migrate_teams.ts                    # NEW
│       ├── migrate_users.ts                    # NEW — uses multi_mapping
│       ├── migrate_roles_and_rules.ts          # NEW
│       └── plan_migration.ts                   # MODIFY — add Phase 4 entities to order
└── tests/
    ├── migration/
    │   └── multi_mapping.test.ts
    └── tools/
        ├── migrate_departments.test.ts
        ├── migrate_teams.test.ts
        ├── migrate_users.test.ts
        └── migrate_roles_and_rules.test.ts
```

**Decomposition rationale:**

- `multi_mapping.ts` captures the new pattern once, as a pure helper. Every Phase 4+ tool that emits to multiple tables uses it, so the logic lives in one place.
- Each new `migrate_*` tool is a thin shell around either the existing Phase 3 `runEngine`+`emitSql`+`writeStagedFiles` pipeline (for simple entities) or the new `multi_mapping` helper (for users).
- `plan_migration.ts` is modified in one place to pick up the new tools in their proper dependency order.

---

## Task 1: Multi-mapping helper

**Files:**
- Create: `src/migration/multi_mapping.ts`
- Create: `tests/migration/multi_mapping.test.ts`

**Purpose:** Take an ordered list of `Mapping`s (all sharing the same `bubble_type`), apply each via `runEngine` against the same records, and return a unified `MigrationResult` where rows are ordered by the mapping index (first mapping's rows first, then second, etc.). Combines skipped records and warnings across all mappings.

- [ ] **Step 1: Write the failing test**

`tests/migration/multi_mapping.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { runMultiMappingEngine } from "../../src/migration/multi_mapping.js";
import { strikeUuid } from "../../src/migration/uuid.js";
import type { Mapping } from "../../src/research/mapping.js";
import type { BubbleRecord } from "../../src/bubble/types.js";

function mkMapping(entity: string, targetTable: string, fields: Record<string, string>): Mapping {
  const field_map: Mapping["field_map"] = {};
  const required: string[] = [];
  for (const [source, target] of Object.entries(fields)) {
    field_map[source] = {
      target,
      transform: source === "_id" || source === "workspace" ? `fk_uuid:${source === "_id" ? entity : "workspaces"}` : "trim",
      needs_review: false,
      source_value_types: ["string"],
      occurrence_count: 10,
      sample_values: [],
    };
    if (source === "_id") required.push(source);
  }
  return {
    entity,
    bubble_type: "User",
    target_table: targetTable,
    field_map,
    required_source_fields: required,
    skip_if_missing: [],
    known_quirks: [],
    last_verified: "2026-04-07",
    sample_record_count: 10,
    total_record_count: 10,
  };
}

describe("runMultiMappingEngine", () => {
  it("emits rows from multiple mappings against the same records", () => {
    const usersMapping = mkMapping("users", "auth.users", {
      _id: "id",
      email_text: "email",
    });
    const profilesMapping = mkMapping("users", "profiles", {
      _id: "user_id",
      name_text: "full_name",
    });
    const membershipsMapping = mkMapping("users", "memberships", {
      _id: "user_id",
      workspace: "workspace_id",
    });

    const records: BubbleRecord[] = [
      {
        _id: "user1",
        email_text: "alpha@example.com",
        name_text: "Alpha User",
        workspace: "ws1",
      },
      {
        _id: "user2",
        email_text: "beta@example.com",
        name_text: "Beta User",
        workspace: "ws1",
      },
    ];

    const result = runMultiMappingEngine(
      [usersMapping, profilesMapping, membershipsMapping],
      records,
      { workspaceId: "ws1", workspaceSlug: "alpha", mapping: usersMapping },
    );

    // 2 users × 3 mappings = 6 rows
    expect(result.rows).toHaveLength(6);

    // Rows should be ordered: all from first mapping, then all from second, etc.
    expect(result.rows[0].table).toBe("auth.users");
    expect(result.rows[1].table).toBe("auth.users");
    expect(result.rows[2].table).toBe("profiles");
    expect(result.rows[3].table).toBe("profiles");
    expect(result.rows[4].table).toBe("memberships");
    expect(result.rows[5].table).toBe("memberships");

    // Same user ID produces same v3 UUID across all three tables
    const expectedUuid1 = strikeUuid("users", "user1");
    expect(result.rows[0].values.id).toBe(expectedUuid1);
    expect(result.rows[2].values.user_id).toBe(expectedUuid1);
    expect(result.rows[4].values.user_id).toBe(expectedUuid1);
  });

  it("throws if the mappings do not all share the same bubble_type", () => {
    const a = mkMapping("users", "auth.users", { _id: "id" });
    const b = mkMapping("users", "profiles", { _id: "user_id" });
    b.bubble_type = "DifferentType"; // mismatch

    expect(() =>
      runMultiMappingEngine([a, b], [], {
        workspaceId: "x",
        workspaceSlug: "x",
        mapping: a,
      }),
    ).toThrow(/bubble_type/i);
  });

  it("concatenates skipped records from all mappings", () => {
    const a = mkMapping("users", "auth.users", { _id: "id", email_text: "email" });
    a.required_source_fields.push("email_text");
    const b = mkMapping("users", "profiles", { _id: "user_id", name_text: "full_name" });
    b.required_source_fields.push("name_text");

    const records: BubbleRecord[] = [
      { _id: "user1", email_text: "a@b.c", name_text: "Alpha" }, // ok in both
      { _id: "user2", name_text: "Beta" }, // missing email → skipped in a
      { _id: "user3", email_text: "c@d.e" }, // missing name → skipped in b
    ];

    const result = runMultiMappingEngine([a, b], records, {
      workspaceId: "x",
      workspaceSlug: "x",
      mapping: a,
    });

    // user1 produces 2 rows, user2 produces 1 (profiles only), user3 produces 1 (auth.users only)
    expect(result.rows).toHaveLength(4);
    expect(result.skipped.length).toBe(2);
  });

  it("throws if the mapping list is empty", () => {
    expect(() =>
      runMultiMappingEngine([], [], {
        workspaceId: "x",
        workspaceSlug: "x",
        mapping: undefined as never,
      }),
    ).toThrow(/at least one mapping/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/migration/multi_mapping.ts`**

```ts
import { runEngine } from "./engine.js";
import type { MigrationContext, MigrationResult } from "./types.js";
import type { Mapping } from "../research/mapping.js";
import type { BubbleRecord } from "../bubble/types.js";

/**
 * Run the engine across multiple mappings that share the same bubble_type.
 * Rows are returned in mapping order: all rows from mapping[0], then mapping[1], etc.
 * This ensures parent tables are inserted before child tables that reference them.
 *
 * Skipped records and warnings are accumulated across all mappings.
 */
export function runMultiMappingEngine(
  mappings: Mapping[],
  records: BubbleRecord[],
  ctx: MigrationContext,
): MigrationResult {
  if (mappings.length === 0) {
    throw new Error("runMultiMappingEngine requires at least one mapping");
  }

  const bubbleType = mappings[0].bubble_type;
  for (const m of mappings) {
    if (m.bubble_type !== bubbleType) {
      throw new Error(
        `All mappings must share the same bubble_type. Expected "${bubbleType}", got "${m.bubble_type}" for entity "${m.entity}".`,
      );
    }
  }

  const allRows: MigrationResult["rows"] = [];
  const allSkipped: MigrationResult["skipped"] = [];
  const allWarnings: string[] = [];

  for (const mapping of mappings) {
    const result = runEngine(mapping, records, { ...ctx, mapping });
    allRows.push(...result.rows);
    allSkipped.push(...result.skipped);
    allWarnings.push(...result.warnings);
  }

  return { rows: allRows, skipped: allSkipped, warnings: allWarnings };
}
```

- [ ] **Step 4: Run tests and commit**

```bash
pnpm test && pnpm typecheck
git add -A
git commit -m "feat(migration): add multi-mapping helper for entities that span multiple tables"
```

---

## Task 2: `migrate_departments` tool

**Files:**
- Create: `src/tools/migrate_departments.ts`
- Create: `tests/tools/migrate_departments.test.ts`

**Pattern:** Identical to `migrate_locations` from Phase 3, just with `entity: "departments"`, Bubble type `"department"`, order index `3`.

- [ ] **Step 1: Write the failing test**

`tests/tools/migrate_departments.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrateDepartmentsTool } from "../../src/tools/migrate_departments.js";
import { BubbleClient } from "../../src/bubble/client.js";
import type { Mapping } from "../../src/research/mapping.js";

function mkDepartmentsMapping(): Mapping {
  return {
    entity: "departments",
    bubble_type: "department",
    target_table: "departments",
    field_map: {
      _id: { target: "id", transform: "fk_uuid:departments", needs_review: false, source_value_types: ["string"], occurrence_count: 5, sample_values: [] },
      workspace: { target: "workspace_id", transform: "fk_uuid:workspaces", needs_review: false, source_value_types: ["string"], occurrence_count: 5, sample_values: [] },
      name_text: { target: "name", transform: "trim", needs_review: false, source_value_types: ["string"], occurrence_count: 5, sample_values: [] },
    },
    required_source_fields: ["_id", "workspace", "name_text"],
    skip_if_missing: [],
    known_quirks: [],
    last_verified: "2026-04-07",
    sample_record_count: 5,
    total_record_count: 5,
  };
}

describe("migrate_departments tool", () => {
  let mappingsDir: string;
  let stagingDir: string;

  beforeEach(() => {
    mappingsDir = mkdtempSync(join(tmpdir(), "strike-d-mappings-"));
    stagingDir = mkdtempSync(join(tmpdir(), "strike-d-staging-"));
    writeFileSync(join(mappingsDir, "departments.json"), JSON.stringify(mkDepartmentsMapping(), null, 2));
  });

  afterEach(() => {
    rmSync(mappingsDir, { recursive: true, force: true });
    rmSync(stagingDir, { recursive: true, force: true });
  });

  function makeClient(
    workspaceRecord: Record<string, unknown>,
    deptRecords: Array<Record<string, unknown>>,
  ): BubbleClient {
    const client = new BubbleClient(
      { bubbleAppUrl: "https://x", bubbleApiToken: "t" },
      vi.fn() as unknown as typeof fetch,
    );
    vi.spyOn(client, "listAll").mockImplementation(async (type: string) => {
      if (type === "workspace") return [workspaceRecord] as never;
      if (type === "department") return deptRecords as never;
      return [] as never;
    });
    return client;
  }

  it("emits one row per department belonging to the workspace", async () => {
    const client = makeClient(
      { _id: "ws1", name_text: "Alpha" },
      [
        { _id: "d1", workspace: "ws1", name_text: "Kitchen" },
        { _id: "d2", workspace: "ws1", name_text: "Bar" },
      ],
    );

    const result = await migrateDepartmentsTool.execute(
      { workspaceId: "ws1" },
      { bubble: client, mappingsDir, vaultBubbleShapesDir: "", stagingDir, supabase: null },
    );

    expect(result.recordsEmitted).toBe(2);
    expect(result.sqlFilePath).toMatch(/03_departments\.sql$/);
    const sql = readFileSync(result.sqlFilePath, "utf-8");
    expect(sql).toContain("INSERT INTO departments");
    expect(sql).toContain("'Kitchen'");
    expect(sql).toContain("'Bar'");
  });

  it("filters out departments belonging to other workspaces", async () => {
    const client = makeClient(
      { _id: "ws1", name_text: "Alpha" },
      [
        { _id: "d1", workspace: "ws1", name_text: "Mine" },
        { _id: "d2", workspace: "ws2", name_text: "Not mine" },
      ],
    );

    const result = await migrateDepartmentsTool.execute(
      { workspaceId: "ws1" },
      { bubble: client, mappingsDir, vaultBubbleShapesDir: "", stagingDir, supabase: null },
    );

    expect(result.recordsEmitted).toBe(1);
  });

  it("throws if departments mapping has unreviewed fields", async () => {
    const m = mkDepartmentsMapping();
    m.field_map.name_text.needs_review = true;
    writeFileSync(join(mappingsDir, "departments.json"), JSON.stringify(m, null, 2));

    const client = makeClient({ _id: "ws1", name_text: "x" }, []);
    await expect(
      migrateDepartmentsTool.execute(
        { workspaceId: "ws1" },
        { bubble: client, mappingsDir, vaultBubbleShapesDir: "", stagingDir, supabase: null },
      ),
    ).rejects.toThrow(/needs_review/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/tools/migrate_departments.ts`**

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

function buildReport(entity: string, workspaceId: string, workspaceSlug: string, result: { rows: unknown[]; skipped: { recordId: string; reason: string }[]; warnings: string[] }, generatedAt: string): string {
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

export const migrateDepartmentsTool = {
  name: "migrate_departments",
  description:
    "Migrate all departments belonging to a workspace from Bubble to a staged Supabase migration file.",
  inputSchema: z.object({
    workspaceId: z.string().min(1),
  }),
  execute: async (input: { workspaceId: string }, ctx: ToolContext): Promise<MigrationReport> => {
    const mapping = await loadMapping(ctx.mappingsDir, "departments");
    if (!mapping) throw new Error('mapping for "departments" not found. Run research_entity first.');

    const entry = getEntityByName("departments");
    if (!entry || !entry.workspaceFieldKey) throw new Error("departments entity not in registry or missing workspace key");

    const workspaces = await ctx.bubble.listAll("workspace", {});
    const ws = workspaces.find((w) => w._id === input.workspaceId);
    if (!ws) throw new Error(`workspace not found: ${input.workspaceId}`);
    const workspaceSlug = slugify(pickName(ws));

    const all = await ctx.bubble.listAll(entry.bubbleType, {
      constraints: [{ key: entry.workspaceFieldKey, constraint_type: "equals", value: input.workspaceId }],
    });
    const filtered = all.filter((r) => r[entry.workspaceFieldKey!] === input.workspaceId);

    const generatedAt = new Date().toISOString();
    const result = runEngine(mapping, filtered, { workspaceId: input.workspaceId, workspaceSlug, mapping });
    const sql = emitSql(result.rows, { entity: "departments", workspaceId: input.workspaceId, workspaceSlug, generatedAt });
    const report = buildReport("departments", input.workspaceId, workspaceSlug, result, generatedAt);

    const staged = await writeStagedFiles({
      stagingDir: ctx.stagingDir,
      workspaceSlug,
      orderIndex: 3,
      entity: "departments",
      sql,
      report,
    });

    return {
      entity: "departments",
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
git commit -m "feat(tools): add migrate_departments tool"
```

---

## Task 3: `migrate_teams` tool

**Files:**
- Create: `src/tools/migrate_teams.ts`
- Create: `tests/tools/migrate_teams.test.ts`

**Pattern:** Identical to `migrate_departments`, just swap `departments → teams`, `department → team`, `orderIndex: 4`.

- [ ] **Step 1: Write the test**

Copy `tests/tools/migrate_departments.test.ts` to `tests/tools/migrate_teams.test.ts`. Global replace `department → team`, `Departments → Teams`, `mkDepartmentsMapping → mkTeamsMapping`, `03_departments → 04_teams`, `migrateDepartmentsTool → migrateTeamsTool`.

- [ ] **Step 2: Run it to verify failure**

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/tools/migrate_teams.ts`**

Copy `src/tools/migrate_departments.ts` to `src/tools/migrate_teams.ts`. Global replace:
- `migrateDepartmentsTool → migrateTeamsTool`
- `migrate_departments → migrate_teams`
- `"departments"` → `"teams"` (inside `loadMapping`, `getEntityByName`, registry, tool name, entity field, emit meta, report)
- `orderIndex: 3` → `orderIndex: 4`
- Description: "departments" → "teams"

- [ ] **Step 4: Run tests and commit**

```bash
pnpm test && pnpm typecheck
git add -A
git commit -m "feat(tools): add migrate_teams tool"
```

---

## Task 4: `migrate_users` tool (multi-table)

**Files:**
- Create: `src/tools/migrate_users.ts`
- Create: `tests/tools/migrate_users.test.ts`

**Pattern:** Uses `runMultiMappingEngine` from Task 1. Loads three mappings — `users.json`, `profiles.json`, `memberships.json` — which all share `bubble_type: "User"`. Fetches User records filtered by workspace. Runs the engine across all three mappings. Emits one combined SQL file with INSERTs for all three tables in order.

Order index: `5`.

**Important safety consideration:** `auth.users` is a Supabase-managed table. Inserting directly is allowed but requires specific columns (`id`, `email`, plus optionally `encrypted_password`, `email_confirmed_at`, etc.). The mapping files must declare only valid columns. This is enforced by the v3 schema — if the mapping has extra columns, the SQL will fail at apply time, not silently succeed.

- [ ] **Step 1: Write the failing test**

`tests/tools/migrate_users.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrateUsersTool } from "../../src/tools/migrate_users.js";
import { BubbleClient } from "../../src/bubble/client.js";
import type { Mapping } from "../../src/research/mapping.js";

function mkMapping(entity: string, target: string, fields: Record<string, string>): Mapping {
  const field_map: Mapping["field_map"] = {};
  for (const [src, tgt] of Object.entries(fields)) {
    field_map[src] = {
      target: tgt,
      transform: src === "_id" ? `fk_uuid:users` : src === "workspace" ? "fk_uuid:workspaces" : "trim",
      needs_review: false,
      source_value_types: ["string"],
      occurrence_count: 10,
      sample_values: [],
    };
  }
  return {
    entity,
    bubble_type: "User",
    target_table: target,
    field_map,
    required_source_fields: ["_id"],
    skip_if_missing: [],
    known_quirks: [],
    last_verified: "2026-04-07",
    sample_record_count: 10,
    total_record_count: 10,
  };
}

describe("migrate_users tool", () => {
  let mappingsDir: string;
  let stagingDir: string;

  beforeEach(() => {
    mappingsDir = mkdtempSync(join(tmpdir(), "strike-u-mappings-"));
    stagingDir = mkdtempSync(join(tmpdir(), "strike-u-staging-"));
    writeFileSync(
      join(mappingsDir, "users.json"),
      JSON.stringify(mkMapping("users", "auth.users", { _id: "id", email_text: "email" }), null, 2),
    );
    writeFileSync(
      join(mappingsDir, "profiles.json"),
      JSON.stringify(mkMapping("profiles", "profiles", { _id: "user_id", name_text: "full_name" }), null, 2),
    );
    writeFileSync(
      join(mappingsDir, "memberships.json"),
      JSON.stringify(mkMapping("memberships", "memberships", { _id: "user_id", workspace: "workspace_id" }), null, 2),
    );
  });

  afterEach(() => {
    rmSync(mappingsDir, { recursive: true, force: true });
    rmSync(stagingDir, { recursive: true, force: true });
  });

  function makeClient(
    workspaceRecord: Record<string, unknown>,
    userRecords: Array<Record<string, unknown>>,
  ): BubbleClient {
    const client = new BubbleClient(
      { bubbleAppUrl: "https://x", bubbleApiToken: "t" },
      vi.fn() as unknown as typeof fetch,
    );
    vi.spyOn(client, "listAll").mockImplementation(async (type: string) => {
      if (type === "workspace") return [workspaceRecord] as never;
      if (type === "User") return userRecords as never;
      return [] as never;
    });
    return client;
  }

  it("emits rows into auth.users, profiles, and memberships from a single Bubble User source", async () => {
    const client = makeClient(
      { _id: "ws1", name_text: "Alpha Workspace" },
      [
        { _id: "u1", email_text: "a@b.c", name_text: "Alpha User", workspace: "ws1" },
        { _id: "u2", email_text: "d@e.f", name_text: "Beta User", workspace: "ws1" },
      ],
    );

    const result = await migrateUsersTool.execute(
      { workspaceId: "ws1" },
      { bubble: client, mappingsDir, vaultBubbleShapesDir: "", stagingDir, supabase: null },
    );

    expect(result.sqlFilePath).toMatch(/05_users\.sql$/);
    const sql = readFileSync(result.sqlFilePath, "utf-8");

    // Two rows per table = 6 inserts total
    const authInserts = (sql.match(/INSERT INTO auth\.users/g) ?? []).length;
    const profileInserts = (sql.match(/INSERT INTO profiles/g) ?? []).length;
    const membershipInserts = (sql.match(/INSERT INTO memberships/g) ?? []).length;
    expect(authInserts).toBe(2);
    expect(profileInserts).toBe(2);
    expect(membershipInserts).toBe(2);

    // Order: auth.users must come before profiles must come before memberships
    const authIdx = sql.indexOf("INSERT INTO auth.users");
    const profileIdx = sql.indexOf("INSERT INTO profiles");
    const membershipIdx = sql.indexOf("INSERT INTO memberships");
    expect(authIdx).toBeLessThan(profileIdx);
    expect(profileIdx).toBeLessThan(membershipIdx);
  });

  it("throws if any of the three mappings is missing", async () => {
    rmSync(join(mappingsDir, "profiles.json"));
    const client = makeClient({ _id: "ws1", name_text: "x" }, [{ _id: "u1" }]);
    await expect(
      migrateUsersTool.execute(
        { workspaceId: "ws1" },
        { bubble: client, mappingsDir, vaultBubbleShapesDir: "", stagingDir, supabase: null },
      ),
    ).rejects.toThrow(/profiles/i);
  });

  it("throws if any mapping has unreviewed fields", async () => {
    const broken = mkMapping("profiles", "profiles", { _id: "user_id", name_text: "full_name" });
    broken.field_map.name_text.needs_review = true;
    writeFileSync(join(mappingsDir, "profiles.json"), JSON.stringify(broken, null, 2));

    const client = makeClient({ _id: "ws1", name_text: "x" }, [{ _id: "u1", name_text: "Alpha" }]);
    await expect(
      migrateUsersTool.execute(
        { workspaceId: "ws1" },
        { bubble: client, mappingsDir, vaultBubbleShapesDir: "", stagingDir, supabase: null },
      ),
    ).rejects.toThrow(/needs_review/i);
  });

  it("filters users by workspace (client-side)", async () => {
    const client = makeClient(
      { _id: "ws1", name_text: "Target" },
      [
        { _id: "u1", email_text: "a@b.c", name_text: "Mine", workspace: "ws1" },
        { _id: "u2", email_text: "x@y.z", name_text: "Not mine", workspace: "wsOther" },
      ],
    );

    const result = await migrateUsersTool.execute(
      { workspaceId: "ws1" },
      { bubble: client, mappingsDir, vaultBubbleShapesDir: "", stagingDir, supabase: null },
    );

    // Only 1 user × 3 tables = 3 rows
    expect(result.recordsEmitted).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/tools/migrate_users.ts`**

```ts
import { z } from "zod";
import { loadMapping } from "../research/mapping.js";
import { runMultiMappingEngine } from "../migration/multi_mapping.js";
import { emitSql } from "../migration/sql_emitter.js";
import { writeStagedFiles, slugify } from "../migration/staging.js";
import { getEntityByName } from "../entities.js";
import type { ToolContext } from "./list_workspaces.js";
import type { MigrationReport } from "../migration/types.js";

const NAME_KEYS = ["name_text", "Name", "Titel", "title", "name"];
const MAPPING_FILES = ["users", "profiles", "memberships"] as const;

function pickName(record: Record<string, unknown>): string {
  for (const k of NAME_KEYS) {
    const v = record[k];
    if (typeof v === "string" && v.trim().length > 0) return v;
  }
  return "(unnamed)";
}

function buildReport(
  workspaceId: string,
  workspaceSlug: string,
  result: { rows: unknown[]; skipped: { recordId: string; reason: string }[]; warnings: string[] },
  generatedAt: string,
): string {
  const lines = [
    "# Migration report — users",
    "",
    `- **Workspace ID:** \`${workspaceId}\``,
    `- **Workspace slug:** \`${workspaceSlug}\``,
    `- **Generated:** ${generatedAt}`,
    `- **Total rows emitted (across auth.users + profiles + memberships):** ${result.rows.length}`,
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

export const migrateUsersTool = {
  name: "migrate_users",
  description:
    "Migrate users from a workspace into auth.users + profiles + memberships (three tables) from a single Bubble User source via multi-mapping engine.",
  inputSchema: z.object({
    workspaceId: z.string().min(1),
  }),
  execute: async (
    input: { workspaceId: string },
    ctx: ToolContext,
  ): Promise<MigrationReport> => {
    // Load all three mappings — they must all exist and all pass the unreviewed-fields gate
    const mappings = [];
    for (const name of MAPPING_FILES) {
      const m = await loadMapping(ctx.mappingsDir, name);
      if (!m) {
        throw new Error(
          `mapping for "${name}" not found at ${ctx.mappingsDir}/${name}.json. migrate_users requires all three: users, profiles, memberships.`,
        );
      }
      mappings.push(m);
    }

    const entry = getEntityByName("users");
    if (!entry || !entry.workspaceFieldKey) {
      throw new Error("users entity not in registry or missing workspace key");
    }

    // Resolve workspace slug
    const workspaces = await ctx.bubble.listAll("workspace", {});
    const ws = workspaces.find((w) => w._id === input.workspaceId);
    if (!ws) throw new Error(`workspace not found: ${input.workspaceId}`);
    const workspaceSlug = slugify(pickName(ws));

    // Fetch users (Bubble type: "User") and filter client-side
    const all = await ctx.bubble.listAll(entry.bubbleType, {
      constraints: [
        { key: entry.workspaceFieldKey, constraint_type: "equals", value: input.workspaceId },
      ],
    });
    const filtered = all.filter((r) => r[entry.workspaceFieldKey!] === input.workspaceId);

    const generatedAt = new Date().toISOString();
    const result = runMultiMappingEngine(mappings, filtered, {
      workspaceId: input.workspaceId,
      workspaceSlug,
      mapping: mappings[0],
    });

    const sql = emitSql(result.rows, {
      entity: "users",
      workspaceId: input.workspaceId,
      workspaceSlug,
      generatedAt,
    });
    const report = buildReport(input.workspaceId, workspaceSlug, result, generatedAt);

    const staged = await writeStagedFiles({
      stagingDir: ctx.stagingDir,
      workspaceSlug,
      orderIndex: 5,
      entity: "users",
      sql,
      report,
    });

    return {
      entity: "users",
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
git commit -m "feat(tools): add migrate_users (multi-table: auth.users + profiles + memberships)"
```

---

## Task 5: `migrate_roles_and_rules` tool

**Files:**
- Create: `src/tools/migrate_roles_and_rules.ts`
- Create: `tests/tools/migrate_roles_and_rules.test.ts`

**Pattern:** Depends on what Phase 2 research reveals about the `rule` entity shape. Two possibilities:

**Option A — single mapping:** If `roles_and_rules.json` cleanly maps to one v3 table (e.g. `rules`), use the simple `migrate_locations` pattern. Order index `6`.

**Option B — multi-mapping:** If the entity splits across two v3 tables (e.g. `roles` and `role_permissions`), use `runMultiMappingEngine` with two mapping files (`roles.json`, `rules.json` or similar).

For this plan we implement **Option A** as the baseline. If Phase 2 research reveals Option B is needed, refactor during implementation — the pattern is already established by `migrate_users`.

- [ ] **Step 1: Write the test**

Copy `tests/tools/migrate_departments.test.ts` to `tests/tools/migrate_roles_and_rules.test.ts`. Global replace:
- `departments → rules`
- `department → rule`
- `Departments → RolesAndRules`
- `03_departments → 06_rules`
- `migrateDepartmentsTool → migrateRolesAndRulesTool`
- `mkDepartmentsMapping → mkRulesMapping` (entity: "rules", target_table: "rules")

- [ ] **Step 2: Run test to verify failure**

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/tools/migrate_roles_and_rules.ts`**

Copy `src/tools/migrate_departments.ts` to `src/tools/migrate_roles_and_rules.ts`. Global replace:
- `migrateDepartmentsTool → migrateRolesAndRulesTool`
- `migrate_departments → migrate_roles_and_rules`
- `"departments"` → `"rules"` (in loadMapping, getEntityByName, entity field, emit meta, report)
- `orderIndex: 3` → `orderIndex: 6`
- Description: "departments" → "rules and roles"

- [ ] **Step 4: Run tests and commit**

```bash
pnpm test && pnpm typecheck
git add -A
git commit -m "feat(tools): add migrate_roles_and_rules tool"
```

---

## Task 6: Extend `plan_migration` with Phase 4 entities

**Files:**
- Modify: `src/tools/plan_migration.ts`
- Modify: `tests/tools/plan_migration.test.ts`

**Change:** Extend the `PHASE_3_ORDER` constant to include Phase 4 entities in dependency order. Rename to `MIGRATION_ORDER`.

```ts
const MIGRATION_ORDER: Array<{ entity: string; tool: string }> = [
  { entity: "workspace", tool: "migrate_workspace" },
  { entity: "locations", tool: "migrate_locations" },
  { entity: "departments", tool: "migrate_departments" },
  { entity: "teams", tool: "migrate_teams" },
  { entity: "users", tool: "migrate_users" },
  { entity: "rules", tool: "migrate_roles_and_rules" },
];
```

- [ ] **Step 1: Update the constant and rename**

Edit `src/tools/plan_migration.ts`:
- Rename `PHASE_3_ORDER` → `MIGRATION_ORDER`
- Add the 4 new entries in the order above

- [ ] **Step 2: Add test cases for new entities**

Append to `tests/tools/plan_migration.test.ts`:

```ts
it("includes migrate_departments, migrate_teams, migrate_users, migrate_roles_and_rules when present", async () => {
  const client = new BubbleClient(
    { bubbleAppUrl: "https://x", bubbleApiToken: "t" },
    vi.fn() as unknown as typeof fetch,
  );
  vi.spyOn(client, "listAll").mockImplementation(async (type: string) => {
    if (type === "workspace") return [{ _id: "ws1" }] as never;
    if (type === "location") return [{ _id: "l1", workspace: "ws1" }] as never;
    if (type === "department") return [{ _id: "d1", workspace: "ws1" }, { _id: "d2", workspace: "ws1" }] as never;
    if (type === "team") return [{ _id: "t1", workspace: "ws1" }] as never;
    if (type === "User") return [{ _id: "u1", workspace: "ws1" }, { _id: "u2", workspace: "ws1" }, { _id: "u3", workspace: "ws1" }] as never;
    if (type === "rule") return [{ _id: "r1", workspace: "ws1" }] as never;
    return [] as never;
  });

  const result = await planMigrationTool.execute(
    { workspaceId: "ws1" },
    { bubble: client, mappingsDir: "", vaultBubbleShapesDir: "", stagingDir: "", supabase: null },
  );

  const toolNames = result.steps.map((s) => s.tool);
  expect(toolNames).toEqual([
    "migrate_workspace",
    "migrate_locations",
    "migrate_departments",
    "migrate_teams",
    "migrate_users",
    "migrate_roles_and_rules",
  ]);

  expect(result.steps.find((s) => s.tool === "migrate_departments")?.recordCount).toBe(2);
  expect(result.steps.find((s) => s.tool === "migrate_users")?.recordCount).toBe(3);
});
```

- [ ] **Step 3: Run tests and commit**

```bash
pnpm test && pnpm typecheck
git add -A
git commit -m "feat(tools): extend plan_migration with Phase 4 identity entities"
```

---

## Task 7: Register Phase 4 tools in MCP server

**Files:**
- Modify: `src/index.ts`

**Change:** Import the 4 new tools and add them to the tools array in dependency order.

- [ ] **Step 1: Edit `src/index.ts`**

```ts
// new imports
import { migrateDepartmentsTool } from "./tools/migrate_departments.js";
import { migrateTeamsTool } from "./tools/migrate_teams.js";
import { migrateUsersTool } from "./tools/migrate_users.js";
import { migrateRolesAndRulesTool } from "./tools/migrate_roles_and_rules.js";

// in the tools array:
const tools = [
  listWorkspacesTool,
  inspectWorkspaceTool,
  researchEntityTool,
  migrateWorkspaceTool,
  migrateLocationsTool,
  migrateDepartmentsTool,
  migrateTeamsTool,
  migrateUsersTool,
  migrateRolesAndRulesTool,
  planMigrationTool,
  previewSqlTool,
  verifyTargetEmptyTool,
  bundleMigrationTool,
];
```

- [ ] **Step 2: Build and probe**

```bash
pnpm test && pnpm typecheck && pnpm build
BUBBLE_APP_URL=https://fake BUBBLE_API_TOKEN=fake node dist/index.js <<'EOF'
{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}
EOF
```

Expected response includes all 13 tools.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(server): register Phase 4 identity migration tools"
```

---

## Task 8: Phase 4 smoke test docs

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Append to `README.md`**

```markdown

## Phase 4 smoke test — identity entities

Prerequisites:
- Phase 3 smoke test passed
- Reviewed mappings for all Phase 4 entities: `departments`, `teams`, `users`, `profiles`, `memberships`, `rules`
- A test workspace in Bubble with at least one of each entity type

Procedure:
1. Research each new entity first: `research departments`, `research teams`, `research users`, `research profiles`, `research memberships`, `research rules`
2. Review each mapping in `mappings/*.json`, set `target_table`, resolve `needs_review: true` fields
3. Plan: "Plan migration for workspace <id>"
4. Expected: all 6 steps visible (migrate_workspace through migrate_roles_and_rules) with record counts
5. Execute each step in order: migrate_workspace, migrate_locations, migrate_departments, migrate_teams, migrate_users, migrate_roles_and_rules
6. Open each generated `.sql` file, verify BEGIN/COMMIT + INSERTs per expected table
7. **Critical check for migrate_users:** the generated `05_users.sql` file must contain INSERTs into THREE tables (auth.users, profiles, memberships) in that order
8. Bundle: "Bundle migration for workspace <slug>"
9. Preview: "Preview the bundled SQL"
10. Apply manually: `psql $LOCAL_SUPABASE_URL -f supabase/migration-staging/<slug>/bundled.sql`
11. Verify row counts in Supabase for every table:
    - workspaces (1), locations (n), departments (n), teams (n)
    - auth.users (n), profiles (n), memberships (n)
    - rules (n)
12. **FK integrity check:** `SELECT u.id, p.full_name FROM auth.users u JOIN profiles p ON p.user_id = u.id WHERE u.id IN (<migrated ids>)` — every user should have a matching profile
13. Record findings in `docs/superpowers/notes/phase-4-smoke-test.md`

If any FK joins fail, the `fk_uuid` transform is producing inconsistent UUIDs — investigate before proceeding to Phase 5.
```

- [ ] **Step 2: Final verification + commit**

```bash
pnpm typecheck && pnpm test && pnpm build
git add README.md
git commit -m "docs: add Phase 4 smoke test procedure"
```

---

## Phase 4 Exit Criteria

- [x] Multi-mapping engine helper tested and working
- [x] `migrate_departments`, `migrate_teams`, `migrate_users`, `migrate_roles_and_rules` all implemented and tested
- [x] `migrate_users` correctly emits rows into three tables (auth.users, profiles, memberships) with consistent UUIDs across tables
- [x] `plan_migration` includes all Phase 4 entities in dependency order
- [x] All 13 tools registered in the MCP server
- [x] Full test suite passes, typecheck clean, build succeeds
- [x] Phase 4 smoke test executed successfully against local Supabase with FK integrity verified

After Phase 4 the identity + structure skeleton of a workspace can be fully migrated. Phase 5 (operational entities — shifts, tasks, routines, training) is next.
