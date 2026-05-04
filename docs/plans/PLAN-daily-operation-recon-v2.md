---
title: "Plan — daily-operation recon-v2"
status: in_progress
updated: 2026-04-20
created: 2026-04-20
module: reconciliation
tags: [plan, sub-sortie, daily-operation, recon, avstemming]
---

# PLAN — daily-operation recon-v2

> **Sub-sortie of campaign:** `campaign/daily-operation`
> **Branch:** `feat/daily-operation-recon-v2`
> **Worktree:** `~/dev/smartout.ai-daily-operation-wt-1`
> **Parent campaign:** `docs/plans/CAMPAIGN-daily-operation.md` Milestone 1

## Goal

Recompose `apps/web/src/app/dashboard/reconciliation/` til designbundelens layout (`Avstemming.html` + `detail.jsx`): **list-view** med status-pills, filter-chips, header-counters; **detail-view** 1fr + 380px sticky approve-panel med preflight-gate, admin-override, og 6 tabs (Oversikt / Omsetning / Vakter / Avvik / Oppgaver / Revisjonslogg). Leveranse-kriterium: source-of-truth — hver knapp, KPI, funksjon er live-wired.

## Scope

### In scope
- `apps/web/src/app/dashboard/reconciliation/page.tsx` + `_components/reconciliation-page-client.tsx` layout-recompose
- `_components/DayList.tsx` — PhaseBadge status-pills, filter-chips, header-counters, CSV-eksport
- `_components/DayApproval.tsx` — preflight-gate + admin-override-modal
- `_components/{RevenueSection, ShiftApprovalSection, DeviationSection}.tsx` — gjenbruk, kun layout-wrapping
- Nye: `_components/{PreflightGate,AdminOverrideDialog,RevisjonsloggTab}.tsx`
- Hook: `_hooks/useReconciliationAuditTrail.ts` for edit-history
- Dedupe: `deviation reported` triple-emit (3 sites → 1 canonical path)

### Out of scope (deferred to next sub-sortier eller Fase B)
- Mobile clockout-wizard (milestone 2)
- Handover-migration (milestone 3)
- Real-time multi-site roll-up (Fase C)
- AI-anomaly detection in recon (Fase B)
- Benchmarking mot peers (Fase C)

## Implementation Steps

1. **Read & map existing.** Forstå `reconciliation-page-client.tsx` nåværende layout, DayList, DayApproval, RevenueSection/ShiftApprovalSection/DeviationSection contracts.
2. **Dedupe `deviation reported` emit.** Identifisér kanonisk path. Fjern duplikater. Verifisér `activity_trail` får 1 rad per hendelse.
3. **Preflight-gate.** Build `<PreflightGate>` component: blocker-list m/ `border-l-4 border-destructive`, `scrollIntoView({behavior:"smooth",block:"center"})` på click-to-jump, approve disabled when blockers>0, admin-override CTA med modal.
4. **Admin-override-modal.** Modal med reason-felt (min 20 tegn, zod-validation), submit writes `daily_reconciliation.approved_by` + `activity_trail`-rad tagget `override=true`.
5. **Layout-recompose.** `ReconciliationPageClient` detail-mode rendres som `grid lg:grid-cols-[1fr_380px] gap-6`. Sticky approve-panel høyre (`sticky top-4 h-fit`). Content lane venstre.
6. **List-view refactor.** DayList bruker `PhaseBadge` fra `@smartout/ui` for status. Legg til filter-chip-row (status / avdeling / date-range). Header-counters: "Venter oppgjør / Klar til å låse / Avvik denne uka".
7. **6 detail-tabs.** Oversikt (sticky-panel-aktig KPI-tiles + session-header), Omsetning (RevenueSection), Vakter (ShiftApprovalSection), Avvik (DeviationSection), Oppgaver (ny — queries `session_task` join session), Revisjonslogg (ny — edit-history).
8. **Revisjonslogg + audit-trail.** Hook `useReconciliationAuditTrail(date, departmentId)` leser `activity_trail` filtered by `entity='daily_reconciliation'`, viser kronologisk liste.
9. **CSV-eksport.** Button i DayList. Bruker `papaparse` eller manuell CSV-gen. Norsk locale (space thousand-separator, comma decimal).
10. **Motion spec.** Spring params per Frontend Council (stiffness/damping/mass). Sticky-panel animerer IKKE på tab-switch.
11. **A11y pass.** 7-item checklist fra campaign doc.
12. **Typecheck + commit.**

## Success Criteria (per campaign invariants)

- [ ] Inv #1 CI-gate 1: `rg 'text-(zinc|gray|slate|neutral|stone)-|bg-…|#[0-9a-f]{3,8}'` = 0 treff i endrede filer.
- [ ] Inv #1 CI-gate 2: alle `var(--*)` finnes i begge `:root` + `.dark`.
- [ ] Inv #1 CI-gate 3: alle `<motion.*>` har `transition` prop.
- [ ] Inv #1 grep-gate: `rg 'TODO|FIXME|mock|placeholder'` = 0 i endrede UI-filer.
- [ ] Inv #2: hver mutasjon skriver eksplisitt navngitt tabell/kolonne, ingen dual-write.
- [ ] Inv #3: ingen direkte `engine_event.insert()`. Alle emit via registry.
- [ ] Inv #9: admin-override skriver `activity_trail` m/ `override=true` + reason ≥20 tegn.
- [ ] Inv #11: "forrige session" queries bruker `end_at < current.start_at`, ikke kalender-dato.
- [ ] Inv #12: KPI lønn-linje refererer `tariff_rate_table` (eller markerer "Estimat — eksl. tillegg").
- [ ] Typecheck 0-feil.
- [ ] Journey-fil ferdig (admin happy + error paths for J1-J5).
- [ ] Handoff-fil skrevet før close.
- [ ] E2E tests for J1-J5 under `apps/e2e/daily-operation-recon-v2/`.

## Risks

| Risk | Mitigation |
|---|---|
| Edit-history på `daily_reconciliation` eksisterer ikke i DB | Milestone 1 bygger read-pattern via `activity_trail`. DB-trigger for edit-history = followup. |
| CSV-eksport håndterer ikke null/edge-case tall | Zod-valider før serialisering. Fallback "—" for null. |
| Sticky-panel layout-thrash ved tab-switch | Motion-spec: sticky animerer IKKE. Kun content-lane transitions. |
| PreflightGate blocker-list for statisk/dårlig UX når 0 blockers | Auto-collapse når blockers=0, vis grønn "Klar for godkjenning"-banner. |
| Admin-override blir misbrukt | Monitor override-rate. Inv #9 setter target < 10 %. Hvis høyere → preflight-blockers er feilkonfigurert. |

## References

- Parent campaign: `docs/plans/CAMPAIGN-daily-operation.md` §Milestone 1
- Design bundle: `/tmp/smartout-design-bundle-v2/smartout/project/{Avstemming.html,detail.jsx}`
- ADR-0156 (day-control canonical admin surface)
- ADR-0157 (Server Actions scope amendment)
- Campaign invariants 1-12 (binding for close)
