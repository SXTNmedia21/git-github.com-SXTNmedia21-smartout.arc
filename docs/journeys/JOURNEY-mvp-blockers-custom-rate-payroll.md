---
title: "Journey — Custom-rate ansatt får riktig lønn (ikke kr 0)"
feature: mvp-blockers
journey: custom-rate-payroll
status: draft
verified_at: null
e2e_test: null
created: 2026-05-10
updated: 2026-05-10
module: payroll
tags: [journey, payroll, ship-blocker, sma-344, sma-345]
---

# Journey: Custom-rate ansatt får riktig lønn

**Role:** ansatt (passive — sjekker lønnsgrunnlag) + admin (verifiserer beregning)

**Precondition:** Ansatt har signert kontrakt med `hourly_rate=280` (custom rate, ikke tariff). Periode er åpen + beregnet.

## Happy Path

1. Admin signerer ansatt-kontrakt med `hourly_rate=280` på `/dashboard/people/[id]/complete-data`
2. `sync_payroll_on_contract_signed()` trigger fyrer
3. Trigger writer `hourly_rate=280` til `employee_payroll_profile.hourly_rate` (NEW kolonne i 20260528100000)
4. Manager kjører "Beregn på nytt" på periode
5. `snapshot-period-costs` resolver kalles per ansatt:
   - Ansatt-A (custom): `payrollProfile.hourly_rate=280` → `baseHourlyRateNok=280`, source=`column`
   - Ansatt-B (tariff): `payrollProfile.hourly_rate=null` → tariff-lookup 215, source=`tariff`
   - Ansatt-C (monthly): `monthly_salary=50000`, `remuneration_type=monthly` → 50000/162.5≈307.69, source=`monthly_derived`
6. Telemetry per shift inkluderer resolver-source
7. Botsson `salary_query` tool kall fra ansatt: "hva er min hourly rate?" → 280 NOK (ikke crash)
8. Lønnsgrunnlag PDF viser brutto basert på riktig timesats × timer × tillegg-prosent

**Postcondition:** Ingen ansatt får kr 0 base pay (med mindre konfigurasjon helt mangler — da source=`none` + log warn).

## Error Paths

- **Migration backfill misses NULL contracts:** `hourly_rate` blir NULL → resolver faller tilbake til tariff. Logges, ikke feil.
- **`salary_query` Botsson tool kalles før migration:** crash unngås fordi migration shipper FØR tools.ts SELECT-fix
- **Tariff-binding off + ingen custom rate:** source=`none` → warn-log → supplement % beregnes som 0. Manager må fikse i Lønnsprofil.

## Verification

- [ ] All 4 nye kolonner exists i `employee_payroll_profile` (verified i Postgres)
- [ ] sync trigger persisterer rate på contract-sign (pgTAP test)
- [ ] `salary_query` Botsson tool returnerer hourly_rate uten crash
- [ ] `snapshot-period-costs` resolver dekker 4 paths (column/monthly/tariff/none)
- [ ] Vitest golden case for resolver
- [ ] Re-test May 2026 demo: Anne unchanged (tariff fallback), custom-rate test profile får ny verdi
- [ ] Linear: SMA-344 + SMA-345 begge lukket

**Mark `status: verified` when all boxes are checked.**
