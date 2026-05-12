---
title: "Journey — Admin adjusts time-bank balance"
feature: payroll-phase-1
journey: admin-adjusts-time-bank
status: verified
verified_at: null
e2e_test: null
created: 2026-05-06
updated: 2026-05-07
module: payroll
tags: [journey, payroll, admin, time-bank, toil, feriepenger, wellness]
---

# Journey: Admin adjusts time-bank (TimebankPanel)

**Role:** admin (only — for adjust + force_payout) / employee (own balance read-only)

**Precondition:**
- Ansatt har aktiv `employee_payroll_profile`
- `payroll.timebank_entry` tabel populated av tidligere accruals (feriepenger NOK + TOIL hours + wellness hours)

## Happy Path

### Admin justerer saldo manuelt (sjelden, audit-krevende)

1. Admin åpner `/dashboard/people/[id]/complete-data` HR-tab → ser `<TimebankPanel profileId={...} />` under LonnsprofilSection
2. TimebankPanel viser 3 saldo-kort: Feriekonto (NOK), Avspasering (timer), Velferdsdager (dager) → hver m/ "Vis ledger" + "Justér" knapper
3. Admin klikker "Justér" på Avspasering → System åpner AdjustModal m/ form: nåværende saldo (read-only), endring (+/- timer), required reason (min 5 chars)
4. Admin fyller ut: "+8t" + reason: "Korrekt OT-mode missed for vakt 12. mars" → klikker "Lagre"
5. Server Action kaller capability tool `adjust_timebank_balance(profile_id, account_type='toil_hours', delta=8.0, reason)`:
   - Verify profile i workspace (ADR-0151)
   - Verify account_type valid for profil's plan
   - INSERT `payroll.timebank_entry` m/ `entry_type='adjustment'`, `delta=8.0`, `reason`, `actor_profile_id`
   - Emit `payroll.timebank_balance_adjusted`
6. UI: TimebankPanel saldo refresh → "Avspasering: 32t (+8t)" + ledger-row vises m/ admin-actor + reason

### Admin tvinger payout (force flush balance til lønnsgrunnlag)

7. Admin klikker "Tving utbetaling" på Avspasering → AdjustModal viser "Dette utbetaler hele saldoen som lønn på neste periode-lukk. Reason påkrevd."
8. Admin fyller ut: reason "Avtalt sluttutbetaling ved oppsigelse" → klikker "Bekreft"
9. Tool `force_timebank_payout(profile_id, account_type='toil_hours', reason)`:
   - Assert balance > 0
   - INSERT `timebank_entry` m/ `entry_type='payout'`, `delta=-32.0` (full saldo)
   - Trigger `recalculate_period` for active åpne periode
   - Emit `payroll.timebank_payout_forced` + `payroll.recalc_triggered`
10. UI: TimebankPanel viser "Avspasering: 0t" + ny ledger-row "Payout -32t (admin: ABC, reason: ...)" + neste periode's payroll_calculation oppdatert

### Employee read-only

11. Ansatt åpner mobile `(me)/payroll/timebank.tsx` → ser samme 3 saldo-kort + chip-filter (Feriepenger/Avspasering/Velferdsdager) → klikker filter → ledger filtrert
12. Read-only: ingen Justér/Force-knapper. Capability `query_timebank_balance` (read_only/employee) i bunn

**Postcondition:**
- `payroll.timebank_entry` har audit-row m/ actor + reason for hver mutation
- Saldo immutable beregnet via `SUM(delta) OVER PARTITION BY account_type`
- Ansatt ser endringen umiddelbart (real-time via Supabase Realtime, optional Phase 2)
- Calc-engine på neste recalc reflekterer payout som payroll-line

## Error Paths

- **Force payout m/ saldo=0:** Tool returnerer `error: 'no_balance'` → UI toast "Ingen saldo å utbetale"
- **Negativ adjustment > saldo:** Tool returnerer `error: 'negative_balance_not_allowed'` → UI feilmelding
- **Reason mangler:** Schema validation Zod → 400-tool-error
- **Ikke-admin:** gateAction (ADR-0204) blokker ikke-admin på `adjust_timebank_balance` + `force_timebank_payout`

## Verification

- [ ] Implementation matches the steps above
- [ ] E2E test exists and passes
- [ ] Manuelt: adjust + force-payout-flow på golden-month profil
- [ ] Saldo-formel matcher SUM(delta)
- [ ] activity_trail har full audit-kjede
- [ ] Mobile read-only — ingen mutation-tools kallbare fra mobile
- [ ] Chip-filter på mobile fungerer for alle 3 account_type

**Mark `status: verified` in frontmatter when all seven boxes are checked.**
