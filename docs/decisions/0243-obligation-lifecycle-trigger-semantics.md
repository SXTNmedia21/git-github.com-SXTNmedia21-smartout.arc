---
title: "Obligation Lifecycle — Trigger Semantics + due_at Recalc"
id: ADR_0243
renumbered_from: ADR_0235
status: proposed
layer: decision
created: 2026-04-29
updated: 2026-04-29
---

# ADR-0243: Obligation Lifecycle — Trigger Semantics + due_at Recalc

## Context and Problem Statement

`contract_obligation` table introduces operational obligations (training, certification, activity, attendance) with `due_at = contract.start_date + due_within_days`. Draft trigger `compute_obligation_due_at` (Council 2026-04-29 reviewed) had two defects: (1) SECURITY mode unspecified — RLS-filtered SELECT silently sets NULL `due_at` when caller cannot see the parent contract; (2) trigger fires only on `INSERT OR UPDATE OF due_within_days, contract_id` — not on `employment_contract.start_date` change → stale `due_at` forever.

Field classification (MATERIAL/ADMIN/DERIVED/SYSTEM) was originally proposed as DB table `field_classification_metadata`. This is an anti-pattern: schema-introspection table drifts from schema, requires DB roundtrip on every classify-change call, fails type-safety. Belongs as code-level const map.

## Decision Drivers

- Trigger SECURITY mode is silent RLS bypass vector (Supervisor Layer 3 finding)
- `start_date` is MATERIAL field per ADR-0001-contract-service classification — change cascades to all obligations
- `field_classification_metadata` decouples classification from schema it describes (Steward finding)
- Amendment-handler must classify changes synchronously without DB roundtrip
- TypeScript can enforce classification against `Database['public']['Tables']['employment_contract']['Row']` keys

## Considered Options

1. **DB table for classification + INVOKER trigger** — original draft. Rejected: drift + RLS bypass.
2. **DB table for classification + DEFINER trigger** — fixes RLS bypass but keeps drift.
3. **TS const map + DEFINER trigger + start_date cascade trigger** — code-level classification + secure trigger semantics + recompute on parent change.
4. **Generated column for due_at** — Postgres 12+ supports STORED but not cross-table; would need materialized view. Rejected: complexity.

## Decision Outcome

Chosen option: **Option 3**, because TS const enforces classification at compile time, DEFINER trigger eliminates silent RLS bypass, start_date cascade keeps `due_at` consistent.

### Required changes

1. **Drop** `field_classification_metadata` table from schema. Remove `\i 99-seed-classifications.sql`.
2. **Add** `packages/contracts/src/field-classification.ts`:
   ```ts
   export const FIELD_CLASSIFICATION = {
     "employment_contract.job_title": "material",
     "employment_contract.start_date": "material",
     "employee_payroll_profile.tax_table_number": "derived",
     // ...
   } as const satisfies Record<string, FieldClassification>;
   ```
   With branded type tying keys to `Database` types via union. Compile-time error on unknown column.
3. **Trigger** `compute_obligation_due_at` declared `LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp`. Function explicitly checks `contract_start_date IS NOT NULL`; raises if NULL (cross-workspace silent corruption fail-closed).
4. **Cascade trigger** `recompute_obligation_due_at_on_contract_change`: AFTER UPDATE OF start_date ON employment_contract → UPDATE all child contract_obligation rows.
5. **Status transition constraint**: `contract_obligation_completed_consistent` extends to in_progress: `(status='in_progress' AND started_at IS NOT NULL) OR (status != 'in_progress')`. SLA queries on `index contract_obligation_status_due` need started_at non-null for in-progress rows.

### Status enum confirmed

```sql
CREATE TYPE obligation_status AS ENUM (
  'pending', 'in_progress', 'completed', 'overdue', 'waived'
);
```

`overdue` is computed from cron, not application-set. `waived` requires `waived_at + waived_reason + waived_by_user_id` per existing `contract_obligation_waive_consistent` check.

## Rules & Consequences

- **Good, because** classification stays in sync with schema (TS compile-time enforcement); RLS bypass closed; `due_at` stays consistent across `start_date` changes; SLA queries correct.
- **Bad, because** TS const must be re-generated on schema migration (build step); cascade trigger adds write amplification when start_date changes (acceptable — rare).
- **Agent Impact:** Build agents implementing amendment-handler MUST: (a) import classification from TS const, never query DB; (b) handle "schema column added but classification missing" as compile error. Build agents writing migrations MUST: (a) specify SECURITY DEFINER + search_path on every trigger doing cross-table SELECT; (b) add cascade trigger for any computed field derived from parent.

## References

- Council 2026-04-29 Contract Module Phase 0a
- ADR-0241 (schema migration — paired)
- ADR-0242 (capability split — paired)
- L-0172 (trigger SECURITY = silent RLS bypass)
- L-0173 (DB-classification anti-pattern)

---

> Registered in `docs/decisions/0000-decision-log.md` 2026-04-29.
