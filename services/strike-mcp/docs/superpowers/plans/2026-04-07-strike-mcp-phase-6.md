# strike-mcp Phase 6 Implementation Plan — Remaining Entities

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add migration tools for the remaining nice-to-have entities — manuals, inventory, supplements. After this phase, strike-mcp is **feature-complete** and ready for the first real customer cutover.

**Architecture:** Purely additive. All three entities follow the simple `migrate_locations` pattern from Phase 3. No new patterns introduced. If Phase 2 research reveals any of these need custom transforms or multi-mapping, refactor following the patterns established in Phase 4 (multi-mapping) and Phase 5 (pre-transforms).

**Prerequisites:** Phase 5 merged on `main`. All 18 tools from Phases 1–5 working. Phase 5 smoke test passed.

**Important context:** These entities are nice-to-have. If Phase 2 research reveals their shapes are weird or their data is sparse/unused in production, they can be **dropped** rather than implemented. Pontus decides at smoke-test time whether to migrate them or leave them in Bubble for archive purposes.

---

## File Structure

```
strike-mcp/
├── src/
│   └── tools/
│       ├── migrate_manuals.ts                  # NEW
│       ├── migrate_inventory.ts                # NEW
│       ├── migrate_supplements.ts              # NEW
│       └── plan_migration.ts                   # MODIFY
└── tests/
    └── tools/
        ├── migrate_manuals.test.ts
        ├── migrate_inventory.test.ts
        └── migrate_supplements.test.ts
```

---

## Task 1: `migrate_manuals` tool

**Files:**
- Create: `src/tools/migrate_manuals.ts`
- Create: `tests/tools/migrate_manuals.test.ts`

**Pattern:** Same as `migrate_departments` from Phase 4. Order index `12`.

- [ ] **Step 1: Write the test**

Copy `tests/tools/migrate_departments.test.ts` to `tests/tools/migrate_manuals.test.ts`. Global replace:
- `departments → manuals`
- `department → manual`
- `Departments → Manuals`
- `03_departments → 12_manuals`
- `migrateDepartmentsTool → migrateManualsTool`
- `mkDepartmentsMapping → mkManualsMapping`

- [ ] **Step 2: Run test to verify failure**

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/tools/migrate_manuals.ts`**

Copy `src/tools/migrate_departments.ts` to `src/tools/migrate_manuals.ts`. Global replace:
- `migrateDepartmentsTool → migrateManualsTool`
- `migrate_departments → migrate_manuals`
- `"departments"` → `"manuals"` (loadMapping, getEntityByName, entity field, emit meta, report)
- `orderIndex: 3` → `orderIndex: 12`
- Description: "departments" → "manuals"

- [ ] **Step 4: Run tests and commit**

```bash
pnpm test && pnpm typecheck
git add -A
git commit -m "feat(tools): add migrate_manuals tool"
```

---

## Task 2: `migrate_inventory` tool

**Files:**
- Create: `src/tools/migrate_inventory.ts`
- Create: `tests/tools/migrate_inventory.test.ts`

**Pattern:** Same as `migrate_manuals`. Order index `13`. Bubble type from registry: `inventory_item`.

- [ ] **Step 1: Write the test**

Copy `tests/tools/migrate_manuals.test.ts` to `tests/tools/migrate_inventory.test.ts`. Global replace:
- `manuals → inventory`
- `manual → inventory_item` (in Bubble type only — keep `inventory` as the entity name)
- `Manuals → Inventory`
- `12_manuals → 13_inventory`
- `migrateManualsTool → migrateInventoryTool`
- `mkManualsMapping → mkInventoryMapping`

In the test, the mock `client.listAll` should match on `"inventory_item"` for the Bubble type.

- [ ] **Step 2: Run test to verify failure**

Expected: FAIL.

- [ ] **Step 3: Implement `src/tools/migrate_inventory.ts`**

Copy `src/tools/migrate_manuals.ts` to `src/tools/migrate_inventory.ts`. Global replace:
- `migrateManualsTool → migrateInventoryTool`
- `migrate_manuals → migrate_inventory`
- `"manuals"` → `"inventory"` (loadMapping, getEntityByName, entity field, emit meta, report)
- `orderIndex: 12` → `orderIndex: 13`
- Description: "manuals" → "inventory items"

The `getEntityByName("inventory")` lookup will return the registry entry with `bubbleType: "inventory_item"` automatically — no extra string changes needed.

- [ ] **Step 4: Run tests and commit**

```bash
pnpm test && pnpm typecheck
git add -A
git commit -m "feat(tools): add migrate_inventory tool"
```

---

## Task 3: `migrate_supplements` tool

**Files:**
- Create: `src/tools/migrate_supplements.ts`
- Create: `tests/tools/migrate_supplements.test.ts`

**Pattern:** Same as `migrate_manuals`. Order index `14`.

- [ ] **Step 1: Write the test**

Copy `tests/tools/migrate_manuals.test.ts` to `tests/tools/migrate_supplements.test.ts`. Global replace:
- `manuals → supplements`
- `manual → supplement`
- `Manuals → Supplements`
- `12_manuals → 14_supplements`
- `migrateManualsTool → migrateSupplementsTool`
- `mkManualsMapping → mkSupplementsMapping`

- [ ] **Step 2: Run test to verify failure**

Expected: FAIL.

- [ ] **Step 3: Implement `src/tools/migrate_supplements.ts`**

Copy `src/tools/migrate_manuals.ts` to `src/tools/migrate_supplements.ts`. Global replace:
- `migrateManualsTool → migrateSupplementsTool`
- `migrate_manuals → migrate_supplements`
- `"manuals"` → `"supplements"`
- `orderIndex: 12` → `orderIndex: 14`
- Description: "manuals" → "supplements"

- [ ] **Step 4: Run tests and commit**

```bash
pnpm test && pnpm typecheck
git add -A
git commit -m "feat(tools): add migrate_supplements tool"
```

---

## Task 4: Extend `plan_migration` with Phase 6 entities

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
  { entity: "shift_templates", tool: "migrate_shift_templates" },
  { entity: "shifts", tool: "migrate_shifts" },
  { entity: "tasks", tool: "migrate_tasks" },
  { entity: "routines", tool: "migrate_routines" },
  { entity: "training", tool: "migrate_training" },
  { entity: "manuals", tool: "migrate_manuals" },         // NEW
  { entity: "inventory", tool: "migrate_inventory" },     // NEW
  { entity: "supplements", tool: "migrate_supplements" }, // NEW
];
```

- [ ] **Step 2: Add test cases**

Append to `tests/tools/plan_migration.test.ts`:

```ts
it("includes Phase 6 nice-to-have entities", async () => {
  const client = new BubbleClient(
    { bubbleAppUrl: "https://x", bubbleApiToken: "t" },
    vi.fn() as unknown as typeof fetch,
  );
  vi.spyOn(client, "listAll").mockImplementation(async (type: string) => {
    if (type === "workspace") return [{ _id: "ws1" }] as never;
    if (type === "manual") return [{ _id: "m1", workspace: "ws1" }] as never;
    if (type === "inventory_item") return [{ _id: "i1", workspace: "ws1" }] as never;
    if (type === "supplement") return [{ _id: "s1", workspace: "ws1" }] as never;
    return [] as never;
  });

  const result = await planMigrationTool.execute(
    { workspaceId: "ws1" },
    { bubble: client, mappingsDir: "", vaultBubbleShapesDir: "", stagingDir: "", supabase: null },
  );

  const tools = result.steps.map((s) => s.tool);
  expect(tools).toEqual(
    expect.arrayContaining(["migrate_manuals", "migrate_inventory", "migrate_supplements"]),
  );
});
```

- [ ] **Step 3: Run tests and commit**

```bash
pnpm test && pnpm typecheck
git add -A
git commit -m "feat(tools): extend plan_migration with Phase 6 nice-to-have entities"
```

---

## Task 5: Register Phase 6 tools in MCP server

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Add imports and tools array entries**

```ts
// new imports
import { migrateManualsTool } from "./tools/migrate_manuals.js";
import { migrateInventoryTool } from "./tools/migrate_inventory.js";
import { migrateSupplementsTool } from "./tools/migrate_supplements.js";

// in tools array — add 3 new entries between Phase 5 migrators and orchestration tools:
const tools = [
  // ... all Phase 1-5 tools ...
  migrateTrainingTool,
  migrateManualsTool,        // NEW
  migrateInventoryTool,      // NEW
  migrateSupplementsTool,    // NEW
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

Expected response includes all **21 tools**.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(server): register Phase 6 nice-to-have migration tools — strike-mcp feature-complete"
```

---

## Task 6: Phase 6 smoke test docs + final feature-complete README update

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Append to `README.md`**

```markdown

## Phase 6 smoke test — nice-to-have entities

Prerequisites:
- Phase 5 smoke test passed
- Reviewed mappings for `manuals`, `inventory`, `supplements` (or decision to skip them)

Procedure:
1. Research each entity: `research manuals`, `research inventory`, `research supplements`
2. **Decision point:** for each entity, decide based on research output:
   - If the data is rich and useful in v3 → set up the mapping and migrate
   - If the data is sparse, unused, or weird → skip this entity, leave the data in Bubble for archive
3. For entities you decide to migrate: review mappings, set `target_table`, resolve `needs_review: true`
4. For entities you decide to skip: do not create mappings — `plan_migration` will simply not include them
5. Plan migration, execute steps, bundle, preview, apply
6. Record skip/migrate decisions in `docs/superpowers/notes/phase-6-smoke-test.md`

## strike-mcp is feature-complete

After Phase 6, strike-mcp can migrate any Smartout Bubble workspace to v3 Supabase end-to-end:

- 21 MCP tools (3 discovery, 1 research, 14 migration, 4 orchestration)
- Full safety chain (no Supabase writes, staging directory, BEGIN/COMMIT, verify_target_empty, deterministic UUIDs)
- Custom transform escape hatch for messy entities
- Multi-mapping pattern for entities that span multiple v3 tables
- Idempotent research that flags new fields with needs_review

To migrate a customer workspace:

1. `research_entity` for any entity that hasn't been characterized yet
2. Review and approve mappings
3. `plan_migration` to see the full step list
4. Execute each `migrate_*` step
5. `bundle_migration` to combine into one file
6. `preview_sql` to verify
7. Apply manually with psql against the target Supabase
```

- [ ] **Step 2: Final verification**

```bash
pnpm typecheck && pnpm test && pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add Phase 6 smoke test + feature-complete summary"
```

---

## Phase 6 Exit Criteria

- [x] `migrate_manuals`, `migrate_inventory`, `migrate_supplements` all implemented and tested (or explicitly skipped per research)
- [x] `plan_migration` includes all Phase 6 entities
- [x] All 21 tools registered in the MCP server
- [x] Full test suite passes, typecheck clean, build succeeds
- [x] README updated with feature-complete summary

---

## After Phase 6

**strike-mcp is done.** The migration tooling is feature-complete and ready for production use.

**Next steps for the project (out of scope for strike-mcp itself):**

1. **First customer migration** — pick a low-risk customer, run the full pipeline against their workspace, verify results, do the cutover
2. **Iterate on quirks** — every customer migration may reveal new shape issues. Update `mappings/*.json` and `src/migration/custom/<entity>.ts` as needed
3. **Document the cutover playbook** in `smartout.ai/docs/cutover-playbook.md` — the operational steps Pontus or a teammate runs for each customer (run strike-mcp, review SQL, schedule downtime, apply, verify, switch DNS, etc.)
4. **Write the strike-mcp ADR** in `smartout.ai/docs/decisions/` documenting the build decision and pointing at this plan series

strike-mcp itself can be archived to maintenance mode after the last Bubble customer is migrated.
