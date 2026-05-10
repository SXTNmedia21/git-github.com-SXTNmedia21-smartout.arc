---
title: "Journey — Manager creates new lønnsperiode"
feature: mvp-blockers
journey: create-period
status: draft
verified_at: null
e2e_test: null
created: 2026-05-10
updated: 2026-05-10
module: payroll
tags: [journey, payroll, ship-blocker, sma-343]
---

# Journey: Manager creates new lønnsperiode

**Role:** admin / manager (payroll capability)

**Precondition:** Mai 2026 periode er låst. Juni-periode finnes ikke ennå.

## Happy Path

1. Manager går til `/dashboard/payroll`
2. Manager klikker "+ Ny periode"-knapp i header
3. CreatePeriodDialog åpner med dato-felter
4. Manager fyller inn start_date=2026-06-01, end_date=2026-06-30
5. Validation: start_date < end_date (live-feedback)
6. Manager klikker "Opprett periode"
7. POST `/api/payroll/create-period` → INSERT `payroll.period` med status='open'
8. emit `payroll.period_created`
9. Toast "Periode opprettet"
10. Periode-listen invalideres + ny rad vises (juni 2026)
11. Dialog lukker

**Postcondition:** Ny `payroll.period` rad med status='open'. Manager kan klikke seg inn på den.

## Error Paths

- **Duplikat (workspace_id, start_date, end_date):** BFF returnerer 409 → toast "Periode finnes allerede for disse datoene"
- **start_date >= end_date:** UI blokker submit-knapp + viser "Startdato må være før sluttdato" rød tekst
- **Multi-workspace user:** workspace_id fra `useWorkspace()` → BFF validerer membership; mismatch → 401
- **Non-admin role:** gateAction returnerer allow:false → 403 + toast "Mangler tilgang"

## Verification

- [ ] Implementation matches the steps above
- [ ] E2E test exists and passes (path in `e2e_test:` frontmatter)
- [ ] Manually tested end-to-end på May 2026 demo workspace
- [ ] BFF route + dialog + hook + button alle wired
- [ ] Linear: SMA-343 lukket

**Mark `status: verified` in frontmatter when all boxes are checked.**
