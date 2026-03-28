---
title: Financial ESP — User Journeys
status: done
updated: 2026-03-28
created: 2026-03-28
module: operations
tags: [journey, financial-close, reconciliation, kpi, budget]
---

# Financial ESP — User Journeys

## Journey 1: Employee Submits Daily Settlement

**Role:** Employee (on closing shift)
**Precondition:** Employee has a published/active/completed shift on the target date.

1. Employee opens Schedule page -> clicks on today's date in the grid
2. Day Control drawer opens -> Employee clicks "Okonomi" tab
3. System shows: Budget vs Actual section (budget target from workspace_budget, no registered data yet)
4. Employee clicks "Registrer dagsoppgjor" button
5. Form appears: Total omsetning (required), Kort, Kontant, MVA, Transaksjoner, Kontantkasse opptalt
6. Employee fills in values from POS closing screen and terminal settlement
7. Employee clicks "Send inn"
8. System: creates/upserts daily_reconciliation row (status=submitted, revenue_source=manual)
9. System: emits "reconciliation submitted" telemetry event
10. Employee sees: "Venter pa godkjenning" amber banner
11. Budget vs Actual section now shows registered values alongside budget targets

**Postcondition:** daily_reconciliation row exists with status=submitted. Admin can see it in Avstemming view.

**Error paths:**

- No shift on this date -> Employee can view but not submit (RLS blocks insert/update)
- Total omsetning = 0 or empty -> Submit button disabled
- Network error -> Toast error, form state preserved for retry

---

## Journey 2: Admin Approves Daily Settlement

**Role:** Admin / Manager
**Precondition:** At least one daily_reconciliation with status=submitted exists.

1. Admin opens Dashboard -> sees "Avstemming" in sidebar navigation
2. Admin clicks "Avstemming" -> Reconciliation page loads
3. Left panel: DayList shows submitted days with amber "Innsendt" badge
4. Admin clicks a submitted day
5. Right panel: DayApproval shows 3 tabs:
   - Revenue: total, card, cash, VAT, transaction count (from employee input)
   - Shifts: all shifts for the day with planned vs calculated hours
   - Deviations: any system-flagged or manual deviations
6. Admin reviews revenue numbers against their own records
7. Admin approves individual shift hours (or edits with justification)
8. Admin resolves any blocking deviations
9. Admin clicks "Godkjenn" button
10. System: updates daily_reconciliation status=approved
11. System: fires reconciliation.approved engine event
12. System: cascade_reconciliation_close action triggers:
    - Aggregates shift_cost_snapshot -> total_labor_cost
    - Calculates revenue_per_worked_hour and labor_percentage
13. System: KPIs now visible in all dashboards

**Postcondition:** Day is approved. Labor cost, revenue/hour, and labor % calculated. Data flows to Operations chart, StrategicView KPIs, and Reports.

**Error paths:**

- Deviations not resolved -> Approve button disabled
- Admin rejects -> status reverts to open, rejection reason stored, closer notified
- Shift hours disputed -> Admin edits with required justification

---

## Journey 3: Admin Configures Financial Close Rules

**Role:** Admin / Owner
**Precondition:** Workspace exists with admin access.

1. Admin opens Settings -> General section -> "Dagsoppgjor" tab
2. Settings page shows 3 sections:
   - Toleranse for avvik: type (fast belop/prosent) + verdi
   - Kontantkasse: toggle for required cash count + tolerance
   - Godkjenning: toggle for required approval + deadline hours
3. Admin adjusts values (e.g., tolerance from 50 NOK to 100 NOK)
4. Admin clicks "Lagre innstillinger"
5. System: upserts financial_close_config row
6. System: shows "Lagret!" confirmation

**Postcondition:** financial_close_config updated. New tolerance applied to future settlements.

**Error paths:**

- No config row exists -> defaults used (50 NOK fixed, cash required, approval required, 24h deadline)
- Network error -> Toast error, form state preserved

---

## Journey 4: Admin Reads Live Financial Dashboards

**Role:** Admin / Manager
**Precondition:** At least one approved reconciliation exists.

1. Admin opens Dashboard -> StrategicView (top section)
2. Sees 6 KPI cards:
   - Opplaeringsberedskap: real % from protocol_assignment
   - Oppgavefullfoering: placeholder (null)
   - Tid til jobbklar: placeholder (null)
   - Varekostnad %: "Kobles til regnskap" (honest placeholder)
   - Personalomsetning: real % (departed profiles / avg active, 90 days)
   - Fravaersrate: real % (approved absences / planned shifts, 30 days)
3. Each KPI shows target, actual value, and good/bad status color

4. Admin navigates to Operations (/dashboard/operations)
5. Hourly revenue vs labor cost chart shows:
   - Green bars: revenue distributed by hour factors
   - Red bars: real labor cost from shift_cost_snapshot
   - "(estimert)" label if no real cost data exists
6. Stress level, staff presence, task completion — all real

7. Admin navigates to Schedule -> clicks a day -> Okonomi tab
8. Sees: Budget target, registered revenue, calculated labor cost
9. If approved: sees revenue/hour and labor % KPIs

10. Admin navigates to Reports
11. Staffing section shows labor hours trend with real budget targets (not 600)
12. Overview KPIs computed from real workspace data

**Postcondition:** Admin has full visibility into financial performance — all numbers are real.
