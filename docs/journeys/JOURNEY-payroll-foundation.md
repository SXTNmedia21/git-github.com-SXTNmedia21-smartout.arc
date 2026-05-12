---
title: User Journeys — Payroll Foundation
status: done
updated: 2026-03-22
created: 2026-03-22
module: payroll
tags: [journeys, payroll, mobile, web, absence, timebank, supplements, lønnsgrunnlag]
---

# User Journeys — Payroll Foundation

## Journey 1: Employee Views Absence Balance (Mobile)

**Precondition:** Employee is logged in, has an active profile, admin has configured absence types and granted quotas.

1. Employee opens app → Home screen shows PayrollHomeCard with "Feriedager: 18 av 25" (no_shift mode)
2. Employee taps "Se alt >" → navigates to Meg tab
3. Employee taps "Fraværssaldo" → AbsenceBalanceScreen opens
4. System queries `payroll.absence_quota` (current year) + `payroll.absence_ledger` (last 20 entries)
5. Employee sees balance rows per type: "Ferie — 18 av 25 dager", "Egenmelding — 3 av 4 tilfeller"
6. Employee scrolls down to "Siste bevegelser" → sees ledger entries with +/- amounts and dates

**Postcondition:** Employee has visibility into their remaining absence balances and transaction history.

**Error paths:**

- No quotas configured → empty state: "Ingen fraværskvoter er satt opp ennå. Kontakt din leder."
- Network error → error card with "Prøv igjen" retry button
- Offline → cached data shown with "Sist oppdatert" timestamp

---

## Journey 2: Employee Requests Absence (Mobile)

**Precondition:** Employee has absence quotas with remaining balance.

1. Employee opens Meg tab → taps "Fravær"
2. AbsenceRequestScreen opens → balance cards at top (Ferie 18/25, Egenmelding 3/4, Omsorgsdager 8/10)
3. Employee selects type: "Ferie"
4. Employee enters start date: 2026-04-14, end date: 2026-04-18
5. System runs `projectAbsenceBalance()` → projection shows: "5 virkedager · Saldo etter: 13 dager" (green)
6. Employee adds comment: "Påskeferie"
7. Employee taps "Send søknad" → haptic feedback
8. System enqueues `request_absence` via offline sync queue → optimistic cache update
9. Request appears in "Mine søknader" with status badge "Venter" (orange)
10. Manager approves on web → status changes to "Godkjent" (green) on next sync

**Postcondition:** Absence request created with status "pending", visible in request history.

**Error paths:**

- Insufficient balance → projection shows red "Ikke nok dager tilgjengelig", submit button disabled
- Overlapping request → warning: "Overlapper med eksisterende fravær 3.-5. mars"
- Instance limit exceeded (egenmelding) → `isAllowed: false`, submit disabled
- Network error during submit → Alert shown, form NOT reset so user can retry
- Employee cancels pending request → taps "Kanseller" on pending row → status changes to "Avslått"

---

## Journey 3: Employee Views Timebank Balance (Mobile)

**Precondition:** Employee has timebank entries (overtime accruals/withdrawals).

1. Employee opens Meg tab → taps "Timebank"
2. TimebankScreen opens with blue balance banner: "12.5 timer tilgjengelig for avspasering"
3. Below: ledger entries showing accruals (+green) and withdrawals (-red) with dates
4. Employee sees: "+2.0t Overtid — lørdag 15. mars" and "-4.0t Avspasering — 10. mars"

**Postcondition:** Employee understands their overtime bank balance.

**Error paths:**

- No timebank entries → "Ingen timer i timebanken ennå."
- Balance computation is client-side (tech debt — server-canonical in future)

---

## Journey 4: Employee Views Lønnsgrunnlag (Mobile)

**Precondition:** At least one payroll period is closed/exported.

1. Employee opens Meg tab → taps "Min lønn"
2. PayslipScreen opens with net pay hero: "kr 21 146 — Utbetalt"
3. Vacation strip shows: "Feriedager igjen i 2026: 18 av 25"
4. Breakdown shows: Arbeidstimer 142.5t, Grunnlønn kr 28 500, Tillegg kr 2 340 (with supplement badges), Overtid kr 1 200, Bruttolønn kr 32 040, Skattetrekk -kr 10 894, Utbetalt kr 21 146
5. Employee scrolls to "Tidligere" → taps "Februar 2026" → hero/breakdown updates to that period
6. All figures labeled "Avregnet i lønn" (trust tier: settled)

**Postcondition:** Employee can review current and historical lønnsgrunnlag.

**Error paths:**

- No lønnsgrunnlag yet → "Ingen lønnsgrunnlag tilgjengelig ennå. Ditt første lønnsgrunnlag vises her etter første lønnskjøring."
- Only periods with status 'closed' or 'exported' are shown — never draft/open periods
- PDF download button only shown when real document URL exists — no stub

---

## Journey 5: Employee Sees Supplement Badges on Shifts (Mobile)

**Precondition:** Admin has configured supplement rules, employee has upcoming shifts.

1. Employee opens Vakter tab → sees shift list
2. Saturday evening shift (16:00-23:00) shows two badges below details: "Kveldstillegg" (purple) + "Helgetillegg" (orange)
3. Weekday daytime shift (08:00-16:00) shows no badges
4. Public holiday shift shows "Helligdagstillegg" (red) badge
5. Employee understands which shifts pay extra without checking payroll settings

**Postcondition:** Supplements are visible as color-coded badges, helping employees understand shift value.

**Error paths:**

- No supplement rules configured → no badges shown (graceful)
- Rules loading → badges not shown until data arrives (no flash)

---

## Journey 6: Employee Views Live Earnings During Shift (Mobile)

**Precondition:** Employee is clocked in (during_shift phase).

1. Employee opens Home → sees punch-out button at top (action-first)
2. Below: PayrollHomeCard shows "Opptjent i dag" with pulsing live dot
3. Running total: "~kr 1 162" with "Foreløpig estimat" caption
4. Breakdown: Grunnlønn (5t 45m) kr 1 150, Kveldstillegg (45min) ~kr 12
5. Total updates every 60 seconds
6. Employee punches out → card switches to after_shift mode
7. after_shift shows: "Opptjent denne vakten" with actual earned total (no ~ prefix)
8. Trust label changes from "Foreløpig estimat" to "Registrert tid"

**Postcondition:** Employee sees real-time earnings estimate during shift and final recorded amount after.

**Error paths:**

- No hourly rate configured → card shows empty state
- Estimate disclaimer always visible: "Foreløpig estimat basert på planlagt tid og gjeldende satser. Endelig beløp kan avvike."

---

## Journey 7: Employee Views Lønnsgrunnlag on Web (Dashboard)

**Precondition:** Employee is logged into web dashboard, has closed payroll periods.

1. Employee navigates to "Min lønn" in sidebar
2. Three-column layout: period list (left), lønnsgrunnlag detail (center), balances (right)
3. Latest period auto-selected → hero shows net pay "kr 21 146" in green
4. Breakdown card shows full specification: grunnlønn, tillegg, overtid, bruttolønn, skattetrekk, utbetalt
5. Right sidebar shows absence balance (Ferie 18/25) and timebank (12.5t)
6. Employee clicks "Februar 2026" in period list → detail switches to that period
7. All figures trust tier: settled

**Postcondition:** Employee can review lønnsgrunnlag with full breakdown on web.

**Error paths:**

- No lønnsgrunnlag → "Ingen lønnsgrunnlag tilgjengelig ennå."
- Responsive: on mobile viewport, columns stack (detail first)

---

## Journey 8: Admin Views Reports with Real Data (Web)

**Precondition:** Admin is on the Reports page.

1. Admin opens Reports → Oversikt tab loads real data from Supabase
2. KPI strip shows: employee count, readiness %, shift coverage %, training compliance %
3. 7-day trend chart shows daily coverage from actual shift data
4. Department comparison shows real employee counts and coverage per department
5. Admin switches to Bemanning tab → sees weekly coverage from schedule_shift data
6. Admin switches to Medarbeidere tab → sees role distribution and tenure from profile + employment_contract
7. Admin switches to Opplæring tab → sees protocol compliance from protocol_assignment

**Postcondition:** Admin sees real operational data, not mock numbers.

**Error paths:**

- Empty workspace (no employees/shifts) → all metrics show 0 or "–"
- Query error → section shows error state with retry

---

## Journey 9: Manager Views Live Operations/Drift (Web)

**Precondition:** Manager is on the Operations page, there are active sessions today.

1. Manager opens Operations → sees 6 metric cards with real data
2. Task completion: "15 / 22 tasks done (68%)" from session_task
3. Staff present: "4 / 5" with names from today's schedule_shift + profile
4. Revenue vs Staff Cost chart: hourly bars from daily_reconciliation + shift cost calculation
5. Data auto-refreshes every 60 seconds
6. Future hours shown with muted styling

**Postcondition:** Manager has live visibility into today's operations.

**Error paths:**

- No sessions today → all metrics show "–" or 0
- No reconciliation data → chart shows empty state
