---
title: "Journey — Tip distribution merges into payroll"
feature: payroll-phase-2
journey: tip-distribution-merges-into-payroll
status: draft
verified_at: null
e2e_test: null
created: 2026-05-07
updated: 2026-05-07
module: payroll
tags: [journey, payroll, tips, recalc-trigger, gap-close, tip-pool]
---

# Journey: Tip distribution merges into payroll (recalc-trigger on insert)

**Role:** manager (eller leder, varies per workspace)

**Precondition:**
- Periode `status='open'` for workspace
- En `tip_pool` eksisterer m/ status='approved' OG `payroll_period_id` matcher åpen periode (P1 schema)
- Pool har `tip_distribution` rader for involverte ansatte
- Manager/leder har approval-authority for tip-distribution

## Happy Path

1. Manager/leder fullfører tip-pool-flow (utenfor scope P2 — eksisterende flow): tip_pool går til status='approved', tip_distribution rader skapes per ansatt m/ `calculated_amount` + ev. `adjustment`
2. Tip_distribution INSERT skjer (entry-point varierer: existing tips-leader-flow, manager UI, eller automatisk fra session_close)
3. **Recalc-trigger fires (NEW Phase 2):** DB trigger på `tip_distribution` AFTER INSERT WHEN `status='approved'` AND row.payroll_period_id IS NOT NULL AND payroll_period.status='open':
   - Emit `engine_event` m/ event_kind='tip_distribution_inserted', period_id, profile_id
   - Edge Function (eller engine_dispatch) konsumerer event → kaller recalculate_period for affected periode
4. Recalc-engine: aggregatePeriod re-runs → finner tip_distribution rader merged til periode → produserer `payroll_line` rader m/ pay_code='tips_taxable' (skattepliktig per LEGAL-FRAMEWORK §7.2) per ansatt
5. UI: ansatt sin LinesTable-rad oppdaterer m/ ny "Tipspott 234.50 kr"-linje (Geist Mono font, hvis aktiv periode-detalj-side åpen → live update via Supabase Realtime eller TanStack Query refetch)
6. Ansatt klikker rad → LineDrawer drilldown viser tips-trace: 4 tip_pools merged inn, hver pool m/ calculated_amount + ev. adjustment + `tip_pool.id` + `department_session_id` ref (per P1 manager-drills-profile journey)

**Postcondition:**
- `tip_distribution.payroll_period_id` ref valid (FK fra P1 migration)
- `payroll_calculation` har `derivation_version + 1` rad m/ tips_taxable line for hver ansatt m/ tip-distribution
- `shift_pay_calculation_event` audit-row inkluderer tip_pool refs i provenance JSONB
- activity_trail row m/ event 'payroll.recalc_triggered_by_tip_distribution'
- LinesTable + LineDrawer viser tips-linje + drilldown-trace
- Period totals reflekterer merged tips

## Error Paths

- **Periode låst:** Trigger CHECK på period.status='open' før emit → hvis locked, ingen recalc; tip_distribution-rad blir orphan (utenfor periode) → flag som warning på neste periode-åpning
- **Tip pool ikke approved:** WHEN-clause på trigger ekskluderer status!='approved' → ingen recalc fires, no-op
- **Tip distribution m/o payroll_period_id:** Trigger-WHEN sjekker NOT NULL → no-op (tip pool hadde ikke valid period match)
- **Concurrent edits:** Engine_event-queue serialiserer recalcs per periode; ingen race
- **Ansatt ikke i workspace:** Edge case — tip_distribution m/ profile_id som ikke matcher workspace → recalc ignorerer (workspace_id check) + flag deviation

## Verification

- [ ] Implementation matches the steps above
- [ ] E2E test exists and passes
- [ ] Manuelt verifisert: approve tip_pool m/ payroll_period_id → distribution rad insert → recalc fires <5s → tips_taxable line synlig i LinesTable
- [ ] **Recalc-trigger DB-test:** verify trigger fyrer kun når status='approved' AND period.status='open' AND payroll_period_id NOT NULL; verify no-op på andre cases
- [ ] activity_trail audit-row inkluderer tip_pool ref + period_id (ADR-0186)
- [ ] Telemetry: `payroll.recalc_triggered_by_tip_distribution` fyrer
- [ ] LineDrawer drilldown viser tips-trace m/ pool-id + adjustment-reason (ref P1 manager-drills-profile)
- [ ] tips_taxable line har korrekt pay-code-mapping for A-melding (LEGAL §7.2)
- [ ] Period locked-state behaves korrekt (orphan-warning, ingen recalc)

**Mark `status: verified` in frontmatter when all seven boxes are checked.**
