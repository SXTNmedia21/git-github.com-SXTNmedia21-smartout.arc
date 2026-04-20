---
title: "ADR-0002: Incremental migration via watermark + ON CONFLICT"
status: accepted
created: 2026-04-15
updated: 2026-04-15
module: strike-mcp
tags: [decision, incremental, watermark, cutover]
---

# ADR-0002: Incremental migration via watermark + ON CONFLICT

## Status

Accepted 2026-04-15. Driven by Wrightegaarden Tier 1 plan
(`docs/superpowers/plans/2026-04-15-wrightegaarden-tier1-migration.md`).

## Context

Customers run on Bubble and v3 in parallel for days or weeks between initial
migration and final cutover. New shifts, time records (`🗓️record`), and
swap requests (`⏱️swaprecord`) accumulate in Bubble during that window.
Those rows must land in v3 without duplicating or disturbing previously
migrated data.

The original strike-mcp design assumes a one-shot migration: every
`migrate_<entity>` tool pulls everything and emits `INSERT` statements
wrapped in one transaction. That model breaks for a customer who stays live
in Bubble for a week past their initial migration — re-running the tool
would collide on deterministic UUIDv5 primary keys and fail.

Two forces:

1. **Append-heavy entities grow in Bubble after migration.** Shifts, time
   records, swaps. These MUST be re-syncable.
2. **Identity and structure entities should NOT change after migration.**
   If a customer creates a new location or department in Bubble after
   cutover has started, that is an operational smell — they are supposed
   to stop using Bubble. We want those collisions to fail loudly, not be
   silently papered over.

## Decision

Incremental migration is supported for a specific subset of Tier 1
entities, using two mechanisms in combination:

1. **Watermark tracking** — each entity's max `Modified Date` is persisted
   to `supabase/migration-staging/<slug>/watermark.json` after every
   migration run. Subsequent runs pass `--since=<iso>` which adds
   `Modified Date >= <iso>` as a Bubble constraint.
2. **`INSERT ... ON CONFLICT (id) DO NOTHING`** for append-heavy entities,
   so re-runs are idempotent even if the watermark overlaps (records
   modified in both the original and delta run will be skipped rather
   than erroring). Deterministic UUIDv5 guarantees stable keys, so
   conflicts land on the correct row.

### Scope — which entities use delta mode

Append-heavy (delta supported, ON CONFLICT DO NOTHING):

- `shift` + `shift_satellite`
- `🗓️record` (workTime/break/meal)
- `⏱️swaprecord`

Identity and structure (delta NOT supported, plain INSERT that fails on
duplicate):

- `workspace`, `🏰company`, `location`, `🏠department`, `🎎team`
- `user`, `profile`, `⏱️employment_profile`, `⏱️employment_contract`,
  `⏱️employee_type`
- `🎎invitation`

Rationale for the asymmetry: a duplicate insert on `workspace` or
`location` during a delta run means something is wrong — the customer
created a new location in Bubble after cutover began, or the tool was
re-run over the same state without intent. Either way, loud failure is
the correct response. Append-heavy entities by definition accumulate
post-cutover; silent skip is the right answer there.

### Watermark file format

```json
{
  "workspace_slug": "wrightegaarden",
  "workspace_id": "1683059156689x546199168715701950",
  "bubble_schema_hash": "abc123...",
  "last_run_at": "2026-04-15T18:00:00.000Z",
  "entities": {
    "shifts": { "max_modified_date": "2026-04-15T17:45:12.000Z", "records_emitted": 4821 },
    "shift_satellites": { "max_modified_date": "2026-04-15T17:45:12.000Z", "records_emitted": 4821 },
    "records": { "max_modified_date": "2026-04-15T17:58:03.000Z", "records_emitted": 5434 },
    "swaprecords": { "max_modified_date": "2026-04-15T17:12:00.000Z", "records_emitted": 12 }
  }
}
```

One file per workspace, tracked in strike-mcp's staging output.
Not checked into git.

### CLI surface

```bash
# Initial run — no since, all rows
pnpm tsx scripts/migrate_entity.ts --entity=shifts --workspace=<id>

# Delta run — from watermark
pnpm tsx scripts/migrate_entity.ts --entity=shifts --workspace=<id> --since=2026-04-15T17:45:12.000Z

# Auto-watermark — reads watermark.json, uses max_modified_date as --since
pnpm tsx scripts/migrate_entity.ts --entity=shifts --workspace=<id> --delta
```

`--delta` is the common path for post-cutover runs. It refuses if
`watermark.json` is missing (forcing an initial run first).

### SQL emission changes

Append-heavy entities emit:

```sql
INSERT INTO schedule_shift (id, workspace_id, ...)
VALUES (...)
ON CONFLICT (id) DO NOTHING;
```

Identity entities continue to emit plain:

```sql
INSERT INTO location (id, workspace_id, ...)
VALUES (...);
```

No change to transactional wrapping (`BEGIN; ... COMMIT;` remains) or
staging directory policy. Safety model layers 1-6 from the original spec
are unchanged.

### Decision log

Every delta run emits an entry to `history/decisions.jsonl`:

```json
{
  "scope": "workspace_migration",
  "workspace": "wrightegaarden",
  "entity": "shifts",
  "action": "mapping_committed",
  "by": "pontus",
  "metadata": {
    "mode": "delta",
    "since": "2026-04-15T17:45:12.000Z",
    "records_emitted": 42,
    "watermark_before": "2026-04-15T17:45:12.000Z",
    "watermark_after": "2026-04-15T18:12:05.000Z"
  }
}
```

This lets us audit every incremental run and reconstruct the full history
of what landed in v3 per workspace.

## Consequences

- Customers can stay live in Bubble during cutover without losing data
- strike-mcp remains dry-run only; the ON CONFLICT clause is a SQL-side
  guarantee, not a runtime check
- Watermark files are per-workspace, per-strike-mcp-installation — if the
  ops machine changes between runs, watermark must be copied over
- Identity changes in Bubble post-cutover now fail loudly in the delta
  run. This is a feature, not a bug — it forces the operational
  conversation ("you created a location in Bubble after we migrated, stop
  doing that")
- `🗓️record` has 5434+ rows in Wrightegaarden alone; delta mode is
  practically required for any realistic cutover pattern

## Related

- Plan: `docs/superpowers/plans/2026-04-15-wrightegaarden-tier1-migration.md`
- Original spec: `docs/superpowers/specs/2026-04-07-strike-mcp-design.md`
  (safety model layers 1-6 still apply)
- ADR-0001: Phase 3.5b auto-align (establishes approval_hash pattern
  reused by mapping_committed entries)
