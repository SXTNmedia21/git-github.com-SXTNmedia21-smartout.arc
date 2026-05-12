---
title: "Manual Test — payroll-phase-2"
status: done
updated: 2026-05-08
created: 2026-05-08
module: payroll
tags: [manual-test, payroll, phase-2, runbook]
---

# Manual Test Runbook — payroll-phase-2

Operator runbook for verifying Phase 2 end-to-end flows. Run against local Supabase + dev server.

---

## Prerequisites

- Local Supabase running: `pnpm supabase start` (no op-run wrap — see L: op-run corrupts gen types)
- Dev web server running: `op run --env-file=.env.template -- pnpm --filter web dev`
- Two test accounts in the same workspace:
  - **Manager account** — role=manager, has `add_manual_supplement` + `override_calculation_line` authority
  - **Admin account** — role=admin, has `approve_proposal` authority
- At least one open payroll period (`status='open'`) with at least one employee who has shifts in the period
- The open period must have at least one derived `payroll_calculation_line` row (run recalculate-period first if needed)

---

## Flow 1 — Manager adds manual supplement via Screen 06 form

**Goal:** 200 NOK Bonus supplement added → recalc fires → total visible <2s.

### Steps

1. Log in as **manager**.
2. Navigate to `/dashboard/payroll` → click the open period.
3. Verify "+  Manuelt tillegg"-knappen is visible in header area (it is only shown for `status='open'`).
4. Click "+ Manuelt tillegg" → Modal opens (Screen 06 ManualSupplementForm).
5. Fill in:
   - **Ansatt**: select any employee in the dropdown
   - **Type**: Bonus (should be default-selected)
   - **Beløp**: 200
   - **Lønnskode**: 5210 (auto-filled for Bonus)
   - **Beskrivelse**: "Ekstra hjelp Skjærtorsdag"
   - **Skattepliktig**: ON (default)
   - **Dato**: any date inside the period range
6. Click "Legg til linje".

### Assertions

- [ ] Modal closes with toast "Lønnslinje lagt til."
- [ ] LinesTable refreshes — employee's row shows updated `totalPay` (previous + 200)
- [ ] Update happens within ~2 seconds (Pattern B sync-recalc)
- [ ] Click the employee row to open LineDrawer → Linjer tab → verify a `manual_adj` line exists with description containing "[Bonus] Ekstra hjelp Skjærtorsdag"
- [ ] Check DB: `SELECT * FROM payroll.manual_supplement WHERE workspace_id = '<ws>' ORDER BY created_at DESC LIMIT 5;` — new row present
- [ ] Check DB: `SELECT * FROM activity_trail WHERE workspace_id = '<ws>' ORDER BY created_at DESC LIMIT 5;` — event row with `event_type LIKE '%manual_supplement_added%'` present with actor_id = manager profile_id

### Try error case: locked period

1. Repeat steps 1-2 but open a period with `status='locked'`.
2. Verify "+ Manuelt tillegg" button is NOT rendered (PeriodDetailClient only renders when `isOpen`).
3. If you can reach the BFF directly (e.g. via curl): POST to `/api/payroll/add-manual-supplement` with the locked period_id → expect HTTP 409 with `error: "period_not_open"`.

---

## Flow 2 — Manager proposes line override → admin approves → recalc fires

**Goal:** Full override chain: proposal → approval → supersession → updated total.

### Steps (manager)

1. Log in as **manager**.
2. Navigate to open period → click an employee row → LineDrawer.
3. Click **Linjer** tab.
4. Find any line that is NOT `manual_adj` type (e.g. "Arbeidstimer", "Tillegg" — these show "Overstyr"-button).
5. Click **Overstyr** on a derived line. The "Overstyr linje"-modal opens.
6. Fill in:
   - **Foreslått ny verdi**: any positive amount different from the original (e.g. `80`)
   - **Kategori**: Tariff-tolkning
   - **Grunn**: "Tariff-tolkning §6 — kveldstillegg gjelder hele vakt iht. lokal avtale" (min 8 chars)
7. Click "Send forslag".

### Assertions (post-proposal)

- [ ] Toast "Forslag sendt" appears
- [ ] LineDrawer Linjer tab: the overridden line now shows "Venter godkjenning"-badge (orange pill)
- [ ] "Overstyr"-button is hidden on that line (replaced by badge)
- [ ] Check DB: `SELECT * FROM change_proposal WHERE workspace_id = '<ws>' ORDER BY created_at DESC LIMIT 5;` — row with `kind='wage_line_override'`, `status='pending'` present

### Steps (admin)

1. Log in as **admin** (same workspace).
2. Navigate to `/dashboard/proposals`.
3. Find the pending proposal from the manager.
4. Click the proposal row → detail page shows: original amount, proposed amount, diff, reason, category, proposer.
5. Click **Godkjenn** → confirm modal appears with amount diff summary.
6. Click **Godkjenn** in confirm modal.

### Assertions (post-approval)

- [ ] Toast "Override godkjent. Recalc kjører." appears
- [ ] Browser redirects to `/dashboard/payroll/[periodId]`
- [ ] LinesTable shows the employee's updated total (includes the new override amount)
- [ ] Re-open LineDrawer for the same employee → Linjer tab: the line shows the new amount, badge changes to "Overstyrt" (or the line is replaced by the new version)
- [ ] Check DB audit chain:
  ```sql
  -- change_proposal should be 'applied'
  SELECT change_proposal_id, status, resolved_by, resolved_at
  FROM change_proposal
  WHERE workspace_id = '<ws>' AND kind = 'wage_line_override'
  ORDER BY created_at DESC LIMIT 5;

  -- New payroll.calculation row (derivation_version+1)
  SELECT id, profile_id, calculation_version, total_pay
  FROM payroll.calculation
  WHERE period_id = '<period_id>'
  ORDER BY calculation_version DESC LIMIT 10;

  -- Supersession event chain
  SELECT id, superseded_by_event_id
  FROM shift_pay_calculation_event
  WHERE period_id = '<period_id>'
  ORDER BY created_at DESC LIMIT 10;
  ```
- [ ] Original `payroll.calculation` row is UNCHANGED (verify by checking older calculation_version row still exists with original amount)

---

## Flow 3 — Admin rejects override

**Goal:** Rejected proposal → original line unchanged → reason captured.

### Steps

1. Submit a new override proposal (repeat Flow 2 steps 1-7 with a fresh line).
2. Log in as admin → `/dashboard/proposals` → click the pending proposal.
3. Click **Avvis** → reject-modal opens.
4. Enter a reason (required, e.g. "Tariff-tolkning er korrekt per gjeldende avtale").
5. Click **Avvis** in the modal.

### Assertions

- [ ] Toast "Override avvist." appears
- [ ] Browser redirects to `/dashboard/proposals`
- [ ] Proposal shows `status='rejected'` in the list
- [ ] Original payroll line is UNCHANGED — open LineDrawer for the employee; line still shows original amount, badge cleared
- [ ] Check DB: `SELECT status, rejection_reason FROM change_proposal WHERE ... ORDER BY created_at DESC LIMIT 5;` — `status='rejected'`, `rejection_reason` populated

---

## Flow 4 — Locked-period guards all 3 mutations

**Goal:** All mutation BFF routes reject with 409 when `period.status='locked'`.

### Setup

Locate (or manually create) a period with `status='locked'` in the test workspace.

### Test each guard

**A — Add supplement to locked period**

POST to `/api/payroll/add-manual-supplement` with the locked period_id:
```json
{
  "period_id": "<locked-period-id>",
  "profile_id": "<any-profile-id>",
  "type": "Bonus",
  "amount": 100,
  "description": "Test",
  "taxable": true,
  "date": "2026-04-15"
}
```
Expect: HTTP 409, `{ "error": "period_not_open" }`.

**B — Override line in locked period**

In the proposals UI, if a period becomes locked after a proposal was submitted: POST `/api/payroll/approve-proposal` with the proposal_id. Expect HTTP 409, `{ "error": "period_frozen" }`.

**C — Delete supplement from locked period**

DELETE `/api/payroll/delete-manual-supplement` with a supplement_id that belongs to a locked period. Expect HTTP 409, `{ "error": "period_not_open" }`.

**UI guard**

- [ ] Navigate to the locked period in the dashboard — "+ Manuelt tillegg" button is NOT rendered
- [ ] If LineDrawer is opened, "Overstyr"-buttons are absent on all lines (replaced by "Låst" hint text: `LineDrawer.tsx:420-422`)

---

## Flow 5 — Tip distribution approval triggers payroll recalc

**Goal:** Approve tip pool → tip_distribution rows created → recalc fires → `tips_taxable` line appears in LinesTable.

> Note: No dedicated web UI exists for tip pool approval on the dashboard. This flow requires either (a) calling the BFF directly or (b) using an existing tips UI surface if one exists in the workspace.

### Steps

1. Ensure a `tip_pool` exists with `status='recorded'` and `payroll_period_id` pointing to an open period. (If not: seed one directly in the DB.)
2. Call POST `/api/tips/approve-distribution` with `{ "pool_id": "<pool-id>" }` (authenticated as manager or admin with `tips.approve_distribution` authority).

### Assertions

- [ ] Response: `{ "ok": true, "pool_id": "...", "total_distributed": ..., ... }`
- [ ] Check DB: `SELECT status FROM tip_pool WHERE id = '<pool-id>';` → `status='approved'`
- [ ] Check DB: `SELECT status FROM tip_distribution WHERE pool_id = '<pool-id>';` → all rows `status='approved'`
- [ ] Check DB: `SELECT event_kind FROM engine_event WHERE ... ORDER BY created_at DESC LIMIT 10;` → row with `payroll.recalc_triggered_by_tip_distribution` present (from DB trigger)
- [ ] Navigate to `/dashboard/payroll/[periodId]` for the matching open period → LinesTable shows updated totals for employees who received tips
- [ ] Open LineDrawer for a tipped employee → Linjer tab shows a line with `line_type = 'tips_taxable'` (or equivalent) + amount matching the distributed tip
- [ ] Period locked-state: if period is locked when distribution fires, verify recalc is NOT called (DB trigger WHEN clause enforces this) and no `tips_taxable` line appears

---

## Smoke probe — recalc latency (T7.2)

Run after Flows 1-5 confirm correctness.

1. Ensure the open period has at least 12 employee profiles with shifts.
2. Call GET `/api/payroll/_smoke/recalc-latency` (admin-gated).
3. Verify response includes `duration_ms` < 2000.
4. If > 2000: flag as performance regression before Phase 1.5 ships.
