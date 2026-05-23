---
id: L-0334
title: Biconditional CHECK constraints require status-transition writes to null prior-status timestamp columns
status: canonical
layer: learning
created: 2026-05-23
updated: 2026-05-23
module: onboarding
tags: [learnings, database, check-constraint, status-transition, upsert, onboarding]
---

# L-0334 — Biconditional CHECK constraint coherence: partial upserts must enumerate all timestamp columns on status transition

## Context

`employee_onboarding_state` has two biconditional CHECK constraints:

```sql
CONSTRAINT eos_dismissed_iff_ts CHECK ((status = 'dismissed') = (dismissed_at IS NOT NULL))
CONSTRAINT eos_completed_iff_ts  CHECK ((status = 'completed') = (completed_at IS NOT NULL))
```

These constraints enforce that EVERY valid row is in one of three allowed states:
- `('in_progress', NULL, NULL)`
- `('dismissed', T, NULL)`
- `('completed', NULL, T)`

`completeWelcome` upserted `{ status: 'completed', completed_at: now() }` — but when the user had previously dismissed (leaving `dismissed_at` populated), the upsert did NOT null out `dismissed_at`. Result: `('completed', T, T)` — both biconditionals violated simultaneously → Postgres CHECK error → 500.

Surfaced by Council R3 (2026-05-23), agent-coord §B.

## Discovery

Partial upserts that only set the target-status columns are insufficient when the table has biconditional CHECK constraints. The constraint fires on every row write, evaluating the FULL row state — including columns the current write does not touch.

The invariant: any server action performing a status transition MUST explicitly enumerate ALL timestamp columns that the target status requires to be NULL, setting them to NULL in the same write.

## Impact

**Transition rules (codified in ADR-0400 §2):**

- `dismiss` → set `dismissed_at = now()`. Leave `completed_at` untouched (it should already be NULL for in_progress→dismissed, the common path).
- `resume` → set `dismissed_at = NULL`. Guard: `WHERE status='dismissed'` makes subsequent calls no-op.
- `complete` → set `completed_at = now()`, AND set `dismissed_at = NULL`. The `AND` is mandatory — covers dismiss→complete-direct and dismiss→resume→complete paths.

**Code review rule:** when reviewing any server action touching a table with biconditional CHECK constraints, verify that each status transition explicitly nulls the prior-status timestamp columns. A partial upsert that only sets the new-status columns = bug on every cross-path transition.

**Forward pattern:** any new table with `(status='X') = (X_at IS NOT NULL)` CHECK pairs inherits this rule. Document the allowed tuple states and transition column requirements in the ADR for that table.

Sibling: L-0177 (silent fallback — no error but wrong data). This learning produces a hard Postgres error rather than silent corruption, but the root cause is the same: partial writes that omit required field updates.

## References

- ADR-0400 §1 (state-row coherence) + §2 (transition rules)
- Migration: `supabase/migrations/20260624000100_create_employee_onboarding_state.sql`
- Fixed in: `apps/web/src/app/dashboard/_actions/welcome-wizard-actions.ts` (completeWelcome)
- Remediation commit Sortie A: `9897db3f7` (defect #3)
- Forward: `smartout-database-guide` skill — new section on biconditional CHECK coherence
