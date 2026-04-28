---
title: "Journey — Leder godkjenner tips-distribusjon ved oppgjør"
feature: tips-leader-flows
journey: leder-godkjenner-distribusjon
status: draft
verified_at: null
e2e_test: null
created: 2026-04-29
updated: 2026-04-29
module: payroll
tags: [journey, tips, payroll]
---

# Journey: Leder godkjenner tips-distribusjon ved dagsoppgjør

**Role:** manager (department-leder)

**Precondition:**
- `tip_pool.status='calculated'` for sesjonen (distribusjon beregnet)
- Leder er på WebDayControl → Oppgjør-tab (signoff-flow)
- Leder har autoritet `min_role >= 'manager'` på `tips.approve_distribution` + `requires_four_eyes` per workspace-policy
- Sum-invariant er enten korrekt (pot = sum) ELLER leder har godkjent diff via AdjustmentDialog

## Happy Path

1. Leder åpner WebDayControl → Oppgjør-tab på dagens dato
2. SignoffTab viser kort med tips-status: "Distribusjon klar — N ansatte, total X kr"
3. Leder kan klikke kortet for å åpne distribusjons-preview (read-only inline-tabell)
4. Leder trykker "Godkjenn distribusjon" → ApproveBar viser samtykke-checkbox + bekreft-knapp
5. Leder huker av "Jeg bekrefter at distribusjonen er korrekt" + trykker "Godkjenn"
6. Klient kaller `tips.approve_distribution` capability
7. Capability-tool: `callTipsGate('approve_distribution')` → `level='confirm'` → UI viser final ConfirmSheet
8. Capability: UPDATE `tip_pool.status='approved'` + alle `tip_distribution.status='approved'` + emit `tip_pool approved`
9. SignoffTab-kortet skifter til badge "Godkjent ✓" + viser tidsstempel + leder-navn
10. Justeringer er nå låst (DB UPDATE-policy)

**Postcondition:**
- `tip_pool.status='approved'`, `approved_at`, `approved_by_profile_id` satt
- Alle `tip_distribution.status='approved'`
- `engine_event` + `activity_trail` har `tip_pool approved`-event
- Ansatte ser sin andel i mobil (status `approved` triggrer SELECT-policy — henvist til Sortie 3)
- Pot er klar for payroll-utbetaling (`status='paid'` settes kun av payroll-run, aldri her)

## Error Paths

- **Pool ikke `calculated`** → ApproveBar disabled; viser "Beregn distribusjon først"
- **Sum-mismatch utan godkjent justering** → ConfirmSheet blokkerer: "Sum stemmer ikke (diff X kr) — juster eller bekreft diff"
- **`requires_four_eyes: true`** → første godkjenning markerer pool `pending_four_eyes`; annen leder må bekrefte (Sortie 2 implementerer single-eye; four-eyes er fremtidig)
- **Allerede approved** → capability returnerer `{ok:false, error:'already_approved'}`; UI refresher state
- **Network-feil mellom emit og DB-write** → ADR-0196 invariant 11 — INGEN `run_started`-emit hvis DB-write feiler; capability returnerer `{ok:false, error:'db_write_failed'}` uten partial emit

## Verification

- [ ] Implementation matches the steps above
- [ ] E2E test exists and passes (path in `e2e_test:` frontmatter)
- [ ] Manually tested end-to-end

**Mark `status: verified` in frontmatter when all three boxes are checked.**
