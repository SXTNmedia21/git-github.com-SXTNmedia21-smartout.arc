# strike-mcp Phase 5 Implementation Plan — Operational Entities (with Custom Transforms)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add migration tools for the operational entities — shift templates, shifts, tasks, routines, training. After this phase, an entire operational workspace can be migrated end-to-end.

**Architecture:** This is the phase where the **custom-transform escape hatch** from Approach 3 lives. Most operational entities follow the same simple pattern as `migrate_locations`. But **shifts** are known to have weird Bubble shapes (per the `bubble-salary-mcp` skill: pre-2024 records missing fields, emoji-suffixed display names, sparse records that lie about field existence). For these, the migration tool defines an entity-specific **pre-transform** function that munges raw Bubble records into a shape the engine can handle.

The escape hatch lives in `src/migration/custom/<entity>.ts` files. The engine itself stays config-driven and unchanged — only the migration tools call into the custom transforms.

**Prerequisites:** Phase 4 merged on `main`. All 13 tools from Phases 1–4 working. Phase 4 smoke test passed.

---

## The custom-transform pattern (new in Phase 5)

For most entities, the flow is:

```
fetch records → runEngine(mapping, records, ctx) → emitSql → writeStagedFiles
```

For shifts (and any entity that needs cleanup before the engine sees it):

```
fetch records
  → preTransformShifts(records)   ← entity-specific cleanup function
  → runEngine(mapping, cleaned, ctx)
  → emitSql → writeStagedFiles
```

The pre-transform is a **pure function** that takes raw Bubble records and returns "engine-ready" Bubble records (same shape, but with derived/normalized fields added, broken fields stripped, missing required fields filled with defaults, etc.).

```ts
// src/migration/custom/shifts.ts
import type { BubbleRecord } from "../../bubble/types.js";

export function preTransformShifts(records: BubbleRecord[]): BubbleRecord[] {
  return records.map((r) => ({
    ...r,
    // example: pre-2024 records missing date.end → default to date.start + 8h
    "date.end 🟢": r["date.end 🟢"] ?? deriveEndFromStart(r["date.start 🟢"]),
    // strip emoji suffixes (the engine sees it but skips it because target is null)
    // any other normalization
  }));
}
```

The escape hatch is **always optional** and **always pure**. The engine never knows it exists. Tests for the pre-transform live in `tests/migration/custom/shifts.test.ts`.

---

## File Structure

```
strike-mcp/
├── src/
│   ├── migration/
│   │   └── custom/                              # NEW directory
│   │       └── shifts.ts                        # NEW — preTransformShifts
│   └── tools/
│       ├── migrate_shift_templates.ts           # NEW (simple — copy of migrate_locations)
│       ├── migrate_shifts.ts                    # NEW — uses preTransformShifts
│       ├── migrate_tasks.ts                     # NEW (simple)
│       ├── migrate_routines.ts                  # NEW (simple)
│       ├── migrate_training.ts                  # NEW (simple, likely)
│       └── plan_migration.ts                    # MODIFY — add Phase 5 entities
└── tests/
    ├── migration/
    │   └── custom/
    │       └── shifts.test.ts
    └── tools/
        ├── migrate_shift_templates.test.ts
        ├── migrate_shifts.test.ts
        ├── migrate_tasks.test.ts
        ├── migrate_routines.test.ts
        └── migrate_training.test.ts
```

---

## Task 1: Shifts pre-transform

**Files:**
- Create: `src/migration/custom/shifts.ts`
- Create: `tests/migration/custom/shifts.test.ts`

**Purpose:** Define the pure cleanup function that runs before the engine on shift records. The exact transformations depend on what Phase 2 research revealed about Bubble shifts. This task implements a baseline that handles **two known quirks**:

1. **Missing `date.end 🟢`** on pre-2024 records → derive from `date.start 🟢` + the workspace's default shift length (default 8 hours).
2. **Sparse records** where `_payrollType 🟢` is missing → set to `null` (engine handles null via the `nullable` transform).

If Phase 2 research reveals more quirks, add them here as additional pure transformations. Each quirk gets its own helper function and its own test.

- [ ] **Step 1: Write the failing test**

`tests/migration/custom/shifts.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { preTransformShifts } from "../../../src/migration/custom/shifts.js";
import type { BubbleRecord } from "../../../src/bubble/types.js";

describe("preTransformShifts", () => {
  it("passes through fully-populated records unchanged", () => {
    const input: BubbleRecord[] = [
      {
        _id: "shift1",
        workspace: "ws1",
        "date.start 🟢": "2026-03-15T10:00:00.000Z",
        "date.end 🟢": "2026-03-15T18:00:00.000Z",
        "_payrollType 🟢": "regular",
      },
    ];
    const out = preTransformShifts(input);
    expect(out[0]["date.end 🟢"]).toBe("2026-03-15T18:00:00.000Z");
    expect(out[0]["_payrollType 🟢"]).toBe("regular");
  });

  it("derives date.end 🟢 from date.start 🟢 + 8h when missing", () => {
    const input: BubbleRecord[] = [
      {
        _id: "shift_old",
        workspace: "ws1",
        "date.start 🟢": "2023-06-01T10:00:00.000Z",
      },
    ];
    const out = preTransformShifts(input);
    expect(out[0]["date.end 🟢"]).toBe("2023-06-01T18:00:00.000Z");
  });

  it("leaves date.end 🟢 as null when date.start 🟢 is also missing", () => {
    const input: BubbleRecord[] = [
      { _id: "shift_broken", workspace: "ws1" },
    ];
    const out = preTransformShifts(input);
    expect(out[0]["date.end 🟢"]).toBe(null);
  });

  it("normalizes _payrollType 🟢 to null when missing", () => {
    const input: BubbleRecord[] = [
      {
        _id: "shift1",
        workspace: "ws1",
        "date.start 🟢": "2026-03-15T10:00:00.000Z",
      },
    ];
    const out = preTransformShifts(input);
    expect(out[0]["_payrollType 🟢"]).toBe(null);
  });

  it("does not mutate the input array", () => {
    const input: BubbleRecord[] = [
      { _id: "shift1", workspace: "ws1", "date.start 🟢": "2023-06-01T10:00:00.000Z" },
    ];
    const inputCopy = JSON.parse(JSON.stringify(input));
    preTransformShifts(input);
    expect(input).toEqual(inputCopy);
  });

  it("preserves _id on every record", () => {
    const input: BubbleRecord[] = [
      { _id: "a", workspace: "ws1" },
      { _id: "b", workspace: "ws1" },
    ];
    const out = preTransformShifts(input);
    expect(out.map((r) => r._id)).toEqual(["a", "b"]);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/migration/custom/shifts.ts`**

```ts
import type { BubbleRecord } from "../../bubble/types.js";

const DEFAULT_SHIFT_LENGTH_HOURS = 8;

function deriveEndFromStart(start: unknown): string | null {
  if (typeof start !== "string") return null;
  const startDate = new Date(start);
  if (Number.isNaN(startDate.getTime())) return null;
  const endDate = new Date(startDate.getTime() + DEFAULT_SHIFT_LENGTH_HOURS * 60 * 60 * 1000);
  return endDate.toISOString();
}

/**
 * Pre-engine cleanup for Bubble shift records.
 *
 * Known quirks (from Phase 2 research):
 * 1. Pre-2024 records missing "date.end 🟢" → derive from start + 8h
 * 2. Sparse records missing "_payrollType 🟢" → null
 *
 * Add additional quirks here as Phase 5 smoke testing reveals them.
 * Pure function — never mutates input.
 */
export function preTransformShifts(records: BubbleRecord[]): BubbleRecord[] {
  return records.map((r) => {
    const cleaned: BubbleRecord = { ...r };

    if (cleaned["date.end 🟢"] === undefined || cleaned["date.end 🟢"] === null) {
      cleaned["date.end 🟢"] = deriveEndFromStart(cleaned["date.start 🟢"]);
    }

    if (cleaned["_payrollType 🟢"] === undefined) {
      cleaned["_payrollType 🟢"] = null;
    }

    return cleaned;
  });
}
```

- [ ] **Step 4: Run tests and commit**

```bash
pnpm test && pnpm typecheck
git add -A
git commit -m "feat(migration): add custom pre-transform for shifts (handles known quirks)"
```

---

## Task 2: `migrate_shift_templates` tool

**Files:**
- Create: `src/tools/migrate_shift_templates.ts`
- Create: `tests/tools/migrate_shift_templates.test.ts`

**Pattern:** Same as `migrate_locations` from Phase 3. Order index `7`.

- [ ] **Step 1: Write the test**

Copy `tests/tools/migrate_departments.test.ts` to `tests/tools/migrate_shift_templates.test.ts`. Global replace:
- `departments → shift_templates` (in mapping filename and field references)
- `department → shift_template` (in Bubble type references)
- `Departments → ShiftTemplates`
- `03_departments → 07_shift_templates`
- `migrateDepartmentsTool → migrateShiftTemplatesTool`
- `mkDepartmentsMapping → mkShiftTemplatesMapping`

- [ ] **Step 2: Run test to verify failure**

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/tools/migrate_shift_templates.ts`**

Copy `src/tools/migrate_departments.ts` to `src/tools/migrate_shift_templates.ts`. Global replace:
- `migrateDepartmentsTool → migrateShiftTemplatesTool`
- `migrate_departments → migrate_shift_templates`
- `"departments"` → `"shift_templates"` (loadMapping, getEntityByName, entity field, emit meta, report)
- `orderIndex: 3` → `orderIndex: 7`
- Description: "departments" → "shift templates"

- [ ] **Step 4: Run tests and commit**

```bash
pnpm test && pnpm typecheck
git add -A
git commit -m "feat(tools): add migrate_shift_templates tool"
```

---

## Task 3: `migrate_shifts` tool (uses pre-transform)

**Files:**
- Create: `src/tools/migrate_shifts.ts`
- Create: `tests/tools/migrate_shifts.test.ts`

**Pattern:** Like `migrate_locations`, but with one extra step: call `preTransformShifts(records)` before passing to `runEngine`. Order index `8`.

This is the architectural payoff of Approach 3 — the engine stays config-driven for the 80%, and shifts get the escape hatch they need without polluting the engine.

- [ ] **Step 1: Write the failing test**

`tests/tools/migrate_shifts.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrateShiftsTool } from "../../src/tools/migrate_shifts.js";
import { BubbleClient } from "../../src/bubble/client.js";
import type { Mapping } from "../../src/research/mapping.js";

function mkShiftsMapping(): Mapping {
  return {
    entity: "shifts",
    bubble_type: "shift_satellite",
    target_table: "shifts",
    field_map: {
      _id: { target: "id", transform: "fk_uuid:shifts", needs_review: false, source_value_types: ["string"], occurrence_count: 100, sample_values: [] },
      workspace: { target: "workspace_id", transform: "fk_uuid:workspaces", needs_review: false, source_value_types: ["string"], occurrence_count: 100, sample_values: [] },
      "date.start 🟢": { target: "starts_at", transform: "bubble_date_to_tstz", needs_review: false, source_value_types: ["string"], occurrence_count: 100, sample_values: [] },
      "date.end 🟢": { target: "ends_at", transform: "bubble_date_to_tstz", needs_review: false, source_value_types: ["string", "null"], occurrence_count: 80, sample_values: [] },
      "_payrollType 🟢": { target: "payroll_type", transform: "nullable", needs_review: false, source_value_types: ["string", "null"], occurrence_count: 60, sample_values: [] },
    },
    required_source_fields: ["_id", "workspace", "date.start 🟢"],
    skip_if_missing: [],
    known_quirks: [
      "pre-2024 records missing date.end 🟢 — derived from start + 8h via preTransformShifts",
      "sparse records missing _payrollType 🟢 — normalized to null via preTransformShifts",
    ],
    last_verified: "2026-04-07",
    sample_record_count: 100,
    total_record_count: 12843,
  };
}

describe("migrate_shifts tool", () => {
  let mappingsDir: string;
  let stagingDir: string;

  beforeEach(() => {
    mappingsDir = mkdtempSync(join(tmpdir(), "strike-s-mappings-"));
    stagingDir = mkdtempSync(join(tmpdir(), "strike-s-staging-"));
    writeFileSync(join(mappingsDir, "shifts.json"), JSON.stringify(mkShiftsMapping(), null, 2));
  });

  afterEach(() => {
    rmSync(mappingsDir, { recursive: true, force: true });
    rmSync(stagingDir, { recursive: true, force: true });
  });

  function makeClient(
    workspaceRecord: Record<string, unknown>,
    shiftRecords: Array<Record<string, unknown>>,
  ): BubbleClient {
    const client = new BubbleClient(
      { bubbleAppUrl: "https://x", bubbleApiToken: "t" },
      vi.fn() as unknown as typeof fetch,
    );
    vi.spyOn(client, "listAll").mockImplementation(async (type: string) => {
      if (type === "workspace") return [workspaceRecord] as never;
      if (type === "shift_satellite") return shiftRecords as never;
      return [] as never;
    });
    return client;
  }

  it("emits one row per shift with all expected columns", async () => {
    const client = makeClient(
      { _id: "ws1", name_text: "Alpha" },
      [
        {
          _id: "s1",
          workspace: "ws1",
          "date.start 🟢": "2026-03-15T10:00:00.000Z",
          "date.end 🟢": "2026-03-15T18:00:00.000Z",
          "_payrollType 🟢": "regular",
        },
      ],
    );

    const result = await migrateShiftsTool.execute(
      { workspaceId: "ws1" },
      { bubble: client, mappingsDir, vaultBubbleShapesDir: "", stagingDir, supabase: null },
    );

    expect(result.recordsEmitted).toBe(1);
    expect(result.sqlFilePath).toMatch(/08_shifts\.sql$/);
    const sql = readFileSync(result.sqlFilePath, "utf-8");
    expect(sql).toContain("INSERT INTO shifts");
    expect(sql).toContain("'2026-03-15T10:00:00.000Z'");
    expect(sql).toContain("'2026-03-15T18:00:00.000Z'");
    expect(sql).toContain("'regular'");
  });

  it("derives missing date.end via preTransformShifts before engine runs", async () => {
    const client = makeClient(
      { _id: "ws1", name_text: "Alpha" },
      [
        {
          _id: "s_old",
          workspace: "ws1",
          "date.start 🟢": "2023-06-01T10:00:00.000Z",
          // date.end missing
        },
      ],
    );

    const result = await migrateShiftsTool.execute(
      { workspaceId: "ws1" },
      { bubble: client, mappingsDir, vaultBubbleShapesDir: "", stagingDir, supabase: null },
    );

    expect(result.recordsEmitted).toBe(1);
    const sql = readFileSync(result.sqlFilePath, "utf-8");
    // The engine should see the derived end (start + 8h)
    expect(sql).toContain("'2023-06-01T18:00:00.000Z'");
  });

  it("normalizes missing _payrollType to NULL via preTransformShifts", async () => {
    const client = makeClient(
      { _id: "ws1", name_text: "Alpha" },
      [
        {
          _id: "s2",
          workspace: "ws1",
          "date.start 🟢": "2026-03-15T10:00:00.000Z",
          "date.end 🟢": "2026-03-15T18:00:00.000Z",
          // _payrollType missing
        },
      ],
    );

    const result = await migrateShiftsTool.execute(
      { workspaceId: "ws1" },
      { bubble: client, mappingsDir, vaultBubbleShapesDir: "", stagingDir, supabase: null },
    );

    const sql = readFileSync(result.sqlFilePath, "utf-8");
    // payroll_type should be NULL, not "''" or "'undefined'"
    expect(sql).toContain("NULL");
  });

  it("filters shifts by workspace client-side", async () => {
    const client = makeClient(
      { _id: "ws1", name_text: "Alpha" },
      [
        { _id: "s1", workspace: "ws1", "date.start 🟢": "2026-01-01T10:00:00.000Z" },
        { _id: "s2", workspace: "wsOther", "date.start 🟢": "2026-01-01T10:00:00.000Z" },
      ],
    );

    const result = await migrateShiftsTool.execute(
      { workspaceId: "ws1" },
      { bubble: client, mappingsDir, vaultBubbleShapesDir: "", stagingDir, supabase: null },
    );

    expect(result.recordsEmitted).toBe(1);
  });

  it("throws if shifts mapping has unreviewed fields", async () => {
    const m = mkShiftsMapping();
    m.field_map["date.start 🟢"].needs_review = true;
    writeFileSync(join(mappingsDir, "shifts.json"), JSON.stringify(m, null, 2));

    const client = makeClient({ _id: "ws1", name_text: "x" }, []);
    await expect(
      migrateShiftsTool.execute(
        { workspaceId: "ws1" },
        { bubble: client, mappingsDir, vaultBubbleShapesDir: "", stagingDir, supabase: null },
      ),
    ).rejects.toThrow(/needs_review/i);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/tools/migrate_shifts.ts`**

```ts
import { z } from "zod";
import { loadMapping } from "../research/mapping.js";
import { runEngine } from "../migration/engine.js";
import { emitSql } from "../migration/sql_emitter.js";
import { writeStagedFiles, slugify } from "../migration/staging.js";
import { getEntityByName } from "../entities.js";
import { preTransformShifts } from "../migration/custom/shifts.js";
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

function buildReport(workspaceId: string, workspaceSlug: string, result: { rows: unknown[]; skipped: { recordId: string; reason: string }[]; warnings: string[] }, generatedAt: string, preTransformed: number): string {
  const lines = [
    "# Migration report — shifts",
    "",
    `- **Workspace ID:** \`${workspaceId}\``,
    `- **Workspace slug:** \`${workspaceSlug}\``,
    `- **Generated:** ${generatedAt}`,
    `- **Records pre-transformed:** ${preTransformed}`,
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

export const migrateShiftsTool = {
  name: "migrate_shifts",
  description:
    "Migrate all shifts belonging to a workspace from Bubble to a staged Supabase migration file. Applies preTransformShifts to handle known Bubble quirks before the engine runs.",
  inputSchema: z.object({
    workspaceId: z.string().min(1),
  }),
  execute: async (input: { workspaceId: string }, ctx: ToolContext): Promise<MigrationReport> => {
    const mapping = await loadMapping(ctx.mappingsDir, "shifts");
    if (!mapping) throw new Error('mapping for "shifts" not found. Run research_entity first.');

    const entry = getEntityByName("shifts");
    if (!entry || !entry.workspaceFieldKey) throw new Error("shifts entity not in registry");

    const workspaces = await ctx.bubble.listAll("workspace", {});
    const ws = workspaces.find((w) => w._id === input.workspaceId);
    if (!ws) throw new Error(`workspace not found: ${input.workspaceId}`);
    const workspaceSlug = slugify(pickName(ws));

    const all = await ctx.bubble.listAll(entry.bubbleType, {
      constraints: [{ key: entry.workspaceFieldKey, constraint_type: "equals", value: input.workspaceId }],
    });
    const filtered = all.filter((r) => r[entry.workspaceFieldKey!] === input.workspaceId);

    // ESCAPE HATCH: pre-transform before the engine
    const cleaned = preTransformShifts(filtered);

    const generatedAt = new Date().toISOString();
    const result = runEngine(mapping, cleaned, { workspaceId: input.workspaceId, workspaceSlug, mapping });
    const sql = emitSql(result.rows, { entity: "shifts", workspaceId: input.workspaceId, workspaceSlug, generatedAt });
    const report = buildReport(input.workspaceId, workspaceSlug, result, generatedAt, cleaned.length);

    const staged = await writeStagedFiles({
      stagingDir: ctx.stagingDir,
      workspaceSlug,
      orderIndex: 8,
      entity: "shifts",
      sql,
      report,
    });

    return {
      entity: "shifts",
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
git commit -m "feat(tools): add migrate_shifts with custom pre-transform for known quirks"
```

---

## Task 4: `migrate_tasks` tool

**Files:**
- Create: `src/tools/migrate_tasks.ts`
- Create: `tests/tools/migrate_tasks.test.ts`

**Pattern:** Same as `migrate_locations`. Order index `9`.

- [ ] **Step 1: Write the test**

Copy `tests/tools/migrate_departments.test.ts` to `tests/tools/migrate_tasks.test.ts`. Global replace:
- `departments → tasks`, `department → task`, `Departments → Tasks`, `03_departments → 09_tasks`, `migrateDepartmentsTool → migrateTasksTool`, `mkDepartmentsMapping → mkTasksMapping`

- [ ] **Step 2: Run test to verify failure**

Expected: FAIL.

- [ ] **Step 3: Implement `src/tools/migrate_tasks.ts`**

Copy `src/tools/migrate_departments.ts` → `src/tools/migrate_tasks.ts`. Global replace:
- `migrateDepartmentsTool → migrateTasksTool`
- `migrate_departments → migrate_tasks`
- `"departments"` → `"tasks"` (every occurrence)
- `orderIndex: 3` → `orderIndex: 9`

- [ ] **Step 4: Run tests and commit**

```bash
pnpm test && pnpm typecheck
git add -A
git commit -m "feat(tools): add migrate_tasks tool"
```

---

## Task 5: `migrate_routines` tool

**Files:**
- Create: `src/tools/migrate_routines.ts`
- Create: `tests/tools/migrate_routines.test.ts`

**Pattern:** Same as `migrate_tasks`. Order index `10`.

- [ ] **Step 1**: Copy test from departments, replace `departments → routines`, `department → routine`, `03 → 10`.
- [ ] **Step 2**: Run test, expect failure.
- [ ] **Step 3**: Copy `migrate_departments.ts` → `migrate_routines.ts`, replace strings + orderIndex.
- [ ] **Step 4**: Run tests, commit.

```bash
git commit -m "feat(tools): add migrate_routines tool"
```

---

## Task 6: `migrate_training` tool

**Files:**
- Create: `src/tools/migrate_training.ts`
- Create: `tests/tools/migrate_training.test.ts`

**Pattern:** Same as `migrate_tasks`. Order index `11`.

**Open question:** If Phase 2 research reveals training has multi-table shape (e.g. `training_modules` + `training_assignments`), refactor to use `runMultiMappingEngine` like `migrate_users`. For this plan, baseline is single-mapping.

- [ ] **Step 1**: Copy test, replace `departments → training`, `department → training`, `03 → 11`.
- [ ] **Step 2**: Run test, expect failure.
- [ ] **Step 3**: Implement, replace strings + orderIndex.
- [ ] **Step 4**: Run tests, commit.

```bash
git commit -m "feat(tools): add migrate_training tool"
```

---

## Task 7: Extend `plan_migration` with Phase 5 entities

**Files:**
- Modify: `src/tools/plan_migration.ts`
- Modify: `tests/tools/plan_migration.test.ts`

- [ ] **Step 1: Extend `MIGRATION_ORDER`**

```ts
const MIGRATION_ORDER: Array<{ entity: string; tool: string }> = [
  { entity: "workspace", tool: "migrate_workspace" },
  { entity: "locations", tool: "migrate_locations" },
  { entity: "departments", tool: "migrate_departments" },
  { entity: "teams", tool: "migrate_teams" },
  { entity: "users", tool: "migrate_users" },
  { entity: "rules", tool: "migrate_roles_and_rules" },
  { entity: "shift_templates", tool: "migrate_shift_templates" },  // NEW
  { entity: "shifts", tool: "migrate_shifts" },                    // NEW
  { entity: "tasks", tool: "migrate_tasks" },                      // NEW
  { entity: "routines", tool: "migrate_routines" },                // NEW
  { entity: "training", tool: "migrate_training" },                // NEW
];
```

- [ ] **Step 2: Add test cases**

Append to `tests/tools/plan_migration.test.ts`:

```ts
it("includes Phase 5 operational entities in dependency order", async () => {
  const client = new BubbleClient(
    { bubbleAppUrl: "https://x", bubbleApiToken: "t" },
    vi.fn() as unknown as typeof fetch,
  );
  vi.spyOn(client, "listAll").mockImplementation(async (type: string) => {
    if (type === "workspace") return [{ _id: "ws1" }] as never;
    if (type === "shift_template") return [{ _id: "st1", workspace: "ws1" }] as never;
    if (type === "shift_satellite") return [{ _id: "s1", workspace: "ws1" }] as never;
    if (type === "task") return [{ _id: "t1", workspace: "ws1" }] as never;
    if (type === "routine") return [{ _id: "r1", workspace: "ws1" }] as never;
    if (type === "training") return [{ _id: "tr1", workspace: "ws1" }] as never;
    return [] as never;
  });

  const result = await planMigrationTool.execute(
    { workspaceId: "ws1" },
    { bubble: client, mappingsDir: "", vaultBubbleShapesDir: "", stagingDir: "", supabase: null },
  );

  const tools = result.steps.map((s) => s.tool);
  expect(tools).toEqual(
    expect.arrayContaining([
      "migrate_shift_templates",
      "migrate_shifts",
      "migrate_tasks",
      "migrate_routines",
      "migrate_training",
    ]),
  );
  // shift_templates must come before shifts
  expect(tools.indexOf("migrate_shift_templates")).toBeLessThan(tools.indexOf("migrate_shifts"));
});
```

- [ ] **Step 3: Run tests and commit**

```bash
pnpm test && pnpm typecheck
git add -A
git commit -m "feat(tools): extend plan_migration with Phase 5 operational entities"
```

---

## Task 8: Register Phase 5 tools in MCP server

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Add imports and tools array entries**

```ts
// new imports
import { migrateShiftTemplatesTool } from "./tools/migrate_shift_templates.js";
import { migrateShiftsTool } from "./tools/migrate_shifts.js";
import { migrateTasksTool } from "./tools/migrate_tasks.js";
import { migrateRoutinesTool } from "./tools/migrate_routines.js";
import { migrateTrainingTool } from "./tools/migrate_training.js";

// in tools array — add 5 new entries between Phase 4 and orchestration tools:
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
  migrateShiftTemplatesTool,    // NEW
  migrateShiftsTool,            // NEW
  migrateTasksTool,             // NEW
  migrateRoutinesTool,          // NEW
  migrateTrainingTool,          // NEW
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

Expected: 18 tools in the response.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(server): register Phase 5 operational migration tools"
```

---

## Task 9: Phase 5 smoke test docs

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Append to `README.md`**

```markdown

## Phase 5 smoke test — operational entities

Prerequisites:
- Phase 4 smoke test passed
- Reviewed mappings for: `shift_templates`, `shifts`, `tasks`, `routines`, `training`
- Test workspace with at least one record per entity
- Particular attention to `shifts.json` — known quirks must be encoded in `known_quirks` array

Procedure:
1. Research each entity: `research shift_templates`, `research shifts`, etc.
2. **For shifts:** review the narrative carefully — Bubble shifts are weird. The narrative will tell you which fields are sparse, which have emoji suffixes, which are missing on old records. Decide which are needed for v3 and mark needs_review: false only on those.
3. Update `mappings/shifts.json` `known_quirks` array with anything new revealed by research
4. Plan migration: "Plan migration for workspace <id>" — should now return all 11 steps
5. Execute each step. Pay special attention to `migrate_shifts` output — review the SQL file and the report
6. **Verify pre-transform worked:** check that pre-2024 shifts have a derived `ends_at` value (= starts_at + 8h)
7. Bundle: "Bundle migration for workspace <slug>"
8. Apply manually to local Supabase
9. Verify in Supabase: `SELECT count(*), date_trunc('year', starts_at) FROM shifts WHERE workspace_id = '<uuid>' GROUP BY 2 ORDER BY 2`
10. **Critical check:** any records skipped by the engine should be reported in the migration report. If skipped count is high (>5%), investigate before considering migration successful.
11. Record findings in `docs/superpowers/notes/phase-5-smoke-test.md`. Update `src/migration/custom/shifts.ts` if more quirks are discovered.

If shifts have surprises that the current preTransformShifts doesn't handle, **update the function and re-run the smoke test**. The escape hatch is meant to be iterated on.
```

- [ ] **Step 2: Final verification + commit**

```bash
pnpm typecheck && pnpm test && pnpm build
git add README.md
git commit -m "docs: add Phase 5 smoke test procedure"
```

---

## Phase 5 Exit Criteria

- [x] `preTransformShifts` implemented and tested with known Bubble quirks
- [x] `migrate_shift_templates`, `migrate_shifts`, `migrate_tasks`, `migrate_routines`, `migrate_training` all implemented and tested
- [x] `migrate_shifts` correctly applies the pre-transform before the engine runs
- [x] `plan_migration` includes all Phase 5 entities in dependency order (shift_templates before shifts)
- [x] All 18 tools registered in the MCP server
- [x] Full test suite passes, typecheck clean, build succeeds
- [x] Phase 5 smoke test executed against local Supabase with shift pre-transform verified

After Phase 5, an entire operational workspace can be migrated end-to-end — workspace, structure, identity, and all operational records. **strike-mcp is feature-complete for Tier 1 + Tier 2 from the design.** Phase 6 (manuals, inventory, supplements) is purely optional cleanup.
