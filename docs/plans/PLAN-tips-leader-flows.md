---
title: "Plan — tips-leader-flows"
feature: tips-leader-flows
spec: ../superpowers/specs/2026-04-28-tips-handling-hybrid-design.md
status: draft
updated: 2026-04-29
created: 2026-04-29
module: payroll
tags: [plan, tips, payroll]
---

# Plan — tips-leader-flows

> Branch: `feat/payroll-tips-leader-flows` | Worktree: `/home/sxtnl/dev/smartout.ai-payroll-wt-1` | Base: `campaign/payroll` | Module: payroll

**Spec:** [Tips handling — hybrid design](../superpowers/specs/2026-04-28-tips-handling-hybrid-design.md)

## Journeys (the contract)

- [JOURNEY-tips-leader-flows-leder-setter-pot](../journeys/JOURNEY-tips-leader-flows-leder-setter-pot.md) — Leder registrerer tips-pot på dagens dagskontroll
- [JOURNEY-tips-leader-flows-leder-justerer-andel](../journeys/JOURNEY-tips-leader-flows-leder-justerer-andel.md) — Leder justerer enkeltansatts tips-andel med begrunnelse
- [JOURNEY-tips-leader-flows-leder-godkjenner-distribusjon](../journeys/JOURNEY-tips-leader-flows-leder-godkjenner-distribusjon.md) — Leder godkjenner distribusjon ved oppgjør

## Goal

Implementer tre leder-flows for tips: registrer pot, juster andel, godkjenn distribusjon — som fyller ut Sortie 1's capability-skeletons med ekte DB-mutasjoner, BFF-routes og UI-tiles i eksisterende DayControlPanel.OkonomiTab + WebDayControl.SignoffTab + Reconciliation.DayDetail.

## Sortie 1 reminder (already landed)

Sortie 1 leverte: 5 DB-tabeller + 3 enums + RLS + 4 capability-skeletons (`{ok:false, error:'not_implemented'}`) + telemetry-registry + `tips_workspace_settings` opt-in + `useTipsEnabled` hook (web + mobile) + admin-toggle UI + `calculate.ts` ren funksjon (9 vitest-grønne).

## Scope (Sortie 2)

### A. Capability tool bodies (3 av 4)

- [ ] `tips.set_pot` — INSERT `tip_pool`, status=`draft`, emit `tip_pool created`
- [ ] `tips.adjust_share` — UPDATE `tip_distribution`, INSERT `tip_adjustment_log`, emit `tip_distribution adjusted`
- [ ] `tips.approve_distribution` — UPDATE `tip_pool.status='approved'` + child distributions, emit `tip_pool approved`
- [ ] `tips.query_own_share` — utelatt (Sortie 3 — employee-flow)

Alle tre må:
- Kalle `callTipsGate(action)` FØR mutasjon (ADR-0196 invariant 13 — gate på alle mutasjoner uavhengig av authority-default)
- Returnere `{ok:true, ...artefakt}` ELLER `{ok:false, error:'<code>'}`
- Aldri emitte `run_started` uten å produsere domain-artefakt i samme execute (ADR-0196 invariant 11)

### B. BFF routes (web)

- [ ] `apps/web/src/app/api/tips/set-pot/route.ts` — POST, validerer body via Zod, kaller capability via stage-engine
- [ ] `apps/web/src/app/api/tips/adjust-share/route.ts` — POST
- [ ] `apps/web/src/app/api/tips/approve-distribution/route.ts` — POST
- [ ] Alle bruker `resolveCurrentProfile()` for actor_id (ADR-0151 server-derived identity)

### C. UI — leder-flater

- [ ] `OkonomiTab` tile: tom-tilstand → "Registrer tips" → modal (Sortie 1's stub utvides)
  - Path: `apps/web/src/components/day-control-panel/tabs/OkonomiTab.tsx`
  - Ny komponent: `apps/web/src/components/tips/PotRegistrationModal.tsx`
- [ ] `SignoffTab` tips-kort: viser pot-status + ApproveBar når `calculated`
  - Path: `apps/web/src/components/web-day-control/tabs/SignoffTab.tsx`
  - Ny komponent: `apps/web/src/components/tips/ApproveBar.tsx`
- [ ] `DayDetail` Tips-tab: distribusjons-tabell + AdjustmentDialog per rad
  - Path: `apps/web/src/components/reconciliation/DayDetail.tsx`
  - Ny komponent: `apps/web/src/components/tips/AdjustmentDialog.tsx`
  - Alle synlige bare når `useTipsEnabled().enabled === true`

### D. TanStack mutations + hooks

- [ ] `useSetTipsPot()` — mutation hook, invalidate `["tips-pool", sessionId]`
- [ ] `useAdjustTipsShare()` — mutation hook, optimistic update + rollback
- [ ] `useApproveTipsDistribution()` — mutation hook, invalidate pool + distributions

### E. Reads

- [ ] `useTipsPool(sessionId)` — query, joiner pool + distributions
- [ ] Server-side: tabell-RLS sikrer workspace-scope; ingen ekstra check trengs

## Tasks

Fyll ut detaljert task-by-task plan i samme stil som `docs/superpowers/plans/2026-04-28-tips-handling-sortie-1.md` før koding starter. Bruk superpowers:writing-plans hvis ny plan er nødvendig, ellers fyll ut tasks her.

- [ ] Phase 0: Fact-check spec mot Sortie 1's faktiske DB-schema (kolonnenavn, FK-er, RLS-policy-navn)
- [ ] Phase 1: BFF routes (3) med Zod-validering + stage-engine-kall
- [ ] Phase 2: Capability tool bodies (3) — TDD med vitest, gate-call før mutasjon
- [ ] Phase 3: TanStack hooks (5) + types fra `database.types.ts` (regen ved schema-endringer)
- [ ] Phase 4: UI-komponenter (3 nye) + integrasjon i 3 eksisterende tabs (gated på `tipsEnabled`)
- [ ] Phase 5: E2E tests (Playwright) — 1 test per journey
- [ ] Phase 6: Verify — typecheck, vitest, e2e, grep ADR-0196 invariants → handoff

## Acceptance Criteria

- [ ] Every declared journey has `status: verified` in frontmatter
- [ ] Typecheck passes: `pnpm turbo typecheck`
- [ ] Vitest passes for all new pure functions + capability tool tests
- [ ] Decision log updated for any architectural choices
- [ ] At least one E2E test exists per journey (3 total)
- [ ] ADR-0196 invariant 11: zero phantom emits — every `run_started` emit followed by DB write OR `not_implemented` return (grep gate)
- [ ] ADR-0196 invariant 13: every mutation tool calls `callTipsGate()` before mutation (grep gate)
- [ ] ADR-0151: BFF routes derive `actor_id` server-side via `resolveCurrentProfile()`, never trust body
- [ ] Telemetry registry: `tip_pool created`, `tip_distribution adjusted`, `tip_pool approved` all wired with payload schema
- [ ] Master toggle: all 3 leader UI surfaces invisible when `tips_enabled = false`

## Out of Scope (Sortie 3 + 4)

- Employee mobile flows (`tips.query_own_share` body, AfterShiftView tile, NotificationSheet) — Sortie 3
- Push-notif (defer to payroll campaign — paid trigger via payroll-run)
- Four-eyes flow (placeholder error, real impl later)
- Audit-trail review UI + close-feature gate hardening — Sortie 4
