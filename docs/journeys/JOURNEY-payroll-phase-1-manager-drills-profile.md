---
title: "Journey — Manager drills profile"
feature: payroll-phase-1
journey: manager-drills-profile
status: draft
verified_at: null
e2e_test: null
created: 2026-05-06
updated: 2026-05-06
module: payroll
tags: [journey, payroll, manager, drill-down, transparency]
---

# Journey: Manager drills profile (transparency-trace)

**Role:** manager (or admin)

**Precondition:**
- Periode-detalj-side åpnet (`/dashboard/payroll/[periodId]`)
- LinesTable populated m/ minst én profil-rad
- Calc-engine har kjørt → rader finnes i `payroll_calculation`, `shift_pay_calculation_event`

## Happy Path

1. Manager står på "Linjer"-tab → ser 12 ansatte m/ totals per kolonne (gross/net/hours/supplements)
2. Manager klikker profil-rad "Anna Hansen" → System åpner `LineDrawer` (right-side drawer m/ 3 tabs: Vakter / Linjer / Audit)
3. **Tab "Vakter":** System lister Anna's 22 vakter for periode → ShiftBreakdownTable viser per vakt: dato, fra/til, dept, base hours, tariff-tillegg-fired (e.g. "kveldstillegg 16.01 × 4t = 64.04 kr"), shift-cost-total
4. Manager klikker en spesifikk vakt (e.g. "5. april 17:00-23:00") → System ekspanderer rad m/ Layer 3 + Layer 4 viz: "Pause 30 min trukket → 5.5t arbeid → klassifisert: 4t (17-21 ordinær) + 1.5t (21-22:30 kveld 16.01 kr/t) + 0t natt → snapshot-cost: 547 kr (timelønn) + 24.02 kr (tillegg) = 571.02 kr"
5. **Tab "Linjer":** System viser per pay-code aggregat: ordinær-timer / kveldstillegg / helgetillegg / nattillegg / overtid 50 / overtid 100 / tipspott / feriepenger-grunnlag → hver med formel + total
6. Manager klikker "Tipspott 234.50 kr" → System åpner sub-drawer m/ 4 tip_pool-rader → klikk en pool → ser `tip_distribution.calculated_amount` 67.32 + adjustment +5.00 (reason: "lagdtid lørdag") = 72.32 kr → ref tilbake til `tip_pool.id` + `department_session_id`
7. **Tab "Audit":** System lister alle `shift_pay_calculation_event` for Anna i perioden, sortert `created_at` → viser supplement_rule fired + tariff_rate_table snapshot + provenance JSONB → manager kan eksportere som CSV
8. Manager lukker drawer → tilbake til LinesTable, raden er fortsatt highlighted

**Postcondition:**
- Manager har full kjede: pay-code-total → vakt → time-bucket → regel + sats + tariff-versjon
- Hver krone er forklart (Pontus' transparency-krav)
- Ingen mutations gjort
- Drawer-state ikke persistert (ny åpning = ny load)

## Error Paths

- **Tariff-snapshot mangler:** Calc har ikke kjørt → Drawer viser "Calc-engine har ikke kjørt for denne perioden" m/ knapp "Kjør recalc" → trigger `recalculate_period` RPC
- **Empty drilldown:** Profil har 0 vakter i perioden → Drawer viser "Ingen vakter i denne perioden" m/ link til schedule-side
- **Stale data:** En annen manager justerer tariff på OPEN periode mens drawer er åpen → toast "Data oppdatert" + auto-refresh

## Verification

- [ ] Implementation matches the steps above
- [ ] E2E test exists and passes
- [ ] Manuelt verifisert: drilldown for golden-month Anna matcher hand-computed
- [ ] Trace-kjede: pay_component → shift_pay_calculation_event → tariff_rate_table.law_version + framework_rule_id (ADR-0251 invariant)
- [ ] Audit-tab viser tip_pool-ref når pay-code='tips_taxable' (O36)
- [ ] Performance: drawer-load < 800ms for 30 vakter (måles vs spec)

**Mark `status: verified` in frontmatter when all six boxes are checked.**
