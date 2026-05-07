---
title: "Journey — Manager deletes manual supplement"
feature: payroll-phase-2
journey: manager-deletes-manual-supplement
status: draft
verified_at: null
e2e_test: null
created: 2026-05-07
updated: 2026-05-07
module: payroll
tags: [journey, payroll, manager, manual-supplement, recalc-trigger, gap-close]
---

# Journey: Manager deletes manual supplement (recalc-trigger)

**Role:** manager (or admin)

**Precondition:**
- Periode `status='open'`
- Minst én `payroll_manual_supplement` row eksisterer for periode (e.g. fra manager-adds-manual-supplement-via-form journey)
- LinesTable viser manual_supplement-linje
- Manager har `confirm`-authority på `delete_manual_supplement` (eller bruker `add_manual_supplement` m/ delete=true flag, TBD)

## Happy Path

1. Manager åpner `/dashboard/payroll/[periodId]` → klikker profil-rad → LineDrawer
2. Manager finner manual_supplement-linje "Bonus 200 kr — Ekstra hjelp Skjærtorsdag" → klikker "X"-ikon eller "Slett"-knapp på linje-rad
3. System åpner ConfirmModal m/ "Slette manuelt tillegg? Beløp blir fjernet fra perioden."
4. Manager bekrefter → System kaller `delete_manual_supplement(supplement_id)` capability tool (eller equivalent):
   - Verify supplement i workspace (ADR-0151)
   - Verify periode fortsatt status='open' (L-0177 fail-fast)
   - DELETE `payroll_manual_supplement` row
   - Emit `payroll.manual_supplement_deleted`
5. **Recalc-trigger fires (NEW Phase 2):** DB trigger på `payroll_manual_supplement` AFTER DELETE → emit `engine_event` for recalc → recalculate_period RPC runs → payroll_calculation oppdatert (manual-linja fjernet, totals re-aggregert)
6. UI: toast "Manuelt tillegg slettet" + LinesTable refresh (linje vises ikke mer) + total oppdatert <2s

**Postcondition:**
- `payroll_manual_supplement` row slettet
- `payroll_calculation` re-aggregert m/ ny `derivation_version + 1` (gamle rader bevart per ADR-0251)
- LinesTable + LineDrawer viser oppdaterte totals uten manual-linja
- activity_trail row m/ workspace_id + actor_id + before-state (supplement payload)

## Error Paths

- **Periode låst:** "Slett"-knapp disabled m/ tooltip "Periode låst"
- **Supplement ikke i workspace:** Tool returnerer 403 (ADR-0151)
- **Concurrent recalc:** En annen manager triggerer recalc samtidig → engine_event-queue serialiserer; ingen race condition
- **Supplement allerede slettet:** Tool returnerer 404 m/ "Tillegg ikke funnet" + UI auto-refresh

## Verification

- [ ] Implementation matches the steps above
- [ ] E2E test exists and passes
- [ ] Manuelt verifisert: slett 200 kr supplement → recalc fires → total reduseres med 200 kr <2s
- [ ] **Recalc-trigger DB-test:** verify `engine_event` row inserted etter DELETE, verify recalculate_period kjører, verify payroll_calculation derivation_version+1
- [ ] activity_trail audit-row m/ before-state inkludert payload (ADR-0186)
- [ ] Telemetry: `payroll.manual_supplement_deleted` + `payroll.recalc_triggered_by_supplement` fyrer
- [ ] Period status='locked' blokker delete m/ klar UX
- [ ] Tool gatedMutation + L-0177 fail-fast verified

**Mark `status: verified` in frontmatter when all seven boxes are checked.**
