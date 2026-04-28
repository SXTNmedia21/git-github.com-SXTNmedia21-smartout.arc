---
title: "Plan — contract-employee"
status: draft
updated: 2026-04-29
created: 2026-04-29
module: contract
tags: [plan, contract, payroll, paragraf-14-6, docuseal]
---

# Plan — contract-employee

> Branch: `feat/services-contract-employee` | Worktree: /home/sxtnl/dev/smartout.ai-services-wt-1 | Base: `campaign/services` | Module: contract | Started: 2026-04-29

## Goal

Komplett ende-til-ende kontraktmodul: admin definerer §14-6-grunnlag på ansatt-profil, sender forenklet kontrakt for signering, ansatt signerer + ser sine forpliktelser, system enforce'r kontrakt i hverdagen (shift-cost, blockers, Botsson-svar), og amendment-flow når data endres.

## Scope

Five journeys (se `docs/journeys/JOURNEY-contract-employee.md`):

1. Admin definerer kontraktgrunnlag (people-page sections: Ansettelse + Lønnsprofil + Tipsregel)
2. Admin sender kontrakt (forenklet 2-stegs drawer: mal → preview+send)
3. Ansatt signerer + ser forpliktelser (DocuSeal flow + my-contract page)
4. System enforce'r kontrakt (clock-in blockers, shift-cost, Botsson capability)
5. Admin endrer kontrakt (amendment-flow med ny signering ved material endring)

## Tasks

### Phase 1 — Foundation (data + journeys)

- [ ] Audit existing tables: `employment_contract`, `employee_payroll_profile`, `contract_tip_rule`, `contract_amendment`, `contract_obligation`, `contract_pay_rule`, `framework_snapshot`
- [ ] Identify schema gaps vs journeys — propose migrations if needed
- [ ] Verify `workspace_framework_binding` setup for tariff resolution
- [ ] Confirm `contract_template`-table exists with `target_role`, `is_active`, `is_deprecated`

### Phase 2 — Journey 1: People-page sections

- [ ] HR-tab: Ansettelse-section with 15 §14-6-felt + validation
- [ ] HR-tab: Lønnsprofil-section (Tripletex-aligned) with framework-rule defaults
- [ ] HR-tab: Tipsregel-modal
- [ ] Inline-save with `employment_contract.upserted_inline` emit
- [ ] Status-derivation: "Klar til å sende kontrakt" gate

### Phase 3 — Journey 2: Send-drawer (forenklet)

- [ ] CompositionDrawer: 2 steg (mal → preview+send)
- [ ] Auto-suggest mal basert på `target_role`
- [ ] AcknowledgementRing (4 nøkkelblokker)
- [ ] `/api/contracts/send` med `framework_snapshot` freeze
- [ ] DocuSeal `signing_contract_id`-opprettelse

### Phase 4 — Journey 3: Employee signing + my-contract

- [ ] DocuSeal webhook `/api/docuseal/webhook` → `status='signed'`
- [ ] `/dashboard/my-contract` page: stilling + lønn + forpliktelser + tariff
- [ ] Forpliktelse-router → `/dashboard/competence/protocol/[id]`
- [ ] `contract.obligation_completed` emit hooked to engine_event

### Phase 5 — Journey 4: Daily enforcement

- [ ] Clock-in middleware: read `contract_obligation` blocker-flag
- [ ] Shift-cost calculation reading `contract_pay_rule`
- [ ] `salary_query` Botsson capability (linked to `shift_cost_snapshot`)
- [ ] Cron-job: `contract.obligation_due_soon` daily

### Phase 6 — Journey 5: Amendment flow

- [ ] Material vs non-material classification
- [ ] `contract_amendment` row with `parent_contract_id` + diff
- [ ] Versioned `employment_contract` (v1 superseded → v2 pending)
- [ ] Amendment side-by-side diff in my-contract
- [ ] Tariff-trigger bulk amendment-flow

### Phase 7 — Telemetry + audit

- [ ] All 15+ events registered in `packages/telemetry/src/registry.ts`
- [ ] Activity-trail entries for every mutation
- [ ] Dual-perspective verification (admin + ansatt flows)

## Acceptance Criteria

- [ ] Typecheck passes: `pnpm turbo typecheck`
- [ ] All 5 journeys covered by E2E tests in `apps/e2e/contract-employee/`
- [ ] Decision log updated: ADRs for amendment versioning, framework_snapshot freeze, obligation blocker model
- [ ] Telemetry registry: all events emit + route correctly
- [ ] No new direct-Edge-Function bypassing workspace-api
- [ ] Mobile parity: data layer in packages/, web UI ships first, mobile UI follow-up OK
- [ ] PII handling per ADR-0077 (personnr/bank — no voice channel, no AI context)
- [ ] Cascade-coupling: D2/D6/C3/C4 touchpoints verified per journey 1-5 table

## Risks / Open Questions

- Migration sequencing if schema gaps found (need ADR-0186 fanout pattern check)
- Existing JOURNEY-services-employee-contract-{create,send,sign,cancel}.md — reconcile or supersede?
- Existing PLAN-employee-contract.md, PLAN-employee-contract-design-specs.md — merge or supersede?
- Riksavtalen rate accuracy (memory: hospitality.ts has wrong rates)
- `framework_snapshot` JSONB schema — needs ADR if first introduction

## References

- Journey doc: `docs/journeys/JOURNEY-contract-employee.md`
- ADR-0076: Composition as cascade derivation
- ADR-0077: PII handling (personnr/bank)
- ADR-0078: Channel restriction (no voice for critical data)
- Module doc: `docs/modules/MODULE-04-contracts.md` (if exists, else create)
- Cascade spec: `docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md`
