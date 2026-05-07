---
title: "Plan — payroll-phase-2"
feature: payroll-phase-2
spec: docs/modules/payroll/PHASES.md
status: draft
updated: 2026-05-07
created: 2026-05-07
module: payroll
tags: [plan, payroll, phase-2, manual-supplements, line-override, recalc-triggers, ui-mockup]
---

# Plan — payroll-phase-2

> Branch: `feat/payroll-payroll-phase-2` | Worktree: `/home/sxtnl/dev/smartout.ai-payroll-wt-1` | Base: `campaign/payroll` | Module: payroll

**Spec:** [Phase 2 — Manual Supplements + Line Override](../modules/payroll/PHASES.md#phase-2--manual-supplements--line-override)

**Design mockup:** `docs/modules/payroll/design/Payroll Prototype.html` (Sprint 3 i IMPLEMENTATION.md). UI-implementasjon FØLGER mockup 1:1 — Sofia/produkt-team har godkjent flow + visuelt. Kanonisk JSX-kilde i `docs/modules/payroll/design/source/`.

## Journeys (the contract)

- [JOURNEY-payroll-phase-2-manager-adds-manual-supplement-via-form](../journeys/JOURNEY-payroll-phase-2-manager-adds-manual-supplement-via-form.md) — Screen 06 modal-UI for `add_manual_supplement` tool (P1 backend shipped, UI deferred → P2)
- [JOURNEY-payroll-phase-2-manager-proposes-line-override](../journeys/JOURNEY-payroll-phase-2-manager-proposes-line-override.md) — Manager åpner LineDrawer, klikker "Overstyr linje", oppgir grunn → change_proposal opprettet
- [JOURNEY-payroll-phase-2-admin-approves-line-override](../journeys/JOURNEY-payroll-phase-2-admin-approves-line-override.md) — Admin ser proposal i inbox, godkjenner → recalc fires → linje oppdatert m/ audit-chain
- [JOURNEY-payroll-phase-2-manager-deletes-manual-supplement](../journeys/JOURNEY-payroll-phase-2-manager-deletes-manual-supplement.md) — Manager sletter manual_supplement → recalc-trigger fires → totals oppdatert <2s
- [JOURNEY-payroll-phase-2-tip-distribution-merges-into-payroll](../journeys/JOURNEY-payroll-phase-2-tip-distribution-merges-into-payroll.md) — Approved tip_pool i åpen periode → distribution insert → recalc → tips_taxable line populated

## Goal

Manager kan legge til manuelle tillegg via Screen 06-modal, foreslå override på derivert linje (manager → admin approval-flow), og se recalc-triggers fyre auto når supplement endres eller tips distribueres. Tre recalc-gaps fra Phase 1 lukkes (manual_supplement insert/delete, change_proposal applied, tip_distribution insert).

## Scope (per PHASES.md §Phase 2 + Sofia Sprint 3)

### A. Capability tools (NEW + extension)

- **`override_calculation_line`** (NEW) — `level=confirm`, `min_role=manager` → inserts `change_proposal` of kind `wage_line_override`
- **`add_manual_supplement` UI body** — backend shipped P1, surface Screen 06 modal trigger from LineDrawer + period-detail "+ Manuelt tillegg"-knapp
- Recalc-trigger orchestration (auto via Edge Function eller DB trigger):
  - On `payroll_manual_supplement` insert/delete → recalc affected periode
  - On `change_proposal.status='applied'` (kind='wage_line_override') → apply override, recalc
  - On `tip_distribution` insert (status='approved' AND payroll_period_id matches open periode) → recalc

### B. UI surfaces (Sofia Sprint 3 mockup-fidelity)

- **Screen 06 — ManualSupplementForm modal** (`apps/web/src/app/dashboard/payroll/[periodId]/_components/ManualSupplementForm.tsx`)
  - Source: `docs/modules/payroll/design/source/payroll-supplement-form.jsx`
  - Fields: ansatt-selector, type (Bonus/Forskudd/Trekk/Annet), beløp, lønnskode, beskrivelse, taxable-toggle, dato
  - Trigger: button "+ Manuelt tillegg" på `/dashboard/payroll/[periodId]` header + i LineDrawer
  - Action: server-action calls `add_manual_supplement` capability tool
- **LineDrawer "Overstyr linje" action** (`LineDrawer.tsx` extension)
  - Vises på linjer m/ source='derived' (ikke manual)
  - Modal: ny verdi + grunn (required) + kategori
  - Action: kaller `override_calculation_line` → opprette change_proposal
  - State viser "Venter godkjenning" badge til admin approver
- **Inbox: wage_line_override proposals** (extend existing `/dashboard/inbox` eller `apps/web/src/app/dashboard/proposals/`)
  - List view m/ filter `kind='wage_line_override'`
  - Detail view: original verdi vs foreslått + grunn + manager-id + audit
  - Approve/Reject buttons → endrer change_proposal.status

### C. Database migrations

- `<timestamp>_payroll_phase2_change_proposal_wage_line_override.sql`:
  - Extend `change_proposal.kind` enum if needed (or use existing TEXT)
  - Add JSONB schema-validation comment for `wage_line_override` payload
- `<timestamp>_payroll_phase2_recalc_triggers.sql`:
  - DB trigger: `payroll_manual_supplement` AFTER INSERT OR DELETE → emit `engine_event` for recalc
  - DB trigger: `change_proposal` AFTER UPDATE WHEN status='applied' AND kind='wage_line_override' → apply override + emit recalc
  - DB trigger: `tip_distribution` AFTER INSERT WHEN status='approved' → emit recalc
- `<timestamp>_payroll_phase2_authority_seed.sql`:
  - `override_calculation_line` capability default registry row (level=confirm, min_role=manager, scope=workspace)

### D. Telemetry events (`packages/telemetry/src/registry.ts`)

- `payroll.line_override_proposed` — manager submits change_proposal
- `payroll.line_override_approved` — admin approves
- `payroll.line_override_rejected` — admin rejects
- `payroll.line_overridden` — recalc fires after approval, line replaced
- `payroll.recalc_triggered_by_supplement` — supplement insert/delete fires recalc
- `payroll.recalc_triggered_by_tip_distribution` — tip insert fires recalc

### E. Out of scope

- Phase 1.5 approve_period flow (separate sortie hvis prioritert)
- CSV/PDF/A-melding/Tripletex (Phase 3-7)
- Mobile authoring av manual_supplement (ADR-0133 — web-only)

## Tasks

- [ ] T1.1 — Migration: change_proposal.kind support for wage_line_override + JSONB schema
- [ ] T1.2 — Migration: recalc-triggers (3 stk: manual_supplement, change_proposal, tip_distribution)
- [ ] T1.3 — Migration: authority seed for override_calculation_line
- [ ] T1.4 — Telemetry registry: 6 nye events
- [x] T2.1 — Capability tool: `override_calculation_line` body m/ gatedMutation + L-0177 fail-fast + workspace verify (ADR-0151, ADR-0204) — commit 16eee4929
- [x] T2.2 — Capability tool: applier-funksjon for wage_line_override (når status='applied', erstatte payroll_calculation row m/ supersession-chain via shift_pay_calculation_event) — BFF POST /api/payroll/apply-line-override — commit 4d872692d
- [ ] T3.1 — UI: ManualSupplementForm.tsx modal — Screen 06 1:1 mockup-fidelity (Nordic Split tokens, Sofia kanoniske komponenter)
- [ ] T3.2 — UI: Trigger-button "+ Manuelt tillegg" på period-detalj header
- [ ] T3.3 — UI: Trigger-button "+ Manuelt tillegg" i LineDrawer
- [ ] T4.1 — UI: LineDrawer "Overstyr linje" action — modal m/ original/foreslått diff + grunn-required
- [ ] T4.2 — UI: "Venter godkjenning" badge på pending-override linjer
- [ ] T5.1 — UI: Inbox/proposals list w/ filter `kind='wage_line_override'`
- [ ] T5.2 — UI: Proposal-detail page w/ approve/reject + audit-trail
- [ ] T6.1 — Hooks: use-manual-supplements, use-line-overrides, use-payroll-proposals (TanStack Query, emit() i onSuccess)
- [ ] T7.1 — Recalc orchestration: Edge Function eller DB trigger som dispatcher engine_event på supplement/proposal/tip endring → triggers recalculate_period
- [ ] T7.2 — Verify: recalc completes <2s for 12-employee workspace (acceptance-target)
- [ ] T8.1 — Tests: golden-month override-scenario (golden expected fixture)
- [ ] T8.2 — Tests: recalc-trigger fires correctly (DB-level test)
- [ ] T9.1 — Journey verification (5/5 status: verified)
- [ ] T9.2 — HANDOFF + MANUAL-TEST docs
- [ ] T9.3 — Decision log: ADR for override-applier semantics (supersession via event vs direct update)

## Acceptance Criteria

- [ ] Every declared journey has `status: verified` in frontmatter
- [ ] Typecheck passes: `pnpm turbo typecheck`
- [ ] Decision log updated for any architectural choices (override-applier ADR)
- [ ] At least one E2E test exists per journey (recommended)
- [ ] Manager adds 200 NOK manual supplement via Screen 06 modal → recalc fires → updated total visible <2s
- [ ] Override flow: Manager proposes → admin sees in inbox → admin approves → recalc fires → line shows overridden amount with full audit chain (`shift_pay_calculation_event` supersession, `change_proposal` history, `activity_trail`)
- [ ] Period status='locked' rejects all 3 mutations m/ clear UI error
- [ ] UI matches Sofia Sprint 3 mockup 1:1 (Screen 06 ManualSupplementForm verified pixel-equivalent)
- [ ] All recalc-trigger paths fire correctly (manual_supplement insert/delete, change_proposal applied, tip_distribution insert) — verified via DB-level test

## Open questions

- Q1: Override applier semantics — supersede via shift_pay_calculation_event event (audit-pure) or direct payroll_calculation INSERT m/ derivation_version+1? Decision needed before T2.2 — ADR required.
- Q2: Recalc-trigger transport — DB trigger emit engine_event (event-engine consumes) vs direct Edge Function call? Affects latency + retry semantics. ADR draft pending.
- Q3: change_proposal.kind expansion — JSONB schema validation enforced via CHECK constraint or app-level Zod? P1 has TEXT kind, no enum.
