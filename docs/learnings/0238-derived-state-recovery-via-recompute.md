---
id: LEARNING_0238
title: "Derived-state-table corruption recovers via canonical re-derivation, not migration"
status: canonical
layer: learning
created: 2026-05-13
updated: 2026-05-13
module: payroll
tags: [learning, payroll, cascade, derived-state, migration-anti-pattern, council]
council: 2026-05-13-sma-326
adr_candidate: pending (promote on 2-3 more occurrences)
---

# L-0238 — Derived-state-table corruption recovers via canonical re-derivation, not migration

## What

When a code bug produces malformed values in a **derived-state table** (D6 in cascade taxonomy — `payroll.deviation`, `shift_cost_snapshot`, `daily_reconciliation`, `payroll.calculation_line`, etc.), the canonical recovery is to **fix the source code and let the next re-derivation cycle wipe and replace poisoned rows**.

Writing a SQL migration to UPDATE-in-place poisoned values is an anti-pattern: it duplicates the derivation logic in a parallel mechanism (PL/pgSQL vs TypeScript), violates cascade reproducibility (cascade invariant: "derivation must be reproducible from persisted inputs"), and bypasses the canonical pipeline.

## When this applies

| Condition | Check |
|---|---|
| Affected table is **derived state** (computed from upstream sources, not source-of-truth) | Does the table have an entry point that wipes-and-replaces on rerun? |
| There is an existing **re-derivation route** that DELETEs unacked rows before re-INSERT | Grep for `delete().eq("workspace_id"...)` pattern at the orchestrator entry point |
| Corruption does NOT block any operator action **right now** | Check severity field + the gate condition in `lock-period` / `validate-settlement` / equivalent |
| **Acknowledged rows are frozen audit** — never touched by recovery | Filter `acknowledged_by IS NULL` in the DELETE clause |

If all four → trust auto-recovery. Document in HANDOFF. No migration.

If any fail → manual cleanup may be needed (operational, not migration-shaped).

## Origin — SMA-326 isoWeek NaN bug (2026-05-13)

`packages/payroll-calculate/src/deviation-checks.ts:62-77` — `isoWeek` + `isoYear` appended `"T12:00:00Z"` to caller string. Real callers (lines 174, 229) passed full ISODateTime (`shift.effective_start = "2026-04-07T06:00:00Z"`). Concat `"2026-04-07T06:00:00ZT12:00:00Z"` was invalid Date → both helpers returned NaN.

Result: `payroll.deviation.details.week = "WNaN"` + message text contains `"uke WNaN"`.

### Initial instinct (rejected by council)

Coordinator's first proposal was **Option A — migration UPDATE in-place**: rewrite `details.week` + message text via JOIN with `payroll.calculation.actual_start`, recompute ISO week in PL/pgSQL.

### Council verification

1. **Severity check** — W03 = `"warning"`, W04 = `"info"`. `lock-period/route.ts:97-104` blocks ONLY on `severity="error"+acknowledged_at IS NULL`. Neither W03 nor W04 blocks any operator action. R3 downgraded CRITICAL → MEDIUM (cosmetic).
2. **Re-derivation path** — `apps/web/src/app/api/payroll/run-deviation-checks/route.ts:292-300` already does `DELETE FROM payroll.deviation WHERE workspace_id=$1 AND period_id=$2 AND acknowledged_by IS NULL` before re-INSERT. Auto-recovery on every recalc.
3. **Cascade integrity** — `payroll.deviation` is D6 (Production & Product) derived state. UPDATE-in-place would duplicate TypeScript derivation logic in SQL = parallel mechanism (cascade anti-pattern, see invariant #3 reproducibility).
4. **Audit floor** — `acknowledged_by IS NOT NULL` rows are frozen audit (Bokføringsloven §13). Filter preserved by existing DELETE path.

### Council verdict: NO MIGRATION

Ship the 5-LOC source fix. Trust recovery path. Document in HANDOFF.

## Anti-pattern signature

Smells that suggest someone is reaching for an inappropriate backfill migration:
- "We have NaN/invalid/wrong values in `<derived_state_table>`"
- "We need a migration to UPDATE rows where `<corrupted_field> = '<bad_value>'`"
- The proposed migration recomputes the field via JOIN to upstream tables
- The recompute logic duplicates a TypeScript function

If you see all four → STOP. Check the four conditions above. The right answer is almost always "fix the source, let the re-derivation path recover."

## Heuristic

Before writing a backfill migration for derived state, answer:

1. **Is the table derived state?** (Computed by code, not entered by user/system-of-record.)
2. **Is there a wipes-and-replaces entry point?** (DELETE-then-INSERT shape at the orchestrator.)
3. **Does the corruption block any operator action right now?** (If yes — operational SQL pad, not migration.)
4. **Are acknowledged/frozen rows protected by the existing DELETE filter?** (If yes — auto-recovery is safe.)

Yes/yes/no/yes → trust recovery, no migration, HANDOFF note.

## Optional operational cleanup

If immediate cleanup is wanted without waiting for natural recalc, run via admin SQL pad (NOT a migration file):

```sql
DELETE FROM payroll.deviation
WHERE details->>'week' = 'WNaN'
  AND acknowledged_by IS NULL;
```

Or equivalent for the specific corruption pattern. This is operational cleanup, not a schema event — keep it out of `supabase/migrations/`.

## Sibling learnings

- [[L-0177]] — Silent workspace-mismatch (verify canonical path before sidecar). Same class: "verify the canonical path before adding a fix that bypasses it."
- Cascade invariant #3 — "Derivation must be reproducible from persisted inputs" (see `docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md`).
- Forbidden patterns in cascade: #2 ("No UI-only or service-local business logic outside cascade"), #3 ("No parallel mechanisms — UPDATE-in-place from migration duplicates the derivation").

## ADR candidate

Proto-ADR material. Promote to ADR when 2-3 more derived-state-recovery cases land:
- Candidate name: "Derived-state-table corruption recovery via canonical re-derivation"
- Candidate scope: across all D6 tables (deviation, shift_cost_snapshot, calculation_line, daily_reconciliation)
- Wait for: 2 more occurrences across different derivation tables, then promote

## Council citation

2026-05-13 council on SMA-326 backfill scope decision:
- Chair: system-steward (REVERSED Phase 3 R3=CRITICAL → R3=MEDIUM after severity code-trace)
- Layer 3: supervisor (4 of 4 prior COUNCIL-LOG cases were split; convention favors single-purpose sortie)
- Layer 2+4: system-agent-coordinator (confirmed zero AI consumers; UI consumer `DeviationList.tsx:122` renders message literal)
- Verdict: APPROVE WITH CHANGES — Option B-via-recompute (no migration), Option II (stay in sortie scope)

See `docs/council/COUNCIL-LOG.md` 2026-05-13 entry.
