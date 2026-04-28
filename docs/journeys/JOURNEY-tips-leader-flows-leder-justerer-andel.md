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
- `tip_pool`-rad finnes for `department_session_id`, `status='recorded'` (IKKE `approved` — RLS UPDATE-policy låser ved `approved`/`paid`/`voided`)
- `tip_distribution`-rader er generert (skjedde ved set_pot)
- Leder har autoritet `level=confirm, min_role>=manager` på `tips.adjust_share` capability
- `requires_four_eyes` per workspace-policy (default `false` fra auth-seed)

## Happy Path

1. Leder åpner Reconciliation → DayDetail → Tips-tab for valgt dag
2. Tips-tab viser distribusjons-tabell: ansatt | rolle | timer | beregnet andel | justert andel | aktivt beløp | total
3. "Aktivt beløp" = `adjusted_amount ?? calculated_amount`. "Justert andel" viser delta hvis adjustment finnes
4. Leder klikker rad for ansatt → AdjustmentDialog åpnes
5. Dialog viser: `calculated_amount` (read-only) + nytt beløp-input (NOK 2dp) + obligatorisk begrunnelse (TEXT, min 5 tegn — DB CHECK)
6. Leder taster `new_amount` + `reason` + bekrefter
7. BFF route `/api/tips/adjust-share` kaller stage-engine → `tips.adjust_share` capability tool
8. Tool: `callTipsGate({capability:'tips.adjust_share', actionType:'update', entityId:distribution_id})` → gate svarer
   - `allow=false, requiresFourEyes=true, approversNeeded > approversPresent.length` → tool returnerer `{ok:false, error:'four_eyes_required', approversNeeded}` (placeholder — second-leader UI defer Sortie 4)
   - `allow=true` → fortsett
9. Stage engine viser `level=confirm` ConfirmSheet til leder: "Justere fra X kr til Y kr for [Ansatt]?"
10. Leder bekrefter → tool transaksjon:
    - SELECT current `tip_distribution.adjusted_amount ?? calculated_amount` AS `old_amount`
    - UPDATE `tip_distribution SET adjusted_amount=:new_amount, adjustment_reason=:reason WHERE id=:distribution_id`
    - INSERT `tip_adjustment_log (workspace_id, distribution_id, changed_by=actor, old_amount, new_amount, reason)`
    - DB CHECK `chk_tip_dist_adjustment` enforces both `adjusted_amount` + `adjustment_reason` set together
11. Tool emit (ETTER begge DB-writes):
    - `tip_distribution adjusted` med `{distribution_id, pool_id, profile_id, old_amount, new_amount, reason}` (4 destinations)
12. Tool returnerer `{ok:true, distribution_id, old_amount, new_amount}`
13. Tabell oppdaterer rad + total-sum-banner ("Diff vs pot: ±N kr") vises hvis sum != `tip_pool.amount_nok`

**Postcondition:**
- `tip_distribution` har `adjusted_amount` + `adjustment_reason` satt; `status` forblir `calculated` (status endres kun ved approval)
- `tip_adjustment_log` har INSERT-rad: `(distribution_id, changed_by=actor_profile_id, changed_at=now, old_amount, new_amount, reason)` — UPDATE/DELETE deny-by-default på tabellen
- `engine_event` + `activity_trail` har `tip_distribution adjusted`-event
- Sum-invariant kan bli brutt; UI viser delta-banner

## Error Paths

- **Pool er `approved`** (eller `paid`/`voided`) → RLS UPDATE-policy `pool_id IN (SELECT id FROM tip_pool WHERE status != 'approved')` avviser; tool returnerer `{ok:false, error:'pool_locked'}`; UI viser "Pot er låst — justering ikke mulig"
- **`reason` < 5 tegn** → Zod (`tools.ts:67` `z.string().min(5)`) + DB CHECK fanger; UI viser "Begrunnelse må være minst 5 tegn"
- **Manglende rolle** → gate `allow=false` → "Ikke rettigheter"
- **`requires_four_eyes=true` med kun én leder tilstede** → `{ok:false, error:'four_eyes_required', approversNeeded:2}`; UI viser "Krav om 2 ledere — venter på second confirmer"
- **Adjustment_log INSERT feiler** → UPDATE rulles tilbake (samme transaksjon), INGEN emit
- **Konkurrent-justering (race)** → siste write vinner på `adjusted_amount` men `tip_adjustment_log` har FULL historikk (begge rader bevart)

## Verification

- [ ] Implementation matches the steps above
- [ ] E2E test exists and passes (path in `e2e_test:` frontmatter)
- [ ] Manually tested end-to-end

**Mark `status: verified` in frontmatter when all three boxes are checked.**
