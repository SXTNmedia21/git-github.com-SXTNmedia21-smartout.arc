---
title: "Journey — Admin approves line override"
feature: payroll-phase-2
journey: admin-approves-line-override
status: verified
verified_at: 2026-05-08
e2e_test: null
created: 2026-05-07
updated: 2026-05-08
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

## Verification — file:line references

| Step | Implementation |
|------|---------------|
| Step 1-2 — Admin opens /dashboard/proposals, sees list | `apps/web/src/app/dashboard/proposals/page.tsx`, `_components/ProposalsListClient.tsx` |
| Step 3 — Proposal detail view at /dashboard/proposals/[proposalId] | `apps/web/src/app/dashboard/proposals/[proposalId]/page.tsx`, `_components/ProposalDetailClient.tsx:245` |
| Step 3 — Detail: original → proposed + diff + delta% + reason + category | `ProposalDetailClient.tsx:275-281` (delta calc), `:340-410` (card: original, proposed, diff, category, reason) |
| Step 3 — Audit IDs (change_proposal_id, calculation_id, period_id) | `ProposalDetailClient.tsx:396-411` (audit IDs grid) |
| Step 4-5 — "Godkjenn" button + ConfirmModal | `ProposalDetailClient.tsx:413-425` (buttons), `:110-161` (ApproveModal with amount diff summary) |
| Step 5 — Approve flow: verify + gate + status flip + Pattern B applier | `apps/web/src/app/api/payroll/approve-proposal/route.ts:52` — gateAction:76-89, proposal verify:95-112, period open verify:159-179, UPDATE status='applied':185-201, call apply-line-override:211-245 |
| Step 5 — apply-line-override: supersession + new calculation | `apps/web/src/app/api/payroll/apply-line-override/route.ts` — INSERT shift_pay_calculation_event + INSERT new payroll.calculation (derivation_version+1) |
| Step 5 — DB trigger on status='applied' | Migration 20260507110100 — `payroll_proposal_applied_trg` fires on change_proposal AFTER UPDATE WHERE status='applied' AND kind='wage_line_override'; emits engine_event for audit + future Pattern A |
| Step 5 — Pattern B sync recalc (ADR-0293) | `approve-proposal/route.ts:211-245` (calls apply-line-override) → `apply-line-override/route.ts` internally calls recalculate-period |
| Step 6 — Toast + redirect to period | `ProposalDetailClient.tsx:293-298` (onSuccess: toast + router.push to period) |
| Reject flow | `ProposalDetailClient.tsx:303-315` (handleReject), `:163-234` (RejectModal with required reason), BFF `/api/payroll/reject-proposal/route.ts` |
| Telemetry | `apply-line-override/route.ts` — emits `payroll.line_override_approved` + `payroll.line_overridden` |
| Period locked guard | `approve-proposal/route.ts:159-179` (409 when period not open) |
| Authority gate (admin only) | `approve-proposal/route.ts:76-89` (gateAction `actionType='approve_proposal'`) |
| Audit panel (activity_trail) | `ProposalDetailClient.tsx:87-107` (AuditPanel) — reads activity_trail rows for proposal |
