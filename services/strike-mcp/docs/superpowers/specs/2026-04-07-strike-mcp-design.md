---
title: "strike-mcp — Bubble → Smartout v3 workspace migrator MCP"
status: draft
created: 2026-04-07
updated: 2026-04-07
module: strike-mcp
tags: [migration, bubble, supabase, mcp, smartout-v3]
---

# strike-mcp — Bubble → Smartout v3 workspace migrator MCP

## Purpose

A specialized MCP server that migrates a single Bubble.io workspace into Smartout v3 (Next.js + Supabase), one entity at a time, under agent control, with zero blast radius.

The agent (Claude Code) drives the MCP stepwise: research, extract, transform, emit. The MCP never writes to Supabase directly. Its only output is reviewable `.sql` migration files + markdown reports, written to a staging directory.

**Theatre metaphor:** "Strike" is the theatre term for dismantling a set after the show closes, keeping what can be reused on the next stage. That is exactly what this tool does: take down the Bubble set, carry the essentials over to the v3 stage, leave the rest behind.

## Context

- Smartout v2 runs on Bubble.io with live customers. ADR-0015 decided on a full rebuild (not a schema migration) to v3 on Next.js + Supabase.
- ADR-0015 explicitly deferred data migration: _"Data migration plan needed before cutover (separate future ADR)."_ This spec is the precursor to that ADR.
- v3 schema already exists in `smartout.ai/supabase/migrations/` — identity, structure, governance, onboarding, employee invitations, platform admin tables.
- Existing `bubble-mcp` + `salary-mcp` servers expose generic CRUD and payroll validation against Bubble. They stay — strike-mcp is specialised, not a replacement.
- The `bubble-salary-mcp` skill documents hard-won lessons about Bubble Data API's quirks: sparse records, display-names vs field-IDs, emoji suffixes, no server-side filtering. strike-mcp inherits all of that wisdom.

## Goals

1. Migrate one Bubble workspace to v3 Supabase, end-to-end, with agent-driven stepwise control.
2. Capture minimum necessary data — not everything. Tune the extraction to what v3 actually needs.
3. Research-driven: every Bubble entity shape is investigated once, thoroughly, and the findings persist as the blueprint for every future workspace migration.
4. Idempotent and repeatable — we migrate workspaces one at a time as customers cut over. Re-running research should never break existing mappings.
5. Safe by construction: architecturally incapable of damaging Supabase data, even if the code has bugs.

## Non-Goals

- Not a web service, not a CLI, not a library. It is an MCP server consumed by an AI agent.
- Not a Supabase writer. Zero DML executed against Supabase by strike-mcp itself.
- Not a replacement for `bubble-mcp` or `salary-mcp`.
- Not a delta-sync tool for ongoing parallel operation — each workspace migrates in one pass at cutover time.
- Not a UI / no dashboard. The agent is the interface.

## Architecture Overview

strike-mcp is a standalone TypeScript MCP server at `~/dev/strike-mcp/`. It runs locally, is launched by Claude Code as an MCP server, and exposes tools in four categories.

```
┌────────────────────────────────────────────────────────┐
│                     Agent (Claude)                     │
└───────┬────────────────────────────────────────────────┘
        │ MCP tool calls
        ▼
┌────────────────────────────────────────────────────────┐
│                     strike-mcp                         │
│                                                        │
│   ┌──────────────┐   ┌──────────────┐  ┌───────────┐   │
│   │  Discovery   │   │  Migration   │  │ Orchestr. │   │
│   │  tools       │   │  tools (per  │  │ tools     │   │
│   │              │   │  entity)     │  │           │   │
│   └──────┬───────┘   └──────┬───────┘  └─────┬─────┘   │
│          │                  │                │         │
│          └──────────────────┴────────────────┘         │
│                             │                          │
│   ┌──────────────┐   ┌──────▼────────┐  ┌──────────┐   │
│   │   Bubble     │   │    Engine     │  │  Safety  │   │
│   │   Data API   │◄──┤  (config +    │  │   tools  │   │
│   │   client     │   │   transforms) │  │          │   │
│   └──────────────┘   └──────┬────────┘  └──────────┘   │
│                             │                          │
│                    ┌────────▼────────┐                 │
│                    │  mappings/*.json │                │
│                    │  transforms/*.ts │                │
│                    └─────────────────┘                 │
└─────────────┬────────────────────────┬─────────────────┘
              │                        │
              ▼                        ▼
   ┌────────────────────┐   ┌──────────────────────────┐
   │  smartout.ai/      │   │  second-brain-v2/        │
   │  supabase/         │   │  wiki/migration/         │
   │  migration-staging/│   │  bubble-shapes/          │
   │  <workspace-slug>/ │   │  <entity>.md             │
   │    *.sql + *.md    │   │  (research narratives)   │
   └────────────────────┘   └──────────────────────────┘
```

Data flow for a single entity migration:

```
research_entity("shifts")
    → sample Bubble records (first 50 + last 50, per sparse-record rule)
    → diff against mappings/shifts.json
    → update mappings/shifts.json.proposed + wiki narrative
    → mark needs_review: true on new fields
    → report to agent: "review before migrate_shifts can run"

migrate_shifts(workspace_id)
    → load mappings/shifts.json (must have no needs_review: true fields)
    → load transforms/shifts.ts if present (custom logic)
    → fetch all shift records belonging to workspace
    → transform to v3 schema
    → emit migration-staging/<workspace-slug>/04_shifts.sql
    → emit migration-staging/<workspace-slug>/04_shifts.report.md
    → return summary to agent
```

## Components

### 1. Bubble Data API client

Own implementation. Does not depend on `bubble-mcp` or `salary-mcp` runtime. Inherits their lessons:

- Handles sparse records (different records return different key sets)
- Translates display-name keys ↔ field IDs via schema lookup
- Paginates fully, both directions (first N + last N sampling)
- No assumption that server-side filtering works reliably

### 2. Config-driven engine (the 80%)

For straightforward entities, migration is described entirely in `mappings/<entity>.json`:

```json
{
  "bubble_type": "shift_satellite",
  "target_table": "shifts",
  "field_map": {
    "workspace": {
      "target": "workspace_id",
      "transform": "fk_uuid:workspaces"
    },
    "date.start 🟢": {
      "target": "starts_at",
      "transform": "bubble_date_to_tstz"
    },
    "Titel": {
      "target": "title",
      "transform": "trim"
    }
  },
  "required_source_fields": ["workspace", "date.start 🟢"],
  "skip_if_missing": ["Titel"],
  "known_quirks": [
    "pre-2024 records missing date.end — default to start + 8h"
  ],
  "last_verified": "2026-04-07",
  "sample_record_count": 500
}
```

Built-in transforms:

- `trim`, `lowercase`, `uppercase`
- `bubble_date_to_tstz` (Bubble ISO → PostgreSQL timestamptz)
- `fk_uuid:<entity>` (deterministic UUID from Bubble ID — see FK Strategy below)
- `enum_map:<mapping_name>` (discrete value translation)
- `nullable`, `default:<value>`

### FK Strategy — deterministic UUIDs

Each `migrate_<entity>` tool runs independently and emits its own SQL file. The SQL inserts do not execute between tool calls — they only execute later, in a single transaction, when the bundled migration is applied manually. This means runtime FK resolution ("look up the UUID workspaces got") is impossible.

Instead, strike-mcp assigns v3 UUIDs deterministically from Bubble IDs at SQL generation time, using UUIDv5:

```
v3_uuid = uuid5(STRIKE_NAMESPACE_UUID, `${entity}:${bubble_id}`)
```

Benefits:

- Any entity's SQL can be generated independently of others.
- FK references are computed, not looked up — `fk_uuid:workspaces` is a pure function.
- Re-running research or re-generating a SQL file produces byte-identical output.
- If a workspace is accidentally re-migrated with the same Bubble source, the deterministic UUIDs will collide with the existing rows, triggering unique-constraint violations — a second safety net on top of `verify_target_empty`.

`STRIKE_NAMESPACE_UUID` is a constant defined in the MCP package, not configurable. Changing it would break all existing migrations.

### 3. Custom transforms (the 20%)

When config isn't enough, `transforms/<entity>.ts` exports a function:

```typescript
export async function transform(
  records: BubbleRecord[],
  ctx: MigrationContext
): Promise<V3Row[]> {
  // custom logic for messy entities
  // ctx provides: fk_lookup(), logger, workspace_id, mappings
}
```

Engine prefers `transforms/<entity>.ts` over `mappings/<entity>.json` when both exist. Shifts, training, rules are expected to need custom transforms.

### 4. Research subsystem

`research_entity(entity)`:

1. Loads existing `mappings/<entity>.json` if present.
2. Fetches Bubble schema for the type.
3. Samples records: first 50 + last 50 (anti-sparse-trap).
4. Diffs: new fields? New shapes? Emoji-suffix changes?
5. If no changes → report "no changes" and return.
6. If changes → writes `mappings/<entity>.json.proposed` and updates the narrative in second-brain vault at `wiki/migration/bubble-shapes/<entity>.md`.
7. Marks all unconfirmed mappings as `needs_review: true`.
8. Reports findings to agent for human-in-the-loop confirmation.

First-time research generates a guessed mapping (based on name similarity with v3 schema), but every guessed field is marked `needs_review: true`. A migrate-tool refuses to run against an entity whose mapping has any `needs_review: true` fields.

### 5. Research storage — two sources, two purposes

**Machine-readable** (in strike-mcp repo, versioned with code):

```
strike-mcp/
  mappings/
    workspace.json
    locations.json
    departments.json
    users.json
    shifts.json
    ...
  transforms/
    shifts.ts
    training.ts
    ...
```

**Human-readable narratives** (in second-brain vault):

```
second-brain-v2/wiki/migration/bubble-shapes/
  shifts.md       # the story: "why did we map X to Y?"
  users.md
  tasks.md
  ...
```

JSON is what the engine executes. Markdown is what we read six months from now when we need to understand a decision.

### 6. Tool surface

**A. Discovery**

| Tool | Purpose |
|---|---|
| `list_workspaces()` | List all workspaces in the Bubble instance. Returns `[{id, name, created_at, record_counts_summary}]`. |
| `inspect_workspace(id)` | Count records per entity type belonging to the workspace. Returns a scope overview. |
| `research_entity(entity)` | Sample + diff + update mappings + update vault narrative. Idempotent. |

**B. Migration** (one tool per entity, same signature)

```
migrate_<entity>(workspace_id, output_dir)
  → { sql_file, report_file, records_processed, skipped, warnings }
```

Entities in dependency order:

1. `migrate_workspace`
2. `migrate_locations`
3. `migrate_departments`
4. `migrate_teams`
5. `migrate_users` (+ profiles + memberships)
6. `migrate_roles_and_rules`
7. `migrate_shift_templates`
8. `migrate_shifts`
9. `migrate_tasks`
10. `migrate_routines`
11. `migrate_manuals`
12. `migrate_training`
13. `migrate_inventory`
14. `migrate_supplements`

**C. Orchestration**

| Tool | Purpose |
|---|---|
| `plan_migration(workspace_id)` | Returns a recommended migration order based on FK deps and entities actually present in the workspace. Read-only. |
| `bundle_migration(workspace_id)` | Combines all generated `.sql` files into one atomic migration file in correct order. This is the artifact Pontus reviews and applies manually. |

**D. Safety**

| Tool | Purpose |
|---|---|
| `verify_target_empty(workspace_slug)` | Read-only query against v3 Supabase verifying the target workspace has no pre-existing data. **The only tool that talks to Supabase. Read-only.** |
| `preview_sql(file_path)` | Parse a generated SQL file and return a summary (INSERT counts per table, warnings). |

**Deliberately absent:** there is no `migrate_all` tool. Stepwise control is enforced by the shape of the tool surface.

## Safety Model

Six overlapping layers. Each layer alone would prevent damage. Together, damage is architecturally near-impossible.

### Layer 1 — No Supabase write capability exists

strike-mcp has no `SUPABASE_SERVICE_ROLE_KEY`, no writable `supabase-js` client, no postgres connection string with DML privileges. It has:

- `SUPABASE_ANON_KEY` or a read-only PAT, used _only_ by `verify_target_empty`
- Filesystem write access to the staging output directory

A bug cannot write to Supabase because the credentials simply are not present.

### Layer 2 — Dry-run is the only mode

There is no code branch where a `dry_run=false` flag does something different. The MCP only produces files. The `dry_run` parameter is dropped entirely to avoid any implication that a "wet run" exists.

### Layer 3 — Output goes to a staging directory Supabase CLI ignores

Files are written to `smartout.ai/supabase/migration-staging/<workspace-slug>/`, not `supabase/migrations/`. Supabase CLI does not auto-apply from the staging directory. Applying the migration is a deliberate manual act: copy the file to `supabase/migrations/`, review, run `pnpm supabase db push`.

This is intentional friction. An accidental `db push` cannot execute a staged migration.

### Layer 4 — `verify_target_empty` gate

`bundle_migration` calls `verify_target_empty` automatically. If the target workspace already has data in `workspaces`, `locations`, `users`, etc., bundling fails with a warning. Override requires an explicit `--acknowledge-target-has-data` flag passed by the agent, which is a ceremony meant to wake Pontus up.

### Layer 5 — Transactional SQL

Every generated `.sql` file is wrapped:

```sql
BEGIN;
-- strike-mcp generated migration
-- workspace: Strøm Mat & Bar (ID: 1708123456x123456789)
-- generated: 2026-04-07T19:45:00Z
-- entities: workspace, locations(3), users(47), shifts(12843)
-- source bubble type revisions: shift_satellite@2026-04-01
-- REVIEW BEFORE APPLYING

-- ... inserts ...

COMMIT;
```

A mid-migration failure rolls back cleanly. No half-migrated workspaces.

### Layer 6 — Insert-only

strike-mcp generates `INSERT` statements only. Never `DELETE`, never `UPDATE`. A re-migration requires manually clearing the target workspace in Supabase (outside strike-mcp's scope), then running insert again.

## Entity Scope

Initial supported entities (Tier 1 + Tier 2):

- **Identity & structure:** workspace, locations, departments, teams, users, profiles, memberships, roles, rules
- **Operational:** shift templates, shifts, tasks, routines, training

Deferred / nice-to-have (Tier 3, handled in Phase 6):

- manuals, inventory, supplements

Explicitly out of scope (stay in Bubble for archive):

- historical payroll runs
- old contracts / DocuSign artifacts
- audit trails / activity logs from Bubble

## Delivery Sequence

Six phases. Each ends with a working, testable slice.

### Phase 1 — Skeleton + Bubble client

- Set up `~/dev/strike-mcp/` as a pnpm package with TypeScript + MCP SDK
- Implement Bubble Data API client (inheriting bubble-salary-mcp skill lessons)
- Implement `list_workspaces` and `inspect_workspace`
- Smoke test: list workspaces from Claude Code

**Exit criterion:** agent can list all workspaces in the Smartout Bubble instance via the MCP.

### Phase 2 — Research engine

- Implement `research_entity`
- Sampling logic (first 50 + last 50)
- Diff + `needs_review: true` logic
- `mappings/` directory format
- Narrative writing into second-brain vault
- Test against `workspace` and `locations` (the simplest entities)

**Exit criterion:** research for two simple entities exists in both `mappings/*.json` and `wiki/migration/bubble-shapes/*.md`.

### Phase 3 — Engine + first migrator + full safety chain

- Build config-driven engine
- Implement `migrate_workspace` and `migrate_locations`
- Implement staging directory output, BEGIN/COMMIT wrapping, header comments
- Implement `verify_target_empty`, `bundle_migration`, `preview_sql`
- End-to-end test: full migration of workspace + locations to a local Supabase instance, verify data lands correctly

**Exit criterion:** the full pipeline is proven for two entities. Everything after this is adding entities to a working system.

### Phase 4 — Identity entities (config-driven)

In order:
- `migrate_departments`
- `migrate_teams`
- `migrate_users` + profiles + memberships (first entity with non-trivial FK resolution)
- `migrate_roles_and_rules`

Each entity: `research_entity` → review → `migrate_<entity>` → test.

**Exit criterion:** full identity + structure skeleton of a workspace can be migrated. No operational data yet.

### Phase 5 — Operational entities (custom transforms)

- `migrate_shift_templates` + `migrate_shifts` (custom transform in `transforms/shifts.ts`)
- `migrate_tasks`
- `migrate_routines`
- `migrate_training`

This is where surprises live. Budget for it: do thorough research first, then transforms become mechanical.

**Exit criterion:** an operational workspace can be migrated end-to-end. Feature-complete for Tier 1 + Tier 2.

### Phase 6 — Remaining entities (optional)

- `migrate_manuals`
- `migrate_inventory`
- `migrate_supplements`

May be dropped or minimal depending on what research reveals.

**Exit criterion:** strike-mcp feature-complete. Ready for first customer cutover.

### First deliverable milestone

Phases 1–3 form the first deliverable. After Phase 3 the risk is resolved: architecture is proven, safety model is live, two entities work end-to-end. Phases 4–6 are purely additive.

## Testing Strategy

- **Unit tests** for the engine's built-in transforms (`bubble_date_to_tstz`, `fk_lookup`, enum maps, etc.)
- **Fixture-based tests** for migration tools: a snapshot of sample Bubble records → expected SQL output, diff against a committed expected file
- **Integration test** per phase against a local Supabase instance: run the generated SQL, verify row counts and FK integrity, tear down
- **Research replay test:** feed `research_entity` a known schema snapshot, assert the generated mapping matches an expected shape

The research subsystem itself is the slowest thing to test because it reads live from Bubble. For that, we'll capture fixture snapshots of Bubble schema + sample records per entity and use them as the source of truth for CI.

## Open Questions

These are deliberately left open for implementation time, not for brainstorming:

1. **Workspace-slug derivation:** how do we generate a stable `workspace_slug` that survives across migrations and handles collisions between two workspaces with similar names? Bubble names may contain Norwegian characters and spaces. Proposal: slugify + include Bubble ID suffix for uniqueness. Decided during Phase 3.
2. **Credential sourcing:** Bubble API token from 1Password via `op://`. Exact path decided during Phase 1.
3. **v3 schema drift mid-campaign:** if the v3 schema changes between Phase 3 and a later migration run, `bundle_migration` should validate that target tables still exist and have the expected columns before emitting SQL. Exact validation strategy decided during Phase 3.

## Related Documents

- `smartout.ai/docs/decisions/0015-bubble-rebuild-strategy.md` — ADR establishing the rebuild-not-migrate strategy
- `~/.claude/skills/bubble-salary-mcp/SKILL.md` — hard-won lessons about the Bubble Data API
- Future: an ADR in `smartout.ai/docs/decisions/` documenting the choice to build strike-mcp as the cutover tool (written once strike-mcp reaches Phase 3)
- Future: `HANDOFF-strike-mcp.md` at feature closure
