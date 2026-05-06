---
title: "Journey — Manager closes period"
feature: payroll-phase-1
journey: manager-closes-period
status: verified
verified_at: null
e2e_test: null
created: 2026-05-06
updated: 2026-05-07
module: payroll
tags: [journey, payroll, manager, period-close]
---

# Journey: Manager closes period

**Role:** manager (or admin)

**Precondition:**
- Workspace har minst én `payroll_period` med `status='open'` og `end_date` ≤ today
- Calc-engine har kjørt minst én gang for perioden (rader i `payroll_calculation`)
- Workspace har konfigurert `payroll.workspace_settings`
- Ansatte har minst én `time_entry` som dekker periode-rangen

## Happy Path

1. Manager åpner `/dashboard/payroll` → System lister åpne perioder sortert `end_date DESC` → Manager ser én rad med totals (brutto/netto/timer)
2. Manager klikker periode-rad → System routes til `/dashboard/payroll/[periodId]` → Manager ser PeriodHeader + 5 tabs (Linjer/Avvik/Manuelt tillegg/Tipspott/Eksport)
3. Manager klikker tab "Avvik" → System viser DeviationList sortert severity DESC → Manager ser 8 avvik (5 warnings + 3 errors)
4. Manager klikker error-rad → System åpner DeviationDrawer m/ detaljer (regel-ref + paragraf-ref + suggested action) → Manager forstår hvorfor avviket fyrte
5. Manager klikker "Bekreft" på hver av 3 errors → System oppdaterer `payroll_deviation.acknowledged_by` + `acknowledged_at` + emit `payroll.deviation_acknowledged`
6. Etter alle 3 errors ack'd → System enabler "Lås periode"-knappen i header
7. Manager klikker "Lås periode" → System åpner LockModal m/ totals-summary + lås-bekreftelse-checkbox + tips-merge-preview ("12 tips-utbetalinger fra 4 pools merges inn")
8. Manager bekrefter checkbox → klikker "Lås" → Server Action kaller capability tool `lock_period(period_id)`:
   - Verifiser period i workspace (ADR-0151)
   - Assert ingen `severity='error' AND acknowledged_by IS NULL`
   - Sett `payroll_period.status='locked'` + `locked_at=now()` + `locked_by=actor_profile_id`
   - Merge tips: UPDATE `tip_distribution` set `payroll_period_id=$1, paid_at=now(), status='paid'` for alle approved pools i period-range; UPDATE `tip_pool.status='paid'`
   - Frys tariff snapshot på `shift_cost_snapshot.tariff_rate_snapshot` (allerede frosset Day 3, verify integrity)
   - Emit `payroll.period_locked` + `payroll.tips_merged`
9. UI: toast success ("Periode april 2026 låst, 12 tips-utbetalinger merget"), modal lukker, periode-rad i list-view oppdatert m/ "🔒 Låst" badge

**Postcondition:**
- `payroll_period.status='locked'`, `locked_at`/`locked_by` populated
- Alle approved tip_pools i period-range har `status='paid'`, distributions har `payroll_period_id` + `paid_at`
- `payroll_calculation` rader urørt (immutable)
- `shift_pay_calculation_event` ber audit-rader frosset (re-run gir identisk resultat)
- Telemetry events i activity_trail + posthog
- Lock-knapp grå (re-locked-attempt blokkert)

## Error Paths

- **Uack errors:** Manager klikker "Lås" m/ uack errors → System BLOCK m/ klar UI-melding "Du kan ikke låse perioden. 3 avvik krever bekreftelse" → Lock-knapp forblir disabled → emit `payroll.deviation_blocked_approval`
- **Concurrent lock:** Annen manager låser samme periode samtidig → Andre manager får 409-Conflict m/ "Periode allerede låst av X kl. HH:MM" → State auto-refresh
- **Tips merge fail:** En `tip_pool` har integrity-issue (ikke-approved, men passer match) → Hele lock transactional rollback → toast error → manuell support
- **Tariff drift:** `tariff_freeze_drift` event triggered (sjelden) → Lock blokket m/ "Tariff har endret seg etter snapshot — kontakt support" → manuell intervensjon

## Verification

- [ ] Implementation matches the steps above
- [ ] E2E test exists and passes (path in `e2e_test:` frontmatter)
- [ ] Manually tested end-to-end på golden-month workspace
- [ ] All telemetry events fire med korrekt actor_id + workspace_id (ADR-0193)
- [ ] LockModal disabled ↔ enabled state matches `unacked === 0`-invariant
- [ ] Re-run `recalculate_period(locked_id)` returnerer identiske rader (frozen tariff)

**Mark `status: verified` in frontmatter when all six boxes are checked.**
