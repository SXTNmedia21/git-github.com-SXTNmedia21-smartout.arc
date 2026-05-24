---
title: "All workspace_id foreign keys must declare ON DELETE CASCADE"
id: ADR-0409
status: accepted
layer: decision
created: 2026-05-24
updated: 2026-05-24
---

# ADR-0409: Workspace FK CASCADE Convention

## Context and Problem Statement

An audit of all migrations (2026-05-24) found 87 `workspace_id REFERENCES workspace(workspace_id)`
declarations across 46 migration files that lack `ON DELETE CASCADE`. Some had no delete
behaviour specified (PostgreSQL default: RESTRICT), and several explicitly declared
`ON DELETE RESTRICT` (pension_scheme, contract_amendment, shift_pay_calculation_event,
billing.settlement_period, supplement_rule_match).

Without CASCADE:
- Workspace deletion is blocked by FK constraint violations on every child table.
- Test fixture recycling is impossible: you cannot drop a workspace row in integration tests
  without first deleting all children in the correct topological order (which changes as new
  tables are added).
- Production is a landmine: operator workspace-decommission scripts fail silently or noisily.
- The E2E test teardown pattern "delete workspace, start fresh" is structurally broken.

BUG-8. Chair Phase 5 synthesis 2026-05-24. Supervisor audit confirmed 80+ affected rows.

## Decision Drivers

- Workspace deletion must be an atomic, reversible operator action (ADR-0265 HOP B gate).
- Test isolation requires the ability to create and destroy workspace fixtures freely.
- Convention without CI enforcement will drift — new migrations will omit CASCADE again
  (original bug demonstrates this pattern over 46 files spanning 4+ months of development).

## Considered Options

1. **Option A** — RESTRICT everywhere: requires explicit child deletion before workspace removal.
   Makes test teardown a complex dependency graph walk.
2. **Option B** — CASCADE everywhere: workspace deletion atomically removes all children.
   Operator gate in ADR-0265 HOP B checklist ensures intentionality. Audit trail via
   `activity_trail` (which also cascades, preserving the pre-deletion record in WAL).
3. **Option C** — Selective CASCADE (case-by-case). Fragile — requires per-table reasoning
   that has already failed once across 46 migrations.

## Decision Outcome

Chosen option: **Option B** — CASCADE on all workspace-child tables.

**Rule:** Every column declared as `workspace_id REFERENCES workspace(workspace_id)` (or any
variant referencing the workspace PK) MUST include `ON DELETE CASCADE`. No exceptions without
an explicit ADR amendment documenting why RESTRICT is appropriate for that specific table.

**Previous RESTRICT justifications reviewed:**
- `pension_scheme` — workspace-scoped config, not an independent accounting record. CASCADE.
- `contract_amendment` — workspace-scoped contract data. CASCADE.
- `shift_pay_calculation_event` — comment said "accounting records outlive workspace soft-close."
  Soft-close ≠ hard delete. Hard workspace delete is operator-gated (ADR-0265 HOP B).
  The WAL preserves pre-delete state for regulatory audit. CASCADE.
- `billing.settlement_period` — same reasoning as shift_pay_calculation_event. CASCADE.
- `supplement_rule_match` — workspace-scoped payroll config. CASCADE.

## Rules & Consequences

- **Good, because** workspace lifecycle becomes reversible and atomic.
- **Good, because** test fixture creation + teardown is O(1): `INSERT workspace` / `DELETE workspace`.
- **Good, because** production workspace decommission is unblocked.
- **Bad, because** a hard workspace DELETE is now more powerful — it cascades through all
  child tables. This is mitigated by the ADR-0265 HOP B operator checklist and the
  `workspace.status` soft-delete field that should be used before any hard DELETE.
- **Agent Impact:**
  1. Any new migration that creates a table with `workspace_id` MUST declare
     `REFERENCES workspace(workspace_id) ON DELETE CASCADE`.
  2. The CI gate `scripts/check-workspace-fk-cascade.mjs` (husky pre-push + GH Actions)
     enforces this on new migrations.
  3. `supabase/migrations/20260626000001_workspace_fk_cascade_sweep.sql` backfills the 80+
     existing tables.

## CI Enforcement

`scripts/check-workspace-fk-cascade.mjs` — scans new migration files in the current diff
for workspace_id FK references and fails if any lack `ON DELETE CASCADE`.

Wired into:
- `package.json` → `check:cascade-fk`
- `.husky/pre-push`
- `.github/workflows/ci.yml` Format Check job

## References

- BUG-8 (journey-sweep council 2026-05-23, chair Phase 5 synthesis 2026-05-24)
- ADR-0265 (enforced deployment pipeline — HOP B operator checklist)
- `supabase/migrations/20260626000001_workspace_fk_cascade_sweep.sql` (backfill sweep)
- `scripts/check-workspace-fk-cascade.mjs` (CI gate)
- 46 migration files with defective FKs identified in BUG-8 audit

---

> Registered in `docs/decisions/0000-decision-log.md`.
