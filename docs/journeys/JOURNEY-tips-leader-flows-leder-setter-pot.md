---
title: "Journey — Leder registrerer tips-pot"
feature: tips-leader-flows
journey: leder-setter-pot
status: draft
verified_at: null
e2e_test: null
created: 2026-04-29
updated: 2026-04-29
module: payroll
tags: [journey, tips, payroll]
---

# Journey: Leder registrerer tips-pot på dagens dagskontroll

**Role:** manager (department-leder)

**Precondition:**
- `tips_workspace_settings.tips_enabled = true` for workspace
- En åpen `department_session` finnes for dagens dato + leders avdeling
- Leder har autoritet `min_role >= 'manager'` på `tips.set_pot` capability
- Ingen eksisterende `tip_pool`-rad for denne `department_session_id` (UNIQUE)

## Happy Path

1. Leder åpner DayControlPanel → Økonomi-tab på dagens dato
2. Tips-tile viser "Ingen pot registrert" (tom-tilstand)
3. Leder trykker "Registrer tips" → modal åpnes
4. Leder taster pot-beløp (NOK) + velger algoritme (`equal | by_hours | by_role`)
5. Leder bekrefter → klient kaller `tips.set_pot` capability via stage-engine
6. Capability-tool: `callTipsGate('set_pot')` → gate svarer `allow` → INSERT i `tip_pool` (status=`draft`) → emit `tip_pool created`
7. UI viser tile med beløp + status `draft` + knapp "Beregn distribusjon"

**Postcondition:**
- `tip_pool`-rad finnes med `(department_session_id, amount_ore, algorithm, status='draft')`
- `engine_event` + `activity_trail` har `tip_pool created`-event med `actor_id` + `workspace_id`
- Tile på Økonomi-tab viser pot-beløp og status

## Error Paths

- **`tips_enabled = false`** → Tips-tile vises ikke på Økonomi-tab i det hele tatt (master-toggle)
- **Allerede pot for sesjonen** → modal viser "Pot allerede registrert" + henviser til "Juster"-flow (UNIQUE constraint fanger DB-sida også)
- **Manglende rolle** → gate svarer `deny`, capability returnerer `{ok:false, error:'unauthorized'}`, modal viser "Du har ikke rettigheter"
- **Beløp <= 0 eller > 100 000 NOK** → klient-validering blokkerer; server-side Zod-schema fanger om klient bypasses
- **Network/RPC-feil på gate** → fail-CLOSED, modal viser "Kunne ikke kontrollere autoritet, prøv igjen"

## Verification

- [ ] Implementation matches the steps above
- [ ] E2E test exists and passes (path in `e2e_test:` frontmatter)
- [ ] Manually tested end-to-end

**Mark `status: verified` in frontmatter when all three boxes are checked.**
