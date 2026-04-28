---
title: "Journey — Leder justerer enkeltansatts tips-andel"
feature: tips-leader-flows
journey: leder-justerer-andel
status: draft
verified_at: null
e2e_test: null
created: 2026-04-29
updated: 2026-04-29
module: payroll
tags: [journey, tips, payroll]
---

# Journey: Leder justerer enkeltansatts tips-andel med begrunnelse

**Role:** manager (department-leder)

**Precondition:**
- `tip_pool`-rad finnes for `department_session_id` med `status='calculated'` (distribusjon beregnet)
- `tip_distribution`-rader er generert per ansatt
- `tip_pool.status != 'approved'` (UPDATE blokkeres når approved)
- Leder har autoritet `min_role >= 'manager'` på `tips.adjust_share` capability + `requires_four_eyes: false` på dette nivået

## Happy Path

1. Leder åpner Reconciliation → DayDetail → Tips-tab for valgt dag
2. Tips-tab viser distribusjons-tabell: ansatt | timer | grunnandel | justert andel | total
3. Leder klikker rad for ansatt → AdjustmentDialog åpnes
4. Leder taster nytt beløp (NOK) + obligatorisk begrunnelse (TEXT, min 10 tegn)
5. Leder bekrefter → klient kaller `tips.adjust_share` capability
6. Capability-tool: `callTipsGate('adjust_share')` → gate svarer `allow` med `level='confirm'` → ber UI om bekreftelse
7. UI viser ConfirmSheet: "Justere fra X til Y for Ansatt Z?" → leder bekrefter
8. Capability: UPDATE `tip_distribution.amount_ore` + INSERT i `tip_adjustment_log` (audit) → emit `tip_distribution adjusted`
9. Tabellen oppdaterer rad + total-sum justeres

**Postcondition:**
- `tip_distribution`-rad har nytt `amount_ore` for valgt ansatt
- `tip_adjustment_log` har INSERT-rad: `(distribution_id, old_amount_ore, new_amount_ore, reason, actor_id, created_at)`
- `engine_event` + `activity_trail` har `tip_distribution adjusted`-event
- Sum-invariant brutt = pot ≠ sum(distributions); UI viser delta-banner "Diff: ±N kr"

## Error Paths

- **Pool er `approved`** → DB UPDATE-policy avviser; capability returnerer `{ok:false, error:'pool_locked'}`; UI viser "Pot er godkjent — justering låst"
- **Begrunnelse < 10 tegn** → klient + Zod blokkerer
- **Manglende rolle** → gate `deny` → "Ikke rettigheter"
- **`requires_four_eyes: true` (workspace policy)** → gate returnerer `level='four_eyes'` → annen leder må bekrefte (utenfor scope for Sortie 2 — capability returnerer `{ok:false, error:'four_eyes_required'}` som placeholder)
- **Konkurrent-justering (en annen leder oppdaterer samtidig)** → optimistic lock på `updated_at`; capability returnerer `{ok:false, error:'stale_revision'}`; UI ber om refresh

## Verification

- [ ] Implementation matches the steps above
- [ ] E2E test exists and passes (path in `e2e_test:` frontmatter)
- [ ] Manually tested end-to-end

**Mark `status: verified` in frontmatter when all three boxes are checked.**
