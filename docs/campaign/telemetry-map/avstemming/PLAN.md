---
title: Implementation Plan — avstemming telemetry + backend
status: draft
updated: 2026-05-31
created: 2026-05-31
domain: avstemming
tags: [plan, telemetry, avstemming, reconciliation]
---

# Implementation Plan — avstemming domain

Ordered by business criticality. Core daily flow first, then secondary tabs.

---

## Seed blocker — CRITICAL

> **F0.4 seed blocker**: `daily_reconciliation`, `shift_approval`, `session_note` tables have **0 seed rows**.
> E2E tests against seed are BLOCKED until `supabase/migrations/70-reconciliation.sql` (F0.4) lands.
> This plan maps telemetry (the map is data) but every gate battery item against real rows is blocked.
> Local dev works against live Supabase branch. CI gate battery: BLOCKED until F0.4.

---

## Phase 1 — Daily flow (daglig tab) — HIGHEST PRIORITY

These are the primary admin actions. Hook + event required.

### 1. Approve day (`Godkjenn dagen`)

- **Button**: `daglig.jsx:166`
- **Mutation**: `daily_reconciliation.status=approved`
- **Event**: `reconciliation admin_action` (action: "approved") — **in registry ✓**
- **Hook**: `useApproveReconciliation` (**exists** in `_hooks/useReconciliation.ts:95`)
- **DoD**: Button calls hook; `onSuccess` emits `reconciliation admin_action`; toast confirms; preflight gate enforced (disabled until `pf.length===0`)
- **Gate battery**: `await approveReconciliation(testId)` → `daily_reconciliation.status='approved'` + activity_trail row with event `reconciliation admin_action`

### 2. Reject day (`Avvis & send tilbake`)

- **Button**: `forms.jsx:166` (DayReject submit)
- **Mutation**: `daily_reconciliation.status=open`
- **Event**: `reconciliation admin_action` (action: "rejected") — **in registry ✓**
- **Hook**: `useRejectReconciliation` (**exists** in `_hooks/useReconciliation.ts:182`)
- **DoD**: DayReject form validates reason ≥10 chars; submits via hook; notification to employee
- **Gate battery**: reject → status='open', activity_trail row, employee notified

### 3. Lock day (`Lås permanent`)

- **Button**: `forms.jsx:186` (DayLock confirm)
- **Mutation**: `daily_reconciliation.status=locked, locked_at, locked_by`
- **Event**: `reconciliation locked` — **in registry ✓**
- **Hook**: `lockDayMutation` (**exists** in `DayDetail.tsx:97`, `DayApproval.tsx:40`)
- **DoD**: DayLock modal shows revenue + hours; confirm → lock; irreversible; emits `reconciliation locked`
- **Gate battery**: lock → status='locked', locked_at set, emits event, no undo possible

### 4. Approve shift hours (`Lagre timer` / `Godkjenn vakt`)

- **Buttons**: `forms.jsx:57` (ShiftEdit), `forms.jsx:335` (ShiftApprove approve mode)
- **Mutation**: `shift_approval.approved_hours, status=approved|edited`
- **Event**: `reconciliation admin_action` — **in registry ✓** (used as proxy for shift approval)
- **Hook**: `useApproveShiftHours` (**exists** in `_hooks/useReconciliation.ts:248`)
- **DoD**: ShiftEdit validates hours + justification if changed; ShiftApprove approve mode submits; supplements → `shift_cost_snapshot`
- **Gate battery**: approve shift → shift_approval.status='approved', approved_hours set

### 5. Resolve deviation (`Marker løst / Bekreft`)

- **Button**: `forms.jsx:116` (DeviationResolve submit)
- **Mutation**: `deviation.status=resolved, resolution_notes, resolved_by, resolved_at`
- **Event**: `deviation resolved` — **in registry ✓**
- **Hook**: `useResolveDeviation` (**exists** in `_hooks/useReconciliation.ts:298`)
- **DoD**: Critical/high severity requires notes; submit → deviation resolved; preflight re-evaluates
- **Gate battery**: resolve deviation → deviation.status='resolved', emits `deviation resolved`

---

## Phase 2 — New hooks required (missing mutations)

### 6. Revenue adjust (`Lagre justering`)

- **Button**: `forms.jsx:82` (RevenueAdjust submit)
- **Mutation**: UPDATE `daily_reconciliation` SET `revenue_total`, `cash_counted`, `manual_adjustment_reason`
- **Event**: `reconciliation revenue_adjusted` — **MISSING from registry**
- **Hook needed**: `useAdjustRevenue` — NEW
- **Action**: Add event to registry + write hook + wire form submit
- **Gate battery**: BLOCKED (no seed) — unit test mutation only

### 7. Handoff submit (`Start handoff`)

- **Button**: `forms.jsx:147` (HandoffRequest submit); also `daglig.jsx:162` (Be om avklaring), `daglig.jsx:292` (shift handoff), `daglig.jsx:334/342` (deviation handoff)
- **Mutation**: INSERT `session_note` (type='handoff_request') or dedicated handoff table
- **Event**: `handoff submitted` — **in registry ✓ (line 2223)**
- **Hook needed**: `useSubmitHandoff` — NEW
- **Gate battery**: BLOCKED (session_note 0 seed rows — F0.4 blocker)

### 8. Shift proposal (`Send forslag`)

- **Button**: `forms.jsx:336` (ShiftApprove propose mode)
- **Mutation**: UPDATE `shift_approval.status='proposed'`; send notification to employee
- **Event**: `reconciliation shift_proposal_sent` — **MISSING from registry**
- **Hook needed**: extend `useApproveShiftHours` with `mode: 'propose'` or new `useProposShiftHours`
- **Action**: Add event to registry + extend hook

### 9. Bulk approve (`Godkjenn N dager`)

- **Button**: `forms.jsx:233` (BulkApprove run), `daglig.jsx:47` (Godkjenn valgte)
- **Mutation**: UPDATE `daily_reconciliation.status=approved` ×N (atomic per row)
- **Event**: `reconciliation bulk_approved` — **MISSING from registry**
- **Hook needed**: `useBulkApproveReconciliation` — NEW (wraps `useApproveReconciliation` ×N or server action)
- **Gate battery**: BLOCKED (no seed rows)

### 10. Export (`Eksport` / `Eksporter`)

- **Buttons**: `avstemming.jsx:153`, `daglig.jsx:170`
- **Mutation**: CSV generation (client-side `_lib/csv-export.ts`)
- **Event**: `reconciliation exported` — **MISSING from registry**
- **Hook needed**: add `emit()` call to `csv-export.ts` export function
- **Gate battery**: unit test that emit fires on CSV download

---

## Phase 3 — Secondary tabs (lower priority, new hooks + events)

### 11. Handoff resolve/escalate/remind/reject (Handoffs tab)

- **Buttons**: `more.jsx:244–247`
- **Events needed**: `handoff resolved`, `handoff escalated`, `handoff reminder_sent`, `handoff rejected` — **ALL MISSING**
- **Hooks needed**: `useResolveHandoff`, `useEscalateHandoff`, `useHandoffReminder`, `useRejectHandoff`

### 12. Occupational period close (Yrke wizard)

- **Button**: `more.jsx:81`
- **Event**: `reconciliation occupational_closed` — **MISSING**
- **Hook needed**: `useCloseOccupationalPeriod`

### 13. Season close (Sesong wizard)

- **Button**: `more.jsx:174`
- **Event**: `reconciliation season_closed` — **MISSING**
- **Hook needed**: `useCloseSeasonPeriod`

### 14. Policy settings (Innstillinger)

- **Inputs**: `more.jsx:275–277` (toggle/number/seg per policy field)
- **Event**: `reconciliation policy_updated` — **MISSING**
- **Hook needed**: `useUpdateReconciliationPolicy` (upsert policy config row)

---

## Control Point DoD

All 5 control points must be true before this domain can be declared implementation-ready:

| Control point                        | Status                                  | Blocking?             |
| ------------------------------------ | --------------------------------------- | --------------------- |
| `every_element_mapped`               | 97/97 mapped ✓                          | —                     |
| `every_mutation_has_event`           | 11 events MISSING                       | YES — add to registry |
| `every_event_registry_status_known`  | All 40 mutation events status-checked ✓ | —                     |
| `every_mutation_has_hook_or_flagged` | 9 hooks missing (flagged)               | YES — write hooks     |
| `baseline_count_recorded`            | 97 elements recorded ✓                  | —                     |

---

## Gate Battery Reference

Gate battery is **BLOCKED at e2e level** until F0.4 (`70-reconciliation.sql`) seeds:

- `daily_reconciliation` (0 rows)
- `shift_approval` (0 rows)
- `session_note` (0 rows)

Unit-level tests (hook mutation + emit mock) are unblocked and should be written in parallel.

| Test                                                                   | Level            | Blocked?     |
| ---------------------------------------------------------------------- | ---------------- | ------------ |
| approveDay → status=approved + emit admin_action                       | unit/integration | no           |
| rejectDay → status=open + emit admin_action                            | unit/integration | no           |
| lockDay → status=locked + emit locked                                  | unit/integration | no           |
| approveShift → shift_approval.status=approved                          | unit/integration | no           |
| resolveDeviation → deviation.status=resolved + emit deviation resolved | unit/integration | no           |
| bulkApprove N days → N rows approved                                   | e2e              | BLOCKED F0.4 |
| handoff submit → session_note inserted                                 | e2e              | BLOCKED F0.4 |
| revenueAdjust → revenue_total updated                                  | e2e              | BLOCKED F0.4 |
