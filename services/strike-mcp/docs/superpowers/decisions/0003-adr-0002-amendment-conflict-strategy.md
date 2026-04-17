---
title: "ADR-0003: Amendment to ADR-0002 — explicit conflict strategy per entity"
status: accepted
created: 2026-04-15
updated: 2026-04-15
module: strike-mcp
tags: [decision, amendment, conflict-strategy, cutover]
---

# ADR-0003: Amendment to ADR-0002 — explicit conflict strategy per entity

## Status

Accepted 2026-04-15 as follow-up to 2026-04-15 council verdict on Wrightegaarden Tier 1.

## Context

ADR-0002 (incremental migration via watermark + ON CONFLICT DO NOTHING) has an internal contradiction that the council surfaced:

- It declares "identity entities fail loudly on duplicate" — which requires an error path.
- It also declares `INSERT ... ON CONFLICT (id) DO NOTHING` for append-heavy entities — which silently skips.
- The boundary between "fails loudly" and "silently skips" is drawn along entity class, but the SQL emission strategy only supports one behavior per statement. A re-run of the full bundled migration would hit BOTH classes, and the current wording lets a silent skip on append-heavy mask a real conflict on identity when the two are in the same transaction.

The council additionally required that conflict strategy be **explicit per entity**, not inferred from class membership, because:

- Some "identity" entities (e.g., `location`, `department`) may legitimately receive renames post-cutover and should be allowed to update mutable fields.
- Some "append-heavy" entities (e.g., `🗓️record` mapped to `timesheet.time_entry`) have complex aggregation transforms that cannot be idempotent at the SQL level.
- `ON CONFLICT DO NOTHING` silently swallows real data-integrity bugs (wrong deterministic UUID, duplicated source row, missing FK) during re-run, making debugging impossible.

## Decision

### 1. Conflict strategy is declared per entity in the registry

Extend `EntityEntry` with an explicit `conflictStrategy`:

```typescript
type ConflictStrategy =
  | "fail_loud"              // identity/structure: plain INSERT, any duplicate is an error
  | "append_if_new"           // append-heavy: ON CONFLICT (id) DO NOTHING, safe re-run
  | "update_mutable"          // allowlist of columns gets UPDATE; rest fail loud
  | "manual_only";            // strike-mcp refuses to emit; requires human-written migration
```

Each entity declares its strategy inline. Example:

```typescript
{ name: "locations", bubbleType: "location", workspaceFieldKey: "🏰 Workspace", conflictStrategy: "fail_loud", ... }
{ name: "records",   bubbleType: "🗓️record", workspaceFieldKey: "🏰 lookup", conflictStrategy: "manual_only", ... }
{ name: "shifts",    bubbleType: "shift",     workspaceFieldKey: "workspace", conflictStrategy: "append_if_new", ... }
```

### 2. SQL emitter uses the strategy literally

- `fail_loud` → `INSERT INTO <table> (...) VALUES (...);`
- `append_if_new` → `INSERT INTO <table> (...) VALUES (...) ON CONFLICT (<pk>) DO NOTHING;`
- `update_mutable` → `INSERT INTO <table> (...) VALUES (...) ON CONFLICT (<pk>) DO UPDATE SET <allowlisted_columns> = EXCLUDED.<allowlisted_columns>;`
- `manual_only` → emitter writes a `.md` stub explaining why and aborts that entity. No SQL file produced.

The allowlist for `update_mutable` is declared alongside the strategy:

```typescript
{
  name: "teams",
  ...,
  conflictStrategy: "update_mutable",
  mutableColumns: ["name", "color", "updated_at"],
}
```

### 3. Strategy is enforced at mapping-review time

`review_mapping.ts` refuses to commit a mapping whose `target_table` does not have a resolved strategy. The decision log captures the chosen strategy as metadata on the `mapping_committed` entry.

### 4. `manual_only` is the default for polymorphic or aggregating transforms

Entities that require aggregation (e.g., 🗓️record → timesheet.time_entry where breaks nest inside workTime rows) cannot be safely re-run via `ON CONFLICT`. The safe default is to refuse automated SQL emission and require a human-written migration. This guards against the auto-align rubber-stamp risk identified by Supervisor P0-#3.

### 5. Initial strategy assignment for Tier 1

| Entity | Strategy | Notes |
|---|---|---|
| workspace | fail_loud | one-shot at cutover |
| company | fail_loud | |
| locations | fail_loud | renames in Bubble post-cutover flagged to admin |
| departments | fail_loud | |
| teams | update_mutable(name, color, updated_at) | teams can be renamed mid-cutover |
| users | fail_loud | identity is tenant-critical |
| profiles | fail_loud | |
| employment_profiles | manual_only | merged with employment_contracts during transform |
| employment_contracts | manual_only | depends on ADR-0082 stub-shell decision |
| employee_types | fail_loud | reference data |
| invitations | fail_loud | pending only, no delta mode |
| shifts | append_if_new | watermark-driven re-runs |
| shift_satellites | append_if_new | folded into shifts during transform |
| swaprecords | append_if_new | pending only |
| records | manual_only | 🗓️record → timesheet.time_entry requires aggregation |

### 6. Removal of ADR-0002's class-based wording

The phrasing "identity entities fail loudly; append-heavy use ON CONFLICT DO NOTHING" is withdrawn. Replace with "each entity declares its own conflict strategy in the registry. The strategy is the single source of truth."

## Consequences

- SQL output is more diverse (four patterns instead of two) but each is explicit and auditable
- `manual_only` creates visible friction that forces the human to write aggregation transforms deliberately, instead of letting strike-mcp fake them
- `update_mutable` with allowlist is safe because non-allowlisted columns still fail loud — a schema change elsewhere cannot silently flow through
- Registry becomes the single source of truth for both schema targeting AND conflict behavior — consistent with "explicit-per-type" philosophy from Q7 resolution
- Pre-flight check can refuse a migration if any mapping's strategy is unresolved or mismatched against target table's schema

## Related

- ADR-0002: Incremental migration via watermark (now amended — see point 6 above)
- Council verdict 2026-04-15: Wrightegaarden Tier 1 migration (section 4 P0-#8)
- Prior council 2026-03-26: Migration Ordering & Idempotency (CREATE TABLE IF NOT EXISTS FK-CASCADE trap)
- ADR-0082 (smartout.ai, pending): migrated profile contract shell — determines whether `employment_contracts` strategy stays `manual_only` or becomes `fail_loud`
