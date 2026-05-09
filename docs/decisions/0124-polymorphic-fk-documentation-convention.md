---
title: ADR-0124 — Polymorphic FK Documentation Convention
id: ADR-0124
status: proposed
layer: decision
created: 2026-04-17
updated: 2026-04-17
module: database
tags: [adr, database, foreign-keys, polymorphism, documentation]
---

# ADR-0124 — Polymorphic FK Documentation Convention

> **Errata 2026-04-17:** This ADR's original "Genuine orphans" list named wrong source tables for both FK candidates. Fact-check during PR1 execution confirmed: `active_contract_id` is on `public.workspace` (not `public.profile`); `seeded_from_framework_binding_id` is on `public.tariff_rate_table` (not `public.employee_payroll_profile`). The column→table errors were inherited from the 2026-04-17 audit. See L-0042 and L-0043 for the systemic pattern. Lists below are corrected.

## Context and Problem Statement

A 2026-04-17 audit flagged four `*_id` columns as "orphan FKs" — present on the table, no `REFERENCES` constraint. After PR1 fact-check corrected column→table mappings, the classification stands:

**Genuine orphans (should have FK):**
- `tariff_rate_table.seeded_from_framework_binding_id` (migration `20260422400000_cascade_b_schema.sql:150-152`) — should reference `workspace_framework_binding(id)`. **Applied in PR1 migration `20260511100000_orphan_fk_fixes_and_polymorphic_comments.sql`.**
- `workspace.active_contract_id` (migration `20260228140000_contract_system_foundation.sql:181`) — semantic target unclear (candidates: `public.contract`, `public.employment_contract`). **Deferred to dedicated audit ticket.** Not applied in PR1.

**Intentional polymorphic references (FK is structurally impossible):**
- `protocol_assignment.assigned_ref_id` (migration `20260414014856_training_schema_foundation.sql:23`) — points to `policy`, `department`, or `team` depending on `assigned_via` enum. Classic polymorphic association.
- `chat_conversation.source_id` (migration `20260418100300_mobile_schema_additions.sql:34`, commented) — points to `department_session`, `schedule_shift`, or other entity by `source_type`.

The audit classified all four as problems because the column naming (`*_id`) implied a missing FK. The intentional polymorphic cases have a SQL comment in one file (`source_id`) but not the other (`assigned_ref_id`). Future audits will re-flag them unless a convention exists.

## Decision Drivers

- Polymorphic references are a legitimate pattern (strategy-typed references are impossible as hard FKs in Postgres without multiple-table inheritance).
- Audit false-positives cost review time (3rd occurrence of audit-inflation this month — see memory `learning_audit_inflation_pattern.md`).
- Provenance is a cascade invariant — every column of reference type must be traceable to its intent.

## Considered Options

1. **Rename polymorphic columns away from `*_id`** — e.g. `assigned_ref_key`, `source_ref_key`. Rejected: breaks existing code and migrations; column name already communicates UUID presence.
2. **Add SQL `COMMENT ON COLUMN`** on every intentional polymorphic reference, explicitly stating: "Polymorphic reference. No FK by design. Dispatch via `{dispatch_column}` enum; possible targets: {list}."
3. **Create a lookup registry in docs** — central list of polymorphic columns. Rejected: drifts from schema; comments live with the data.

## Decision Outcome

Chosen option: **Option 2 — mandatory SQL `COMMENT ON COLUMN` for intentional polymorphic references.**

### Convention

Every column that:
- has a name matching `*_id` or `*_ref_id` or similar, AND
- does NOT have a `REFERENCES` constraint, AND
- IS intentionally polymorphic (dispatched by a type/enum column)

MUST have a SQL `COMMENT ON COLUMN` with the following structure:

```sql
COMMENT ON COLUMN <table>.<column> IS
  'Polymorphic reference. No FK by design. '
  'Dispatch via <dispatch_column> enum. '
  'Possible targets: <list of tables>. '
  'See ADR-0124.';
```

### Enforcement

- New migrations that add a polymorphic column MUST include the comment in the same migration.
- Existing polymorphic columns (`assigned_ref_id`, `chat_conversation.source_id`) receive the comment in a one-shot migration as part of the same PR that applies the two genuine FK fixes (PR1 in the remediation plan).
- A periodic schema audit (quarterly) greps `database.types.ts` for `*_id` columns lacking both `REFERENCES` and the canonical comment. Results become either (a) new FK, or (b) new polymorphic comment.
- The `smartout-database-guide` skill gains a checklist item: "Adding a polymorphic column? Add the `COMMENT ON COLUMN` in the same migration."

### Scope

This ADR covers documentation convention only. It does NOT require:
- Migration of genuine orphans (that's PR1 via ADR-independent migrations).
- Refactoring existing polymorphic patterns into single-target FKs.
- Runtime enforcement of dispatch validity (already handled by `CHECK` constraints where present; not expanded by this ADR).

## Rules & Consequences

- **Good, because** future audits have a canonical signal — if a `*_id` column lacks `REFERENCES`, the comment tells the reviewer whether it's intentional.
- **Good, because** the comment is co-located with the data — can't drift as schema evolves.
- **Bad, because** comments require discipline; easy to forget in new migrations. Mitigation: checklist in database-guide skill.
- **Agent Impact:** Any agent capability reading schema metadata (future schema-introspection tools) can dispatch on the comment to determine reference type. No immediate capability today.

---

> Registered in `docs/decisions/0000-decision-log.md`. Applied retroactively to `protocol_assignment.assigned_ref_id` and `chat_conversation.source_id` in the PR1 migration `20260511100000_orphan_fk_fixes_and_polymorphic_comments.sql`. Errata 2026-04-17 — column→table mappings corrected (see header).
