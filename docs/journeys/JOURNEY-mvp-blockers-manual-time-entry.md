---
title: "Journey — Manager korrigerer missed punch via dialog"
feature: mvp-blockers
journey: manual-time-entry
status: draft
verified_at: null
e2e_test: null
created: 2026-05-10
updated: 2026-05-10
module: payroll
tags: [journey, payroll, ship-blocker, b5-bundle, sma-343]
---

# Journey: Manager korrigerer missed punch

**Role:** admin / manager

**Precondition:** Ansatt har vakt 2026-05-09 12:00-22:00 men glemte å stemple ut. `timesheet.time_entry` mangler `punched_out_at` for den vakta.

## Happy Path

1. Manager åpner `/dashboard/payroll/[periodId]` → klikker en ansatt → drawer åpner
2. Manager bytter til "Vakter"-tab → ser at lørdag 9. mai mangler clock-out
3. Manager klikker "Korriger tid"-knapp på den vakta (admin-gated, vises kun for admin/manager)
4. ManualTimeEntryDialog åpner med vakt-context i header
5. Manager fyller:
   - Stemplet inn: 2026-05-09 12:00 (autopopulert fra schedule)
   - Stemplet ut: 2026-05-09 22:00
   - Grunn: "Ansatt glemte å stemple ut" (min 8 tegn)
6. Manager klikker "Lagre korreksjon"
7. `manualTimeEntryAction` server-action kalles:
   - `gateAction({ capability: "shift.manual_time_entry", actionType: "create" })`
   - UPSERT i `timesheet.time_entry`
   - emit `shift.manual_time_entry_created` med actor + reason
8. Toast: "Tidsregistrering korrigert"
9. Dialog lukker
10. Manager kan nå "Beregn på nytt" på periode → vakta inkluderes med riktige timer

**Postcondition:** `time_entry` rad finnes for vakta. Audit-trail viser HVEM korrigerte + NÅR + HVORFOR.

## Error Paths

- **Reason < 8 tegn:** UI blokker submit + viser "X tegn igjen" rød tekst
- **Punch-in >= punch-out:** validation reject (UI eller BFF)
- **Periode låst:** action returnerer feil → toast "Periode låst — kan ikke korrigere"
- **Ikke admin/manager:** knapp vises ikke (admin-gated)
- **gateAction denied:** toast med reason

## Verification

- [ ] ManualTimeEntryDialog komponent ferdig
- [ ] "Korriger tid"-knapp i Vakter-tab (admin-gated)
- [ ] Dialog passer dato-felter, grunn-felt, validering
- [ ] `manualTimeEntryAction` blir kalt korrekt (verifiseres i Postgres at row insertes)
- [ ] Audit-trail entry skrives (activity_trail)
- [ ] Toast feedback fungerer
- [ ] Re-beregn av periode etter korreksjon — riktig timer
- [ ] Linear: SMA-343 (S1b bundle) lukket

**Mark `status: verified` when all boxes are checked.**
