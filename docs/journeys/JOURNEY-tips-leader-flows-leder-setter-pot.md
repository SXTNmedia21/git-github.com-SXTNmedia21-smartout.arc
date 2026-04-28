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
- Aktiv `tip_policy`-rad finnes for `department_id` (admin har lagt til policy — out-of-scope her, antas eksisterende)
- Leder har autoritet `level=suggest, min_role>=manager` på `tips.set_pot` capability (auth-seed verified)
- Ingen eksisterende `tip_pool`-rad for denne `department_session_id` (UNIQUE)

## Happy Path

1. Leder åpner DayControlPanel → Økonomi-tab på dagens dato
2. Tips-tile viser "Ingen pot registrert" (tom-tilstand) + read-only badge med aktiv algoritme (f.eks. "by_hours" — hentet fra `tip_policy.method`)
3. Leder trykker "Registrer tips" → modal åpnes
4. Modal viser: pot-beløp-felt (NOK 2dp) + valgfri notes + algoritme-badge (read-only) + ansatt-liste fra `schedule_shift` for sesjonen (read-only forhåndsvisning)
5. Leder taster `amount_nok` + bekrefter
6. BFF route `/api/tips/set-pot` kaller stage-engine → `tips.set_pot` capability tool
7. Tool: `callTipsGate({capability:'tips.set_pot', actionType:'create', entityId:department_session_id})` → gate svarer `allow=true, requiresFourEyes=false`
8. Tool transaksjon (alt eller ingenting):
   - SELECT aktiv `tip_policy` for department + dato; hvis ingen → return `{ok:false, error:'no_active_policy'}`
   - SELECT shifts fra `schedule_shift` for `department_session_id` → kall `calculate(amountNok, shifts, policy)` → får liste `Distribution[]`
   - INSERT `tip_pool (workspace_id, department_session_id, policy_id, amount_nok, status='recorded', recorded_by, currency='NOK')` → returnerer `pool_id`
   - INSERT N `tip_distribution`-rader (én per shift) med `status='calculated'`, `calculated_amount`, `weight_applied`, `algorithm_snapshot`
9. Tool emit (ETTER alle DB-writes — ADR-0196 invariant 11):
   - `tip_pool created` med `{pool_id, department_session_id, amount_nok, distribution_count, algorithm}` (4 destinations)
   - N × `tip_distribution calculated` med `{pool_id, distribution_id, profile_id, calculated_amount, weight_applied}` (2 destinations)
10. Tool returnerer `{ok:true, pool_id, distribution_count, total_calculated}`
11. UI invaliderer `["tips-pool", department_session_id]` → tile re-rendrer med beløp + status `recorded` + ansatt-tabell forhåndsvisning + "Godkjenn på Oppgjør"-knapp som lenker til SignoffTab

**Postcondition:**
- `tip_pool` har en rad: `(department_session_id UNIQUE, amount_nok, status='recorded', recorded_by=actor_profile_id, recorded_at=now)`
- `tip_distribution` har N rader: `(pool_id, profile_id, status='calculated', calculated_amount, weight_applied, algorithm_snapshot)` — sum(`calculated_amount`) === `amount_nok` (sum-invariant)
- `engine_event` + `activity_trail` har `tip_pool created`-event; `engine_event` har N × `tip_distribution calculated`
- Tile viser pot + ansatt-tabell + "Godkjenn"-CTA

## Error Paths

- **`tips_enabled = false`** → Tips-tile vises ikke på Økonomi-tab (master-toggle via `useTipsEnabled`)
- **Allerede pot for sesjonen (UNIQUE)** → tool returnerer `{ok:false, error:'pool_exists'}` (DB CONFLICT fanger også); UI viser "Pot allerede registrert — gå til Reconciliation for justering"
- **Ingen aktiv tip_policy** → `{ok:false, error:'no_active_policy'}` → UI viser "Ingen tips-policy konfigurert for avdelingen — be admin opprette policy først"
- **Ingen shifts på sesjonen** → `calculate()` returnerer `[]` → tool returnerer `{ok:false, error:'no_shifts'}` → UI viser "Ingen ansatte registrert på vakt — kan ikke beregne distribusjon"
- **Manglende rolle** → gate svarer `allow=false, minRoleRequired='manager'` → `{ok:false, error:'unauthorized'}`; modal viser "Du har ikke rettigheter"
- **`amount_nok < 0`** → Zod blokkerer klient + DB CHECK fanger
- **Network/RPC-feil på gate** → fail-CLOSED (gate.ts:73), modal viser "Kunne ikke kontrollere autoritet, prøv igjen"
- **Transaksjon feiler på distribution INSERT** → ALT rulles tilbake (pool ikke opprettet), INGEN emit (ADR-0196 invariant 11)

## Verification

- [ ] Implementation matches the steps above
- [ ] E2E test exists and passes (path in `e2e_test:` frontmatter)
- [ ] Manually tested end-to-end

**Mark `status: verified` in frontmatter when all three boxes are checked.**
