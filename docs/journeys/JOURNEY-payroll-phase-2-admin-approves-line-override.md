---
title: "Journey — Admin approves line override"
feature: payroll-phase-2
journey: admin-approves-line-override
status: draft
verified_at: null
e2e_test: null
created: 2026-05-07
updated: 2026-05-07
module: payroll
tags: [journey, payroll, admin, line-override, inbox, approval]
---

# Journey: Admin approves line override (proposal-flow)

**Role:** admin (only)

**Precondition:**
- Manager har sendt override-forslag (manager-proposes-line-override journey complete)
- `change_proposal` row eksisterer m/ kind='wage_line_override', status='pending'
- Admin er logget inn m/ admin-role i workspace
- Admin har `confirm`-authority på change_proposal approve (ADR-0204)

## Happy Path

1. Admin åpner `/dashboard/inbox` (eller `/dashboard/proposals`) → ser pending proposals m/ filter
2. Admin filtrerer på `kind=wage_line_override` → ser liste over alle pending overrides
3. Admin klikker proposal-rad → System routes til `/dashboard/proposals/[proposalId]` m/ detail-view:
   - **Original linje**: "Kveldstillegg 64.04 kr" (lest fra payroll_calculation snapshot)
   - **Foreslått**: "80.00 kr"
   - **Diff**: +15.96 kr (+24.9%)
   - **Grunn**: "Tariff-tolkning §6 — kveldstillegg gjelder hele vakt iht. lokal avtale"
   - **Kategori**: "Tariff-tolkning"
   - **Manager**: avatar + navn + tidspunkt sendt
   - **Audit**: `change_proposal.id`, `calculation_id`, `period_id`
   - Buttons: "Godkjenn" / "Avvis" / "Be om mer info"
4. Admin reviewer → klikker "Godkjenn" → System åpner ConfirmModal m/ summary
5. Admin bekrefter → System kaller approve-flow:
   - Verify proposal i workspace (ADR-0151)
   - Verify periode fortsatt status='open'
   - UPDATE `change_proposal.status='applied'`, `resolved_by`, `resolved_at`
   - **Trigger fires (NEW Phase 2):** DB trigger på `change_proposal` AFTER UPDATE WHEN status='applied' AND kind='wage_line_override' → kaller apply-funksjon:
     - Insert `shift_pay_calculation_event` m/ supersession-chain (`superseded_by_event_id` peker tilbake)
     - INSERT new `payroll_calculation` row m/ override-amount, `derivation_version + 1`, `source='override'`, `change_proposal_id` ref
     - Old payroll_calculation row UENDRET (audit immutability per ADR-0251)
   - Emit recalc → aggregatePeriod kjører på nytt → totals oppdatert
   - Emit `payroll.line_override_approved` + `payroll.line_overridden`
6. UI: toast "Forslag godkjent — linje oppdatert (+15.96 kr)" + redirect til `/dashboard/payroll/[periodId]` (eller behold på proposal-detalj)
7. Tilbake i LinesTable: linja viser ny verdi (80.00 kr) + "Overstyrt"-badge (grønn) m/ trace-link til proposal

**Postcondition:**
- `change_proposal.status='applied'`, resolved_by/at populated
- New `payroll_calculation` row eksisterer m/ override-amount, derivation_version+1, source='override'
- `shift_pay_calculation_event` audit-row m/ supersession (gammel event peker via `superseded_by_event_id` til ny)
- Period totals reflekterer ny verdi
- LinesTable + LineDrawer viser "Overstyrt"-badge + trace-kjede til proposal
- activity_trail row m/ admin actor_id + before/after values

## Error Paths

- **Periode låst etter forslag:** Admin prøver godkjenne men periode er nå status='locked' → tool returnerer 409 "Periode låst — kan ikke applisere override" → proposal forblir status='pending' (manager kan re-sende i corrective period)
- **Concurrent rejection:** Annen admin avviser samtidig → optimistic-lock conflict → UI auto-refresh
- **Avvis flow:** Admin klikker "Avvis" → modal m/ grunn-required → UPDATE status='rejected' → emit `payroll.line_override_rejected` → manager ser status i sin inbox
- **Be om mer info:** Admin klikker "Be om mer info" → kommentar-thread åpnes (utenfor scope P2 — fallback: avvis m/ grunn = "trenger mer info")
- **Authority feil:** Manager prøver godkjenne (ikke admin) → gateAction returnerer `denied: insufficient_authority`

## Verification

- [ ] Implementation matches the steps above
- [ ] E2E test exists and passes
- [ ] Manuelt verifisert: full kjede manager-proposes → admin-approves → recalc → linje oppdatert <2s
- [ ] Inbox/proposal-list UI følger Nordic Split design-tokens
- [ ] Audit-chain komplett: change_proposal → shift_pay_calculation_event m/ supersession → payroll_calculation derivation_version+1
- [ ] Original payroll_calculation row UENDRET (immutability)
- [ ] Telemetry: `payroll.line_override_approved` + `payroll.line_overridden` fyrer
- [ ] activity_trail audit-row m/ admin actor + before/after (ADR-0186)
- [ ] Period status='locked' rejecter approve m/ klar UX
- [ ] gateAction (ADR-0204) blokker non-admin

**Mark `status: verified` in frontmatter when all eight boxes are checked.**
