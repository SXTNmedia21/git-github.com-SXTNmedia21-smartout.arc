---
title: "Strike-MCP Telemetry Boundary"
id: ADR_0107
status: accepted
layer: decision
created: 2026-04-15
updated: 2026-04-15
---

# ADR-0107: Strike-MCP Telemetry Boundary

## Context and Problem Statement

Strike-mcp (registered per ADR-0083) writes SQL INSERTs directly to Supabase
during Bubble → v3 migration. Unlike runtime code, strike-mcp bypasses the
application telemetry layer (`emit()` from `@smartout/telemetry`) because it
operates below the Next.js stack entirely. But the target tables have
database-level triggers, audit-logs, and outbox mechanisms that fire
unconditionally on INSERT. Without an explicit boundary declaration:

- Strike-mcp imports would silently produce `engine_event`, `activity_trail`,
  `notification_outbox`, and `schedule_audit_log` rows for historical Bubble
  data.
- Real employees would receive push notifications about 2020 shifts.
- 30 active protocols × 50 imported employees = 1 500 phantom
  `protocol_assignment` rows stuck in `pending` status.
- Ghost channels would be auto-created per Bubble department and team.

This ADR draws the boundary: what strike-mcp may and may not produce, how
the `source` discriminator (ADR-0108, M7) + trigger filters (M8) enforce it,
and what replaces normal telemetry for auditability.

## Decision Drivers

- **ADR-0083** already registered strike-mcp as dev-only tool but scoped
  only registration + token handling. Telemetry boundary is a separate
  concern.
- **ADR-0099** unified authority gate: runtime writes flow through C4
  authority checks before hitting DB. Strike-mcp uses service_role token
  and bypasses C4 by design (ADR-0083) — it cannot emit actor-accountable
  telemetry because there is no actor.
- **Council 2026-04-15 code-trace** (system-agent-coordinator): identified
  4 side-channels + 5 concrete triggers + cascading side-effects that the
  boundary must address.
- **Cascade invariant #8** (provenance on all outputs): every DB row must
  declare its origin. `source='bubble_migration'` is the only legitimate
  provenance for strike-mcp writes.

## Considered Options

1. **Amend ADR-0083** — single ADR covers registration + telemetry.
   Conflates identity with side-effect boundary; rejected by council
   (steward + supervisor both flagged it).
2. **Runtime telemetry shim for strike-mcp** — strike-mcp calls `emit()`
   via HTTP to the app. Rejected: strike-mcp is explicitly below the
   runtime stack per ADR-0083; reintroducing runtime coupling defeats the
   boundary.
3. **New ADR-0107 declaring boundary + filters + observability substitute**
   — accepted. Strike-mcp writes are source-discriminated; triggers filter
   by source; separate audit trail captures migration provenance.

## Decision Outcome

Chosen: **Option 3 — new ADR declaring an explicit telemetry boundary with
four forbidden side-channels, a trigger-filter mechanism, an INSERT-only
invariant, and an observability substitute.**

### Clause A — Forbidden side-channels

Strike-mcp INSERTs MUST NOT produce rows in:

1. `public.engine_event` (Event Engine workflow trigger — would fire
   lifecycle processes on historical data)
2. `public.activity_trail` (user-action audit — has no actor when strike-mcp
   writes)
3. `public.notification_outbox` (would send real push notifications about
   historical shifts)
4. `public.schedule_audit_log` (would write audit rows with NULL `user_id`
   because strike-mcp has no `auth.uid()`)

Cascading side-effect tables that must ALSO not receive strike-mcp-derived
rows:

- `public.channel` (auto-created per department/team)
- `public.channel_member` (auto-synced when profile.department_id changes)
- `public.protocol_assignment` (auto-assigned per new profile)

### Clause B — Enforcement mechanism (delegated to ADR-0108)

The `source` column (M7) on 12 migration-targeted tables is the provenance
signal. Triggers that would produce forbidden side-channels MUST be filtered
via `WHEN NEW.source IS DISTINCT FROM 'bubble_migration'` or equivalent guard.
The concrete trigger enumeration + filter mechanism is the scope of ADR-0108.

Five triggers identified in council code-trace as blockers without filter
(enforced by M8):

1. `trg_auto_assign_protocols` on `profile`
   (`supabase/migrations/20260428100000_auto_assign_protocols.sql:53-57`)
2. `trg_department_channel` on `department`
   (`supabase/migrations/20260422300400_channel_auto_create_triggers.sql:26-28`)
3. `trg_team_channel` on `team` (`same file:50-52`)
4. `trg_push_shift_published` on `schedule_shift`
   (`supabase/migrations/20260418120000_push_dispatch_triggers.sql:92-96`
    and later refactors)
5. `audit_schedule_shift` on `schedule_shift`
   (`supabase/migrations/20260301600003_schedule_persistence_tables.sql:501-503`)

### Clause C — INSERT-only invariant

Strike-mcp performs **INSERT only, never UPDATE, never DELETE** on v3 tables.
This invariant:

- Neutralizes three UPDATE-only triggers that would otherwise need filters:
  `trg_sync_payroll_on_signed`, `trg_push_shift_updated`,
  `trg_schedule_shift_temporal_lock`.
- Aligns with ADR-0109's "block-and-supersede" rule for post-migration
  contract edits (admin issues new contract; migrated row is immutable).

Breaking this invariant (e.g., strike-mcp ever updates a migrated row)
requires an amendment to this ADR.

### Clause D — Authority gate scope

Strike-mcp operates below ADR-0099's C4 authority gate by design. This is
not a gap — it is the boundary. Consequences:

- No `emit()`, no `engine_event`, no `activity_trail`, no
  `notification_outbox`, no `schedule_audit_log`.
- Only legitimate provenance: `source='bubble_migration'` column on the 12
  target tables (M7).
- Admin operations post-migration flow through the normal C4-gated path.

### Clause E — Observability substitute

"No v3-native telemetry" is not the same as "no audit trail". Strike-mcp
MUST produce an equivalent record:

- **Strike-mcp repo-local structured log** (`~/dev/strike-mcp/logs/`): every
  SQL statement emitted with timestamp, workspace_id, row count,
  success/failure.
- **`public.migration_log` table** (future migration, not part of this
  scope): append-only record of every strike-mcp run with run_id,
  started_at, finished_at, workspace_id, rows_inserted per table, any
  errors. Populated by strike-mcp itself via direct INSERT (bypass all
  triggers). `source='strike_mcp'` discriminator.

Minimum for Phase 1 (Wrightegaarden): repo-local log only. `migration_log`
table deferred until second workspace migration.

## Rules & Consequences

- **Good, because** strike-mcp's boundary is explicit and enforceable via
  the `source` column and whitelisted triggers (ADR-0108). Cascade invariant
  #8 (provenance) is preserved.
- **Good, because** separating registration (ADR-0083) from telemetry
  boundary (this ADR) keeps each ADR reasonable in scope.
- **Good, because** INSERT-only invariant means UPDATE-only triggers don't
  need filter changes.
- **Bad, because** "no v3-native telemetry" means migration audit lives in
  strike-mcp repo logs, not in v3 Supabase. Cross-system correlation is
  harder.
- **Bad, because** ADR-0108 must complete before any strike-mcp run can
  safely execute. The 5 identified triggers are blockers.
- **Agent Impact:**
  - Claude Code + strike-mcp MCP tools must treat strike-mcp as INSERT-only
    below the runtime layer. Any `emit()`, `engine_event` INSERT, or
    `activity_trail` INSERT invoked during migration context is an ADR
    violation.
  - Mr. Botsson and other runtime agents do not interact with strike-mcp;
    it is dev-only per ADR-0083.
  - Future migration tools (e.g., Stripe importer, Tripletex backfill)
    must declare their own boundary ADR following this pattern or
    explicitly inherit from this one.

## References

- ADR-0083 — Strike-MCP Registration (related, not amended)
- ADR-0084 — Telemetry Conditional Exports (different concern — client/server
  split — no overlap)
- ADR-0099 — Unified Authority Gate (bypassed by design)
- ADR-0108 — Source Discriminator Pattern + Trigger Filters (enforcement)
- ADR-0109 — Migrated Profile Contract Shell (INSERT-only invariant consumer)
- Cascade invariant #8 — provenance on all outputs
- Council session 2026-04-15 — code-trace findings (agent-coord)

---

> After writing: register in `docs/decisions/0000-decision-log.md` and update the ADR table in `CLAUDE.md`.
