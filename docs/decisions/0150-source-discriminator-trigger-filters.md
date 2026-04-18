---
title: "Source Discriminator Pattern + Trigger Filters for Migration Provenance"
id: ADR-0150
status: accepted
layer: decision
created: 2026-04-15
updated: 2026-04-18
---

# ADR-0150: Source Discriminator Pattern + Trigger Filters for Migration Provenance

## Context and Problem Statement

Data entering v3 has three legitimate origins: operational writes from the
running application (`operational`), bulk historical imports via strike-mcp
(`bubble_migration`), and derived writes from v3's own cascade engine
(`v3_engine`). Without a uniform discriminator across migration-targeted
tables, queries cannot filter by origin, and triggers that fire on INSERT
cannot distinguish "real event" from "historical backfill". The result
(without this ADR) is phantom protocol assignments, ghost channels, and
real push notifications about 2020 Bubble shifts (see ADR-0149 Clause A
for the full list).

This ADR establishes the `source` column pattern, the enumeration of
affected triggers, and the filter mechanism.

## Decision Drivers

- **ADR-0149** declares the telemetry boundary; this ADR enforces it at
  the trigger layer.
- **Cascade invariant #8** — provenance on all outputs.
- **Council 2026-04-15 code-trace** identified 5 blocker triggers that fire
  unconditionally on INSERT. Filters must be enumerated, not applied by
  pattern-matching.
- **Steward verdict:** whitelist semantics (`source = 'operational'`) are
  more extensible than blacklist (`source != 'bubble_migration'`) for
  future discriminator values.
- **Supervisor verdict:** no partitioning or dense-column ADR precedent
  exists — CHECK constraint over ENUM avoids the enum-sprawl trap in
  CLAUDE.md.

## Considered Options

1. **Open `source text` column (no constraint)** — maximum flexibility,
   zero referential integrity. Rejected: typos fragment the value space
   (`'op'`, `'bubble'`, `'migration'` all become real values).
2. **`source` ENUM type** — referential integrity, but ALTER TYPE ADD VALUE
   cannot be used in the same tx as references (CLAUDE.md flags 60+ enums
   as a known trap). Rejected: increases the enum-sprawl problem.
3. **`source text` + CHECK constraint IN ('operational', 'bubble_migration',
   'v3_engine')** — accepted. Referential integrity, no enum-sprawl,
   extensible via simple ALTER TABLE ... DROP CONSTRAINT / ADD CONSTRAINT.

## Decision Outcome

Chosen: **Option 3 — `source text` + CHECK constraint, uniform across 12
migration-targeted tables, with per-trigger whitelist filter for side-effect
producers.**

### Clause A — Column specification

All 12 migration-targeted tables receive:

```sql
source text NOT NULL DEFAULT 'operational'
  CHECK (source IN ('operational', 'bubble_migration', 'v3_engine'))
```

Target tables (per plan M7):
1. `public.workspace`
2. `public.company`
3. `public.location`
4. `public.department`
5. `public.team`
6. `public.profile`
7. `public.employment_contract`
8. `public.employment_contract_detail`
9. `public.employee_type` (K1a — decided in prior council 2026-04-15;
   excluded here per plan-level council verdict condition #1. Re-evaluate
   at M7 authoring.)
10. `public.schedule_shift`
11. `timesheet.time_entry` (cross-schema per prior council Q4)
12. `public.invitation`

Default `'operational'` means all existing rows pre-migration receive the
value via ADD COLUMN DEFAULT metadata (PG 11+ zero-rewrite).

### Clause B — Trigger filter enumeration

The following triggers fire on INSERT/UPDATE of migration-targeted tables
and produce rows in side-effect tables forbidden by ADR-0149. M8 MUST
modify each to include a source-aware guard:

| # | Trigger | Source file | Category | Filter action |
|---|---------|-------------|----------|---------------|
| 1 | `trg_auto_assign_protocols` (AFTER INSERT on `profile`) | `supabase/migrations/20260428100000_auto_assign_protocols.sql:53-57` | Hard-coded write | Add `WHEN (NEW.source IS DISTINCT FROM 'bubble_migration')` |
| 2 | `trg_department_channel` (AFTER INSERT on `department`) | `supabase/migrations/20260422300400_channel_auto_create_triggers.sql:26-28` | Side-effect cascade | Same filter |
| 3 | `trg_team_channel` (AFTER INSERT on `team`) | `supabase/migrations/20260422300400_channel_auto_create_triggers.sql:50-52` | Side-effect cascade | Same filter |
| 4 | `trg_push_shift_published` (AFTER INSERT on `schedule_shift`) | `supabase/migrations/20260418120000_push_dispatch_triggers.sql:92-96` + later refactors | Hard-coded engine_event + outbox | Same filter |
| 5 | `audit_schedule_shift` (AFTER INSERT/UPDATE/DELETE on `schedule_shift`) | `supabase/migrations/20260301600003_schedule_persistence_tables.sql:501-503` | Hard-coded schedule_audit_log | Same filter |

Triggers safe **without** filter (no-op or UPDATE-only, neutralized by
ADR-0149 INSERT-only invariant):

- All `set_*_updated_at` BEFORE UPDATE triggers (11 tables)
- `trg_workspace_generate_slug` (slug generation only)
- `trg_sync_profile_department` (UPDATE only; strike-mcp INSERT-only)
- `trg_sync_payroll_on_signed` (UPDATE only; plus WHEN clause constraint)
- `trg_push_shift_updated` (UPDATE only)
- `trg_schedule_shift_temporal_lock` (UPDATE/DELETE only — acts as guard)
- `trg_push_join_request` on `invitation` (WHEN `direction='inbound'`;
  strike-mcp imports use non-inbound direction per ADR-0149)

### Clause C — Whitelist semantics

Filter phrasing is **whitelist-compatible** (exclude migration) rather than
blacklist-specific (which would break as new discriminators are added).
Canonical form:

```sql
WHEN (NEW.source IS DISTINCT FROM 'bubble_migration')
```

This fires for `'operational'`, `'v3_engine'`, and any future value. Future
discriminators for batch-historical tools (e.g., `'stripe_migration'`,
`'tripletex_backfill'`) require explicit additions to the filter set OR
promotion to a general "historical backfill" predicate — that is a future
ADR.

### Clause D — Non-trigger side-effect paths

Out-of-scope for this ADR but surfaced by council code-trace:

- `trg_outbox_auto_dispatch` on `notification_outbox`
  (`supabase/migrations/20260328225650_notification_outbox_auto_dispatch.sql:37-40`)
  fires `net.http_post` on every outbox INSERT. Because the 4 upstream push
  triggers are filtered (Clause B), this one stays unchanged — it has
  nothing to receive.
- `dispatch_push_notification` direct call in legacy trigger bodies —
  superseded by outbox pattern; no live callers on target tables remain.

### Clause E — Extensibility

Adding a new `source` value requires:

1. `ALTER TABLE ... DROP CONSTRAINT source_check; ADD CONSTRAINT source_check
   CHECK (source IN (..., 'new_value'));` for each of the 12 tables (atomic
   single migration).
2. Review of the 5 filtered triggers in Clause B to decide if new value
   should also be excluded.
3. Record the decision in an ADR referencing this one.

## Rules & Consequences

- **Good, because** provenance is uniformly queryable across 12 tables
  with the same idiom (`WHERE source = 'operational'`).
- **Good, because** whitelist-semantics filters tolerate future
  discriminators without trigger edits.
- **Good, because** CHECK constraint avoids enum-sprawl; adding values is
  a single migration per ADR review.
- **Good, because** the 5-trigger enumeration is an auditable appendix
  to this ADR, not scattered across migration files.
- **Bad, because** every new migration-targeted table in the future must
  include the `source` column + CHECK constraint. Convention-enforced,
  not type-system-enforced.
- **Bad, because** adding a 4th source value requires 12 ALTER TABLE
  statements plus trigger review. Cost is proportional to table count.
- **Agent Impact:**
  - Code-review must verify any new table in the 12-table domain includes
    the `source` column.
  - Any new trigger on these tables must document source-awareness in the
    trigger's migration file.
  - Strike-mcp (ADR-0149) relies on Clause B filters being complete —
    incomplete filter = boundary violation.

## References

- ADR-0149 — Strike-MCP Telemetry Boundary (companion; this ADR-0150 enforces at DB layer)
- ADR-0099 — Unified Authority Gate
- Cascade invariant #8 — provenance on all outputs
- CLAUDE.md — enum sprawl trap (60+ enums)
- Council session 2026-04-15 code-trace (agent-coord findings)

---

> After writing: register in `docs/decisions/0000-decision-log.md` and update the ADR table in `CLAUDE.md`.
