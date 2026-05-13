---
title: "Journey — Regnskapsfører ser feriepenger-grunnlag (ikke 0)"
feature: mvp-blockers
journey: feriepenger-basis
status: verified
verified_at: 2026-05-13
e2e_test: null
created: 2026-05-10
updated: 2026-05-10
module: payroll
tags: [journey, payroll, ship-blocker, sma-346, sma-348]
---

# Journey: Regnskapsfører ser feriepenger-grunnlag

**Role:** regnskapsfører (Maria-persona) + ansatt (selv-sjekk)

**Precondition:** Periode er låst. Ansatt har gjennomført vakter med base_pay > 0. `holiday_allowance_pct=12` (default Riksavtalen).

## Happy Path

1. Manager låser periode → lønnsgrunnlag-PDF + CSV genereres
2. PDF lønnsgrunnlag vises:
   - Header: brutto-grunnlag (eks: 16 681,30 NOK for Anne)
   - Linjer per vakt + tillegg
   - **Feriepenger-grunnlag: 2 001,76 NOK** (12% × 16 681,30)
   - Disclaimer: "(utbetales av regnskapsfører)"
   - Tooltip på label: "Smartout beregner grunnlag. Faktisk utbetaling håndteres av regnskapssystem."
3. CSV eksporteres med kolonne "Feriepenger-grunnlag" (riktig basis-verdi)
4. Regnskapsfører importerer CSV til Tripletex/Visma
5. Tripletex bruker basis × pct/100 til å akkumulere på regnskapsside
6. Når juni kommer: Tripletex beregner totalt akkrual + planlegger utbetaling

**Postcondition:** Maria-persona kan basere sin akkrual-beregning på Smartouts basis. Ingen 0-verdi som ville fått henne til å reject filen.

## Error Paths

- **`holiday_allowance_pct` mangler:** default 12% brukes (verifisert i seed-may-2026-demo.sql)
- **Over-60 ansatt (14.3%):** override håndtert via column-verdi, basis beregnes med 14.3
- **Periode med 0 base_pay (alle på ferie):** basis = 0 (legitimat)
- **PDF render error:** payroll.lonnsgrunnlag_generation_failed event + 500

## Verification

- [ ] All 4 routes (`generate-pdf-bundle`, `generate-pdf-single`, `export-period` ×2) computer basis (ikke hardkodet 0)
- [ ] Field renamed `feriepenger_accrued` → `feriepenger_basis` i types
- [ ] PDF + CSV header viser "Feriepenger-grunnlag"
- [ ] Tooltip + disclaimer i UI (LineDrawer + my-salary)
- [ ] Vitest golden case for basis compute (12%, 14.3%, 0-edge)
- [ ] ADR-0295 ferdig + registrert i decision-log
- [ ] May 2026 demo Anne: basis ≈ 2 002 NOK
- [ ] Linear: SMA-346 + SMA-348 begge lukket

**Mark `status: verified` when all boxes are checked.**
