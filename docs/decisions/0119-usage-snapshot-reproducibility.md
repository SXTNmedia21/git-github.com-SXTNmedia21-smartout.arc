---
title: ADR-0119 — Usage Snapshot Reproducibility + Active-User Counting Predicate
id: ADR_0119
status: accepted
layer: decision
created: 2026-04-17
updated: 2026-04-17
module: billing
tags: [adr, billing, c3-commercial, usage-snapshot, reproducibility, active-user]
---

# ADR-0119 — Usage Snapshot Reproducibility + Active-User Counting Predicate

## Context and Problem Statement

Billing Engine Fase 1 (spec: `docs/superpowers/specs/2026-04-17-billing-engine-fase-1-design.md`) introduces a `usage_snapshot` table (Phase 1.6) and a `basis_drift_event` table with detection trigger (Phase 1.7). Before those tables are designed, two contract questions must be settled:

1. **What predicate defines an "active user" for billing purposes?** The invoice engine must count active users per workspace per billing period. Multiple candidate signals exist: `schedule_shift.status`, `daily_reconciliation.settled_at`, profile presence. The choice must be deterministic and auditable.

2. **How do we ensure that a snapshot taken on day 5 of a billing cycle produces the same count if re-run on day 30?** Invoice generation must be reproducible. Retroactive edits to `schedule_shift` after an invoice is issued must be detectable and handled via a defined resolution path — not silently ignored or silently re-billed.

## Decision Drivers

- Invoice generation must be deterministic and independent of C1 reconciliation timing
- `daily_reconciliation.settled_at` is a C1 artifact — cross-referencing it would couple C3 billing to C1 timing (violates cascade plane independence)
- `schedule_shift.status = 'completed'` is terminal: enforced by temporal-lock trigger (migration `20260428130000_schedule_shift_temporal_lock.sql` lines 127-138) — once completed, the row cannot revert
- Day-5 cron timing (per Fase 1 spec) means the snapshot runs after typical settling lag without needing to query C1 at all
- Full audit trail is required: downstream dispute resolution, regulatory compliance, and platform-admin review all need to know exactly which profile IDs were counted and what query produced them
- Residual edge cases (retroactive corrections applied before temporal lock activates) must be caught and surfaced rather than silently distorting future invoices

## Considered Options

1. **Active-user = `schedule_shift WHERE status = 'completed'`** — terminal status, enforced by temporal lock, no C1 dependency
2. **Active-user = `daily_reconciliation WHERE settled_at IS NOT NULL`** — C1 signal, but couples billing to reconciliation cadence
3. **Active-user = `profile WHERE status = 'active'`** — profile presence, but ignores whether the employee actually worked in the period
4. **Store snapshot as count-only** — no audit trail of which profiles were counted; irreproducible under dispute
5. **Store snapshot with `counted_profile_ids` + `source_query_hash`** — full audit trail; query is verifiable

## Decision Outcome

Chosen options: **Option 1 (active-user predicate)** and **Option 5 (snapshot storage format)**, because they jointly make invoice generation deterministic and fully auditable without coupling C3 to C1.

### 1. Active-user counting predicate

Active user for billing purposes is defined as:

```sql
SELECT DISTINCT employee_id
FROM schedule_shift
WHERE status = 'completed'
  AND employee_id IS NOT NULL
  AND shift_date BETWEEN period_from AND period_to
  AND workspace_id = $workspace_id
```

No cross-reference to `daily_reconciliation.settled_at` (hypothesis H8 decision A from the Fase 1 spec). The predicate is evaluated once per workspace per billing period at snapshot time.

### 2. `usage_snapshot` storage contract

The `usage_snapshot` table (Phase 1.6) MUST store:

- `counted_profile_ids jsonb` — sorted array of profile UUIDs that satisfied the predicate; serves as the audit trail
- `source_query_hash text` — SHA-256 of the canonical query string concatenated with its bound parameters (workspace_id, period_from, period_to); allows platform-admin or auditor to verify no query drift between billing periods

### 3. Drift detection (Phase 1.7)

Retroactive modifications to `schedule_shift` rows that fall within a period for which an invoice has already been issued MUST trigger a `basis_drift_event` insert. The insert fires via a Postgres trigger (to be written in Phase 1.7) and emits `invoice.basis_drift_detected` via the telemetry registry.

Platform-admin reviews drift events and resolves via one of three paths:

- **Ignore** — correction is immaterial; event marked resolved with reason
- **Issue credit note** — overbilled; credit note issued and applied to next invoice
- **Reinvoice** — underbilled; corrected invoice issued for the delta

No automated re-billing. All resolution paths require explicit platform-admin action.

## Rules & Consequences

- **Good, because** `completed` is terminal — temporal-lock trigger prevents reversion, making snapshots reproducible by construction for the vast majority of cases
- **Good, because** day-5 cron timing absorbs typical settling lag without requiring any C1 query — C3 billing remains independent of C1 reconciliation cadence
- **Good, because** `counted_profile_ids` provides a first-class audit trail per snapshot; disputes can be resolved by diffing arrays across periods
- **Good, because** `source_query_hash` allows platform tooling to verify query stability across billing runs — protects against accidental predicate drift in code deployments
- **Good, because** drift detection catches the residual edge cases (retroactive corrections before temporal lock activates) and surfaces them for human resolution rather than silently distorting billing
- **Bad, because** `counted_profile_ids` grows with workspace size — for very large workspaces (500+ employees) the JSONB column may become significant; Phase 2 may need to move to a child table or compression
- **Bad, because** three resolution paths for drift (ignore / credit / reinvoice) require platform-admin tooling that is not in scope for Fase 1; a stub endpoint or manual DB intervention will be the interim process
- **Agent Impact:** Phase 1.6 schema for `usage_snapshot` MUST include `counted_profile_ids jsonb NOT NULL` and `source_query_hash text NOT NULL`. Phase 1.7 drift-detection trigger MUST emit `invoice.basis_drift_detected` and insert to `basis_drift_event`. No agent or cron job may auto-resolve drift events — resolution is always explicit platform-admin action.

## Related

- ADR-0118: Invoice Engine as C3 Commercial Consumer (placement decision that precedes this one)
- Cascade spec: `docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md` §2.3 (C3 Commercial)
- Billing Fase 1 spec: `docs/superpowers/specs/2026-04-17-billing-engine-fase-1-design.md` (Phase 1.6 + 1.7)
- Temporal-lock migration: `supabase/migrations/20260428130000_schedule_shift_temporal_lock.sql` lines 127-138
- Follow-up: ADR-0120 (invoice immutability contract)
- Requires: `MODULE_BILLING.md` to document active-user predicate and drift resolution paths
