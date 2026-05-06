---
title: "Plan — cascade-todo-quickfix"
status: in_progress
updated: 2026-04-28
created: 2026-04-28
module: dashboard
tags: [plan, cascade, todo, drawer, operating-hours]
---

# Plan — cascade-todo-quickfix

> Branch: `feat/cascade-todo-quickfix` | Worktree: `/home/sxtnl/dev/smartout.ai-wt-1` | Base: `development` | Module: dashboard | Started: 2026-04-28

## Goal

Inline-redigering av `workspace.missing_base_hours` cascade-task direkte i CascadeTaskTab drawer + fiks RPC OR-bug + fiks wizard write-target. Strømlinjeformet skuld-aware sortie ~3 timer.

## Context

Council 2026-04-28 (run-council, 4 reviewers) ga APPROVE WITH CHANGES med 3 ADR-er som blokkerende. Brukeren valgte å trimme scope hardt, ta bevisst skuld, og ship i dag. Bare ADR-0218 (operating-hours source-of-truth) skrives som proposed nå. ADR-0219 (catalog-rename) og ADR-0220 (drawer-as-workbench) skrives post-hoc / backlog.

**Quadruple-hours-trap (kritisk fagbug fanget av council):**
- `company_opening_hours` — wizard skriver hit (`/join/_lib/setupActions.ts:271`), customer-facing
- `workspace_operating_hours` — settings skriver hit, RPC LESER hit
- `department_operating_hours` — dept-tab + season skriver hit, cascade D1 sannhet
- `department_hours_override` — backlog, exception-day overstyringer

Konsekvens i dag: wizard fullfører → cascade-RPC `workspace.missing_base_hours` fyrer fortsatt critical fordi RPC leser `workspace_operating_hours` (tom) ikke `company_opening_hours` (utfylt av wizard).

**RPC OR-bug:** `dept_with_hours` CTE bruker `EXISTS dept_rows OR workspace_count > 0` → dept-override-gap er usynlig så lenge workspace har base.

## Tasks

- [x] Task 0: Worktree opprettet
- [ ] Task 1: ADR-0218 mini (proposed) skrevet
- [ ] Task 2: Migration `<ts>_resolve_cascade_tasks_dept_or_fix.sql` — fjern OR-feil + comment-fix linje 593 (C2→C4 messages)
- [ ] Task 3: Wizard dual-write fix — `setupActions.ts:271` skriver til `workspace_operating_hours` i tillegg til `company_opening_hours`
- [ ] Task 4: Inline-editor i `CascadeTaskTab.tsx` — conditional på `task.title_key`, render `<OpeningHoursSettings hideHeader />` for workspace_missing_hours + dept_missing_hours
- [ ] Task 5: Strip header på `OpeningHoursSettings` via `hideHeader?: boolean` prop
- [ ] Task 6: Manuell test (workspace-flow + wizard-flow)
- [ ] Task 7: Typecheck + commit + push
- [ ] Task 8: Skriv 3 learnings + close-feature

## Acceptance Criteria

- [ ] Typecheck passes: `pnpm turbo typecheck`
- [ ] Migration applies cleanly på Supabase Local
- [ ] Wizard-flow: nytt workspace → onboarding fullført → drawer viser IKKE `workspace.missing_base_hours` critical
- [ ] Drawer-flow: existing workspace med 0 timer → drawer åpner → inline form → save → gap forsvinner uten side-navigering
- [ ] ADR-0218 i `proposed` status, registrert i `0000-decision-log.md`
- [ ] 3 learnings: L-0147 (audit-inflation #5), L-0148 (quadruple-hours-trap), L-0149 (drawer-not-fix-when-symptom-upstream)
- [ ] User journey skrevet: `docs/journeys/JOURNEY-cascade-todo-quickfix.md`
- [ ] Handoff: `docs/HANDOFF-cascade-todo-quickfix.md` (decisions + skuld + next steps)

## Skuld bevisst tatt (dokumenteres i HANDOFF)

| # | Skuld | Hvorfor ok | Når må fikses |
|---|---|---|---|
| 1 | Ingen ADR-0220 (drawer-as-workbench) før implementasjon | 1. consumer ships, ingen presedens å bryte | Når 2. inline-task legges til |
| 2 | Ingen catalog-rename til `dashboard_setup_task` | Kun naming, ingen kode-konsekvens | Neste cascade-arbeid |
| 3 | Wizard dual-write ikke ekte sync | Pragmatisk, dekker bootstrap-tilfelle | Når dept-overrides brukes aktivt (ADR-0221 backlog) |
| 4 | Inline-editor ad-hoc, ikke resolver-pattern | Bare 1-2 task-typer, generalisering = YAGNI | Når 3. task får inline |
| 5 | OR-bug-fiks endrer ikke detection for dept-override-divergens | Funksjonelt likt med dagens flyt | Når dept-spesifikke timer trengs |
| 6 | Ingen telemetry source-tag (drawer vs settings) | Eksisterende `workspace_operating_hours updated`-event er nok | Når UX-data trengs for beslutning |
| 7 | Mobile drop — drawer er web-only | ADR-0133 dekker D1-authoring = web | Backlog |

## Out-of-scope (eksplisitt)

- AI-capability for cascade-task (Botsson kan ikke fikse åpningstider) — bekreftet av Agent-coord council-review
- Resolver-pattern (`resolveCascadeTaskEditor`) — YAGNI til 3+ consumers
- Per-dept-override-detection-split — backlog
- D5/C1/C3 catalog-utvidelse — backlog
- Compact-form-variant (Frontend R3) — bruk `hideHeader` prop på eksisterende form
- Visual hints på todo-cards (Pencil/Arrow/Zap) — backlog
- Mobile-variant — web-only nå
- engine_event-routing på telemetry — pre-existing gap, ikke blokkerende

## References

- Council 2026-04-28: APPROVE WITH CHANGES (run-council, 4 reviewers)
- ADR-0218 (proposed): operating-hours source-of-truth
- ADR-0133: web composes, mobile executes (mobile boundary)
- ADR-0078: channel restriction (forbyr voice for visse data)
- ADR-0151: server-side profile_id derivation
- L-0146: phantom-consumer pattern
- RPC: `supabase/migrations/20260503100000_update_cascade_task_hrefs_year_wheel.sql`
- Drawer: `apps/web/src/components/dashboard/entity-drawer/tabs/cascade-task/CascadeTaskTab.tsx`
- Form: `apps/web/src/app/dashboard/settings/_components/opening-hours-settings.tsx`
- Hook: `apps/web/src/app/dashboard/settings/_hooks/use-workspace-operating-hours.ts`
- Wizard: `apps/web/src/app/join/_lib/setupActions.ts`
