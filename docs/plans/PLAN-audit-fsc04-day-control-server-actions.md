---
title: "Plan — audit-fsc04-day-control-server-actions"
feature: audit-fsc04-day-control-server-actions
spec: ../audits/2026-05-13-adr-contract-validation/00-SYNTHESIS.md
status: draft
updated: 2026-05-13
created: 2026-05-13
module: schedule
tags: [plan, audit, adr-0204, adr-0156, day-control, server-actions, f-sc-04]
---

# Plan — audit-fsc04-day-control-server-actions

> Branch: `feat/audit-fsc04-day-control-server-actions` | Worktree: `~/dev/smartout.ai-wt-9` | Module: schedule

**Spec:** F-SC-04-15 + F-SC-04-13 from synthesis — 2 NEW direct DB writes inside ADR-0156 day-control widgets shipped between 2026-05-10 and 2026-05-13.

## Background

- **F-SC-04-15** (HIGH): `apps/web/src/components/day/EventDetailPanel.tsx:299,319` — 2 `deviation.update` calls inside `startTransition`. No gate, no Server Action, no `emit()`.
- **F-SC-04-13** (HIGH): `apps/web/src/components/day/_components/day-control/OversiktTab.tsx:257` — `department_session.update({duty_leader_id})` inline async inside `<select onChange>`.

ADR-0156 EXPLICITLY forbids Supabase access inside day-control widgets. Two new sites materially violate the canonical ADR-0156 audit-integrity driver.

Sortie A.2.1 backlog (5 deviation client-side paths) was already noted in A.2 HANDOFF. This sortie tackles the 2 specific NEW direct-write sites surfaced by 2026-05-13 audit.

## Journeys

- [JOURNEY-audit-fsc04-event-detail-deviation-via-server-action](../journeys/JOURNEY-audit-fsc04-event-detail-deviation-via-server-action.md)
- [JOURNEY-audit-fsc04-oversikt-tab-duty-leader-via-server-action](../journeys/JOURNEY-audit-fsc04-oversikt-tab-duty-leader-via-server-action.md)
- [JOURNEY-audit-fsc04-day-control-widgets-no-direct-db-access](../journeys/JOURNEY-audit-fsc04-day-control-widgets-no-direct-db-access.md)

## Goal

Refactor 2 direct-DB-write sites in day-control widgets to Server Actions with gate_action + emit. Close F-SC-04-15 + F-SC-04-13. Stop the ADR-0204 bleed in the canonical surface.

## Tasks

- [ ] T1 Read `EventDetailPanel.tsx:299,319` + `OversiktTab.tsx:257` + ADR-0156 + ADR-0204. Identify existing Server Action precedent (e.g. `createDayInfoAction`, `report-deviation-action.ts`).
- [ ] T2 Create 2 Server Actions: `updateDeviationAction` (or extend existing report-deviation-action) + `updateDepartmentSessionDutyLeaderAction`. Each: gate_action + emit.
- [ ] T3 Rewire widgets to call Server Actions via TanStack mutations (matching existing pattern in day-control surface).
- [ ] T4 Vitest + integration test coverage for new Server Actions.
- [ ] T5 Update audit synthesis F-SC-04-15 + F-SC-04-13 → CLOSED.

## Acceptance Criteria

- [ ] **S1** `EventDetailPanel.tsx` zero direct `.update("deviation"...)` or `.from("deviation").update(`
- [ ] **S2** `OversiktTab.tsx` zero direct `.update("department_session"...)`
- [ ] **S3** Both refactored to Server Action calls
- [ ] **S4** New Server Actions emit telemetry (`deviation.resolved` + `session.duty_leader.updated` or matching registry events)
- [ ] **S5** Vitest pass on new actions
- [ ] **S6** Audit synthesis F-SC-04-15 + F-SC-04-13 → CLOSED
- [ ] **S7** `pnpm turbo typecheck` 0 errors
- [ ] **S8** Manual smoke: day-control UI still works (deviation resolve + duty-leader change)
- [ ] **S9** All 3 journeys verified

## Council triggers

- If existing `report-deviation-action.ts` only handles CREATE not UPDATE — propose helper extension OR new action
- If TanStack mutation key invalidation needs new shape — coordinate with cascade hook patterns

## Out of scope

- 5 other deviation client paths (Sortie A.2.1 backlog: DeviationDialog, DeviationDetailTab, useUpdateDeviation, useReconciliation)
- 7 SS-5 hook backlog (separate sortie)
- ADR-0287 enforcement (F-DB-11, parallel sortie B-W2.1)
